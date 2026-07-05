import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import {
  goLive, goOffline, updateStationInfo, getStation,
  listLiveStations, joinStation, leaveStation,
  updateNowPlayingSnapshot,
} from '../services/radioService.js';

const router = Router();

// 公开：浏览在线电台
router.get('/', async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  res.json(await listLiveStations({ page: Number(page), limit: Math.min(Number(limit) || 20, 50) }));
});

// 公开：电台详情
router.get('/:id', async (req, res) => {
  const station = await getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
});

// 公开：加入收听
router.post('/:id/listen', async (req, res) => {
  await joinStation(req.params.id);
  const station = await getStation(req.params.id);
  if (!station) return res.status(404).json({ error: 'Station not found' });
  res.json(station);
});

// 公开：离开
router.post('/:id/leave', async (req, res) => {
  await leaveStation(req.params.id);
  res.json({ ok: true });
});

// 需登录：开始广播
router.post('/', requireIdentity, async (req, res) => {
  const { title, description, sessionId, mode, mbti } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const station = await goLive(req.identity.id, {
    title: title.trim(), description: description?.trim(),
    sessionId, mode, mbti,
  });
  res.status(201).json(station);
});

// 需登录：更新电台
router.put('/:id', requireIdentity, async (req, res) => {
  const { title, description, mode } = req.body || {};
  const ok = await updateStationInfo(req.params.id, req.identity.id, { title, description, mode });
  if (!ok) return res.status(404).json({ error: 'Station not found or not owned' });
  res.json(await getStation(req.params.id));
});

// 需登录：更新电台正在播放 snapshot
router.patch('/:id/now-playing', requireIdentity, async (req, res) => {
  const ok = await updateNowPlayingSnapshot(req.params.id, req.identity.id, req.body?.track);
  if (!ok) return res.status(404).json({ error: 'Station not found, offline, or track has no audioUrl' });
  res.json(await getStation(req.params.id));
});

// 需登录：下线电台
router.delete('/:id', requireIdentity, async (req, res) => {
  const ok = await goOffline(req.params.id, req.identity.id);
  if (!ok) return res.status(404).json({ error: 'Station not found or not owned' });
  res.json({ ok: true });
});

export default router;
