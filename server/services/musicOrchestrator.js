import { v4 as uuidv4 } from 'uuid';
import { composePrompt } from './promptComposer.js';
import { cache } from '../cache/index.js';
import {
  isSunoConfigured,
  submitGeneration,
  pollGeneration,
  submitStemSeparation,
  pollStemSeparation,
} from './sunoClient.js';
import { pickTrack, pickFromSharedLibrary } from './libraryStore.js';
import { dal } from '../db.js';
import { storage } from '../storage/index.js';

// ═══════════════════════════════════════════════════════════════
//  生成任务管理 — 双层架构：
//  1. generation_jobs 表（持久化，重启不丢失）
//  2. 内存 Map 作为热缓存（避免每次 poll 都查 DB）
// ═══════════════════════════════════════════════════════════════

const hotCache = new Map(); // jobId → job object（活跃任务缓存）
const HOT_CACHE_TTL_MS = 30 * 60 * 1000;
const GENERATION_FALLBACK_AFTER_MS = positiveMs(
  process.env.MUSIC_GENERATION_FALLBACK_AFTER_MS,
  90_000
);

function positiveMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDurationSec(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function cleanupHotCache() {
  const now = Date.now();
  for (const [id, job] of hotCache) {
    if (now - job.createdAt > HOT_CACHE_TTL_MS) hotCache.delete(id);
  }
}
const cleanupTimer = setInterval(cleanupHotCache, 60_000);
cleanupTimer.unref?.();

// ── DB 操作 ──

async function saveJobToDB(job) {
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
      job.error, job.splitStems ? 1 : 0,
      job.stemTaskId, job.stemStatus,
      job.createdAt, job.completedAt || null,
    ]
  );
  // 同步到 Redis 缓存
  await cache.setJSON(`job:${job.id}`, job, 1800).catch(() => {});
}

async function loadJobFromDB(jobId) {
  const row = await dal.get('SELECT * FROM generation_jobs WHERE id = ?', [jobId]);
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id, status: row.status,
    mbti: row.mbti, mode: row.mode,
    fullPrompt: row.full_prompt, negativeTags: row.negative_tags,
    bpm: row.bpm, weirdnessConstraint: row.weirdness, styleWeight: row.style_weight,
    sunoTaskId: row.suno_task_id, musicId: row.music_id,
    audioUrl: row.audio_url, audioLocal: row.audio_local,
    title: row.title, duration: row.duration_sec,
    tracks: JSON.parse(row.tracks_json || '[]'),
    layers: JSON.parse(row.layers_json || '{}'),
    profile: JSON.parse(row.profile_json || '{}'),
    fallback: Boolean(row.fallback), fallbackSource: row.fallback_source,
    error: row.error,
    splitStems: Boolean(row.split_stems),
    stemTaskId: row.stem_task_id, stemStatus: row.stem_status,
    createdAt: row.created_at, completedAt: row.completed_at,
  };
}

// ── 辅助函数 ──

function masterTracks({ url, title = 'Master' }) {
  return url ? [{ id: 'master', name: title || 'Master', type: 'master', url }] : [];
}

export function getPlaybackUrl(job) {
  return job?.audioLocal || job?.audioUrl || null;
}

export function getPlaybackTracks(job) {
  const playbackUrl = getPlaybackUrl(job);
  const tracks = job?.tracks || [];
  if (!tracks.length) return playbackUrl ? masterTracks({ url: playbackUrl, title: job?.title || 'Master' }) : [];
  if (!job?.audioLocal || !job?.audioUrl) return tracks;
  return tracks.map((track) => {
    if (track?.url !== job.audioUrl) return track;
    return { ...track, url: job.audioLocal };
  });
}

function mergeStemTracks(job, stemTracks = []) {
  const existingUrls = new Set((job.tracks || []).map((t) => t.url));
  const next = [...(job.tracks || [])];
  for (const track of stemTracks) {
    if (!track?.url || existingUrls.has(track.url)) continue;
    existingUrls.add(track.url);
    next.push(track);
  }
  job.tracks = next;
}

// ── 音频持久化 ──

