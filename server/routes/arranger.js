/**
 * /api/arranger/* — docs/ai-music-engine-design.md §11
 * Arranger 编排引擎的 REST 控制面：启动/停止/切阶段/反馈/状态查询。
 * 播放本身发生在浏览器 Web Audio（§9.3 Crossfade），这里只负责"下一首选哪首"。
 */
import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { requireIdentity } from '../middleware/userAuth.js';
import { getSession } from '../services/arranger/sessionStore.js';
import {
  startEngine,
  stopEngine,
  decideNext,
  setManualPhase,
  submitFeedback,
  nowPlaying,
  history,
  poolStatus,
  energyCurve,
} from '../services/arranger/index.js';
import { clampInt } from '../utils/pagination.js';

const VALID_PHASES = ['brainstorm', 'focus', 'sprint', 'charge', 'behind', 'break', 'celebrate'];
const VALID_FEEDBACK = ['too_loud', 'more_drive', 'skip', 'like'];
const __dirname = dirname(fileURLToPath(import.meta.url));
const demoSchedule = JSON.parse(
  readFileSync(join(__dirname, '../data/demo-schedule.json'), 'utf-8')
);

const router = Router();

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentPhase(phases, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const phase of phases) {
    const start = parseTime(phase.start);
    let end = parseTime(phase.end);
    if (end <= start) end += 24 * 60;

    let current = minutes;
    if (current < start && end > 24 * 60 && start > end - 24 * 60) {
      current += 24 * 60;
    }

    if (current >= start && current < end) {
      return phase;
    }
  }

  return phases[0];
}

router.get('/schedule/demo', (_req, res) => {
  res.json(demoSchedule);
});

router.post('/schedule/sync', (req, res) => {
  const phases = req.body?.phases || demoSchedule.phases;
  const current = getCurrentPhase(phases);
  res.json({ current, phases });
});

function resolveSessionId(req) {
  return req.body?.sessionId || req.query?.sessionId;
}

async function requireOwnedSession(req, res, next) {
  try {
    const sessionId = resolveSessionId(req);
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }
    const session = await getSession(sessionId);
    if (!session || session.userId !== req.identity.id) {
      return res.status(404).json({ error: 'Session not found' });
    }
    req.arrangerSession = session;
    next();
  } catch (err) {
    next(err);
  }
}

router.use(requireIdentity, requireOwnedSession);

router.post('/start', async (req, res) => {
  try {
    const decision = await startEngine(req.arrangerSession.id);
    res.json({ ok: true, decision });
  } catch (err) {
    console.error('[arranger/start]', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/stop', async (req, res) => {
  await stopEngine(req.arrangerSession.id);
  res.json({ ok: true });
});

router.post('/phase/:phase', async (req, res) => {
  const { phase } = req.params;
  if (!VALID_PHASES.includes(phase)) {
    return res.status(400).json({ error: `Invalid phase: ${phase}` });
  }
  try {
    const decision = await setManualPhase(req.arrangerSession.id, phase);
    res.json({ ok: true, decision });
  } catch (err) {
    console.error('[arranger/phase]', err);
    res.status(400).json({ error: err.message });
  }
});

// 前端在 85% 进度时调用：预取「下一首」用于 preload，不算用户跳歌（区别于 feedback:skip）
router.post('/advance', async (req, res) => {
  try {
    const decision = await decideNext(req.arrangerSession.id);
    res.json({ ok: true, decision });
  } catch (err) {
    console.error('[arranger/advance]', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/feedback', async (req, res) => {
  const { action } = req.body || {};
  if (!VALID_FEEDBACK.includes(action)) {
    return res.status(400).json({ error: `Invalid action: ${action}` });
  }
  try {
    const result = await submitFeedback(req.arrangerSession.id, action);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[arranger/feedback]', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/now-playing', async (req, res) => {
  res.json(await nowPlaying(req.arrangerSession.id) || { state: 'IDLE', track: null });
});

router.get('/history', async (req, res) => {
  const limit = clampInt(req.query.limit, { defaultValue: 20, min: 1, max: 100 });
  res.json({ history: await history(req.arrangerSession.id, limit) });
});

router.get('/pool-status', async (req, res) => {
  res.json(await poolStatus(req.arrangerSession.id));
});

router.get('/energy-curve', (_req, res) => {
  res.json({ curve: energyCurve() });
});

export default router;
