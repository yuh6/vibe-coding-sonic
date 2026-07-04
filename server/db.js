/**
 * 兼容层 — 重定向到新的 DAL
 * 所有服务文件仍然 import { db } from '../db.js'，这里转发到 server/db/index.js
 */
export { dal, db, today } from './db/index.js';
