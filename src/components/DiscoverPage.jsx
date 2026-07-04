import { useState, useEffect, useCallback } from 'react';
import { getLiveRadios, joinRadio, leaveRadio, getPublicPlaylists, getPlaylist, getPopularTracks, recordPlaylistPlay, recordSharedTrackPlay } from '../lib/api';
import MusicWheel from './MusicWheel';
import SharedLibraryBrowser from './SharedLibraryBrowser';
import PlaylistManager from './PlaylistManager';

const MODE_LABELS = {
  brainstorm: '🧠 头脑风暴', focus: '🎯 专注', sprint: '🏃 冲刺',
  charge: '⚡ 冲锋', behind: '🔥 追赶', break: '☕ 休息', celebrate: '🎉 庆祝',
};

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

export default function DiscoverPage({ onPlayTrack, onRequireAuth }) {
  const [tab, setTab] = useState('radio');
  const [radios, setRadios] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistDetail, setPlaylistDetail] = useState(null);
  const [tuned, setTuned] = useState(null); // 当前收听的电台
  const [loading, setLoading] = useState(false);
  const [wheelTracks, setWheelTracks] = useState([]);
  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState(null);

  useEffect(() => {
    if (tab === 'radio') {
      setLoading(true);
      getLiveRadios().then((d) => setRadios(d.stations || [])).catch(() => {}).finally(() => setLoading(false));
    } else {
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
          onRecordTrackPlay={(trackId) => recordSharedTrackPlay(trackId).catch(() => {})}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white/90">🌍 发现音乐</h2>
        <div className="flex gap-1 p-0.5 rounded-lg bg-white/5">
          <button
            onClick={() => setTab('radio')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              tab === 'radio' ? 'bg-green-500/20 text-green-300' : 'text-white/50 hover:text-white/70'
            }`}
          >
            📻 电台
          </button>
          <button
            onClick={() => setTab('playlists')}
            className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
              tab === 'playlists' ? 'bg-indigo-500/20 text-indigo-300' : 'text-white/50 hover:text-white/70'
            }`}
          >
            🎵 播放列表
          </button>
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
      ) : (
        <div className="space-y-4">
          <SharedLibraryBrowser
            onPlayTrack={onPlayTrack}
            onSelectTrack={setSelectedLibraryTrack}
          />
          <PlaylistManager
            selectedTrack={selectedLibraryTrack}
            onRequireAuth={onRequireAuth}
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
