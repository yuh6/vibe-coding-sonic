# 多用户系统 · 架构设计 v1

> 目标：部署到公网后，不同用户各自登录、维护独立档案、用自己的配额生成音乐。
> 费用模型：**平台统一 TTAPI/LLM Key + 每人每日配额**。

---

## 1. 设计决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 费用模型 | 平台 Key + 每人配额 | 用户零门槛（无需注册 TTAPI/充值/贴 Key）；财务风险用配额 + 全局预算熔断兜住 |
| 身份方案 | 自实现最小认证（scrypt + session cookie） | 依赖为零、离线可测、代码 <200 行；公开运营时可平滑替换为 better-auth/OAuth |
| 数据库 | SQLite（better-sqlite3，WAL 模式） | 单实例百人级完全够用；单文件备份即全量备份 |
| 音频资产 | 生成成功即落盘 `server/data/audio/`（预留 R2 迁移） | TTAPI CDN URL 会过期，不落盘用户的音乐就丢了 |
| 会话载体 | httpOnly cookie（SameSite=Lax，30 天） | 免 token 管理，天然防 XSS 窃取 |

## 2. 架构变化

```
改造前（单用户）                改造后（多用户）
┌──────────────┐              ┌────────────────────────────┐
│ 前端（匿名）   │              │ 前端 + 登录态（cookie）      │
└──────┬───────┘              └──────┬─────────────────────┘
       │                             │
┌──────┴───────┐              ┌──────┴─────────────────────┐
│ Express      │              │ Express                     │
│ 全局 config   │              │ ├ requireUser 中间件        │
│ 内存 jobs     │              │ ├ 配额检查（每日 N 首）      │
│ JSON 文件     │              │ └ 全局预算熔断              │
└──────────────┘              ├────────────────────────────┤
                              │ SQLite                      │
                              │ users / sessions / profiles │
                              │ tracks / quotas             │
                              ├────────────────────────────┤
                              │ 音频落盘 server/data/audio/  │
                              └────────────────────────────┘
```

不变的部分：TTAPI/LLM 供应商层、promptComposer、编排引擎设计、调音台前端。

## 3. 数据模型

```sql
CREATE TABLE users (
  id            TEXT PRIMARY KEY,           -- uuid
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,              -- scrypt: salt:hash
  name          TEXT NOT NULL,
  role          TEXT DEFAULT 'user',        -- user | admin
  created_at    INTEGER NOT NULL
);

CREATE TABLE auth_sessions (
  token      TEXT PRIMARY KEY,              -- 随机 256bit
  user_id    TEXT NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users(id),
  axes_json  TEXT,                          -- MBTI 四轴 { ie, ns, tf, jp }
  style_json TEXT,                          -- 风格滑块 { energy, texture, brightness }
  mode       TEXT,                          -- 默认阶段
  updated_at INTEGER
);

CREATE TABLE tracks (
  id          TEXT PRIMARY KEY,             -- 复用 jobId
  user_id     TEXT NOT NULL REFERENCES users(id),
  title       TEXT,
  mbti        TEXT,
  mode        TEXT,
  prompt      TEXT,                         -- fullPrompt
  audio_url   TEXT,                         -- 远端 URL（可能过期）
  tracks_json TEXT,                         -- 分轨列表（含 stems）
  fallback    INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE quotas (
  user_id TEXT NOT NULL,
  day     TEXT NOT NULL,                    -- YYYY-MM-DD
  used    INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
```

## 4. 配额与预算护栏

```
用户点「生成」
   ↓
requireUser：未登录 → 401，前端弹登录框
   ↓
配额检查：今日 used >= QUOTA_PER_DAY(默认5) → 429 + 明日重置时间
   ↓
全局预算：全站今日生成数 >= GLOBAL_DAILY_LIMIT(默认100) → 503 兜底模式
   ↓
配额 +1（提交时扣，不退——失败自动走兜底曲库，用户仍得到音乐）
   ↓
提交 TTAPI → 完成后 tracks 表落库（归属该用户）
```

- 兜底播放（`forceFallback` / 预览 prompt）**不消耗配额**——花钱的才计数
- 配额、预算上限走环境变量：`QUOTA_PER_DAY`、`GLOBAL_DAILY_LIMIT`

## 5. API 变化

```
新增：
POST   /api/auth/register        # 注册（email + password + name）
POST   /api/auth/login           # 登录 → 种 cookie
POST   /api/auth/logout          # 登出
GET    /api/auth/me              # 当前用户 + 今日配额
GET    /api/profile              # 我的档案（MBTI/风格偏好）
PUT    /api/profile              # 保存档案
GET    /api/tracks               # 我的音乐列表

改造：
POST /api/music/generate   requireAdmin → requireUser + 配额（previewOnly 仍公开）
GET  /api/music/proxy      加 requireUser（原为无鉴权开放代理，公网必炸）
/api/config/*              仍走 ADMIN_TOKEN（平台管理员专用）
```

## 6. 安全收口（公网部署前置条件）

| 项 | 措施 |
|----|------|
| 开放代理 | `/api/music/proxy` 加登录校验；仅允许 http/https |
| CORS | 生产环境收紧到自己的域名 |
| 密码 | scrypt（node:crypto 内置），随机 salt，恒定时间比较 |
| Session | httpOnly + SameSite=Lax，30 天过期，登出即删 |
| 限流 | 认证接口按 IP 限流（防爆破）；生成接口按 user 限流 |
| 密钥 | 平台 Key 只存 `runtime-config.json`（已 gitignore）/ 环境变量 |

## 7. 前端变化

- 顶栏：未登录显示「登录」按钮 → 弹登录/注册面板；已登录显示用户名 + 今日剩余配额 + 登出
- 生成按钮：401 时自动弹登录框，429 时提示「今日配额已用完，明天再来（或听兜底曲库）」
- 档案：登录后自动拉取档案恢复 MBTI/风格滑块；调整后防抖保存
- 我的音乐：列表页展示历史生成，可一键载入调音台

## 8. 部署

```
单实例：Fly.io / Railway / 自己的 VPS
  ├─ node server/index.js（NODE_ENV=production，Express 托管前端静态文件）
  ├─ 持久卷挂 server/data/（SQLite + 音频缓存 + runtime-config）
  └─ 环境变量：ADMIN_TOKEN / QUOTA_PER_DAY / GLOBAL_DAILY_LIMIT / TTAPI_KEY(或后台配置)
```

## 9. 分期

- **Phase 1（本分支）**：认证 + 配额 + tracks 归属 + proxy 收口 + 前端登录态 ✅
- **Phase 2**：音频落盘迁 R2、档案页完善、混音快照迁服务端
- **Phase 3**：管理员用量面板、邮箱验证、OAuth（GitHub）、订阅/BYOK 高级档
