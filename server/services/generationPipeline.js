import { EventEmitter } from 'events';
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
import { generateLyrics } from './lyricsGenerator.js';
import { chargeGenerationCredits, refundGenerationCredits } from './creditService.js';
import {
  pickFromCatalog,
  seedFallbackTracks,
  upsertCatalog,
  updateCatalogAudioLocal,
  updateCatalogStems,
} from './songCatalog.js';
import { pickTrack, pickFromSharedLibrary } from './libraryStore.js';
import { saveTrack } from './quotaService.js';
import { dal } from '../db.js';
import { storage } from '../storage/index.js';
import * as trackPool from './arranger/trackPool.js';
import * as sessionStore from './arranger/sessionStore.js';

const hotCache = new Map();
const HOT_CACHE_TTL_MS = 30 * 60 * 1000;
const POLL_INTERVAL_MS = positiveMs(process.env.MUSIC_GENERATION_POLL_INTERVAL_MS, 4000);
const POLL_TIMEOUT_MS = positiveMs(process.env.MUSIC_GENERATION_POLL_TIMEOUT_MS, 5 * 60 * 1000);
const GENERATION_FALLBACK_AFTER_MS = positiveMs(
  process.env.MUSIC_GENERATION_FALLBACK_AFTER_MS,
  90_000
);

export const COST_PER_TRACK = 0.08;
export const HARD_DAILY_LIMIT = 10;
export const SOFT_HOURLY_LIMIT = 0.5;
export const PAUSE_BALANCE_THRESHOLD = 2;

