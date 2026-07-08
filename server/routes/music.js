import { Router } from 'express';
import { lookup } from 'dns/promises';
import { once } from 'events';
import { isIP } from 'net';
import { Readable } from 'stream';
import {
  createMusicJob,
  refreshJob,
  getFallbackTrack,
  getJob,
  userOwnsJobUrl,
  getPlaybackUrl,
  getPlaybackTracks,
  generationPipeline,
} from '../services/generationPipeline.js';
import { composePrompt } from '../services/promptComposer.js';
import { generateLyrics } from '../services/lyricsGenerator.js';
import { requireIdentity } from '../middleware/userAuth.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { libraryHasTrackUrl } from '../services/libraryStore.js';
import {
  saveTrack,
  userOwnsTrackUrl,
} from '../services/quotaService.js';
import { getCredits } from '../services/creditService.js';
import { positiveNumber, parseCsv } from '../utils/validators.js';

const router = Router();
const AUDIO_PROXY_MAX_BYTES = positiveNumber(process.env.AUDIO_PROXY_MAX_BYTES, 50 * 1024 * 1024);
const AUDIO_PROXY_TIMEOUT_MS = positiveNumber(process.env.AUDIO_PROXY_TIMEOUT_MS, 15_000);
const DEFAULT_AUDIO_PROXY_ALLOWED_HOSTS = ['soundhelix.com', 'www.soundhelix.com'];
const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|flac|ogg|opus)(\?|#|$)/i;
const paidGenerateLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(process.env.MUSIC_GENERATE_RATE_LIMIT || 10),
  keyPrefix: 'music-generate',
});
const lyricsLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(process.env.LYRICS_RATE_LIMIT || 10),
  keyPrefix: 'lyrics-generate',
});

function parseAllowedHosts(value = process.env.AUDIO_PROXY_ALLOWED_HOSTS || '') {
  const configured = parseCsv(value).map((host) => host.toLowerCase());
  return [...new Set([...DEFAULT_AUDIO_PROXY_ALLOWED_HOSTS, ...configured])];
}

function hostMatches(pattern, hostname) {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(1);
    return hostname.endsWith(suffix) && hostname.length > suffix.length;
  }
  return hostname === pattern;
}

function isAllowedConfiguredHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return parseAllowedHosts().some((pattern) => hostMatches(pattern, normalized));
}

function isPrivateIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address) {
  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

function isPrivateAddress(address) {
  const family = isIP(address);
  if (family === 4) return isPrivateIpv4(address);
  if (family === 6) return isPrivateIpv6(address);
  return true;
}

async function assertPublicNetworkTarget(url) {
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (isAllowedConfiguredHost(hostname)) return;

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw Object.assign(new Error('private network targets are not allowed'), { status: 400 });
  }

  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) {
    throw Object.assign(new Error('private network targets are not allowed'), { status: 400 });
  }
}

async function isAuthorizedProxyUrl(userId, url) {
  return (
    userOwnsJobUrl(userId, url) ||
    await userOwnsTrackUrl(userId, url) ||
    await libraryHasTrackUrl(url) ||
    isAllowedConfiguredHost(new URL(url).hostname)
  );
}

function looksLikeAudioResponse(upstream, url) {
  const contentType = upstream.headers.get('content-type') || '';
  return (
    contentType.startsWith('audio/') ||
    contentType === 'application/octet-stream' ||
    contentType === 'binary/octet-stream' ||
    AUDIO_EXT_RE.test(url)
  );
}

async function fetchWithCheckedRedirects(url, redirectsLeft = 3) {
  await assertPublicNetworkTarget(url);

  const upstream = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(AUDIO_PROXY_TIMEOUT_MS),
  });

  if (upstream.status >= 300 && upstream.status < 400 && upstream.headers.get('location')) {
    if (redirectsLeft <= 0) {
      throw Object.assign(new Error('too many redirects'), { status: 400 });
    }
    const nextUrl = new URL(upstream.headers.get('location'), url);
    if (!['http:', 'https:'].includes(nextUrl.protocol)) {
      throw Object.assign(new Error('only http/https redirects allowed'), { status: 400 });
    }
    return fetchWithCheckedRedirects(nextUrl, redirectsLeft - 1);
  }

  return upstream;
}

async function pipeWithLimit(upstream, res) {
  let bytes = 0;
  for await (const chunk of Readable.fromWeb(upstream.body)) {
    bytes += chunk.length;
    if (bytes > AUDIO_PROXY_MAX_BYTES) {
      res.destroy(new Error('audio proxy response too large'));
      return;
    }
    if (!res.write(chunk)) {
      await once(res, 'drain');
    }
  }
  res.end();
}

function limitPaidGeneration(req, res, next) {
  if (req.body?.previewOnly) return next();
  return paidGenerateLimit(req, res, next);
}

function requireGenerateUser(req, res, next) {
  if (req.body?.previewOnly) return next();
  return requireIdentity(req, res, next);
}

const PIPELINE_EVENTS = [
  'generation:status',
  'generation:progress',
  'generation:completed',
  'generation:failed',
  'stem:status',
  'stem:completed',
  'stem:failed',
];

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

