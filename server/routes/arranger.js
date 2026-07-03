/**
 * /api/arranger/* — docs/ai-music-engine-design.md §11
 * Arranger 编排引擎的 REST 控制面：启动/停止/切阶段/反馈/状态查询。
 * 播放本身发生在浏览器 Web Audio（§9.3 Crossfade），这里只负责"下一首选哪首"。
 */
import { Router } from 'express';
import { requireUser } from '../middleware/userAuth.js';
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

const VALID_PHASES = ['brainstorm', 'focus', 'sprint', 'charge', 'behind', 'break', 'celebrate'];
const VALID_FEEDBACK = ['too_loud', 'more_drive', 'skip', 'like'];

const router = Router();

function resolveSessionId(req) {
  return req.body?.sessionId || req.query?.sessionId;
}

function requireOwnedSession(req, res, next) {
  const sessionId = resolveSessionId(req);
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  const session = getSession(sessionId);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ error: 'Session not found' });
  }
  req.arrangerSession = session;
  next();
}

router.use(requireUser, requireOwnedSession);

router.post('/start', async (req, res) => {
  try {
    const decision = await startEngine(req.arrangerSession.id);
    res.json({ ok: true, decision });
  } catch (err) {
    console.error('[arranger/start]', err);
    res.status(400).json({ error: err.message });
  }
});

router.post('/stop', (req, res) => {
  stopEngine(req.arrangerSession.id);
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

router.get('/now-playing', (req, res) => {
  res.json(nowPlaying(req.arrangerSession.id) || { state: 'IDLE', track: null });
});

router.get('/history', (req, res) => {
  const limit = Math.min(100, Number(req.query.limit) || 20);
  res.json({ history: history(req.arrangerSession.id, limit) });
});

router.get('/pool-status', (req, res) => {
  res.json(poolStatus(req.arrangerSession.id));
});

router.get('/energy-curve', (_req, res) => {
  res.json({ curve: energyCurve() });
});

export default router;
