import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const profiles = JSON.parse(readFileSync(join(__dirname, '../data/mbti-profiles.json'), 'utf-8'));

const MODE_MODIFIERS = {
  Focus: { bpmDelta: -10, style: 'ambient concentration, reduced percussion, smooth flowing', label: '专注' },
  Spark: { bpmDelta: 5, style: 'playful brainstorming energy, surprising variations', label: '头脑风暴' },
  Sprint: { bpmDelta: 20, style: 'urgent driving rhythm, intense momentum, deadline pressure', label: '冲刺' },
  Charge: { bpmDelta: 15, style: 'epic cinematic climax, powerful drums, heroic energy', label: '战鼓' },
};

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

export function composePrompt({ mbti, axes, mode = 'Focus', projectAnalysis, style }) {
  const resolvedMbti = axes ? mbtiFromAxes(axes) : mbti;
  const profile = profiles[resolvedMbti];
  if (!profile) {
    throw new Error(`Unknown MBTI type: ${resolvedMbti}`);
  }

  const modeModifier = MODE_MODIFIERS[mode] || MODE_MODIFIERS.Focus;
  const styleAdj = buildStyleAdjustments(style);
  const remixDescriptors = buildRemixDescriptors(axes);

  const baseBpm = (profile.bpmMin + profile.bpmMax) / 2;
  const bpm = clampBpm(baseBpm + modeModifier.bpmDelta + styleAdj.bpmDelta);

  const mbtiLayer = `${profile.promptBase}, ${profile.styleKeywords}`;
  const projectLayer = buildProjectLayer(projectAnalysis);
  const modeLayer = `${modeModifier.style}, ${bpm} BPM`;
  const consoleParts = [...remixDescriptors, ...styleAdj.keywords];
  const consoleLayer = consoleParts.join(', ');

  const fullPrompt = [
    profile.promptBase,
    modeModifier.style,
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
    mode,
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

export { MODE_MODIFIERS };
