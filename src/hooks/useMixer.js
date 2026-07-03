import { useCallback, useEffect, useRef, useState } from 'react';
import { MixerEngine } from '../audio/mixerEngine';

export function proxiedUrl(url) {
  if (!url) return url;
  if (url.startsWith('/') || url.startsWith('blob:') || url.startsWith('data:')) return url;
  try {
    const parsed = new URL(url);
    if (parsed.origin === window.location.origin) return url;
  } catch {
    return url;
  }
  return `/api/music/proxy?url=${encodeURIComponent(url)}`;
}

function validTracks(items = []) {
  return items
    .filter((item) => item?.url)
    .map((item, index) => ({
      name: item.name || item.title || `Track ${index + 1}`,
      url: item.url,
      type: item.type || 'stem',
    }));
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

  useEffect(() => {
    let raf;
    const tick = () => {
      const nextTime = engine.currentTime();
      const region = loopRef.current;
      if (engine.playing && region && nextTime >= region.end) {
        engine.seek(region.start);
        setTime(region.start);
      } else {
        setTime(nextTime);
        if (engine.playing && engine.duration() > 0 && nextTime >= engine.duration()) {
          engine.stop();
          setPlaying(false);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  const clear = useCallback(() => {
    engine.clear();
    setPlaying(false);
    setTime(0);
    loopRef.current = null;
    setLoopState(null);
    sync();
  }, [engine, sync]);

  const addTracks = useCallback(
    async (items, { replace = false } = {}) => {
      const nextTracks = validTracks(items);
      if (nextTracks.length === 0) return;
      setLoading(true);
      setError('');
      try {
        if (replace) {
          engine.clear();
          setPlaying(false);
          setTime(0);
          loopRef.current = null;
          setLoopState(null);
        }
        const existing = new Set(
          engine.listTracks().flatMap((track) => [track.url, track.sourceUrl].filter(Boolean))
        );
        for (const track of nextTracks) {
          const fetchUrl = proxiedUrl(track.url);
          if (existing.has(track.url) || existing.has(fetchUrl)) continue;
          await engine.addTrack({
            name: track.name,
            url: fetchUrl,
            sourceUrl: track.url,
            type: track.type,
          });
          existing.add(track.url);
          existing.add(fetchUrl);
        }
        sync();
      } catch (err) {
        console.error('[mixer] addTracks', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [engine, sync]
  );

  const addTrack = useCallback((track) => addTracks([track]), [addTracks]);

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
    (nextTime) => {
      engine.seek(nextTime);
      setTime(nextTime);
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
        prev.map((track) =>
          track.id === id
            ? { ...track, state: { ...track.state, ...patch, eq: { ...track.state.eq, ...(patch.eq || {}) } } }
            : track
        )
      );
    },
    [engine]
  );

  const updateMaster = useCallback(
    (patch) => {
      if ('volume' in patch) engine.setMasterVolume(patch.volume);
      if ('limiter' in patch) engine.setMasterLimiter(patch.limiter);
      setMaster((prev) => ({ ...prev, ...patch }));
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
        for (const track of snapshot.tracks || []) {
          const url = track.url;
          const info = await engine.addTrack({
            name: track.name,
            url: proxiedUrl(url),
            sourceUrl: url,
            type: track.type,
          });
          engine.applyTrackState(info.id, track.state || {});
        }
        engine.setMasterVolume(snapshot.master?.volume ?? 0.85);
        engine.setMasterLimiter(snapshot.master?.limiter ?? true);
        setMaster({ volume: snapshot.master?.volume ?? 0.85, limiter: snapshot.master?.limiter ?? true });
        sync();
      } catch (err) {
        setError(`Snapshot restore failed: ${err.message}`);
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
    addTracks,
    clear,
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