function positiveMs(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeDurationSec(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function masterTracks({ url, title = 'Master' }) {
  return url ? [{ id: 'master', name: title || 'Master', type: 'master', url }] : [];
}

function mergeStemTracks(job, stemTracks = []) {
  const existingUrls = new Set((job.tracks || []).map((track) => track.url));
  const next = [...(job.tracks || [])];
  for (const track of stemTracks) {
    if (!track?.url || existingUrls.has(track.url)) continue;
    existingUrls.add(track.url);
    next.push(track);
  }
  job.tracks = next;
}

function publicJob(job) {
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
    error: job.error,
    splitStems: job.splitStems,
  };
}

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

async function upsertSharedLibraryTrack(job, { audioLocal = job.audioLocal || null } = {}) {
  if (!job.audioUrl || job.fallback) return;
  await dal.run(
    `INSERT INTO shared_library
     (id, user_id, title, mbti, mode, genre, tags, mood, bpm, audio_url, audio_local, duration_sec, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       genre = excluded.genre,
       tags = excluded.tags,
       mood = excluded.mood,
       bpm = excluded.bpm,
       audio_url = excluded.audio_url,
       audio_local = COALESCE(excluded.audio_local, shared_library.audio_local),
       duration_sec = excluded.duration_sec`,
    [
      job.id,
      job.userId || null,
      job.title || `${job.mbti} · ${job.mode}`,
      job.mbti,
      job.mode,
      job.selectedGenre || job.profile?.genre || null,
      job.fullPrompt || null,
      job.layers?.mode || null,
      job.bpm || null,
      job.audioUrl,
      audioLocal,
      normalizeDurationSec(job.duration),
      Date.now(),
    ]
  );
}

async function persistJobAudio(job) {
  if (!job.audioUrl || job.fallback) return;
  await upsertSharedLibraryTrack(job);
  await upsertCatalog({
    id: job.id,
    source: 'generated',
    audioUrl: job.audioUrl,
    audioLocal: job.audioLocal || null,
    musicId: job.musicId,
    title: job.title,
    duration: job.duration,
    prompt: job.fullPrompt,
    mbti: job.mbti,
    mode: job.mode,
    genre: job.selectedGenre || job.profile?.genre || null,
    bpm: job.bpm,
    userId: job.userId,
  });

  try {
    const res = await fetch(job.audioUrl);
    if (!res.ok || !res.body) {
      console.warn('[pipeline] audio fetch failed:', res.status);
      return;
    }
    const publicUrl = await storage.upload(`audio/${job.id}.mp3`, res.body, 'audio/mpeg');
    job.audioLocal = publicUrl;
    job.tracks = getPlaybackTracks(job);
    await upsertSharedLibraryTrack(job, { audioLocal: publicUrl });
    await updateCatalogAudioLocal(job.id, publicUrl);
    await dal.run('UPDATE generation_jobs SET audio_local = ?, tracks_json = ? WHERE id = ?', [
      publicUrl,
      JSON.stringify(job.tracks || []),
      job.id,
    ]);
    await dal.run('UPDATE tracks SET audio_url = ?, tracks_json = ? WHERE id = ?', [
      publicUrl,
      JSON.stringify(getPlaybackTracks(job)),
      job.id,
    ]).catch(() => {});
    await saveJobToDB(job);
    generationPipeline.emitJob('generation:completed', job);
  } catch (err) {
    console.warn('[pipeline] audio upload/save failed:', err.message);
  }
}

async function saveUserTrack(job) {
  if (!job.userId || !getPlaybackUrl(job)) return;
  try {
    await saveTrack({
      jobId: job.id,
      userId: job.userId,
      title: job.title || job.fallbackTitle || `${job.mbti} · ${job.mode}`,
      mbti: job.mbti,
      mode: job.mode,
      prompt: job.fullPrompt,
      audioUrl: getPlaybackUrl(job),
      tracks: getPlaybackTracks(job),
      fallback: job.fallback,
    });
    job.savedToLibrary = true;
  } catch (err) {
    console.error('[pipeline] saveTrack failed:', err.message);
  }
}

async function withGeneratedLyrics(promptOpts) {
  if (!promptOpts.vocals?.enabled || promptOpts.vocals.lyrics) return promptOpts;

  const composed = composePrompt(promptOpts);
  try {
    const generated = await generateLyrics({
      mbtiType: composed.mbti,
      mode: composed.mode,
      projectAnalysis: promptOpts.projectAnalysis,
      notes: promptOpts.notes,
      language: promptOpts.vocals.language || 'zh',
    });
    if (!generated?.lyrics) return promptOpts;
    return {
      ...promptOpts,
      vocals: {
        ...promptOpts.vocals,
        lyrics: generated.lyrics,
        vocalStyle: generated.vocalStyle,
        vocalDesc: generated.vocalDesc,
        lyricsStructure: generated.structure,
      },
    };
  } catch (err) {
    console.warn('[pipeline] lyrics generation skipped:', err.message);
    return promptOpts;
  }
}

function createJobFromComposed({
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

export class GenerationPipeline extends EventEmitter {
  constructor({ maxConcurrent = 2 } = {}) {
    super();
    this.maxConcurrent = maxConcurrent;
    this.activeCount = 0;
    this.pendingQueue = [];
    this.runningJobIds = new Set();
  }

  emitJob(event, job, extra = {}) {
    this.emit(event, { ...publicJob(job), ...extra });
  }

  async withGenerationSlot(task) {
    if (this.activeCount >= this.maxConcurrent) {
      return new Promise((resolve, reject) => {
        this.pendingQueue.push(() => {
          this.withGenerationSlot(task).then(resolve).catch(reject);
        });
      });
    }

    this.activeCount += 1;
    try {
      return await task();
    } finally {
      this.activeCount -= 1;
      this.drainPending();
    }
  }

  async createMusicJob(params) {
    const jobId = params.jobId || uuidv4();
    const shouldUseSuno = isSunoConfigured() && !params.forceFallback;
    const promptOpts = shouldUseSuno ? await withGeneratedLyrics(params) : params;
    const composed = composePrompt(promptOpts);
    const job = createJobFromComposed({
      jobId,
      userId: params.userId,
      composed,
      vocals: promptOpts.vocals,
      splitStems: params.splitStems,
    });
    job.selectedGenre = composed.selectedGenre;

    await saveJobToDB(job);
    this.emitJob('generation:status', job, { status: job.status });

    if (!shouldUseSuno) {
      this.completeWithFallback(job, { delayMs: 350, reason: params.forceFallback ? 'forced' : 'suno-unavailable' });
      return job;
    }

    const charge = await chargeGenerationCredits(params.user || params.userId, job.id);
    job.credits = charge.credits;
    if (!charge.ok) {
      job.creditNotice = charge.error;
      await saveJobToDB(job);
      this.completeWithFallback(job, { delayMs: 350, reason: charge.error });
      return job;
    }

    this.startQueuedMusicGeneration(job, composed, promptOpts).catch((err) => {
      console.warn('[pipeline] queued generation failed:', err.message);
    });

    return job;
  }

  async startQueuedMusicGeneration(job, composed, promptOpts) {
    return this.withGenerationSlot(async () => {
      try {
        const current = await getJob(job.id);
        if (!current || current.status === 'completed' || current.status === 'failed' || current.audioUrl) {
          return current || job;
        }

        const { taskId } = await submitGeneration({
          prompt: composed.fullPrompt,
          title: `${composed.mbti}-${composed.mode}`,
          tags: composed.layers?.mbti || '',
          negativeTags: composed.negativeTags || '',
          weirdnessConstraint: composed.weirdnessConstraint,
          styleWeight: composed.styleWeight,
          audioWeight: composed.audioWeight,
          personaId: composed.personaId,
          instrumental: !promptOpts.vocals?.enabled,
          lyrics: promptOpts.vocals?.enabled && promptOpts.vocals?.lyrics
            ? promptOpts.vocals.lyrics
            : undefined,
        });
        current.sunoTaskId = taskId;
        await saveJobToDB(current);
        this.emitJob('generation:status', current, { status: 'processing', taskId });
        return this.runJobToCompletionInCurrentSlot(current);
      } catch (err) {
        console.warn('[pipeline] TTAPI submit/generation failed, using fallback:', err.message);
        const current = await getJob(job.id) || job;
        if (current.status === 'completed' || current.status === 'failed' || current.audioUrl) {
          return current;
        }
        current.error = err.message;
        await saveJobToDB(current);
        return this.completeWithFallback(current, { reason: err.message });
      }
    });
  }

  async runJobToCompletion(job) {
    if (!job.sunoTaskId) return job;
    return this.withGenerationSlot(() => this.runJobToCompletionInCurrentSlot(job));
  }

  async runJobToCompletionInCurrentSlot(job) {
    if (!job.sunoTaskId) return job;
    if (this.runningJobIds.has(job.id)) return job;
    this.runningJobIds.add(job.id);
    try {
      const result = await this.waitForCompletion(job.sunoTaskId, async (progress) => {
        job.generationProgress = progress;
        await saveJobToDB(job);
        this.emitJob('generation:progress', job, { progress });
      });
      await this.applyGeneratedMusic(job, result);
      return job;
    } catch (err) {
      job.error = err.message;
      await saveJobToDB(job);
      await this.completeWithFallback(job, { reason: err.message });
      return job;
    } finally {
      this.runningJobIds.delete(job.id);
    }
  }

  async waitForCompletion(taskId, onProgress = null) {
    const startedAt = Date.now();
    for (;;) {
      const result = await pollGeneration(taskId);
      if (result.status === 'completed') return result;
      if (result.status === 'failed') throw new Error('TTAPI generation failed');
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        throw new Error('TTAPI generation timed out');
      }
      await onProgress?.(result.progress || null);
      await sleep(POLL_INTERVAL_MS);
    }
  }

  async applyGeneratedMusic(job, result) {
    const music = result.music || {};
    job.status = 'completed';
    job.audioUrl = result.audioUrl;
    job.musicId = result.musicId || music.musicId || null;
    job.title = music.title || job.title || `${job.mbti} · ${job.mode}`;
    job.duration = normalizeDurationSec(music.duration || job.duration);
    job.tracks = masterTracks({ url: result.audioUrl, title: job.title || 'Master' });
    job.fallback = false;
    job.completedAt = Date.now();
    await saveJobToDB(job);
    await upsertCatalog({
      id: job.id,
      source: 'generated',
      audioUrl: job.audioUrl,
      musicId: job.musicId,
      title: job.title,
      duration: job.duration,
      prompt: job.fullPrompt,
      mbti: job.mbti,
      mode: job.mode,
      genre: job.selectedGenre || job.profile?.genre || null,
      bpm: job.bpm,
      userId: job.userId,
    });
    await saveUserTrack(job);
    this.emitJob('generation:completed', job);
    persistJobAudio(job).catch(() => {});
    this.startStemSeparation(job).catch((err) => {
      console.warn('[pipeline] stem separation failed:', err.message);
    });
  }

  async startStemSeparation(job) {
    if (!job.splitStems || !job.musicId || job.fallback || !isSunoConfigured()) {
      job.stemStatus = job.splitStems ? 'skipped' : 'idle';
      await saveJobToDB(job);
      this.emitJob('stem:status', job, { stemStatus: job.stemStatus });
      return;
    }
    try {
      const stemJob = await submitStemSeparation({ musicId: job.musicId });
      job.stemTaskId = stemJob.taskId;
      job.stemStatus = 'processing';
      await saveJobToDB(job);
      this.emitJob('stem:status', job, { stemStatus: 'processing' });
      await this.pollStemSeparation(job);
    } catch (err) {
      job.stemStatus = 'failed';
      job.stemError = err.message;
      await saveJobToDB(job);
      this.emitJob('stem:failed', job, { reason: err.message });
    }
  }

  async pollStemSeparation(job) {
    const startedAt = Date.now();
    for (;;) {
      const result = await pollStemSeparation(job.stemTaskId);
      if (result.status === 'completed') {
        mergeStemTracks(job, result.tracks);
        job.stemStatus = result.tracks?.length ? 'completed' : 'completed-empty';
        await updateCatalogStems(job.id, result.tracks || []);
        await saveJobToDB(job);
        this.emitJob('stem:completed', job, { stems: result.tracks || [] });
        return;
      }
      if (result.status === 'failed') {
        job.stemStatus = 'failed';
        await saveJobToDB(job);
        this.emitJob('stem:failed', job);
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        job.stemStatus = 'failed';
        job.stemError = 'stem separation timed out';
        await saveJobToDB(job);
        this.emitJob('stem:failed', job, { reason: job.stemError });
        return;
      }
      job.stemProgress = result.progress || job.stemProgress;
      this.emitJob('stem:status', job, { stemStatus: 'processing', progress: job.stemProgress });
      await sleep(POLL_INTERVAL_MS);
    }
  }

  async completeWithFallback(job, { delayMs = 0, reason = 'fallback' } = {}) {
    const finish = async () => {
      const shared = await pickFromCatalog({
        mode: job.mode,
        mbti: job.mbti,
        genre: job.selectedGenre || job.profile?.genre,
        bpm: job.bpm,
        excludeJobIds: [job.id],
      }) || await pickFromSharedLibrary({
        mode: job.mode,
        mbti: job.mbti,
        genre: job.selectedGenre || job.profile?.genre,
        bpm: job.bpm,
      });
      const track = shared || await seedFallbackTracks({ mode: job.mode, mbti: job.mbti });
      if (!track) {
        job.status = 'failed';
        job.error = 'No fallback track available';
        await saveJobToDB(job);
        this.emitJob('generation:failed', job, { reason: job.error });
        await refundGenerationCredits(job.userId, job.id, { fallbackSource: 'empty', reason }).catch(() => {});
        return job;
      }

      const url = track.audioLocal || track.audioUrl || track.url;
      job.status = 'completed';
      job.audioUrl = url;
      job.audioLocal = track.audioLocal || url;
      job.title = track.title || job.title;
      job.fallbackTitle = track.title || null;
      job.tracks = masterTracks({ url, title: track.title || 'Fallback' });
      job.fallback = true;
      job.fallbackSource = track.source || (shared ? 'song_catalog' : 'manifest');
      job.completedAt = Date.now();
      job.stemStatus = 'skipped';
      await saveJobToDB(job);
      await saveUserTrack(job);
      await refundGenerationCredits(job.userId, job.id, { fallbackSource: job.fallbackSource, reason }).catch((err) => {
        console.warn('[pipeline] credit refund skipped:', err.message);
      });
      this.emitJob('generation:completed', job, { fallback: true });
      this.emitJob('stem:status', job, { stemStatus: 'skipped' });
      return job;
    };
    if (delayMs > 0) {
      setTimeout(() => finish().catch(console.error), delayMs);
      return job;
    }
    return finish();
  }

  async budgetGate(sessionId, hourlySpend = [], emit = () => {}) {
    const session = await sessionStore.getSession(sessionId);
    if (!session) return 'session-not-found';

    const remaining = session.budgetLimit - session.budgetSpent;
    if (remaining < PAUSE_BALANCE_THRESHOLD) {
      emit('budget_alert', { reason: 'low-balance', remaining });
      return 'paused-low-balance';
    }
    if (session.budgetSpent >= session.budgetLimit || session.budgetSpent >= HARD_DAILY_LIMIT) {
      emit('budget_alert', { reason: 'hard-limit', spent: session.budgetSpent });
      return 'hard-limit-reached';
    }
    const now = Date.now();
    const recentSpend = hourlySpend.filter((entry) => now - entry.at < 60 * 60 * 1000);
    const spentThisHour = recentSpend.reduce((sum, entry) => sum + entry.cost, 0);
    if (spentThisHour >= SOFT_HOURLY_LIMIT) {
      emit('budget_alert', { reason: 'soft-hourly-limit', spentThisHour });
      return 'soft-hourly-limit';
    }
    return null;
  }

  async createArrangerFallback(sessionId, promptOpts, { reason = 'fallback', emit = () => {}, trackId = null } = {}) {
    const composed = composePrompt(promptOpts);
    const catalogTrack = await pickFromCatalog({
      mode: composed.mode,
      mbti: composed.mbti,
      genre: composed.selectedGenre || promptOpts.selectedGenre || composed.profile?.genre,
      bpm: composed.bpm,
      includeSeeds: true,
    }) || await seedFallbackTracks({ mode: composed.mode, mbti: composed.mbti });
    const legacyTrack = catalogTrack || await pickTrack(composed.mode, composed.mbti);
    const url = legacyTrack?.audioLocal || legacyTrack?.audioUrl || legacyTrack?.url;
    if (!url) {
      emit('music_ready', { track: null, error: 'No fallback track available', phase: composed.mode, reason });
      return null;
    }
    const fallbackPayload = {
      phase: composed.mode,
      moodTag: legacyTrack.title || `${composed.mbti}-${composed.mode}`,
      energyLevel: promptOpts.targetEnergy ?? 50,
      genre: composed.selectedGenre || promptOpts.selectedGenre || composed.profile?.genre || 'Fallback',
      instruments: promptOpts.instruments || [],
      promptConfig: { ...composed, fallback: true, fallbackReason: reason, fallbackTrackId: legacyTrack.id },
      audioUrl: url,
      audioLocal: legacyTrack.audioLocal || url,
      durationSec: legacyTrack.durationSec || legacyTrack.duration || null,
    };
    const ready = trackId
      ? await trackPool.markTrackFallback(trackId, fallbackPayload)
      : await trackPool.createTrack(sessionId, fallbackPayload);
    emit('music_ready', { track: ready, fallback: true, phase: composed.mode, reason });
    return ready;
  }

  async generateArrangerTrack(sessionId, promptOpts, {
    immediate = false,
    hourlySpend = [],
    emit = () => {},
    recordSpend = async () => {},
  } = {}) {
    const gate = await this.budgetGate(sessionId, hourlySpend, emit);
    if (gate && !immediate) {
      return this.createArrangerFallback(sessionId, promptOpts, { reason: gate, emit });
    }

    const generationPromptOpts = isSunoConfigured() ? await withGeneratedLyrics(promptOpts) : promptOpts;
    const composed = composePrompt(generationPromptOpts);
    if (!isSunoConfigured()) {
      return this.createArrangerFallback(sessionId, generationPromptOpts, { reason: 'suno-unavailable', emit });
    }

    const session = await sessionStore.getSession(sessionId);
    const pending = await trackPool.createTrack(sessionId, {
      phase: composed.mode,
      moodTag: generationPromptOpts.style?.moodTag || composed.mode,
      energyLevel: generationPromptOpts.targetEnergy ?? 50,
      genre: composed.selectedGenre || generationPromptOpts.selectedGenre || composed.profile?.genre || 'Unknown',
      instruments: generationPromptOpts.instruments || [],
      promptConfig: composed,
    });
    const creditReferenceId = `arranger:${pending.id}`;

    try {
      const charge = await chargeGenerationCredits(session?.userId, creditReferenceId);
      if (!charge.ok) {
        throw Object.assign(new Error(charge.error), { code: charge.code, status: charge.status });
      }
      const { taskId } = await submitGeneration({
        prompt: composed.fullPrompt,
        title: `${composed.mbti}-${composed.mode}`,
        tags: composed.layers?.mbti || '',
        weirdnessConstraint: composed.weirdnessConstraint,
        styleWeight: composed.styleWeight,
        audioWeight: composed.audioWeight,
        personaId: composed.personaId,
        instrumental: !generationPromptOpts.vocals?.enabled,
        lyrics: generationPromptOpts.vocals?.enabled && generationPromptOpts.vocals?.lyrics
          ? generationPromptOpts.vocals.lyrics
          : undefined,
        negativeTags: composed.negativeTags || '',
      });
      emit('generation_status', { trackId: pending.id, taskId, status: 'processing', phase: composed.mode });
      const result = await this.waitForCompletion(taskId);
      const audioLocal = await this.persistArrangerAudio(result.audioUrl, sessionId, pending.id);
      const ready = await trackPool.markTrackReady(pending.id, {
        audioUrl: result.audioUrl,
        audioLocal,
        durationSec: result.music?.duration || null,
      });
      await upsertCatalog({
        id: `arranger-${pending.id}`,
        source: 'generated',
        audioUrl: result.audioUrl,
        audioLocal,
        musicId: result.musicId || result.music?.musicId || null,
        title: result.music?.title || `${composed.mbti}-${composed.mode}`,
        duration: result.music?.duration || null,
        prompt: composed.fullPrompt,
        mbti: composed.mbti,
        mode: composed.mode,
        genre: composed.selectedGenre || generationPromptOpts.selectedGenre || composed.profile?.genre || null,
        bpm: composed.bpm,
        userId: session?.userId,
      });
      hourlySpend.push({ at: Date.now(), cost: COST_PER_TRACK });
      await recordSpend(COST_PER_TRACK);
      emit('music_ready', { track: ready });
      return ready;
    } catch (err) {
      console.error('[arranger] generation failed:', err.message);
      const fallback = await this.createArrangerFallback(sessionId, generationPromptOpts, {
        reason: err.message,
        emit,
        trackId: pending.id,
      });
      if (fallback) {
        await refundGenerationCredits(session?.userId, creditReferenceId, { fallbackSource: 'arranger' }).catch((refundErr) => {
          console.warn('[arranger] credit refund skipped:', refundErr.message);
        });
        return fallback;
      }
      await refundGenerationCredits(session?.userId, creditReferenceId, { fallbackSource: 'arranger-empty' }).catch((refundErr) => {
        console.warn('[arranger] credit refund skipped:', refundErr.message);
      });
      emit('music_ready', { track: null, error: err.message, phase: composed.mode });
      return null;
    }
  }

  async persistArrangerAudio(url, sessionId, trackId) {
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download audio for storage: ${res.status}`);
    }
    return storage.upload(`arranger/${sessionId}/${trackId}-${uuidv4().slice(0, 8)}.mp3`, res.body, 'audio/mpeg');
  }

  drainPending() {
    while (this.pendingQueue.length > 0 && this.activeCount < this.maxConcurrent) {
      const next = this.pendingQueue.shift();
      next();
    }
  }
}

export const generationPipeline = new GenerationPipeline();
generationPipeline.setMaxListeners(0);

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [id, job] of hotCache) {
    if (now - Number(job.createdAt || 0) > HOT_CACHE_TTL_MS) hotCache.delete(id);
  }
}, 60_000);
cleanupTimer.unref?.();

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

export async function createMusicJob(params) {
  return generationPipeline.createMusicJob(params);
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

export async function refreshJob(jobId) {
  const job = await getJob(jobId);
  if (!job) return null;
  if (job.status === 'completed' || job.status === 'failed') return job;

  if (
    job.status === 'processing' &&
    !job.audioUrl &&
    Number(job.createdAt || 0) &&
    Date.now() - Number(job.createdAt || 0) > GENERATION_FALLBACK_AFTER_MS
  ) {
    job.error = `TTAPI generation exceeded fallback window (${GENERATION_FALLBACK_AFTER_MS}ms)`;
    await generationPipeline.completeWithFallback(job, { reason: job.error });
    return job;
  }

  if (job.status === 'processing' && job.sunoTaskId && isSunoConfigured()) {
    generationPipeline.runJobToCompletion(job).catch((err) => {
      console.warn('[pipeline] refresh recovery failed:', err.message);
    });
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
