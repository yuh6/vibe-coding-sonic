const API_BASE = '';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
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
