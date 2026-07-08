import test from 'node:test';
import assert from 'node:assert/strict';
import { suggestVocalStyle } from '../../server/services/lyricsGenerator.js';

test('suggestVocalStyle reads the profile vocalHint as the canonical Suno style', () => {
  assert.deepEqual(suggestVocalStyle('INTJ'), {
    style: 'Whispered, Low-key Male Vocals',
    desc: '低吟耳语',
  });

  assert.deepEqual(suggestVocalStyle('INFP'), {
    style: 'Breathy, Intimate Female Vocals',
    desc: '气声空灵',
  });
});

test('suggestVocalStyle falls back to neutral vocals when MBTI profile is unknown', () => {
  assert.deepEqual(suggestVocalStyle('XXXX'), {
    style: 'Clear Vocals',
    desc: '气声空灵',
  });
});
