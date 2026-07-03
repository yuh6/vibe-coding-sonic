import { Router } from 'express';
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

router.post('/generate', protectPaidGeneration, paidGenerateLimit, (req, res) => {
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

router.get('/fallback', (req, res) => {
  const mode = req.query.mode || 'Focus';
  const mbti = req.query.mbti || 'INTJ';
  const track = getFallbackTrack(mode, mbti);
  res.json(track);
});

export default router;
