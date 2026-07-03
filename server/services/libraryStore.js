/**
 * 预生成音乐库 — 默认曲目来自 fallback-manifest.json，运行时修改写入 gitignored 文件。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_MANIFEST_PATH = join(__dirname, '../data/fallback-manifest.json');
const LIBRARY_PATH = join(__dirname, '../data/runtime-library.json');

const MODES = ['focus', 'spark', 'sprint', 'charge'];

let manifest = load();

function emptyManifest() {
  return { focus: [], spark: [], sprint: [], charge: [] };
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
