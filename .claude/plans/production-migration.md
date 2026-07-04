# Phase 1-3 生产化迁移方案

## 架构设计原则

**核心思路：引入数据库抽象层（DAL）**，使代码不直接调用 `db.prepare()` / `pg.query()`，
而是通过 `dal.query()` / `dal.get()` / `dal.run()` 统一接口。通过环境变量 `DB_DRIVER=sqlite|pg`
切换底层实现，实现**本地 SQLite 开发 + 生产 PostgreSQL 部署**的双模式。

---

## Phase 1: 核心生产化

### 1.1 数据库抽象层 `server/db/index.js`

```
server/db/
├── index.js          ← 导出 dal 对象（根据 DB_DRIVER 选择实现）
├── sqlite.js         ← SQLite 实现（保留原 better-sqlite3，同步转 async wrapper）
├── pg.js             ← PostgreSQL 实现（pg Pool）
└── migrations.js     ← 统一 schema 迁移（SQL 兼容两种方言）
```

接口设计：
```js
// 所有方法返回 Promise（SQLite 用 Promise.resolve 包装）
export const dal = {
  query(sql, params)     → Promise<rows[]>     // SELECT 多行
  get(sql, params)       → Promise<row|null>   // SELECT 单行
  run(sql, params)       → Promise<{changes}>  // INSERT/UPDATE/DELETE
  exec(sql)              → Promise<void>       // DDL / 批量执行
  transaction(fn)        → Promise<result>     // 事务包装
}
```

### 1.2 对象存储抽象层 `server/storage/index.js`

```
server/storage/
├── index.js           ← 导出 storage 对象
├── local.js           ← 本地文件系统（开发模式，保留 audio-cache/）
└── s3.js              ← S3 兼容（R2 / 阿里 OSS / MinIO）
```

接口设计：
```js
export const storage = {
  upload(key, stream, contentType) → Promise<publicUrl>
  getUrl(key)                      → string (公开访问 URL)
  delete(key)                      → Promise<void>
  exists(key)                      → Promise<boolean>
}
```

### 1.3 generation_jobs 表（替代 in-memory Map）

```sql
CREATE TABLE generation_jobs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'processing',  -- processing/splitting/completed/failed
  mbti            TEXT,
  mode            TEXT,
  full_prompt     TEXT,
  negative_tags   TEXT,
  bpm             INTEGER,
  weirdness       INTEGER,
  style_weight    INTEGER,
  suno_task_id    TEXT,
  music_id        TEXT,
  audio_url       TEXT,
  audio_local     TEXT,
  title           TEXT,
  duration_sec    INTEGER,
  tracks_json     TEXT,    -- JSON array of track objects
  fallback        BOOLEAN DEFAULT FALSE,
  error           TEXT,
  split_stems     BOOLEAN DEFAULT TRUE,
  stem_task_id    TEXT,
  stem_status     TEXT DEFAULT 'idle',
  created_at      BIGINT NOT NULL,
  completed_at    BIGINT
);
CREATE INDEX idx_jobs_user ON generation_jobs(user_id, created_at DESC);
CREATE INDEX idx_jobs_status ON generation_jobs(status) WHERE status != 'completed';
```

### 1.4 环境变量

```env
# 数据库驱动选择
DB_DRIVER=pg                          # sqlite | pg
DATABASE_URL=postgresql://user:pass@host:5432/vibe_coding_sonic

# 对象存储
STORAGE_DRIVER=s3                     # local | s3
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=vibe-audio
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
S3_PUBLIC_URL=https://audio.yourdomain.com  # CDN 公开访问前缀
```

### 1.5 迁移改造清单

