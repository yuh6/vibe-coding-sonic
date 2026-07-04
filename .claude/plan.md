# 后端架构修复计划

## 修复范围总览

根据分析，将修复 13 个问题并将存储层改为 Cloudflare R2。按模块分组实施。

---

## 1. 全局错误处理（高优先级 #1）

**文件**: `server/index.js`

- 在所有路由注册之后添加 Express 4参数错误中间件
- 添加 `unhandledRejection` / `uncaughtException` 全局兜底
- 404 路由兜底

```js
// 路由注册之后
app.use((err, req, res, next) => {
  console.error('[server] Unhandled error:', err);
  res.status(err.status || 500).json({ error: '服务器内部错误', code: 'INTERNAL_ERROR' });
});

process.on('unhandledRejection', (reason) => { console.error('[process] unhandledRejection:', reason); });
process.on('uncaughtException', (err) => { console.error('[process] uncaughtException:', err); process.exit(1); });
```

---

## 2. WebSocket 认证（高优先级 #3）

**文件**: `server/ws/events.js`, `server/ws/radio.js`

- 在 `onConnection` 中验证 query string 的 `token` 参数
- 无效 token 时立即关闭连接

---

## 3. 内存缓存 LRU 限制（高优先级 #4）

**文件**: `server/cache/index.js`

- 为内存 Map 添加 LRU 淘汰逻辑（自实现，不引入新依赖）
- 设置最大条目数 `MAX_ENTRIES = 10000`
- 当超过限制时移除最早的条目

---

## 4. 移除旧 LLM 客户端（中优先级 #6）

**文件**: `server/services/llmClient.js`

- 当前 `llmClient.js` 只是一行 re-export `export { analyzeProject, callLlm, isLlmConfigured } from './llm/index.js'`
- 这实际上已经是个转发层，保留它作为兼容层不影响架构
- **无需修改**（已是 re-export）

---

## 5. 配额服务持久化（中优先级 #7）

**文件**: `server/services/quotaService.js`

- 当前 quotaService 已通过 `db.prepare` 操作 `quotas` 表实现持久化
- **无需修改**（最初分析有误，实际已持久化到 DB）

---

## 6. 外部 API 超时（中优先级 #8）

**文件**: `server/services/sunoClient.js`, `server/services/llm/httpProviders.js`

- 为所有外部 `fetch()` 调用添加 `AbortSignal.timeout()`
- Suno: 30s 超时
- LLM HTTP: 60s 超时

---

## 7. 迁移系统事务保护（中优先级 #9）

**文件**: `server/db/index.js`

- 当前迁移是 `CREATE TABLE IF NOT EXISTS`，幂等安全
- 为 PG 添加事务包裹
- SQLite 由于 `exec()` 已是原子的无需额外处理

---

## 8. 速率限制 Redis 支持（低优先级 #10）

**已实现** — `server/middleware/rateLimit.js` 已通过 `cache.incr()` 走 Redis。无需修改。

---

## 9. 音频缓存清理（低优先级 #11）

**文件**: `server/storage/local.js`

- 添加 `cleanup()` 方法，删除超过 7 天的文件
- 在 `server/index.js` 中设置定时清理任务（每小时执行）

---

## 10. PG 连接池健康检查（低优先级 #12）

**文件**: `server/db/pg.js`

- 已有 `pool.on('error')` 处理
- 无需额外修改

---

## 11. WebSocket 消息大小限制（低优先级 #13）

**文件**: `server/ws/wsServer.js`

- 在帧解析中添加 payload 大小检查
- 超过 64KB 的帧直接关闭连接

---

## 12. 存储层改用 Cloudflare R2

**文件**: `server/storage/s3.js`, `.env.example`

- 当前 `s3.js` 已使用 `@aws-sdk/client-s3`，且已支持 R2（`forcePathStyle: true`, `region: 'auto'`）
- 实际上代码注释已写明 "支持 Cloudflare R2 / 阿里 OSS / AWS S3 / MinIO"
- 需要做的：
  - 更新 `.env.example`，将 R2 作为首选示例
  - 为 R2 添加上传重试逻辑（3次）
  - 添加 `Content-Disposition` 头
  - 更新环境变量注释说明

---

## 13. 优雅关闭补全

**文件**: `server/index.js`

- 当前有 `server.listen()` 但无 graceful shutdown
- 添加 SIGINT/SIGTERM 处理：关闭 HTTP Server、DB、Cache

---

## 实施顺序

1. `server/index.js` — 全局错误处理 + 优雅关闭 + 缓存清理定时器
2. `server/cache/index.js` — LRU 限制
3. `server/ws/wsServer.js` — 消息大小限制
4. `server/ws/events.js` + `server/ws/radio.js` — WebSocket 认证
5. `server/services/sunoClient.js` — 请求超时
6. `server/services/llm/httpProviders.js` — 请求超时
7. `server/storage/s3.js` — R2 优化（重试）
8. `server/storage/local.js` — 缓存清理
9. `server/db/index.js` — 迁移事务包裹
10. `.env.example` — 更新 R2 配置示例
