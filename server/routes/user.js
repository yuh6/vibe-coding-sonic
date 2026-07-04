import { Router } from 'express';
import { requireUser } from '../middleware/userAuth.js';
import { getProfile, saveProfile, listTracks } from '../services/quotaService.js';

const router = Router();
router.use(requireUser);

router.get('/profile', async (req, res) => {
  res.json({ profile: await getProfile(req.user.id) });
});

router.put('/profile', async (req, res) => {
  const { axes, style, mode } = req.body || {};
  await saveProfile(req.user.id, { axes, style, mode });
  res.json({ ok: true });
});

router.get('/tracks', async (req, res) => {
  res.json({ tracks: await listTracks(req.user.id) });
});

export default router;
