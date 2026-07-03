/**
 * TTAPI Suno client — Suno 无公开 API，统一经 TTAPI 代理。
 * Docs: https://docs.ttapi.io/api/en/suno
 */
import { resolveTtapiRuntime } from '../config/providers.js';

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|flac|ogg|opus)(\?|#|$)/i;
const MEDIA_REJECT_RE = /(image|video|thumbnail|cover|large|jpeg|jpg|png|webp|gif|mp4)/i;
const GENERIC_LABELS = new Set([
  'data',
  'result',
  'results',
  'output',
  'outputs',
  'audio',
  'audios',
  'file',
  'files',
  'url',
  'urls',
  'track',
  'tracks',
  'music',
  'musics',
  'stem',
  'stems',
]);

export function isSunoConfigured() {
  return Boolean(resolveTtapiRuntime());
}

function ttapiHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'TT-API-KEY': apiKey,
  };
}

function extractJobId(data) {
  return (
    data.data?.jobId ||
    data.data?.job_id ||
    data.jobId ||
    data.job_id
  );
}

function taskStatus(data) {
  return String(data.status || data.data?.status || '').toUpperCase();
}

function firstPresent(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function normalizeMusic(raw = {}) {
  const musicId = firstPresent(raw.musicId, raw.music_id, raw.id, raw.audioId, raw.audio_id);
  const audioUrl = firstPresent(raw.audioUrl, raw.audio_url, raw.sourceAudioUrl, raw.source_audio_url, raw.url);
  if (!audioUrl) return null;
  return {
    musicId,
    audioUrl,
    title: firstPresent(raw.title, raw.name, 'Master'),
    tags: firstPresent(raw.tags, raw.style),
    imageUrl: firstPresent(raw.imageUrl, raw.image_url, raw.imageLargeUrl, raw.image_large_url),
    videoUrl: firstPresent(raw.videoUrl, raw.video_url),
    duration: Number(firstPresent(raw.duration, raw.length)) || null,
    createdAt: firstPresent(raw.createdAt, raw.created_at),
    raw,
  };
}

function extractPrimaryMusic(data) {
  const musics = data.data?.musics || data.musics || data.data?.music || data.music;
  const raw = Array.isArray(musics) ? musics[0] : musics;
  return normalizeMusic(raw || data.data || data);
}

function isUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function looksLikeAudioUrl(value) {
  if (!isUrl(value)) return false;
  if (AUDIO_EXT_RE.test(value)) return true;
  return /cdn\d?\.suno\.ai|ttapi|audio|music/i.test(value) && !MEDIA_REJECT_RE.test(value);
}

function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeStemName(value) {
  if (!value) return '';
  const raw = String(value)
    .replace(/Url$|URL$|Audio$|audio$|Path$|path$/g, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!raw) return '';

  const key = raw.toLowerCase();
  if (GENERIC_LABELS.has(key)) return '';
  if (/master|original|source|full song|complete song/.test(key)) return 'Master';
  if (/vocal|voice|vox|singer/.test(key)) return 'Vocal';
  if (/instrumental|accompaniment|backing|no vocal/.test(key)) return 'Instrumental';
  if (/drum|percussion|beat/.test(key)) return 'Drums';
  if (/bass|sub/.test(key)) return 'Bass';
  if (/guitar/.test(key)) return 'Guitar';
  if (/piano|keyboard|keys/.test(key)) return 'Keys';
  if (/synth/.test(key)) return 'Synth';
  if (/string/.test(key)) return 'Strings';
  if (/melody|lead/.test(key)) return 'Melody';
  if (/chord|harmony|pad/.test(key)) return 'Chords';
  if (/other|misc/.test(key)) return 'Other';

  if (/^[a-z0-9 ]{2,40}$/i.test(raw)) return titleCase(raw);
  return '';
}

function shouldUseUrlField(key, label) {
  if (MEDIA_REJECT_RE.test(key)) return false;
  if (/audio|mp3|wav|stem|source|url/i.test(key) && label) return true;
  return key === 'url' && label;
}

export function extractStemTracks(raw) {
  const tracks = [];
  const seen = new Set();

  const add = (label, url) => {
    const name = normalizeStemName(label);
    if (!name || name === 'Master' || !looksLikeAudioUrl(url) || seen.has(url)) return;
    seen.add(url);
    tracks.push({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      name,
      type: 'stem',
      url,
    });
  };

  const visit = (node, contextLabel = '') => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, contextLabel));
      return;
    }
    if (typeof node !== 'object') return;

    const ownLabel = normalizeStemName(
      firstPresent(node.name, node.title, node.type, node.stem, node.stemName, node.stem_name, node.instrument)
    ) || contextLabel;

    for (const [key, value] of Object.entries(node)) {
      const keyLabel = normalizeStemName(key) || ownLabel;
      if (typeof value === 'string') {
        if (shouldUseUrlField(key, keyLabel) || (keyLabel && looksLikeAudioUrl(value))) add(keyLabel, value);
      } else if (value && typeof value === 'object') {
        visit(value, keyLabel);
      }
    }
  };

  visit(raw?.data || raw);
  return tracks;
}

async function fetchTask(taskId) {
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

  return res.json();
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

  const jobId = extractJobId(data);

  if (!jobId) {
    throw new Error(`TTAPI response missing jobId: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return { taskId: jobId, raw: data };
}

export async function submitStemSeparation({ musicId }) {
  const cfg = resolveTtapiRuntime();
  if (!cfg) {
    throw new Error('TTAPI_KEY not configured');
  }
  if (!musicId) {
    throw new Error('musicId is required for stem separation');
  }

  const url = `${cfg.baseUrl}${cfg.stemsAllPath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: ttapiHeaders(cfg.apiKey),
    body: JSON.stringify({
      music_id: musicId,
      isStorage: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`TTAPI stems-all failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.status && data.status !== 'SUCCESS' && data.status !== 'success') {
    throw new Error(data.message || data.error || 'TTAPI stems-all rejected');
  }

  const jobId = extractJobId(data);
  if (!jobId) {
    throw new Error(`TTAPI stems-all response missing jobId: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return { taskId: jobId, raw: data };
}

export async function pollGeneration(taskId) {
  const data = await fetchTask(taskId);
  const status = taskStatus(data);

  if (status === 'SUCCESS') {
    const music = extractPrimaryMusic(data);

    if (!music?.audioUrl) {
      throw new Error('TTAPI SUCCESS but no audioUrl in response');
    }
    return {
      status: 'completed',
      audioUrl: music.audioUrl,
      music,
      musicId: music.musicId,
      progress: data.data?.progress || data.progress || '100%',
      raw: data,
    };
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

export async function pollStemSeparation(taskId) {
  const data = await fetchTask(taskId);
  const status = taskStatus(data);

  if (status === 'SUCCESS') {
    return {
      status: 'completed',
      progress: data.data?.progress || data.progress || '100%',
      tracks: extractStemTracks(data),
      raw: data,
    };
  }

  if (status === 'FAILED' || status === 'ERROR') {
    throw new Error(data.message || data.data?.message || 'TTAPI stem separation failed');
  }

  return {
    status: 'processing',
    progress: data.data?.progress || data.progress,
    raw: data,
  };
}
