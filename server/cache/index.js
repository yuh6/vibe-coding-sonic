/**
 * Redis 缓存层 — 可选依赖
 *
 * REDIS_URL 设置时使用 Redis；未设置时降级为内存 Map 实现。
 * 提供：限流计数、job 实时状态缓存、通用 KV 缓存。
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
let redis = null;
let isRedisAvailable = false;

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null; // 放弃重连
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    await redis.connect();
    isRedisAvailable = true;
    console.log('[cache] Redis connected:', REDIS_URL.replace(/\/\/.*@/, '//***@'));
  } catch (err) {
    console.warn('[cache] Redis unavailable, falling back to memory:', err.message);
    redis = null;
  }
} else {
  console.log('[cache] No REDIS_URL, using in-memory cache');
}

// ═══════════════════════════════════════════════════════════════
//  内存降级实现
// ═══════════════════════════════════════════════════════════════

const memStore = new Map();

function memCleanup() {
  const now = Date.now();
  for (const [k, v] of memStore) {
    if (v.expiresAt && v.expiresAt <= now) memStore.delete(k);
  }
}
setInterval(memCleanup, 30_000).unref?.();

// ═══════════════════════════════════════════════════════════════
//  统一接口
// ═══════════════════════════════════════════════════════════════

export const cache = {
  /** 是否使用 Redis */
  get isRedis() { return isRedisAvailable; },

  /** GET — 返回字符串或 null */
  async get(key) {
    if (isRedisAvailable) return redis.get(key);
    const entry = memStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) { memStore.delete(key); return null; }
    return entry.value;
  },

  /** SET — ttl 秒 */
  async set(key, value, ttlSec) {
    if (isRedisAvailable) {
      if (ttlSec) return redis.set(key, value, 'EX', ttlSec);
      return redis.set(key, value);
    }
    memStore.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null });
  },

  /** DEL */
  async del(key) {
    if (isRedisAvailable) return redis.del(key);
    memStore.delete(key);
  },

  /** INCR + EXPIRE（限流专用）— 返回当前计数 */
  async incr(key, ttlSec) {
    if (isRedisAvailable) {
      const count = await redis.incr(key);
      if (count === 1 && ttlSec) await redis.expire(key, ttlSec);
      return count;
    }
    const entry = memStore.get(key);
    const now = Date.now();
    if (!entry || (entry.expiresAt && entry.expiresAt <= now)) {
      memStore.set(key, { value: '1', expiresAt: ttlSec ? now + ttlSec * 1000 : null });
      return 1;
    }
    const count = parseInt(entry.value, 10) + 1;
    entry.value = String(count);
    return count;
  },

  /** TTL 查询（秒） */
  async ttl(key) {
    if (isRedisAvailable) return redis.ttl(key);
    const entry = memStore.get(key);
    if (!entry || !entry.expiresAt) return -1;
    return Math.max(0, Math.ceil((entry.expiresAt - Date.now()) / 1000));
  },

  /** JSON GET */
  async getJSON(key) {
    const raw = await this.get(key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  },

  /** JSON SET */
  async setJSON(key, obj, ttlSec) {
    return this.set(key, JSON.stringify(obj), ttlSec);
  },

  /** 关闭 */
  async close() {
    if (redis) await redis.quit();
  },
};
