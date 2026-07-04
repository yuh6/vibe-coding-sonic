/**
 * 数据库抽象层入口 — 根据 DB_DRIVER 环境变量选择实现
 *
 * DB_DRIVER=sqlite (默认) → better-sqlite3
 * DB_DRIVER=pg            → PostgreSQL (pg Pool)
 *
 * 统一接口：
 *   dal.query(sql, params)  → Promise<rows[]>
 *   dal.get(sql, params)    → Promise<row|null>
 *   dal.run(sql, params)    → Promise<{changes}>
 *   dal.exec(sql)           → Promise<void>
 *   dal.transaction(fn)     → Promise<result>
 *   dal.close()             → Promise<void>
 */
import { getMigrationSQL } from './migrations.js';

const DB_DRIVER = (process.env.DB_DRIVER || 'sqlite').toLowerCase();

let dal;

if (DB_DRIVER === 'pg' || DB_DRIVER === 'postgres' || DB_DRIVER === 'postgresql') {
  const { postgres } = await import('./pg.js');
  dal = postgres;
  console.log('[db] Using PostgreSQL:', process.env.DATABASE_URL?.replace(/\/\/.*@/, '//***@'));
} else {
  const { sqlite } = await import('./sqlite.js');
  dal = sqlite;
  console.log('[db] Using SQLite:', process.env.DB_PATH || 'server/data/app.db');
}

// 执行迁移（创建表）
await dal.exec(getMigrationSQL(DB_DRIVER));

// 兼容旧 db.js 的导出（迁移期间）
export { dal };
export const db = dal.raw || dal; // 兼容直接 db.prepare() 的旧代码

export function today() {
  return new Date().toISOString().slice(0, 10);
}
