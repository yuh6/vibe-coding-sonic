import { v4 as uuidv4 } from 'uuid';
import { composePrompt } from './promptComposer.js';
import {
  isSunoConfigured,
  submitGeneration,
  pollGeneration,
  submitStemSeparation,
  pollStemSeparation,
} from './sunoClient.js';
import { pickTrack } from './libraryStore.js';

const jobs = new Map();

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

function applyGeneratedMusic(job, result) {
  const music = result.music || {};
  job.status = 'splitting';
  job.audioUrl = result.audioUrl;
  job.musicId = result.musicId || music.musicId || null;
  job.title = music.title || job.title;
  job.duration = music.duration || job.duration || null;
  job.imageUrl = music.imageUrl || null;
  job.videoUrl = music.videoUrl || null;
  job.generationProgress = result.progress || '100%';
  job.tracks = masterTracks({ url: result.audioUrl, title: music.title || 'Master' });
}

async function startStemSeparation(job) {
  if (!job.splitStems || !job.musicId || job.fallback) {
    job.status = 'completed';
    job.completedAt = Date.now();
    return;
  }

  try {
    const stemJob = await submitStemSeparation({ musicId: job.musicId });
    job.stemTaskId = stemJob.taskId;
    job.stemStatus = 'processing';
    job.stemProgress = null;
    job.status = 'splitting';
  } catch (err) {
    job.stemStatus = 'failed';
    job.stemError = err.message;
    job.status = 'completed';
    job.completedAt = Date.now();
  }
}

function completeWithFallback(job, delayMs = 0) {
  const finish = () => {
    const track = pickTrack(job.mode, job.mbti);
    if (!track) {
      job.status = 'failed';
      job.error = 'No fallback track available';
      return;
    }
    job.status = 'completed';
    job.audioUrl = track.url;
    job.tracks = masterTracks({ url: track.url, title: track.title });
    job.fallback = true;
    job.fallbackTitle = track.title;
    job.completedAt = Date.now();
  };
  if (delayMs > 0) setTimeout(finish, delayMs);
  else finish();
}

export function createMusicJob({
  mbti,
  axes,
  mode,
  projectAnalysis,
  style,
  forceFallback = false,
  splitStems = true,
}) {
  const composed = composePrompt({ mbti, axes, mode, projectAnalysis, style });
  const jobId = uuidv4();
  const useSuno = isSunoConfigured() && !forceFallback;

  const job = {
    id: jobId,
    status: 'processing',
    ...composed,
    audioUrl: null,
    tracks: [],
    fallback: false,
    sunoTaskId: null,
    musicId: null,
    splitStems: Boolean(splitStems),
    stemTaskId: null,
    stemStatus: 'idle',
    stemProgress: null,
    stemError: null,
    error: null,
    createdAt: Date.now(),
  };

  jobs.set(jobId, job);

  if (useSuno) {
    submitGeneration({
      prompt: composed.fullPrompt,
      title: `${composed.mbti}-${composed.mode}`,
      tags: composed.layers?.mbti || '',
    })
      .then(({ taskId }) => {
        job.sunoTaskId = taskId;
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

export function getJob(jobId) {
  return jobs.get(jobId) || null;
}

export async function refreshJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;

  if (job.status === 'completed' || job.status === 'failed') {
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
      if (!job.audioUrl) {
        completeWithFallback(job);
      }
    }
  }

  if (job.status === 'splitting' && job.stemTaskId && isSunoConfigured()) {
    try {
      const result = await pollStemSeparation(job.stemTaskId);
      if (result.status === 'completed') {
        mergeStemTracks(job, result.tracks);
        job.stemStatus = result.tracks?.length ? 'completed' : 'completed-empty';
        job.stemProgress = result.progress || '100%';
        job.status = 'completed';
        job.completedAt = Date.now();
      } else {
        job.stemProgress = result.progress || job.stemProgress;
      }
    } catch (err) {
      console.warn('[music] TTAPI stems poll failed:', err.message);
      job.stemStatus = 'failed';
      job.stemError = err.message;
      job.status = 'completed';
      job.completedAt = Date.now();
    }
  }

  return job;
}

export function getFallbackTrack(mode, mbti, extras = {}) {
  const track = pickTrack(mode, mbti);
  const composed = composePrompt({
    mbti: mbti || 'INTJ',
    mode,
    projectAnalysis: null,
    ...extras,
  });
  return {
    ...(track || {}),
    mode,
    ...composed,
    status: 'completed',
    fallback: true,
    audioUrl: track?.url,
    tracks: track?.url ? masterTracks({ url: track.url, title: track.title }) : [],
  };
}
