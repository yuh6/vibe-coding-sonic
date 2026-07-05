# 接通后端未使用的 API（收藏/评分/历史/推荐/歌单管理/曲库补全）

## 目标
把后端已实现但前端零调用的端点全部接上，只加前端 + api.js 封装，**后端一行不改**。

## 范围（对应盘点结果）
| 后端端点 | 前端接入点 |
|---|---|
| `favorites` 全套（收藏+评分 7 端点） | 共享曲库卡片 ❤️+⭐ |
| `recommend/for-you`、`recommend/history` | 发现页新增 Tab |
| `playlists` PUT/DELETE、DELETE tracks | PlaylistManager 完整管理 |
| `library/shared/stats`、`shared/:id` | 曲库顶部统计条 |

## 决策（已与用户确认）
- 收藏/评分：加在**共享曲库卡片**（主入口）
- 我的收藏/历史/猜你喜欢：发现页**新增 Tab** 集中呈现
- 歌单：**完整管理**（改名 + 删除 + 移除单曲 + 公开切换）

---

## Step 1 — `src/lib/api.js` 补全封装（纯新增，约 12 个函数）

```js
// ── 收藏 + 评分 ──
export function getFavorites({ page=1, limit=20 } = {})   // GET /api/favorites
export function addFavorite(trackId)                       // POST /api/favorites/:trackId
export function removeFavorite(trackId)                    // DELETE /api/favorites/:trackId
export function getFavoriteStatus(trackId)                 // GET /api/favorites/:trackId/status
export function rateTrack(trackId, score)                  // POST /api/favorites/:trackId/rate {score}
export function getMyRating(trackId)                       // GET /api/favorites/:trackId/my-rating
export function getTrackRatings(trackId)                   // GET /api/favorites/:trackId/ratings

// ── 推荐 + 历史 ──
export function getForYou(limit=12)                        // GET /api/recommend/for-you
export function getMyHistory({ page=1, limit=30 } = {})    // GET /api/recommend/history

// ── 歌单管理 ──
export function updatePlaylist(id, { title, description, isPublic })  // PUT /api/playlists/:id
export function deletePlaylist(id)                         // DELETE /api/playlists/:id
export function removeFromPlaylist(playlistId, trackId)    // DELETE /api/playlists/:id/tracks/:trackId

// ── 曲库补全 ──
export function getSharedStats()                           // GET /api/library/shared/stats
export function getSharedTrack(id)                         // GET /api/library/shared/:id
```
注意：`favorites`/`recommend/for-you`/`recommend/history`/`playlists` 写操作都需登录 → 401 走 `onRequireAuth`。
`request()` 的 admin-token 只对 `/api/config`+`/api/library` 附加，这里 favorites/recommend 不受影响（用 cookie 会话）。

## Step 2 — 收藏/评分 UI 组件 `src/components/TrackActions.jsx`（🆕 小组件）
可复用的「❤️ 收藏 + ⭐⭐⭐⭐⭐ 评分」按钮组，供曲库卡片使用：
- props: `{ trackId, user, onRequireAuth, compact }`
- 挂载时（若登录）拉 `getFavoriteStatus` + `getMyRating`；始终拉 `getTrackRatings` 显示平均分/人数
- ❤️ toggle → add/removeFavorite（乐观更新，401 → onRequireAuth）
- ⭐ hover 预览、click 提交 `rateTrack`，提交后刷新平均分
- 未登录点击 → onRequireAuth 提示，不报错

## Step 3 — `SharedLibraryBrowser.jsx` 接入
- 顶部加统计条：挂载拉 `getSharedStats()`，显示「共 N 首 · M 种风格」（stats 结构运行时读，容错渲染）
- 每张卡片底部按钮行右侧插入 `<TrackActions trackId={track.id} user onRequireAuth compact />`
- 新增 props `user`、`onRequireAuth`（从 DiscoverPage 透传）

## Step 4 — `PlaylistManager.jsx` 完整管理
- 每个歌单行增加：✏️ 改名（inline input）、🌐 公开切换、🗑️ 删除（二次确认）
  - 改名/公开 → `updatePlaylist`，删除 → `deletePlaylist`，成功后 `load()`
- 新增「展开歌单」：点歌单名 → `getPlaylist(id)` 拉详情，列出曲目，每曲 🗑️ → `removeFromPlaylist`
  - 复用现有 message/error/loading 模式
- 全部写操作 401 → onRequireAuth

## Step 5 — 发现页新增 Tab `src/components/DiscoverPage.jsx`
顶部 Tab 从 2 个（电台/播放列表）扩为 **5 个**：电台 / 播放列表 / ❤️收藏 / 🕐历史 / ✨猜你喜欢
- `favorites` tab：登录拉 `getFavorites()`，列表复用曲目行样式，点击播放 + recordRecommendedPlay
- `history` tab：`getMyHistory()`，显示曲目 + 播放时间（Intl 格式化）
- `for-you` tab：`getForYou()`，冷启动后端已兜底热门
- 三者未登录时显示「登录后查看」+ onRequireAuth 按钮
- 播放统一走 `onPlayTrack` + `recordRecommendedPlay({trackId})`（顺带接通 recommend/play——已封装但之前仅曲库用）
- 抽一个内部 `<TrackList tracks onPlay emptyHint />` 复用渲染，避免三处重复

## Step 6 — 透传 props
`App.jsx:507` 的 `<DiscoverPage>` 已传 `user`/`onRequireAuth`（Step 3 需要），确认无需改 App.jsx。
若未传则补上（读 507 行附近确认）。

## 验收
1. `npm run build` 通过
2. 曲库卡片：登录后 ❤️ 可收藏、⭐ 可评分，平均分显示；未登录点击弹登录提示
3. 发现页 5 个 Tab 切换正常，收藏/历史/猜你喜欢登录后有数据、未登录有提示
4. 歌单：可改名、切公开、删除、展开后移除单曲
5. 现有功能（电台收听、曲库播放、加入歌单、DJ 台）不受影响

## 风险
- 未登录态：favorites/recommend GET 也需登录（requireUser）→ 必须先判 user 再请求，避免满屏 401
- stats/for-you 返回结构未逐字段验证 → UI 容错渲染（可选链 + 默认值）
- TrackActions 每卡挂载都请求 ratings → 曲库 24 卡会有 24 个并发请求；用 compact 模式合并（评分仅在展开/hover 时拉，或接受这点开销，量不大）
