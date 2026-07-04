/**
 * PostgreSQL DAL 实现 — pg Pool
 *
 * 占位符转换：SQLite 用 `?`，PG 用 `$1, $2, ...`
 * 本模块接受 `?` 占位符并自动转换为 `$N` 格式。
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pool.on('error', (err) => {
      console.error('[pg] Unexpected pool error:', err.message);
    });
  }
  return pool;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date) && !Buffer.isBuffer(value);
}

function normalizeParams(argsOrParams = []) {
  if (Array.isArray(argsOrParams)) {
    if (argsOrParams.length === 1 && Array.isArray(argsOrParams[0])) return argsOrParams[0];
    if (argsOrParams.length === 1 && isPlainObject(argsOrParams[0])) return argsOrParams[0];
    return argsOrParams;
  }
  return argsOrParams;
}

/**
 * 将 SQLite/better-sqlite3 占位符转换为 PostgreSQL 格式。
 * 支持数组参数的 `?`，也支持对象参数的 `@name`。
 */
function convertPlaceholders(sql, inputParams = []) {
  const params = normalizeParams(inputParams);

  if (isPlainObject(params)) {
    const values = [];
    const indexes = new Map();
    const text = sql.replace(/@([A-Za-z_][A-Za-z0-9_]*)/g, (_match, name) => {
      if (!indexes.has(name)) {
        indexes.set(name, values.length + 1);
        values.push(params[name]);
      }
      return `$${indexes.get(name)}`;
    });
    return { text, values };
  }

  let idx = 0;
  const values = Array.isArray(params) ? params : [];
  return { text: sql.replace(/\?/g, () => `$${++idx}`), values };
}

function withReturningId(sql) {
  if (/\bRETURNING\b/i.test(sql)) return sql;
  if (!/^\s*INSERT\s+INTO\s+(track_pool|play_history|playlist_tracks|user_play_history)\b/i.test(sql)) {
    return sql;
  }
  return `${sql.replace(/;\s*$/, '')} RETURNING id`;
}

/**
 * PG 的布尔处理：SQLite 用 0/1，PG 用 true/false
 * 这里不做自动转换 — 统一在迁移 SQL 中使用 INTEGER 兼容
 */

export const postgres = {
  dialect: 'pg',

  async query(sql, params = []) {
    const { text, values } = convertPlaceholders(sql, params);
    const result = await getPool().query(text, values);
    return result.rows;
  },

  async get(sql, params = []) {
    const { text, values } = convertPlaceholders(sql, params);
    const result = await getPool().query(text, values);
    return result.rows[0] || null;
  },

  async run(sql, params = []) {
    const { text, values } = convertPlaceholders(withReturningId(sql), params);
    const result = await getPool().query(text, values);
    return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id ?? null };
  },

  async exec(sql) {
    await getPool().query(sql);
  },

  async transaction(fn) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn({
        query: (sql, params = []) => {
          const { text, values } = convertPlaceholders(sql, params);
          return client.query(text, values).then((r) => r.rows);
        },
        get: (sql, params = []) => {
          const { text, values } = convertPlaceholders(sql, params);
          return client.query(text, values).then((r) => r.rows[0] || null);
        },
        run: (sql, params = []) => {
          const { text, values } = convertPlaceholders(withReturningId(sql), params);
          return client.query(text, values).then((r) => ({ changes: r.rowCount, lastInsertRowid: r.rows[0]?.id ?? null }));
        },
      });
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async close() {
    if (pool) await pool.end();
    pool = null;
  },

  compat: {
    prepare(sql) {
      return {
        all: (...args) => postgres.query(sql, normalizeParams(args)),
        get: (...args) => postgres.get(sql, normalizeParams(args)),
        run: (...args) => postgres.run(sql, normalizeParams(args)),
      };
    },
  },

  raw: null, // PG 不暴露同步 raw 接口
};
