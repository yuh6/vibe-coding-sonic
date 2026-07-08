import { request } from './client.js';

export function getHealth() {
  return request('/api/health');
}

export function getConfigKeys() {
  return request('/api/config/keys');
}

export function saveConfigKeys(patch) {
  return request('/api/config/keys', {
    method: 'POST',
    body: JSON.stringify(patch),
  });
}

export function getQuotaSettings() {
  return request('/api/config/quota-settings');
}

export function saveQuotaSettings({ guestLimit, userLimit, vipLimit, globalDailyLimit }) {
  return request('/api/config/quota-settings', {
    method: 'POST',
    body: JSON.stringify({ guestLimit, userLimit, vipLimit, globalDailyLimit }),
  });
}

export function getAdminUsers() {
  return request('/api/config/users');
}

export function updateAdminUser(id, patch) {
  return request(`/api/config/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function getRedemptionCodes() {
  return request('/api/config/redemption-codes');
}

export function createRedemptionCode({ points, maxUses, expiresAt }) {
  return request('/api/config/redemption-codes', {
    method: 'POST',
    body: JSON.stringify({ points, maxUses, expiresAt }),
  });
}

export function disableRedemptionCode(code) {
  return request(`/api/config/redemption-codes/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'disable' }),
  });
}

export function getConfigStatus() {
  return request('/api/config/status');
}

export function getProviders() {
  return request('/api/config/providers');
}

export function getStyles() {
  return request('/api/config/styles');
}

// ── 收藏 + 评分 ──
