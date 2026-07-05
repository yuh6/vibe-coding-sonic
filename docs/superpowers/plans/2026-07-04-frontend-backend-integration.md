# Frontend Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Discover、MusicWheel、Mixer、播放列表、电台发布这些“前端已有入口 + 后端已有接口”的能力接成真实可用闭环，并把 RoomWave 真社交能力明确拆到后续独立计划。

**Architecture:** 先复用现有 Express API 和 React 页面结构，不重写路由、不引入新状态管理库。播放入口统一走 `App.jsx` 中的 `usePlayer()`；需要登录的操作通过顶层 `AuthPanel` 打开登录；Discover 页面拆出曲库浏览和播放列表管理两个小组件。电台先以 arranger session 为源，新增 now-playing snapshot 字段解决 `track_pool` 曲目无法直接映射 `shared_library` 的问题。

**Tech Stack:** React 18, Vite, Tailwind CSS, Howler/usePlayer, Express, better-sqlite3/SQLite, optional PostgreSQL migration compatibility, Node smoke tests.

---

## Scope Decision

本计划覆盖推荐优先级中的 Phase 1 + Phase 2：

- MusicWheel 从“模拟播放”改成优先播放后端曲库音频；无真实曲库数据时保留示例曲目但标明为示例。
- Discover 播放列表读取、播放、播放计数、曲目播放计数打通。
- Discover 增加公共曲库浏览、创建我的播放列表、添加曲目到播放列表。
- Mixer 远程 URL 加载前做登录门槛提示，避免用户点击后只看到底层代理 401。
- Arranger session 支持公开为电台，Discover 电台能看到实时 now-playing snapshot 并播放。
- RoomWave 的隐私协议入口和“本地体验模式”提示修正，避免把本地模拟误导成已联网社交。

本计划不实现 RoomWave 真社交房间。那部分需要独立后端模型和实时通道，建议另开计划：

- `roomwave_rooms`
- `roomwave_members`
- `roomwave_messages`
- WebSocket presence/chat
- 消息限流和持久化
- 房间权限、封禁和审计

## Current Findings

已确认可复用后端接口：

- `GET /api/library/shared`
- `GET /api/library/shared/:id`
- `POST /api/library/shared/:id/play`
- `GET /api/recommend/popular`
- `POST /api/recommend/play`
- `GET /api/playlists`
- `GET /api/playlists/:id`
- `POST /api/playlists/:id/play`
- `GET /api/playlists/mine/list`
- `POST /api/playlists`
- `POST /api/playlists/:id/tracks`
- `GET /api/radio`
- `POST /api/radio`
- `POST /api/radio/:id/listen`
- `POST /api/radio/:id/leave`
- `DELETE /api/radio/:id`

当前主要断点：

- `src/components/MusicWheel.jsx` 的播放按钮只改本地状态并提示“正在模拟播放”。
- `src/components/DiscoverPage.jsx` 播放公开播放列表时没有调用 `POST /api/playlists/:id/play`。
- 前端没有公共曲库浏览，也没有创建播放列表和添加曲目入口。
- `src/components/mixer/SourcePanel.jsx` 的远程 URL 会走 `/api/music/proxy`，未登录时后端返回 401，但 UI 没有提前说明。
- `server/services/radioService.js` 的 `current_track_id` 只能 join `shared_library`，而 arranger 当前播放来自 `track_pool`，需要 snapshot 字段。
- `src/components/RoomWave.jsx` 的房间在线数、聊天、成员数据是本地模拟；隐私协议是 clickable-looking span，但没有行为。

## File Structure

Modify:

- `src/lib/api.js`: 增加共享曲库、推荐播放记录、播放列表播放计数、电台 now-playing snapshot API 封装。
- `src/App.jsx`: 传递登录态和登录弹窗回调；维护当前公开电台；在 arranger 当前曲目变化时同步电台 snapshot。
- `src/components/DiscoverPage.jsx`: 连接 MusicWheel、公共曲库、播放列表播放计数、我的播放列表管理。
- `src/components/MusicWheel.jsx`: 接收后端曲目和播放回调；真实曲目走全局播放器；示例曲目保留为无后端数据降级。
- `src/components/SharedLibraryBrowser.jsx`: 新建，负责搜索/筛选共享曲库、播放曲目、把曲目送给播放列表管理组件。
- `src/components/PlaylistManager.jsx`: 新建，负责读取我的播放列表、创建播放列表、把共享曲库曲目添加到播放列表。
- `src/components/mixer/MixerPage.jsx`: 接收 `user` 和 `onRequireAuth` 并传给 `SourcePanel`。
- `src/components/mixer/SourcePanel.jsx`: 远程 URL 在未登录时提示登录，不直接触发代理请求。
- `src/components/ArrangerPanel.jsx`: 增加“公开电台/下线电台”按钮和状态展示。
- `src/components/RoomWave.jsx`: 隐私协议改为可打开本地弹窗；房间视图标注“体验模式，本地聊天”。
- `server/db/migrations.js`: 给 `radio_stations` 增加 now-playing snapshot 兼容迁移函数。
- `server/db/index.js`: 执行兼容迁移。
- `server/services/radioService.js`: 增加 owner 校验的 now-playing snapshot 更新函数；列表和详情返回 snapshot。
- `server/routes/radio.js`: 增加 `PATCH /api/radio/:id/now-playing`。
- `test/smoke.mjs`: 增加共享曲库种子、播放列表、电台发布、now-playing snapshot 的端到端验证。

