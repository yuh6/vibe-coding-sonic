/**
 * Redis 缓存层 — 可选依赖
 *
 * REDIS_URL 设置时使用 Redis；未设置时降级为内存 Map 实现（带 LRU 淘汰）。
 * 提供：限流计数、job 实时状态缓存、通用 KV 缓存。
 */
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL;
let redis = null;
let redisSubscriber = null;
let isRedisAvailable = false;
const subscriptionHandlers = new Map();

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
  console.log('[cache] No REDIS_URL, using in-memory LRU cache');
}

async function getSubscriber() {
  if (!isRedisAvailable || !REDIS_URL) return null;
  if (redisSubscriber) return redisSubscriber;

  redisSubscriber = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    },
    lazyConnect: true,
  });
  redisSubscriber.on('message', (channel, message) => {
    const handlers = subscriptionHandlers.get(channel);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(message);
      } catch (err) {
        console.warn('[cache] Redis subscription handler failed:', err.message);
      }
    }
  });
  await redisSubscriber.connect();
  return redisSubscriber;
}

// ═══════════════════════════════════════════════════════════════
//  内存 LRU 降级实现（最大条目数限制，防止内存泄漏）
// ═══════════════════════════════════════════════════════════════

const MAX_ENTRIES = 10000;
const memStore = new Map(); // Map 保持插入顺序，可做简易 LRU

function memEvict() {
  // 当超过最大条目数时，删除最旧的 20% 条目
  if (memStore.size <= MAX_ENTRIES) return;
  const toRemove = Math.ceil(memStore.size * 0.2);
  let removed = 0;
  for (const key of memStore.keys()) {
    if (removed >= toRemove) break;
    memStore.delete(key);
    removed++;
  }
}

function memCleanup() {
  const now = Date.now();
  for (const [k, v] of memStore) {
    if (v.expiresAt && v.expiresAt <= now) memStore.delete(k);
  }
}
setInterval(memCleanup, 30_000).unref?.();

/** 将 key 移动到 Map 末尾（最新访问）— 简易 LRU */
function memTouch(key, entry) {
  memStore.delete(key);
  memStore.set(key, entry);
}

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
    memTouch(key, entry);
    return entry.value;
  },

  /** SET — ttl 秒 */
  async set(key, value, ttlSec) {
    if (isRedisAvailable) {
      if (ttlSec) return redis.set(key, value, 'EX', ttlSec);
      return redis.set(key, value);
    }
    memStore.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null });
    memEvict();
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
      memEvict();
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

  /** Pub/Sub publish — Redis 可用时跨实例广播；不可用时返回 0 */
  async publish(channel, message) {
    if (!isRedisAvailable) return 0;
    return redis.publish(channel, typeof message === 'string' ? message : JSON.stringify(message));
  },

  /** Pub/Sub subscribe — 返回 unsubscribe 函数；Redis 不可用时为 no-op */
  async subscribe(channel, handler) {
    if (!isRedisAvailable) return () => {};
    if (!subscriptionHandlers.has(channel)) {
      subscriptionHandlers.set(channel, new Set());
      const subscriber = await getSubscriber();
      await subscriber.subscribe(channel);
    }
    subscriptionHandlers.get(channel).add(handler);
    return async () => {
      const handlers = subscriptionHandlers.get(channel);
      if (!handlers) return;
      handlers.delete(handler);
      if (handlers.size === 0) {
        subscriptionHandlers.delete(channel);
        if (redisSubscriber) await redisSubscriber.unsubscribe(channel);
      }
    };
  },

  /** 关闭 */
  async close() {
    if (redisSubscriber) await redisSubscriber.quit();
    redisSubscriber = null;
    if (redis) await redis.quit();
    redis = null;
    isRedisAvailable = false;
  },
};
