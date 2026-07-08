import { request } from './client.js';

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

export function updateRadioNowPlaying(id, track) {
  return request(`/api/radio/${encodeURIComponent(id)}/now-playing`, {
    method: 'PATCH',
    body: JSON.stringify({ track }),
  });
}

// ── 音乐流派/风格 ──
