import { request } from './client.js';

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

export function recordPlaylistPlay(playlistId) {
  return request(`/api/playlists/${encodeURIComponent(playlistId)}/play`, { method: 'POST' });
}

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
