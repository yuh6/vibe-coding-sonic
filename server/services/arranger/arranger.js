/**
 * 编排引擎核心 (Arranger) — docs/ai-music-engine-design.md §8.6 单曲决策 + §8.8 情绪起伏/防疲劳
 * 每首播完后决定下一首播什么：从曲库池 (trackPool.js) 中按规则选取，
 * 目标阶段/能量由感知层 (sensingLayer.js) 给出。
 */
import * as trackPool from './trackPool.js';

const RECENTLY_PLAYED_WINDOW = 4; // 近 4 首不重复同一曲目
const SAME_GENRE_STREAK_LIMIT = 3; // 连续 3 首不重复同一主风格
const SAME_INSTRUMENTS_STREAK_LIMIT = 5; // 连续 5 首不重复同一乐器组合
const REPEAT_GAP = 4; // 同一首歌间隔 ≥4 首再重复播放
const FORCE_SWITCH_AFTER = 4; // 同阶段连续 >4 首 → 强制风格切换（§8.8）

function jaccardSimilarity(a = [], b = []) {
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const item of setA) if (setB.has(item)) intersection += 1;
  const union = new Set([...setA, ...setB]).size || 1;
  return intersection / union;
}

export class Arranger {
  constructor(sessionId, sensing) {
    this.sessionId = sessionId;
    this.sensing = sensing;
  }

  /** 最近 N 首播放历史（含 genre/instruments），最近的在前 */
  history(limit = 10) {
    return trackPool.recentHistory(this.sessionId, limit);
  }

  recentlyPlayed(trackId, windowSize = RECENTLY_PLAYED_WINDOW) {
    return this.history(windowSize).some((h) => h.trackPoolId === trackId);
  }

  /** 防重复过滤：同一首歌需间隔 ≥4 首才能再播 */
  applyAntiRepeat(candidates) {
    const recent = this.history(REPEAT_GAP);
    const recentIds = new Set(recent.map((h) => h.trackPoolId));
    return candidates.filter((t) => !recentIds.has(t.id));
  }

  /** §8.8 防疲劳：同阶段连续 >4 首 / 同流派连续 >2 首 → 需要强制切换标记 */
  needsForcedVariety() {
    const recent = this.history(FORCE_SWITCH_AFTER);
    if (recent.length < FORCE_SWITCH_AFTER) return { phase: false, genre: false };
    const samePhaseStreak = recent.every((h) => h.phase === recent[0].phase);
    const genreStreak = this.history(2);
    const sameGenreStreak = genreStreak.length >= 2 && genreStreak[0].genre === genreStreak[1].genre;
    return { phase: samePhaseStreak, genre: sameGenreStreak };
  }

  /** 核心决策：下一首播什么 */
  decideNext() {
    const targetPhase = this.sensing.getCurrentPhase();
    const targetEnergy = this.sensing.getTargetEnergy();

    // 1. 从曲库池筛选候选：阶段匹配 + 能量接近 + 近4首没播过
    let candidates = trackPool
      .listReadyTracks(this.sessionId, targetPhase)
      .filter((t) => Math.abs(t.energyLevel - targetEnergy) < 20 && !this.recentlyPlayed(t.id));

    // 2. 防重复过滤
    candidates = this.applyAntiRepeat(candidates);

    // 3. 候选为空 → 放宽条件（近2首没播过即可）
    if (candidates.length === 0) {
      candidates = trackPool
        .listReadyTracks(this.sessionId, targetPhase)
        .filter((t) => !this.recentlyPlayed(t.id, 2));
    }

    // 4. 仍为空 → 循环本阶段任意已就绪曲目
    if (candidates.length === 0) {
      candidates = trackPool.listReadyTracks(this.sessionId, targetPhase);
    }

    if (candidates.length === 0) {
      return { track: null, targetPhase, targetEnergy, poolExhausted: true };
    }

    const track = this.scoreAndPick(candidates, targetEnergy);
    return { track, targetPhase, targetEnergy, poolExhausted: false };
  }

  /** 打分：能量匹配度 50% + 新鲜度 30% + 变化奖励 20% */
  scoreAndPick(candidates, targetEnergy) {
    return candidates
      .map((track) => ({
        track,
        score:
          (1 - Math.abs(track.energyLevel - targetEnergy) / 100) * 0.5 +
          (1 - Math.min(track.playCount, 10) / 10) * 0.3 +
          this.varietyBonus(track) * 0.2,
      }))
      .sort((a, b) => b.score - a.score)[0]?.track;
  }

  /** 变化奖励：和上一首风格差异越大分越高 */
  varietyBonus(track) {
    const last = this.history(1)[0];
    if (!last) return 1;
    const genreDiff = track.genre !== last.genre ? 1 : 0;
    const instrumentDiff = 1 - jaccardSimilarity(track.instruments, last.instruments);
    return (genreDiff + instrumentDiff) / 2;
  }
}
