function requestKey(req, prefix) {
  const address = req.ip || req.socket?.remoteAddress || 'unknown';
  return `${prefix}:${address}`;
}

export function createRateLimit({ windowMs = 60_000, max = 60, keyPrefix = 'default' } = {}) {
  const buckets = new Map();
  const limit = Number.isFinite(Number(max)) && Number(max) > 0 ? Number(max) : 60;
  const windowLength = Number.isFinite(Number(windowMs)) && Number(windowMs) > 0
    ? Number(windowMs)
    : 60_000;

  return function rateLimit(req, res, next) {
    const now = Date.now();
    const key = requestKey(req, keyPrefix);
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + windowLength };

    bucket.count += 1;
    buckets.set(key, bucket);

    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }

    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: `Too many requests. Try again in ${retryAfter}s.`,
        code: 'RATE_LIMITED',
      });
    }

    return next();
  };
}
