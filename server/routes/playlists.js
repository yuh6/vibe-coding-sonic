import { Router } from 'express';
import { requireUser } from '../middleware/userAuth.js';
import {
  createPlaylist, updatePlaylist, deletePlaylist, getPlaylist,
  listPublicPlaylists, addTrackToPlaylist, removeTrackFromPlaylist,
  recordPlaylistPlay, getUserPlaylists,
} from '../services/playlistService.js';

const router = Router();

// 公开：浏览公开播放列表
router.get('/', (req, res) => {
  const { sort = 'popular', page = 1, limit = 20 } = req.query;
  res.json(listPublicPlaylists({ sort, page: Number(page), limit: Math.min(Number(limit) || 20, 50) }));
});

// 公开：获取播放列表详情
router.get('/:id', (req, res) => {
  const pl = getPlaylist(req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  if (!pl.isPublic && pl.userId !== req.user?.id) return res.status(404).json({ error: 'Playlist not found' });
  res.json(pl);
});

// 公开：记录播放
router.post('/:id/play', (req, res) => {
  recordPlaylistPlay(req.params.id);
  res.json({ ok: true });
});

// 需登录：我的播放列表
router.get('/mine/list', requireUser, (req, res) => {
  res.json({ playlists: getUserPlaylists(req.user.id) });
});

// 需登录：创建
router.post('/', requireUser, (req, res) => {
  const { title, description } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const pl = createPlaylist(req.user.id, { title: title.trim(), description: description?.trim() || '' });
  res.status(201).json(pl);
});

// 需登录：编辑
router.put('/:id', requireUser, (req, res) => {
  const { title, description, isPublic } = req.body || {};
  const result = updatePlaylist(req.params.id, req.user.id, { title, description, isPublic });
  if (!result) return res.status(404).json({ error: 'Playlist not found or not owned' });
  res.json(result);
});

// 需登录：删除
router.delete('/:id', requireUser, (req, res) => {
  const ok = deletePlaylist(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'Playlist not found or not owned' });
  res.json({ ok: true });
});

// 需登录：添加曲目
router.post('/:id/tracks', requireUser, (req, res) => {
  const { trackId } = req.body || {};
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  const result = addTrackToPlaylist(req.params.id, req.user.id, trackId);
  if (!result) return res.status(404).json({ error: 'Playlist or track not found' });
  res.json(result);
});

// 需登录：移除曲目
router.delete('/:id/tracks/:trackId', requireUser, (req, res) => {
  const ok = removeTrackFromPlaylist(req.params.id, req.user.id, req.params.trackId);
  if (!ok) return res.status(404).json({ error: 'Not found or not owned' });
  res.json({ ok: true });
});

export default router;
