/**
 * 预生成音乐库 — 默认曲目来自 fallback-manifest.json，运行时修改写入数据库。
 * + 歌曲总库（shared_library）智能匹配
 */
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST_PATH = join(__dirname, '../data/fallback-manifest.json');
const LIBRARY_PATH = join(__dirname, '../data/runtime-library.json');

// 七阶段体系（v3 替换原 focus/spark/sprint/charge 四模式）
const MODES = ['brainstorm', 'focus', 'sprint', 'charge', 'behind', 'break', 'celebrate'];
const PERSONALITY_BUCKET = 'personality';
const STARTUP_BUCKET = 'startup';
const MANIFEST_BUCKETS = [...MODES, PERSONALITY_BUCKET, STARTUP_BUCKET];
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];
const MBTI_SEED_FLAG = 'fallback_mbti_seed_v1';
const STARTUP_SEED_FLAG = 'fallback_startup_seed_v1';

let manifest = await load();

function emptyManifest() {
  return Object.fromEntries(MANIFEST_BUCKETS.map((mode) => [mode, []]));
}

function normalizeMbti(value) {
  const type = String(value || '').trim().toUpperCase();
  return MBTI_TYPES.includes(type) ? type : null;
}

function normalizeTrack(track) {
  const next = {
    id: String(track.id || '').trim(),
    title: String(track.title || track.url || '').trim(),
    url: String(track.url || '').trim(),
  };
  const mbti = normalizeMbti(track.mbti);
  if (mbti) next.mbti = mbti;
  return next;
}

function normalizeManifest(raw) {
  const next = emptyManifest();
  for (const mode of MANIFEST_BUCKETS) {
    next[mode] = Array.isArray(raw?.[mode])
      ? raw[mode].map(normalizeTrack).filter((track) => track.id && track.url)
      : [];
  }
  return next;
}

function loadManifestFile() {
  let defaults = emptyManifest();
  try {
    defaults = normalizeManifest(JSON.parse(readFileSync(DEFAULT_MANIFEST_PATH, 'utf-8')));
  } catch {
    // Fall back to an empty manifest below.
  }

  if (!existsSync(LIBRARY_PATH)) return defaults;

  try {
    const runtime = normalizeManifest(JSON.parse(readFileSync(LIBRARY_PATH, 'utf-8')));
    if (!runtime[PERSONALITY_BUCKET]?.length) runtime[PERSONALITY_BUCKET] = defaults[PERSONALITY_BUCKET];
    if (!runtime[STARTUP_BUCKET]?.length) runtime[STARTUP_BUCKET] = defaults[STARTUP_BUCKET];
    return runtime;
  } catch {
    return defaults;
  }
}

function rowsToManifest(rows) {
  const next = emptyManifest();
  for (const row of rows) {
    if (!MANIFEST_BUCKETS.includes(row.mode)) continue;
    const track = { id: row.id, title: row.title, url: row.url };
    const mbti = normalizeMbti(row.mbti);
    if (mbti) track.mbti = mbti;
    next[row.mode].push(track);
  }
  return next;
}

async function insertSeedTracks(seed, { onlyMbti = false, onlyMode = null } = {}) {
  const now = Date.now();
  for (const [mode, tracks] of Object.entries(seed)) {
    if (!MANIFEST_BUCKETS.includes(mode)) continue;
    if (onlyMode && mode !== onlyMode) continue;
    for (const track of tracks) {
      if (!track?.id || !track?.url) continue;
      const mbti = normalizeMbti(track.mbti);
      if (onlyMbti && !mbti) continue;
      if (mode === PERSONALITY_BUCKET && !mbti) continue;
      await db.prepare(
        `INSERT INTO fallback_tracks (id, mode, mbti, title, url, created_at)
         VALUES (@id, @mode, @mbti, @title, @url, @createdAt)
         ON CONFLICT(id) DO NOTHING`
      ).run({
        id: String(track.id),
        mode,
        mbti,
        title: String(track.title || track.url).slice(0, 120),
        url: String(track.url),
        createdAt: now,
      });
    }
  }
}

