import { request } from './client.js';

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

export function getMyAccount() {
  return request('/api/user/account');
}

export function updateMyAccount({ name }) {
  return request('/api/user/account', {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export function changeMyPassword({ currentPassword, nextPassword }) {
  return request('/api/user/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, nextPassword }),
  });
}

export function redeemCreditCode(code) {
  return request('/api/user/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
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
