import { db, today } from '../db.js';

const QUOTA_PER_DAY = Number(process.env.QUOTA_PER_DAY || 5);
const GLOBAL_DAILY_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT || 100);

export function getQuota(userId) {
  const row = db.prepare('SELECT used FROM quotas WHERE user_id = ? AND day = ?').get(userId, today());
  const used = row?.used || 0;
  return { used, limit: QUOTA_PER_DAY, remaining: Math.max(0, QUOTA_PER_DAY - used) };
}

function globalUsedToday() {
  const row = db.prepare('SELECT SUM(used) AS total FROM quotas WHERE day = ?').get(today());
  return row?.total || 0;
}

// 检查并占用一次配额；返回 { ok } 或 { ok: false, status, error }
export function consumeQuota(userId) {
  if (globalUsedToday() >= GLOBAL_DAILY_LIMIT) {
    return {
      ok: false,
      status: 503,
      error: '今日全站生成额度已用完，已自动切换兜底曲库',
      code: 'GLOBAL_BUDGET_EXCEEDED',
    };
  }
  const { remaining } = getQuota(userId);
  if (remaining <= 0) {
    return {
      ok: false,
      status: 429,
      error: `今日 ${QUOTA_PER_DAY} 首生成配额已用完，明天重置（兜底曲库不限量）`,
      code: 'QUOTA_EXCEEDED',
    };
  }
  db.prepare(
    `INSERT INTO quotas (user_id, day, used) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET used = used + 1`
  ).run(userId, today());
  return { ok: true };
}

// TTAPI 失败落到兜底时退还配额（用户没得到真实生成，不该计费）
export function refundQuota(userId) {
  db.prepare(
    'UPDATE quotas SET used = MAX(0, used - 1) WHERE user_id = ? AND day = ?'
  ).run(userId, today());
}

export function saveTrack({ jobId, userId, title, mbti, mode, prompt, audioUrl, tracks, fallback }) {
  db.prepare(
    `INSERT OR REPLACE INTO tracks (id, user_id, title, mbti, mode, prompt, audio_url, tracks_json, fallback, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    jobId,
    userId,
    title || null,
    mbti || null,
    mode || null,
    prompt || null,
    audioUrl || null,
    JSON.stringify(tracks || []),
    fallback ? 1 : 0,
    Date.now()
  );
}

export function listTracks(userId, limit = 50) {
  return db
    .prepare('SELECT * FROM tracks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit)
    .map((row) => ({
      id: row.id,
      title: row.title,
      mbti: row.mbti,
      mode: row.mode,
      prompt: row.prompt,
      audioUrl: row.audio_url,
      tracks: JSON.parse(row.tracks_json || '[]'),
      fallback: Boolean(row.fallback),
      createdAt: row.created_at,
    }));
}

export function userOwnsTrackUrl(userId, url) {
  const rows = db
    .prepare('SELECT audio_url, tracks_json FROM tracks WHERE user_id = ? ORDER BY created_at DESC LIMIT 200')
    .all(userId);

  for (const row of rows) {
    if (row.audio_url === url) return true;
    try {
      const tracks = JSON.parse(row.tracks_json || '[]');
      if (tracks.some((track) => track?.url === url)) return true;
    } catch {
      // Ignore malformed legacy rows.
    }
  }

  return false;
}

export function getProfile(userId) {
  const row = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    axes: row.axes_json ? JSON.parse(row.axes_json) : null,
    style: row.style_json ? JSON.parse(row.style_json) : null,
    mode: row.mode || null,
    updatedAt: row.updated_at,
  };
}

export function saveProfile(userId, { axes, style, mode }) {
  db.prepare(
    `INSERT INTO profiles (user_id, axes_json, style_json, mode, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       axes_json = excluded.axes_json,
       style_json = excluded.style_json,
       mode = excluded.mode,
       updated_at = excluded.updated_at`
  ).run(
    userId,
    axes ? JSON.stringify(axes) : null,
    style ? JSON.stringify(style) : null,
    mode || null,
    Date.now()
  );
}
