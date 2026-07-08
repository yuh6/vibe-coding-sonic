/**
 * Runtime config store — 管理后台保存的配置。
 * 生产环境持久化到数据库；首次启动时会从旧的 gitignored JSON 文件导入一次。
 */
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../data/runtime-config.json');

// 管理后台允许写入的字段白名单
export const EDITABLE_KEYS = [
  'TTAPI_KEY',
  'TTAPI_SUNO_MV',
  'USE_FALLBACK_ONLY',
  'GUEST_GENERATION_LIMIT',
  'USER_GENERATION_LIMIT',
  'VIP_GENERATION_LIMIT',
  'GLOBAL_DAILY_LIMIT',
  'LLM_PROVIDER',
  'LLM_MODEL',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'SILICONFLOW_API_KEY',
  'OPENROUTER_API_KEY',
  'LLM_API_KEY',
  'LLM_API_BASE',
  'CODEX_CLI_PATH',
  'CODEX_API_KEY',
  'GEMINI_CLI_PATH',
  'CLAUDE_CLI_PATH',
  'KIMI_CLI_PATH',
  'KIMI_API_KEY',
];

const SECRET_PATTERN = /(KEY|TOKEN|SECRET)/;

let cache = await load();

function envValue(key) {
  const value = process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function isSecretKey(key) {
  return SECRET_PATTERN.test(key);
}

function isEnvironmentLocked(key) {
  return process.env.NODE_ENV === 'production' && isSecretKey(key) && Boolean(envValue(key));
}

function loadLegacyFile() {
  if (!existsSync(CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

async function load() {
  const rows = await db.prepare('SELECT name, value FROM app_settings').all();
  if (rows.length) {
    return Object.fromEntries(rows.map((row) => [row.name, row.value]));
  }

  const legacy = loadLegacyFile();
  if (!legacy || typeof legacy !== 'object') return {};

  const next = {};
  for (const [key, value] of Object.entries(legacy)) {
    if (!EDITABLE_KEYS.includes(key) || value === null || value === '') continue;
    next[key] = String(value);
    await db.prepare(
      `INSERT INTO app_settings (name, value, updated_at)
       VALUES (@name, @value, @updatedAt)
       ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run({ name: key, value: next[key], updatedAt: Date.now() });
  }
  return next;
}

export function getSetting(key, fallback = '') {
  if (isEnvironmentLocked(key)) return envValue(key);
  const value = cache[key] ?? envValue(key);
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export async function updateSettings(patch) {
  const applied = [];
  const skipped = [];
  for (const [key, value] of Object.entries(patch)) {
    if (!EDITABLE_KEYS.includes(key)) continue;
    if (isEnvironmentLocked(key)) {
      skipped.push({ key, reason: 'ENV_LOCKED' });
      continue;
    }
    if (value === null || value === '') {
      delete cache[key];
      await db.prepare('DELETE FROM app_settings WHERE name = ?').run(key);
    } else {
      cache[key] = String(value);
      await db.prepare(
        `INSERT INTO app_settings (name, value, updated_at)
         VALUES (@name, @value, @updatedAt)
        ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).run({ name: key, value: cache[key], updatedAt: Date.now() });
    }
    applied.push(key);
  }
  return { applied, skipped };
}

export function maskedSettings() {
  const result = {};
  for (const key of EDITABLE_KEYS) {
    const value = getSetting(key);
    const source = isEnvironmentLocked(key)
      ? 'env'
      : cache[key]
        ? 'database'
        : envValue(key)
          ? 'env'
          : 'unset';
    if (!value) {
      result[key] = { set: false, value: '', source, locked: false };
    } else if (SECRET_PATTERN.test(key)) {
      const masked = value.length <= 8
        ? '****'
        : `${value.slice(0, 4)}****${value.slice(-4)}`;
      result[key] = {
        set: true,
        value: masked,
        source,
        locked: isEnvironmentLocked(key),
      };
    } else {
      result[key] = { set: true, value, source, locked: false };
    }
  }
  return result;
}
