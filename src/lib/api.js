const API_BASE = '';
const ADMIN_TOKEN_KEY = 'vibe-coding-sonic-admin-token';

export function getStoredAdminToken() {
  return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
}

export function setStoredAdminToken(token) {
  const normalized = String(token || '').trim();
  if (normalized) {
    localStorage.setItem(ADMIN_TOKEN_KEY, normalized);
  } else {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
  }
}

function shouldAttachAdminToken(path, method = 'GET') {
  const upperMethod = method.toUpperCase();
  return (
    path.startsWith('/api/config') ||
    path.startsWith('/api/library') ||
    (path === '/api/music/generate' && upperMethod === 'POST')
  );
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const token = shouldAttachAdminToken(path, method) ? getStoredAdminToken() : '';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Admin-Token': token } : {}),
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed: ${res.status}`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export function getHealth() {
  return request('/api/health');
}

export function analyzeProject({ name, description }) {
  return request('/api/project/analyze', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function analyzeGithub(url) {
  return request('/api/project/analyze-github', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function previewPrompt({ mbti, axes, mode, projectAnalysis, style }) {
  return request('/api/music/generate', {
    method: 'POST',
    body: JSON.stringify({ mbti, axes, mode, projectAnalysis, style, previewOnly: true }),
  });
}

export function generateMusic({ mbti, axes, mode, projectAnalysis, style, forceFallback = false }) {
  return request('/api/music/generate', {
    method: 'POST',
    body: JSON.stringify({ mbti, axes, mode, projectAnalysis, style, forceFallback }),
  });
}

export function getMusicStatus(jobId) {
  return request(`/api/music/status/${jobId}`);
}

export function getFallback({ mode, mbti }) {
  const params = new URLSearchParams({ mode, mbti });
  return request(`/api/music/fallback?${params}`);
}

export function syncSchedule(phases) {
  return request('/api/schedule/sync', {
    method: 'POST',
    body: JSON.stringify({ phases }),
  });
}

export function getDemoSchedule() {
  return request('/api/schedule/demo');
}

// ── 管理后台 ──

export function getConfigKeys() {
  return request('/api/config/keys');
}

export function saveConfigKeys(patch) {
  return request('/api/config/keys', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export function getConfigStatus() {
  return request('/api/config/status');
}

export function getProviders() {
  return request('/api/config/providers');
}

export function getLibrary() {
  return request('/api/library');
}

export function addLibraryTrack({ mode, title, url }) {
  return request('/api/library', {
    method: 'POST',
    body: JSON.stringify({ mode, title, url }),
  });
}

export function deleteLibraryTrack(mode, id) {
  return request(`/api/library/${mode}/${id}`, { method: 'DELETE' });
}
