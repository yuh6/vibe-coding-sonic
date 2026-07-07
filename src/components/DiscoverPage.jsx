import { useState, useEffect, useCallback, useRef } from 'react';
import {
  generateMusic,
  getFallback,
  getLiveRadios,
  getMusicStatus,
  getPublicPlaylists,
  getPlaylist,
  getPopularTracks,
  getSharedLibrary,
  joinRadio,
  leaveRadio,
  recordPlaylistPlay,
  recordSharedTrackPlay,
  getFavorites,
  getMyHistory,
  getForYou,
  recordRecommendedPlay,
} from '../lib/api';
import MusicWheel from './MusicWheel';
import SharedLibraryBrowser from './SharedLibraryBrowser';
import PlaylistManager from './PlaylistManager';
import IconGlyph from './IconGlyph';

const MODE_LABELS = {
  brainstorm: { label: '头脑风暴', icon: 'mode-brainstorm' },
  focus: { label: '专注', icon: 'mode-focus' },
  sprint: { label: '冲刺', icon: 'mode-sprint' },
  charge: { label: '冲锋', icon: 'mode-charge' },
  behind: { label: '追赶', icon: 'mode-behind' },
  break: { label: '休息', icon: 'mode-break' },
  celebrate: { label: '庆祝', icon: 'mode-celebrate' },
};

function ModeLabel({ mode }) {
  const item = MODE_LABELS[mode];
  if (!item) return mode || null;
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <IconGlyph name={item.icon} className="h-3.5 w-3.5" />
      {item.label}
    </span>
  );
}

const DISCOVER_MBTI = 'ENFP';
const MIN_GENRE_TRACKS = 3;

const GENRE_PRESETS = {
  pop: {
    mode: 'brainstorm',
    fallbackModes: ['brainstorm', 'focus', 'sprint'],
    style: { energy: 74, texture: 32, brightness: 78 },
    tags: 'pop, dance pop, catchy hooks, bright synths, polished production, radio ready, upbeat groove',
    bpmRange: [95, 128],
  },
  jazz: {
    mode: 'focus',
    fallbackModes: ['focus', 'break', 'brainstorm'],
    style: { energy: 42, texture: 72, brightness: 48 },
    tags: 'jazz, swing, bebop, walking bass, brushed drums, piano comping, saxophone improvisation',
    bpmRange: [85, 150],
  },
  rock: {
    mode: 'sprint',
    fallbackModes: ['sprint', 'charge', 'brainstorm'],
    style: { energy: 82, texture: 76, brightness: 54 },
    tags: 'rock, electric guitar, power chords, driving bass, punchy drums, anthemic chorus, gritty energy',
    bpmRange: [105, 155],
  },
  hiphop: {
    mode: 'sprint',
    fallbackModes: ['sprint', 'focus', 'behind'],
    style: { energy: 68, texture: 38, brightness: 42 },
    tags: 'hip hop, boom bap, rap beat, deep bass, punchy snare, sampled drums, head nodding groove',
    bpmRange: [80, 105],
  },
  classical: {
    mode: 'focus',
    fallbackModes: ['focus', 'break', 'charge'],
    style: { energy: 36, texture: 84, brightness: 58 },
    tags: 'classical, orchestral, solo piano, concert hall, expressive strings, elegant composition, dynamic range',
    bpmRange: [55, 130],
  },
  electronic: {
    mode: 'sprint',
    fallbackModes: ['sprint', 'brainstorm', 'charge'],
    style: { energy: 84, texture: 18, brightness: 66 },
    tags: 'electronic, synth bass, four on the floor, arpeggiators, club drums, neon dancefloor, polished mix',
    bpmRange: [120, 145],
  },
  rnb: {
    mode: 'focus',
    fallbackModes: ['focus', 'break', 'brainstorm'],
    style: { energy: 52, texture: 46, brightness: 50 },
    tags: 'r&b, soulful chords, smooth groove, warm bass, soft drums, late night, polished vocals',
    bpmRange: [70, 105],
  },
  country: {
    mode: 'focus',
    fallbackModes: ['focus', 'break', 'celebrate'],
    style: { energy: 48, texture: 86, brightness: 62 },
    tags: 'country, acoustic guitar, fiddle, warm bass, americana, storytelling, organic drums, heartfelt',
    bpmRange: [75, 120],
  },
  latin: {
    mode: 'brainstorm',
    fallbackModes: ['brainstorm', 'sprint', 'celebrate'],
    style: { energy: 78, texture: 48, brightness: 82 },
    tags: 'latin, reggaeton, dembow rhythm, latin percussion, brass stabs, festive groove, danceable hook',
    bpmRange: [90, 112],
  },
  metal: {
    mode: 'charge',
    fallbackModes: ['charge', 'sprint', 'behind'],
    style: { energy: 94, texture: 80, brightness: 34 },
    tags: 'metal, heavy guitar riffs, double kick drums, aggressive bass, distorted power chords, intense energy',
    bpmRange: [120, 170],
  },
  indie: {
    mode: 'brainstorm',
    fallbackModes: ['brainstorm', 'focus', 'break'],
    style: { energy: 58, texture: 66, brightness: 60 },
    tags: 'indie, jangly guitars, warm synths, intimate drums, dreamy texture, alternative pop, heartfelt melody',
    bpmRange: [85, 130],
  },
  funk: {
    mode: 'brainstorm',
    fallbackModes: ['brainstorm', 'sprint', 'celebrate'],
    style: { energy: 76, texture: 44, brightness: 72 },
    tags: 'funk, slap bass, tight drums, syncopated guitar, brass stabs, clavinet, danceable pocket groove',
    bpmRange: [95, 125],
  },
};

