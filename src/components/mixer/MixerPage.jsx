import { useEffect, useMemo, useRef, useState } from 'react';
import { useMixer } from '../../hooks/useMixer';
import TransportBar from './TransportBar';
import NowPlayingInspector, { UserPlaylistPanel } from './NowPlayingInspector';
import StyleFaders from '../StyleFaders';
import { AXES, getTheme, mbtiFromAxes } from '../../lib/mbti';

const SAMPLE_TRACKS = [
  { id: 'sample-rain-receipts', name: 'Rain on Receipts', url: '/samples/fallback-focus-a.mp3', type: 'stem' },
  { id: 'sample-midnight-ticket', name: 'Midnight Train Ticket', url: '/samples/fallback-brainstorm-a.mp3', type: 'stem' },
  { id: 'sample-record-skip', name: 'Midnight Record Skip', url: '/samples/fallback-sprint-a.mp3', type: 'stem' },
  { id: 'sample-istj-brainstorm', name: 'ISTJ-brainstorm', url: '/samples/fallback-personality-istj-a.mp3', type: 'stem' },
];

const SAVED_LISTS_KEY = 'vibe-mixer-saved-lists';

const RECENT_PLAYS = [
  { title: 'Focus build 07', meta: 'INTJ · focus · 104 BPM', url: '/samples/fallback-focus-b.mp3' },
  { title: 'Warm refactor loop', meta: 'ISFJ · break · 82 BPM', url: '/samples/fallback-break-a.mp3' },
  { title: 'Sprint sketch take', meta: 'ENTP · sprint · 136 BPM', url: '/samples/fallback-sprint-b.mp3' },
  { title: 'Night deploy pad', meta: 'ISTP · behind · 118 BPM', url: '/samples/fallback-behind-a.mp3' },
];

const COLLECTIONS = [
  { title: 'Deep work stems', tag: 'playlist', count: '12 tracks', cover: '/albums/1.jpg', url: '/samples/fallback-focus-c.mp3' },
  { title: 'Bugfix afterhours', tag: 'album', count: '8 tracks', cover: '/albums/5.jpg', url: '/samples/fallback-behind-b.mp3' },
  { title: 'Brainstorm tapes', tag: 'playlist', count: '15 tracks', cover: '/albums/9.jpg', url: '/samples/fallback-brainstorm-b.mp3' },
  { title: 'Ship room energy', tag: 'album', count: '9 tracks', cover: '/albums/12.jpg', url: '/samples/fallback-charge-a.mp3' },
  { title: 'Celebrate cache', tag: 'playlist', count: '7 tracks', cover: '/albums/15.jpg', url: '/samples/fallback-celebrate-a.mp3' },
];

const GENRE_GROUPS = [
  { id: 'retro-synthwave', label: '复古电子', en: 'Retro', items: ['Synthwave', 'City pop', 'Vaporwave'] },
  { id: 'chill-lofi', label: 'Chill', en: 'Chill', items: ['Lo-fi', 'Downtempo', 'Bedroom pop'] },
  { id: 'pop-main', label: '流行', en: 'Pop', items: ['Mandopop', 'Dance pop', 'Alt pop'] },
  { id: 'game-ost', label: '游戏', en: 'Gaming', items: ['8-bit', 'Boss fight', 'Open world'] },
  { id: 'hiphop-boom', label: '嘻哈', en: 'Hip-hop', items: ['Boom bap', 'Trap', 'Jazz rap'] },
  { id: 'ambient-calm', label: '氛围', en: 'Ambient', items: ['Drone', 'Space pad', 'Piano mist'] },
  { id: 'rock-drive', label: '摇滚', en: 'Rock', items: ['Alt rock', 'Post rock', 'Noise pop'] },
  { id: 'jazz-night', label: '爵士', en: 'Jazz', items: ['Nu jazz', 'Bebop', 'Jazztronica'] },
  { id: 'folk-warm', label: '民谣', en: 'Folk', items: ['Indie folk', 'Acoustic', 'Warm strings'] },
  { id: 'classical-code', label: '古典', en: 'Classical', items: ['Minimal piano', 'Chamber', 'Neo classical'] },
];

