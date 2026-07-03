import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(join(__dirname, '../data/mbti-profiles.json'), 'utf-8'));

// 七阶段体系（v3 替换原 Focus/Spark/Sprint/Charge 四模式）。
// 旧模式映射：Focus→focus，Spark→brainstorm，Sprint→sprint，Charge→charge。
// weirdnessConstraint / styleWeight 已用真实 TTAPI Key 验证为可用的 Suno V5 参数。
const PHASE_PRESETS = {
  brainstorm: {
    bpmDelta: 5,
    style: 'playful, varied, dynamic, surprising, moderate energy brainstorming',
    label: '头脑风暴',
    weirdnessConstraint: 60,
    styleWeight: 50,
  },
  focus: {
    bpmDelta: -10,
    style: 'ambient, minimal, spacious, steady, low energy concentration',
    label: '专注构思',
    weirdnessConstraint: 40,
    styleWeight: 70,
  },
  sprint: {
    bpmDelta: 20,
    style: 'driving, urgent, high energy, relentless, propulsive',
    label: '代码冲刺',
    weirdnessConstraint: 45,
    styleWeight: 75,
  },
  charge: {
    bpmDelta: 15,
    style: 'epic, powerful, heroic, building to climax',
    label: '战鼓催阵',
    weirdnessConstraint: 50,
    styleWeight: 65,
  },
  behind: {
    bpmDelta: 25,
    style: 'urgent, tense, pushing, countdown, high stakes',
    label: '落后了',
    weirdnessConstraint: 45,
    styleWeight: 70,
  },
  break: {
    bpmDelta: -20,
    style: 'chill, relaxed, mellow, easygoing, soft',
    label: '休息一下',
    weirdnessConstraint: 55,
    styleWeight: 60,
  },
  celebrate: {
    bpmDelta: 10,
    style: 'triumphant, joyful, euphoric, confetti, celebration',
    label: '完成了！',
    weirdnessConstraint: 55,
    styleWeight: 60,
  },
};

// 兼容旧四模式调用方（如遗留缓存/外部脚本仍传 Focus/Spark/Sprint/Charge）
const LEGACY_PHASE_MAP = { Focus: 'focus', Spark: 'brainstorm', Sprint: 'sprint', Charge: 'charge' };

function resolvePhaseId(phase) {
  if (PHASE_PRESETS[phase]) return phase;
  const mapped = LEGACY_PHASE_MAP[phase];
  if (mapped && PHASE_PRESETS[mapped]) return mapped;
  return 'focus';
}

// MBTI 四轴 remix：value 0-100，0 = 左极（I/N/T/J），100 = 右极（E/S/F/P）
const AXIS_DESCRIPTORS = {
  ie: { low: 'introspective inward-focused depth', high: 'outgoing expressive stage energy' },
  ns: { low: 'abstract visionary soundscapes', high: 'grounded tactile rhythmic detail' },
  tf: { low: 'precise architectural structure', high: 'warm emotive harmonies' },
  jp: { low: 'organized steady progression', high: 'improvised fluid transitions' },
};

function clampBpm(value) {
  return Math.max(60, Math.min(170, Math.round(value)));
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
  const entries = Object.entries(AXIS_DESCRIPTORS)
    .map(([key, desc]) => {
      const value = Number(axes[key] ?? 50);
      const strength = Math.abs(value - 50) / 50;
      return { text: value < 50 ? desc.low : desc.high, strength };
    })
    .filter((e) => e.strength >= 0.15)
    .sort((a, b) => b.strength - a.strength);
  return entries.slice(0, 3).map((e) => e.text);
}

// DJ 控制台风格滑块：energy 0-100，texture 0=电子 100=原声，brightness 0=暗黑 100=明亮
function buildStyleAdjustments(style) {
  if (!style) return { keywords: [], bpmDelta: 0 };
  const keywords = [];
  let bpmDelta = 0;

  const energy = Number(style.energy ?? 50);
  const texture = Number(style.texture ?? 50);
  const brightness = Number(style.brightness ?? 50);

  bpmDelta += ((energy - 50) / 50) * 15;
  if (energy >= 65) keywords.push('high energy drive');
  else if (energy <= 35) keywords.push('calm relaxed feel');

  if (texture >= 65) keywords.push('organic acoustic instrumentation');
  else if (texture <= 35) keywords.push('synthetic electronic textures');

  if (brightness >= 65) keywords.push('bright uplifting tone');
  else if (brightness <= 35) keywords.push('dark moody atmosphere');

  return { keywords, bpmDelta };
}

function buildProjectLayer(projectAnalysis) {
  if (!projectAnalysis) {
    return 'creative hackathon innovation atmosphere';
  }
  const parts = [
    ...(projectAnalysis.themes || []),
    ...(projectAnalysis.mood || []),
    ...(projectAnalysis.instruments || []),
  ];
  return parts.slice(0, 6).join(', ');
}

export function composePrompt({ mbti, axes, mode = 'focus', projectAnalysis, style }) {
  const resolvedMbti = axes ? mbtiFromAxes(axes) : mbti;
  const profile = profiles[resolvedMbti];
  if (!profile) {
    throw new Error(`Unknown MBTI type: ${resolvedMbti}`);
  }

  const phase = resolvePhaseId(mode);
  const phasePreset = PHASE_PRESETS[phase];
  const styleAdj = buildStyleAdjustments(style);
  const remixDescriptors = buildRemixDescriptors(axes);

  const baseBpm = (profile.bpmMin + profile.bpmMax) / 2;
  const bpm = clampBpm(baseBpm + phasePreset.bpmDelta + styleAdj.bpmDelta);

  const mbtiLayer = `${profile.promptBase}, ${profile.styleKeywords}`;
  const projectLayer = buildProjectLayer(projectAnalysis);
  const modeLayer = `${phasePreset.style}, ${bpm} BPM`;
  const consoleParts = [...remixDescriptors, ...styleAdj.keywords];
  const consoleLayer = consoleParts.join(', ');

  const fullPrompt = [
    profile.promptBase,
    phasePreset.style,
    projectLayer,
    consoleLayer,
    `${bpm} BPM`,
    'instrumental',
    'high quality production',
    'no vocals, no lyrics, no speech, no singing',
  ]
    .filter(Boolean)
    .join(', ');

  return {
    fullPrompt,
    layers: {
      mbti: mbtiLayer,
      project: projectLayer,
      mode: modeLayer,
      console: consoleLayer,
    },
    bpm,
    mode: phase,
    weirdnessConstraint: phasePreset.weirdnessConstraint,
    styleWeight: phasePreset.styleWeight,
    mbti: resolvedMbti,
    profile: {
      traits: profile.traits,
      genres: profile.genres,
      theme: profile.theme,
    },
  };
}

export function getMbtiProfile(mbti) {
  return profiles[mbti] || null;
}

export function listMbtiTypes() {
  return Object.keys(profiles);
}

export { PHASE_PRESETS };
