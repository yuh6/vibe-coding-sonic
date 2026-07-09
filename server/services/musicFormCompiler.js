export const GENERATION_MODES = Object.freeze({
  INSPIRATION: 'inspiration',
  CUSTOM_LYRICS: 'customLyrics',
  INSTRUMENTAL: 'instrumental',
});

export const SUPPORTED_MODELS = Object.freeze([
  'chirp-v5-5',
  'chirp-v5',
  'chirp-v4-5+',
  'chirp-v4-5',
  'chirp-v4-5-all',
  'chirp-v4',
  'chirp-v3-5',
  'chirp-v3-0',
]);

export const DEFAULT_MODEL = 'chirp-v5';

export const DEFAULT_NEGATIVE_TAGS = Object.freeze([
  'low quality',
  'muddy mix',
  'off beat',
  'random tempo changes',
  'unclear vocals',
  'harsh noise',
]);

const LANGUAGE_LABELS = Object.freeze({
  zh: 'Chinese',
  en: 'English',
  'zh-en': 'Chinese and English bilingual',
});

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(',')
      .map(compactText)
      .filter(Boolean);
  }
  return [];
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values.map(compactText).filter(Boolean)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function optionalNumber(value, { min = -Infinity, max = Infinity } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(min, Math.min(max, parsed));
}

function normalizeMode(mode) {
  return Object.values(GENERATION_MODES).includes(mode) ? mode : GENERATION_MODES.INSPIRATION;
}

function normalizeModel(model) {
  return SUPPORTED_MODELS.includes(model) ? model : DEFAULT_MODEL;
}

function normalizeGender(gender) {
  return gender === 'Male' || gender === 'Female' ? gender : undefined;
}

function normalizePrimaryGenre(raw) {
  if (typeof raw.genre === 'string') return compactText(raw.genre);
  return compactText(raw.genre?.primary || raw.selectedGenre);
}

function truncate(value, maxLen) {
  const text = compactText(value);
  return text.length > maxLen ? text.slice(0, maxLen).trim() : text;
}

function sentence(parts) {
  return parts.filter(Boolean).join(' ');
}

export function normalizeMusicGenerationForm(raw = {}) {
  const mode = normalizeMode(raw.mode);
  const vocalEnabled = mode === GENERATION_MODES.INSTRUMENTAL
    ? false
    : Boolean(raw.vocal?.enabled ?? raw.vocals?.enabled ?? true);
  const structureTemplate = normalizeArray(raw.structure?.template || raw.structure);

  return {
    mode,
    phase: compactText(raw.phase || raw.workflowMode || raw.codingMode || 'focus'),
    mbti: compactText(raw.mbti || '').toUpperCase() || 'INTJ',
    title: truncate(raw.title, 80),
    model: normalizeModel(raw.model || raw.mv),
    language: LANGUAGE_LABELS[raw.language] ? raw.language : 'en',
    theme: compactText(raw.theme || raw.description || raw.prompt),
    genre: {
      primary: normalizePrimaryGenre(raw),
      sub: normalizeArray(raw.genre?.sub),
    },
    mood: normalizeArray(raw.mood),
    era: compactText(raw.era),
    energy: optionalNumber(raw.energy, { min: 1, max: 10 }),
    danceability: optionalNumber(raw.danceability, { min: 1, max: 10 }),
    bpm: {
      target: optionalNumber(raw.bpm?.target ?? raw.bpm, { min: 40, max: 240 }),
      min: optionalNumber(raw.bpm?.min, { min: 40, max: 240 }),
      max: optionalNumber(raw.bpm?.max, { min: 40, max: 240 }),
    },
    rhythm: {
      groove: compactText(raw.rhythm?.groove),
      beatType: compactText(raw.rhythm?.beatType),
      drumFeel: compactText(raw.rhythm?.drumFeel),
    },
    vocal: {
      enabled: vocalEnabled,
      gender: normalizeGender(raw.vocal?.gender || raw.vocals?.gender),
      tone: compactText(raw.vocal?.tone || raw.vocals?.style),
      delivery: normalizeArray(raw.vocal?.delivery),
      harmony: Boolean(raw.vocal?.harmony),
      hookStrength: optionalNumber(raw.vocal?.hookStrength, { min: 1, max: 10 }),
    },
    instruments: {
      drums: normalizeArray(raw.instruments?.drums),
      bass: normalizeArray(raw.instruments?.bass),
      harmony: normalizeArray(raw.instruments?.harmony),
      lead: normalizeArray(raw.instruments?.lead),
      fx: normalizeArray(raw.instruments?.fx),
    },
    structure: {
      template: structureTemplate.length ? structureTemplate : ['Intro', 'Verse', 'Chorus', 'Outro'],
      introLength: compactText(raw.structure?.introLength),
      hookTiming: compactText(raw.structure?.hookTiming),
      solo: Boolean(raw.structure?.solo),
      ending: compactText(raw.structure?.ending),
    },
    lyrics: String(raw.lyrics || raw.promptLyrics || '').trim(),
    negativeTags: normalizeArray(raw.negativeTags || raw.negative_tags),
    advanced: {
      styleWeight: optionalNumber(raw.advanced?.styleWeight ?? raw.styleWeight, { min: 0, max: 1 }),
      weirdness: optionalNumber(raw.advanced?.weirdness ?? raw.weirdnessConstraint, { min: 0, max: 1 }),
      audioWeight: optionalNumber(raw.advanced?.audioWeight ?? raw.audioWeight, { min: 0, max: 1 }),
      autoLyrics: raw.advanced?.autoLyrics,
      personaId: compactText(raw.advanced?.personaId || raw.personaId),
      isStorage: raw.advanced?.isStorage,
      hookUrl: compactText(raw.advanced?.hookUrl || raw.hookUrl),
    },
    dj: {
      loopFriendly: Boolean(raw.dj?.loopFriendly),
      barAligned: Boolean(raw.dj?.barAligned),
      loopReady: Boolean(raw.dj?.loopReady),
    },
  };
}

