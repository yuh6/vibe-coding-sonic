import { request } from './client.js';

export function analyzeProject({ name, description }) {
  return request('/api/project/analyze', {
    method: 'POST',
    body: JSON.stringify({ name, description }),
  });
}

export function analyzeGithub(url) {
  return request('/api/project/analyze-github', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}
