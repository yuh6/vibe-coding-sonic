import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNegativeTags,
  buildStyleTags,
  compileMusicGenerationForm,
  flattenInstruments,
  normalizeMusicGenerationForm,
} from '../../server/services/musicFormCompiler.js';

const neonForm = {
  mode: 'inspiration',
  title: 'Neon Highway',
  model: 'chirp-v5-5',
  language: 'en',
  theme: 'a lonely night drive through a cyberpunk city, energetic but nostalgic',
  genre: {
    primary: 'synth rock',
    sub: ['retrowave', 'electro rock', '80s arena rock'],
  },
  mood: ['dark', 'energetic', 'nostalgic', 'anthemic'],
  era: '1980s retro futuristic',
  energy: 8,
  danceability: 7,
  bpm: { target: 124, min: 120, max: 128 },
  rhythm: {
    groove: 'straight',
    beatType: 'four-on-the-floor',
    drumFeel: 'punchy gated drums',
  },
  vocal: {
    enabled: true,
    gender: 'Male',
    tone: 'raspy male vocal',
    delivery: ['anthemic chorus', 'dramatic verse'],
    harmony: true,
    hookStrength: 9,
  },
  instruments: {
    drums: ['gated snare', 'electronic toms'],
    bass: ['driving synth bass'],
    harmony: ['analog synth pads', 'power chords'],
    lead: ['electric guitar solo', 'retro synth lead'],
    fx: ['neon ambience', 'riser'],
  },
  structure: {
    template: ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Guitar Solo', 'Final Chorus', 'Outro'],
    introLength: 'medium',
    hookTiming: 'early',
    solo: true,
    ending: 'loopable',
  },
  negativeTags: ['trap', 'acoustic folk', 'lo-fi bedroom pop'],
  advanced: {
    hookUrl: 'https://example.com/api/ttapi/callback',
  },
  dj: {
    loopFriendly: true,
    barAligned: true,
    loopReady: true,
  },
};

test('compileMusicGenerationForm maps inspiration mode into TTAPI gpt_description_prompt', () => {
  const compiled = compileMusicGenerationForm(neonForm);

  assert.equal(compiled.ttapi.custom, false);
  assert.equal(compiled.ttapi.instrumental, false);
  assert.equal(compiled.ttapi.model, 'chirp-v5-5');
  assert.equal(compiled.ttapi.title, 'Neon Highway');
  assert.match(compiled.ttapi.gptDescriptionPrompt, /Genre: synth rock, retrowave, electro rock, 80s arena rock\./);
  assert.match(compiled.ttapi.gptDescriptionPrompt, /Target tempo around 124 BPM\./);
  assert.match(compiled.ttapi.gptDescriptionPrompt, /DJ-friendly/);
  assert.equal(compiled.ttapi.lyrics, null);
  assert.equal(compiled.requestedBpm, 124);
  assert.match(compiled.tags, /124 bpm/);
  assert.match(compiled.negativeTags, /trap/);
  assert.match(compiled.negativeTags, /low quality/);
});

test('compileMusicGenerationForm maps customLyrics mode into prompt, tags, and vocal controls', () => {
  const compiled = compileMusicGenerationForm({
    ...neonForm,
    mode: 'customLyrics',
    lyrics: '[Verse]\nNeon on the road',
    advanced: {
      styleWeight: 0.7,
      weirdness: 0.35,
      audioWeight: 0.45,
      autoLyrics: false,
      personaId: 'persona-123',
      isStorage: true,
      hookUrl: 'https://example.com/hook',
    },
  });

  assert.equal(compiled.ttapi.custom, true);
  assert.equal(compiled.ttapi.instrumental, false);
  assert.equal(compiled.ttapi.gptDescriptionPrompt, null);
  assert.equal(compiled.ttapi.lyrics, '[Verse]\nNeon on the road');
  assert.equal(compiled.ttapi.vocalGender, 'Male');
  assert.equal(compiled.ttapi.styleWeight, 0.7);
  assert.equal(compiled.ttapi.weirdnessConstraint, 0.35);
  assert.equal(compiled.ttapi.audioWeight, 0.45);
  assert.equal(compiled.ttapi.autoLyrics, false);
  assert.equal(compiled.ttapi.personaId, 'persona-123');
  assert.equal(compiled.ttapi.isStorage, true);
  assert.equal(compiled.ttapi.hookUrl, 'https://example.com/hook');
  assert.match(compiled.ttapi.tags, /raspy male vocal/);
});

test('compileMusicGenerationForm requires lyrics for customLyrics mode', () => {
  assert.throws(
    () => compileMusicGenerationForm({ ...neonForm, mode: 'customLyrics', lyrics: '' }),
    /lyrics is required/
  );
});

test('compileMusicGenerationForm maps instrumental mode without vocal leakage', () => {
  const compiled = compileMusicGenerationForm({
    ...neonForm,
    mode: 'instrumental',
    vocal: { enabled: true, gender: 'Female', tone: 'robotic female vocal' },
  });

  assert.equal(compiled.ttapi.custom, false);
  assert.equal(compiled.ttapi.instrumental, true);
  assert.equal(compiled.ttapi.vocalGender, undefined);
  assert.match(compiled.ttapi.gptDescriptionPrompt, /Instrumental only, no vocals\./);
  assert.doesNotMatch(compiled.ttapi.tags, /robotic female vocal/);
  assert.match(compiled.ttapi.negativeTags, /vocals/);
  assert.match(compiled.ttapi.negativeTags, /lyrics/);
});

test('flattenInstruments, buildStyleTags, and buildNegativeTags are deduplicated compiler helpers', () => {
  assert.deepEqual(flattenInstruments({
    drums: ['gated snare', 'Gated Snare'],
    bass: ['synth bass'],
  }), ['gated snare', 'synth bass']);

  const tags = buildStyleTags(neonForm);
  assert.equal(tags.includes('gated snare, gated snare'), false);
  assert.match(tags, /DJ-friendly/);

  const negative = buildNegativeTags(neonForm);
  assert.equal((negative.match(/low quality/g) || []).length, 1);
  assert.match(negative, /acoustic folk/);
});

test('normalizeMusicGenerationForm does not stringify object-shaped genre fallbacks', () => {
  const form = normalizeMusicGenerationForm({
    genre: { sub: ['ambient'] },
    selectedGenre: 'downtempo',
  });

  assert.equal(form.genre.primary, 'downtempo');
  assert.deepEqual(form.genre.sub, ['ambient']);
});
