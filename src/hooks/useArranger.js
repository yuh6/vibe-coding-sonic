import { useCallback, useEffect, useRef, useState } from 'react';
import { MixerEngine } from '../audio/mixerEngine';
import { CrossfadeDeck } from '../audio/crossfadeDeck';
import { proxiedUrl } from './useMixer';
import {
  createArrangerSession,
  updateArrangerGenerationParams,
  startArranger,
  advanceArranger,
  stopArranger,
  setArrangerPhase,
  sendArrangerFeedback,
  getArrangerHistory,
  getArrangerPoolStatus,
  getArrangerEnergyCurve,
} from '../lib/api';

// §9.3 触发时机：85% 预加载下一首，95% 触发交叉淡入；无下一首时每 10 秒重查缓冲池
const PRELOAD_AT = 0.85;
const TRANSITION_AT = 0.95;
const NO_NEXT_RECHECK_MS = 10_000;
const TICK_MS = 250;
const WS_RECONNECT_BASE_MS = 1_000;
const WS_RECONNECT_MAX_MS = 15_000;

function wsUrl(sessionId) {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/events?sessionId=${encodeURIComponent(sessionId)}`;
}

/**
 * 编排引擎前端 Hook — 把 §8 编排决策 (REST) 与 §9.3 交叉淡入 (Web Audio) 粘合起来。
 * 服务端只决定「下一首放哪首」，实际的解码/淡入淡出/进度追踪全部在浏览器完成。
 */
export function useArranger() {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new MixerEngine();
  const deckRef = useRef(null);
  if (!deckRef.current) deckRef.current = new CrossfadeDeck(engineRef.current);

  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState('IDLE');
  const [phase, setPhase] = useState(null);
  const [nowPlayingTrack, setNowPlayingTrack] = useState(null);
  const [poolStatus, setPoolStatus] = useState(null);
  const [energyCurve, setEnergyCurve] = useState(null);
  const [history, setHistory] = useState([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const wsRef = useRef(null);
  const preloadingRef = useRef(false);
  const advancingRef = useRef(false);
  const lastRecheckRef = useRef(0);
  const sessionIdRef = useRef(null);
  const stateRef = useRef(state);
  const playbackEnabledRef = useRef(true);
  const startPromiseRef = useRef(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const refreshPoolStatus = useCallback((sid) => {
    if (!sid) return;
    getArrangerPoolStatus(sid).then(setPoolStatus).catch(() => {});
  }, []);

  const refreshHistory = useCallback((sid) => {
    if (!sid) return;
    getArrangerHistory(sid, 20)
      .then((data) => setHistory(data.history || []))
      .catch(() => {});
  }, []);

  const applyTrack = useCallback((track) => {
    setNowPlayingTrack(track || null);
  }, []);

  /** 决策引擎给出新曲目后：还没有 current → 直接播；已有 current → 只 preload，等 95% 再切 */
  const handleDecision = useCallback(async (decision, { playback = playbackEnabledRef.current, runId = null } = {}) => {
    if (!decision?.track) return;
    const shouldStart = () => runId == null || runIdRef.current === runId;
    if (!shouldStart()) return;
    if (!playback) {
      applyTrack(decision.track);
      return;
    }
    const url = proxiedUrl(decision.track.audioLocal || decision.track.audioUrl);
    if (!deckRef.current.current) {
      applyTrack(decision.track);
      await deckRef.current.playFirst(url, decision.track, { shouldStart });
    } else {
      // preload 完成不等于切歌：track 元数据随 next 一起存，等 95% transition() 触发后再展示
      await deckRef.current.preload(url, decision.track, { shouldStart });
    }
  }, [applyTrack]);

  // 进度轮询：驱动 85%/95% 触发点
  useEffect(() => {
    const timer = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid || state !== 'PLAYING') return;
      const deck = deckRef.current;
      if (!deck.current) return;

      const dur = deck.currentDurationSec();
      if (!dur) return;
      const progress = deck.currentProgressSec() / dur;

      // 85% → 若还没有预取到下一首，向服务端请求一次（决策 + 记录播放历史）
      if (progress >= PRELOAD_AT && !deck.next && !preloadingRef.current) {
        preloadingRef.current = true;
        try {
          const result = await advanceArranger(sid);
          if (result?.decision) await handleDecision(result.decision);
        } catch (err) {
          console.error('[arranger] advance', err);
        } finally {
          preloadingRef.current = false;
        }
      }

      // 95% → 已 preload 好 next 则触发交叉淡入；否则 loop 当前曲目，每 10 秒重试
      if (progress >= TRANSITION_AT) {
        if (deck.next) {
          if (!advancingRef.current) {
            advancingRef.current = true;
            const pendingTrack = deck.next.track || null;
            deck.transition();
            if (pendingTrack) applyTrack(pendingTrack);
            refreshPoolStatus(sid);
            refreshHistory(sid);
            setTimeout(() => {
              advancingRef.current = false;
            }, 500);
          }
        } else if (Date.now() - lastRecheckRef.current > NO_NEXT_RECHECK_MS) {
          lastRecheckRef.current = Date.now();
          deck.loopCurrent();
        }
      }
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [state, handleDecision, refreshPoolStatus, refreshHistory, applyTrack]);

  // WebSocket：接收 track_changed / phase_changed / pool_refill 等事件（多设备同步展示用，
  // 实际 preload/transition 时机仍由本地播放进度驱动，见上方轮询）
  useEffect(() => {
    if (!sessionId) return undefined;
    let stopped = false;
    let reconnectAttempt = 0;
    let reconnectTimer = null;
    let ws = null;

    const connect = () => {
      if (stopped) return;
      ws = new WebSocket(wsUrl(sessionId));
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt = 0;
        refreshPoolStatus(sessionId);
        refreshHistory(sessionId);
      };

      ws.onmessage = (evt) => {
        let msg;
        try {
          msg = JSON.parse(evt.data);
        } catch {
          return;
        }
        const { type, payload } = msg;
        if (type === 'track_changed' && payload?.track) {
          if (!deckRef.current.current) {
            handleDecision({ track: payload.track }, { playback: playbackEnabledRef.current });
          }
        } else if (type === 'phase_changed') {
          if (payload?.phase) setPhase(payload.phase);
          if (payload?.state) setState(payload.state);
        } else if (type === 'pool_refill') {
          refreshPoolStatus(sessionId);
        } else if (type === 'generation_status' || type === 'music_ready') {
          refreshPoolStatus(sessionId);
        } else if (type === 'user_feedback') {
          // 反馈影响能量曲线，刷新一下展示
          getArrangerEnergyCurve().then((data) => setEnergyCurve(data.curve)).catch(() => {});
        }
      };

      ws.onerror = () => {
        ws?.close();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        if (stopped) return;
        const delay = Math.min(WS_RECONNECT_BASE_MS * 2 ** reconnectAttempt, WS_RECONNECT_MAX_MS);
        reconnectAttempt += 1;
        reconnectTimer = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      ws?.close();
      wsRef.current = null;
    };
  }, [sessionId, handleDecision, refreshPoolStatus, refreshHistory]);

  const start = useCallback(
    async ({ name, mbtiType, mbtiSliders, schedule, budgetLimit, generationParams, playback = true } = {}) => {
      if (startPromiseRef.current) return startPromiseRef.current;
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      playbackEnabledRef.current = playback;
      setStarting(true);
      setError('');
      startPromiseRef.current = (async () => {
        let sid = sessionIdRef.current;
        if (!sid) {
          const created = await createArrangerSession({
            name,
            mbtiType,
            mbtiSliders,
            schedule,
            budgetLimit,
            generationParams,
          });
          sid = created.id || created.sessionId;
          setSessionId(sid);
          sessionIdRef.current = sid;
          if (runIdRef.current !== runId) return sid;
        } else if (generationParams) {
          await updateArrangerGenerationParams(sid, generationParams);
          if (runIdRef.current !== runId) return sid;
        }

        if (stateRef.current !== 'IDLE') {
          refreshPoolStatus(sid);
          refreshHistory(sid);
          if (playback && runIdRef.current === runId && !deckRef.current.current) {
            const result = await advanceArranger(sid);
            if (runIdRef.current === runId && result?.decision) {
              await handleDecision(result.decision, { playback: true, runId });
            }
          }
          return sid;
        }

        const result = await startArranger(sid);
        if (runIdRef.current !== runId) {
          stopArranger(sid).catch((err) => {
            console.error('[arranger] stop after cancelled start', err);
          });
          return sid;
        }
        setState('PLAYING');
        stateRef.current = 'PLAYING';
        if (result?.decision) await handleDecision(result.decision, { playback, runId });
        refreshPoolStatus(sid);
        refreshHistory(sid);
        getArrangerEnergyCurve().then((data) => setEnergyCurve(data.curve)).catch(() => {});
        return sid;
      })();
      try {
        return await startPromiseRef.current;
      } catch (err) {
        console.error('[arranger] start', err);
        setError(err.message);
        throw err;
      } finally {
        startPromiseRef.current = null;
        setStarting(false);
      }
    },
    [handleDecision, refreshPoolStatus, refreshHistory]
  );

  const syncGenerationParams = useCallback(async (generationParams) => {
    const sid = sessionIdRef.current;
    if (!sid) return null;
    return updateArrangerGenerationParams(sid, generationParams);
  }, []);

  const stop = useCallback(async () => {
    runIdRef.current += 1;
    playbackEnabledRef.current = false;
    deckRef.current.stop();
    setState('IDLE');
    stateRef.current = 'IDLE';
    applyTrack(null);

    const sid = sessionIdRef.current;
    if (!sid) return;
    try {
      await stopArranger(sid);
    } catch (err) {
      console.error('[arranger] stop', err);
    }
  }, [applyTrack]);

  const changePhase = useCallback(
    async (nextPhase) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const result = await setArrangerPhase(sid, nextPhase);
        setPhase(nextPhase);
        if (result?.decision) await handleDecision(result.decision);
      } catch (err) {
        console.error('[arranger] phase', err);
        setError(err.message);
      }
    },
    [handleDecision]
  );

  const feedback = useCallback(
    async (action) => {
      const sid = sessionIdRef.current;
      if (!sid) return;
      try {
        const result = await sendArrangerFeedback(sid, action);
        if (action === 'skip' && result?.track) {
          await handleDecision({ track: result.track });
        }
        return result;
      } catch (err) {
        console.error('[arranger] feedback', err);
        setError(err.message);
      }
    },
    [handleDecision]
  );

  useEffect(() => () => deckRef.current.stop(), []);

  return {
    sessionId,
    state,
    phase,
    nowPlayingTrack,
    poolStatus,
    energyCurve,
    history,
    starting,
    error,
    engine: engineRef.current,
    start,
    stop,
    changePhase,
    feedback,
    syncGenerationParams,
  };
}
