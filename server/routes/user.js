import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import { getProfile, saveProfile, listTracks } from '../services/quotaService.js';

const router = Router();
router.use(requireIdentity);

router.get('/profile', async (req, res) => {
  res.json({ profile: await getProfile(req.identity.id) });
});

router.put('/profile', async (req, res) => {
  const { axes, style, mode } = req.body || {};
  await saveProfile(req.identity.id, { axes, style, mode });
  res.json({ ok: true });
});

router.get('/tracks', async (req, res) => {
  res.json({ tracks: await listTracks(req.identity.id) });
});

export default router;
