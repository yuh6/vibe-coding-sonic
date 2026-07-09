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

export async function request(path, options = {}) {
  const token = shouldAttachAdminToken(path) ? getStoredAdminToken() : '';
  const { headers: customHeaders, ...restOptions } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'X-Admin-Token': token } : {}),
      ...customHeaders,
    },
    credentials: 'same-origin',
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
