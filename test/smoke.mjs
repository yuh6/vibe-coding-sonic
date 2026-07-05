import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import Database from 'better-sqlite3';

async function getFreePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  server.close();
  await once(server, 'close');
  return port;
}

function setCookieValues(headers) {
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

class SmokeClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  cookieHeader() {
    return [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
  }

  storeCookies(headers) {
    for (const cookie of setCookieValues(headers)) {
      const pair = cookie.split(';')[0];
      const idx = pair.indexOf('=');
      if (idx > 0) this.cookies.set(pair.slice(0, idx), pair.slice(idx + 1));
    }
  }

  async request(path, { method = 'GET', body, headers = {} } = {}) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(this.cookies.size ? { Cookie: this.cookieHeader() } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    this.storeCookies(res.headers);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.error || `Request failed: ${res.status}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }
}

async function waitForServer(client, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const health = await client.request('/api/health');
      assert.equal(health.ok, true);
      return health;
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw lastError || new Error('Server did not become healthy');
}

async function waitForCompletedJob(client, jobId, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let latest;
  while (Date.now() < deadline) {
    latest = await client.request(`/api/music/status/${jobId}`);
    if (latest.status === 'completed') return latest;
    if (latest.status === 'failed') throw new Error(`Music job failed: ${latest.error || 'unknown error'}`);
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`Music job did not complete in time; latest status: ${latest?.status || 'unknown'}`);
}

function seedSharedLibraryTrack(dbFilePath) {
  const sdb = new Database(dbFilePath);
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
    sdb.prepare(
      `INSERT INTO shared_library
       (id, title, mbti, mode, genre, tags, mood, bpm, audio_url, duration_sec, quality_score, created_at)
       VALUES (@id, @title, @mbti, @mode, @genre, @tags, @mood, @bpm, @audioUrl, @durationSec, @qualityScore, @createdAt)`
    ).run(track);
    return track;
  } finally {
    sdb.close();
  }
}

const tmpRoot = await mkdtemp(join(tmpdir(), 'vibe-coding-sonic-smoke-'));
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const dbPath = join(tmpRoot, 'smoke.db');
const server = spawn(process.execPath, ['server/index.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    HOST: '127.0.0.1',
    PORT: String(port),
    DB_PATH: dbPath,
    USE_FALLBACK_ONLY: 'true',
    DISABLE_LLM: 'true',
    LLM_PROVIDER: 'none',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
server.stdout.on('data', (chunk) => {
  serverOutput += chunk.toString();
});
server.stderr.on('data', (chunk) => {
  serverOutput += chunk.toString();
});

try {
  const client = new SmokeClient(baseUrl);
  await waitForServer(client);
  const sharedTrack = seedSharedLibraryTrack(dbPath);

  const guestMe = await client.request('/api/auth/me');
  assert.equal(guestMe.user.isGuest, true);
  assert.equal(guestMe.quota.limit, 5);
  assert.ok(client.cookies.has('vibe_guest'));

  const guestNotes = await client.request('/api/notes/parse', {
    method: 'POST',
    body: { text: 'happy synth drive' },
  });
  assert.ok(Array.isArray(guestNotes.keywords));

  const email = `smoke-${Date.now()}@example.test`;
  const password = 'smoke-pass-123';
  const registered = await client.request('/api/auth/register', {
    method: 'POST',
    body: { email, password, name: 'Smoke Test' },
  });
  assert.equal(registered.user.email, email);
  assert.ok(client.cookies.has('vibe_session'));

  await client.request('/api/auth/logout', { method: 'POST' });
  assert.equal(client.cookies.get('vibe_session'), '');

  const loggedIn = await client.request('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(loggedIn.user.email, email);
  assert.ok(client.cookies.get('vibe_session'));

  const me = await client.request('/api/auth/me');
  assert.equal(me.user.email, email);

  const quotaSettings = await client.request('/api/config/quota-settings');
  assert.equal(quotaSettings.guestLimit, 5);
  assert.equal(quotaSettings.userLimit, 5);

  const adminUsers = await client.request('/api/config/users');
  assert.ok(adminUsers.users.some((user) => user.email === email));

  const sharedStats = await client.request('/api/library/shared/stats');
  assert.equal(typeof sharedStats.total, 'number');

  const fallbackLibrary = await client.request('/api/library');
  assert.ok(fallbackLibrary.personality?.some((track) => track.mbti === 'INTJ'));

  const mbtiFallback = await client.request('/api/music/fallback?mode=focus&mbti=INTJ');
  assert.equal(mbtiFallback.id, 'personality-intj-a');
  assert.equal(mbtiFallback.mbti, 'INTJ');

  const startupFallback = await client.request('/api/music/fallback?mode=startup&mbti=INTJ');
  assert.equal(startupFallback.id, 'startup-horizon-a');
  assert.equal(startupFallback.mode, 'startup');
  assert.ok(startupFallback.audioUrl?.startsWith('/samples/'));

  const playlists = await client.request('/api/playlists/mine/list');
  assert.ok(Array.isArray(playlists.playlists));

  // ── 共享曲库 / 播放列表 / 电台 合约测试 ──
  const sharedLibrary = await client.request('/api/library/shared?limit=5');
  assert.ok(sharedLibrary.tracks.some((t) => t.id === sharedTrack.id));

  await client.request(`/api/library/shared/${sharedTrack.id}/play`, { method: 'POST' });
  await client.request('/api/recommend/play', {
    method: 'POST',
    body: { trackId: sharedTrack.id, durationSec: 12.7, completed: true },
  });
  const history = await client.request('/api/recommend/history?limit=5');
  assert.equal(history.history[0].trackId, sharedTrack.id);
  assert.equal(history.history[0].durationSec, 13);

  const popular = await client.request('/api/recommend/popular?limit=5');
  assert.ok(popular.tracks.some((t) => t.id === sharedTrack.id));

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

  const axes = { ie: 25, ns: 70, tf: 35, jp: 80 };
  const style = { energy: 60, texture: 35, brightness: 65 };
  const projectAnalysis = {
    themes: ['testing', 'music automation'],
    mood: ['focused'],
    instruments: ['synth bass'],
  };

  const notes = await client.request('/api/notes/parse', {
    method: 'POST',
    body: { text: 'happy synth drive, no vocals' },
  });
  assert.ok(Array.isArray(notes.keywords));
  assert.ok(Array.isArray(notes.mood));
  assert.ok(Array.isArray(notes.avoid));

  const session = await client.request('/api/session', {
    method: 'POST',
    body: {
      name: 'Smoke Session',
      mbtiType: 'INTJ',
      mbtiSliders: axes,
      schedule: { phases: [] },
    },
  });
  assert.ok(session.id);
  const poolStatus = await client.request(`/api/arranger/pool-status?sessionId=${session.id}`);
  assert.equal(typeof poolStatus.budgetLimit, 'number');
  assert.equal(typeof poolStatus.phases, 'object');

  const arrangerStarted = await client.request('/api/arranger/start', {
    method: 'POST',
    body: { sessionId: session.id },
  });
  assert.equal(arrangerStarted.ok, true);
  assert.ok(arrangerStarted.decision?.track?.audioUrl?.startsWith('/samples/'));
  assert.equal(arrangerStarted.decision.track.promptConfig?.fallback, true);

  // ── 电台合约测试（需要 session.id）──
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

  await client.request(`/api/radio/${station.id}/leave`, { method: 'POST' });
  await client.request(`/api/radio/${station.id}`, { method: 'DELETE' });

  const preview = await client.request('/api/music/generate', {
    method: 'POST',
    body: { axes, mode: 'focus', style, projectAnalysis, previewOnly: true },
  });
  assert.equal(preview.preview, true);
  assert.equal(typeof preview.fullPrompt, 'string');
  assert.ok(preview.fullPrompt.length > 20);
  assert.ok(preview.layers?.mbti);
  assert.ok(preview.layers?.project);

  const generated = await client.request('/api/music/generate', {
    method: 'POST',
    body: {
      axes,
      mode: 'focus',
      style,
      projectAnalysis,
      forceFallback: true,
      splitStems: false,
    },
  });
  assert.ok(generated.jobId);
  assert.equal(generated.status, 'processing');

  const completed = await waitForCompletedJob(client, generated.jobId);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.fallback, true);
  assert.equal(completed.mode, 'focus');
  assert.ok(completed.audioUrl);
  assert.ok(Array.isArray(completed.tracks));
  assert.ok(completed.tracks.length >= 1);

  console.log('Smoke tests passed');
} catch (err) {
  console.error(serverOutput);
  console.error(err);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  await Promise.race([
    once(server, 'exit').catch(() => {}),
    new Promise((resolve) => setTimeout(resolve, 1_500)),
  ]);
  await rm(tmpRoot, { recursive: true, force: true });
}