function genrePreset(genre) {
  const preset = GENRE_PRESETS[genre?.id] || GENRE_PRESETS.electronic;
  return {
    ...preset,
    selectedGenre: {
      id: genre?.id || 'electronic',
      label: genre?.name || 'Electronic',
      tags: preset.tags,
      bpmRange: preset.bpmRange,
      instruments: [],
      mood: [],
    },
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeTracks(primary = [], secondary = []) {
  const seen = new Set();
  const merged = [];
  for (const track of [...primary, ...secondary]) {
    const key = track?.id || track?.audioUrl;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(track);
  }
  return merged;
}

function toFallbackWheelTrack(track, genre, index, mode) {
  const audioUrl = track?.audioUrl || track?.url;
  return {
    id: `${genre.id}-${track?.id || mode || index}`,
    title: `${genre.name} · ${track?.title || `Fallback ${index + 1}`}`,
    artist: `Fallback Deck · ${MODE_LABELS[mode] || mode}`,
    duration: '--:--',
    likes: 'fallback',
    audioUrl,
    genre: genre.id,
    source: 'fallback',
  };
}

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
          <IconGlyph name="radio" className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">{station.title}</div>
          <div className="text-[11px] text-white/40">
            {station.userName} · <ModeLabel mode={station.mode} />
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
        <div className="flex items-center gap-1 text-[11px] text-white/50 pl-[52px] truncate">
          <IconGlyph name="music-note-small" className="h-3 w-3" />
          <span className="truncate">{station.currentTrack.title} · {station.currentTrack.bpm} BPM</span>
        </div>
      )}
      <div className="flex items-center gap-3 mt-2 pl-[52px] text-[10px] text-white/30">
        <span className="flex items-center gap-1">
          <IconGlyph name="listeners" className="h-3 w-3" />
          {station.listenerCount}
        </span>
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
          <IconGlyph name="music" className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white/90 truncate">{playlist.title}</div>
          <div className="text-[11px] text-white/40">
            {playlist.userName} · {playlist.trackCount} 首
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-white/30">
          <IconGlyph name="play" className="h-3 w-3" />
          {playlist.playCount}
        </span>
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
  const genreGenerationRef = useRef({});

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

  const refreshGenreTracks = useCallback(async (genre) => {
    const data = await getSharedLibrary({ genre: genre.id, limit: 12 });
    const tracks = data.tracks || [];
    if (tracks.length) {
      setWheelTracks((current) => mergeTracks(tracks, current));
    }
    return tracks;
  }, []);

  const pollGenreJob = useCallback(async (jobId) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await wait(attempt === 0 ? 1500 : 3000);
      const data = await getMusicStatus(jobId);
      if (data.status === 'completed' || data.status === 'failed') return data;
    }
    return null;
  }, []);

  const ensureGenreGenerated = useCallback(async (genre, existingCount = 0) => {
    const preset = genrePreset(genre);
    const missing = Math.max(0, MIN_GENRE_TRACKS - existingCount);
    if (!missing || genreGenerationRef.current[genre.id]) return;

    genreGenerationRef.current[genre.id] = true;
    try {
      const jobIds = [];
      for (let i = 0; i < missing; i += 1) {
        try {
          const job = await generateMusic({
            mbti: DISCOVER_MBTI,
            mode: preset.mode,
            style: preset.style,
            selectedGenre: preset.selectedGenre,
            vocals: { enabled: false },
            splitStems: false,
          });
          if (job?.jobId) jobIds.push(job.jobId);
        } catch (err) {
          console.warn('[discover genre generate]', err.message);
          break;
        }
      }

      await Promise.allSettled(jobIds.map((jobId) => pollGenreJob(jobId)));
      // persistTrackAsync may finish just after the status call; give the shared library a short beat.
      await wait(1200);
      await refreshGenreTracks(genre).catch(() => {});
    } finally {
      delete genreGenerationRef.current[genre.id];
    }
  }, [pollGenreJob, refreshGenreTracks]);

  const handleGenrePick = useCallback(async (genre) => {
    const preset = genrePreset(genre);
    const sharedTracks = await refreshGenreTracks(genre).catch(() => []);
    const sharedPlayableTracks = sharedTracks.filter((track) => track.audioUrl).slice(0, MIN_GENRE_TRACKS);

    ensureGenreGenerated(genre, sharedPlayableTracks.length).catch((err) => {
      console.warn('[discover genre ensure]', err.message);
    });

    if (sharedPlayableTracks.length >= MIN_GENRE_TRACKS) {
      return {
        tracks: sharedPlayableTracks,
        message: `已接入 ${sharedPlayableTracks.length} 首 ${genre.name} 共享曲库真实歌`,
      };
    }

    const fallbackResults = await Promise.all(
      preset.fallbackModes.slice(0, MIN_GENRE_TRACKS).map((mode, index) =>
        getFallback({ mode, mbti: DISCOVER_MBTI })
          .then((track) => toFallbackWheelTrack(track, genre, index, mode))
          .catch(() => null)
      )
    );
    const fallbackTracks = fallbackResults.filter((track) => track?.audioUrl).slice(0, MIN_GENRE_TRACKS);
    const immediateTracks = mergeTracks(sharedPlayableTracks, fallbackTracks).slice(0, MIN_GENRE_TRACKS);

    return {
      tracks: immediateTracks,
      message: sharedPlayableTracks.length
        ? `已接入 ${sharedPlayableTracks.length} 首共享曲库真实歌，兜底补位到 ${immediateTracks.length} 首`
        : `已先接入 ${fallbackTracks.length} 首兜底，后台补足 ${MIN_GENRE_TRACKS} 首 ${genre.name}`,
    };
  }, [ensureGenreGenerated, refreshGenreTracks]);

  const handleTune = useCallback(async (station) => {
    try {
      if (tuned) await leaveRadio(tuned.id).catch(() => {});
      const full = await joinRadio(station.id);
      setTuned(full);
      if (full.currentTrack?.audioUrl) {
        onPlayTrack?.({ audioUrl: full.currentTrack.audioUrl, title: full.currentTrack.title });
      }
    } catch (err) {
      console.error('[discover] handleTune failed:', err);
    }
  }, [tuned, onPlayTrack]);

  const handlePlayPlaylist = useCallback(async (pl) => {
    try {
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
    } catch (err) {
      console.error('[discover] handlePlayPlaylist failed:', err);
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
          onGenrePick={handleGenrePick}
        />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white/90">
          <IconGlyph name="discover" className="h-5 w-5" />
          <span>发现音乐</span>
        </h2>
        <div className="flex flex-wrap gap-1 p-0.5 rounded-lg bg-white/5">
          {[
            { id: 'radio', label: '电台', icon: 'radio', active: 'bg-green-500/20 text-green-300' },
            { id: 'playlists', label: '播放列表', icon: 'music', active: 'bg-indigo-500/20 text-indigo-300' },
            { id: 'favorites', label: '收藏', icon: 'feedback-like', active: 'bg-pink-500/20 text-pink-300' },
            { id: 'history', label: '历史', icon: 'music-note-small', active: 'bg-sky-500/20 text-sky-300' },
            { id: 'for-you', label: '猜你喜欢', icon: 'mode-celebrate', active: 'bg-amber-500/20 text-amber-300' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                tab === t.id ? t.active : 'text-white/50 hover:text-white/70'
              }`}
            >
              <IconGlyph name={t.icon} className="h-3.5 w-3.5" />
              <span>{t.label}</span>
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
              tab === 'favorites' ? '还没有收藏 · 在共享曲库点收藏喜欢的歌'
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
