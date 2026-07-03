/**
 * TTAPI Suno client — Suno 无公开 API，统一经 TTAPI 代理。
 * Docs: https://docs.ttapi.io/api/en/suno
 */
import { resolveTtapiRuntime } from '../config/providers.js';

export function isSunoConfigured() {
  return Boolean(resolveTtapiRuntime());
}

function ttapiHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'TT-API-KEY': apiKey,
  };
}

export async function submitGeneration({ prompt, title = 'Vibe Coding BGM', tags = '' }) {
  const cfg = resolveTtapiRuntime();
  if (!cfg) {
    throw new Error('TTAPI_KEY not configured');
  }

  const url = `${cfg.baseUrl}${cfg.musicPath}`;
  const body = {
    custom: false,
    instrumental: true,
    mv: cfg.modelVersion,
    title,
    tags: tags || prompt.slice(0, 200),
    prompt,
    negative_tags: 'vocals, lyrics, speech, singing',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: ttapiHeaders(cfg.apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TTAPI submit failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status && data.status !== 'SUCCESS' && data.status !== 'success') {
    throw new Error(data.message || data.error || 'TTAPI submit rejected');
  }

  const jobId =
    data.data?.jobId ||
    data.data?.job_id ||
    data.jobId ||
    data.job_id;

  if (!jobId) {
    throw new Error(`TTAPI response missing jobId: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return { taskId: jobId, raw: data };
}

export async function pollGeneration(taskId) {
  const cfg = resolveTtapiRuntime();
  if (!cfg) {
    throw new Error('TTAPI_KEY not configured');
  }

  const url = `${cfg.baseUrl}${cfg.fetchPath}?jobId=${encodeURIComponent(taskId)}`;
  const res = await fetch(url, {
    headers: ttapiHeaders(cfg.apiKey),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TTAPI poll failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const status = (data.status || data.data?.status || '').toUpperCase();

  if (status === 'SUCCESS') {
    const musics = data.data?.musics || data.musics || [];
    const audioUrl =
      musics[0]?.audioUrl ||
      musics[0]?.audio_url ||
      data.data?.audioUrl ||
      data.audioUrl;

    if (!audioUrl) {
      throw new Error('TTAPI SUCCESS but no audioUrl in response');
    }
    return { status: 'completed', audioUrl, raw: data };
  }

  if (status === 'FAILED' || status === 'ERROR') {
    throw new Error(data.message || data.data?.message || 'TTAPI generation failed');
  }

  // ON_QUEUE, PROCESSING, etc.
  return {
    status: 'processing',
    progress: data.data?.progress || data.progress,
    raw: data,
  };
}
