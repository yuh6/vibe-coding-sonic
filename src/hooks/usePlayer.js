import { useCallback, useEffect, useRef, useState } from 'react';
import { Howl } from 'howler';
import { getMusicStatus } from '../lib/api';

const FADE_MS = 2000;
const POLL_MS = 3000;

export function useMusicPoll() {
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState('idle');
  const [audioUrl, setAudioUrl] = useState(null);
  const [meta, setMeta] = useState(null);
  const pollRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(
    (id) => {
      stopPolling();
      setJobId(id);
      setStatus('processing');
      setAudioUrl(null);
      setMeta(null);

      const poll = async () => {
        try {
          const data = await getMusicStatus(id);
          setMeta(data);
          if (data.audioUrl) {
            setAudioUrl((prev) => (prev === data.audioUrl ? prev : data.audioUrl));
          }
          if (data.status) {
            setStatus(data.status);
          }
          if (data.status === 'completed') {
            stopPolling();
          } else if (data.status === 'failed') {
            setStatus('failed');
            stopPolling();
          }
        } catch (err) {
          console.error('[poll]', err);
        }
      };

      poll();
      pollRef.current = setInterval(poll, POLL_MS);
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

  const unload = useCallback(() => {
    if (howlRef.current) {
      howlRef.current.unload();
      howlRef.current = null;
    }
    currentUrlRef.current = null;
    setPlaying(false);
    setCurrentTitle('');
  }, []);

  const playUrl = useCallback(
    (url, { title = '', loop = true, fadeIn = true } = {}) => {
      if (!url) return;

      if (howlRef.current && currentUrlRef.current === url) {
        if (title) setCurrentTitle(title);
        if (!howlRef.current.playing()) howlRef.current.play();
        return;
      }

      const startNew = () => {
        const howl = new Howl({
          src: [url],
          html5: true,
          loop,
          volume: fadeIn ? 0 : volume,
          onplay: () => setPlaying(true),
          onpause: () => setPlaying(false),
          onstop: () => setPlaying(false),
          onend: () => setPlaying(false),
          onloaderror: (_id, err) => console.error('[howler] load error', err),
          onplayerror: (_id, err) => console.error('[howler] play error', err),
        });

        howlRef.current = howl;
        currentUrlRef.current = url;
        setCurrentTitle(title);
        howl.play();
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
    [volume, muted]
  );

  const togglePlay = useCallback(() => {
    const howl = howlRef.current;
    if (!howl) return;
    if (howl.playing()) {
      howl.pause();
    } else {
      howl.play();
    }
  }, []);

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
    currentTitle,
    playUrl,
    togglePlay,
    setVolume,
    toggleMute,
    unload,
  };
}
