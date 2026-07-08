/**
 * Arranger generation adapter.
 *
 * The actual TTAPI submit/poll/persist/fallback flow lives in
 * GenerationPipeline. This class preserves the existing Arranger interface:
 * submit(), createFallbackTrack(), budgetGate(), and event callbacks.
 */
import {
  COST_PER_TRACK,
  HARD_DAILY_LIMIT,
  SOFT_HOURLY_LIMIT,
  PAUSE_BALANCE_THRESHOLD,
  generationPipeline,
} from '../generationPipeline.js';
import * as sessionStore from './sessionStore.js';

export class GenerationScheduler {
  constructor(sessionId, { maxConcurrent = 2, onEvent } = {}) {
    this.sessionId = sessionId;
    this.maxConcurrent = maxConcurrent;
    this.pending = [];
    this.activeCount = 0;
    this.hourlySpend = [];
    this.onEvent = onEvent || (() => {});
  }

  emit(type, payload) {
    this.onEvent(type, payload);
  }

  async budgetGate() {
    const now = Date.now();
    this.hourlySpend = this.hourlySpend.filter((entry) => now - entry.at < 60 * 60 * 1000);
    return generationPipeline.budgetGate(this.sessionId, this.hourlySpend, (type, payload) => {
      this.emit(type, payload);
    });
  }

  async recordSpend(cost) {
    this.hourlySpend.push({ at: Date.now(), cost });
    await sessionStore.addBudgetSpend(this.sessionId, cost);
  }

  async createFallbackTrack(promptOpts, { reason = 'fallback' } = {}) {
    return generationPipeline.createArrangerFallback(this.sessionId, promptOpts, {
      reason,
      emit: (type, payload) => this.emit(type, payload),
    });
  }

  async submit(promptOpts, { urgency = 'normal' } = {}) {
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

  async startGeneration(promptOpts, { immediate = false } = {}) {
    this.activeCount += 1;
    try {
      return await generationPipeline.generateArrangerTrack(this.sessionId, promptOpts, {
        immediate,
        hourlySpend: this.hourlySpend,
        emit: (type, payload) => this.emit(type, payload),
        recordSpend: (cost) => this.recordSpend(cost),
      });
    } finally {
      this.activeCount -= 1;
      this.processPending();
    }
  }

  processPending() {
    while (this.pending.length > 0 && this.activeCount < this.maxConcurrent) {
      const { promptOpts, resolve, reject } = this.pending.shift();
      this.startGeneration(promptOpts).then(resolve).catch(reject);
    }
  }
}

export { COST_PER_TRACK, HARD_DAILY_LIMIT, SOFT_HOURLY_LIMIT, PAUSE_BALANCE_THRESHOLD };
