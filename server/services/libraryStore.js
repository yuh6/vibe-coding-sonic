/**
 * 预生成音乐库 — 默认曲目来自 fallback-manifest.json，运行时修改写入数据库。
 * + 歌曲总库（shared_library）智能匹配
 */
import { existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID } from 'crypto';
import { dal, db } from '../db.js';

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
const SHARED_LIBRARY_SEED_ENABLED = process.env.SHARED_LIBRARY_SEED_ENABLED !== 'false';

const GENRE_QUERY_ALIASES = {
  pop: ['pop', 'dance pop', 'art pop', '流行'],
  jazz: ['jazz', 'swing', '爵士'],
  rock: ['rock', '摇滚'],
  hiphop: ['hiphop', 'hip-hop', 'hip hop', 'rap', '说唱'],
  classical: ['classical', 'orchestral', '古典'],
  electronic: ['electronic', 'edm', '电子'],
  rnb: ['rnb', 'r&b', 'rhythm and blues', '节奏蓝调'],
  country: ['country', 'americana', '乡村'],
  latin: ['latin', 'reggaeton', '拉丁'],
  metal: ['metal', 'heavy metal', '重金属'],
  indie: ['indie', 'alternative', '独立'],
  funk: ['funk', '放克'],
};

const SHARED_LIBRARY_SEEDS = [
  { id: 'seed-pop-1', title: 'Neon Candy Hook', genre: 'pop, dance pop', tags: 'pop, bright synths, catchy hooks, upbeat', mode: 'brainstorm', mbti: 'ENFP', bpm: 116, url: '/samples/fallback-brainstorm-a.mp3' },
  { id: 'seed-pop-2', title: 'Pink Skyline Chorus', genre: 'pop, art pop', tags: 'pop, polished production, radio ready, bright', mode: 'focus', mbti: 'ESFP', bpm: 104, url: '/samples/fallback-brainstorm-b.mp3' },
  { id: 'seed-pop-3', title: 'Glass Arcade Smile', genre: 'pop, synth pop', tags: 'pop, dance pop, shimmering synths, clean drums', mode: 'sprint', mbti: 'ENFJ', bpm: 122, url: '/samples/fallback-brainstorm-c.mp3' },
  { id: 'seed-jazz-1', title: 'Blue Hour Trio', genre: 'jazz, swing', tags: 'jazz, brushed drums, piano, walking bass', mode: 'focus', mbti: 'INFJ', bpm: 92, url: '/samples/fallback-focus-a.mp3' },
  { id: 'seed-jazz-2', title: 'Copper Night Standard', genre: 'jazz, bebop', tags: 'jazz, saxophone, upright bass, improvisation', mode: 'break', mbti: 'INFP', bpm: 132, url: '/samples/fallback-focus-b.mp3' },
  { id: 'seed-jazz-3', title: 'Soft Smoke Changes', genre: 'jazz, cool jazz', tags: 'jazz, lounge, piano comping, mellow', mode: 'brainstorm', mbti: 'INTP', bpm: 78, url: '/samples/fallback-focus-c.mp3' },
  { id: 'seed-rock-1', title: 'Garage Lights On', genre: 'rock, indie rock', tags: 'rock, electric guitar, punchy drums, chorus', mode: 'sprint', mbti: 'ESTP', bpm: 138, url: '/samples/fallback-sprint-a.mp3' },
  { id: 'seed-rock-2', title: 'Voltage Road', genre: 'rock, alternative rock', tags: 'rock, power chords, driving bass, gritty', mode: 'charge', mbti: 'ENTP', bpm: 128, url: '/samples/fallback-sprint-b.mp3' },
  { id: 'seed-rock-3', title: 'Backline Sunrise', genre: 'rock, arena rock', tags: 'rock, anthemic, live drums, guitar riff', mode: 'brainstorm', mbti: 'ENTJ', bpm: 145, url: '/samples/fallback-sprint-c.mp3' },
  { id: 'seed-hiphop-1', title: 'Corner Store Beat', genre: 'hiphop, hip-hop, rap', tags: 'hiphop, boom bap, sampled drums, deep bass', mode: 'sprint', mbti: 'ENTP', bpm: 92, url: '/samples/fallback-charge-a.mp3' },
  { id: 'seed-hiphop-2', title: 'Late Metro Bounce', genre: 'hiphop, trap', tags: 'hiphop, rap beat, 808, punchy snare', mode: 'focus', mbti: 'ISTP', bpm: 86, url: '/samples/fallback-charge-b.mp3' },
  { id: 'seed-hiphop-3', title: 'Notebook Cadence', genre: 'hiphop, lo-fi rap', tags: 'hiphop, head nodding groove, vinyl, bass', mode: 'behind', mbti: 'INTP', bpm: 98, url: '/samples/fallback-charge-c.mp3' },
  { id: 'seed-classical-1', title: 'Moonlit Conservatory', genre: 'classical, orchestral', tags: 'classical, strings, concert hall, elegant', mode: 'focus', mbti: 'INFJ', bpm: 72, url: '/samples/fallback-behind-a.mp3' },
  { id: 'seed-classical-2', title: 'Ivory Window Study', genre: 'classical, solo piano', tags: 'classical, piano, expressive, intimate', mode: 'break', mbti: 'INTJ', bpm: 64, url: '/samples/fallback-behind-b.mp3' },
  { id: 'seed-classical-3', title: 'Glass String Motif', genre: 'classical, chamber', tags: 'classical, chamber strings, dynamic range', mode: 'charge', mbti: 'ISTJ', bpm: 118, url: '/samples/fallback-startup-horizon-a.mp3' },
  { id: 'seed-electronic-1', title: 'Circuit Floor', genre: 'electronic, edm', tags: 'electronic, synth bass, club drums, arpeggiators', mode: 'sprint', mbti: 'INTJ', bpm: 128, url: '/samples/fallback-break-a.mp3' },
  { id: 'seed-electronic-2', title: 'Laser Corridor', genre: 'electronic, synthwave', tags: 'electronic, neon, analog synth, four on the floor', mode: 'brainstorm', mbti: 'INTP', bpm: 122, url: '/samples/fallback-break-b.mp3' },
  { id: 'seed-electronic-3', title: 'Chrome Pulse', genre: 'electronic, dance', tags: 'electronic, polished mix, dancefloor, bass', mode: 'charge', mbti: 'ENTJ', bpm: 136, url: '/samples/fallback-personality-intj-a.mp3' },
  { id: 'seed-rnb-1', title: 'Velvet Porch Light', genre: 'rnb, r&b', tags: 'rnb, soulful chords, smooth groove, warm bass', mode: 'focus', mbti: 'ISFP', bpm: 82, url: '/samples/fallback-celebrate-a.mp3' },
  { id: 'seed-rnb-2', title: 'Midnight Soft Step', genre: 'rnb, neo soul', tags: 'rnb, late night, soft drums, polished vocals', mode: 'break', mbti: 'INFP', bpm: 74, url: '/samples/fallback-celebrate-b.mp3' },
  { id: 'seed-rnb-3', title: 'Amber Tape Loop', genre: 'rnb, soul', tags: 'rnb, warm keys, relaxed groove, bassline', mode: 'brainstorm', mbti: 'ENFP', bpm: 96, url: '/samples/fallback-personality-intp-a.mp3' },
  { id: 'seed-country-1', title: 'County Line Morning', genre: 'country, americana', tags: 'country, acoustic guitar, organic drums, storytelling', mode: 'focus', mbti: 'ISFJ', bpm: 88, url: '/samples/fallback-personality-entj-a.mp3' },
  { id: 'seed-country-2', title: 'Porch Lantern Waltz', genre: 'country, folk country', tags: 'country, fiddle, warm bass, heartfelt', mode: 'break', mbti: 'ESFJ', bpm: 76, url: '/samples/fallback-personality-entp-a.mp3' },
  { id: 'seed-country-3', title: 'Dust Road Chorus', genre: 'country, modern country', tags: 'country, americana, acoustic, steady groove', mode: 'celebrate', mbti: 'ESTJ', bpm: 108, url: '/samples/fallback-personality-enfj-a.mp3' },
  { id: 'seed-latin-1', title: 'Calle Neon', genre: 'latin, reggaeton', tags: 'latin, dembow rhythm, percussion, festive groove', mode: 'brainstorm', mbti: 'ESFP', bpm: 98, url: '/samples/fallback-personality-enfp-a.mp3' },
  { id: 'seed-latin-2', title: 'Brass After Sunset', genre: 'latin, salsa pop', tags: 'latin, brass stabs, danceable hook, percussion', mode: 'sprint', mbti: 'ENFP', bpm: 104, url: '/samples/fallback-personality-infj-a.mp3' },
  { id: 'seed-latin-3', title: 'Festival Side Street', genre: 'latin, latin pop', tags: 'latin, bright percussion, dance, warm bass', mode: 'celebrate', mbti: 'ENFJ', bpm: 110, url: '/samples/fallback-personality-infp-a.mp3' },
  { id: 'seed-metal-1', title: 'Iron Gate Engine', genre: 'metal, heavy metal', tags: 'metal, heavy guitar riffs, double kick, intense', mode: 'charge', mbti: 'ENTJ', bpm: 148, url: '/samples/fallback-personality-istj-a.mp3' },
  { id: 'seed-metal-2', title: 'Black Anvil Drive', genre: 'metal, power metal', tags: 'metal, distorted guitars, aggressive bass, drums', mode: 'sprint', mbti: 'ESTJ', bpm: 160, url: '/samples/fallback-personality-isfj-a.mp3' },
  { id: 'seed-metal-3', title: 'Riff Alarm', genre: 'metal, alt metal', tags: 'metal, power chords, high energy, dark', mode: 'behind', mbti: 'ISTP', bpm: 136, url: '/samples/fallback-personality-estj-a.mp3' },
  { id: 'seed-indie-1', title: 'Bedroom Telescope', genre: 'indie, indie pop', tags: 'indie, jangly guitars, warm synths, intimate drums', mode: 'brainstorm', mbti: 'INFP', bpm: 104, url: '/samples/fallback-personality-esfj-a.mp3' },
  { id: 'seed-indie-2', title: 'Paper Moon Band', genre: 'indie, alternative', tags: 'indie, dreamy texture, alternative pop, heartfelt', mode: 'focus', mbti: 'ISFP', bpm: 112, url: '/samples/fallback-personality-istp-a.mp3' },
  { id: 'seed-indie-3', title: 'Window Seat Static', genre: 'indie, dream pop', tags: 'indie, lo-fi, guitars, soft drums', mode: 'break', mbti: 'INFJ', bpm: 96, url: '/samples/fallback-personality-isfp-a.mp3' },
  { id: 'seed-funk-1', title: 'Pocket Generator', genre: 'funk, disco funk', tags: 'funk, slap bass, syncopated guitar, tight drums', mode: 'brainstorm', mbti: 'ESTP', bpm: 112, url: '/samples/fallback-personality-estp-a.mp3' },
  { id: 'seed-funk-2', title: 'Chrome Clavinet', genre: 'funk, electro funk', tags: 'funk, clavinet, brass stabs, danceable pocket', mode: 'sprint', mbti: 'ENTP', bpm: 118, url: '/samples/fallback-personality-esfp-a.mp3' },
  { id: 'seed-funk-3', title: 'Basement Handclap', genre: 'funk, groove', tags: 'funk, bassline, rhythm guitar, upbeat groove', mode: 'celebrate', mbti: 'ESFP', bpm: 106, url: '/samples/fallback-brainstorm-a.mp3' },
];

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

