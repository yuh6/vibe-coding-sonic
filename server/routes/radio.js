import { Router } from 'express';
import { requireUser } from '../middleware/userAuth.js';
import {
  goLive, goOffline, updateStationInfo, getStation,
  listLiveStations, joinStation, leaveStation,
} from '../services/radioService.js';

const router = Router();

// 公开：浏览在线电台
router.get('/', (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  res.json(listLiveStations({ page: Number(page), limit: Math.min(Number(limit) || 20, 50) }));
});

// 公开：电台详情
router.get('/:id', (req, res) => {
  const station = getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
});

// 公开：加入收听
router.post('/:id/listen', (req, res) => {
  joinStation(req.params.id);
  const station = getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
});

// 公开：离开
router.post('/:id/leave', (req, res) => {
  leaveStation(req.params.id);
  res.json({ ok: true });
});

// 需登录：开始广播
router.post('/', requireUser, (req, res) => {
  const { title, description, sessionId, mode, mbti } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const station = goLive(req.user.id, {
    title: title.trim(), description: description?.trim(),
    sessionId, mode, mbti,
  });
  res.status(201).json(station);
});

// 需登录：更新电台
router.put('/:id', requireUser, (req, res) => {
  const { title, description, mode } = req.body || {};
  const ok = updateStationInfo(req.params.id, req.user.id, { title, description, mode });
  if (!ok) return res.status(404).json({ error: 'Station not found or not owned' });
  res.json(getStation(req.params.id));
});

// 需登录：下线电台
router.delete('/:id', requireUser, (req, res) => {
  const ok = goOffline(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Station not found or not owned' });
  res.json({ ok: true });
});

export default router;