Do not modify:

- `docs/suno-prompts-16mbti.md`: 这是当前未跟踪文档，不属于本计划。
- RoomWave 的真实聊天后端模型：留给后续独立计划。

---

## Task 1: API Client Coverage

**Files:**

- Modify: `src/lib/api.js`
- Test: `test/smoke.mjs`

- [ ] **Step 1: Add missing API wrappers**

Add these functions to `src/lib/api.js` near the existing library/recommend/playlist/radio sections:

```js
export function getSharedLibrary({ mode, mbti, genre, q, page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (mode) params.set('mode', mode);
  if (mbti) params.set('mbti', mbti);
  if (genre) params.set('genre', genre);
  if (q) params.set('q', q);
  params.set('page', page);
  params.set('limit', limit);
  return request(`/api/library/shared?${params}`);
}

export function recordSharedTrackPlay(trackId) {
  return request(`/api/library/shared/${encodeURIComponent(trackId)}/play`, { method: 'POST' });
}

export function getPopularTracks(limit = 12) {
  const params = new URLSearchParams({ limit });
  return request(`/api/recommend/popular?${params}`);
}

export function recordRecommendedPlay({ trackId, durationSec = null, completed = false }) {
  return request('/api/recommend/play', {
    method: 'POST',
    body: JSON.stringify({ trackId, durationSec, completed }),
  });
}

export function recordPlaylistPlay(playlistId) {
  return request(`/api/playlists/${encodeURIComponent(playlistId)}/play`, { method: 'POST' });
}

export function updateRadioNowPlaying(id, track) {
  return request(`/api/radio/${encodeURIComponent(id)}/now-playing`, {
    method: 'PATCH',
    body: JSON.stringify({ track }),
  });
}
```

- [ ] **Step 2: Run build to catch export errors**

Run:

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/api.js
git commit -m "feat: add frontend API wrappers for library radio and playlists"
```

---

## Task 2: Smoke Test Seed and Backend Contract Coverage

**Files:**

- Modify: `test/smoke.mjs`

- [ ] **Step 1: Add a shared-library test seed helper**

Add this import at the top of `test/smoke.mjs`:

```js
import Database from 'better-sqlite3';
```

Add this helper after `waitForCompletedJob()`:

```js
function seedSharedLibraryTrack(dbPath) {
  const db = new Database(dbPath);
  const track = {
    id: `smoke-shared-${Date.now()}`,
    title: 'Smoke Shared Track',
    mbti: 'INTJ',
    mode: 'focus',
    genre: 'electronic',
    tags: 'smoke,test',
    mood: 'focused',
    bpm: 124,
    audioUrl: '/samples/focus-1.mp3',
    durationSec: 60,
    qualityScore: 0.9,
    createdAt: Date.now(),
  };

  try {
    db.prepare(
      `INSERT INTO shared_library
       (id, title, mbti, mode, genre, tags, mood, bpm, audio_url, duration_sec, quality_score, created_at)
       VALUES (@id, @title, @mbti, @mode, @genre, @tags, @mood, @bpm, @audioUrl, @durationSec, @qualityScore, @createdAt)`
    ).run(track);
    return track;
  } finally {
    db.close();
  }
}
```

- [ ] **Step 2: Seed after the server is healthy**

After:

```js
await waitForServer(client);
```

add:

```js
const sharedTrack = seedSharedLibraryTrack(dbPath);
```

- [ ] **Step 3: Verify shared library, playlist, and radio endpoints**

Add this block after login is confirmed and after the arranger session exists:

```js
const sharedLibrary = await client.request('/api/library/shared?limit=5');
assert.ok(sharedLibrary.tracks.some((track) => track.id === sharedTrack.id));

await client.request(`/api/library/shared/${sharedTrack.id}/play`, { method: 'POST' });
const popular = await client.request('/api/recommend/popular?limit=5');
assert.ok(popular.tracks.some((track) => track.id === sharedTrack.id));

const playlist = await client.request('/api/playlists', {
  method: 'POST',
  body: { title: 'Smoke Playlist', description: 'Created by smoke test' },
});
assert.ok(playlist.id);

await client.request(`/api/playlists/${playlist.id}/tracks`, {
  method: 'POST',
  body: { trackId: sharedTrack.id },
});

const playlistDetail = await client.request(`/api/playlists/${playlist.id}`);
assert.equal(playlistDetail.tracks.length, 1);
assert.equal(playlistDetail.tracks[0].id, sharedTrack.id);

await client.request(`/api/playlists/${playlist.id}/play`, { method: 'POST' });
const playedPlaylist = await client.request(`/api/playlists/${playlist.id}`);
assert.equal(playedPlaylist.playCount, 1);

