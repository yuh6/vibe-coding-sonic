import { useEffect, useState } from 'react';
import { addToPlaylist, createPlaylist, getMyPlaylists } from '../lib/api';

export default function PlaylistManager({ selectedTrack, onRequireAuth, onAdded }) {
  const [playlists, setPlaylists] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    getMyPlaylists()
      .then((data) => setPlaylists(data.playlists || []))
      .catch((err) => {
        if (err.status === 401) {
          setPlaylists([]);
          return;
        }
        setError(err.message || '我的歌单加载失败');
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const create = async () => {
    const safeTitle = title.trim();
    if (!safeTitle) return;
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await createPlaylist({ title: safeTitle, description: description.trim() });
      setTitle('');
      setDescription('');
      setMessage('播放列表已创建');
      load();
    } catch (err) {
      if (err.status === 401) {
        onRequireAuth?.('登录后可以创建播放列表');
        return;
      }
      setError(err.message || '创建播放列表失败');
    } finally {
      setLoading(false);
    }
  };

  const add = async (playlistId) => {
    if (!selectedTrack?.id) {
      setMessage('先从共享曲库选择一首歌');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await addToPlaylist(playlistId, selectedTrack.id);
      setMessage(`已加入: ${selectedTrack.title}`);
      onAdded?.();
      load();
    } catch (err) {
      if (err.status === 401) {
        onRequireAuth?.('登录后可以管理播放列表');
        return;
      }
      setError(err.message || '添加到播放列表失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-display text-sm font-bold text-white/80">我的播放列表</h3>
        {selectedTrack && <span className="truncate text-[11px] text-indigo-300">已选: {selectedTrack.title}</span>}
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="新歌单标题"
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="描述"
          className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs text-white/70"
        />
        <button
          type="button"
          disabled={loading || !title.trim()}
          onClick={create}
          className="rounded-lg bg-indigo-500/20 px-3 py-1.5 text-xs text-indigo-200 disabled:opacity-40"
        >
          创建
        </button>
      </div>

      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}
      {message && <div className="mt-2 text-xs text-green-300">{message}</div>}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {playlists.map((playlist) => (
          <div key={playlist.id} className="flex items-center gap-2 rounded-lg bg-black/20 p-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white/80">{playlist.title}</div>
              <div className="text-[10px] text-white/35">{playlist.trackCount || 0} 首 · 播放 {playlist.playCount || 0}</div>
            </div>
            <button
              type="button"
              disabled={loading || !selectedTrack?.id}
              onClick={() => add(playlist.id)}
              className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60 disabled:opacity-40"
            >
              加入
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
