import { useCallback, useEffect, useRef, useState } from 'react';
import { Howl, Howler } from 'howler';
import { getMusicStatus } from '../lib/api';

const FADE_MS = 2000;
const POLL_MS = 3000;

export function useMusicPoll() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [audioUrl, setAudioUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const pollRef = useRef(null);
  const streamRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (id, { streamUrl = `/api/music/stream/${id}` } = {}) => {
      stopPolling();
      setJobId(id);
      setStatus('processing');
      setAudioUrl(null);
      setMeta(null);

      const isTerminalStemStatus = (stemStatus) => (
        stemStatus === 'skipped' ||
        stemStatus === 'completed' ||
        stemStatus === 'completed-empty' ||
        stemStatus === 'failed'
      );

      const shouldStopForStatus = (data) => {
        if (data.status === 'failed') return true;
        if (data.status !== 'completed') return false;
        return !data.splitStems || isTerminalStemStatus(data.stemStatus);
      };

      const applyStatus = (data) => {
        setMeta((prev) => ({ ...(prev || {}), ...data }));
        if (data.audioUrl) {
          setAudioUrl((prev) => (prev === data.audioUrl ? prev : data.audioUrl));
        }
        if (data.status) setStatus(data.status);
        if (shouldStopForStatus(data)) {
          stopPolling();
        }
      };

      const poll = async () => {
        try {
          const data = await getMusicStatus(id);
          applyStatus(data);
        } catch (err) {
          console.error('[poll]', err);
        }
      };

      const startFallbackPoll = () => {
        if (pollRef.current) return;
        poll();
        pollRef.current = setInterval(poll, POLL_MS);
      };

      if (typeof EventSource === 'undefined') {
        startFallbackPoll();
        return;
      }

      const stream = new EventSource(streamUrl);
      streamRef.current = stream;

      const handleEvent = (event) => {
        try {
          applyStatus(JSON.parse(event.data));
        } catch (err) {
          console.error('[music stream]', err);
        }
      };

      stream.addEventListener('generation:status', handleEvent);
      stream.addEventListener('generation:progress', handleEvent);
      stream.addEventListener('generation:completed', handleEvent);
      stream.addEventListener('generation:failed', handleEvent);
      stream.addEventListener('stem:status', handleEvent);
      stream.addEventListener('stem:completed', handleEvent);
      stream.addEventListener('stem:failed', handleEvent);
      stream.onerror = () => {
        stream.close();
        if (streamRef.current === stream) streamRef.current = null;
        startFallbackPoll();
      };
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { jobId, status, audioUrl, meta, startPolling, stopPolling, setStatus };
}

export function usePlayer() {
  const howlRef = useRef(null);
  const currentUrlRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.7);
  const [muted, setMuted] = useState(false);
  const [currentTitle, setCurrentTitle] = useState('');
  const [playbackError, setPlaybackError] = useState('');
  const [hasAudio, setHasAudio] = useState(false);

  const unload = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    currentUrlRef.current = null;
    setHasAudio(false);
    setPlaying(false);
    setCurrentTitle('');
    setPlaybackError('');
  }, []);

  const resumeAudioContext = useCallback(() => {
    const ctx = Howler.ctx;
    if (ctx?.state === 'suspended') {
      ctx.resume().catch((err) => {
        console.warn('[howler] audio context resume failed', err);
      });
    }
  }, []);

  const requestPlay = useCallback((howl) => {
    if (!howl) return;
    setPlaybackError('');
    resumeAudioContext();
    howl.play();
  }, [resumeAudioContext]);

  const playUrl = useCallback(
    (url, { title = '', loop = true, fadeIn = true } = {}) => {
      if (!url) return;

      if (howlRef.current && currentUrlRef.current === url) {
        if (title) setCurrentTitle(title);
        setHasAudio(true);
        if (!howlRef.current.playing()) requestPlay(howlRef.current);
        return;
      }

      const startNew = () => {
        const howl = new Howl({
          src: [url],
          html5: true,
          loop,
          volume: fadeIn ? 0 : volume,
          onplay: () => {
            setPlaybackError('');
            setPlaying(true);
          },
          onpause: () => setPlaying(false),
          onstop: () => setPlaying(false),
          onend: () => setPlaying(false),
          onloaderror: (_id, err) => console.error('[howler] load error', err),
          onplayerror: (_id, err) => {
            console.error('[howler] play error', err);
            setPlaying(false);
            setPlaybackError('移动浏览器拦截了自动播放，请再点一次播放');
            howl.once('unlock', () => requestPlay(howl));
          },
        });

        howlRef.current = howl;
        currentUrlRef.current = url;
        setHasAudio(true);
        setCurrentTitle(title);
        requestPlay(howl);
        if (fadeIn) {
          howl.fade(0, muted ? 0 : volume, FADE_MS);
        }
        return howl;
      };

      if (howlRef.current) {
        const prev = howlRef.current;
        prev.fade(prev.volume(), 0, FADE_MS);
        prev.once('fade', () => {
          // 只有当 prev 不再是当前播放实例时才卸载
          if (howlRef.current !== prev) prev.unload();
        });
        startNew();
      } else {
        startNew();
      }
    },
    [volume, muted, requestPlay]
  );

  const togglePlay = useCallback(() => {
    const howl = howlRef.current;
    if (!howl) return;
    if (howl.playing()) {
      howl.pause();
    } else {
      requestPlay(howl);
    }
  }, [requestPlay]);

  const setVolume = useCallback(
    (v) => {
      setVolumeState(v);
      if (howlRef.current && !muted) {
        howlRef.current.volume(v);
      }
    },
    [muted]
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      if (howlRef.current) {
        howlRef.current.volume(next ? 0 : volume);
      }
      return next;
    });
  }, [volume]);

  useEffect(() => () => unload(), [unload]);

  return {
    playing,
    volume,
    muted,
    hasAudio,
    currentTitle,
    playbackError,
    playUrl,
    togglePlay,
    setVolume,
    toggleMute,
    unload,
  };
}
