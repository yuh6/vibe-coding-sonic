import { db } from '../db.js';

const TOTAL_QUOTA_KEY = 'total';
const EDITABLE_ROLES = new Set(['guest', 'user', 'vip']);

function publicRow(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role || 'user',
    generationCount: Number(row.generation_count || 0),
    creditBalance: Number(row.credit_balance || 0),
    trackCount: Number(row.track_count || 0),
    createdAt: row.created_at,
  };
}

export async function listUsers({ limit = 100 } = {}) {
  const rows = await db.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.created_at,
            COALESCE(q.used, 0) AS generation_count,
            COALESCE(c.balance, 0) AS credit_balance,
            COUNT(t.id) AS track_count
     FROM users u
     LEFT JOIN quotas q ON q.user_id = u.id AND q.day = ?
     LEFT JOIN user_credits c ON c.user_id = u.id
     LEFT JOIN tracks t ON t.user_id = u.id
     GROUP BY u.id, u.email, u.name, u.role, u.created_at, q.used, c.balance
     ORDER BY u.created_at DESC
     LIMIT ?`
  ).all(TOTAL_QUOTA_KEY, Math.max(1, Math.min(Number(limit) || 100, 500)));
  return rows.map(publicRow);
}

export async function updateUserRole(userId, role) {
  const normalized = String(role || '').trim().toLowerCase();
  if (!EDITABLE_ROLES.has(normalized)) {
    throw new Error('role must be guest, user, or vip');
  }
  const result = await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(normalized, userId);
  if (!result.changes) return null;
  const row = await db.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.created_at,
            COALESCE(q.used, 0) AS generation_count,
            COALESCE(c.balance, 0) AS credit_balance,
            COUNT(t.id) AS track_count
     FROM users u
     LEFT JOIN quotas q ON q.user_id = u.id AND q.day = ?
     LEFT JOIN user_credits c ON c.user_id = u.id
     LEFT JOIN tracks t ON t.user_id = u.id
     WHERE u.id = ?
     GROUP BY u.id, u.email, u.name, u.role, u.created_at, q.used, c.balance`
  ).get(TOTAL_QUOTA_KEY, userId);
  return row ? publicRow(row) : null;
}