| 文件 | 改动 |
|------|------|
| `server/db/index.js` | 新建 DAL 入口 |
| `server/db/sqlite.js` | 包装现有 better-sqlite3 为 async 接口 |
| `server/db/pg.js` | pg Pool + 参数占位符转换 (`?` → `$1`) |
| `server/db/migrations.js` | 统一 DDL（处理 SQLite/PG 语法差异） |
| `server/storage/index.js` | 新建存储入口 |
| `server/storage/local.js` | 本地文件存储 |
| `server/storage/s3.js` | @aws-sdk/client-s3 实现 |
| `server/services/musicOrchestrator.js` | Map → dal 读写 generation_jobs |
| `server/services/quotaService.js` | db.prepare → dal.get/dal.run |
| `server/services/libraryStore.js` | db.prepare → dal.query/dal.run |
| `server/services/playlistService.js` | db.prepare → dal.* |
| `server/services/radioService.js` | db.prepare → dal.* |
| `server/services/authService.js` | db.prepare → dal.* |
| `server/services/llm/index.js` | db.prepare → dal.* |
| `server/services/arranger/sessionStore.js` | db.prepare → dal.* |
| `server/services/arranger/trackPool.js` | db.prepare → dal.* |
| `server/routes/library.js` | 直接 db 调用 → dal.* |

---

## Phase 2: Redis + 社交

### 2.1 Redis 集成 `server/cache/index.js`

```env
REDIS_URL=redis://localhost:6379
```

用途：
- 限流计数器（`rateLimit.js` 改用 Redis INCR+EXPIRE）
- job 实时状态缓存（`generation_jobs` 的 status/progress 高频读写）
- 在线电台 listener_count（替代 DB 频繁 UPDATE）

### 2.2 收藏 + 评分

```sql
CREATE TABLE favorites (
  user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  track_id  TEXT REFERENCES shared_library(id) ON DELETE CASCADE,
  created_at BIGINT,
  PRIMARY KEY (user_id, track_id)
);

CREATE TABLE ratings (
  user_id   TEXT REFERENCES users(id) ON DELETE CASCADE,
  track_id  TEXT REFERENCES shared_library(id) ON DELETE CASCADE,
  score     SMALLINT CHECK (score BETWEEN 1 AND 5),
  created_at BIGINT,
  PRIMARY KEY (user_id, track_id)
);
```

### 2.3 推荐基础

```sql
-- 播放历史增强
ALTER TABLE play_history ADD COLUMN listen_duration_sec INTEGER;
ALTER TABLE play_history ADD COLUMN completed BOOLEAN DEFAULT FALSE;

-- 物化视图：每首歌的综合评分
CREATE MATERIALIZED VIEW track_scores AS
SELECT track_id,
  COUNT(DISTINCT user_id) as unique_listeners,
  AVG(score) as avg_rating,
  SUM(CASE WHEN completed THEN 1 ELSE 0 END) as completions
FROM play_history ph
LEFT JOIN ratings r USING (track_id)
GROUP BY track_id;
```

---

## Phase 3: pgvector + 推荐 + 排行

### 3.1 向量搜索

```sql
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE shared_library ADD COLUMN embedding vector(384);
CREATE INDEX ON shared_library USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

生成 embedding 时机：`musicOrchestrator.persistTrackAsync()` 完成后异步调用 embedding API。

### 3.2 个性化推荐

```
用户播放历史 → 最近 20 首的 embedding 平均 → 余弦相似搜索 → 排除已听 → top 10
```

### 3.3 排行榜

```sql
-- 实时热榜（Redis sorted set 或 PG 物化视图）
CREATE MATERIALIZED VIEW hot_tracks AS
SELECT sl.id, sl.title, sl.genre, sl.bpm,
  COUNT(*) FILTER (WHERE ph.started_at > NOW() - INTERVAL '24 hours') as plays_24h,
  COUNT(*) FILTER (WHERE ph.started_at > NOW() - INTERVAL '7 days') as plays_7d
FROM shared_library sl
JOIN play_history ph ON ph.track_pool_id::text = sl.id
GROUP BY sl.id
ORDER BY plays_24h DESC;
```

---

## 执行计划（Phase 1 细分步骤）

1. **安装依赖** — `pg`, `@aws-sdk/client-s3`
2. **创建 DAL 抽象层** — `server/db/{index,sqlite,pg,migrations}.js`
3. **创建存储抽象层** — `server/storage/{index,local,s3}.js`
4. **添加 generation_jobs 表到 migrations**
5. **迁移 musicOrchestrator** — Map → DAL (最核心的改动)
6. **迁移所有服务文件** — 10 个文件的 `db.prepare` → `dal.*`
7. **音频上传改造** — `persistTrackAsync` 改为上传 S3
8. **测试** — SQLite 模式 + PG 模式双验证