export function flattenInstruments(formOrInstruments = {}) {
  const instruments = formOrInstruments.instruments || formOrInstruments;
  return unique([
    ...normalizeArray(instruments.drums),
    ...normalizeArray(instruments.bass),
    ...normalizeArray(instruments.harmony),
    ...normalizeArray(instruments.lead),
    ...normalizeArray(instruments.fx),
  ]);
}

export function buildStyleTags(rawForm) {
  const form = rawForm.mode ? normalizeMusicGenerationForm(rawForm) : rawForm;
  const tags = unique([
    form.genre?.primary,
    ...(form.genre?.sub || []),
    ...(form.mood || []),
    form.era,
    form.bpm?.target ? `${Math.round(form.bpm.target)} bpm` : undefined,
    form.rhythm?.beatType,
    form.rhythm?.groove,
    form.rhythm?.drumFeel,
    form.vocal?.enabled ? form.vocal?.tone : undefined,
    ...(form.vocal?.enabled ? form.vocal?.delivery || [] : []),
    ...flattenInstruments(form),
    form.dj?.loopFriendly ? 'DJ-friendly' : undefined,
    form.dj?.barAligned ? '8-bar sections' : undefined,
    form.dj?.loopReady ? 'loopable intro and outro' : undefined,
  ]);
  return tags.join(', ').slice(0, 1000);
}

export function buildNegativeTags(rawForm) {
  const form = rawForm.mode ? normalizeMusicGenerationForm(rawForm) : rawForm;
  return unique([
    ...DEFAULT_NEGATIVE_TAGS,
    ...(form.mode === GENERATION_MODES.INSTRUMENTAL || !form.vocal?.enabled ? ['vocals', 'lyrics', 'singing'] : []),
    ...(form.negativeTags || []),
  ]).join(', ');
}

function buildPrompt(rawForm, { instrumental = false } = {}) {
  const form = rawForm.mode ? normalizeMusicGenerationForm(rawForm) : rawForm;
  const language = LANGUAGE_LABELS[form.language] || LANGUAGE_LABELS.en;
  const genre = unique([form.genre?.primary, ...(form.genre?.sub || [])]).join(', ');
  const instruments = flattenInstruments(form);
  const bpmRange = form.bpm?.min && form.bpm?.max
    ? `Keep the tempo in the ${Math.round(form.bpm.min)}-${Math.round(form.bpm.max)} BPM range.`
    : '';
  const vocal = instrumental || !form.vocal?.enabled
    ? 'Instrumental only, no vocals.'
    : sentence([
      'Vocal:',
      form.vocal.gender,
      form.vocal.tone,
      form.vocal.delivery?.length ? `${form.vocal.delivery.join(', ')}.` : 'vocal.',
      form.vocal.harmony ? 'Use supportive harmonies.' : '',
      form.vocal.hookStrength ? `Hook strength ${Math.round(form.vocal.hookStrength)}/10.` : '',
    ]);

  return truncate([
    instrumental ? `Create a ${language} instrumental track.` : `Create a ${language} song.`,
    genre ? `Genre: ${genre}.` : '',
    form.mood?.length ? `Mood: ${form.mood.join(', ')}.` : '',
    form.era ? `Era / aesthetic: ${form.era}.` : '',
    form.energy ? `Energy ${Math.round(form.energy)}/10.` : '',
    form.danceability ? `Danceability ${Math.round(form.danceability)}/10.` : '',
    form.bpm?.target ? `Target tempo around ${Math.round(form.bpm.target)} BPM.` : '',
    bpmRange,
    form.rhythm?.beatType ? `Beat type: ${form.rhythm.beatType}.` : '',
    form.rhythm?.groove ? `Groove: ${form.rhythm.groove}.` : '',
    form.rhythm?.drumFeel ? `Drum feel: ${form.rhythm.drumFeel}.` : '',
    vocal,
    instruments.length ? `Instruments: ${instruments.join(', ')}.` : '',
    form.structure?.template?.length ? `Structure: ${form.structure.template.join(' - ')}.` : '',
    form.structure?.introLength ? `Intro length: ${form.structure.introLength}.` : '',
    form.structure?.hookTiming ? `Hook timing: ${form.structure.hookTiming}.` : '',
    form.structure?.solo ? 'Include a featured solo section.' : '',
    form.structure?.ending ? `Ending: ${form.structure.ending.replace(/_/g, ' ')}.` : '',
    form.dj?.loopFriendly || form.dj?.barAligned || form.dj?.loopReady
      ? 'Make it DJ-friendly with clear intro/outro, steady beat, and loop-friendly 8-bar or 16-bar sections.'
      : '',
    form.theme ? `Theme: ${form.theme}.` : '',
  ].filter(Boolean).join(' '), 3000);
}

