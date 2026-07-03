import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { db } from '../db.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 天
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 80;
const MAX_PASSWORD_LENGTH = 128;
const DUMMY_PASSWORD_HASH = `${'0'.repeat(32)}:${'0'.repeat(128)}`;
const scryptAsync = promisify(scrypt);
export const SESSION_COOKIE = 'vibe_session';

function normalizeEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (normalized.length > MAX_EMAIL_LENGTH) throw new Error('邮箱过长');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error('邮箱格式不正确');
  return normalized;
}

function normalizePassword(password, { forLogin = false } = {}) {
  const normalized = String(password || '');
  if (!forLogin && normalized.length < 8) throw new Error('密码至少 8 位');
  if (normalized.length > MAX_PASSWORD_LENGTH) throw new Error(`密码最多 ${MAX_PASSWORD_LENGTH} 位`);
  return normalized;
}

function normalizeName(name, fallback) {
  return (String(name || '').trim() || fallback).slice(0, MAX_NAME_LENGTH);
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scryptAsync(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = await scryptAsync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export async function registerUser({ email, password, name }) {
  const normalized = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);
  const displayName = normalizeName(name, normalized.split('@')[0]);

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normalized);
  if (exists) throw new Error('该邮箱已注册');

  const user = {
    id: randomUUID(),
    email: normalized,
    password_hash: await hashPassword(normalizedPassword),
    name: displayName,
    created_at: Date.now(),
  };
  db.prepare(
    'INSERT INTO users (id, email, password_hash, name, created_at) VALUES (@id, @email, @password_hash, @name, @created_at)'
  ).run(user);
  return { id: user.id, email: user.email, name: user.name, role: 'user' };
}

export async function loginUser({ email, password }) {
  const normalized = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password, { forLogin: true });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(normalized);
  // 用户不存在时也做一次哈希，避免时间侧信道暴露邮箱是否注册
  if (!row) {
    await verifyPassword(normalizedPassword, DUMMY_PASSWORD_HASH);
    throw new Error('邮箱或密码错误');
  }
  if (!(await verifyPassword(normalizedPassword, row.password_hash))) throw new Error('邮箱或密码错误');
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
