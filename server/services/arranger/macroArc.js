/**
 * 宏观弧线 (Macro Arc) — docs/ai-music-engine-design.md §8.3
 * 整场黑客松（8-24h）的情绪走势，与 §2.3 的 PHASE_PRESETS（用户手动/日程可选的 7 个
 * 阶段）是两套独立坐标系：Macro Arc 按「时间进度百分比」给出基础能量，
 * PHASE_PRESETS/phaseArrangement 按「当前阶段」给出风格与波形。
 * Arranger 决策时两者相乘/混合，而不是互相替代。
 */

// 8 段式，[能量范围, 时长占比, 说明]，与设计文档 §8.3 代码块一致
export const MACRO_ARC = [
  { id: 'opening', energy: [20, 40], duration: 0.05, label: '开赛·热身' },
  { id: 'brainstorm', energy: [40, 85], duration: 0.15, label: '头脑风暴' },
  { id: 'focus', energy: [30, 60], duration: 0.2, label: '专注构思' },
  { id: 'sprint', energy: [70, 95], duration: 0.2, label: '代码冲刺' },
  { id: 'bottleneck', energy: [40, 65], duration: 0.1, label: '瓶颈期' },
  { id: 'rest', energy: [15, 35], duration: 0.05, label: '休息充电' },
  { id: 'finalPush', energy: [80, 100], duration: 0.15, label: '终极冲刺' },
  { id: 'celebrate', energy: [60, 90], duration: 0.1, label: '收官庆祝' },
];

function segmentBoundaries() {
  let acc = 0;
  return MACRO_ARC.map((seg) => {
    const start = acc;
    acc += seg.duration;
    return { ...seg, start, end: acc };
  });
}

const BOUNDARIES = segmentBoundaries();

/**
 * progress: 0-1，会话已经过时长 / 会话总时长
 * 返回该时间点所在 Macro Arc 段落及段内插值能量（段起点 = 低值，段终点 = 高值，线性过渡）
 */
export function arcEnergyAtProgress(progress) {
  const p = Math.max(0, Math.min(1, progress));
  const seg = BOUNDARIES.find((s) => p >= s.start && p < s.end) || BOUNDARIES[BOUNDARIES.length - 1];
  const span = seg.end - seg.start || 1;
  const localT = (p - seg.start) / span;
  const [lo, hi] = seg.energy;
  const energy = lo + (hi - lo) * localT;
  return { segment: seg.id, label: seg.label, energy: Math.round(energy) };
}

/**
 * 采样整条能量曲线，供 GET /api/arranger/energy-curve 使用
 */
export function buildEnergyCurve(steps = 48) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const progress = i / steps;
    const { segment, label, energy } = arcEnergyAtProgress(progress);
    points.push({ progress, segment, label, energy });
  }
  return points;
}

/**
 * 会话已经过的时间进度（0-1）。sessionStartMs/sessionDurationMs 由调用方（sessionEngine）传入。
 */
export function sessionProgress(startMs, durationMs, nowMs = Date.now()) {
  if (!durationMs || durationMs <= 0) return 0;
  return Math.max(0, Math.min(1, (nowMs - startMs) / durationMs));
}
