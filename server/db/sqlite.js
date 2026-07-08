/**
 * SQLite DAL 实现 — 包装 better-sqlite3 同步 API 为统一异步接口
 */
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '../data/app.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
let transactionChain = Promise.resolve();

export const sqlite = {
  dialect: 'sqlite',

  /** SELECT 多行 */
  async query(sql, params = []) {
    return db.prepare(sql).all(...params);
  },

  /** SELECT 单行 */
  async get(sql, params = []) {
    return db.prepare(sql).get(...params) || null;
  },

  /** INSERT/UPDATE/DELETE — 返回 { changes, lastInsertRowid } */
  async run(sql, params = []) {
    const result = db.prepare(sql).run(...params);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  },

  /** DDL / 批量 SQL 执行 */
  async exec(sql) {
    db.exec(sql);
  },

  /** 事务包装 */
  async transaction(fn) {
    const runTransaction = async () => {
      const tx = {
        query: (sql, params = []) => db.prepare(sql).all(...params),
        get: (sql, params = []) => db.prepare(sql).get(...params) || null,
        run: (sql, params = []) => {
          const result = db.prepare(sql).run(...params);
          return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
        },
      };
      db.prepare('BEGIN IMMEDIATE').run();
      try {
        const result = await fn(tx);
        db.prepare('COMMIT').run();
        return result;
      } catch (err) {
        db.prepare('ROLLBACK').run();
        throw err;
      }
    };
    const next = transactionChain.then(runTransaction, runTransaction);
    transactionChain = next.catch(() => {});
    return next;
  },

  /** 关闭连接 */
  async close() {
    db.close();
  },

  /** 原始 better-sqlite3 实例（迁移期间兼容用） */
  raw: db,
};
