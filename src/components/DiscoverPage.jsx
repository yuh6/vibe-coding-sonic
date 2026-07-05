import { useState, useEffect, useCallback } from 'react';
import { getLiveRadios, joinRadio, leaveRadio, getPublicPlaylists, getPlaylist, getPopularTracks, recordPlaylistPlay, recordSharedTrackPlay, getFavorites, getMyHistory, getForYou, recordRecommendedPlay } from '../lib/api';
import MusicWheel from './MusicWheel';
import SharedLibraryBrowser from './SharedLibraryBrowser';
import PlaylistManager from './PlaylistManager';

const MODE_LABELS = {
  brainstorm: '🧠 头脑风暴', focus: '🎯 专注', sprint: '🏃 冲刺',
  charge: '⚡ 冲锋', behind: '🔥 追赶', break: '☕ 休息', celebrate: '🎉 庆祝',
};

function formatWhen(ts) {
  if (!ts) return '';
  try {
    return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  } catch {
    return '';
  }
}

// 可复用的曲目列表（收藏/历史/猜你喜欢共用）
function TrackList({ tracks, onPlay, emptyHint }) {
  if (!tracks.length) {
    return <div className="py-8 text-center text-sm text-white/30">{emptyHint}</div>;
  }
  return (
    <div className="space-y-1">
      {tracks.map((track, index) => (
        <div
          key={`${track.id || track.trackId}-${index}`}
          onClick={() => onPlay(track)}
          className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/5"
        >
          <span className="w-5 text-right text-[11px] text-white/20">{index + 1}</span>
          <span className="flex-1 truncate text-xs text-white/70">{track.title}</span>
          {track.genre && <span className="text-[10px] text-white/30">{track.genre}</span>}
          {track.bpm ? <span className="text-[10px] text-white/20">{track.bpm} BPM</span> : null}
          {track.playedAt ? <span className="text-[10px] text-white/25">{formatWhen(track.playedAt)}</span> : null}
        </div>
      ))}
    </div>
  );
}

