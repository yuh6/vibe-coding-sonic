/**
 * 限流中间件 — 支持 Redis（生产）/ 内存降级（开发）
 * 通过 server/cache 自动选择后端。
 */
import { cache } from '../cache/index.js';

function requestKey(req, prefix) {
  const address = req.ip || req.socket?.remoteAddress || 'unknown';
  return `rl:${prefix}:${address}`;
}

export function createRateLimit({ windowMs = 60_000, max = 60, keyPrefix = 'default' } = {}) {
  const limit = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 60;
  const windowSec = Math.ceil((Number.isFinite(Number(windowMs)) ? Number(windowMs) : 60_000) / 1000);

  return function rateLimit(req, res, next) {
    const key = requestKey(req, keyPrefix);

    cache.incr(key, windowSec).then((count) => {
      res.setHeader('X-RateLimit-Limit', String(limit));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));

      if (count > limit) {
        return cache.ttl(key).then((remaining) => {
          const retryAfter = Math.max(1, remaining);
          res.setHeader('Retry-After', String(retryAfter));
          res.status(429).json({
            error: `Too many requests. Try again in ${retryAfter}s.`,
            code: 'RATE_LIMITED',
          });
        });
      }
      next();
    }).catch(() => next()); // Redis 异常不阻塞请求
  };
}
