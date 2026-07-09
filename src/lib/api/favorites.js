import { request } from './client.js';

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