async function markMbtiSeeded() {
  await db.prepare(
    `INSERT INTO app_settings (name, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(MBTI_SEED_FLAG, 'true', Date.now());
}

async function markStartupSeeded() {
  await db.prepare(
    `INSERT INTO app_settings (name, value, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(STARTUP_SEED_FLAG, 'true', Date.now());
}

async function seedFallbackTracksIfNeeded() {
  const seed = loadManifestFile();
  const row = await db.prepare('SELECT COUNT(*) as cnt FROM fallback_tracks').get();
  if (Number(row?.cnt || 0) === 0) {
    await insertSeedTracks(seed);
    await markMbtiSeeded();
    await markStartupSeeded();
    return;
  }

  const mbtiSeeded = await db.prepare('SELECT value FROM app_settings WHERE name = ?').get(MBTI_SEED_FLAG);
  if (!mbtiSeeded) {
    await insertSeedTracks(seed, { onlyMbti: true });
    await markMbtiSeeded();
  }

  const startupSeeded = await db.prepare('SELECT value FROM app_settings WHERE name = ?').get(STARTUP_SEED_FLAG);
  if (!startupSeeded) {
    await insertSeedTracks(seed, { onlyMode: STARTUP_BUCKET });
    await markStartupSeeded();
  }
}

async function load() {
  await seedFallbackTracksIfNeeded();
  const rows = await db.prepare(
    'SELECT id, mode, mbti, title, url FROM fallback_tracks ORDER BY mode, mbti, created_at, id'
  ).all();
  return rowsToManifest(rows);
}

function validateTrackUrl(value) {
  const url = String(value || '').trim();
  if (!url) {
    throw new Error('url is required');
  }

  if (url.startsWith('/samples/')) return url;

  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
  } catch {
    // handled below
  }

  throw new Error('url must be an http(s) URL or /samples/... path');
}

export function getLibrary() {
  return structuredClone(manifest);
}

export function getTracks(mode) {
  const key = String(mode || 'focus').toLowerCase();
  return manifest[key] || manifest.focus || [];
}

export async function addTrack({ mode, title, url, mbti }) {
  const key = String(mode || '').toLowerCase();
  if (!MANIFEST_BUCKETS.includes(key)) {
    throw new Error(`Invalid mode: ${mode}`);
  }
  const safeUrl = validateTrackUrl(url);
  const safeTitle = String(title || safeUrl).trim().slice(0, 120);
  const safeMbti = normalizeMbti(mbti);
  if (mbti && !safeMbti) {
    throw new Error(`Invalid MBTI type: ${mbti}`);
  }
  if (key === PERSONALITY_BUCKET && !safeMbti) {
    throw new Error('MBTI type is required for personality fallback tracks');
  }
  const track = { id: `${key}-${randomUUID().slice(0, 8)}`, title: safeTitle, url: safeUrl };
  if (safeMbti) track.mbti = safeMbti;
  await db.prepare(
    `INSERT INTO fallback_tracks (id, mode, mbti, title, url, created_at)
     VALUES (@id, @mode, @mbti, @title, @url, @createdAt)`
  ).run({ ...track, mode: key, mbti: safeMbti, createdAt: Date.now() });
  manifest[key] = [...(manifest[key] || []), track];
  return track;
}

export async function removeTrack(mode, id) {
  const key = String(mode || '').toLowerCase();
  const tracks = manifest[key] || [];
  const removed = await db.prepare('DELETE FROM fallback_tracks WHERE mode = ? AND id = ?').run(key, id);
  if (removed.changes === 0) return false;
  const next = tracks.filter((t) => t.id !== id);
  manifest[key] = next;
  return true;
}

export async function pickTrack(mode, mbti) {
  const key = String(mode || 'focus').toLowerCase();
  const type = normalizeMbti(mbti);
  const phaseTracks = getTracks(key);
  const exactPhaseTracks = type ? phaseTracks.filter((track) => normalizeMbti(track.mbti) === type) : [];
  const personalityTracks = type ? getTracks(PERSONALITY_BUCKET).filter((track) => normalizeMbti(track.mbti) === type) : [];
  const genericPhaseTracks = phaseTracks.filter((track) => !track.mbti);
  const fallbackTracks = getTracks('focus').filter((track) => !track.mbti);
  if (key === STARTUP_BUCKET) {
    const startupCandidates = genericPhaseTracks.length ? genericPhaseTracks : fallbackTracks;
    if (!startupCandidates.length) return null;
    const index = hashPick(`${type || 'generic'}:${key}`, startupCandidates.length);
    return startupCandidates[index];
  }
  const candidates = exactPhaseTracks.length
    ? exactPhaseTracks
    : personalityTracks.length
      ? personalityTracks
      : genericPhaseTracks.length
        ? genericPhaseTracks
        : fallbackTracks;
  if (!candidates.length) return null;
  const index = hashPick(`${type || 'generic'}:${key}`, candidates.length);
  return candidates[index];
}

export async function libraryHasTrackUrl(url) {
  return Object.values(manifest).some((tracks) => tracks.some((track) => track?.url === url));
}

function hashPick(seed, modulo) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return modulo ? hash % modulo : 0;
}

