import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import {
  createPlaylist, updatePlaylist, deletePlaylist, getPlaylist,
  listPublicPlaylists, addTrackToPlaylist, removeTrackFromPlaylist,
  recordPlaylistPlay, getUserPlaylists,
} from '../services/playlistService.js';
import { paginationFromQuery } from '../utils/pagination.js';

const router = Router();

// 公开：浏览公开播放列表
router.get('/', async (req, res) => {
  const { sort = 'popular' } = req.query;
  res.json(await listPublicPlaylists({
    sort,
    ...paginationFromQuery(req.query, { defaultLimit: 20, maxLimit: 50 }),
  }));
});

// 需登录：我的播放列表
router.get('/mine/list', requireIdentity, async (req, res) => {
  res.json({ playlists: await getUserPlaylists(req.identity.id) });
});

// 公开：获取播放列表详情
router.get('/:id', async (req, res) => {
  const pl = await getPlaylist(req.params.id);
  if (!pl) return res.status(404).json({ error: 'Playlist not found' });
  if (!pl.isPublic && pl.userId !== req.identity?.id) return res.status(404).json({ error: 'Playlist not found' });
  res.json(pl);
});

// 公开：记录播放
router.post('/:id/play', async (req, res) => {
  await recordPlaylistPlay(req.params.id);
  res.json({ ok: true });
});

// 需登录：创建
router.post('/', requireIdentity, async (req, res) => {
  const { title, description } = req.body || {};
  if (!title?.trim()) return res.status(400).json({ error: 'title is required' });
  const pl = await createPlaylist(req.identity.id, { title: title.trim(), description: description?.trim() || '' });
  res.status(201).json(pl);
});

// 需登录：编辑
router.put('/:id', requireIdentity, async (req, res) => {
  const { title, description, isPublic } = req.body || {};
  const result = await updatePlaylist(req.params.id, req.identity.id, { title, description, isPublic });
  if (!result) return res.status(404).json({ error: 'Playlist not found or not owned' });
  res.json(result);
});

// 需登录：删除
router.delete('/:id', requireIdentity, async (req, res) => {
  const ok = await deletePlaylist(req.params.id, req.identity.id);
  if (!ok) return res.status(404).json({ error: 'Playlist not found or not owned' });
  res.json({ ok: true });
});

// 需登录：添加曲目
router.post('/:id/tracks', requireIdentity, async (req, res) => {
  const { trackId } = req.body || {};
  if (!trackId) return res.status(400).json({ error: 'trackId is required' });
  const result = await addTrackToPlaylist(req.params.id, req.identity.id, trackId);
  if (!result) return res.status(404).json({ error: 'Playlist or track not found' });
  res.json(result);
});

// 需登录：移除曲目
router.delete('/:id/tracks/:trackId', requireIdentity, async (req, res) => {
  const ok = await removeTrackFromPlaylist(req.params.id, req.identity.id, req.params.trackId);
  if (!ok) return res.status(404).json({ error: 'Not found or not owned' });
  res.json({ ok: true });
});

export default router;
