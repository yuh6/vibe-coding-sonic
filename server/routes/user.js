import { Router } from 'express';
import { requireIdentity, requireUser } from '../middleware/userAuth.js';
import { getProfile, saveProfile, listTracks } from '../services/quotaService.js';
import { changeUserPassword, updateUserName } from '../services/authService.js';
import { getCredits, recentCreditTransactions, redeemCode } from '../services/creditService.js';

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

router.get('/account', requireUser, async (req, res) => {
  res.json({
    user: req.identity,
    credits: await getCredits(req.identity),
    transactions: await recentCreditTransactions(req.identity.id, { limit: Number(req.query.limit) || 20 }),
  });
});

router.patch('/account', requireUser, async (req, res) => {
  try {
    const user = await updateUserName(req.identity.id, req.body?.name);
    res.json({ user, credits: await getCredits(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/password', requireUser, async (req, res) => {
  try {
    await changeUserPassword(req.identity.id, {
      currentPassword: req.body?.currentPassword,
      nextPassword: req.body?.nextPassword,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/redeem', requireUser, async (req, res) => {
  try {
    res.json(await redeemCode(req.identity, req.body?.code));
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message, code: err.code });
  }
});

router.get('/tracks', async (req, res) => {
  res.json({ tracks: await listTracks(req.identity.id) });
});

export default router;
