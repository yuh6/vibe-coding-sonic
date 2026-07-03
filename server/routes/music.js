import { Router } from 'express';
import { Readable } from 'stream';
import {
  createMusicJob,
  refreshJob,
  getFallbackTrack,
} from '../services/musicOrchestrator.js';
import { composePrompt } from '../services/promptComposer.js';
import { isSunoConfigured } from '../services/sunoClient.js';
import { requireUser } from '../middleware/userAuth.js';
import { createRateLimit } from '../middleware/rateLimit.js';
import { consumeQuota, getQuota, refundQuota, saveTrack } from '../services/quotaService.js';

const router = Router();
const paidGenerateLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(process.env.MUSIC_GENERATE_RATE_LIMIT || 10),
  keyPrefix: 'music-generate',
});

function limitPaidGeneration(req, res, next) {
  if (req.body?.previewOnly) return next();
  return paidGenerateLimit(req, res, next);
}

router.post('/generate', limitPaidGeneration, (req, res) => {
  try {
    const {
      mbti,
      axes,
      mode = 'Focus',
      projectAnalysis,
      style,
      previewOnly = false,
      forceFallback = false,
      splitStems = true,
    } = req.body || {};

    if (!mbti && !axes) {
      return res.status(400).json({ error: 'mbti or axes is required' });
    }

    // prompt 预览免费且公开
    if (previewOnly) {
      const composed = composePrompt({ mbti, axes, mode, projectAnalysis, style });
      return res.json({ preview: true, ...composed });
    }

    // 付费生成需要登录
    if (!req.user) {
      return res.status(401).json({ error: '请先登录后再生成音乐', code: 'UNAUTHORIZED' });
    }

    // 只有真实走 TTAPI 才消耗配额；兜底曲库不限量
    let useFallback = forceFallback;
    let quotaNotice = null;
    let quotaCharged = false;
    if (!useFallback && isSunoConfigured()) {
      const quota = consumeQuota(req.user.id);
      if (!quota.ok) {
        useFallback = true;
        quotaNotice = quota.error;
      } else {
        quotaCharged = true;
      }
    }

    const job = createMusicJob({
      mbti,
      axes,
      mode,
      projectAnalysis,
      style,
      forceFallback: useFallback,
      splitStems,
    });
    job.userId = req.user.id;
    job.quotaCharged = quotaCharged;

    res.json({
      jobId: job.id,
      status: job.status,
      fullPrompt: job.fullPrompt,
      layers: job.layers,
      bpm: job.bpm,
      mode: job.mode,
      mbti: job.mbti,
      profile: job.profile,
      splitStems: job.splitStems,
      quota: getQuota(req.user.id),
      quotaNotice,
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

    // 生成完成后归档到用户曲库（只存一次）
    if (job.status === 'completed' && job.userId && !job.savedToLibrary) {
      job.savedToLibrary = true;
      // TTAPI 生成失败落到兜底：退还这次配额
      if (job.fallback && job.quotaCharged) {
        job.quotaCharged = false;
        try {
          refundQuota(job.userId);
        } catch (err) {
          console.error('[music/status] refundQuota failed:', err.message);
        }
      }
      try {
        saveTrack({
          jobId: job.id,
          userId: job.userId,
          title: job.title || job.fallbackTitle || `${job.mbti} · ${job.mode}`,
          mbti: job.mbti,
          mode: job.mode,
          prompt: job.fullPrompt,
          audioUrl: job.audioUrl,
          tracks: job.tracks,
          fallback: job.fallback,
        });
      } catch (err) {
        console.error('[music/status] saveTrack failed:', err.message);
      }
    }

    res.json({
      jobId: job.id,
      status: job.status,
      audioUrl: job.audioUrl,
      musicId: job.musicId,
      title: job.title,
      duration: job.duration,
      tracks: job.tracks || [],
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

// 音频代理需登录：防止被当作公网开放代理滥用
router.get('/proxy', requireUser, async (req, res) => {
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

export default router;
