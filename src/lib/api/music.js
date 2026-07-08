import { request } from './client.js';

export function previewPrompt({ mbti, axes, mode, projectAnalysis, style, selectedGenre, vocals }) {
  return request('/api/music/generate', {
    method: 'POST',
    body: JSON.stringify({ mbti, axes, mode, projectAnalysis, style, selectedGenre, vocals, previewOnly: true }),
  });
}

export function generateMusic({ mbti, axes, mode, projectAnalysis, style, selectedGenre, vocals, forceFallback = false, splitStems = true }) {
  return request('/api/music/generate', {
    method: 'POST',
    body: JSON.stringify({ mbti, axes, mode, projectAnalysis, style, selectedGenre, vocals, forceFallback, splitStems }),
  });
}

export function getMusicStatus(jobId) {
  return request(`/api/music/status/${jobId}`);
}

export function getFallback({ mode, mbti }) {
  const params = new URLSearchParams({ mode, mbti });
  return request(`/api/music/fallback?${params}`);
}
