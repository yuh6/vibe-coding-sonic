import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import {
  addFavorite, removeFavorite, isFavorited, getUserFavorites,
  rateTrack, getUserRating, getTrackRatings,
} from '../services/favoriteService.js';
import { paginationFromQuery } from '../utils/pagination.js';

const router = Router();

// ── 收藏 ──

// 我的收藏列表
router.get('/', requireIdentity, async (req, res) => {
  const { page, limit } = paginationFromQuery(req.query, { defaultLimit: 20, maxLimit: 50 });
  const result = await getUserFavorites(req.identity.id, { page, limit });
  res.json(result);
});

// 收藏一首歌
router.post('/:trackId', requireIdentity, async (req, res) => {
  await addFavorite(req.identity.id, req.params.trackId);
  res.json({ ok: true, favorited: true });
});

// 取消收藏
router.delete('/:trackId', requireIdentity, async (req, res) => {
  await removeFavorite(req.identity.id, req.params.trackId);
  res.json({ ok: true, favorited: false });
});

// 检查是否已收藏
router.get('/:trackId/status', requireIdentity, async (req, res) => {
  const favorited = await isFavorited(req.identity.id, req.params.trackId);
  res.json({ favorited });
});

// ── 评分 ──

// 给歌曲评分 (1-5)
router.post('/:trackId/rate', requireIdentity, async (req, res) => {
  const { score } = req.body || {};
  const parsed = Number(score);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) return res.status(400).json({ error: 'score must be integer 1-5' });
  try {
    const result = await rateTrack(req.identity.id, req.params.trackId, parsed);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 获取我对某首歌的评分
router.get('/:trackId/my-rating', requireIdentity, async (req, res) => {
  const score = await getUserRating(req.identity.id, req.params.trackId);
  res.json({ score });
});

// 获取某首歌的全局评分（公开）
router.get('/:trackId/ratings', async (req, res) => {
  const ratings = await getTrackRatings(req.params.trackId);
  res.json(ratings);
});

export default router;
