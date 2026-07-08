/**
 * Unified song catalog.
 *
 * New generated songs are written here first. During the transition it also
 * mirrors legacy `shared_library` and `fallback_tracks` rows so existing admin
 * and playlist flows can continue to use their current tables.
 */
import { db } from '../db.js';
import { pickTrack } from './libraryStore.js';

function normalizeDurationSec(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function normalizeEnergyScore(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function playbackUrl(row) {
  return row?.audio_local || row?.audio_url || row?.url || null;
}

function mapCatalogRow(row) {
  if (!row) return null;
  const url = playbackUrl(row);
  return {
    id: row.id,
    source: row.source,
    title: row.title,
    url,
    audioUrl: row.audio_url || url,
    audioLocal: row.audio_local || null,
    musicId: row.music_id || null,
    duration: row.duration_sec || null,
    durationSec: row.duration_sec || null,
    prompt: row.prompt || null,
    mbti: row.mbti || null,
    mode: row.mode || null,
    genre: row.genre || null,
    bpm: row.bpm || null,
    energyScore: row.energy_score || null,
    stems: safeJsonParse(row.stems_json, []),
    userId: row.user_id || null,
    playCount: row.play_count || 0,
    tags: safeJsonParse(row.tags, null),
    createdAt: row.created_at || null,
  };
}

function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function firstGenre(value) {
  return String(value || '').split(',')[0]?.trim();
}

async function seedFromSharedLibrary() {
  const rows = await db.prepare(
    `SELECT * FROM shared_library
     WHERE (audio_local IS NOT NULL AND audio_local != '') OR (audio_url IS NOT NULL AND audio_url != '')`
  ).all();
  for (const row of rows) {
    await upsertCatalog({
      id: row.id,
      source: 'generated',
      audioUrl: row.audio_url,
      audioLocal: row.audio_local,
      title: row.title,
      duration: row.duration_sec,
      prompt: row.tags,
      mbti: row.mbti,
      mode: row.mode,
      genre: row.genre,
      bpm: row.bpm,
      userId: row.user_id,
      tags: row.tags ? String(row.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : null,
      createdAt: row.created_at,
    });
  }
}

async function seedFromFallbackTracks() {
  const rows = await db.prepare(`SELECT * FROM fallback_tracks WHERE url IS NOT NULL AND url != ''`).all();
  for (const row of rows) {
    await upsertCatalog({
      id: row.id,
      source: 'seed',
      audioUrl: row.url,
      audioLocal: row.url,
      title: row.title,
      mbti: row.mbti,
      mode: row.mode,
      createdAt: row.created_at,
    });
  }
}

export async function ensureCatalogSeeded() {
  const row = await db.prepare(`SELECT COUNT(*) AS n FROM song_catalog`).get();
  if (Number(row?.n || 0) > 0) return;
  await seedFromSharedLibrary();
  await seedFromFallbackTracks();
}

export async function upsertCatalog(entry) {
  const id = entry.id || entry.jobId;
  const audioUrl = entry.audioUrl || entry.url || entry.audioLocal;
  if (!id || !audioUrl) return null;
  const now = Date.now();
  await db.prepare(
    `INSERT INTO song_catalog
     (id, source, audio_url, audio_local, music_id, title, duration_sec, prompt,
      mbti, mode, genre, bpm, energy_score, user_id, tags, created_at)
     VALUES (@id, @source, @audioUrl, @audioLocal, @musicId, @title, @durationSec, @prompt,
      @mbti, @mode, @genre, @bpm, @energyScore, @userId, @tags, @createdAt)
     ON CONFLICT(id) DO UPDATE SET
       source = excluded.source,
       audio_url = excluded.audio_url,
       audio_local = COALESCE(excluded.audio_local, song_catalog.audio_local),
       music_id = COALESCE(excluded.music_id, song_catalog.music_id),
       title = COALESCE(excluded.title, song_catalog.title),
       duration_sec = COALESCE(excluded.duration_sec, song_catalog.duration_sec),
       prompt = COALESCE(excluded.prompt, song_catalog.prompt),
       mbti = COALESCE(excluded.mbti, song_catalog.mbti),
       mode = COALESCE(excluded.mode, song_catalog.mode),
       genre = COALESCE(excluded.genre, song_catalog.genre),
       bpm = COALESCE(excluded.bpm, song_catalog.bpm),
       energy_score = COALESCE(excluded.energy_score, song_catalog.energy_score),
       user_id = COALESCE(excluded.user_id, song_catalog.user_id),
       tags = COALESCE(excluded.tags, song_catalog.tags)`
  ).run({
    id,
    source: entry.source || 'generated',
    audioUrl,
    audioLocal: entry.audioLocal || null,
    musicId: entry.musicId || null,
    title: entry.title || null,
    durationSec: normalizeDurationSec(entry.duration ?? entry.durationSec),
    prompt: entry.prompt || null,
    mbti: entry.mbti || null,
    mode: entry.mode || null,
    genre: entry.genre || null,
    bpm: Number.isFinite(Number(entry.bpm)) ? Number(entry.bpm) : null,
    energyScore: normalizeEnergyScore(entry.energyScore ?? entry.energy),
    userId: entry.userId || null,
    tags: Array.isArray(entry.tags) ? JSON.stringify(entry.tags) : entry.tags || null,
    createdAt: entry.createdAt || now,
  });
  return getCatalogTrack(id);
}

export async function getCatalogTrack(id) {
  return mapCatalogRow(await db.prepare(`SELECT * FROM song_catalog WHERE id = ?`).get(id));
}

export async function updateCatalogAudioLocal(id, audioLocal) {
  if (!id || !audioLocal) return null;
  await db.prepare(`UPDATE song_catalog SET audio_local = ? WHERE id = ?`).run(audioLocal, id);
  return getCatalogTrack(id);
}

export async function updateCatalogStems(id, stems) {
  if (!id) return null;
  await db.prepare(`UPDATE song_catalog SET stems_json = ? WHERE id = ?`).run(JSON.stringify(stems || []), id);
  return getCatalogTrack(id);
}

export async function recordPlay(songId) {
  if (!songId) return;
  await db.prepare(`UPDATE song_catalog SET play_count = play_count + 1 WHERE id = ?`).run(songId);
}

export async function pickFromCatalog({
  mode,
  mbti,
  genre,
  bpm,
  energyMin,
  energyMax,
  excludeJobIds = [],
  includeSeeds = false,
} = {}) {
  await ensureCatalogSeeded();
  const playable = "((audio_local IS NOT NULL AND audio_local != '') OR (audio_url IS NOT NULL AND audio_url != ''))";
  const sourceClause = includeSeeds
    ? "source IN ('generated', 'fallback', 'seed')"
    : "source = 'generated'";

  const buildQuery = ({ withGenre = false, withMbti = false, withMode = true } = {}) => {
    const conditions = [sourceClause, playable];
    const params = [];
    if (withMode && mode) {
      conditions.push('mode = ?');
      params.push(mode);
    }
    if (withMbti && mbti) {
      conditions.push('mbti = ?');
      params.push(mbti);
    }
    if (withGenre && genre) {
      conditions.push('(genre LIKE ? OR tags LIKE ?)');
      const needle = `%${firstGenre(genre)}%`;
      params.push(needle, needle);
    }
    if (energyMin != null) {
      conditions.push('energy_score >= ?');
      params.push(energyMin);
    }
    if (energyMax != null) {
      conditions.push('energy_score <= ?');
      params.push(energyMax);
    }
    if (excludeJobIds.length) {
      conditions.push(`id NOT IN (${excludeJobIds.map(() => '?').join(',')})`);
      params.push(...excludeJobIds);
    }
    return {
      sql: `SELECT * FROM song_catalog WHERE ${conditions.join(' AND ')}
            ORDER BY play_count ASC, ABS(COALESCE(bpm, ?) - ?) ASC, created_at DESC LIMIT 20`,
      params: [...params, bpm || 100, bpm || 100],
    };
  };

  const attempts = [
    buildQuery({ withGenre: true, withMbti: Boolean(mbti) }),
    buildQuery({ withMbti: Boolean(mbti) }),
    buildQuery({ withMode: true }),
    buildQuery({ withMode: false }),
  ];

  for (const attempt of attempts) {
    const candidates = await db.prepare(attempt.sql).all(...attempt.params);
    if (candidates.length) {
      const picked = mapCatalogRow(candidates[0]);
      await recordPlay(picked.id);
      return picked;
    }
  }
  return null;
}

export async function seedFallbackTracks({ mode, mbti } = {}) {
  await ensureCatalogSeeded();
  const fromCatalog = await pickFromCatalog({ mode, mbti, includeSeeds: true });
  if (fromCatalog) return fromCatalog;

  const legacy = await pickTrack(mode, mbti);
  if (!legacy?.url) return null;
  const seeded = await upsertCatalog({
    id: legacy.id,
    source: 'seed',
    audioUrl: legacy.url,
    audioLocal: legacy.url,
    title: legacy.title,
    mbti: legacy.mbti || mbti || null,
    mode,
  });
  await recordPlay(seeded.id);
  return seeded;
}
