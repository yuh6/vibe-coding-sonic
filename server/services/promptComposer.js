import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resolveGenreStyle } from './genreStyles.js';
import { compileMusicGenerationForm } from './musicFormCompiler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(join(__dirname, '../data/mbti-profiles.json'), 'utf-8'));

// ═════��═════════════════════════════════════════════════════════
//  七阶段体系 — 按 Suno V5 手册最佳实践重构
//  Suno prompt 优先级（手册 §1.2）：
//    流派 → 细分风格 → 乐器 → 情绪 → 速度/调性 → 人声类型 → 制作质量
// ═══════════════════════════════════════════════════════════════

const PHASE_PRESETS = {
  brainstorm: {
    bpmDelta: 5,
    styleTags: 'Playful, Dynamic, Varied',
    productionStyle: 'Polished Production, Wide Stereo',
    label: '头脑风暴',
    weirdnessConstraint: 60,
    styleWeight: 55,
  },
  focus: {
    bpmDelta: -10,
    styleTags: 'Ambient, Minimal, Spacious, Steady',
    productionStyle: 'Intimate Recording, Warm, Clean Mix',
    label: '专注构思',
    weirdnessConstraint: 45,
    styleWeight: 65,
  },
  sprint: {
    bpmDelta: 20,
    styleTags: 'Driving, Urgent, High Energy, Relentless',
    productionStyle: 'Punchy Mix, Tight Low End, Compressed',
    label: '代码冲刺',
    weirdnessConstraint: 45,
    styleWeight: 75,
  },
  charge: {
    bpmDelta: 15,
    styleTags: 'Epic, Powerful, Heroic, Building Tension',
    productionStyle: 'Wide Stereo, Cinematic Mix',
    label: '战鼓催阵',
    weirdnessConstraint: 55,
    styleWeight: 65,
  },
  behind: {
    bpmDelta: 25,
    styleTags: 'Urgent, Tense, Countdown, High Stakes',
    productionStyle: 'Punchy Mix, Impactful',
    label: '落后了',
    weirdnessConstraint: 40,
    styleWeight: 75,
  },
  break: {
    bpmDelta: -20,
    styleTags: 'Chill, Mellow, Laid-Back',
    productionStyle: 'Lo-Fi, Vinyl Crackle, Warm',
    label: '休息一下',
    weirdnessConstraint: 50,
    styleWeight: 60,
  },
  celebrate: {
    bpmDelta: 10,
    styleTags: 'Triumphant, Euphoric, Joyful',
    productionStyle: 'Wide Stereo, Hi-Fi, Polished Production',
    label: '完成了！',
    weirdnessConstraint: 55,
    styleWeight: 60,
  },
};

const LEGACY_PHASE_MAP = { Focus: 'focus', Spark: 'brainstorm', Sprint: 'sprint', Charge: 'charge' };

function resolvePhaseId(phase) {
  if (PHASE_PRESETS[phase]) return phase;
  const mapped = LEGACY_PHASE_MAP[phase];
  if (mapped && PHASE_PRESETS[mapped]) return mapped;
  return 'focus';
}

// MBTI 四轴 remix — 短 Suno 关键词（手册 §12.24: 不要评价词，用特征词）
const AXIS_DESCRIPTORS = {
  ie: { low: 'Intimate, Introspective', high: 'Energetic, Bold' },
  ns: { low: 'Abstract, Experimental', high: 'Groovy, Rhythmic' },
  tf: { low: 'Precise, Clean', high: 'Warm, Emotional' },
  jp: { low: 'Structured, Steady', high: 'Improvised, Loose' },
};

function clampBpm(value) {
  return Math.max(60, Math.min(180, Math.round(value)));
}

