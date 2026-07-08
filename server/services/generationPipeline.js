import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { composePrompt } from './promptComposer.js';
import {
  isSunoConfigured,
  submitGeneration,
  pollGeneration,
  submitStemSeparation,
  pollStemSeparation,
} from './sunoClient.js';
import { generateLyrics } from './lyricsGenerator.js';
import { chargeGenerationCredits, refundGenerationCredits } from './creditService.js';
import { pickFromCatalog, seedFallbackTracks, upsertCatalog, updateCatalogStems } from './songCatalog.js';
import { pickTrack } from './libraryStore.js';
import { storage } from '../storage/index.js';
import * as trackPool from './arranger/trackPool.js';
import * as sessionStore from './arranger/sessionStore.js';
import { positiveNumber } from '../utils/validators.js';
import { persistJobAudio, saveUserTrack } from './audioPersistor.js';
import { completeWithFallbackJob } from './fallbackEngine.js';
import {
  createJobFromComposed,
  getJob,
  getPlaybackTracks,
  getPlaybackUrl,
  masterTracks,
  mergeStemTracks,
  normalizeDurationSec,
  publicJob,
  saveJobToDB,
  userOwnsJobUrl,
} from './jobStore.js';

const POLL_INTERVAL_MS = positiveNumber(process.env.MUSIC_GENERATION_POLL_INTERVAL_MS, 4000);
const POLL_TIMEOUT_MS = positiveNumber(process.env.MUSIC_GENERATION_POLL_TIMEOUT_MS, 5 * 60 * 1000);
const GENERATION_FALLBACK_AFTER_MS = positiveNumber(
  process.env.MUSIC_GENERATION_FALLBACK_AFTER_MS,
  90_000
);

export const COST_PER_TRACK = 0.08;
export const HARD_DAILY_LIMIT = 10;
export const SOFT_HOURLY_LIMIT = 0.5;
export const PAUSE_BALANCE_THRESHOLD = 2;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    persistJobAudio(job, { emitJob: (event, currentJob, extra) => this.emitJob(event, currentJob, extra) }).catch(() => {});
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
    return completeWithFallbackJob(job, {
      delayMs,
      reason,
      emitJob: (event, currentJob, extra) => this.emitJob(event, currentJob, extra),
    });
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

export { getJob, getPlaybackTracks, getPlaybackUrl, userOwnsJobUrl };

export async function createMusicJob(params) {
  return generationPipeline.createMusicJob(params);
}

export async function refreshJob(jobId) {
  const job = await getJob(jobId);
  if (!job) return null;
  if (job.status === 'completed' || job.status === 'failed') return job;

  if (job.status === 'processing' && job.sunoTaskId && isSunoConfigured()) {
    generationPipeline.runJobToCompletion(job).catch((err) => {
      console.warn('[pipeline] refresh recovery failed:', err.message);
    });
    return job;
  }

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
