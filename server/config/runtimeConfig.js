/**
 * Runtime config store — 管理后台保存的配置，优先级高于环境变量。
 * 持久化到 server/data/runtime-config.json（已 gitignore）。
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '../data/runtime-config.json');

// 管理后台允许写入的字段白名单
export const EDITABLE_KEYS = [
  'TTAPI_KEY',
  'TTAPI_SUNO_MV',
  'USE_FALLBACK_ONLY',
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

let cache = load();

function load() {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

export function getSetting(key, fallback = '') {
  const value = cache[key] ?? process.env[key];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function updateSettings(patch) {
  const applied = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!EDITABLE_KEYS.includes(key)) continue;
    if (value === null || value === '') {
      delete cache[key];
    } else {
      cache[key] = String(value);
    }
    applied[key] = true;
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(cache, null, 2));
  return Object.keys(applied);
}

export function maskedSettings() {
  const result = {};
  for (const key of EDITABLE_KEYS) {
    const value = getSetting(key);
    if (!value) {
      result[key] = { set: false, value: '' };
    } else if (SECRET_PATTERN.test(key)) {
      result[key] = { set: true, value: `${value.slice(0, 4)}****${value.slice(-4)}` };
    } else {
      result[key] = { set: true, value };
    }
  }
  return result;
}