function clampParam(value, min = 0, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function mbtiFromAxes(axes) {
  const { ie = 20, ns = 20, tf = 20, jp = 20 } = axes || {};
  return (
    (ie < 50 ? 'I' : 'E') +
    (ns < 50 ? 'N' : 'S') +
    (tf < 50 ? 'T' : 'F') +
    (jp < 50 ? 'J' : 'P')
  );
}

function buildRemixDescriptors(axes) {
  if (!axes) return [];
  return Object.entries(AXIS_DESCRIPTORS)
    .map(([key, desc]) => {
      const value = Number(axes[key] ?? 50);
      const strength = Math.abs(value - 50) / 50;
      return { text: value < 50 ? desc.low : desc.high, strength };
    })
    .filter((e) => e.strength >= 0.20)
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 2)
    .map((e) => e.text);
}

// DJ 风格推子 — 短 Suno 关键词
function buildStyleAdjustments(style) {
  if (!style) return { keywords: [], bpmDelta: 0 };
  const keywords = [];
  let bpmDelta = 0;

  const energy = Number(style.energy ?? 50);
  const texture = Number(style.texture ?? 50);
  const brightness = Number(style.brightness ?? 50);

  bpmDelta += ((energy - 50) / 50) * 15;
  if (energy >= 70) keywords.push('High Energy');
  else if (energy <= 30) keywords.push('Calm, Relaxed');

  if (texture >= 70) keywords.push('Acoustic Guitar, Organic');
  else if (texture <= 30) keywords.push('Analog Synth, Electronic');

  if (brightness >= 70) keywords.push('Bright, Uplifting');
  else if (brightness <= 30) keywords.push('Dark, Moody');

  return { keywords, bpmDelta };
}

function buildProjectLayer(projectAnalysis) {
  if (!projectAnalysis) return '';
  const parts = [
    ...(projectAnalysis.themes || []),
    ...(projectAnalysis.mood || []),
    ...(projectAnalysis.instruments || []),
  ];
  return parts.slice(0, 4).join(', ');
}

