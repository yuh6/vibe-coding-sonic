/**
 * 曲库池 (Track Pool) — docs/ai-music-engine-design.md §8.5
 * SQLite `track_pool` / `play_history` 表的读写封装；渐进生成策略与防重复规则的
 * 数据侧支持都在这里，评分/决策逻辑在 arranger.js。
 */
import { db } from '../../db.js';

const insertTrackStmt = db.prepare(`
  INSERT INTO track_pool
    (session_id, phase, mood_tag, energy_level, genre, instruments, prompt_config,
     audio_url, audio_local, duration_sec)
  VALUES (@sessionId, @phase, @moodTag, @energyLevel, @genre, @instruments, @promptConfig,
          @audioUrl, @audioLocal, @durationSec)
`);

const updateAudioStmt = db.prepare(`
  UPDATE track_pool SET audio_url = @audioUrl, audio_local = @audioLocal, duration_sec = @durationSec
  WHERE id = @id
`);

const listByPhaseStmt = db.prepare(`
  SELECT * FROM track_pool WHERE session_id = ? AND phase = ? ORDER BY created_at ASC
`);

const listReadyByPhaseStmt = db.prepare(`
  SELECT * FROM track_pool WHERE session_id = ? AND phase = ? AND audio_url IS NOT NULL ORDER BY created_at ASC
`);

const countReadyByPhaseStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM track_pool WHERE session_id = ? AND phase = ? AND audio_url IS NOT NULL
`);

const countPendingByPhaseStmt = db.prepare(`
  SELECT COUNT(*) AS n FROM track_pool WHERE session_id = ? AND phase = ? AND audio_url IS NULL
`);

const getTrackStmt = db.prepare(`SELECT * FROM track_pool WHERE id = ?`);

const bumpPlayCountStmt = db.prepare(`
  UPDATE track_pool SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id = ?
`);

const insertPlayHistoryStmt = db.prepare(`
  INSERT INTO play_history (session_id, track_pool_id, phase) VALUES (?, ?, ?)
`);

const endPlayHistoryStmt = db.prepare(`
  UPDATE play_history SET ended_at = CURRENT_TIMESTAMP, user_skipped = @skipped WHERE id = @id
`);

const recentHistoryStmt = db.prepare(`
  SELECT ph.*, tp.genre, tp.instruments, tp.energy_level
  FROM play_history ph
  JOIN track_pool tp ON tp.id = ph.track_pool_id
  WHERE ph.session_id = ?
  ORDER BY ph.started_at DESC, ph.id DESC
  LIMIT ?
`);

const poolCountBySessionStmt = db.prepare(`
  SELECT phase, COUNT(*) AS total, SUM(CASE WHEN audio_url IS NOT NULL THEN 1 ELSE 0 END) AS ready
  FROM track_pool WHERE session_id = ? GROUP BY phase
`);

function parseTrack(row) {
  if (!row) return null;
  return {
    id: row.id,
    sessionId: row.session_id,
    phase: row.phase,
    moodTag: row.mood_tag,
    energyLevel: row.energy_level,
    genre: row.genre,
    instruments: safeJsonParse(row.instruments, []),
    promptConfig: safeJsonParse(row.prompt_config, {}),
    audioUrl: row.audio_url,
    audioLocal: row.audio_local,
    durationSec: row.duration_sec,
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
    createdAt: row.created_at,
  };
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** 新建一个曲库池条目（初始时可能还没有 audioUrl，异步生成完成后用 markTrackReady 回填） */
export async function createTrack(sessionId, { phase, moodTag, energyLevel, genre, instruments, promptConfig, audioUrl = null, audioLocal = null, durationSec = null }) {
  const result = await insertTrackStmt.run({
    sessionId,
    phase,
    moodTag,
    energyLevel,
    genre,
    instruments: JSON.stringify(instruments || []),
    promptConfig: JSON.stringify(promptConfig || {}),
    audioUrl,
    audioLocal,
    durationSec,
  });
  return parseTrack(await getTrackStmt.get(result.lastInsertRowid));
}

/** 生成完成后回填音频地址 */
export async function markTrackReady(trackId, { audioUrl, audioLocal = null, durationSec = null }) {
  await updateAudioStmt.run({ id: trackId, audioUrl, audioLocal, durationSec });
  return parseTrack(await getTrackStmt.get(trackId));
}

export async function getTrack(trackId) {
  return parseTrack(await getTrackStmt.get(trackId));
}

export async function listTracks(sessionId, phase) {
  const rows = await listByPhaseStmt.all(sessionId, phase);
  return rows.map(parseTrack);
}

/** 只返回已经生成完成、可播放的曲目 */
export async function listReadyTracks(sessionId, phase) {
  const rows = await listReadyByPhaseStmt.all(sessionId, phase);
  return rows.map(parseTrack);
}

export async function countReady(sessionId, phase) {
  return Number((await countReadyByPhaseStmt.get(sessionId, phase))?.n || 0);
}

export async function countPending(sessionId, phase) {
  return Number((await countPendingByPhaseStmt.get(sessionId, phase))?.n || 0);
}

/** 记录一次播放开始，返回 play_history 行 id（曲目播完/跳过时用 endPlay 收尾） */
export async function recordPlayStart(sessionId, trackId, phase) {
  await bumpPlayCountStmt.run(trackId);
  const result = await insertPlayHistoryStmt.run(sessionId, trackId, phase);
  return result.lastInsertRowid;
}

export async function endPlay(playHistoryId, { skipped = false } = {}) {
  await endPlayHistoryStmt.run({ id: playHistoryId, skipped: skipped ? 1 : 0 });
}

/** 最近 N 条播放记录（含 genre/instruments/energy），用于防重复与变化奖励打分 */
export async function recentHistory(sessionId, limit = 10) {
  const rows = await recentHistoryStmt.all(sessionId, limit);
  return rows.map((row) => ({
    id: row.id,
    trackPoolId: row.track_pool_id,
    phase: row.phase,
    genre: row.genre,
    instruments: safeJsonParse(row.instruments, []),
    energyLevel: row.energy_level,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    userSkipped: Boolean(row.user_skipped),
  }));
}

/** 曲库池状态汇总（按阶段分组的 total/ready），供 GET /api/arranger/pool-status */
export async function poolStatus(sessionId) {
  const rows = await poolCountBySessionStmt.all(sessionId);
  const byPhase = {};
  for (const row of rows) {
    byPhase[row.phase] = { total: Number(row.total || 0), ready: Number(row.ready || 0) };
  }
  return byPhase;
}