router.post('/generate', requireGenerateUser, limitPaidGeneration, async (req, res) => {
  try {
    const {
      mbti,
      axes,
      mode = 'focus',
      projectAnalysis,
      style,
      selectedGenre,
      notes,
      vocals,
      previewOnly = false,
      forceFallback = false,
      splitStems = true,
    } = req.body || {};

    if (!mbti && !axes) {
      return res.status(400).json({ error: 'mbti or axes is required' });
    }

    // prompt 预览免费且公开
    if (previewOnly) {
      const composed = composePrompt({ mbti, axes, mode, projectAnalysis, style, selectedGenre, notes, vocals });
      return res.json({ preview: true, ...composed });
    }

    const job = await createMusicJob({
      userId: req.identity.id,
      user: req.identity,
      mbti,
      axes,
      mode,
      projectAnalysis,
      style,
      selectedGenre,
      notes,
      vocals,
      forceFallback,
      splitStems,
    });

    res.json({
      jobId: job.id,
      status: job.status,
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
      splitStems: job.splitStems,
      streamUrl: `/api/music/stream/${job.id}`,
      credits: job.credits || await getCredits(req.identity),
      creditNotice: job.creditNotice || null,
    });
  } catch (err) {
    console.error('[music/generate]', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/lyrics/generate', requireIdentity, lyricsLimit, async (req, res) => {
  const { mbtiType, mode, projectAnalysis, notes, language } = req.body || {};
  try {
    const result = await generateLyrics({ mbtiType, mode, projectAnalysis, notes, language });
    if (!result) {
      return res.status(503).json({ error: 'LLM 未配置，无法生成歌词' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stream/:jobId', requireIdentity, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await getJob(jobId);
    if (!job || job.userId !== req.identity.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    writeSse(res, 'generation:status', {
      jobId: job.id,
      status: job.status,
      audioUrl: getPlaybackUrl(job),
      tracks: getPlaybackTracks(job),
      generationProgress: job.generationProgress,
      stemStatus: job.stemStatus,
      splitStems: job.splitStems,
      fallback: job.fallback,
    });

    const listeners = PIPELINE_EVENTS.map((event) => {
      const listener = (payload) => {
        if (payload?.jobId !== jobId && payload?.id !== jobId) return;
        writeSse(res, event, payload);
      };
      generationPipeline.on(event, listener);
      return [event, listener];
    });

    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 25_000);
    heartbeat.unref?.();

    req.on('close', () => {
      clearInterval(heartbeat);
      for (const [event, listener] of listeners) {
        generationPipeline.off(event, listener);
      }
    });
  } catch (err) {
    console.error('[music/stream]', err);
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

router.get('/status/:id', requireIdentity, async (req, res) => {
  try {
    const job = await refreshJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (job.userId !== req.identity.id) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // 生成完成后归档到用户曲库（只存一次）
    if (job.status === 'completed' && job.userId && !job.savedToLibrary) {
      job.savedToLibrary = true;
      try {
        const playbackUrl = getPlaybackUrl(job);
        const playbackTracks = getPlaybackTracks(job);
        await saveTrack({
          jobId: job.id,
          userId: job.userId,
          title: job.title || job.fallbackTitle || `${job.mbti} · ${job.mode}`,
          mbti: job.mbti,
          mode: job.mode,
          prompt: job.fullPrompt,
          audioUrl: playbackUrl,
          tracks: playbackTracks,
          fallback: job.fallback,
        });
      } catch (err) {
        console.error('[music/status] saveTrack failed:', err.message);
      }
    }

    res.json({
      jobId: job.id,
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
      splitStems: job.splitStems,
      error: job.error,
      credits: await getCredits(req.identity),
    });
  } catch (err) {
    console.error('[music/status]', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/fallback', async (req, res) => {
  try {
    const mode = req.query.mode || 'focus';
    const mbti = req.query.mbti || 'INTJ';
    const track = await getFallbackTrack(mode, mbti);
    res.json(track);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 音频代理需登录：防止被当作公网开放代理滥用
router.get('/proxy', requireIdentity, async (req, res) => {
  const { url } = req.query;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return res.status(400).json({ error: 'invalid url' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.status(400).json({ error: 'only http/https allowed' });
  }
  if (!(await isAuthorizedProxyUrl(req.identity.id, parsed.href))) {
    return res.status(403).json({ error: 'audio url is not available for this user' });
  }

  try {
    const upstream = await fetchWithCheckedRedirects(parsed);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
    }
    if (!looksLikeAudioResponse(upstream, parsed.href)) {
      upstream.body?.cancel?.();
      return res.status(415).json({ error: 'upstream is not audio' });
    }
    const len = Number(upstream.headers.get('content-length') || 0);
    if (len > AUDIO_PROXY_MAX_BYTES) {
      upstream.body?.cancel?.();
      return res.status(413).json({ error: 'audio file too large' });
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    if (len) res.setHeader('Content-Length', String(len));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    await pipeWithLimit(upstream, res);
  } catch (err) {
    console.error('[music/proxy]', err);
    if (!res.headersSent) {
      res.status(err.status || 502).json({ error: err.message });
    }
  }
});

export default router;
