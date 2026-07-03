import { useCallback, useEffect, useRef, useState } from 'react';
import { MixerEngine } from '../audio/mixerEngine';

export function proxiedUrl(url) {
  if (!url) return url;
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const u = new URL(url);
    if (u.origin === window.location.origin) return url;
  } catch {
    return url;
  }
  return `/api/music/proxy?url=${encodeURIComponent(url)}`;
}

export function useMixer() {
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new MixerEngine();
  const engine = engineRef.current;

  const [tracks, setTracks] = useState([]);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [master, setMaster] = useState({ volume: 0.85, limiter: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loopRef = useRef(null);
  const [loop, setLoopState] = useState(null);

  const sync = useCallback(() => {
    setTracks(engine.listTracks());
    setDuration(engine.duration());
  }, [engine]);

  // 播放头 + 循环选区驱动
  useEffect(() => {
    let raf;
    const tick = () => {
      const t = engine.currentTime();
      const region = loopRef.current;
      if (engine.playing && region && t >= region.end) {
        engine.seek(region.start);
        setTime(region.start);
      } else {
        setTime(t);
        if (engine.playing && engine.duration() > 0 && t >= engine.duration()) {
          engine.stop();
          setPlaying(false);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const addTrack = useCallback(
    async ({ name, url }) => {
      setLoading(true);
      setError('');
      try {
        await engine.addTrack({ name, url: proxiedUrl(url) });
        sync();
      } catch (err) {
        console.error('[mixer] addTrack', err);
        setError(`「${name}」加载失败：${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [engine, sync]
  );

  const removeTrack = useCallback(
    (id) => {
      engine.removeTrack(id);
      sync();
    },
    [engine, sync]
  );

  const play = useCallback(async () => {
    await engine.play();
    setPlaying(true);
  }, [engine]);

  const pause = useCallback(() => {
    engine.pause();
    setPlaying(false);
  }, [engine]);

  const stop = useCallback(() => {
    engine.stop();
    setPlaying(false);
    setTime(0);
  }, [engine]);

  const seek = useCallback(
    (t) => {
      engine.seek(t);
      setTime(t);
    },
    [engine]
  );

  const setLoop = useCallback((region) => {
    loopRef.current = region;
    setLoopState(region);
  }, []);

  const updateTrack = useCallback(
    (id, patch) => {
      if ('volume' in patch) engine.setVolume(id, patch.volume);
      if ('pan' in patch) engine.setPan(id, patch.pan);
      if ('muted' in patch) engine.setMuted(id, patch.muted);
      if ('solo' in patch) engine.setSolo(id, patch.solo);
      if ('compressor' in patch) engine.setCompressor(id, patch.compressor);
      if (patch.eq) {
        for (const [band, db] of Object.entries(patch.eq)) engine.setEq(id, band, db);
      }
      setTracks((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, state: { ...t.state, ...patch, eq: { ...t.state.eq, ...(patch.eq || {}) } } }
            : t
        )
      );
    },
    [engine]
  );

  const updateMaster = useCallback(
    (patch) => {
      if ('volume' in patch) engine.setMasterVolume(patch.volume);
      if ('limiter' in patch) engine.setMasterLimiter(patch.limiter);
      setMaster((m) => ({ ...m, ...patch }));
    },
    [engine]
  );

  const getMixState = useCallback(() => engine.getMixState(), [engine]);

  const applySnapshot = useCallback(
    async (snapshot) => {
      setLoading(true);
      setError('');
      try {
        engine.clear();
        setPlaying(false);
        setTime(0);
        for (const t of snapshot.tracks) {
          const info = await engine.addTrack({ name: t.name, url: t.url });
          engine.applyTrackState(info.id, t.state);
        }
        engine.setMasterVolume(snapshot.master.volume);
        engine.setMasterLimiter(snapshot.master.limiter);
        setMaster({ ...snapshot.master });
        sync();
      } catch (err) {
        setError(`快照恢复失败：${err.message}`);
      } finally {
        setLoading(false);
      }
    },
    [engine, sync]
  );

  useEffect(() => () => engine.clear(), [engine]);

  return {
    engine,
    tracks,
    playing,
    time,
    duration,
    master,
    loading,
    error,
    loop,
    addTrack,
    removeTrack,
    play,
    pause,
    stop,
    seek,
    setLoop,
    updateTrack,
    updateMaster,
    getMixState,
    applySnapshot,
  };
}
