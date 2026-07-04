import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resolveLlmRuntime } from '../../config/providers.js';
import { callHttpLlm } from './httpProviders.js';
import { callCliLlm } from './cliProvider.js';
import { db } from '../../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templates = JSON.parse(readFileSync(join(__dirname, '../../data/project-templates.json'), 'utf-8'));

// ── project_cache 操作 ──
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function cacheKey(name, description) {
  return createHash('sha256').update(`${name}||${description}`).digest('hex');
}

function getCachedAnalysis(key) {
  const row = db.prepare('SELECT analysis_json, analyzed_at FROM project_cache WHERE folder_path = ?').get(key);
  if (!row) return null;
  const age = Date.now() - new Date(row.analyzed_at).getTime();
  if (age > CACHE_TTL_MS) {
    db.prepare('DELETE FROM project_cache WHERE folder_path = ?').run(key);
    return null;
  }
  try { return JSON.parse(row.analysis_json); } catch { return null; }
}

function setCachedAnalysis(key, analysis) {
  db.prepare(
    `INSERT OR REPLACE INTO project_cache (folder_path, analysis_json, analyzed_at) VALUES (?, ?, ?)`
  ).run(key, JSON.stringify(analysis), new Date().toISOString());
}

const ANALYSIS_PROMPT = `Analyze this hackathon project and return ONLY valid JSON (no markdown):
{
  "themes": ["english theme keywords, 2-4 items"],
  "mood": ["english mood keywords, 2-4 items"],
  "instruments": ["english instrument keywords, 2-4 items"],
  "avoid": ["vocals", "..."]
}

Project name: {name}
Description: {description}`;

function matchTemplate(text) {
  const lower = text.toLowerCase();
  let best = templates.find((t) => t.id === 'default');
  let bestScore = 0;

  for (const template of templates) {
    if (template.id === 'default') continue;
    const score = template.keywords.reduce((acc, kw) => {
      return lower.includes(kw.toLowerCase()) ? acc + 1 : acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  return { ...best, source: bestScore > 0 ? 'template' : 'default' };
}

function parseJsonFromLlm(content) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid LLM response: no JSON found');
  return JSON.parse(jsonMatch[0]);
}

export async function callLlm(prompt) {
  const config = resolveLlmRuntime();
  if (!config) {
    throw new Error('LLM not configured');
  }

  if (config.type === 'cli') {
    return callCliLlm(config, prompt);
  }

  return callHttpLlm(config, prompt);
}

export function isLlmConfigured() {
  return Boolean(resolveLlmRuntime());
}

export async function analyzeProject({ name = '', description = '' }) {
  const combined = `${name} ${description}`.trim();
  if (!combined) {
    const fallback = templates.find((t) => t.id === 'default');
    return { ...fallback, source: 'default' };
  }

  // §3.3 缓存检查（SHA-256 key, 24h TTL）
  const key = cacheKey(name, description);
  const cached = getCachedAnalysis(key);
  if (cached) {
    return { ...cached, source: 'cache' };
  }

  const config = resolveLlmRuntime();
  if (!config) {
    return matchTemplate(combined);
  }

  try {
    const prompt = ANALYSIS_PROMPT.replace('{name}', name).replace('{description}', description);
    const content = await callLlm(prompt);
    const parsed = parseJsonFromLlm(content);

    const result = {
      themes: parsed.themes || [],
      mood: parsed.mood || [],
      instruments: parsed.instruments || [],
      avoid: parsed.avoid || ['vocals'],
      source: config.type === 'cli' ? `cli:${config.providerId}` : config.providerId,
    };

    // 写入缓存
    setCachedAnalysis(key, result);
    return result;
  } catch (err) {
    console.warn(`[llm:${config.providerId}] fallback to template:`, err.message);
    return matchTemplate(combined);
  }
}

// ── §6 备注解析 ──

const NOTES_PROMPT = `Parse user notes into JSON. Extract keywords, mood, and things to avoid.
Return ONLY valid JSON (no markdown):
{
  "keywords": ["english keywords, max 5"],
  "mood": ["english mood descriptors, max 3"],
  "avoid": ["things to exclude, max 3"]
}

User notes: {text}`;

function parseNotesSimple(text) {
  const lower = text.toLowerCase();
  const keywords = [];
  const mood = [];
  const avoid = [];

  // 中文否定模式
  const avoidPatterns = lower.match(/不要(.+?)(?:[,，;；\s]|$)/g);
  if (avoidPatterns) {
    avoidPatterns.forEach((m) => {
      const word = m.replace(/^不要/, '').trim();
      if (word) avoid.push(word);
    });
  }

  // 英文否定
  const noPatterns = lower.match(/\bno\s+(\w+)/g);
  if (noPatterns) {
    noPatterns.forEach((m) => avoid.push(m.replace(/^no\s+/, '')));
  }

  // 情绪词
  const moodWords = ['happy', 'sad', 'energetic', 'calm', 'dark', 'bright', 'epic', 'chill',
    '开心', '悲伤', '激动', '平静', '暗', '亮', '史诗', '放松', 'futuristic', 'nostalgic'];
  moodWords.forEach((w) => { if (lower.includes(w)) mood.push(w); });

  // 剩余词作为关键词
  const words = text.replace(/[,，;；!！?？。.]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
  words.forEach((w) => {
    if (!avoid.includes(w.toLowerCase()) && !mood.includes(w.toLowerCase()) && keywords.length < 5) {
      keywords.push(w);
    }
  });

  return { keywords: keywords.slice(0, 5), mood: mood.slice(0, 3), avoid: avoid.slice(0, 3) };
}

export async function parseNotes(text) {
  if (!text || !text.trim()) return { keywords: [], mood: [], avoid: [] };

  const config = resolveLlmRuntime();
  if (!config) {
    return parseNotesSimple(text);
  }

  try {
    const prompt = NOTES_PROMPT.replace('{text}', text);
    const content = await callLlm(prompt);
    const parsed = parseJsonFromLlm(content);
    return {
      keywords: (parsed.keywords || []).slice(0, 5),
      mood: (parsed.mood || []).slice(0, 3),
      avoid: (parsed.avoid || []).slice(0, 3),
    };
  } catch {
    return parseNotesSimple(text);
  }
}