async function persistTrackAsync(job) {
  if (!job.audioUrl || job.fallback) return;
  try {
    const res = await fetch(job.audioUrl);
    if (!res.ok || !res.body) return;
    const key = `audio/${job.id}.mp3`;
    const publicUrl = await storage.upload(key, res.body, 'audio/mpeg');
    job.audioLocal = publicUrl;
    job.tracks = getPlaybackTracks(job);

    // 入库歌曲总库
    await dal.run(
      `INSERT INTO shared_library
       (id, user_id, title, mbti, mode, genre, tags, mood, bpm, audio_url, audio_local, duration_sec, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         audio_url = excluded.audio_url,
         audio_local = excluded.audio_local,
         duration_sec = excluded.duration_sec`,
      [
        job.id, job.userId || null,
        job.title || `${job.mbti} · ${job.mode}`,
        job.mbti, job.mode,
        job.selectedGenre || job.profile?.genre || null,
        job.fullPrompt || null,
        job.layers?.mode || null,
        job.bpm || null,
        job.audioUrl,
        publicUrl,
        normalizeDurationSec(job.duration),
        Date.now(),
      ]
    );

    // 更新 job 的 audio_local
    await dal.run('UPDATE generation_jobs SET audio_local = ? WHERE id = ?', [publicUrl, job.id]);
    await dal.run(
      'UPDATE tracks SET audio_url = ?, tracks_json = ? WHERE id = ?',
      [publicUrl, JSON.stringify(getPlaybackTracks(job)), job.id]
    );
    await saveJobToDB(job);
  } catch (err) {
    console.warn('[persist] audio upload/save failed:', err.message);
  }
}

// ── 生成完成 ──

function applyGeneratedMusic(job, result) {
  const music = result.music || {};
  job.status = 'splitting';
  job.audioUrl = result.audioUrl;
  job.musicId = result.musicId || music.musicId || null;
  job.title = music.title || job.title;
  job.duration = normalizeDurationSec(music.duration || job.duration);
  job.tracks = masterTracks({ url: result.audioUrl, title: music.title || 'Master' });
  // 异步落盘（不阻塞）
  persistTrackAsync(job).catch(() => {});
}

async function startStemSeparation(job) {
  if (!job.splitStems || !job.musicId || job.fallback) {
    job.status = 'completed';
    job.completedAt = Date.now();
    await saveJobToDB(job);
    return;
  }
  try {
    const stemJob = await submitStemSeparation({ musicId: job.musicId });
    job.stemTaskId = stemJob.taskId;
    job.stemStatus = 'processing';
    job.status = 'splitting';
    await saveJobToDB(job);
  } catch (err) {
    job.stemStatus = 'failed';
    job.status = 'completed';
    job.completedAt = Date.now();
    await saveJobToDB(job);
  }
}

async function completeWithFallback(job, delayMs = 0) {
  const finish = async () => {
    const shared = await pickFromSharedLibrary({
      mode: job.mode, mbti: job.mbti,
      genre: job.selectedGenre || job.profile?.genre, bpm: job.bpm,
    });
    if (shared) {
      job.status = 'completed';
      job.audioUrl = shared.url;
      job.title = shared.title || job.title;
      job.tracks = masterTracks({ url: shared.url, title: shared.title });
      job.fallback = true;
      job.fallbackSource = 'shared_library';
      job.completedAt = Date.now();
      await saveJobToDB(job);
      return;
    }
    const track = await pickTrack(job.mode, job.mbti);
    if (!track) {
      job.status = 'failed';
      job.error = 'No fallback track available';
      await saveJobToDB(job);
      return;
    }
    job.status = 'completed';
    job.audioUrl = track.url;
    job.title = track.title || job.title;
    job.tracks = masterTracks({ url: track.url, title: track.title });
    job.fallback = true;
    job.fallbackSource = 'manifest';
    job.completedAt = Date.now();
    await saveJobToDB(job);
  };
  if (delayMs > 0) setTimeout(() => finish().catch(console.error), delayMs);
  else await finish();
}

// ═══════════════════════════════════════════════════════════════
//  公开 API
// ═══════════════════════════════════════════════════════════════

