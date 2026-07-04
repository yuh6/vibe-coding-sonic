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

let manifest = await load();

function emptyManifest() {
  return { brainstorm: [], focus: [], sprint: [], charge: [], behind: [], break: [], celebrate: [] };
}

function normalizeManifest(raw) {
  const next = emptyManifest();
  for (const mode of MODES) {
    next[mode] = Array.isArray(raw?.[mode]) ? raw[mode] : [];
  }
  return next;
}

function loadManifestFile() {
  const path = existsSync(LIBRARY_PATH) ? LIBRARY_PATH : DEFAULT_MANIFEST_PATH;
  try {
    return normalizeManifest(JSON.parse(readFileSync(path, 'utf-8')));
  } catch {
    return emptyManifest();
  }
}

function rowsToManifest(rows) {
  const next = emptyManifest();
  for (const row of rows) {
    if (!MODES.includes(row.mode)) continue;
    next[row.mode].push({ id: row.id, title: row.title, url: row.url });
  }
  return next;
}

async function seedFallbackTracksIfEmpty() {
  const row = await db.prepare('SELECT COUNT(*) as cnt FROM fallback_tracks').get();
  if (Number(row?.cnt || 0) > 0) return;

  const seed = loadManifestFile();
  const now = Date.now();
  for (const [mode, tracks] of Object.entries(seed)) {
    for (const track of tracks) {
      if (!track?.id || !track?.url) continue;
      await db.prepare(
        `INSERT INTO fallback_tracks (id, mode, title, url, created_at)
         VALUES (@id, @mode, @title, @url, @createdAt)
         ON CONFLICT(id) DO NOTHING`
      ).run({
        id: String(track.id),
        mode,
        title: String(track.title || track.url).slice(0, 120),
        url: String(track.url),
        createdAt: now,
      });
    }
  }
}

async function load() {
  await seedFallbackTracksIfEmpty();
  const rows = await db.prepare(
    'SELECT id, mode, title, url FROM fallback_tracks ORDER BY mode, created_at, id'
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

export async function addTrack({ mode, title, url }) {
  const key = String(mode || '').toLowerCase();
  if (!MODES.includes(key)) {
    throw new Error(`Invalid mode: ${mode}`);
  }
  const safeUrl = validateTrackUrl(url);
  const safeTitle = String(title || safeUrl).trim().slice(0, 120);
  const track = { id: `${key}-${randomUUID().slice(0, 8)}`, title: safeTitle, url: safeUrl };
  await db.prepare(
    `INSERT INTO fallback_tracks (id, mode, title, url, created_at)
     VALUES (@id, @mode, @title, @url, @createdAt)`
  ).run({ ...track, mode: key, createdAt: Date.now() });
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
  const tracks = getTracks(mode);
  if (!tracks.length) return null;
  const index = mbti ? mbti.charCodeAt(0) % tracks.length : 0;
  return tracks[index];
}

export async function libraryHasTrackUrl(url) {
  return Object.values(manifest).some((tracks) => tracks.some((track) => track?.url === url));
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
