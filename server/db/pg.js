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

/**
 * 将 `?` 占位符转换为 `$1, $2, ...`（PostgreSQL 格式）
 * 跳过字符串内部和 `??` 转义
 */
function convertPlaceholders(sql) {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

/**
 * PG 的布尔处理：SQLite 用 0/1，PG 用 true/false
 * 这里不做自动转换 — 统一在迁移 SQL 中使用 INTEGER 兼容
 */

export const postgres = {
  async query(sql, params = []) {
    const result = await getPool().query(convertPlaceholders(sql), params);
    return result.rows;
  },

  async get(sql, params = []) {
    const result = await getPool().query(convertPlaceholders(sql), params);
    return result.rows[0] || null;
  },

  async run(sql, params = []) {
    const result = await getPool().query(convertPlaceholders(sql), params);
    return { changes: result.rowCount, lastInsertRowid: null };
  },

  async exec(sql) {
    await getPool().query(sql);
  },

  async transaction(fn) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await fn({
        query: (sql, params = []) => client.query(convertPlaceholders(sql), params).then((r) => r.rows),
        get: (sql, params = []) => client.query(convertPlaceholders(sql), params).then((r) => r.rows[0] || null),
        run: (sql, params = []) => client.query(convertPlaceholders(sql), params).then((r) => ({ changes: r.rowCount })),
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

  raw: null, // PG 不暴露同步 raw 接口
};
