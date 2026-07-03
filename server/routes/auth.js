import { Router } from 'express';
import {
  registerUser,
  loginUser,
  createSession,
  destroySession,
} from '../services/authService.js';
import { requireUser, sessionCookie, clearSessionCookie } from '../middleware/userAuth.js';
import { getQuota } from '../services/quotaService.js';

const router = Router();

// 认证接口按 IP 限流，防爆破
const attempts = new Map(); // ip -> { count, resetAt }
function authRateLimit(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (entry.count >= 20) {
    return res.status(429).json({ error: '尝试过于频繁，请一分钟后再试' });
  }
  entry.count += 1;
  next();
}

function issueSession(res, user) {
  const { token, maxAgeMs } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, maxAgeMs));
  return { user, quota: getQuota(user.id) };
}

router.post('/register', authRateLimit, (req, res) => {
  try {
    const user = registerUser(req.body || {});
    res.json(issueSession(res, user));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/login', authRateLimit, (req, res) => {
  try {
    const user = loginUser(req.body || {});
    res.json(issueSession(res, user));
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

router.post('/logout', (req, res) => {
  destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', clearSessionCookie());
  res.json({ ok: true });
});

router.get('/me', requireUser, (req, res) => {
  res.json({ user: req.user, quota: getQuota(req.user.id) });
});

export default router;
