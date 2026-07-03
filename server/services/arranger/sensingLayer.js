/**
 * 感知层 (Sensing) — docs/ai-music-engine-design.md §8.7
 * v3 收敛：仅三个确定性信号，不做情绪推断。
 *   1. 日程时间：当前时间落在日程的哪个阶段
 *   2. 手动切换：用户点击阶段按钮，覆盖自动判断
 *   3. 跳歌计数：最近 30 分钟跳歌 ≥3 次 → 降低当前风格权重（energyDelta 衰减）
 * 用户显式反馈用按钮而非文本解析：too_loud / more_drive / skip / like。
 */
import { arcEnergyAtProgress } from './macroArc.js';

const FEEDBACK_EFFECTS = {
  too_loud: { energyDelta: -20 },
  more_drive: { energyDelta: 15 },
  skip: { skipCurrent: true },
  like: { boostCurrentStyle: 0.3 },
};

const SKIP_WINDOW_MS = 30 * 60 * 1000; // 最近 30 分钟
const SKIP_THRESHOLD = 3;
const FEEDBACK_DECAY_MS = 15 * 60 * 1000; // energyDelta 15 分钟内线性衰减到 0

export class SensingLayer {
  constructor(session) {
    this.session = session; // { schedule, manualPhase, feedbackLog: [{action, at}], startedAt, durationMs }
  }

  /** 信号 1 + 2：日程时间 or 手动切换（手动优先） */
  getCurrentPhase() {
    if (this.session.manualPhase) return this.session.manualPhase;
    return this.getTimePhase();
  }

  getTimePhase() {
    const schedule = this.session.schedule;
    if (!schedule?.phases?.length) return 'focus';
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();

    for (const phase of schedule.phases) {
      const [sh, sm] = phase.start.split(':').map(Number);
      const [eh, em] = phase.end.split(':').map(Number);
      const start = sh * 60 + sm;
      let end = eh * 60 + em;
      if (end <= start) end += 24 * 60;
      let cur = minutes;
      if (cur < start) cur += 24 * 60;
      if (cur >= start && cur < end) return phase.mode;
    }
    return schedule.phases[0]?.mode || 'focus';
  }

  /** 信号 3：跳歌计数 → 累计 energyDelta（含衰减） */
  feedbackDelta(nowMs = Date.now()) {
    const log = this.session.feedbackLog || [];
    let delta = 0;
    for (const entry of log) {
      const effect = FEEDBACK_EFFECTS[entry.action];
      if (!effect?.energyDelta) continue;
      const age = nowMs - entry.at;
      if (age < 0 || age > FEEDBACK_DECAY_MS) continue;
      const remaining = 1 - age / FEEDBACK_DECAY_MS;
      delta += effect.energyDelta * remaining;
    }
    return delta;
  }

  /** 最近 30 分钟跳歌次数 ≥3 → 判定「当前风格不受欢迎」 */
  isSkipStorm(nowMs = Date.now()) {
    const log = this.session.feedbackLog || [];
    const recentSkips = log.filter(
      (e) => e.action === 'skip' && nowMs - e.at <= SKIP_WINDOW_MS
    );
    return recentSkips.length >= SKIP_THRESHOLD;
  }

  getTargetEnergy(nowMs = Date.now()) {
    const progress = this.session.durationMs
      ? Math.max(0, Math.min(1, (nowMs - this.session.startedAt) / this.session.durationMs))
      : 0.3;
    const base = arcEnergyAtProgress(progress).energy;
    const delta = this.feedbackDelta(nowMs);
    return Math.max(0, Math.min(100, Math.round(base + delta)));
  }

  /** 按钮反馈 → 直接、确定的修正；返回 effect 供调用方（arranger）决定是否立即换曲 */
  applyFeedback(action, nowMs = Date.now()) {
    const effect = FEEDBACK_EFFECTS[action];
    if (!effect) return null;
    this.session.feedbackLog = this.session.feedbackLog || [];
    this.session.feedbackLog.push({ action, at: nowMs });
    // 只保留最近 30 分钟的记录，避免无限增长
    this.session.feedbackLog = this.session.feedbackLog.filter((e) => nowMs - e.at <= SKIP_WINDOW_MS);
    return { ...effect, skipStorm: this.isSkipStorm(nowMs) };
  }

  setManualPhase(phase) {
    this.session.manualPhase = phase;
  }
}

export { FEEDBACK_EFFECTS };
