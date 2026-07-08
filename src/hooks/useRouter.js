import { useEffect, useState } from 'react';

export const ROUTES = new Set(['/', '/mbtiwave', '/dj', '/discover', '/mixer', '/admin', '/account']);

function normalizePath(path) {
  return String(path || '/').replace(/\/+$/, '') || '/';
}

function legacyPathFromHash(hash) {
  if (!hash?.startsWith('#/')) return '';
  const legacy = hash.slice(1);
  return legacy === '/' ? '/dj' : normalizePath(legacy);
}

export function navigateTo(path, { replace = false } = {}) {
  const nextPath = normalizePath(path);
  if (window.location.pathname !== nextPath || window.location.hash) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', nextPath);
  }
  window.dispatchEvent(new Event('popstate'));
}

export function usePathRoute() {
  const [path, setPath] = useState(() => legacyPathFromHash(window.location.hash) || normalizePath(window.location.pathname));

  useEffect(() => {
    const legacyPath = legacyPathFromHash(window.location.hash);
    if (legacyPath) {
      navigateTo(legacyPath, { replace: true });
    }

    const onChange = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onChange);
    return () => window.removeEventListener('popstate', onChange);
  }, []);

  return path;
}
