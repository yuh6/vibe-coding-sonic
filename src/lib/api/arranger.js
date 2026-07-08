import { request } from './client.js';

export function syncSchedule(phases) {
  return request('/api/arranger/schedule/sync', {
    method: 'POST',
    body: JSON.stringify({ phases }),
  });
}

export function getDemoSchedule() {
  return request('/api/arranger/schedule/demo');
}

// ── 用户系统 ──

export function createArrangerSession({ name, mbtiType, mbtiSliders, schedule, budgetLimit, generationParams }) {
  return request('/api/session', {
    method: 'POST',
    body: JSON.stringify({ name, mbtiType, mbtiSliders, schedule, budgetLimit, generationParams }),
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

export function updateArrangerGenerationParams(sessionId, generationParams) {
  return request(`/api/session/${sessionId}/generation-params`, {
    method: 'PUT',
    body: JSON.stringify({ generationParams }),
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
