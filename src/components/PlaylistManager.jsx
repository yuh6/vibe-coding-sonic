import { useCallback, useEffect, useState } from 'react';
import {
  addToPlaylist, createPlaylist, getMyPlaylists,
  updatePlaylist, deletePlaylist, getPlaylist, removeFromPlaylist,
} from '../lib/api';

export default function PlaylistManager({ selectedTrack, user, onRequireAuth, onAdded, onPlayTrack }) {
  const [playlists, setPlaylists] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(() => {
    if (!user) {
      setPlaylists([]);
      setLoading(false);
      setError('');
      return;
    }

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
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const requireAuth = (msg) => onRequireAuth?.(msg);

  const create = async () => {
    const safeTitle = title.trim();
    if (!safeTitle) return;
    if (!user) {
      requireAuth('登录后可以创建播放列表');
      return;
    }
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
        requireAuth('登录后可以创建播放列表');
        return;
      }
      setError(err.message || '创建播放列表失败');
    } finally {
      setLoading(false);
    }
  };

  const add = async (playlistId) => {
    if (!user) {
      requireAuth('登录后可以管理播放列表');
      return;
    }
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
      if (expandedId === playlistId) openDetail(playlistId, true);
    } catch (err) {
      if (err.status === 401) {
        requireAuth('登录后可以管理播放列表');
        return;
      }
      setError(err.message || '添加到播放列表失败');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (pl) => {
    setEditingId(pl.id);
    setEditTitle(pl.title);
    setMessage('');
    setError('');
  };

  const saveEdit = async (pl) => {
    const next = editTitle.trim();
    if (!next || next === pl.title) { setEditingId(null); return; }
    setLoading(true);
    setError('');
    try {
      await updatePlaylist(pl.id, { title: next });
      setEditingId(null);
      setMessage('已重命名');
      load();
    } catch (err) {
      if (err.status === 401) { requireAuth('登录后可以管理播放列表'); return; }
      setError(err.message || '重命名失败');
    } finally {
      setLoading(false);
    }
  };

  const togglePublic = async (pl) => {
    setLoading(true);
    setError('');
    try {
      await updatePlaylist(pl.id, { isPublic: !pl.isPublic });
      setMessage(pl.isPublic ? '已设为私密' : '已公开');
      onAdded?.();
      load();
    } catch (err) {
      if (err.status === 401) { requireAuth('登录后可以管理播放列表'); return; }
      setError(err.message || '更新失败');
    } finally {
      setLoading(false);
    }
  };

  const remove = async (pl) => {
    if (!window.confirm(`确定删除歌单「${pl.title}」?`)) return;
    setLoading(true);
    setError('');
    try {
      await deletePlaylist(pl.id);
      setMessage('歌单已删除');
      if (expandedId === pl.id) { setExpandedId(null); setDetail(null); }
      onAdded?.();
      load();
    } catch (err) {
      if (err.status === 401) { requireAuth('登录后可以管理播放列表'); return; }
      setError(err.message || '删除失败');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (playlistId, force = false) => {
    if (!force && expandedId === playlistId) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(playlistId);
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await getPlaylist(playlistId);
      setDetail(data);
    } catch (err) {
      setError(err.message || '歌单详情加载失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const removeTrack = async (playlistId, trackId) => {
    setLoading(true);
    setError('');
    try {
      await removeFromPlaylist(playlistId, trackId);
      setMessage('已移除曲目');
      openDetail(playlistId, true);
      load();
    } catch (err) {
      if (err.status === 401) { requireAuth('登录后可以管理播放列表'); return; }
      setError(err.message || '移除失败');
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
      {!user && <div className="mt-2 text-xs text-white/35">登录后可以创建播放列表并收藏共享曲目。</div>}

      <div className="mt-3 space-y-2">
        {playlists.map((playlist) => (
          <div key={playlist.id} className="rounded-lg bg-black/20 p-2">
            <div className="flex items-center gap-2">
              {editingId === playlist.id ? (
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  onBlur={() => saveEdit(playlist)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') saveEdit(playlist);
                    if (event.key === 'Escape') setEditingId(null);
                  }}
                  className="min-w-0 flex-1 rounded border border-indigo-400/40 bg-black/40 px-2 py-1 text-xs text-white/85"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => openDetail(playlist.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-white/30">{expandedId === playlist.id ? '▼' : '▶'}</span>
                    <span className="truncate text-xs font-medium text-white/80">{playlist.title}</span>
                    {playlist.isPublic && <span className="text-[9px] text-green-400/70">公开</span>}
                  </div>
                  <div className="pl-3.5 text-[10px] text-white/35">{playlist.trackCount || 0} 首 · 播放 {playlist.playCount || 0}</div>
                </button>
              )}

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={loading || !selectedTrack?.id}
                  onClick={() => add(playlist.id)}
                  title="加入已选曲目"
                  className="rounded-md border border-white/10 px-2 py-1 text-[10px] text-white/60 disabled:opacity-40"
                >
                  加入
                </button>
                <button type="button" onClick={() => startEdit(playlist)} title="重命名" className="px-1 text-xs text-white/40 hover:text-white/70">✏️</button>
                <button type="button" onClick={() => togglePublic(playlist)} title={playlist.isPublic ? '设为私密' : '公开'} className="px-1 text-xs text-white/40 hover:text-white/70">{playlist.isPublic ? '🌐' : '🔒'}</button>
                <button type="button" onClick={() => remove(playlist)} title="删除歌单" className="px-1 text-xs text-white/40 hover:text-red-400">🗑️</button>
              </div>
            </div>

            {expandedId === playlist.id && (
              <div className="mt-2 border-t border-white/5 pt-2">
                {detailLoading ? (
                  <div className="py-2 text-center text-[11px] text-white/30">加载中...</div>
                ) : !detail?.tracks?.length ? (
                  <div className="py-2 text-center text-[11px] text-white/30">歌单还没有曲目</div>
                ) : (
                  <div className="space-y-1">
                    {detail.tracks.map((track, index) => (
                      <div key={track.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-white/5">
                        <span className="w-4 text-right text-[10px] text-white/20">{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => track.audioUrl && onPlayTrack?.({ audioUrl: track.audioUrl, title: track.title, trackId: track.id })}
                          className="min-w-0 flex-1 truncate text-left text-xs text-white/70 hover:text-white"
                        >
                          {track.title}
                        </button>
                        <span className="shrink-0 text-[10px] text-white/25">{track.bpm} BPM</span>
                        <button
                          type="button"
                          onClick={() => removeTrack(playlist.id, track.id)}
                          title="从歌单移除"
                          className="shrink-0 px-1 text-[11px] text-white/30 hover:text-red-400"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
