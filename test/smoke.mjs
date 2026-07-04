import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';

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

  await assert.rejects(
    () => client.request('/api/notes/parse', {
      method: 'POST',
      body: { text: 'happy synth drive' },
    }),
    (err) => err.status === 401
  );

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

  const sharedStats = await client.request('/api/library/shared/stats');
  assert.equal(typeof sharedStats.total, 'number');

  const playlists = await client.request('/api/playlists/mine/list');
  assert.ok(Array.isArray(playlists.playlists));

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
