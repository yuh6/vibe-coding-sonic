/**
 * 预生成音乐库 — 默认曲目来自 fallback-manifest.json，运行时修改写入 gitignored 文件。
 * + 歌曲总库（shared_library）智能匹配
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { db } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST_PATH = join(__dirname, '../data/fallback-manifest.json');
const LIBRARY_PATH = join(__dirname, '../data/runtime-library.json');

// 七阶段体系（v3 替换原 focus/spark/sprint/charge 四模式）
const MODES = ['brainstorm', 'focus', 'sprint', 'charge', 'behind', 'break', 'celebrate'];

let manifest = load();

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

function load() {
  const path = existsSync(LIBRARY_PATH) ? LIBRARY_PATH : DEFAULT_MANIFEST_PATH;
  try {
    return normalizeManifest(JSON.parse(readFileSync(path, 'utf-8')));
  } catch {
    return emptyManifest();
  }
}

function persist() {
  mkdirSync(dirname(LIBRARY_PATH), { recursive: true });
  const tmpPath = `${LIBRARY_PATH}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(manifest, null, 2));
  renameSync(tmpPath, LIBRARY_PATH);
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

export function addTrack({ mode, title, url }) {
  const key = String(mode || '').toLowerCase();
  if (!MODES.includes(key)) {
    throw new Error(`Invalid mode: ${mode}`);
  }
  const safeUrl = validateTrackUrl(url);
  const safeTitle = String(title || safeUrl).trim().slice(0, 120);
  const track = { id: `${key}-${randomUUID().slice(0, 8)}`, title: safeTitle, url: safeUrl };
  manifest[key] = [...(manifest[key] || []), track];
  persist();
  return track;
}

export function removeTrack(mode, id) {
  const key = String(mode || '').toLowerCase();
  const tracks = manifest[key] || [];
  const next = tracks.filter((t) => t.id !== id);
  if (next.length === tracks.length) return false;
  manifest[key] = next;
  persist();
  return true;
}

export function pickTrack(mode, mbti) {
  const tracks = getTracks(mode);
  if (!tracks.length) return null;
  const index = mbti ? mbti.charCodeAt(0) % tracks.length : 0;
  return tracks[index];
}

export function libraryHasTrackUrl(url) {
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
