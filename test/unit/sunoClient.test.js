import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGenerationRequestBody } from '../../server/services/sunoClient.js';

test('buildGenerationRequestBody sends negative tags only to TTAPI negative_tags', () => {
  const body = buildGenerationRequestBody({
    prompt: 'lo-fi hip hop, 98 BPM, Instrumental',
    title: 'INTJ-focus',
    tags: 'Dark Ambient, Minimal Techno',
    negativeTags: 'Vocals, Singing, harsh cymbals',
    instrumental: true,
    weirdnessConstraint: 65,
    styleWeight: 80,
    audioWeight: 50,
    personaId: 'persona-123',
    modelVersion: 'V5',
  });

  assert.equal(body.custom, false);
  assert.equal(body.instrumental, true);
  assert.equal(body.gpt_description_prompt, 'lo-fi hip hop, 98 BPM, Instrumental');
  assert.equal(body.tags, 'Dark Ambient, Minimal Techno');
  assert.equal(body.negative_tags, 'Vocals, Singing, harsh cymbals');
  assert.equal(body.tags.includes('harsh cymbals'), false);
  assert.equal(body.gpt_description_prompt.includes('harsh cymbals'), false);
  assert.equal(body.weirdness_constraint, 0.65);
  assert.equal(body.style_weight, 0.8);
  assert.equal(body.audio_weight, 0.5);
  assert.equal(body.persona_id, 'persona-123');
});

test('buildGenerationRequestBody uses lyrics in custom prompt without losing style description', () => {
  const body = buildGenerationRequestBody({
    prompt: 'dream pop, intimate vocals, 88 BPM',
    lyrics: '[Verse]\nhello',
    negativeTags: 'noise',
  });

  assert.equal(body.custom, true);
  assert.equal(body.instrumental, false);
  assert.equal(body.prompt, '[Verse]\nhello');
  assert.equal(body.gpt_description_prompt, 'dream pop, intimate vocals, 88 BPM');
  assert.equal(body.negative_tags, 'noise');
});

test('buildGenerationRequestBody maps structured custom lyrics controls to TTAPI fields', () => {
  const body = buildGenerationRequestBody({
    custom: true,
    prompt: 'synth rock, 124 bpm, raspy male vocal',
    gptDescriptionPrompt: null,
    lyrics: '[Verse]\nNeon on the road',
    title: 'Neon Highway',
    tags: 'synth rock, 124 bpm, raspy male vocal',
    negativeTags: 'trap, acoustic folk',
    instrumental: false,
    vocalGender: 'Male',
    autoLyrics: false,
    isStorage: true,
    hookUrl: 'https://example.com/hook',
    modelVersion: 'chirp-v5-5',
  });

  assert.equal(body.custom, true);
  assert.equal(body.instrumental, false);
  assert.equal(body.mv, 'chirp-v5-5');
  assert.equal(body.title, 'Neon Highway');
  assert.equal(body.prompt, '[Verse]\nNeon on the road');
  assert.equal(body.gpt_description_prompt, undefined);
  assert.equal(body.tags, 'synth rock, 124 bpm, raspy male vocal');
  assert.equal(body.negative_tags, 'trap, acoustic folk');
  assert.equal(body.vocal_gender, 'Male');
  assert.equal(body.auto_lyrics, false);
  assert.equal(body.isStorage, true);
  assert.equal(body.hookUrl, 'https://example.com/hook');
});
