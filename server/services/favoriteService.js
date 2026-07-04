/**
 * 收藏 + 评分服务
 */
import { dal } from '../db.js';

// ── 收藏 ──

export async function addFavorite(userId, trackId) {
  await dal.run(
    'INSERT OR IGNORE INTO favorites (user_id, track_id, created_at) VALUES (?, ?, ?)',
    [userId, trackId, Date.now()]
  );
  return { ok: true };
}

export async function removeFavorite(userId, trackId) {
  const { changes } = await dal.run(
    'DELETE FROM favorites WHERE user_id = ? AND track_id = ?', [userId, trackId]
  );
  return { ok: changes > 0 };
}

export async function isFavorited(userId, trackId) {
  const row = await dal.get(
    'SELECT 1 FROM favorites WHERE user_id = ? AND track_id = ?', [userId, trackId]
  );
  return Boolean(row);
}

export async function getUserFavorites(userId, { page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const total = (await dal.get(
    'SELECT COUNT(*) as cnt FROM favorites WHERE user_id = ?', [userId]
  ))?.cnt || 0;

  const rows = await dal.query(
    `SELECT sl.*, f.created_at as favorited_at
     FROM favorites f
     JOIN shared_library sl ON sl.id = f.track_id
     WHERE f.user_id = ?
     ORDER BY f.created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );

  return {
    total, page, limit,
    tracks: rows.map((r) => ({
      id: r.id, title: r.title, genre: r.genre, bpm: r.bpm, mbti: r.mbti, mode: r.mode,
      audioUrl: r.audio_local || r.audio_url,
      playCount: r.play_count, favoritedAt: r.favorited_at,
    })),
  };
}

// ── 评分 ──

export async function rateTrack(userId, trackId, score) {
  if (score < 1 || score > 5) throw new Error('Score must be 1-5');
  await dal.run(
    `INSERT OR REPLACE INTO ratings (user_id, track_id, score, created_at) VALUES (?, ?, ?, ?)`,
    [userId, trackId, score, Date.now()]
  );
  // 更新 shared_library.quality_score 为平均评分
  await dal.run(
    `UPDATE shared_library SET quality_score = (
      SELECT AVG(score) FROM ratings WHERE track_id = ?
    ) WHERE id = ?`,
    [trackId, trackId]
  );
  return { ok: true, score };
}

export async function getUserRating(userId, trackId) {
  const row = await dal.get(
    'SELECT score FROM ratings WHERE user_id = ? AND track_id = ?', [userId, trackId]
  );
  return row?.score || null;
}

export async function getTrackRatings(trackId) {
  const row = await dal.get(
    'SELECT AVG(score) as avg, COUNT(*) as cnt FROM ratings WHERE track_id = ?', [trackId]
  );
  return { average: row?.avg ? Math.round(row.avg * 10) / 10 : null, count: row?.cnt || 0 };
}
