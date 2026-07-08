/**
 * 会话存储 (Session Store) — 对接 docs/ai-music-engine-design.md §10.1 的 `sessions` 表，
 * 并维护编排引擎需要的运行态（手动阶段覆盖、反馈日志、各服务实例）。
 * DB 行是持久化的"配置+预算"；运行态是进程内存中的"当前状态机"，服务重启会丢失运行态但
 * 预算/日程等配置仍在 SQLite 里。
 */
import { randomUUID } from 'crypto';
import { db } from '../../db.js';

const insertStmt = db.prepare(`
  INSERT INTO sessions
    (id, user_id, name, mbti_type, mbti_sliders, schedule_json, generation_params_json, budget_limit, budget_spent)
  VALUES
    (@id, @userId, @name, @mbtiType, @mbtiSliders, @scheduleJson, @generationParamsJson, @budgetLimit, 0)
`);

const getStmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);

const updateScheduleStmt = db.prepare(`UPDATE sessions SET schedule_json = ? WHERE id = ?`);

const updateGenerationParamsStmt = db.prepare(`UPDATE sessions SET generation_params_json = ? WHERE id = ?`);

const addSpendStmt = db.prepare(`UPDATE sessions SET budget_spent = budget_spent + ? WHERE id = ?`);

// 运行态：Map<sessionId, { schedule, manualPhase, feedbackLog, startedAt, durationMs,
//                          state, arranger, pipeline, currentTrackId, currentPlayHistoryId }>
const runtime = new Map();

function parseSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    mbtiType: row.mbti_type,
    mbtiSliders: safeParse(row.mbti_sliders, null),
    schedule: safeParse(row.schedule_json, null),
    generationParams: safeParse(row.generation_params_json, null),
    budgetLimit: row.budget_limit,
    budgetSpent: row.budget_spent,
    createdAt: row.created_at,
  };
}

function safeParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function createSession({
  userId = null,
  name,
  mbtiType,
  mbtiSliders,
  schedule,
  generationParams = null,
  budgetLimit = 10.0,
}) {
  const id = randomUUID();
  await insertStmt.run({
    id,
    userId,
    name: name || null,
    mbtiType: mbtiType || null,
    mbtiSliders: mbtiSliders ? JSON.stringify(mbtiSliders) : null,
    scheduleJson: schedule ? JSON.stringify(schedule) : null,
    generationParamsJson: generationParams ? JSON.stringify(generationParams) : null,
    budgetLimit,
  });

  runtime.set(id, {
    schedule: schedule || null,
    manualPhase: null,
    feedbackLog: [],
    generationParams: generationParams || null,
    startedAt: Date.now(),
    durationMs: 8 * 60 * 60 * 1000, // 默认按 8 小时估算，可由 schedule 覆盖
    state: 'IDLE',
    arranger: null,
    pipeline: null,
    currentTrackId: null,
    currentPlayHistoryId: null,
  });

  return getSession(id);
}

export async function getSession(sessionId) {
  return parseSession(await getStmt.get(sessionId));
}

export async function updateSchedule(sessionId, schedule) {
  await updateScheduleStmt.run(JSON.stringify(schedule), sessionId);
  const rt = runtime.get(sessionId);
  if (rt) rt.schedule = schedule;
  return getSession(sessionId);
}

export async function updateGenerationParams(sessionId, generationParams) {
  await updateGenerationParamsStmt.run(generationParams ? JSON.stringify(generationParams) : null, sessionId);
  const rt = runtime.get(sessionId);
  if (rt) rt.generationParams = generationParams || null;
  return getSession(sessionId);
}

export async function addBudgetSpend(sessionId, cost) {
  await addSpendStmt.run(cost, sessionId);
}

/** 运行态：供 sensingLayer/arranger/generationScheduler 读写 manualPhase/feedbackLog/state 等 */
export async function getRuntime(sessionId) {
  if (!runtime.has(sessionId)) {
    // 服务重启后运行态丢失，但会话本身仍在 DB —— 用默认值重建运行态
    const session = await getSession(sessionId);
    if (!session) return null;
    runtime.set(sessionId, {
      schedule: session.schedule,
      manualPhase: null,
      feedbackLog: [],
      generationParams: session.generationParams || null,
      startedAt: Date.now(),
      durationMs: 8 * 60 * 60 * 1000,
      state: 'IDLE',
      arranger: null,
      pipeline: null,
      currentTrackId: null,
      currentPlayHistoryId: null,
    });
  }
  return runtime.get(sessionId);
}

export async function setState(sessionId, state) {
  const rt = await getRuntime(sessionId);
  if (rt) rt.state = state;
}

export async function getState(sessionId) {
  return (await getRuntime(sessionId))?.state || 'IDLE';
}