// ═══════════════════════════════════════════════════════════════
//  歌曲总库（shared_library 表）— 智能匹配 + 分页查询
// ═══════════════════════════════════════════════════════════════

export async function pickFromSharedLibrary({ mode, mbti, genre, bpm }) {
  const baseWhere = "audio_local IS NOT NULL AND audio_local != ''";

  let candidates = await db.prepare(
    `SELECT * FROM shared_library WHERE mode = ? AND genre LIKE ? AND ${baseWhere}
     ORDER BY play_count ASC, created_at DESC LIMIT 20`
  ).all(mode, `%${(genre || '').split(',')[0]?.trim() || ''}%`);

  if (!candidates.length && mbti) {
    candidates = await db.prepare(
      `SELECT * FROM shared_library WHERE mode = ? AND mbti = ? AND ${baseWhere}
       ORDER BY play_count ASC, created_at DESC LIMIT 20`
    ).all(mode, mbti);
  }

  if (!candidates.length) {
    candidates = await db.prepare(
      `SELECT * FROM shared_library WHERE mode = ? AND ${baseWhere}
       ORDER BY play_count ASC, created_at DESC LIMIT 20`
    ).all(mode);
  }

  if (!candidates.length) {
    candidates = await db.prepare(
      `SELECT * FROM shared_library WHERE ${baseWhere}
       ORDER BY play_count ASC, created_at DESC LIMIT 10`
    ).all();
  }

  if (!candidates.length) return null;

  const targetBpm = bpm || 100;
  const scored = candidates.map((row) => {
    const bpmDist = row.bpm ? Math.abs(row.bpm - targetBpm) / 100 : 0.5;
    const freshness = 1 / (1 + (row.play_count || 0));
    return { row, score: freshness * 0.6 + (1 - bpmDist) * 0.4 };
  });
  scored.sort((a, b) => b.score - a.score);

  const picked = scored[0].row;
  await db.prepare('UPDATE shared_library SET play_count = play_count + 1 WHERE id = ?').run(picked.id);

  return {
    id: picked.id, title: picked.title, url: picked.audio_local,
    mbti: picked.mbti, mode: picked.mode, genre: picked.genre, bpm: picked.bpm,
  };
}

export async function listSharedLibrary({ mode, mbti, genre, q, page = 1, limit = 20 }) {
  const conditions = [];
  const params = [];

  if (mode) { conditions.push('mode = ?'); params.push(mode); }
  if (mbti) { conditions.push('mbti = ?'); params.push(mbti); }
  if (genre) { conditions.push('genre LIKE ?'); params.push(`%${genre}%`); }
  if (q) { conditions.push('(tags LIKE ? OR title LIKE ? OR genre LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  const total = Number((await db.prepare(`SELECT COUNT(*) as cnt FROM shared_library ${where}`).get(...params))?.cnt || 0);
  const rows = await db.prepare(
    `SELECT * FROM shared_library ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { total, page, limit, tracks: rows.map(formatSharedTrack) };
}

export async function getSharedLibraryStats() {
  const total = Number((await db.prepare('SELECT COUNT(*) as cnt FROM shared_library').get())?.cnt || 0);
  const cached = Number((await db.prepare("SELECT COUNT(*) as cnt FROM shared_library WHERE audio_local IS NOT NULL AND audio_local != ''").get())?.cnt || 0);
  const modes = await db.prepare('SELECT mode, COUNT(*) as cnt FROM shared_library GROUP BY mode').all();
  return { total, cached, byMode: Object.fromEntries(modes.map((r) => [r.mode, Number(r.cnt || 0)])) };
}

function formatSharedTrack(row) {
  return {
    id: row.id, title: row.title, mbti: row.mbti, mode: row.mode,
    genre: row.genre, tags: row.tags, bpm: row.bpm,
    audioUrl: row.audio_local || row.audio_url,
    playCount: row.play_count || 0, createdAt: row.created_at,
  };
}
