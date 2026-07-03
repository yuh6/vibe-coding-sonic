/**
 * 预生成音乐库 — 兜底曲目的读写，持久化到 fallback-manifest.json。
 */
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, '../data/fallback-manifest.json');

const MODES = ['focus', 'spark', 'sprint', 'charge'];

let manifest = load();

function load() {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return { focus: [], spark: [], sprint: [], charge: [] };
  }
}

function persist() {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function getLibrary() {
  return manifest;
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
  if (!url) {
    throw new Error('url is required');
  }
  const track = { id: `${key}-${randomUUID().slice(0, 8)}`, title: title || url, url };
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
