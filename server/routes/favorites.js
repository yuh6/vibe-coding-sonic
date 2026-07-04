import { Router } from 'express';
import { requireUser } from '../middleware/userAuth.js';
import {
  addFavorite, removeFavorite, isFavorited, getUserFavorites,
  rateTrack, getUserRating, getTrackRatings,
} from '../services/favoriteService.js';

const router = Router();

// ── 收藏 ──

// 我的收藏列表
router.get('/', requireUser, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const result = await getUserFavorites(req.user.id, { page: Number(page), limit: Math.min(Number(limit) || 20, 50) });
  res.json(result);
});

// 收藏一首歌
router.post('/:trackId', requireUser, async (req, res) => {
  await addFavorite(req.user.id, req.params.trackId);
  res.json({ ok: true, favorited: true });
});

// 取消收藏
router.delete('/:trackId', requireUser, async (req, res) => {
  await removeFavorite(req.user.id, req.params.trackId);
  res.json({ ok: true, favorited: false });
});

// 检查是否已收藏
router.get('/:trackId/status', requireUser, async (req, res) => {
  const favorited = await isFavorited(req.user.id, req.params.trackId);
  res.json({ favorited });
});

// ── 评分 ──

// 给歌曲评分 (1-5)
router.post('/:trackId/rate', requireUser, async (req, res) => {
  const { score } = req.body || {};
  if (!score || score < 1 || score > 5) return res.status(400).json({ error: 'score must be 1-5' });
  try {
    const result = await rateTrack(req.user.id, req.params.trackId, score);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 获取我对某首歌的评分
router.get('/:trackId/my-rating', requireUser, async (req, res) => {
  const score = await getUserRating(req.user.id, req.params.trackId);
  res.json({ score });
});

// 获取某首歌的全局评分（公开）
router.get('/:trackId/ratings', async (req, res) => {
  const ratings = await getTrackRatings(req.params.trackId);
  res.json(ratings);
});

export default router;
