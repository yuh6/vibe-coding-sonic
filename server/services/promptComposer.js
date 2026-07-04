import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

// Style 字数限制 200 字符
function truncateStyle(text, maxLen = 200) {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastComma = truncated.lastIndexOf(',');
  return lastComma > 0 ? truncated.slice(0, lastComma).trim() : truncated.trim();
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

export function composePrompt({ mbti, axes, mode = 'focus', projectAnalysis, style, selectedGenre, notes, vocals }) {
  const resolvedMbti = axes ? mbtiFromAxes(axes) : mbti;
  const profile = profiles[resolvedMbti];
  if (!profile) {
    throw new Error(`Unknown MBTI type: ${resolvedMbti}`);
  }

  const phase = resolvePhaseId(mode);
  const phasePreset = PHASE_PRESETS[phase];
  const styleAdj = buildStyleAdjustments(style);
  const remixDescriptors = buildRemixDescriptors(axes);

  // BPM
  let baseBpm;
  if (selectedGenre?.bpmRange?.length === 2) {
    baseBpm = (selectedGenre.bpmRange[0] + selectedGenre.bpmRange[1]) / 2;
  } else {
    baseBpm = (profile.bpmMin + profile.bpmMax) / 2;
  }
  const bpm = clampBpm(baseBpm + phasePreset.bpmDelta + styleAdj.bpmDelta);

  // 1) 流派锚点
  const genreAnchor = selectedGenre?.tags || profile.genre;
  // 2) 乐器
  const instruments = profile.instruments;
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
  // 8) 备注
  const notesKeywords = notes?.keywords?.length ? notes.keywords.join(', ') : '';
  const notesMood = notes?.mood?.length ? notes.mood.join(', ') : '';
  // 9) 人声
  const vocalTag = vocals?.enabled ? (profile.vocalHint || 'Clear Vocals') : '';
  // 10) 制作质感
  const production = phasePreset.productionStyle;

  // 组装
  const promptParts = [
    genreAnchor,
    instruments,
    phaseStyle,
    moodWords,
    remixLayer,
    faderLayer,
    projectLayer,
    notesKeywords,
    notesMood,
    `${bpm} BPM`,
    vocalTag,
    vocals?.enabled ? '' : 'Instrumental',
    production,
  ].filter(Boolean);

  let fullPrompt = promptParts.join(', ');
  fullPrompt = truncateStyle(fullPrompt, 200);

  // negative_tags
  const negativeTags = buildAvoidTags(projectAnalysis, notes, vocals);

  // 四层预览
  const mbtiLayer = `${profile.genre}, ${instruments}`;
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
    weirdnessConstraint: phasePreset.weirdnessConstraint,
    styleWeight: phasePreset.styleWeight,
    mbti: resolvedMbti,
    profile: {
      traits: profile.traits,
      genre: profile.genre,
      theme: profile.theme,
    },
    selectedGenre: selectedGenre?.id || null,
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
