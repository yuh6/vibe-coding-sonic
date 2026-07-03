import { useLayoutEffect, useState } from 'react';

const STORAGE_KEY = 'vibe-color-mode';

function resolveMode(stored) {
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function getInitialMode() {
  if (typeof window === 'undefined') return 'dark';
  // 与 index.html 内联脚本保持一致：优先读 DOM，避免 React 状态与 data-theme 错位
  const fromDom = document.documentElement.getAttribute('data-theme');
  if (fromDom === 'light' || fromDom === 'dark') return fromDom;
  return resolveMode(localStorage.getItem(STORAGE_KEY));
}

export function applyMode(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  document.documentElement.style.colorScheme = mode;
  localStorage.setItem(STORAGE_KEY, mode);
}

export function useColorMode() {
  const [mode, setMode] = useState(getInitialMode);

  useLayoutEffect(() => {
    applyMode(mode);
  }, [mode]);

  const toggle = () => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark';
      applyMode(next);
      return next;
    });
  };
  const isDark = mode === 'dark';

  return { mode, isDark, toggle, setMode };
}
