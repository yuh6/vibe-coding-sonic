import { cache } from '../cache/index.js';
import { dal } from '../db.js';

const hotCache = new Map();
const HOT_CACHE_TTL_MS = 30 * 60 * 1000;

export function normalizeDurationSec(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

export function masterTracks({ url, title = 'Master' }) {
  return url ? [{ id: 'master', name: title || 'Master', type: 'master', url }] : [];
}

export function mergeStemTracks(job, stemTracks = []) {
  const existingUrls = new Set((job.tracks || []).map((track) => track.url));
  const next = [...(job.tracks || [])];
  for (const track of stemTracks) {
    if (!track?.url || existingUrls.has(track.url)) continue;
    existingUrls.add(track.url);
    next.push(track);
  }
  job.tracks = next;
}

export function publicJob(job) {
  return {
    jobId: job.id,
    id: job.id,
    status: job.status,
    audioUrl: getPlaybackUrl(job),
    musicId: job.musicId,
    title: job.title,
    duration: job.duration,
    tracks: getPlaybackTracks(job),
    generationProgress: job.generationProgress,
    stemStatus: job.stemStatus,
    stemProgress: job.stemProgress,
    stemError: job.stemError,
    fallback: job.fallback,
    fallbackTitle: job.fallbackTitle,
    fallbackSource: job.fallbackSource,
    fullPrompt: job.fullPrompt,
    layers: job.layers,
    bpm: job.bpm,
    mode: job.mode,
    mbti: job.mbti,
    profile: job.profile,
    hasLyrics: job.hasLyrics,
    lyrics: job.lyrics,
    vocalStyle: job.vocalStyle,
    vocalDesc: job.vocalDesc,
    generationMode: job.generationMode,
    model: job.model,
    tags: job.tags,
    requestedBpm: job.requestedBpm,
    error: job.error,
    splitStems: job.splitStems,
  };
}

export async function saveJobToDB(job) {
  await dal.run(
    `INSERT INTO generation_jobs
     (id, user_id, status, mbti, mode, full_prompt, negative_tags, bpm, weirdness, style_weight,
      suno_task_id, music_id, audio_url, audio_local, title, duration_sec, tracks_json, layers_json,
      profile_json, fallback, fallback_source, error, split_stems, stem_task_id, stem_status, created_at, completed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       user_id = excluded.user_id,
       status = excluded.status,
       mbti = excluded.mbti,
       mode = excluded.mode,
       full_prompt = excluded.full_prompt,
       negative_tags = excluded.negative_tags,
       bpm = excluded.bpm,
       weirdness = excluded.weirdness,
       style_weight = excluded.style_weight,
       suno_task_id = excluded.suno_task_id,
       music_id = excluded.music_id,
       audio_url = excluded.audio_url,
       audio_local = excluded.audio_local,
       title = excluded.title,
       duration_sec = excluded.duration_sec,
       tracks_json = excluded.tracks_json,
       layers_json = excluded.layers_json,
       profile_json = excluded.profile_json,
       fallback = excluded.fallback,
       fallback_source = excluded.fallback_source,
       error = excluded.error,
       split_stems = excluded.split_stems,
       stem_task_id = excluded.stem_task_id,
       stem_status = excluded.stem_status,
       created_at = excluded.created_at,
       completed_at = excluded.completed_at`,
    [
      job.id, job.userId || null, job.status, job.mbti, job.mode,
      job.fullPrompt, job.negativeTags, job.bpm,
      job.weirdnessConstraint, job.styleWeight,
      job.sunoTaskId, job.musicId, job.audioUrl, job.audioLocal || null,
      job.title, normalizeDurationSec(job.duration),
      JSON.stringify(job.tracks || []), JSON.stringify(job.layers || {}),
      JSON.stringify(job.profile || {}),
      job.fallback ? 1 : 0, job.fallbackSource || null,
      job.error || null, job.splitStems ? 1 : 0,
      job.stemTaskId || null, job.stemStatus || 'idle',
      job.createdAt, job.completedAt || null,
    ]
  );
  hotCache.set(job.id, job);
  await cache.setJSON(`job:${job.id}`, job, 1800).catch(() => {});
}

async function loadJobFromDB(jobId) {
  const row = await dal.get('SELECT * FROM generation_jobs WHERE id = ?', [jobId]);
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    mbti: row.mbti,
    mode: row.mode,
    fullPrompt: row.full_prompt,
    negativeTags: row.negative_tags,
    bpm: row.bpm,
    weirdnessConstraint: row.weirdness,
    styleWeight: row.style_weight,
    sunoTaskId: row.suno_task_id,
    musicId: row.music_id,
    audioUrl: row.audio_url,
    audioLocal: row.audio_local,
    title: row.title,
    duration: row.duration_sec,
    tracks: JSON.parse(row.tracks_json || '[]'),
    layers: JSON.parse(row.layers_json || '{}'),
    profile: JSON.parse(row.profile_json || '{}'),
    fallback: Boolean(row.fallback),
    fallbackSource: row.fallback_source,
    error: row.error,
    splitStems: Boolean(row.split_stems),
    stemTaskId: row.stem_task_id,
    stemStatus: row.stem_status,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

export function createJobFromComposed({
  jobId,
  userId,
  composed,
  vocals,
  splitStems,
}) {
  return {
    id: jobId,
    userId: userId || null,
    status: 'processing',
    ...composed,
    generationForm: composed.form || null,
    generationMode: composed.generationMode || null,
    model: composed.model || null,
    tags: composed.tags || null,
    requestedBpm: composed.requestedBpm || composed.analysis?.requestedBpm || null,
    audioUrl: null,
    audioLocal: null,
    tracks: [],
    fallback: false,
    fallbackSource: null,
    sunoTaskId: null,
    musicId: null,
    splitStems: Boolean(splitStems),
    lyrics: vocals?.lyrics || null,
    vocalStyle: vocals?.vocalStyle || null,
    vocalDesc: vocals?.vocalDesc || null,
    lyricsStructure: vocals?.lyricsStructure || [],
    stemTaskId: null,
    stemStatus: 'idle',
    error: null,
    createdAt: Date.now(),
    completedAt: null,
  };
}

export function getPlaybackUrl(job) {
  return job?.audioLocal || job?.audioUrl || null;
}

export function getPlaybackTracks(job) {
  const playbackUrl = getPlaybackUrl(job);
  const tracks = job?.tracks || [];
  if (!tracks.length) return playbackUrl ? masterTracks({ url: playbackUrl, title: job?.title || 'Master' }) : [];
  if (!job?.audioLocal || !job?.audioUrl) return tracks;
  return tracks.map((track) => (track?.url === job.audioUrl ? { ...track, url: job.audioLocal } : track));
}

export async function getJob(jobId) {
  if (hotCache.has(jobId)) return hotCache.get(jobId);
  const cached = await cache.getJSON(`job:${jobId}`);
  if (cached) {
    hotCache.set(jobId, cached);
    return cached;
  }
  const job = await loadJobFromDB(jobId);
  if (job) {
    hotCache.set(jobId, job);
    await cache.setJSON(`job:${jobId}`, job, 1800).catch(() => {});
  }
  return job;
}

export function userOwnsJobUrl(userId, url) {
  for (const job of hotCache.values()) {
    if (job.userId !== userId) continue;
    if (job.audioUrl === url || job.audioLocal === url) return true;
    if ((job.tracks || []).some((track) => track?.url === url)) return true;
  }
  return false;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, job] of hotCache) {
    if (now - Number(job.createdAt || 0) > HOT_CACHE_TTL_MS) hotCache.delete(id);
  }
}, 60_000);
cleanupTimer.unref?.();
