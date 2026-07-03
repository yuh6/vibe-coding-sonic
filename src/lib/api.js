const API_BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
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

export function generateMusic({ mbti, axes, mode, projectAnalysis, style, forceFallback = false, splitStems = true }) {
  return request('/api/music/generate', {
    method: 'POST',
    body: JSON.stringify({ mbti, axes, mode, projectAnalysis, style, forceFallback, splitStems }),
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

// ── 用户系统 ──

export function authRegister({ email, password, name }) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
}

export function authLogin({ email, password }) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function authLogout() {
  return request('/api/auth/logout', { method: 'POST' });
}

export function authMe() {
  return request('/api/auth/me');
}

export function getMyProfile() {
  return request('/api/user/profile');
}

export function saveMyProfile({ axes, style, mode }) {
  return request('/api/user/profile', {
    method: 'PUT',
    body: JSON.stringify({ axes, style, mode }),
  });
}

export function getMyTracks() {
  return request('/api/user/tracks');
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
