import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import { recordPlay, getUserHistory, getRecommendations, getPopularTracks } from '../services/recommendService.js';
import { clampInt, paginationFromQuery } from '../utils/pagination.js';

const router = Router();

// 公开：热门歌曲
router.get('/popular', async (req, res) => {
  const limit = clampInt(req.query.limit, { defaultValue: 10, min: 1, max: 50 });
  const tracks = await getPopularTracks(limit);
  res.json({ tracks });
});

// 需登录：个性化推荐
router.get('/for-you', requireIdentity, async (req, res) => {
  const limit = clampInt(req.query.limit, { defaultValue: 10, min: 1, max: 50 });
  const tracks = await getRecommendations(req.identity.id, { limit });
  res.json({ tracks });
});

// 需登录：我的播放历史
router.get('/history', requireIdentity, async (req, res) => {
  const { page, limit } = paginationFromQuery(req.query, { defaultLimit: 30, maxLimit: 100 });
  const result = await getUserHistory(req.identity.id, { page, limit });
  res.json(result);
});

// 需登录：记录播放
router.post('/play', requireIdentity, async (req, res) => {
  const { trackId, durationSec, completed } = req.body || {};
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  await recordPlay({ userId: req.identity.id, trackId, durationSec, completed });
  res.json({ ok: true });
});

export default router;
