import test from 'node:test';
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (key) => store.get(key) || null,
  setItem: (key, value) => store.set(key, value),
  removeItem: (key) => store.delete(key),
};

const { request, setStoredAdminToken, getStoredAdminToken } = await import('../../src/lib/api/client.js');

test('api client attaches admin token only for admin-backed routes', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };

  setStoredAdminToken('secret');
  assert.equal(getStoredAdminToken(), 'secret');

  await request('/api/config/status');
  await request('/api/music/fallback?mode=focus&mbti=INTJ');

  assert.equal(calls[0].options.headers['X-Admin-Token'], 'secret');
  assert.equal(calls[1].options.headers['X-Admin-Token'], undefined);
});

test('api client throws response error details', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Nope', code: 'NOPE' }), {
    status: 418,
    headers: { 'Content-Type': 'application/json' },
  });

  await assert.rejects(
    () => request('/api/music/fallback'),
    (err) => {
      assert.equal(err.message, 'Nope');
      assert.equal(err.status, 418);
      assert.equal(err.code, 'NOPE');
      return true;
    }
  );
});
