import { Router } from 'express';
import { getLibrary, addTrack, removeTrack } from '../services/libraryStore.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(getLibrary());
});

router.post('/', (req, res) => {
  try {
    const { mode, title, url } = req.body || {};
    const track = addTrack({ mode, title, url });
    res.json(track);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:mode/:id', (req, res) => {
  const removed = removeTrack(req.params.mode, req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Track not found' });
  }
  res.json({ ok: true });
});

export default router;
