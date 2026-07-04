/**
 * 播放历史 + 推荐服务
 *
 * 记录用户播放行为，基于历史偏好做简单推荐。
 * 推荐策略：按用户最常听的 genre/mode/mbti 加权搜索总库中未听过的歌。
 */
import { dal } from '../db.js';

// ── 播放记录 ──

export async function recordPlay({ userId, trackId, durationSec = null, completed = false }) {
  await dal.run(
    `INSERT INTO user_play_history (user_id, track_id, duration_sec, completed, played_at)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, trackId, durationSec, completed ? 1 : 0, Date.now()]
  );
  // 同步更新 shared_library play_count
  await dal.run('UPDATE shared_library SET play_count = play_count + 1 WHERE id = ?', [trackId]);
}

export async function getUserHistory(userId, { page = 1, limit = 30 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const total = (await dal.get(
    'SELECT COUNT(*) as cnt FROM user_play_history WHERE user_id = ?', [userId]
  ))?.cnt || 0;

  const rows = await dal.query(
    `SELECT h.*, sl.title, sl.genre, sl.bpm, sl.mbti, sl.mode,
            COALESCE(sl.audio_local, sl.audio_url) as audio_url
     FROM user_play_history h
     JOIN shared_library sl ON sl.id = h.track_id
     WHERE h.user_id = ?
     ORDER BY h.played_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  return {
    total, page, limit,
    history: rows.map((r) => ({
      trackId: r.track_id, title: r.title, genre: r.genre, bpm: r.bpm,
      mbti: r.mbti, mode: r.mode, audioUrl: r.audio_url,
      durationSec: r.duration_sec, completed: Boolean(r.completed),
      playedAt: r.played_at,
    })),
  };
}

// ── 推荐 ──

export async function getRecommendations(userId, { limit = 10 } = {}) {
  // 1. 分析用户偏好：最常播放的 genre/mode
  const prefs = await dal.query(
    `SELECT sl.genre, sl.mode, COUNT(*) as cnt
     FROM user_play_history h
     JOIN shared_library sl ON sl.id = h.track_id
     WHERE h.user_id = ?
     GROUP BY sl.genre, sl.mode
     ORDER BY cnt DESC LIMIT 5`,
    [userId]
  );

  if (!prefs.length) {
    // 冷启动：返回热门歌曲
    return getPopularTracks(limit);
  }

  // 2. 获取已听 track IDs（排除重复推荐）
  const heardRows = await dal.query(
    'SELECT DISTINCT track_id FROM user_play_history WHERE user_id = ? ORDER BY played_at DESC LIMIT 200',
    [userId]
  );
  const heardSet = new Set(heardRows.map((r) => r.track_id));

  // 3. 按偏好搜索（genre 优先匹配）
  const topGenre = prefs[0]?.genre?.split(',')[0]?.trim();
  const topMode = prefs[0]?.mode;

  let candidates = await dal.query(
    `SELECT * FROM shared_library
     WHERE (audio_local IS NOT NULL OR audio_url IS NOT NULL)
     AND genre LIKE ?
     ORDER BY quality_score DESC, play_count DESC LIMIT ?`,
    [`%${topGenre || ''}%`, limit * 3]
  );

  // 过滤已听
  candidates = candidates.filter((c) => !heardSet.has(c.id));

  // 不够则补充同 mode 的
  if (candidates.length < limit && topMode) {
    const more = await dal.query(
      `SELECT * FROM shared_library
       WHERE mode = ? AND (audio_local IS NOT NULL OR audio_url IS NOT NULL)
       ORDER BY quality_score DESC, play_count DESC LIMIT ?`,
      [topMode, limit * 2]
    );
    for (const m of more) {
      if (!heardSet.has(m.id) && !candidates.find((c) => c.id === m.id)) candidates.push(m);
    }
  }

  return candidates.slice(0, limit).map(formatTrack);
}

export async function getPopularTracks(limit = 10) {
  const rows = await dal.query(
    `SELECT * FROM shared_library
     WHERE (audio_local IS NOT NULL OR audio_url IS NOT NULL)
     ORDER BY play_count DESC, quality_score DESC LIMIT ?`,
    [limit]
  );
  return rows.map(formatTrack);
}

function formatTrack(r) {
  return {
    id: r.id, title: r.title, genre: r.genre, bpm: r.bpm,
    mbti: r.mbti, mode: r.mode,
    audioUrl: r.audio_local || r.audio_url,
    playCount: r.play_count, qualityScore: r.quality_score,
  };
}