export function createMusicJob({
  userId,
  mbti, axes, mode, projectAnalysis, style,
  selectedGenre, notes, vocals,
  forceFallback = false, splitStems = true,
}) {
  const composed = composePrompt({ mbti, axes, mode, projectAnalysis, style, selectedGenre, notes, vocals });
  const jobId = uuidv4();
  const useSuno = isSunoConfigured() && !forceFallback;

  const job = {
    id: jobId,
    userId: userId || null,
    status: 'processing',
    ...composed,
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

  hotCache.set(jobId, job);
  saveJobToDB(job).catch(console.error);

  if (useSuno) {
    submitGeneration({
      prompt: composed.fullPrompt,
      title: `${composed.mbti}-${composed.mode}`,
      tags: composed.layers?.mbti || '',
      negativeTags: composed.negativeTags || '',
      weirdnessConstraint: composed.weirdnessConstraint,
      styleWeight: composed.styleWeight,
      instrumental: !vocals?.enabled,
      lyrics: vocals?.enabled && vocals?.lyrics ? vocals.lyrics : undefined,
    })
      .then(({ taskId }) => {
        job.sunoTaskId = taskId;
        saveJobToDB(job).catch(console.error);
      })
      .catch((err) => {
        console.warn('[music] TTAPI submit failed, using fallback:', err.message);
        completeWithFallback(job, 1500);
      });
  } else {
    completeWithFallback(job, 2000);
  }

  return job;
}

export async function getJob(jobId) {
  // 1. 内存热缓存
  if (hotCache.has(jobId)) return hotCache.get(jobId);
  // 2. Redis 缓存（生产环境快速读取）
  const cached = await cache.getJSON(`job:${jobId}`);
  if (cached) { hotCache.set(jobId, cached); return cached; }
  // 3. 数据库
  const job = await loadJobFromDB(jobId);
  if (job) {
    hotCache.set(jobId, job);
    await cache.setJSON(`job:${jobId}`, job, 1800); // 30min TTL
  }
  return job;
}

export function userOwnsJobUrl(userId, url) {
  for (const job of hotCache.values()) {
    if (job.userId !== userId) continue;
    if (job.audioUrl === url || job.audioLocal === url) return true;
    if ((job.tracks || []).some((t) => t?.url === url)) return true;
  }
  return false;
}

export async function refreshJob(jobId) {
  const job = await getJob(jobId);
  if (!job) return null;

  if (job.status === 'completed' || job.status === 'failed') return job;

  if (
    job.status === 'processing' &&
    !job.audioUrl &&
    Date.now() - Number(job.createdAt || 0) > GENERATION_FALLBACK_AFTER_MS
  ) {
    job.error = `TTAPI generation exceeded fallback window (${GENERATION_FALLBACK_AFTER_MS}ms)`;
    await completeWithFallback(job);
    return job;
  }

  if (job.status === 'processing' && job.sunoTaskId && isSunoConfigured()) {
    try {
      const result = await pollGeneration(job.sunoTaskId);
      if (result.status === 'completed') {
        applyGeneratedMusic(job, result);
        job.fallback = false;
        await startStemSeparation(job);
      } else {
        job.generationProgress = result.progress || job.generationProgress;
      }
    } catch (err) {
      console.warn('[music] TTAPI poll failed:', err.message);
      if (!job.audioUrl) await completeWithFallback(job);
    }
  }

  if (job.status === 'splitting' && job.stemTaskId && isSunoConfigured()) {
    try {
      const result = await pollStemSeparation(job.stemTaskId);
      if (result.status === 'completed') {
        mergeStemTracks(job, result.tracks);
        job.stemStatus = result.tracks?.length ? 'completed' : 'completed-empty';
        job.status = 'completed';
        job.completedAt = Date.now();
        await saveJobToDB(job);
      } else {
        job.stemProgress = result.progress || job.stemProgress;
      }
    } catch (err) {
      console.warn('[music] stems poll failed:', err.message);
      job.stemStatus = 'failed';
      job.status = 'completed';
      job.completedAt = Date.now();
      await saveJobToDB(job);
    }
  }

  return job;
}

export async function getFallbackTrack(mode, mbti, extras = {}) {
  const track = await pickTrack(mode, mbti);
  const composed = composePrompt({ mbti: mbti || 'INTJ', mode, projectAnalysis: null, ...extras });
  return {
    ...(track || {}),
    ...composed,
    mode,
    status: 'completed',
    fallback: true,
    audioUrl: track?.url,
    tracks: track?.url ? masterTracks({ url: track.url, title: track.title }) : [],
  };
}
