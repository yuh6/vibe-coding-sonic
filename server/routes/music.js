import { Router } from 'express';
import { Readable } from 'stream';
import {
  createMusicJob,
  refreshJob,
  getFallbackTrack,
} from '../services/musicOrchestrator.js';
import { composePrompt } from '../services/promptComposer.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = Router();
const paidGenerateLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(process.env.MUSIC_GENERATE_RATE_LIMIT || 5),
  keyPrefix: 'music-generate',
});

function protectPaidGeneration(req, res, next) {
  if (req.body?.previewOnly) return next();
  return requireAdmin(req, res, next);
}

function limitPaidGeneration(req, res, next) {
  if (req.body?.previewOnly) return next();
  return paidGenerateLimit(req, res, next);
}

router.post('/generate', protectPaidGeneration, limitPaidGeneration, (req, res) => {
  try {
    const {
      mbti,
      axes,
      mode = 'Focus',
      projectAnalysis,
      style,
      previewOnly = false,
      forceFallback = false,
    } = req.body || {};

    if (!mbti && !axes) {
      return res.status(400).json({ error: 'mbti or axes is required' });
    }

    if (previewOnly) {
      const composed = composePrompt({ mbti, axes, mode, projectAnalysis, style });
      return res.json({ preview: true, ...composed });
    }

    const job = createMusicJob({ mbti, axes, mode, projectAnalysis, style, forceFallback });
    res.json({
      jobId: job.id,
      status: job.status,
      fullPrompt: job.fullPrompt,
      layers: job.layers,
      bpm: job.bpm,
      mode: job.mode,
      mbti: job.mbti,
      profile: job.profile,
    });
  } catch (err) {
    console.error('[music/generate]', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/status/:id', async (req, res) => {
  try {
    const job = await refreshJob(req.params.id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      audioUrl: job.audioUrl,
      fallback: job.fallback,
      fallbackTitle: job.fallbackTitle,
      fullPrompt: job.fullPrompt,
      layers: job.layers,
      bpm: job.bpm,
      mode: job.mode,
      mbti: job.mbti,
      profile: job.profile,
      error: job.error,
    });
  } catch (err) {
    console.error('[music/status]', err);
    res.status(500).json({ error: err.message });
  }
});

// 音频代理：调音台需要用 fetch 拿到原始音频数据做 Web Audio 解码，
// 远程音源（TTAPI CDN / soundhelix 等）没有 CORS 头，统一走这里中转
router.get('/proxy', async (req, res) => {
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

  try {
    const upstream = await fetch(parsed, { redirect: 'follow' });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `upstream ${upstream.status}` });
    }
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    const len = upstream.headers.get('content-length');
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (err) {
    console.error('[music/proxy]', err);
    res.status(502).json({ error: err.message });
  }
});

router.get('/fallback', (req, res) => {
  const mode = req.query.mode || 'Focus';
  const mbti = req.query.mbti || 'INTJ';
  const track = getFallbackTrack(mode, mbti);
  res.json(track);
});

export default router;
