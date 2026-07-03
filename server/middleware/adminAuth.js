import { timingSafeEqual } from 'crypto';
import { getSetting } from '../config/runtimeConfig.js';

function normalizeAddress(address = '') {
  return String(address).replace(/^::ffff:/, '');
}

function isLoopbackAddress(address) {
  const normalized = normalizeAddress(address);
  return normalized === '::1' || normalized === 'localhost' || normalized.startsWith('127.');
}

function isLocalOrigin(origin) {
  if (!origin) return true;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.');
  } catch {
    return false;
  }
}

function isLoopbackRequest(req) {
  return isLoopbackAddress(req.ip) || isLoopbackAddress(req.socket?.remoteAddress);
}

function readAdminToken(req) {
  const authorization = req.get('authorization') || '';
  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }
  return req.get('x-admin-token') || '';
}

function safeTokenEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isAdminTokenConfigured() {
  return Boolean(getSetting('ADMIN_TOKEN'));
}

export function requireAdmin(req, res, next) {
  const configuredToken = getSetting('ADMIN_TOKEN');

  if (configuredToken) {
    const suppliedToken = readAdminToken(req);
    if (suppliedToken && safeTokenEqual(suppliedToken, configuredToken)) {
      return next();
    }

    return res.status(401).json({
      error: 'ADMIN_TOKEN required',
      code: 'ADMIN_AUTH_REQUIRED',
    });
  }

  if (isLoopbackRequest(req) && isLocalOrigin(req.get('origin'))) {
    return next();
  }

  return res.status(403).json({
    error: 'Admin access is local-only unless ADMIN_TOKEN is configured',
    code: 'ADMIN_LOCAL_ONLY',
  });
}
