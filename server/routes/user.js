import { Router } from 'express';
import { requireUser } from '../middleware/userAuth.js';
import { getProfile, saveProfile, listTracks } from '../services/quotaService.js';

const router = Router();
router.use(requireUser);

router.get('/profile', (req, res) => {
  res.json({ profile: getProfile(req.user.id) });
});

router.put('/profile', (req, res) => {
  const { axes, style, mode } = req.body || {};
  saveProfile(req.user.id, { axes, style, mode });
  res.json({ ok: true });
});

router.get('/tracks', (req, res) => {
  res.json({ tracks: listTracks(req.user.id) });
});

export default router;