function splitTerms(text) {
  return String(text || '')
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function stripModifiers(term) {
  return String(term || '')
    .toLowerCase()
    .replace(/\b(acoustic|electric|sampled|upright|brushed|mellow|bright|warm|deep|analog|digital|vintage|modern|live|layered|soft|hard|crisp|lush|raw|polished|smooth|punchy|dreamy)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicateInstruments(profileInstruments, genreStyle, notesKeywords = '') {
  const profileTerms = splitTerms(profileInstruments);
  if (!profileTerms.length) return '';

  const coveredTerms = [
    ...splitTerms(genreStyle?.tags),
    ...(Array.isArray(genreStyle?.instruments) ? genreStyle.instruments : []),
    ...splitTerms(notesKeywords),
  ].map((term) => ({
    raw: term.toLowerCase(),
    stripped: stripModifiers(term),
  }));

  const uncovered = profileTerms.filter((term) => {
    const raw = term.toLowerCase();
    const stripped = stripModifiers(term);
    return !coveredTerms.some((covered) => (
      covered.raw.includes(raw) ||
      raw.includes(covered.raw) ||
      (stripped && covered.stripped && stripped === covered.stripped)
    ));
  });

  return uncovered.join(', ');
}

function computeBpm(profile, genreStyle, phasePreset, styleAdj) {
  const mbtiBaseBpm = (profile.bpmMin + profile.bpmMax) / 2;
  const genreBpmMid = genreStyle?.bpmRange?.length === 2
    ? (Number(genreStyle.bpmRange[0]) + Number(genreStyle.bpmRange[1])) / 2
    : null;
  const hasGenreBpm = Number.isFinite(genreBpmMid);
  const baseBpm = hasGenreBpm
    ? mbtiBaseBpm * 0.3 + genreBpmMid * 0.7
    : mbtiBaseBpm;
  const userBpmDelta = styleAdj.bpmDelta || 0;
  const phaseBpmDelta = Math.abs(userBpmDelta) > 10
    ? phasePreset.bpmDelta * 0.5
    : phasePreset.bpmDelta;
  return clampBpm(baseBpm + phaseBpmDelta + userBpmDelta);
}

function computeAdvancedParams({ phasePreset, selectedGenre, mbti }) {
  let styleWeight = Number(phasePreset.styleWeight || 60);
  let weirdnessConstraint = Number(phasePreset.weirdnessConstraint || 50);
  const genreId = String(selectedGenre || '').toLowerCase();

  if (selectedGenre) {
    styleWeight = Math.min(90, styleWeight + 10);
  }

  if (/(experimental|avant-garde|noise|glitch|industrial)/i.test(genreId)) {
    weirdnessConstraint = Math.min(80, weirdnessConstraint + 15);
    styleWeight = Math.max(30, styleWeight - 10);
  }

  if (String(mbti || '').startsWith('I')) {
    weirdnessConstraint = Math.min(70, weirdnessConstraint + 5);
  }

  return {
    styleWeight: clampParam(styleWeight),
    weirdnessConstraint: clampParam(weirdnessConstraint),
  };
}

function promptLayer(text, priority, source, { required = false, maxTerms = null } = {}) {
  const normalized = String(text || '').trim();
  return normalized ? { text: normalized, priority, source, required, maxTerms } : null;
}

function appendPart(result, text, maxLen) {
  const next = result.length ? `${result.join(', ')}, ${text}` : text;
  if (next.length > maxLen) return false;
  result.push(text);
  return true;
}

function truncateStyleByPriority(parts, maxLen = 200) {
  const ordered = parts
    .filter(Boolean)
    .map((part, index) => ({ ...part, index }))
    .sort((a, b) => a.priority - b.priority || a.index - b.index || Number(b.required) - Number(a.required));

  const result = [];
  const seen = new Set();

  for (const part of ordered) {
    const sourceTerms = Number.isFinite(part.maxTerms)
      ? splitTerms(part.text).slice(0, part.maxTerms)
      : splitTerms(part.text);
    const terms = sourceTerms.filter((term) => {
      const key = term.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!terms.length) continue;

    const text = terms.join(', ');
    if (appendPart(result, text, maxLen)) continue;

    for (const term of terms) {
      if (!appendPart(result, term, maxLen)) {
        if (part.required) continue;
        break;
      }
    }
  }

  return result.join(', ');
}

// Negative tags — 2-6 词
function buildAvoidTags(projectAnalysis, notes, vocals) {
  const parts = [];
  if (!vocals?.enabled) {
    parts.push('Vocals', 'Singing');
  }
  if (projectAnalysis?.avoid?.length) {
    parts.push(...projectAnalysis.avoid.filter((a) => !/^vocals?$/i.test(a) || vocals?.enabled));
  }
  if (notes?.avoid?.length) {
    parts.push(...notes.avoid);
  }
  return [...new Set(parts)].slice(0, 6).join(', ');
}

// ═══════════════════════════════════════════════════════════════
//  核心组装器 — 严格按 Suno 优先级排列
//  流派 → 乐器 → 情绪 → BPM → 制作质感
// ════════════��══════════════════════════════════════════════════

export function composePrompt({ generationForm, form, mbti, axes, mode = 'focus', projectAnalysis, style, selectedGenre, notes, vocals }) {
  if (generationForm || form) {
    return compileMusicGenerationForm(generationForm || form);
  }

  const resolvedMbti = axes ? mbtiFromAxes(axes) : mbti;
  const profile = profiles[resolvedMbti];
  if (!profile) {
    throw new Error(`Unknown MBTI type: ${resolvedMbti}`);
  }

  const phase = resolvePhaseId(mode);
  const phasePreset = PHASE_PRESETS[phase];
  const styleAdj = buildStyleAdjustments(style);
  const remixDescriptors = buildRemixDescriptors(axes);
  const genreStyle = resolveGenreStyle(selectedGenre);

  // 用户备注优先进入 prompt，并参与乐器去重。
  const notesKeywords = notes?.keywords?.length ? notes.keywords.join(', ') : '';
  const notesMood = notes?.mood?.length ? notes.mood.join(', ') : '';

  // BPM：genre 与 MBTI 加权融合，用户 energy 推子优先于阶段偏移。
  const bpm = computeBpm(profile, genreStyle, phasePreset, styleAdj);

  // 1) 流派锚点：用户选 genre 时使用 genre tags；否则强调 MBTI 默认 genre。
  const genreAnchor = genreStyle?.tags || profile.genre?.toUpperCase();
  // 2) 乐器：genre 和 notes 已覆盖的乐器从 MBTI 乐器里移除。
  const instruments = deduplicateInstruments(profile.instruments, genreStyle, notesKeywords);
  // 3) 阶段情绪
  const phaseStyle = phasePreset.styleTags;
  // 4) MBTI 情绪
  const moodWords = profile.moodKeywords;
  // 5) MBTI 轴 remix
  const remixLayer = remixDescriptors.join(', ');
  // 6) DJ 推子
  const faderLayer = styleAdj.keywords.join(', ');
  // 7) 项目内容
  const projectLayer = buildProjectLayer(projectAnalysis);
  // 9) 人声
  const vocalTag = vocals?.enabled ? (vocals?.style || profile.vocalHint || 'Clear Vocals') : '';
  // 10) 制作质感
  const production = phasePreset.productionStyle;

  // 按 Suno V5 权重和 P0/P1/P2 优先级组装。
  const promptParts = [
    promptLayer(genreAnchor, 0, genreStyle ? 'user_genre' : 'mbti_default_genre', { required: true, maxTerms: genreStyle ? 6 : 3 }),
    promptLayer(`${bpm} BPM`, 0, 'computed_bpm', { required: true }),
    promptLayer(vocals?.enabled ? '' : 'Instrumental', 0, 'instrumental_mode', { required: !vocals?.enabled }),
    promptLayer(faderLayer, 0, 'user_dj_fader', { maxTerms: 3 }),
    promptLayer(notesKeywords, 0, 'user_notes'),
    promptLayer(notesMood, 0, 'user_notes'),
    promptLayer(vocalTag, 0, vocals?.style ? 'user_vocal' : 'mbti_vocal', { required: Boolean(vocals?.enabled) }),

    promptLayer(instruments, 1, 'mbti_instruments', { maxTerms: 3 }),
    promptLayer(phaseStyle, 1, 'phase_preset'),
    promptLayer(moodWords, 1, 'mbti_mood'),
    promptLayer(remixLayer, 1, 'mbti_axis'),
    promptLayer(projectLayer, 1, 'project_analysis', { maxTerms: 4 }),

    promptLayer(production, 2, 'phase_production', { maxTerms: 2 }),
  ].filter(Boolean);

  const fullPrompt = truncateStyleByPriority(promptParts, 200);

  // negative_tags
  const negativeTags = buildAvoidTags(projectAnalysis, notes, vocals);
  const advanced = computeAdvancedParams({ phasePreset, selectedGenre: genreStyle?.id || selectedGenre, mbti: resolvedMbti });

  // 四层预览
  const mbtiLayer = [genreStyle ? '' : profile.genre, instruments, moodWords].filter(Boolean).join(', ');
  const modeLayer = `${phaseStyle}, ${bpm} BPM`;
  const consoleLayer = [remixLayer, faderLayer].filter(Boolean).join(', ');
  const notesLayer = [notesKeywords, notesMood].filter(Boolean).join(', ');

  return {
    fullPrompt,
    negativeTags,
    layers: {
      mbti: mbtiLayer,
      project: projectLayer,
      mode: modeLayer,
      console: consoleLayer,
      notes: notesLayer,
    },
    bpm,
    mode: phase,
    weirdnessConstraint: advanced.weirdnessConstraint,
    styleWeight: advanced.styleWeight,
    mbti: resolvedMbti,
    profile: {
      traits: profile.traits,
      genre: profile.genre,
      theme: profile.theme,
    },
    selectedGenre: genreStyle?.id || null,
    personaId: profile.personaId || null,
    hasLyrics: Boolean(vocals?.enabled && vocals?.lyrics),
  };
}

export function getMbtiProfile(mbti) {
  return profiles[mbti] || null;
}

export function listMbtiTypes() {
  return Object.keys(profiles);
}

export { PHASE_PRESETS };
