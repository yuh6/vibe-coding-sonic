import { request } from './client.js';

export function getLibrary() {
  return request('/api/library');
}

export function addLibraryTrack({ mode, title, url, mbti }) {
  return request('/api/library', {
    method: 'POST',
    body: JSON.stringify({ mode, title, url, mbti }),
  });
}

export function deleteLibraryTrack(mode, id) {
  return request(`/api/library/${mode}/${id}`, { method: 'DELETE' });
}

// ── 编排引擎 (Arranger) ──

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
  return request(`/api/library/recommend/popular?${params}`);
}

export function recordRecommendedPlay({ trackId, durationSec = null, completed = false }) {
  return request('/api/library/recommend/play', {
    method: 'POST',
    body: JSON.stringify({ trackId, durationSec, completed }),
  });
}

export function getForYou(limit = 12) {
  const params = new URLSearchParams({ limit });
  return request(`/api/library/recommend/for-you?${params}`);
}

export function getMyHistory({ page = 1, limit = 30 } = {}) {
  const params = new URLSearchParams({ page, limit });
  return request(`/api/library/recommend/history?${params}`);
}

// ── 歌单管理 ──

export function getSharedStats() {
  return request('/api/library/shared/stats');
}

export function getSharedTrack(id) {
  return request(`/api/library/shared/${encodeURIComponent(id)}`);
}
