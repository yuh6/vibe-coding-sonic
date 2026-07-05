/**
 * 生成调度 (Generation Scheduler) — docs/ai-music-engine-design.md §9.2 + §8.10 费用预估
 * 编排引擎/曲库池决定"要补什么"之后，由调度器负责实际调用 TTAPI 生成、轮询、落盘，
 * 并执行预算控制（硬上限 $10/天、软上限 $0.5/小时、余额<$2 暂停生成）。
 */
import { randomUUID } from 'crypto';
import { composePrompt } from '../promptComposer.js';
import { isSunoConfigured, submitGeneration, pollGeneration } from '../sunoClient.js';
import { generateLyrics } from '../lyricsGenerator.js';
import { pickTrack } from '../libraryStore.js';
import { storage } from '../../storage/index.js';
import * as trackPool from './trackPool.js';
import * as sessionStore from './sessionStore.js';

const COST_PER_TRACK = 0.08; // §8.10：约 $0.05-0.10/首，取中位数估算
const HARD_DAILY_LIMIT = 10; // 硬上限：$10/天（sessions.budget_limit 默认值同步于此）
const SOFT_HOURLY_LIMIT = 0.5; // 软上限：每小时 ≤ $0.5
const PAUSE_BALANCE_THRESHOLD = 2; // 余额 < $2 → 暂停生成，只用已有曲库循环
const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

export class GenerationScheduler {
  constructor(sessionId, { maxConcurrent = 2, onEvent } = {}) {
    this.sessionId = sessionId;
    this.maxConcurrent = maxConcurrent;
    this.pending = [];
    this.activeCount = 0;
    this.hourlySpend = []; // [{ at, cost }] 滚动窗口
    this.onEvent = onEvent || (() => {});
  }

  emit(type, payload) {
    this.onEvent(type, payload);
  }

  /** 硬上限/软上限/暂停阈值检查；返回 null 表示可以生成，否则给出拒绝原因 */
  async budgetGate() {
    const session = await sessionStore.getSession(this.sessionId);
    if (!session) return 'session-not-found';

    const remaining = session.budgetLimit - session.budgetSpent;
    if (remaining < PAUSE_BALANCE_THRESHOLD) {
      this.emit('budget_alert', { reason: 'low-balance', remaining });
      return 'paused-low-balance';
    }
    if (session.budgetSpent >= session.budgetLimit || session.budgetSpent >= HARD_DAILY_LIMIT) {
      this.emit('budget_alert', { reason: 'hard-limit', spent: session.budgetSpent });
      return 'hard-limit-reached';
    }

    const now = Date.now();
    this.hourlySpend = this.hourlySpend.filter((e) => now - e.at < 60 * 60 * 1000);
    const spentThisHour = this.hourlySpend.reduce((sum, e) => sum + e.cost, 0);
    if (spentThisHour >= SOFT_HOURLY_LIMIT) {
      this.emit('budget_alert', { reason: 'soft-hourly-limit', spentThisHour });
      return 'soft-hourly-limit';
    }

    return null;
  }

  async recordSpend(cost) {
    this.hourlySpend.push({ at: Date.now(), cost });
    await sessionStore.addBudgetSpend(this.sessionId, cost);
  }

  /**
   * 提交一次生成任务。urgency: 'normal' | 'immediate'
   * promptOpts: composePrompt() 的入参（mbti/axes/mode/projectAnalysis/style）
   */
  async submit(promptOpts, { urgency = 'normal' } = {}) {
    const gate = await this.budgetGate();
    if (gate && urgency !== 'immediate') {
      return this.createFallbackTrack(promptOpts, { reason: gate });
    }

    if (urgency === 'immediate') {
      return this.startGeneration(promptOpts, { immediate: true });
    }

    if (this.activeCount >= this.maxConcurrent) {
      return new Promise((resolve, reject) => {
        this.pending.push({ promptOpts, resolve, reject });
      });
    }

    return this.startGeneration(promptOpts);
  }

  async createFallbackTrack(promptOpts, { reason = 'fallback' } = {}) {
    const composed = composePrompt(promptOpts);
    const fallback = await pickTrack(composed.mode, composed.mbti);
    if (!fallback?.url) {
      this.emit('music_ready', { track: null, error: 'No fallback track available', phase: composed.mode, reason });
      return null;
    }

    const ready = await trackPool.createTrack(this.sessionId, {
      phase: composed.mode,
      moodTag: fallback.title || `${composed.mbti}-${composed.mode}`,
      energyLevel: promptOpts.targetEnergy ?? 50,
      genre: composed.profile?.genre || 'Fallback',
      instruments: [],
      promptConfig: { ...composed, fallback: true, fallbackReason: reason, fallbackTrackId: fallback.id },
      audioUrl: fallback.url,
      audioLocal: fallback.url,
      durationSec: null,
    });
    this.emit('music_ready', { track: ready, fallback: true, phase: composed.mode, reason });
    return ready;
  }

