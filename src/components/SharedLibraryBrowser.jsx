import { useEffect, useMemo, useRef, useState } from 'react';
import { getSharedLibrary, recordSharedTrackPlay, getSharedStats } from '../lib/api';
import { MODES } from '../lib/mbti';
import IconGlyph from './IconGlyph';
import TrackActions from './TrackActions';

export default function SharedLibraryBrowser({ onPlayTrack, onSelectTrack, user, onRequireAuth }) {
  const [mode, setMode] = useState('');
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);
  const debounceRef = useRef(null);
  const requestSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    getSharedStats()
      .then((data) => { if (!cancelled) setStats(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const params = useMemo(() => ({ mode: mode || undefined, q: query || undefined, limit: 24 }), [mode, query]);

  useEffect(() => {
    let cancelled = false;
    const requestSeq = ++requestSeqRef.current;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError('');
      getSharedLibrary(params)
        .then((data) => {
          if (!cancelled && requestSeq === requestSeqRef.current) setTracks(data.tracks || []);
        })
        .catch((err) => {
          if (!cancelled && requestSeq === requestSeqRef.current) setError(err.message || '曲库加载失败');
        })
        .finally(() => {
          if (!cancelled && requestSeq === requestSeqRef.current) setLoading(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(debounceRef.current);
    };
  }, [params]);

  const play = (track) => {
    if (track.id) recordSharedTrackPlay(track.id).catch(() => {});
    onPlayTrack?.({ audioUrl: track.audioUrl, title: track.title, trackId: track.id });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-sm font-bold text-white/80">共享曲库</h3>
          {stats && (
            <div className="text-[10px] text-white/35">
              共 {stats.total || 0} 首
              {stats.cached ? ` · 本地缓存 ${stats.cached} 首` : ''}
              {stats.byMode ? ` · ${Object.keys(stats.byMode).length} 种模式` : ''}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 justify-end gap-2">
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
          >
            <option value="">全部模式</option>
            {MODES.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题 / 标签"
            className="min-w-0 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
          />
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-300">{error}</div>}
      {loading ? (
        <div className="py-6 text-center text-sm text-white/30">曲库加载中...</div>
      ) : tracks.length === 0 ? (
        <div className="py-6 text-center text-sm text-white/30">暂无共享曲目</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {tracks.map((track) => (
            <div key={track.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white/85">{track.title}</div>
                  <div className="truncate text-[11px] text-white/40">
                    {[track.mbti, track.mode, track.genre].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[10px] text-white/30">
                  <IconGlyph name="play" className="h-3 w-3" />
                  {track.playCount || 0}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!track.audioUrl}
                    onClick={() => play(track)}
                    className="rounded-lg bg-green-500/15 px-3 py-1.5 text-xs text-green-300 disabled:opacity-40"
                  >
                    播放
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTrack?.(track)}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 hover:text-white"
                  >
                    加入歌单
                  </button>
                </div>
                <TrackActions trackId={track.id} user={user} onRequireAuth={onRequireAuth} compact />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