function RadioCard({ station, onTune }) {
  return (
    <div
      className="group p-4 rounded-xl border border-white/10 bg-white/5 hover:border-green-500/30 hover:bg-white/8 transition-all cursor-pointer"
      onClick={() => onTune(station)}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
          <span className="text-green-400 text-lg">📻</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">{station.title}</div>
          <div className="text-[11px] text-white/40">
            {station.userName} · {MODE_LABELS[station.mode] || station.mode}
          </div>
        </div>
        {station.isLive && (
          <span className="flex items-center gap-1 text-[10px] text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
      {station.currentTrack && (
        <div className="text-[11px] text-white/50 pl-[52px] truncate">
          ♪ {station.currentTrack.title} · {station.currentTrack.bpm} BPM
        </div>
      )}
      <div className="flex items-center gap-3 mt-2 pl-[52px] text-[10px] text-white/30">
        <span>👥 {station.listenerCount}</span>
        {station.mbti && <span>{station.mbti}</span>}
      </div>
    </div>
  );
}

function PlaylistCard({ playlist, onPlay }) {
  return (
    <div
      className="group p-4 rounded-xl border border-white/10 bg-white/5 hover:border-indigo-500/30 hover:bg-white/8 transition-all cursor-pointer"
      onClick={() => onPlay(playlist)}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <span className="text-indigo-300 text-lg">🎵</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">{playlist.title}</div>
          <div className="text-[11px] text-white/40">
            {playlist.userName} · {playlist.trackCount} 首
          </div>
        </div>
        <span className="text-[10px] text-white/30">▶ {playlist.playCount}</span>
      </div>
      {playlist.description && (
        <div className="text-[11px] text-white/40 mt-2 pl-[52px] line-clamp-2">{playlist.description}</div>
      )}
    </div>
  );
}

export default function DiscoverPage({ user, onPlayTrack, onTogglePlayback, onStopPlayback, onRequireAuth }) {
  const [tab, setTab] = useState('radio');
  const [radios, setRadios] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [tuned, setTuned] = useState(null); // 当前收听的电台
  const [loading, setLoading] = useState(false);
  const [wheelTracks, setWheelTracks] = useState([]);
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState(null);
  const [personalTracks, setPersonalTracks] = useState([]);
  const [personalLoading, setPersonalLoading] = useState(false);

  const PERSONAL_TABS = ['favorites', 'history', 'for-you'];

  const playPersonal = useCallback((track) => {
    const trackId = track.id || track.trackId;
    if (trackId) recordRecommendedPlay({ trackId }).catch(() => {});
    onPlayTrack?.({ audioUrl: track.audioUrl, title: track.title, trackId });
  }, [onPlayTrack]);

  useEffect(() => {
    if (!PERSONAL_TABS.includes(tab)) return;
    if (!user) { setPersonalTracks([]); return; }
    setPersonalLoading(true);
    setPersonalTracks([]);
    const loader =
      tab === 'favorites' ? getFavorites({ limit: 50 }).then((d) => d.tracks || [])
      : tab === 'history' ? getMyHistory({ limit: 50 }).then((d) => d.history || [])
      : getForYou(24).then((d) => d.tracks || []);
    loader
      .then((list) => setPersonalTracks(list))
      .catch(() => setPersonalTracks([]))
      .finally(() => setPersonalLoading(false));
  }, [tab, user]);

  useEffect(() => {
    if (tab === 'radio') {
      setLoading(true);
      getLiveRadios().then((d) => setRadios(d.stations || [])).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === 'playlists') {
      setLoading(true);
      getPublicPlaylists().then((d) => setPlaylists(d.playlists || [])).catch(() => {}).finally(() => setLoading(false));
    }
  }, [tab]);

  useEffect(() => {
    getPopularTracks(36)
      .then((data) => setWheelTracks(data.tracks || []))
      .catch(() => setWheelTracks([]));
  }, []);

  const handleTune = useCallback(async (station) => {
    if (tuned) await leaveRadio(tuned.id).catch(() => {});
    const full = await joinRadio(station.id);
    setTuned(full);
    if (full.currentTrack?.audioUrl) {
      onPlayTrack?.({ audioUrl: full.currentTrack.audioUrl, title: full.currentTrack.title });
    }
  }, [tuned, onPlayTrack]);

  const handlePlayPlaylist = useCallback(async (pl) => {
    await recordPlaylistPlay(pl.id).catch(() => {});
    setPlaylists((items) =>
      items.map((item) => item.id === pl.id ? { ...item, playCount: (item.playCount || 0) + 1 } : item)
    );

    const detail = await getPlaylist(pl.id);
    setPlaylistDetail(detail);
    if (detail?.tracks?.length) {
      const first = detail.tracks[0];
      if (first.id) recordSharedTrackPlay(first.id).catch(() => {});
      onPlayTrack?.({ audioUrl: first.audioUrl, title: first.title, trackId: first.id });
    }
  }, [onPlayTrack]);

  return (
    <div className="space-y-4">
      {/* 音乐类型随机转盘（居中）*/}
      <div className="mx-auto w-full max-w-5xl">
        <MusicWheel
          backendTracks={wheelTracks}
          onPlayTrack={onPlayTrack}
          onTogglePlayback={onTogglePlayback}
          onStopPlayback={onStopPlayback}
          onRecordTrackPlay={(trackId) => recordSharedTrackPlay(trackId).catch(() => {})}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white/90">🌍 发现音乐</h2>
        <div className="flex flex-wrap gap-1 p-0.5 rounded-lg bg-white/5">
          {[
            { id: 'radio', label: '📻 电台', active: 'bg-green-500/20 text-green-300' },
            { id: 'playlists', label: '🎵 播放列表', active: 'bg-indigo-500/20 text-indigo-300' },
            { id: 'favorites', label: '❤️ 收藏', active: 'bg-pink-500/20 text-pink-300' },
            { id: 'history', label: '🕐 历史', active: 'bg-sky-500/20 text-sky-300' },
            { id: 'for-you', label: '✨ 猜你喜欢', active: 'bg-amber-500/20 text-amber-300' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                tab === t.id ? t.active : 'text-white/50 hover:text-white/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 当前收听 */}
      {tuned && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-green-300 flex-1">
            正在收听: {tuned.title} — {tuned.currentTrack?.title || '等待中...'}
          </span>
          <button
            onClick={async () => { await leaveRadio(tuned.id).catch(() => {}); setTuned(null); }}
            className="text-[10px] text-red-400 hover:text-red-300"
          >
            离开
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="text-center text-white/30 text-sm py-8">加载中...</div>
      ) : tab === 'radio' ? (
        radios.length === 0 ? (
          <div className="text-center text-white/30 text-sm py-8">
            暂无在线电台<br/>
            <span className="text-[11px]">开始一个编排会话并公开为电台，让其他人收听你的音乐流</span>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{radios.map((r) => <RadioCard key={r.id} station={r} onTune={handleTune} />)}</div>
        )
      ) : PERSONAL_TABS.includes(tab) ? (
        !user ? (
          <div className="text-center text-white/30 text-sm py-8">
            登录后查看你的{tab === 'favorites' ? '收藏' : tab === 'history' ? '播放历史' : '个性化推荐'}<br/>
            <button
              onClick={() => onRequireAuth?.('登录后可以查看收藏、历史与推荐')}
              className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs text-white/70 hover:text-white"
            >
              去登录
            </button>
          </div>
        ) : personalLoading ? (
          <div className="text-center text-white/30 text-sm py-8">加载中...</div>
        ) : (
          <TrackList
            tracks={personalTracks}
            onPlay={playPersonal}
            emptyHint={
              tab === 'favorites' ? '还没有收藏 · 在共享曲库点 ❤️ 收藏喜欢的歌'
              : tab === 'history' ? '还没有播放记录'
              : '暂无推荐 · 多听几首后这里会更懂你'
            }
          />
        )
      ) : (
        <div className="space-y-4">
          <SharedLibraryBrowser
            onPlayTrack={onPlayTrack}
            onSelectTrack={setSelectedLibraryTrack}
            user={user}
            onRequireAuth={onRequireAuth}
          />
          <PlaylistManager
            selectedTrack={selectedLibraryTrack}
            user={user}
            onRequireAuth={onRequireAuth}
            onPlayTrack={onPlayTrack}
            onAdded={() => getPublicPlaylists().then((d) => setPlaylists(d.playlists || [])).catch(() => {})}
          />

          {playlistDetail ? (
            <div>
              <button onClick={() => setPlaylistDetail(null)} className="text-xs text-white/40 mb-3 hover:text-white/60">← 返回列表</button>
              <h3 className="text-sm font-medium text-white/80 mb-2">{playlistDetail.title}</h3>
              <div className="space-y-1">
                {playlistDetail.tracks?.map((t, i) => (
                  <div
                    key={t.id}
                    onClick={() => {
                      if (t.id) recordSharedTrackPlay(t.id).catch(() => {});
                      onPlayTrack?.({ audioUrl: t.audioUrl, title: t.title, trackId: t.id });
                    }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
                  >
                    <span className="text-[11px] text-white/20 w-5 text-right">{i + 1}</span>
                    <span className="text-xs text-white/70 flex-1 truncate">{t.title}</span>
                    <span className="text-[10px] text-white/30">{t.genre}</span>
                    <span className="text-[10px] text-white/20">{t.bpm} BPM</span>
                  </div>
                ))}
              </div>
            </div>
          ) : playlists.length === 0 ? (
            <div className="text-center text-white/30 text-sm py-8">
              暂无公开播放列表<br/>
              <span className="text-[11px]">在歌曲总库中收藏歌曲到播放列表，其他人就能发现它</span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">{playlists.map((pl) => <PlaylistCard key={pl.id} playlist={pl} onPlay={handlePlayPlaylist} />)}</div>
          )}
        </div>
      )}
    </div>
  );
}