  async withGeneratedLyrics(promptOpts) {
    if (!promptOpts.vocals?.enabled || promptOpts.vocals.lyrics) return promptOpts;

    const composed = composePrompt(promptOpts);
    try {
      const generated = await generateLyrics({
        mbtiType: composed.mbti,
        mode: composed.mode,
        projectAnalysis: promptOpts.projectAnalysis,
        notes: promptOpts.notes,
        language: promptOpts.vocals.language || 'zh',
      });
      if (!generated?.lyrics) return promptOpts;
      return {
        ...promptOpts,
        vocals: {
          ...promptOpts.vocals,
          lyrics: generated.lyrics,
          vocalStyle: generated.vocalStyle,
          vocalDesc: generated.vocalDesc,
          lyricsStructure: generated.structure,
        },
      };
    } catch (err) {
      console.warn('[arranger] lyrics generation skipped:', err.message);
      return promptOpts;
    }
  }

  async startGeneration(promptOpts) {
    this.activeCount += 1;
    const generationPromptOpts = isSunoConfigured() ? await this.withGeneratedLyrics(promptOpts) : promptOpts;
    const composed = composePrompt(generationPromptOpts);

    // 曲库池先插入一条"生成中"记录（audioUrl 为 null），供 pool-status 展示进度
    const track = await trackPool.createTrack(this.sessionId, {
      phase: composed.mode,
      moodTag: generationPromptOpts.style?.moodTag || composed.mode,
      energyLevel: generationPromptOpts.targetEnergy ?? 50,
      genre: composed.profile?.genres || 'Unknown',
      instruments: generationPromptOpts.instruments || [],
      promptConfig: composed,
    });

    try {
      if (!isSunoConfigured()) {
        throw new Error('TTAPI_KEY not configured');
      }

      const { taskId } = await submitGeneration({
        prompt: composed.fullPrompt,
        title: `${composed.mbti}-${composed.mode}`,
        tags: composed.layers?.mbti || '',
        weirdnessConstraint: composed.weirdnessConstraint,
        styleWeight: composed.styleWeight,
        instrumental: !generationPromptOpts.vocals?.enabled,
        lyrics: generationPromptOpts.vocals?.enabled && generationPromptOpts.vocals?.lyrics
          ? generationPromptOpts.vocals.lyrics
          : undefined,
        negativeTags: composed.negativeTags || '',
      });

      const result = await this.waitForCompletion(taskId);
      const audioLocal = await this.persistAudio(result.audioUrl, track.id);

      const ready = await trackPool.markTrackReady(track.id, {
        audioUrl: result.audioUrl,
        audioLocal,
        durationSec: result.music?.duration || null,
      });

      await this.recordSpend(COST_PER_TRACK);
      this.emit('music_ready', { track: ready });
      return ready;
    } catch (err) {
      console.error('[arranger] generation failed:', err.message);
      const fallback = await pickTrack(composed.mode, composed.mbti);
      if (fallback?.url) {
        const ready = await trackPool.markTrackReady(track.id, {
          audioUrl: fallback.url,
          audioLocal: fallback.url,
          durationSec: null,
        });
        this.emit('music_ready', { track: ready, fallback: true, error: err.message, phase: composed.mode });
        return ready;
      }
      this.emit('music_ready', { track: null, error: err.message, phase: composed.mode });
      return null;
    } finally {
      this.activeCount -= 1;
      this.processPending();
    }
  }

  async waitForCompletion(taskId) {
    const startedAt = Date.now();
    for (;;) {
      const result = await pollGeneration(taskId);
      if (result.status === 'completed') return result;
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        throw new Error('TTAPI generation timed out');
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  /** TTAPI CDN URL 会过期，24h 流必须落地到统一对象存储（§9.1） */
  async persistAudio(url, trackId) {
    const key = `arranger/${this.sessionId}/${trackId}-${randomUUID().slice(0, 8)}.mp3`;
    const res = await fetch(url);
    if (!res.ok || !res.body) {
      throw new Error(`Failed to download audio for storage: ${res.status}`);
    }
    return storage.upload(key, res.body, 'audio/mpeg');
  }

  processPending() {
    while (this.pending.length > 0 && this.activeCount < this.maxConcurrent) {
      const { promptOpts, resolve, reject } = this.pending.shift();
      this.startGeneration(promptOpts).then(resolve).catch(reject);
    }
  }
}

export { COST_PER_TRACK, HARD_DAILY_LIMIT, SOFT_HOURLY_LIMIT, PAUSE_BALANCE_THRESHOLD };
