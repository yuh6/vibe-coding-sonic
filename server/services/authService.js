import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'crypto';
import { db } from '../db.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
export const SESSION_COOKIE = 'vibe_session';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function registerUser({ email, password, name }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('邮箱格式不正确');
  if (!password || password.length < 8) throw new Error('密码至少 8 位');
  const displayName = String(name || '').trim() || normalized.split('@')[0];

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
  if (exists) throw new Error('该邮箱已注册');

  const user = {
    id: randomUUID(),
    email: normalized,
    password_hash: hashPassword(password),
    name: displayName,
    created_at: Date.now(),
  };
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (@id, @email, @password_hash, @name, @created_at)'
  ).run(user);
  return { id: user.id, email: user.email, name: user.name, role: 'user' };
}

export function loginUser({ email, password }) {
  const normalized = String(email || '').trim().toLowerCase();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  // 用户不存在时也做一次哈希，避免时间侧信道暴露邮箱是否注册
  if (!row) {
    verifyPassword(password || '', 'x:0000');
    throw new Error('邮箱或密码错误');
  }
  if (!verifyPassword(password || '', row.password_hash)) throw new Error('邮箱或密码错误');
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export function createSession(userId) {
  const token = randomBytes(32).toString('hex');
  db.prepare(
    'INSERT INTO auth_sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(token, userId, Date.now() + SESSION_TTL_MS, Date.now());
  return { token, maxAgeMs: SESSION_TTL_MS };
}

export function destroySession(token) {
  if (token) db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
}

export function getUserBySession(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.name, u.role, s.expires_at
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}