function CompactMbtiControl({ axes, onAxesChange, theme, mbti }) {
  const updateAxis = (key, value) => onAxesChange({ ...axes, [key]: value });
  return (
    <div className="mixer-compact-mbti">
      <div className="flex items-center justify-between gap-2">
        <span className="deck-label">MBTI Remix</span>
        <span className="mixer-mbti-badge" style={{ color: theme.glow }}>{mbti}</span>
      </div>
      <div className="mixer-mbti-sliders">
        {AXES.map((axis) => {
          const value = axes[axis.key];
          const active = value < 50 ? axis.left : axis.right;
          return (
            <label key={axis.key} className="mixer-axis-row">
              <span>{axis.left}</span>
              <input
                type="range"
                min="0"
                max="100"
                value={value}
                onChange={(event) => updateAxis(axis.key, Number(event.target.value))}
                className="fader"
                style={{
                  '--fader-from': theme.primary,
                  '--fader-to': theme.accent,
                  '--fader-glow': `${theme.accent}88`,
                }}
                aria-label={`${axis.left}/${axis.right}`}
              />
              <span>{axis.right}</span>
              <strong>{active} {Math.round(Math.abs(value - 50) * 2)}%</strong>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function CompactGenrePicker({ value, onChange }) {
  const [openGroup, setOpenGroup] = useState('');
  const activeGroup = GENRE_GROUPS.find((group) => group.items.includes(value) || group.id === value);
  return (
    <div className="mixer-genre-compact">
      <div className="flex items-center justify-between gap-2">
        <span className="deck-label">Explore Genres</span>
        {value && (
          <button type="button" onClick={() => onChange('')} className="mixer-mini-button">
            Clear
          </button>
        )}
      </div>
      <div className="mixer-genre-buttons">
        {GENRE_GROUPS.map((group) => {
          const isOpen = openGroup === group.id;
          const isActive = activeGroup?.id === group.id;
          return (
            <div key={group.id} className="mixer-genre-popover-wrap">
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? '' : group.id)}
                className={`mixer-genre-button ${isActive ? 'is-active' : ''}`}
              >
                <span>{group.label}</span>
                <small>{group.en}</small>
              </button>
              {isOpen && (
                <div className="mixer-genre-menu">
                  {group.items.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        onChange(item);
                        setOpenGroup('');
                      }}
                      className={value === item ? 'is-selected' : ''}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function importStatusText(incomingMix) {
  if (!incomingMix) return '';
  if (incomingMix.fallback) return 'Cached master loaded';
  if (incomingMix.status === 'splitting') {
    return incomingMix.stemProgress ? `Splitting stems ${incomingMix.stemProgress}` : 'Splitting stems';
  }
  if (incomingMix.stemStatus === 'failed') return `Stem split failed: ${incomingMix.stemError || 'using master only'}`;
  return `Loaded ${incomingMix.tracks?.length || 0} track${incomingMix.tracks?.length === 1 ? '' : 's'}`;
}

function loadSavedLists() {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_LISTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function MixerPage({ incomingMix = null, user }) {
  const mixer = useMixer();
  const importedSignatureRef = useRef('');
  const importJobRef = useRef('');
  const playbackWasRunningRef = useRef(false);
  const [axes, setAxes] = useState({ ie: 12, ns: 12, tf: 12, jp: 12 });
  const [style, setStyle] = useState({ energy: 52, texture: 35, brightness: 44 });
  const [genre, setGenre] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState(SAMPLE_TRACKS);
  const [activePlaylistIndex, setActivePlaylistIndex] = useState(-1);
  const [savedLists, setSavedLists] = useState(loadSavedLists);
  const [activeSavedListId, setActiveSavedListId] = useState('');
  const mbti = mbtiFromAxes(axes);
  const theme = getTheme(mbti);

  const incomingTracks = useMemo(
    () => (incomingMix?.tracks || []).filter((track) => track?.url),
    [incomingMix]
  );

  useEffect(() => {
    if (!incomingMix?.jobId || incomingTracks.length === 0) return;
    const signature = `${incomingMix.jobId}:${incomingTracks.map((track) => `${track.name}:${track.url}`).join('|')}`;
    if (signature === importedSignatureRef.current) return;

    const replace = importJobRef.current !== incomingMix.jobId;
    importedSignatureRef.current = signature;
    importJobRef.current = incomingMix.jobId;
    mixer.addTracks(incomingTracks, { replace });
  }, [incomingMix, incomingTracks, mixer.addTracks]);

  useEffect(() => {
    window.localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
  }, [savedLists]);

  const selectedGenreLabel = genre || 'Open genre';
  const promptTitle = `${mbti} ${selectedGenreLabel} mix`;
  const promptSummary = `${mbti} ${selectedGenreLabel} cue, energy ${style.energy}, texture ${style.texture}, brightness ${style.brightness}. Keep it useful for focused coding and smooth transitions.`;
  const handleSelectTrack = async (track, index = -1, autoplay = false) => {
    const nextTrack = { name: track.title || track.name, url: track.url, type: track.type || 'stem' };
    const shouldPlay = autoplay || mixer.playing;
    setSelectedTrack(nextTrack);
    setActivePlaylistIndex(index);
    await mixer.addTracks([nextTrack], { replace: true });
    if (shouldPlay) await mixer.play();
  };
  const handlePlaylistStep = (direction, autoplay = mixer.playing) => {
    if (!playlistTracks.length) return;
    const baseIndex = activePlaylistIndex >= 0 ? activePlaylistIndex : 0;
    const nextIndex = (baseIndex + direction + playlistTracks.length) % playlistTracks.length;
    handleSelectTrack(playlistTracks[nextIndex], nextIndex, autoplay);
  };
  const handleTransportPlay = () => {
    if (!mixer.tracks.length && playlistTracks.length) {
      const nextIndex = activePlaylistIndex >= 0 ? activePlaylistIndex : 0;
      handleSelectTrack(playlistTracks[nextIndex], nextIndex, true);
      return;
    }
    mixer.play();
  };
  const handleGenerateTrack = () => {
    const nextNumber = playlistTracks.length + 1;
    const generated = {
      id: `generated-${Date.now()}`,
      name: `${mbti} ${selectedGenreLabel} take ${String(nextNumber).padStart(2, '0')}`,
      url: style.energy > 66 ? '/samples/fallback-sprint-a.mp3' : style.brightness < 38 ? '/samples/fallback-focus-c.mp3' : '/samples/fallback-brainstorm-a.mp3',
      type: 'generated',
      status: 'queued from preview',
      prompt: promptSummary,
    };
    setPlaylistTracks((prev) => [...prev, generated]);
    setActiveSavedListId('');
  };
  const handleSaveList = () => {
    if (!playlistTracks.length) return;
    const fallbackName = `${mbti} ${selectedGenreLabel} list`;
    const existingNames = new Set(savedLists.map((list) => list.name));
    let name = `${fallbackName} ${String(savedLists.length + 1).padStart(2, '0')}`;
    let suffix = savedLists.length + 2;
    while (existingNames.has(name)) {
      name = `${fallbackName} ${String(suffix).padStart(2, '0')}`;
      suffix += 1;
    }
    const now = Date.now();
    const savedList = {
      id: `list-${now}`,
      name,
      tracks: playlistTracks.map((track) => ({ ...track })),
      createdAt: now,
    };
    setSavedLists((prev) => [savedList, ...prev].slice(0, 12));
    setActiveSavedListId(savedList.id);
  };
  const handleLoadList = (list) => {
    setPlaylistTracks(list.tracks || []);
    setActiveSavedListId(list.id);
    setActivePlaylistIndex(-1);
    setSelectedTrack(null);
    mixer.clear();
  };
  const handleDeleteList = (listId) => {
    setSavedLists((prev) => prev.filter((list) => list.id !== listId));
    if (activeSavedListId === listId) setActiveSavedListId('');
  };

  useEffect(() => {
    if (
      playbackWasRunningRef.current &&
      !mixer.playing &&
      mixer.duration > 0 &&
      mixer.time >= mixer.duration - 0.35 &&
      playlistTracks.length > 0
    ) {
      handlePlaylistStep(1, true);
    }
    playbackWasRunningRef.current = mixer.playing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixer.playing, mixer.time, mixer.duration, playlistTracks.length]);

  return (
    <div className="mixer-spotify-shell" style={{ '--mixer-accent': theme.accent }}>
      <aside className="mixer-sidebar min-w-0">
        <section className="mixer-control-module mixer-mbti-module">
          <CompactMbtiControl axes={axes} onAxesChange={setAxes} theme={theme} mbti={mbti} />
        </section>

        <section className="mixer-control-module mixer-genre-module">
          <CompactGenrePicker value={genre} onChange={setGenre} />
        </section>

        <section className="mixer-control-module mixer-fx-module">
          <StyleFaders style={style} onStyleChange={setStyle} />
        </section>
      </aside>

      <main className="mixer-main min-w-0">
        <section className="mixer-now-hero">
          <div className="mixer-hero-art mixer-visual-art">
            <img src="/card-mixer.jpg" alt="DJ console and waveform artwork" />
            <div className="mixer-visual-grid" />
          </div>
          <div className="min-w-0">
            <p className="mixer-kicker">Prompt preview</p>
            <h1 className="line-clamp-2 font-display text-3xl font-black tracking-tight text-white xl:text-5xl" title={promptTitle}>
              {promptTitle}
            </h1>
            <p className="mixer-now-prompt mt-2 max-w-2xl text-sm leading-6 text-white/60">
              {promptSummary}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="mixer-pill">{mbti}</span>
              <span className="mixer-pill">{selectedGenreLabel}</span>
              <span className="mixer-pill">FX {style.energy}/{style.texture}/{style.brightness}</span>
              {incomingMix && <span className="mixer-pill accent">{importStatusText(incomingMix)}</span>}
            </div>
          </div>
          <button type="button" onClick={handleGenerateTrack} className="mixer-generate-button">
            <span>Generate</span>
            <small>queue to playlist</small>
          </button>
        </section>

        <section className="mixer-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="mixer-kicker">Recently played</span>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">Recent plays</h2>
            </div>
            {mixer.loading && <span className="font-mono text-[10px] text-amber-300">LOADING</span>}
          </div>
          <div className="mixer-recent-rail">
            {RECENT_PLAYS.map((track, index) => (
              <button key={track.title} type="button" onClick={() => handleSelectTrack(track)} className="mixer-recent-card">
                <span className="mixer-row-index">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0">
                  <strong>{track.title}</strong>
                  <small>{track.meta}</small>
                </span>
                <span className="mixer-row-action">Load</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mixer-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="mixer-kicker">Playlists and albums</span>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">Collections</h2>
            </div>
            <span className="font-mono text-[10px] text-white/35">scroll sideways</span>
          </div>
          <div className="mixer-collection-rail">
            {COLLECTIONS.map((item) => (
              <button key={item.title} type="button" onClick={() => handleSelectTrack(item)} className="mixer-collection-card">
                <img src={item.cover} alt={`${item.title} cover`} />
                <strong>{item.title}</strong>
                <span>{item.tag} · {item.count}</span>
              </button>
            ))}
          </div>
        </section>
      </main>

      <NowPlayingInspector
        tracks={mixer.tracks}
        error={mixer.error}
        onClear={mixer.clear}
      >
        <UserPlaylistPanel
          user={user}
          playlistTracks={playlistTracks}
          activeIndex={activePlaylistIndex}
          savedLists={savedLists}
          activeSavedListId={activeSavedListId}
          onAddTrack={handleSelectTrack}
          onSaveList={handleSaveList}
          onLoadList={handleLoadList}
          onDeleteList={handleDeleteList}
        />
      </NowPlayingInspector>

      <div className="mixer-bottom-player">
        <TransportBar
          playing={mixer.playing}
          time={mixer.time}
          duration={mixer.duration}
          loop={mixer.loop}
          hasTracks={mixer.tracks.length > 0}
          tracks={mixer.tracks}
          loading={mixer.loading}
          master={mixer.master}
          playlistCount={playlistTracks.length}
          activePlaylistIndex={activePlaylistIndex}
          onMasterUpdate={mixer.updateMaster}
          onPlay={handleTransportPlay}
          onPause={mixer.pause}
          onStop={mixer.stop}
          onPrevious={() => handlePlaylistStep(-1, mixer.playing)}
          onNext={() => handlePlaylistStep(1, mixer.playing)}
          onClearLoop={() => mixer.setLoop(null)}
        />
      </div>
    </div>
  );
}
