import { db, today } from '../db.js';
import { getSetting } from '../config/runtimeConfig.js';

const TOTAL_QUOTA_KEY = 'total';
const DEFAULT_GENERATION_LIMIT = 5;
const GLOBAL_DAILY_LIMIT = Number(process.env.GLOBAL_DAILY_LIMIT || 100);

function positiveInt(value, fallback = DEFAULT_GENERATION_LIMIT) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

async function normalizeUser(userOrId) {
  if (userOrId && typeof userOrId === 'object') return userOrId;
  const row = await db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(userOrId);
  return row || { id: userOrId, role: 'user' };
}

export function quotaSettings() {
  return {
    guestLimit: positiveInt(getSetting('GUEST_GENERATION_LIMIT', String(DEFAULT_GENERATION_LIMIT))),
    userLimit: positiveInt(getSetting('USER_GENERATION_LIMIT', String(DEFAULT_GENERATION_LIMIT))),
    globalDailyLimit: GLOBAL_DAILY_LIMIT,
  };
}

async function quotaLimitFor(userOrId) {
  const user = await normalizeUser(userOrId);
  if (user?.role === 'vip' || user?.role === 'admin' || user?.isVip) return null;
  const settings = quotaSettings();
  return user?.role === 'guest' || user?.isGuest ? settings.guestLimit : settings.userLimit;
}

export async function getQuota(userOrId) {
  const user = await normalizeUser(userOrId);
  const row = await db.prepare('SELECT used FROM quotas WHERE user_id = ? AND day = ?').get(user.id, TOTAL_QUOTA_KEY);
  const used = Number(row?.used || 0);
  const limit = await quotaLimitFor(user);
  return {
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    unlimited: limit === null,
    role: user.role || 'user',
    scope: 'total',
  };
}

async function globalUsedToday() {
  const row = await db.prepare('SELECT SUM(used) AS total FROM quotas WHERE day = ?').get(today());
  return Number(row?.total || 0);
}

// 检查并占用一次配额；返回 { ok } 或 { ok: false, status, error }
export async function consumeQuota(userOrId) {
  const user = await normalizeUser(userOrId);
  if (await globalUsedToday() >= GLOBAL_DAILY_LIMIT) {
    return {
      ok: false,
      status: 503,
      error: '今日全站生成额度已用完，已自动切换兜底曲库',
      code: 'GLOBAL_BUDGET_EXCEEDED',
    };
  }
  const quota = await getQuota(user);
  if (!quota.unlimited && quota.remaining <= 0) {
    return {
      ok: false,
      status: 429,
      error: `${user.role === 'guest' ? '游客' : '账号'} ${quota.limit} 首生成额度已用完，VIP 用户不限制生成`,
      code: 'QUOTA_EXCEEDED',
    };
  }
  if (quota.unlimited) return { ok: true, quota };
  await db.prepare(
    `INSERT INTO quotas (user_id, day, used) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET used = quotas.used + 1`
  ).run(user.id, TOTAL_QUOTA_KEY);
  await db.prepare(
    `INSERT INTO quotas (user_id, day, used) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET used = quotas.used + 1`
  ).run(user.id, today());
  return { ok: true, quota: await getQuota(user) };
}

// TTAPI 失败落到兜底时退还配额（用户没得到真实生成，不该计费）
export async function refundQuota(userId) {
  await db.prepare(
    'UPDATE quotas SET used = CASE WHEN used > 0 THEN used - 1 ELSE 0 END WHERE user_id = ? AND day = ?'
  ).run(userId, TOTAL_QUOTA_KEY);
  await db.prepare(
    'UPDATE quotas SET used = CASE WHEN used > 0 THEN used - 1 ELSE 0 END WHERE user_id = ? AND day = ?'
  ).run(userId, today());
}

export async function saveTrack({ jobId, userId, title, mbti, mode, prompt, audioUrl, tracks, fallback }) {
  await db.prepare(
    `INSERT INTO tracks (id, user_id, title, mbti, mode, prompt, audio_url, tracks_json, fallback, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       user_id = excluded.user_id,
       title = excluded.title,
       mbti = excluded.mbti,
       mode = excluded.mode,
       prompt = excluded.prompt,
       audio_url = excluded.audio_url,
       tracks_json = excluded.tracks_json,
       fallback = excluded.fallback,
       created_at = excluded.created_at`
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

export async function listTracks(userId, limit = 50) {
  const rows = await db
    .prepare('SELECT * FROM tracks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?')
    .all(userId, limit);
  return rows.map((row) => ({
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

export async function userOwnsTrackUrl(userId, url) {
  const rows = await db
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

export async function getProfile(userId) {
  const row = await db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    axes: row.axes_json ? JSON.parse(row.axes_json) : null,
    style: row.style_json ? JSON.parse(row.style_json) : null,
    mode: row.mode || null,
    updatedAt: row.updated_at,
  };
}

export async function saveProfile(userId, { axes, style, mode }) {
  await db.prepare(
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
