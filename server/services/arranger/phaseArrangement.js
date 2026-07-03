/**
 * 阶段内编排 (Phase Arrangement) — docs/ai-music-engine-design.md §8.4
 * 阶段内部不是一条直线，而是波浪式能量起伏；不同阶段波形不同（§8.4 表格）。
 */

// 每种阶段的能量倍率波形（相对于该阶段 baseEnergy 的乘数），对应文档 ASCII 波形
const WAVE_PATTERNS = {
  brainstorm: [0.75, 1.1, 0.8, 1.15, 0.85, 1.05], // 高频起伏，刺激灵感
  focus: [0.95, 1.0, 1.0, 0.9, 1.0, 1.0], // 平稳为主，偶尔微波
  sprint: [0.8, 1.0, 1.15, 1.1, 0.9], // 快速爬升→维持→缓冲
  charge: [0.8, 0.95, 1.1, 1.2, 1.3], // 持续爬升到高潮
  bottleneck: [0.9, 1.0, 0.85, 1.0, 0.9, 1.0], // 低能量中寻找小突破
  rest: [0.9, 0.6, 0.5, 0.7, 0.95], // 先降后升，留白
  break: [0.9, 0.6, 0.5, 0.7, 0.95], // break 复用 rest 波形（同为低能量休整）
  celebrate: [1.05, 1.15, 1.2, 1.15, 1.1], // 持续高位，庆典感
  behind: [0.9, 1.05, 1.15, 1.2, 1.15], // 紧迫感持续攀升（文档未列出，按 charge 风格补充）
};

// 阶段基础能量（对齐 §2.3 PHASE_PRESETS 的强度定性描述，供波形乘数换算用）
const PHASE_BASE_ENERGY = {
  brainstorm: 60,
  focus: 40,
  sprint: 85,
  charge: 75,
  behind: 90,
  break: 25,
  celebrate: 80,
};

function clamp(value, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, value));
}

/**
 * 生成阶段内曲目序列的目标能量与过渡类型
 * phase: 阶段 id；trackCount: 该阶段计划排的曲目数；phaseDurationSec: 阶段预计时长（秒）
 */
export function generatePhaseSequence(phase, trackCount, phaseDurationSec) {
  const baseEnergy = PHASE_BASE_ENERGY[phase] ?? 50;
  const wave = WAVE_PATTERNS[phase] || WAVE_PATTERNS.focus;
  const count = Math.max(1, trackCount || wave.length);

  // trackCount 与波形长度不一致时，按比例重采样波形
  const sampled = Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : (i / (count - 1)) * (wave.length - 1);
    const lo = Math.floor(t);
    const hi = Math.min(wave.length - 1, lo + 1);
    const frac = t - lo;
    return wave[lo] + (wave[hi] - wave[lo]) * frac;
  });

  return sampled.map((multiplier, i) => ({
    index: i,
    targetEnergy: clamp(Math.round(baseEnergy * multiplier)),
    durationSec: Math.round((phaseDurationSec || count * 180) / count),
    transitionType: i === 0 ? 'fade-in' : i === sampled.length - 1 ? 'fade-out' : 'crossfade',
  }));
}

export function getWavePattern(phase) {
  return WAVE_PATTERNS[phase] || WAVE_PATTERNS.focus;
}

export function getPhaseBaseEnergy(phase) {
  return PHASE_BASE_ENERGY[phase] ?? 50;
}

export { WAVE_PATTERNS, PHASE_BASE_ENERGY };
