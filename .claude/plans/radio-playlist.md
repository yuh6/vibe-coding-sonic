# 电台/音乐流功能 — 收听他人音乐 + 共享播放列表

## 核心概念

用户不想自己生成音乐时，可以：
1. **收听其他用户的实时电台** — 实时同步某个 arranger session 的 now-playing
2. **浏览公开播放列表** — 由用户/系统策划的歌曲合集，一键顺序/随机播放
3. **歌曲总库电台** — 系统自动按 mode/genre 不断播放总库歌曲（类似自动 DJ）

## 方案设计

### 新建数据库表

```sql
-- 播放列表
CREATE TABLE IF NOT EXISTS playlists (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  cover_url   TEXT,
  is_public   INTEGER DEFAULT 1,     -- 公开/私有
  play_count  INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playlists_public ON playlists(is_public, play_count DESC);

-- 播放列表曲目
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL,               -- shared_library.id
  position    INTEGER NOT NULL,            -- 排序位置
  added_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks ON playlist_tracks(playlist_id, position);

-- 电台（实时音乐流）
CREATE TABLE IF NOT EXISTS radio_stations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  mode        TEXT,                         -- 当前阶段
  mbti        TEXT,                         -- 创建者 MBTI
  is_live     INTEGER DEFAULT 0,           -- 是否正在直播
  listener_count INTEGER DEFAULT 0,
  current_track_id TEXT,                   -- 当前播放的 shared_library.id
  current_track_started_at INTEGER,
  session_id  TEXT,                         -- 关联的 arranger session（可选）
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radio_live ON radio_stations(is_live, listener_count DESC);
```

### 新建路由

```
=== 播放列表 ===
GET    /api/playlists              — 浏览公开播放列表（?sort=popular|newest）
POST   /api/playlists              — 创建播放列表（需登录）
GET    /api/playlists/:id          — 播放列表详情 + 曲目
PUT    /api/playlists/:id          — 编辑（仅所有者）
DELETE /api/playlists/:id          — 删除（仅所有者）
POST   /api/playlists/:id/tracks   — 添加曲目
DELETE /api/playlists/:id/tracks/:trackId — 移除曲目
POST   /api/playlists/:id/play     — 记录播放

=== 电台/直播流 ===
GET    /api/radio                  — 浏览在线电台
GET    /api/radio/:id              — 电台详情 + 当前曲目
POST   /api/radio                  — 开始广播（将自己的 arranger session 公开）
PUT    /api/radio/:id              — 更新电台状态
DELETE /api/radio/:id              — 下线电台
POST   /api/radio/:id/listen       — 加入收听（listener_count++）
POST   /api/radio/:id/leave        — 离开收听（listener_count--）

=== WebSocket 电台订阅 ===
WS /ws/radio?stationId=xxx        — 订阅电台实时事件（track_change, phase_change）
```

### WebSocket 电台推送

当电台的 arranger session 切歌时：
1. `arrangerEvents` 发出 `track_change` 事件
2. `ws/radio.js` 广播给所有 stationId 订阅者
3. 订阅者前端收到 `{type: 'track_change', payload: {trackId, audioUrl, title, bpm}}` → 自动播放

### 新建服务

**`server/services/radioService.js`**:
- `goLive(userId, sessionId, title)` — 创建电台，将 arranger session 公开
- `goOffline(stationId)` — 下线
- `updateNowPlaying(stationId, trackId)` — 切歌时更新
- `getListenerCount(stationId)`

**`server/services/playlistService.js`**:
- `createPlaylist(userId, {title, description})` — 创建
- `addTrackToPlaylist(playlistId, trackId)` — 加曲
- `getPlaylistWithTracks(playlistId)` — 详情+曲目（JOIN shared_library）
- `listPublicPlaylists({sort, page, limit})` — 浏览

### 前端组件

**`src/components/RadioBrowser.jsx`**:
- 在线电台列表（头像 + 标题 + 阶段 + 听众数 + 当前曲目）
- 点击 → 连接 WS + 开始播放
- "同步收听"状态指示器

**`src/components/PlaylistBrowser.jsx`**:
- 公开播放列表网格（封面 + 标题 + 曲目数 + 播放次数）
- 点击进入 → 曲目列表 → 一键播放全部

### 集成到现有架构

- arranger engine 切歌时（`arranger/index.js` 的 `decideNext`），同步广播到 radio subscribers
- 前端加入新 tab/页面：`#/discover`（发现音乐 = 电台 + 播放列表 + 总库）
- 播放使用现有 `usePlayer` hook

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `server/db.js` | +3 表 (playlists, playlist_tracks, radio_stations) |
| `server/services/playlistService.js` | 新建 — CRUD + 查询 |
| `server/services/radioService.js` | 新建 — 电台状态管理 |
| `server/routes/playlists.js` | 新建 — 8 个端点 |
| `server/routes/radio.js` | 新建 — 7 个端点 |
| `server/ws/radio.js` | 新建 — 电台 WebSocket 推送 |
| `server/ws/events.js` | 挂载 radio ws |
| `server/index.js` | 注册路由 |
| `src/components/RadioBrowser.jsx` | 新建 — 电台列表 UI |
| `src/components/PlaylistBrowser.jsx` | 新建 — 播放列表 UI |
| `src/lib/api.js` | +电台/播放列表 API 客户端 |
| `src/App.jsx` | +#/discover 路由 + 集成 |

## 执行顺序

1. 数据库 schema (db.js)
2. playlistService + routes
3. radioService + routes + ws
4. 前端 API client
5. PlaylistBrowser 组件
6. RadioBrowser 组件
7. App.jsx 集成 #/discover
