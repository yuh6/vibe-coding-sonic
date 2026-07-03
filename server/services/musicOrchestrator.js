import { v4 as uuidv4 } from 'uuid';
import { composePrompt } from './promptComposer.js';
import { isSunoConfigured, submitGeneration, pollGeneration } from './sunoClient.js';
import { pickTrack } from './libraryStore.js';

const jobs = new Map();

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
    job.fallback = true;
    job.fallbackTitle = track.title;
    job.completedAt = Date.now();
  };
  if (delayMs > 0) setTimeout(finish, delayMs);
  else finish();
}

export function createMusicJob({ mbti, axes, mode, projectAnalysis, style, forceFallback = false }) {
  const composed = composePrompt({ mbti, axes, mode, projectAnalysis, style });
  const jobId = uuidv4();
  const useSuno = isSunoConfigured() && !forceFallback;

  const job = {
    id: jobId,
    status: 'processing',
    ...composed,
    audioUrl: null,
    fallback: false,
    sunoTaskId: null,
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

  if (job.sunoTaskId && isSunoConfigured()) {
    try {
      const result = await pollGeneration(job.sunoTaskId);
      if (result.status === 'completed') {
        job.status = 'completed';
        job.audioUrl = result.audioUrl;
        job.fallback = false;
        job.completedAt = Date.now();
      }
    } catch (err) {
      console.warn('[music] TTAPI poll failed:', err.message);
      if (!job.audioUrl) {
        completeWithFallback(job);
      }
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
  };
}
