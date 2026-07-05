/**
 * /api/session/* — docs/ai-music-engine-design.md §11
 * 创建/更新黑客松会话（Arranger 引擎的运行单元）。
 */
import { Router } from 'express';
import { requireIdentity } from '../middleware/userAuth.js';
import {
  createSession,
  getSession,
  updateGenerationParams,
  updateSchedule,
} from '../services/arranger/sessionStore.js';

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

function sanitizeText(value, maxLen = 120) {
  if (typeof value !== 'string') return null;
  const text = value.trim().slice(0, maxLen);
  return text || null;
}

function sanitizeStringArray(value, maxItems = 8, maxLen = 80) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeText(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function sanitizeStyle(style) {
  if (!style || typeof style !== 'object') return null;
  const out = {};
  for (const key of ['energy', 'texture', 'brightness']) {
    const value = Number(style[key]);
    if (Number.isFinite(value)) out[key] = Math.max(0, Math.min(100, value));
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeProjectAnalysis(projectAnalysis) {
  if (!projectAnalysis || typeof projectAnalysis !== 'object') return null;
  const out = {};
  for (const key of ['themes', 'mood', 'instruments', 'avoid']) {
    const values = sanitizeStringArray(projectAnalysis[key]);
    if (values.length) out[key] = values;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeVocals(vocals) {
  if (!vocals || typeof vocals !== 'object') return { enabled: false };
  const out = { enabled: Boolean(vocals.enabled) };
  const lyrics = sanitizeText(vocals.lyrics, 1200);
  if (lyrics) out.lyrics = lyrics;
  return out;
}

function sanitizeGenerationParams(params) {
  if (!params || typeof params !== 'object') return null;
  const out = {};
  const style = sanitizeStyle(params.style);
  const projectAnalysis = sanitizeProjectAnalysis(params.projectAnalysis);
  const selectedGenre = sanitizeText(params.selectedGenre, 64);
  const vocals = sanitizeVocals(params.vocals);
  if (style) out.style = style;
  if (projectAnalysis) out.projectAnalysis = projectAnalysis;
  if (selectedGenre) out.selectedGenre = selectedGenre;
  if (vocals) out.vocals = vocals;
  return Object.keys(out).length ? out : null;
}

function ownsSession(req, session) {
  return Boolean(session) && session.userId === req.identity.id;
}

router.post('/', requireIdentity, async (req, res) => {
  try {
    const { name, mbtiType, mbtiSliders, schedule, budgetLimit, generationParams } = req.body || {};
    const session = await createSession({
      userId: req.identity.id,
      name,
      mbtiType,
      mbtiSliders: sanitizeMbtiSliders(mbtiSliders),
      schedule: schedule || null,
      generationParams: sanitizeGenerationParams(generationParams),
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

router.put('/:id/generation-params', requireIdentity, async (req, res) => {
  const session = await getSession(req.params.id);
  if (!ownsSession(req, session)) {
    return res.status(404).json({ error: 'Session not found' });
  }
  try {
    const params = sanitizeGenerationParams(req.body?.generationParams || req.body);
    const updated = await updateGenerationParams(req.params.id, params);
    res.json(updated);
  } catch (err) {
    console.error('[session/generation-params]', err);
    res.status(400).json({ error: err.message });
  }
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
