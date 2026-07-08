import test from 'node:test';
import assert from 'node:assert/strict';
import { composePrompt } from '../../server/services/promptComposer.js';

test('composePrompt keeps priority prompt constraints inside the style prompt', () => {
  const result = composePrompt({
    axes: { ie: 30, ns: 60, tf: 40, jp: 70 },
    mode: 'sprint',
    selectedGenre: 'lo-fi-hip-hop',
    style: { energy: 90, texture: 20, brightness: 25 },
    notes: {
      keywords: ['sampled piano', 'Deep Synth Pads', 'terminal focus'],
      mood: ['quiet urgency'],
      avoid: ['harsh cymbals'],
    },
    vocals: { enabled: false },
  });

  assert.equal(result.fullPrompt.length <= 200, true);
  assert.match(result.fullPrompt, /\b\d{2,3} BPM\b/);
  assert.match(result.fullPrompt, /lo-fi hip hop/i);
  assert.match(result.fullPrompt, /terminal focus/i);
  assert.match(result.fullPrompt, /Instrumental/i);
  assert.equal(result.fullPrompt.includes(result.negativeTags), false);
  assert.match(result.negativeTags, /Vocals/);
  assert.match(result.negativeTags, /harsh cymbals/);
});

test('composePrompt gives user vocal style priority over instrumental fallback', () => {
  const result = composePrompt({
    mbti: 'INFP',
    mode: 'focus',
    vocals: { enabled: true, style: 'Soft Alto Lead Vocals' },
  });

  assert.match(result.fullPrompt, /Soft Alto Lead Vocals/);
  assert.doesNotMatch(result.fullPrompt, /Instrumental/);
  assert.equal(result.hasLyrics, false);
});
