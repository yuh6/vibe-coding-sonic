/**
 * Arranger 编排引擎主入口 — docs/ai-music-engine-design.md §8.9 编排状态机
 * 把 macroArc / phaseArrangement / trackPool / sensingLayer / arranger / generationScheduler
 * 串起来，对外提供 REST (routes/arranger.js) 和 WebSocket (routes/ws.js) 都会用到的高层 API。
 *
 * 状态机：IDLE → BOOTSTRAP → PLAYING ↔ TRANSITION → DECIDING → GENERATING → CACHED → PHASE_CHANGE
 */
import { EventEmitter } from 'events';
import * as sessionStore from './sessionStore.js';
import * as trackPool from './trackPool.js';
import { SensingLayer } from './sensingLayer.js';
import { Arranger } from './arranger.js';
import { GenerationScheduler } from './generationScheduler.js';
import { buildEnergyCurve, arcEnergyAtProgress } from './macroArc.js';
import { generatePhaseSequence } from './phaseArrangement.js';

// 冷启动/补货数量（§8.5 生成节奏表）
const COLD_START_COUNT = 2;
const REFILL_THRESHOLD = 2; // 当前阶段剩余 ≤2 首 → 后台补货
const REFILL_COUNT = 2;

// 全局事件总线：routes/ws.js 订阅后转发到 /ws/events
export const arrangerEvents = new EventEmitter();
arrangerEvents.setMaxListeners(0);

function emit(sessionId, type, payload = {}) {
  arrangerEvents.emit('event', { sessionId, type, payload, at: Date.now() });
}

function getEngineBundle(sessionId) {
  const rt = sessionStore.getRuntime(sessionId);
  if (!rt) throw new Error(`Unknown session: ${sessionId}`);
  if (!rt.arranger) {
    const sensing = new SensingLayer(rt);
    rt.arranger = new Arranger(sessionId, sensing);
    rt.sensing = sensing;
  }
  if (!rt.scheduler) {
    rt.scheduler = new GenerationScheduler(sessionId, {
      onEvent: (type, payload) => emit(sessionId, type, payload),
    });
  }
  return rt;
}

function buildGenerationOpts(session, phase, targetEnergy) {
  return {
    mbti: session.mbtiType,
    axes: session.mbtiSliders,
    mode: phase,
    projectAnalysis: null,
    style: null,
    targetEnergy,
  };
}

/** BOOTSTRAP：冷启动生成当前阶段首批 2-3 首，全部就绪后才进入 PLAYING */
export async function startEngine(sessionId) {
  const session = sessionStore.getSession(sessionId);
  if (!session) throw new Error(`Unknown session: ${sessionId}`);
  const rt = getEngineBundle(sessionId);

  sessionStore.setState(sessionId, 'BOOTSTRAP');
  emit(sessionId, 'phase_changed', { phase: rt.sensing.getCurrentPhase(), state: 'BOOTSTRAP' });

  const phase = rt.sensing.getCurrentPhase();
  const targetEnergy = rt.sensing.getTargetEnergy();
  const existing = trackPool.countReady(sessionId, phase);
  const need = Math.max(0, COLD_START_COUNT - existing);

  await Promise.all(
    Array.from({ length: need }, () =>
      rt.scheduler.submit(buildGenerationOpts(session, phase, targetEnergy), { urgency: 'immediate' })
    )
  );

  sessionStore.setState(sessionId, 'PLAYING');
  const first = await decideNext(sessionId);
  emit(sessionId, 'phase_changed', { phase, state: 'PLAYING' });
  return first;
}

export function stopEngine(sessionId) {
  sessionStore.setState(sessionId, 'IDLE');
  emit(sessionId, 'phase_changed', { state: 'IDLE' });
}

/** 编排引擎决定下一首；若曲库池不足则触发按需补货（异步，不阻塞返回） */
export async function decideNext(sessionId) {
  const rt = getEngineBundle(sessionId);
  const session = sessionStore.getSession(sessionId);
  sessionStore.setState(sessionId, 'DECIDING');

  const decision = rt.arranger.decideNext();

  // 结束上一首的播放记录
  if (rt.currentPlayHistoryId) {
    trackPool.endPlay(rt.currentPlayHistoryId, { skipped: false });
  }

  if (decision.track) {
    rt.currentTrackId = decision.track.id;
    rt.currentPlayHistoryId = trackPool.recordPlayStart(sessionId, decision.track.id, decision.targetPhase);
    emit(sessionId, 'track_changed', { track: decision.track, targetEnergy: decision.targetEnergy });
  }

  maybeRefill(sessionId, rt, session, decision.targetPhase, decision.targetEnergy);

  sessionStore.setState(sessionId, 'PLAYING');
  return decision;
}

/** §8.5 后台补货：当前阶段就绪曲目 ≤2 首 → 异步补 1-2 首；不阻塞当前决策返回 */
function maybeRefill(sessionId, rt, session, phase, targetEnergy) {
  const ready = trackPool.countReady(sessionId, phase);
  const pending = trackPool.countPending(sessionId, phase);
  if (ready + pending >= REFILL_THRESHOLD + 1) return;

  sessionStore.setState(sessionId, 'GENERATING');
  emit(sessionId, 'pool_refill', { phase, ready, pending });

  const need = REFILL_COUNT - pending;
  for (let i = 0; i < need; i += 1) {
    rt.scheduler
      .submit(buildGenerationOpts(session, phase, targetEnergy))
      .catch((err) => console.error('[arranger] refill failed:', err.message));
  }
}

/** 用户手动切换阶段：覆盖自动判断，触发 PHASE_CHANGE → 重新计算编排序列 */
export async function setManualPhase(sessionId, phase) {
  const rt = getEngineBundle(sessionId);
  sessionStore.setState(sessionId, 'PHASE_CHANGE');
  rt.sensing.setManualPhase(phase);
  emit(sessionId, 'phase_changed', { phase, manual: true });

  const session = sessionStore.getSession(sessionId);
  const targetEnergy = rt.sensing.getTargetEnergy();
  const ready = trackPool.countReady(sessionId, phase);
  if (ready < COLD_START_COUNT) {
    await rt.scheduler.submit(buildGenerationOpts(session, phase, targetEnergy), { urgency: 'immediate' });
  }

  return decideNext(sessionId);
}

/** 用户按钮反馈：too_loud / more_drive / skip / like */
export async function submitFeedback(sessionId, action) {
  const rt = getEngineBundle(sessionId);
  const effect = rt.sensing.applyFeedback(action);
  emit(sessionId, 'user_feedback', { action, effect });

  if (effect?.skipCurrent) {
    return decideNext(sessionId);
  }
  return { effect };
}

export function nowPlaying(sessionId) {
  const rt = sessionStore.getRuntime(sessionId);
  if (!rt) return null;
  const track = rt.currentTrackId ? trackPool.getTrack(rt.currentTrackId) : null;
  return {
    state: rt.state,
    phase: rt.sensing ? rt.sensing.getCurrentPhase() : rt.manualPhase,
    track,
  };
}

export function history(sessionId, limit = 20) {
  return trackPool.recentHistory(sessionId, limit);
}

export function poolStatus(sessionId) {
  const session = sessionStore.getSession(sessionId);
  return {
    budgetLimit: session?.budgetLimit,
    budgetSpent: session?.budgetSpent,
    phases: trackPool.poolStatus(sessionId),
  };
}

export function energyCurve() {
  return buildEnergyCurve();
}

export { arcEnergyAtProgress, generatePhaseSequence };