const station = await client.request('/api/radio', {
  method: 'POST',
  body: {
    title: 'Smoke Radio',
    description: 'Smoke test station',
    sessionId: session.id,
    mode: 'focus',
    mbti: 'INTJ',
  },
});
assert.ok(station.id);

await client.request(`/api/radio/${station.id}/listen`, { method: 'POST' });
const tunedStation = await client.request(`/api/radio/${station.id}`);
assert.equal(tunedStation.listenerCount, 1);

await client.request(`/api/radio/${station.id}/leave`, { method: 'POST' });
await client.request(`/api/radio/${station.id}`, { method: 'DELETE' });
```

- [ ] **Step 4: Run smoke test**

Run:

```bash
npm test
```

Expected:

```text
Smoke tests passed
```

- [ ] **Step 5: Commit**

```bash
git add test/smoke.mjs
git commit -m "test: cover shared library playlists and radio contracts"
```

---

## Task 3: MusicWheel Real Playback

**Files:**

- Modify: `src/components/MusicWheel.jsx`
- Modify: `src/components/DiscoverPage.jsx`
- Modify: `src/lib/api.js`

- [ ] **Step 1: Make MusicWheel accept backend tracks and callbacks**

Change the component signature in `src/components/MusicWheel.jsx`:

```js
export default function MusicWheel({
  backendTracks = [],
  onPlayTrack,
  onRecordTrackPlay,
}) {
```

Add these helpers above the component:

```js
const GENRE_ALIASES = {
  pop: ['pop', '流行'],
  jazz: ['jazz', '爵士'],
  rock: ['rock', '摇滚'],
  hiphop: ['hip-hop', 'hiphop', 'rap', '说唱'],
  classical: ['classical', '古典'],
  electronic: ['electronic', 'edm', '电子'],
  rnb: ['r&b', 'rnb', '节奏蓝调'],
  country: ['country', '乡村'],
  latin: ['latin', '拉丁'],
  metal: ['metal', '重金属'],
  indie: ['indie', '独立'],
  funk: ['funk', '放克'],
};

function matchesGenre(track, genreId) {
  const raw = `${track.genre || ''} ${track.tags || ''}`.toLowerCase();
  return (GENRE_ALIASES[genreId] || [genreId]).some((alias) => raw.includes(alias));
}

function toWheelSong(track) {
  return {
    id: track.id,
    title: track.title || 'Untitled Track',
    artist: [track.mbti, track.mode].filter(Boolean).join(' · ') || 'Shared Library',
    duration: track.durationSec ? `${Math.floor(track.durationSec / 60)}:${String(track.durationSec % 60).padStart(2, '0')}` : '--:--',
    likes: `${track.playCount || 0}`,
    audioUrl: track.audioUrl,
    genre: track.genre,
    source: 'library',
  };
}
```

- [ ] **Step 2: Prefer backend tracks for the active genre**

Replace:

```js
const activeSongs = SONGS_DATABASE[activeGenre.id] || [];
```

with:

```js
const realSongs = backendTracks
  .filter((track) => track?.audioUrl && matchesGenre(track, activeGenre.id))
  .map(toWheelSong);
const activeSongs = realSongs.length ? realSongs : SONGS_DATABASE[activeGenre.id] || [];
const usingRealSongs = realSongs.length > 0;
```

Update the station counter label:

```jsx
{usingRealSongs ? `${activeSongs.length} REAL TRACKS` : `${activeSongs.length} DEMO TRACKS`}
```

- [ ] **Step 3: Replace simulated play behavior**

Replace `handlePlaySong` with:

```js
const handlePlaySong = async (song) => {
  if (currentPlayingSong?.title === song.title && isPlayingAudio) {
    setIsPlayingAudio(false);
    return;
  }

  setCurrentPlayingSong(song);
  setIsPlayingAudio(true);

  if (song.audioUrl) {
    onPlayTrack?.({ audioUrl: song.audioUrl, title: song.title, trackId: song.id });
    if (song.id) onRecordTrackPlay?.(song.id);
    triggerToast(`正在播放: ${song.title}`);
  } else {
    triggerToast(`示例曲目: ${song.title}。曲库暂无该流派真实音频。`);
  }
};
```

- [ ] **Step 4: Load popular tracks in DiscoverPage**

Update imports in `src/components/DiscoverPage.jsx`:

```js
import {
  getLiveRadios,
  joinRadio,
  leaveRadio,
  getPublicPlaylists,
  getPlaylist,
  getPopularTracks,
  recordSharedTrackPlay,
} from '../lib/api';
```

Add state:

```js
const [wheelTracks, setWheelTracks] = useState([]);
```

Add effect:

```js
useEffect(() => {
  getPopularTracks(36)
    .then((data) => setWheelTracks(data.tracks || []))
    .catch(() => setWheelTracks([]));
}, []);
```

Replace:

```jsx
<MusicWheel />
```

with:

```jsx
<MusicWheel
  backendTracks={wheelTracks}
  onPlayTrack={onPlayTrack}
  onRecordTrackPlay={(trackId) => recordSharedTrackPlay(trackId).catch(() => {})}
/>
```

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 6: Commit**

```bash
git add src/components/MusicWheel.jsx src/components/DiscoverPage.jsx src/lib/api.js
git commit -m "feat: connect music wheel to shared library playback"
```

---

## Task 4: Discover Playlist Playback Counts

**Files:**

- Modify: `src/components/DiscoverPage.jsx`

- [ ] **Step 1: Import play-count APIs**

Extend the import:

```js
import {
  getLiveRadios,
  joinRadio,
  leaveRadio,
  getPublicPlaylists,
  getPlaylist,
  getPopularTracks,
  recordPlaylistPlay,
  recordSharedTrackPlay,
} from '../lib/api';
```

- [ ] **Step 2: Record playlist play when a playlist starts**

Replace `handlePlayPlaylist` with:

```js
const handlePlayPlaylist = useCallback(async (pl) => {
  await recordPlaylistPlay(pl.id).catch(() => {});
  setPlaylists((items) =>
    items.map((item) => item.id === pl.id ? { ...item, playCount: (item.playCount || 0) + 1 } : item)
  );

  const detail = await getPlaylist(pl.id);
  setPlaylistDetail(detail);
  if (detail?.tracks?.length) {
    const first = detail.tracks[0];
    if (first.id) recordSharedTrackPlay(first.id).catch(() => {});
    onPlayTrack?.({ audioUrl: first.audioUrl, title: first.title, trackId: first.id });
  }
}, [onPlayTrack]);
```

- [ ] **Step 3: Record per-track play in playlist detail**

Replace the track row `onClick` handler with:

```jsx
onClick={() => {
  if (t.id) recordSharedTrackPlay(t.id).catch(() => {});
  onPlayTrack?.({ audioUrl: t.audioUrl, title: t.title, trackId: t.id });
}}
```

- [ ] **Step 4: Run smoke and build**

```bash
npm test
npm run build
```

Expected:

```text
Smoke tests passed
✓ built in
```

- [ ] **Step 5: Commit**

```bash
git add src/components/DiscoverPage.jsx
git commit -m "feat: record discover playlist playback"
```

---

## Task 5: Shared Library Browser

**Files:**

- Create: `src/components/SharedLibraryBrowser.jsx`
- Modify: `src/components/DiscoverPage.jsx`

- [ ] **Step 1: Create SharedLibraryBrowser component**

Create `src/components/SharedLibraryBrowser.jsx`:

```jsx
import { useEffect, useMemo, useState } from 'react';
import { getSharedLibrary, recordSharedTrackPlay } from '../lib/api';
import { MODES } from '../lib/mbti';

export default function SharedLibraryBrowser({ onPlayTrack, onSelectTrack }) {
  const [mode, setMode] = useState('');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const params = useMemo(() => ({ mode, q: query, limit: 24 }), [mode, query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getSharedLibrary(params)
      .then((data) => {
        if (!cancelled) setTracks(data.tracks || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || '曲库加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

  const play = (track) => {
    if (track.id) recordSharedTrackPlay(track.id).catch(() => {});
    onPlayTrack?.({ audioUrl: track.audioUrl, title: track.title, trackId: track.id });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-white/80">共享曲库</h3>
        <div className="flex min-w-0 flex-1 justify-end gap-2">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
          >
            <option value="">全部模式</option>
            {MODES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题 / 标签"
            className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
          />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">{error}</div>}
      {loading ? (
        <div className="py-6 text-center text-sm text-white/30">曲库加载中...</div>
      ) : tracks.length === 0 ? (
        <div className="py-6 text-center text-sm text-white/30">暂无共享曲目</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {tracks.map((track) => (
            <div key={track.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white/85">{track.title}</div>
                  <div className="truncate text-[11px] text-white/40">
                    {[track.mbti, track.mode, track.genre].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] text-white/30">▶ {track.playCount || 0}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!track.audioUrl}
                  onClick={() => play(track)}
                  className="rounded-lg bg-green-500/15 px-3 py-1.5 text-xs text-green-300 disabled:opacity-40"
                >
                  播放
                </button>
                <button
                  type="button"
                  onClick={() => onSelectTrack?.(track)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
                >
                  加入歌单
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Mount SharedLibraryBrowser inside playlist tab**

In `src/components/DiscoverPage.jsx`, import:

```js
import SharedLibraryBrowser from './SharedLibraryBrowser';
```

Add state:

```js
const [selectedLibraryTrack, setSelectedLibraryTrack] = useState(null);
```

Render it above the playlist list when `tab === 'playlists'`:

```jsx
{tab === 'playlists' && (
  <SharedLibraryBrowser
    onPlayTrack={onPlayTrack}
    onSelectTrack={setSelectedLibraryTrack}
  />
)}
```

Keep the existing public playlists section below the shared library section.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 4: Commit**

```bash
git add src/components/SharedLibraryBrowser.jsx src/components/DiscoverPage.jsx
git commit -m "feat: add shared library browser to discover"
```

---

## Task 6: Playlist Manager

**Files:**

- Create: `src/components/PlaylistManager.jsx`
- Modify: `src/components/DiscoverPage.jsx`

- [ ] **Step 1: Create PlaylistManager component**

Create `src/components/PlaylistManager.jsx`:

```jsx
import { useEffect, useState } from 'react';
import { addToPlaylist, createPlaylist, getMyPlaylists } from '../lib/api';

export default function PlaylistManager({ selectedTrack, onRequireAuth, onAdded }) {
  const [playlists, setPlaylists] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    getMyPlaylists()
      .then((data) => setPlaylists(data.playlists || []))
      .catch((err) => {
        if (err.status === 401) {
          setPlaylists([]);
          return;
        }
        setError(err.message || '我的歌单加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    const safeTitle = title.trim();
    if (!safeTitle) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await createPlaylist({ title: safeTitle, description: description.trim() });
      setTitle('');
      setDescription('');
      setMessage('播放列表已创建');
      load();
    } catch (err) {
      if (err.status === 401) {
        onRequireAuth?.('登录后可以创建播放列表');
        return;
      }
      setError(err.message || '创建播放列表失败');
    } finally {
      setLoading(false);
    }
  };

  const add = async (playlistId) => {
    if (!selectedTrack?.id) {
      setMessage('先从共享曲库选择一首歌');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await addToPlaylist(playlistId, selectedTrack.id);
      setMessage(`已加入: ${selectedTrack.title}`);
      onAdded?.();
      load();
    } catch (err) {
      if (err.status === 401) {
        onRequireAuth?.('登录后可以管理播放列表');
        return;
      }
      setError(err.message || '添加到播放列表失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-white/80">我的播放列表</h3>
        {selectedTrack && <span className="truncate text-[11px] text-indigo-300">已选: {selectedTrack.title}</span>}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="新歌单标题"
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="描述"
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
        />
        <button
          type="button"
          disabled={loading || !title.trim()}
          onClick={create}
          className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs text-indigo-200 disabled:opacity-40"
        >
          创建
        </button>
      </div>

      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
      {message && <div className="mt-2 text-xs text-green-300">{message}</div>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {playlists.map((playlist) => (
          <div key={playlist.id} className="flex items-center gap-2 rounded-lg bg-black/20 p-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white/80">{playlist.title}</div>
              <div className="text-[10px] text-white/35">{playlist.trackCount || 0} 首 · 播放 {playlist.playCount || 0}</div>
            </div>
            <button
              type="button"
              disabled={loading || !selectedTrack?.id}
              onClick={() => add(playlist.id)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60 disabled:opacity-40"
            >
              加入
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Mount PlaylistManager in DiscoverPage**

Import:

```js
import PlaylistManager from './PlaylistManager';
```

Change component signature:

```js
export default function DiscoverPage({ onPlayTrack, onRequireAuth }) {
```

Render below `SharedLibraryBrowser`:

```jsx
{tab === 'playlists' && (
  <PlaylistManager
    selectedTrack={selectedLibraryTrack}
    onRequireAuth={onRequireAuth}
    onAdded={() => getPublicPlaylists().then((d) => setPlaylists(d.playlists || [])).catch(() => {})}
  />
)}
```

- [ ] **Step 3: Pass auth callback from App**

In `src/App.jsx`, replace the Discover route render with:

```jsx
<DiscoverPage
  onPlayTrack={(track) => player.playUrl(track.audioUrl, { title: track.title || '' })}
  onRequireAuth={(message = '登录后可以使用此功能') => {
    setNotice(message);
    setAuthOpen(true);
  }}
/>
```

- [ ] **Step 4: Run build and smoke test**

```bash
npm run build
npm test
```

Expected:

```text
✓ built in
Smoke tests passed
```

- [ ] **Step 5: Commit**

```bash
git add src/components/PlaylistManager.jsx src/components/DiscoverPage.jsx src/App.jsx
git commit -m "feat: add playlist management to discover"
```

---

## Task 7: Mixer Remote URL Login Gate

**Files:**

- Modify: `src/App.jsx`
- Modify: `src/components/mixer/MixerPage.jsx`
- Modify: `src/components/mixer/SourcePanel.jsx`

- [ ] **Step 1: Pass user and auth callback into MixerPage**

In `src/App.jsx`, replace:

```jsx
<MixerPage incomingMix={mixerImport} />
```

with:

```jsx
<MixerPage
  incomingMix={mixerImport}
  user={user}
  onRequireAuth={(message = '登录后才能加载远程音频 URL') => {
    setNotice(message);
    setAuthOpen(true);
  }}
/>
```

- [ ] **Step 2: Forward props in MixerPage**

Change `src/components/mixer/MixerPage.jsx` signature:

```js
export default function MixerPage({ incomingMix, user, onRequireAuth }) {
```

Pass to `SourcePanel`:

```jsx
<SourcePanel
  onAdd={mixer.addTrack}
  onAddMany={mixer.addTracks}
  loading={mixer.loading}
  user={user}
  onRequireAuth={onRequireAuth}
/>
```

- [ ] **Step 3: Gate remote URL in SourcePanel**

Change `src/components/mixer/SourcePanel.jsx` signature:

```js
export default function SourcePanel({ onAdd, onAddMany, loading, user, onRequireAuth }) {
```

Add helper:

```js
function isRemoteHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
```

At the top of `handleUrl`, after `const trimmed = url.trim();`, add:

```js
if (isRemoteHttpUrl(trimmed) && !user) {
  onRequireAuth?.('登录后才能加载远程音频 URL');
  return;
}
```

- [ ] **Step 4: Run build**

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/components/mixer/MixerPage.jsx src/components/mixer/SourcePanel.jsx
git commit -m "fix: gate mixer remote URLs behind login"
```

---

## Task 8: Radio Now-Playing Snapshot Backend

**Files:**

- Modify: `server/db/migrations.js`
- Modify: `server/db/index.js`
- Modify: `server/services/radioService.js`
- Modify: `server/routes/radio.js`
- Modify: `test/smoke.mjs`

- [ ] **Step 1: Add compatibility migration function**

In `server/db/migrations.js`, add this export after `getMigrationSQL()`:

```js
const RADIO_SNAPSHOT_COLUMNS = [
  ['current_track_title', 'TEXT'],
  ['current_track_genre', 'TEXT'],
  ['current_track_bpm', 'INTEGER'],
  ['current_track_audio_url', 'TEXT'],
];

export async function applyCompatibilityMigrations(dal, driver) {
  if (driver === 'pg') {
    await dal.exec(`
      ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS current_track_title TEXT;
      ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS current_track_genre TEXT;
      ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS current_track_bpm INTEGER;
      ALTER TABLE radio_stations ADD COLUMN IF NOT EXISTS current_track_audio_url TEXT;
    `);
    return;
  }

  const rows = await dal.query('PRAGMA table_info(radio_stations)');
  const existing = new Set(rows.map((row) => row.name));
  for (const [name, type] of RADIO_SNAPSHOT_COLUMNS) {
    if (!existing.has(name)) {
      await dal.exec(`ALTER TABLE radio_stations ADD COLUMN ${name} ${type};`);
    }
  }
}
```

- [ ] **Step 2: Run compatibility migrations after base migrations**

In `server/db/index.js`, change the import:

```js
import { applyCompatibilityMigrations, getMigrationSQL } from './migrations.js';
```

After the existing migration execution block, add:

```js
await applyCompatibilityMigrations(dal, DB_DIALECT);
```

- [ ] **Step 3: Add service function**

In `server/services/radioService.js`, add:

```js
export async function updateNowPlayingSnapshot(stationId, userId, track) {
  const title = String(track?.title || track?.moodTag || 'Untitled Track').slice(0, 160);
  const genre = track?.genre ? String(track.genre).slice(0, 120) : null;
  const bpm = Number.isFinite(Number(track?.bpm)) ? Number(track.bpm) : null;
  const audioUrl = track?.audioUrl || track?.audioLocal || null;

  if (!audioUrl) return false;

  const result = await db.prepare(
    `UPDATE radio_stations
     SET current_track_id = NULL,
         current_track_title = ?,
         current_track_genre = ?,
         current_track_bpm = ?,
         current_track_audio_url = ?,
         current_track_started_at = ?
     WHERE id = ? AND user_id = ? AND is_live = 1`
  ).run(title, genre, bpm, audioUrl, Date.now(), stationId, userId);

  return result.changes > 0;
}
```

Update `getStation()` and `listLiveStations()` SELECT clauses to include:

```sql
r.current_track_title, r.current_track_genre, r.current_track_bpm, r.current_track_audio_url,
```

Update `formatStation()` currentTrack:

```js
const snapshotTrack = s.current_track_audio_url ? {
  id: s.current_track_id || null,
  title: s.current_track_title,
  genre: s.current_track_genre,
  bpm: s.current_track_bpm,
  audioUrl: s.current_track_audio_url,
  startedAt: s.current_track_started_at,
} : null;

const sharedTrack = s.current_track_id ? {
  id: s.current_track_id,
  title: s.track_title,
  genre: s.track_genre,
  bpm: s.track_bpm,
  audioUrl: s.track_audio_url,
  startedAt: s.current_track_started_at,
} : null;
```

and return:

```js
currentTrack: snapshotTrack || sharedTrack,
```

- [ ] **Step 4: Add radio route**

In `server/routes/radio.js`, import:

```js
updateNowPlayingSnapshot,
```

Add before `router.delete('/:id', requireUser, ...)`:

```js
router.patch('/:id/now-playing', requireUser, async (req, res) => {
  const ok = await updateNowPlayingSnapshot(req.params.id, req.user.id, req.body?.track);
  if (!ok) return res.status(404).json({ error: 'Station not found, offline, or track has no audioUrl' });
  res.json(await getStation(req.params.id));
});
```

- [ ] **Step 5: Extend smoke test**

After creating `station` in `test/smoke.mjs`, add:

```js
const stationWithTrack = await client.request(`/api/radio/${station.id}/now-playing`, {
  method: 'PATCH',
  body: {
    track: {
      title: 'Smoke Now Playing',
      genre: 'electronic',
      bpm: 124,
      audioUrl: sharedTrack.audioUrl,
    },
  },
});
assert.equal(stationWithTrack.currentTrack.title, 'Smoke Now Playing');
assert.equal(stationWithTrack.currentTrack.audioUrl, sharedTrack.audioUrl);
```

- [ ] **Step 6: Run smoke test**

```bash
npm test
```

Expected:

```text
Smoke tests passed
```

- [ ] **Step 7: Commit**

```bash
git add server/db/migrations.js server/db/index.js server/services/radioService.js server/routes/radio.js test/smoke.mjs
git commit -m "feat: add radio now playing snapshots"
```

---

## Task 9: Publish Arranger Session as Radio

**Files:**

- Modify: `src/App.jsx`
- Modify: `src/components/ArrangerPanel.jsx`
- Modify: `src/lib/api.js`

- [ ] **Step 1: Add radio state and handlers in App**

In `src/App.jsx`, add imports:

```js
startRadio,
stopRadio,
updateRadioNowPlaying,
```

Add state:

```js
const [liveStation, setLiveStation] = useState(null);
const [radioBusy, setRadioBusy] = useState(false);
```

Add handler:

```js
const handleRadioToggle = async () => {
  if (liveStation) {
    setRadioBusy(true);
    try {
      await stopRadio(liveStation.id);
      setLiveStation(null);
      setNotice('电台已下线');
    } finally {
      setRadioBusy(false);
    }
    return;
  }

  if (!user) {
    setNotice('登录后可以公开电台');
    setAuthOpen(true);
    return;
  }

  if (!arranger.sessionId) {
    setNotice('先开始编排，再公开为电台');
    return;
  }

  setRadioBusy(true);
  try {
    const station = await startRadio({
      title: `${projectName || 'Vibe Coding'} · ${mbti} Radio`,
      description: projectDesc || '',
      sessionId: arranger.sessionId,
      mode: arranger.phase || mode,
      mbti,
    });
    setLiveStation(station);
    setNotice('电台已公开');
  } catch (err) {
    if (err.status === 401) {
      setAuthOpen(true);
      setNotice('登录后可以公开电台');
    } else {
      setNotice(err.message || '电台公开失败');
    }
  } finally {
    setRadioBusy(false);
  }
};
```

- [ ] **Step 2: Sync arranger now-playing to radio**

In `src/App.jsx`, add:

```js
useEffect(() => {
  if (!liveStation?.id || !arranger.nowPlayingTrack) return;
  const track = arranger.nowPlayingTrack;
  const audioUrl = track.audioLocal || track.audioUrl;
  if (!audioUrl) return;

  updateRadioNowPlaying(liveStation.id, {
    title: track.title || track.moodTag || `${track.genre || 'Live'} Track`,
    genre: track.genre,
    bpm: track.bpm,
    audioUrl,
  }).catch((err) => {
    console.error('[radio now-playing]', err);
  });
}, [liveStation?.id, arranger.nowPlayingTrack]);
```

- [ ] **Step 3: Pass radio props to ArrangerPanel**

Update the `ArrangerPanel` render:

```jsx
<ArrangerPanel
  arranger={arranger}
  theme={theme}
  onStart={handleArrangerStart}
  onStop={handleArrangerStop}
  onPhaseChange={handleArrangerPhaseChange}
  onFeedback={handleArrangerFeedback}
  liveStation={liveStation}
  radioBusy={radioBusy}
  onRadioToggle={handleRadioToggle}
/>
```

- [ ] **Step 4: Add UI in ArrangerPanel**

Change signature:

```js
export default function ArrangerPanel({
  arranger,
  theme,
  onStart,
  onStop,
  onPhaseChange,
  onFeedback,
  liveStation,
  radioBusy,
  onRadioToggle,
}) {
```

Add this button next to the start/stop button:

```jsx
<button
  type="button"
  onClick={onRadioToggle}
  disabled={radioBusy || (!running && !liveStation)}
  className={`pad px-3 py-1.5 text-xs disabled:opacity-50 ${liveStation ? 'pad-active' : ''}`}
>
  {radioBusy ? '处理中...' : liveStation ? '📻 下线电台' : '📻 公开'}
</button>
```

Add status under the error line:

```jsx
{liveStation && (
  <div className="mb-2 rounded-lg border border-green-500/20 bg-green-500/10 px-2 py-1.5 text-[11px] text-green-300">
    电台公开中: {liveStation.title}
  </div>
)}
```

- [ ] **Step 5: Verify in browser and build**

Run:

```bash
npm run build
```

Manual browser check:

1. Open `http://localhost:5173/#/`.
2. Login.
3. Click `开始编排`.
4. Click `公开`.
5. Open `http://localhost:5173/#/discover`.
6. The radio tab shows the station.
7. Click the station and the player starts if `currentTrack.audioUrl` is present.

Expected build:

```text
✓ built in
```

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/components/ArrangerPanel.jsx src/lib/api.js
git commit -m "feat: publish arranger sessions as radio stations"
```

---

## Task 10: RoomWave Honest UX Fixes

**Files:**

- Modify: `src/components/RoomWave.jsx`

- [ ] **Step 1: Add privacy modal state**

Add state near other RoomWave state:

```js
const [showPrivacy, setShowPrivacy] = useState(false);
```

- [ ] **Step 2: Replace privacy span with button**

Replace the current privacy span with:

```jsx
<button
  type="button"
  onClick={() => setShowPrivacy(true)}
  className="ml-1 text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline"
>
  隐私协议
</button>
```

- [ ] **Step 3: Add local privacy modal**

Add near the bottom of the component before the outer closing element:

```jsx
{showPrivacy && (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
    <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-200 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold">隐私协议</h3>
        <button
          type="button"
          onClick={() => setShowPrivacy(false)}
          className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-white"
        >
          关闭
        </button>
      </div>
      <div className="space-y-2 text-sm leading-6 text-zinc-400">
        <p>当前 RoomWave 房间、聊天和在线人数为本地体验模式，不会上传聊天内容。</p>
        <p>登录信息和音乐生成请求沿用主应用后端接口；真实多人房间上线前，会补充房间成员、消息存储和实时同步规则。</p>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 4: Add local mode label to room view**

Near the room title area, add:

```jsx
<span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
  本地体验模式
</span>
```

- [ ] **Step 5: Run build**

```bash
npm run build
```

Expected:

```text
✓ built in
```

- [ ] **Step 6: Commit**

```bash
git add src/components/RoomWave.jsx
git commit -m "fix: clarify roomwave local experience state"
```

---

## Task 11: Final Verification

**Files:**

- Verify only

- [ ] **Step 1: Check git diff**

```bash
git diff --check
git status --short
```

Expected:

```text
git diff --check
```

prints no output. `git status --short` only shows intentional changes or is clean after commits.

- [ ] **Step 2: Run full automated checks**

```bash
npm test
npm run build
```

Expected:

```text
Smoke tests passed
✓ built in
```

- [ ] **Step 3: Manual app pass**

With the existing dev server or a fresh server:

```bash
npm run dev
```

Manual checks:

- `#/discover`: MusicWheel plays real shared-library tracks when backend has data; otherwise says demo track.
- `#/discover`: Public playlist play increments count and starts first track.
- `#/discover`: Shared library search can play tracks and select a track.
- `#/discover`: Logged-in user can create playlist and add selected shared-library track.
- `#/mixer`: Logged-out remote URL load opens login notice instead of hidden 401.
- `#/`: Logged-in user can start arranger and publish radio.
- `#/discover`: Radio tab can join the published station and play now-playing snapshot.
- `#/roomwave`: Privacy协议 opens modal; room view shows local experience label.

- [ ] **Step 4: Final commit if any verification-only edits were needed**

```bash
git add .
git commit -m "chore: finalize frontend backend integration"
```

Only run this commit if Step 1-3 required additional edits.

---

## Risk Notes

- Playlist add requires a `shared_library.id`; generated personal tracks in `tracks` table cannot be added until the backend supports publishing personal tracks to shared library.
- `POST /api/recommend/play` requires login, but `POST /api/library/shared/:id/play` is public. Use the public endpoint for anonymous Discover playback counts.
- Radio now-playing snapshot stores audio URL metadata directly on `radio_stations` because arranger uses `track_pool`, not `shared_library`.
- If production uses PostgreSQL, `applyCompatibilityMigrations()` must be verified once with `DB_DRIVER=pg` before deploy.
- RoomWave real social should not be mixed into this integration pass; it has separate data, realtime, moderation, and rate-limit requirements.

## Suggested Commit Order

1. `feat: add frontend API wrappers for library radio and playlists`
2. `test: cover shared library playlists and radio contracts`
3. `feat: connect music wheel to shared library playback`
4. `feat: record discover playlist playback`
5. `feat: add shared library browser to discover`
6. `feat: add playlist management to discover`
7. `fix: gate mixer remote URLs behind login`
8. `feat: add radio now playing snapshots`
9. `feat: publish arranger sessions as radio stations`
10. `fix: clarify roomwave local experience state`

## Self-Review

- Spec coverage: The plan covers all currently identified front/back gaps except RoomWave real multi-user social, which is explicitly deferred to a separate backend-heavy plan.
- Placeholder scan: No task depends on an undefined endpoint; every new endpoint wrapper maps to an existing route or a route added in Task 8.
- Type consistency: Track payloads use `{ id, title, genre, bpm, audioUrl }`; playlist payloads use `{ title, description }`; radio now-playing snapshot uses `{ track }` in request body.
- Test coverage: Smoke tests cover shared-library seed, playlist create/add/play, radio create/listen/leave/delete, and now-playing snapshot.
