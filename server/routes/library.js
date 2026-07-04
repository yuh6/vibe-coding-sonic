import { Router } from 'express';
import { db } from '../db.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  getLibrary, addTrack, removeTrack,
  listSharedLibrary, getSharedLibraryStats,
} from '../services/libraryStore.js';

const router = Router();

// ── 原有兜底曲库（admin） ──

router.get('/', requireAdmin, (_req, res) => {
  res.json(getLibrary());
});

router.post('/', requireAdmin, (req, res) => {
  try {
    const { mode, title, url } = req.body || {};
    const track = addTrack({ mode, title, url });
    res.json(track);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:mode/:id', requireAdmin, (req, res) => {
  const removed = removeTrack(req.params.mode, req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Track not found' });
  }
  res.json({ ok: true });
});

// ── 歌曲总库（公开） ──

router.get('/shared', async (req, res) => {
  const { mode, mbti, genre, q, page = 1, limit = 20 } = req.query;
  const result = await listSharedLibrary({
    mode: mode || undefined,
    mbti: mbti?.toUpperCase() || undefined,
    genre: genre || undefined,
    q: q || undefined,
    page: Number(page),
    limit: Math.min(Number(limit) || 20, 100),
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

export default router;
