import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import { requireIdentity } from '../middleware/userAuth.js';
import {
  getLibrary, addTrack, removeTrack,
  listSharedLibrary, getSharedLibraryStats,
} from '../services/libraryStore.js';
import { recordPlay, getUserHistory, getRecommendations, getPopularTracks } from '../services/recommendService.js';
import { clampInt, paginationFromQuery } from '../utils/pagination.js';

const router = Router();

// ── 原有兜底曲库（admin） ──

router.get('/', requireAdmin, (_req, res) => {
  res.json(getLibrary());
});

router.post('/', requireAdmin, async (req, res) => {
  try {
    const { mode, title, url, mbti } = req.body || {};
    const track = await addTrack({ mode, title, url, mbti });
    res.json(track);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:mode/:id', requireAdmin, async (req, res) => {
  try {
    const removed = await removeTrack(req.params.mode, req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Track not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ── 歌曲总库（公开） ──

router.get('/shared', async (req, res) => {
  const { mode, mbti, genre, q } = req.query;
  const { page, limit } = paginationFromQuery(req.query, { defaultLimit: 20, maxLimit: 100 });
  const result = await listSharedLibrary({
    mode: mode || undefined,
    mbti: (typeof mbti === 'string' ? mbti : '')?.toUpperCase() || undefined,
    genre: genre || undefined,
    q: q || undefined,
    page,
    limit,
  });
  res.json(result);
});

router.get('/shared/stats', async (_req, res) => {
  res.json(await getSharedLibraryStats());
});

router.get('/shared/:id', async (req, res) => {
  const row = await db.prepare('SELECT * FROM shared_library WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Track not found' });
  res.json({
    id: row.id, title: row.title, mbti: row.mbti, mode: row.mode,
    genre: row.genre, tags: row.tags, bpm: row.bpm,
    audioUrl: row.audio_local || row.audio_url,
    playCount: row.play_count || 0, createdAt: row.created_at,
  });
});

router.post('/shared/:id/play', async (req, res) => {
  const result = await db.prepare(
    'UPDATE shared_library SET play_count = play_count + 1 WHERE id = ?'
  ).run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Track not found' });
  res.json({ ok: true });
});

// ── 推荐与播放历史 ──

router.get('/recommend/popular', async (req, res) => {
  const limit = clampInt(req.query.limit, { defaultValue: 10, min: 1, max: 50 });
  const tracks = await getPopularTracks(limit);
  res.json({ tracks });
});

router.get('/recommend/for-you', requireIdentity, async (req, res) => {
  const limit = clampInt(req.query.limit, { defaultValue: 10, min: 1, max: 50 });
  const tracks = await getRecommendations(req.identity.id, { limit });
  res.json({ tracks });
});

router.get('/recommend/history', requireIdentity, async (req, res) => {
  const { page, limit } = paginationFromQuery(req.query, { defaultLimit: 30, maxLimit: 100 });
  const result = await getUserHistory(req.identity.id, { page, limit });
  res.json(result);
});

router.post('/recommend/play', requireIdentity, async (req, res) => {
  const { trackId, durationSec, completed } = req.body || {};
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  await recordPlay({ userId: req.identity.id, trackId, durationSec, completed });
  res.json({ ok: true });
});

export default router;