async function seedSharedLibraryIfNeeded() {
  if (!SHARED_LIBRARY_SEED_ENABLED) return;

  let inserted = 0;
  const baseCreatedAt = Date.now() - SHARED_LIBRARY_SEEDS.length * 1000;
  for (const [index, track] of SHARED_LIBRARY_SEEDS.entries()) {
    const result = await dal.run(
      `INSERT INTO shared_library
       (id, title, mbti, mode, genre, tags, mood, bpm, audio_url, audio_local, duration_sec, play_count, quality_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO NOTHING`,
      [
        track.id,
        track.title,
        track.mbti,
        track.mode,
        track.genre,
        track.tags,
        'discover seed',
        track.bpm,
        track.url,
        track.url,
        90,
        0,
        0.75,
        baseCreatedAt + index * 1000,
      ]
    );
    inserted += Number(result?.changes || 0);
  }

  if (inserted) {
    console.log(`[library] Seeded ${inserted} shared library tracks`);
  }
}

async function load() {
  await seedFallbackTracksIfNeeded();
  await seedSharedLibraryIfNeeded();
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
  if (genre) {
    const aliases = genreQueryAliases(genre);
    conditions.push(`(${aliases.map(() => '(genre LIKE ? OR tags LIKE ?)').join(' OR ')})`);
    for (const alias of aliases) {
      params.push(`%${alias}%`, `%${alias}%`);
    }
  }
  if (q) { conditions.push('(tags LIKE ? OR title LIKE ? OR genre LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (Math.max(1, page) - 1) * limit;

  const total = Number((await db.prepare(`SELECT COUNT(*) as cnt FROM shared_library ${where}`).get(...params))?.cnt || 0);
  const rows = await db.prepare(
    `SELECT * FROM shared_library ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { total, page, limit, tracks: rows.map(formatSharedTrack) };
}

function genreQueryAliases(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return [''];
  const aliases = GENRE_QUERY_ALIASES[normalized] || [normalized];
  return [...new Set([normalized, ...aliases].filter(Boolean))];
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