export function buildInspirationPrompt(form) {
  return buildPrompt(form, { instrumental: false });
}

export function buildInstrumentalPrompt(form) {
  return buildPrompt(form, { instrumental: true });
}

export function compileMusicGenerationForm(rawForm = {}) {
  const form = normalizeMusicGenerationForm(rawForm);
  const tags = buildStyleTags(form);
  const negativeTags = buildNegativeTags(form);
  const isCustomLyrics = form.mode === GENERATION_MODES.CUSTOM_LYRICS;
  const isInstrumental = form.mode === GENERATION_MODES.INSTRUMENTAL;

  if (isCustomLyrics && !form.lyrics) {
    throw new Error('lyrics is required for customLyrics generation mode');
  }

  const gptDescriptionPrompt = isCustomLyrics
    ? null
    : isInstrumental
      ? buildInstrumentalPrompt(form)
      : buildInspirationPrompt(form);
  const fullPrompt = isCustomLyrics ? tags : gptDescriptionPrompt;
  const title = form.title || `${form.mbti}-${form.phase}`;

  return {
    fullPrompt,
    tags,
    negativeTags,
    layers: {
      mbti: tags,
      project: form.theme,
      mode: [
        form.mode,
        form.bpm.target ? `${Math.round(form.bpm.target)} BPM` : '',
        form.model,
      ].filter(Boolean).join(', '),
      console: [
        form.energy ? `energy ${Math.round(form.energy)}/10` : '',
        form.danceability ? `danceability ${Math.round(form.danceability)}/10` : '',
        form.dj.loopFriendly ? 'DJ-friendly' : '',
      ].filter(Boolean).join(', '),
      notes: form.negativeTags.join(', '),
    },
    bpm: form.bpm.target ? Math.round(form.bpm.target) : null,
    requestedBpm: form.bpm.target ? Math.round(form.bpm.target) : null,
    mode: form.phase,
    generationMode: form.mode,
    model: form.model,
    title,
    weirdnessConstraint: form.advanced.weirdness,
    styleWeight: form.advanced.styleWeight,
    audioWeight: form.advanced.audioWeight,
    mbti: form.mbti,
    profile: {
      traits: 'Structured music generation form',
      genre: form.genre.primary || tags || 'custom',
      theme: form.theme || null,
    },
    selectedGenre: form.genre.primary || null,
    personaId: form.advanced.personaId || null,
    hasLyrics: Boolean(form.lyrics),
    form,
    analysis: {
      requestedBpm: form.bpm.target ? Math.round(form.bpm.target) : null,
      actualBpm: null,
      beatGridStatus: 'pending',
    },
    ttapi: {
      custom: isCustomLyrics,
      instrumental: isInstrumental || !form.vocal.enabled,
      model: form.model,
      title,
      gptDescriptionPrompt,
      lyrics: isCustomLyrics ? form.lyrics : null,
      tags,
      negativeTags,
      styleWeight: form.advanced.styleWeight,
      weirdnessConstraint: form.advanced.weirdness,
      audioWeight: form.advanced.audioWeight,
      autoLyrics: form.advanced.autoLyrics,
      vocalGender: form.vocal.enabled ? form.vocal.gender : undefined,
      personaId: form.advanced.personaId || undefined,
      isStorage: form.advanced.isStorage ?? true,
      hookUrl: form.advanced.hookUrl || undefined,
    },
  };
}
