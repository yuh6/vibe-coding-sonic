import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlaybackTracks, getPlaybackUrl, publicJob } from '../../server/services/jobStore.js';

test('jobStore playback helpers prefer local audio when available', () => {
  const job = {
    id: 'job-1',
    status: 'completed',
    audioUrl: 'https://cdn.example/original.mp3',
    audioLocal: '/audio-cache/job-1.mp3',
    tracks: [{ id: 'master', name: 'Master', type: 'master', url: 'https://cdn.example/original.mp3' }],
  };

  assert.equal(getPlaybackUrl(job), '/audio-cache/job-1.mp3');
  assert.deepEqual(getPlaybackTracks(job), [
    { id: 'master', name: 'Master', type: 'master', url: '/audio-cache/job-1.mp3' },
  ]);
});

test('publicJob exposes the stable client payload shape', () => {
  const payload = publicJob({
    id: 'job-2',
    status: 'completed',
    audioUrl: '/sample.mp3',
    tracks: [],
    fullPrompt: 'ambient, 90 BPM',
    layers: { mode: 'focus' },
    bpm: 90,
    mode: 'focus',
    mbti: 'INTJ',
    profile: { genre: 'Ambient' },
    splitStems: true,
  });

  assert.equal(payload.jobId, 'job-2');
  assert.equal(payload.audioUrl, '/sample.mp3');
  assert.equal(payload.tracks[0].url, '/sample.mp3');
  assert.equal(payload.fullPrompt, 'ambient, 90 BPM');
  assert.equal(payload.splitStems, true);
});
