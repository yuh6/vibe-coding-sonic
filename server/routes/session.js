/**
 * /api/session/* — docs/ai-music-engine-design.md §11
 * 创建/更新黑客松会话（Arranger 引擎的运行单元）。
 */
import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import { createSession, getSession, updateSchedule } from '../services/arranger/sessionStore.js';

const router = Router();

function sanitizeMbtiSliders(sliders) {
  if (!sliders || typeof sliders !== 'object') return null;
  const out = {};
  for (const key of ['ie', 'ns', 'tf', 'jp']) {
    const value = Number(sliders[key]);
    if (Number.isFinite(value)) out[key] = Math.max(0, Math.min(100, value));
  }
  return Object.keys(out).length ? out : null;
}

function ownsSession(req, session) {
  return Boolean(session) && session.userId === req.identity.id;
}

router.post('/', requireIdentity, async (req, res) => {
  try {
    const { name, mbtiType, mbtiSliders, schedule, budgetLimit } = req.body || {};
    const session = await createSession({
      userId: req.identity.id,
      name,
      mbtiType,
      mbtiSliders: sanitizeMbtiSliders(mbtiSliders),
      schedule: schedule || null,
      budgetLimit: Number.isFinite(Number(budgetLimit)) ? Number(budgetLimit) : 10.0,
    });
    res.json(session);
  } catch (err) {
    console.error('[session/create]', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id', requireIdentity, async (req, res) => {
  const session = await getSession(req.params.id);
  if (!ownsSession(req, session)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  res.json(session);
});

router.put('/:id/schedule', requireIdentity, async (req, res) => {
  const session = await getSession(req.params.id);
  if (!ownsSession(req, session)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  try {
    const updated = await updateSchedule(req.params.id, req.body?.schedule || req.body);
    res.json(updated);
  } catch (err) {
    console.error('[session/schedule]', err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
