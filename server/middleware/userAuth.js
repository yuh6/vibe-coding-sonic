import {
  getOrCreateGuestUser,
  getUserBySession,
  GUEST_COOKIE,
  SESSION_COOKIE,
} from '../services/authService.js';

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  }
  return out;
}

// 附加 req.user（可为 null），不拦截
export async function attachUser(req, _res, next) {
  const token = parseCookies(req)[SESSION_COOKIE];
  req.sessionToken = token || null;
  req.identity = null;
  try {
    req.user = await getUserBySession(token);
    if (req.user) req.identity = req.user;
    next();
  } catch (err) {
    next(err);
  }
}

// 必须登录
export function requireUser(req, res, next) {
  if (!req.user || req.user.isGuest) {
    return res.status(401).json({ error: '请先登录', code: 'UNAUTHORIZED' });
  }
  next();
}

export async function requireIdentity(req, res, next) {
  if (req.identity) return next();

  try {
    const guestToken = parseCookies(req)[GUEST_COOKIE];
    const { user, token, maxAgeMs } = await getOrCreateGuestUser(guestToken);
    req.user = user;
    req.identity = user;
    if (token !== guestToken) {
      res.append('Set-Cookie', identityCookie(token, maxAgeMs));
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function sessionCookie(token, maxAgeMs) {
  const parts = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function identityCookie(token, maxAgeMs) {
  const parts = [
    `${GUEST_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
  ];
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
