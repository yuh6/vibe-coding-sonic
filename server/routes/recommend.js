import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import { recordPlay, getUserHistory, getRecommendations, getPopularTracks } from '../services/recommendService.js';

const router = Router();

// 公开：热门歌曲
router.get('/popular', async (req, res) => {
  const { limit = 10 } = req.query;
  const tracks = await getPopularTracks(Math.min(Number(limit) || 10, 50));
  res.json({ tracks });
});

// 需登录：个性化推荐
router.get('/for-you', requireIdentity, async (req, res) => {
  const { limit = 10 } = req.query;
  const tracks = await getRecommendations(req.identity.id, { limit: Math.min(Number(limit) || 10, 50) });
  res.json({ tracks });
});

// 需登录：我的播放历史
router.get('/history', requireIdentity, async (req, res) => {
  const { page = 1, limit = 30 } = req.query;
  const result = await getUserHistory(req.identity.id, { page: Number(page), limit: Math.min(Number(limit) || 30, 100) });
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
