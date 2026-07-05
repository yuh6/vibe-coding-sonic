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

function shouldAttachAdminToken(path) {
  return path.startsWith('/api/config') || path.startsWith('/api/library');
}

async function request(path, options = {}) {
  const method = options.method || 'GET';
  const token = shouldAttachAdminToken(path) ? getStoredAdminToken() : '';
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Admin-Token': token } : {}),
      ...options.headers,
    },
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

// ── 编排引擎 (Arranger) ──

export function createArrangerSession({ name, mbtiType, mbtiSliders, schedule, budgetLimit }) {
  return request('/api/session', {
    method: 'POST',
    body: JSON.stringify({ name, mbtiType, mbtiSliders, schedule, budgetLimit }),
  });
}

export function getArrangerSession(sessionId) {
  return request(`/api/session/${sessionId}`);
}

export function updateArrangerSchedule(sessionId, schedule) {
  return request(`/api/session/${sessionId}/schedule`, {
    method: 'PUT',
    body: JSON.stringify({ schedule }),
  });
}

export function startArranger(sessionId) {
  return request('/api/arranger/start', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function advanceArranger(sessionId) {
  return request('/api/arranger/advance', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function stopArranger(sessionId) {
  return request('/api/arranger/stop', {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function setArrangerPhase(sessionId, phase) {
  return request(`/api/arranger/phase/${phase}`, {
    method: 'POST',
    body: JSON.stringify({ sessionId }),
  });
}

export function sendArrangerFeedback(sessionId, action) {
  return request('/api/arranger/feedback', {
    method: 'POST',
    body: JSON.stringify({ sessionId, action }),
  });
}

export function getArrangerNowPlaying(sessionId) {
  return request(`/api/arranger/now-playing?sessionId=${encodeURIComponent(sessionId)}`);
}

export function getArrangerHistory(sessionId, limit = 20) {
  return request(`/api/arranger/history?sessionId=${encodeURIComponent(sessionId)}&limit=${limit}`);
}

export function getArrangerPoolStatus(sessionId) {
  return request(`/api/arranger/pool-status?sessionId=${encodeURIComponent(sessionId)}`);
}

export function getArrangerEnergyCurve() {
  return request('/api/arranger/energy-curve');
}

// ── 播放列表 ──

export function getPublicPlaylists({ sort = 'popular', page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ sort, page, limit });
  return request(`/api/playlists?${params}`);
}

export function getPlaylist(id) {
  return request(`/api/playlists/${id}`);
}

export function createPlaylist({ title, description }) {
  return request('/api/playlists', { method: 'POST', body: JSON.stringify({ title, description }) });
}

export function addToPlaylist(playlistId, trackId) {
  return request(`/api/playlists/${playlistId}/tracks`, { method: 'POST', body: JSON.stringify({ trackId }) });
}

export function getMyPlaylists() {
  return request('/api/playlists/mine/list');
}

// ── 电台 ──

export function getLiveRadios({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  return request(`/api/radio?${params}`);
}

export function getRadioStation(id) {
  return request(`/api/radio/${id}`);
}

export function joinRadio(id) {
  return request(`/api/radio/${id}/listen`, { method: 'POST' });
}

export function leaveRadio(id) {
  return request(`/api/radio/${id}/leave`, { method: 'POST' });
}

export function startRadio({ title, description, sessionId, mode, mbti }) {
  return request('/api/radio', { method: 'POST', body: JSON.stringify({ title, description, sessionId, mode, mbti }) });
}

export function stopRadio(id) {
  return request(`/api/radio/${id}`, { method: 'DELETE' });
}

// ── 共享曲库 + 播放记录 ──

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

// ── 音乐流派/风格 ──

export function getStyles() {
  return request('/api/styles');
}

// ── 收藏 + 评分 ──

export function getFavorites({ page = 1, limit = 20 } = {}) {
  const params = new URLSearchParams({ page, limit });
  return request(`/api/favorites?${params}`);
}

export function addFavorite(trackId) {
  return request(`/api/favorites/${encodeURIComponent(trackId)}`, { method: 'POST' });
}

export function removeFavorite(trackId) {
  return request(`/api/favorites/${encodeURIComponent(trackId)}`, { method: 'DELETE' });
}

export function getFavoriteStatus(trackId) {
  return request(`/api/favorites/${encodeURIComponent(trackId)}/status`);
}

export function rateTrack(trackId, score) {
  return request(`/api/favorites/${encodeURIComponent(trackId)}/rate`, {
    method: 'POST',
    body: JSON.stringify({ score }),
  });
}

export function getMyRating(trackId) {
  return request(`/api/favorites/${encodeURIComponent(trackId)}/my-rating`);
}

export function getTrackRatings(trackId) {
  return request(`/api/favorites/${encodeURIComponent(trackId)}/ratings`);
}

// ── 推荐 + 历史 ──

export function getForYou(limit = 12) {
  const params = new URLSearchParams({ limit });
  return request(`/api/recommend/for-you?${params}`);
}

export function getMyHistory({ page = 1, limit = 30 } = {}) {
  const params = new URLSearchParams({ page, limit });
  return request(`/api/recommend/history?${params}`);
}

// ── 歌单管理 ──

export function updatePlaylist(id, { title, description, isPublic } = {}) {
  return request(`/api/playlists/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ title, description, isPublic }),
  });
}

export function deletePlaylist(id) {
  return request(`/api/playlists/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function removeFromPlaylist(playlistId, trackId) {
  return request(
    `/api/playlists/${encodeURIComponent(playlistId)}/tracks/${encodeURIComponent(trackId)}`,
    { method: 'DELETE' }
  );
}

// ── 曲库补全 ──

export function getSharedStats() {
  return request('/api/library/shared/stats');
}

export function getSharedTrack(id) {
  return request(`/api/library/shared/${encodeURIComponent(id)}`);
}

