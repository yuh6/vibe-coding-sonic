import { useEffect, useMemo, useRef, useState } from 'react';
import { useMixer } from '../../hooks/useMixer';
import TransportBar from './TransportBar';
import NowPlayingInspector, { UserPlaylistPanel } from './NowPlayingInspector';
import StyleFaders from '../StyleFaders';
import { AXES, getTheme, mbtiFromAxes } from '../../lib/mbti';
import { generateMusic, getMusicStatus, startRadio, stopRadio, updateRadioNowPlaying } from '../../lib/api';

const SAMPLE_TRACKS = [
  { id: 'sample-rain-receipts', name: 'Rain on Receipts', url: '/samples/fallback-focus-a.mp3', type: 'stem' },
  { id: 'sample-midnight-ticket', name: 'Midnight Train Ticket', url: '/samples/fallback-brainstorm-a.mp3', type: 'stem' },
  { id: 'sample-record-skip', name: 'Midnight Record Skip', url: '/samples/fallback-sprint-a.mp3', type: 'stem' },
  { id: 'sample-istj-brainstorm', name: 'ISTJ-brainstorm', url: '/samples/fallback-personality-istj-a.mp3', type: 'stem' },
];

const SAVED_LISTS_KEY = 'vibe-mixer-saved-lists';
const PLAYBACK_MODES = ['list-loop', 'track-loop', 'shuffle', 'sequential'];

const AI_DJ_STARTER = [
  { role: 'assistant', text: '告诉我想要的氛围、场景、BPM 或参考风格。我会按当前 MBTI、流派和 FX 参数编排到队列。' },
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function downloadUrl(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  }
}

export default function MixerPage({ incomingMix = null, user }) {
  const mixer = useMixer();
  const importedSignatureRef = useRef('');
  const importJobRef = useRef('');
  const playbackWasRunningRef = useRef(false);
  const selectRequestRef = useRef(0);
  const generatedSeqRef = useRef(0);
  const generateLockRef = useRef(false);
  const saveLockRef = useRef(false);
  const exportLockRef = useRef(false);
  const broadcastLockRef = useRef(false);
  const shareLockRef = useRef(false);
  const aiLockRef = useRef(false);
  const [axes, setAxes] = useState({ ie: 12, ns: 12, tf: 12, jp: 12 });
  const [style, setStyle] = useState({ energy: 52, texture: 35, brightness: 44 });
  const [genre, setGenre] = useState('');
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [playlistTracks, setPlaylistTracks] = useState(SAMPLE_TRACKS);
  const [activePlaylistIndex, setActivePlaylistIndex] = useState(-1);
  const [loadingQueueId, setLoadingQueueId] = useState('');
  const [generateBusy, setGenerateBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedQueueIds, setSelectedQueueIds] = useState(() => new Set());
  const [playMode, setPlayMode] = useState('list-loop');
  const [savedLists, setSavedLists] = useState(loadSavedLists);
  const [activeSavedListId, setActiveSavedListId] = useState('');
  const [aiMessages, setAiMessages] = useState(AI_DJ_STARTER);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [broadcastStation, setBroadcastStation] = useState(null);
  const [broadcastBusy, setBroadcastBusy] = useState(false);
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
    const importedTrack = {
      id: `import-${incomingMix.jobId}`,
      name: incomingMix.title || incomingTracks[0]?.name || 'Generated mix',
      url: incomingTracks[0]?.url,
      trackId: incomingMix.fallback ? null : incomingMix.jobId,
      type: incomingMix.fallback ? 'fallback mix' : 'generated mix',
      status: importStatusText(incomingMix),
      tracks: incomingTracks.map((track, index) => ({
        id: track.id || `import-${incomingMix.jobId}-${index}`,
        name: track.name || track.title || `Stem ${index + 1}`,
        url: track.url,
        type: track.type || 'stem',
      })),
    };
    setPlaylistTracks((prev) => {
      const withoutSameImport = prev.filter((track) => track.id !== importedTrack.id);
      return [importedTrack, ...withoutSameImport];
    });
    setActivePlaylistIndex(0);
    setSelectedTrack(importedTrack);
    setActiveSavedListId('');
  }, [incomingMix, incomingTracks, mixer.addTracks]);

  useEffect(() => {
    window.localStorage.setItem(SAVED_LISTS_KEY, JSON.stringify(savedLists));
  }, [savedLists]);

  const selectedGenreLabel = genre || 'Open genre';
  const promptTitle = `${mbti} ${selectedGenreLabel} mix`;
  const promptSummary = `${mbti} ${selectedGenreLabel} cue, energy ${style.energy}, texture ${style.texture}, brightness ${style.brightness}. Keep it useful for focused coding and smooth transitions.`;
  const activeQueueIndex = activePlaylistIndex >= 0 ? activePlaylistIndex : -1;
  const activeQueueTrack = activeQueueIndex >= 0 ? playlistTracks[activeQueueIndex] : null;
  const selectedQueueTracks = playlistTracks.filter((track) => selectedQueueIds.has(track.id || track.name));
  const exportTargets = selectedQueueTracks.length ? selectedQueueTracks : (activeQueueTrack ? [activeQueueTrack] : []);
  const shareUrl = broadcastStation?.id ? `${window.location.origin}/discover?radio=${encodeURIComponent(broadcastStation.id)}` : '';
  const makeLocalGeneratedTrack = (sourcePrompt = promptSummary, source = 'preview') => {
    const nextNumber = playlistTracks.length + 1;
    generatedSeqRef.current += 1;
    return {
      id: `generated-${Date.now()}-${generatedSeqRef.current}`,
      name: `${mbti} ${selectedGenreLabel} take ${String(nextNumber).padStart(2, '0')}`,
      url: style.energy > 66 ? '/samples/fallback-sprint-a.mp3' : style.brightness < 38 ? '/samples/fallback-focus-c.mp3' : '/samples/fallback-brainstorm-a.mp3',
      type: 'generated',
      status: source === 'ai' ? 'AI DJ queued' : 'queued from preview',
      prompt: sourcePrompt,
    };
  };
  const cyclePlayMode = () => {
    setPlayMode((mode) => {
      const current = PLAYBACK_MODES.indexOf(mode);
      return PLAYBACK_MODES[(current + 1) % PLAYBACK_MODES.length] || 'list-loop';
    });
  };
  const resolveStepIndex = (direction) => {
    if (!playlistTracks.length) return null;
    const current = activePlaylistIndex >= 0 ? activePlaylistIndex : 0;
    if (playMode === 'track-loop') return current;
    if (playMode === 'shuffle') {
      if (playlistTracks.length === 1) return 0;
      let next = current;
      while (next === current) next = Math.floor(Math.random() * playlistTracks.length);
      return next;
    }
    const next = current + direction;
    if (playMode === 'sequential') {
      if (next < 0 || next >= playlistTracks.length) return null;
      return next;
    }
    return (next + playlistTracks.length) % playlistTracks.length;
  };
  const handleSelectTrack = async (track, index = -1, autoplay = false) => {
    const requestId = selectRequestRef.current + 1;
    selectRequestRef.current = requestId;
    const queueId = track.id || track.name || `${index}`;
    setLoadingQueueId(queueId);
    const deckTracks = (Array.isArray(track.tracks) && track.tracks.length ? track.tracks : [track])
      .filter((item) => item?.url)
      .map((item, itemIndex) => ({
        name: item.title || item.name || `${track.name || 'Track'} ${itemIndex + 1}`,
        url: item.url,
        type: item.type || 'stem',
      }));
    if (deckTracks.length === 0) {
      setLoadingQueueId('');
      return;
    }
    const nextTrack = {
      name: track.title || track.name || deckTracks[0].name,
      url: deckTracks[0].url,
      type: track.type || deckTracks[0].type || 'stem',
    };
    const shouldPlay = autoplay || mixer.playing;
    setSelectedTrack(nextTrack);
    setActivePlaylistIndex(index);
    try {
      await mixer.addTracks(deckTracks, { replace: true });
      if (selectRequestRef.current !== requestId) return;
      if (shouldPlay) await mixer.play();
    } finally {
      if (selectRequestRef.current === requestId) setLoadingQueueId('');
    }
  };
  const handlePlaylistStep = (direction, autoplay = mixer.playing) => {
    if (!playlistTracks.length) return;
    const nextIndex = resolveStepIndex(direction);
    if (nextIndex == null) {
      mixer.stop();
      return;
    }
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
    if (generateLockRef.current) return;
    generateLockRef.current = true;
    setGenerateBusy(true);
    setPlaylistTracks((prev) => [...prev, makeLocalGeneratedTrack()]);
    setActiveSavedListId('');
    setActionMessage('Generated preview queued.');
    window.setTimeout(() => {
      generateLockRef.current = false;
      setGenerateBusy(false);
    }, 450);
  };
  const toggleSelectionMode = () => {
    setSelectionMode((enabled) => {
      const next = !enabled;
      if (!next) setSelectedQueueIds(new Set());
      return next;
    });
  };
  const toggleQueueSelection = (id) => {
    setSelectedQueueIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const removeSelectedFromQueue = () => {
    if (selectedQueueIds.size === 0) return;
    setPlaylistTracks((prev) => prev.filter((track) => !selectedQueueIds.has(track.id || track.name)));
    if (activeQueueTrack && selectedQueueIds.has(activeQueueTrack.id || activeQueueTrack.name)) {
      mixer.clear();
      setActivePlaylistIndex(-1);
      setSelectedTrack(null);
    } else if (activePlaylistIndex >= 0) {
      const removedBeforeActive = playlistTracks
        .slice(0, activePlaylistIndex)
        .filter((track) => selectedQueueIds.has(track.id || track.name)).length;
      setActivePlaylistIndex(Math.max(0, activePlaylistIndex - removedBeforeActive));
    }
    setSelectedQueueIds(new Set());
    setSelectionMode(false);
    setActiveSavedListId('');
    setActionMessage('Selected tracks removed from this queue. Source files were kept.');
  };
  const handleSaveList = () => {
    if (!playlistTracks.length || saveLockRef.current) return;
    saveLockRef.current = true;
    setSaveBusy(true);
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
    setActionMessage(`Saved local list: ${savedList.name}`);
    window.setTimeout(() => {
      saveLockRef.current = false;
      setSaveBusy(false);
    }, 600);
  };
  const handleLoadList = (list) => {
    setPlaylistTracks(list.tracks || []);
    setActiveSavedListId(list.id);
    setActivePlaylistIndex(-1);
    setSelectedTrack(null);
    setSelectionMode(false);
    setSelectedQueueIds(new Set());
    mixer.clear();
  };
  const handleDeleteList = (listId) => {
    setSavedLists((prev) => prev.filter((list) => list.id !== listId));
    if (activeSavedListId === listId) setActiveSavedListId('');
  };
  const handleExportSelected = () => {
    if (exportLockRef.current) return;
    if (!exportTargets.length) {
      setActionMessage('Select up to 10 queue tracks before exporting.');
      return;
    }
    if (exportTargets.length > 10) {
      setActionMessage('Export is limited to 10 tracks at a time.');
      return;
    }
    exportLockRef.current = true;
    setExportBusy(true);
    let downloaded = 0;
    exportTargets.forEach((track, index) => {
      const exportUrl = track?.url || track?.tracks?.find((item) => item?.url)?.url;
      if (!exportUrl) return;
      const safeName = String(track.name || track.title || `mixer-track-${index + 1}`).replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '') || `mixer-track-${index + 1}`;
      downloadUrl(exportUrl, `${safeName}.mp3`);
      downloaded += 1;
    });
    setActionMessage(downloaded ? `Downloading ${downloaded} track${downloaded === 1 ? '' : 's'}.` : 'Selected tracks have no downloadable audio.');
    window.setTimeout(() => {
      exportLockRef.current = false;
      setExportBusy(false);
    }, 900);
  };
  const handleBroadcast = async () => {
    if (!playlistTracks.length || broadcastLockRef.current) return;
    broadcastLockRef.current = true;
    if (broadcastStation?.id) {
      setBroadcastBusy(true);
      try {
        await stopRadio(broadcastStation.id);
        setBroadcastStation(null);
        setActionMessage('Broadcast stopped.');
      } catch (err) {
        setActionMessage(err.message || 'Failed to stop broadcast.');
      } finally {
        setBroadcastBusy(false);
        broadcastLockRef.current = false;
      }
      return;
    }
    const track = activeQueueTrack || playlistTracks[0];
    const audioUrl = track?.url || track?.tracks?.find((item) => item?.url)?.url;
    if (!audioUrl) {
      setActionMessage('Current queue has no playable audio to broadcast.');
      broadcastLockRef.current = false;
      return;
    }
    setBroadcastBusy(true);
    setActionMessage('');
    try {
      const station = broadcastStation || await startRadio({
        title: `${user?.name || user?.email || 'AI DJ'} queue`,
        description: `${playlistTracks.length} tracks from mixer queue`,
        sessionId: null,
        mode: 'mixer',
        mbti,
      });
      setBroadcastStation(station);
      await updateRadioNowPlaying(station.id, {
        title: track.name || track.title || 'Mixer queue track',
        audioUrl,
        genre: selectedGenreLabel,
      });
      setActionMessage(`Broadcast live: ${station.title}`);
    } catch (err) {
      if (err.status === 401) {
        setActionMessage('Login required to broadcast this queue.');
      } else {
        setActionMessage(err.message || 'Broadcast failed.');
      }
    } finally {
      setBroadcastBusy(false);
      broadcastLockRef.current = false;
    }
  };
  const handleShareBroadcast = async () => {
    if (!shareUrl || shareLockRef.current) return;
    shareLockRef.current = true;
    setShareBusy(true);
    if (await copyText(shareUrl)) {
      setActionMessage('Room link copied.');
    } else {
      setActionMessage(shareUrl);
    }
    window.setTimeout(() => {
      shareLockRef.current = false;
      setShareBusy(false);
    }, 650);
  };
  const handleAiSubmit = async (event) => {
    event.preventDefault();
    const request = aiInput.trim();
    if (!request || aiBusy || aiLockRef.current) return;
    aiLockRef.current = true;
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', text: request }, { role: 'assistant', text: '收到，正在按当前人格、流派和 FX 参数编排生成...' }]);
    setAiBusy(true);
    try {
      const job = await generateMusic({
        axes,
        mode: 'focus',
        projectAnalysis: { name: 'AI DJ request', description: request },
        style,
        selectedGenre: genre || undefined,
        vocals: { enabled: false },
        splitStems: false,
      });
      let result = job;
      if (job?.jobId) {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          await wait(1600);
          result = await getMusicStatus(job.jobId);
          if (result.status === 'completed' || result.status === 'failed') break;
        }
      }
      const resultTracks = (result?.tracks || []).filter((track) => track?.url);
      const audioUrl = resultTracks[0]?.url || result?.audioUrl;
      const generated = audioUrl ? {
        id: `ai-${result.jobId || Date.now()}`,
        name: result.title || `${mbti} AI DJ take`,
        url: audioUrl,
        trackId: result.fallback ? null : result.jobId,
        type: result.fallback ? 'fallback mix' : 'AI generated',
        status: result.status === 'completed' ? 'generated by AI DJ' : 'queued by AI DJ',
        prompt: request,
        tracks: resultTracks.length ? resultTracks : undefined,
      } : makeLocalGeneratedTrack(request, 'ai');
      setPlaylistTracks((prev) => [...prev, generated]);
      setActiveSavedListId('');
      setAiMessages((prev) => [...prev, { role: 'assistant', text: `已加入队列: ${generated.name}` }]);
    } catch (err) {
      const fallback = makeLocalGeneratedTrack(request, 'ai');
      setPlaylistTracks((prev) => [...prev, fallback]);
      setAiMessages((prev) => [
        ...prev,
        { role: 'assistant', text: err.status === 401 ? '需要登录才能真实生成。已先按你的描述放入本地试听队列。' : '生成服务暂时不可用，已先放入本地试听队列。' },
      ]);
    } finally {
      setAiBusy(false);
      aiLockRef.current = false;
    }
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
  }, [mixer.playing, mixer.time, mixer.duration, playlistTracks.length, playMode]);

  useEffect(() => {
    if (!broadcastStation?.id || !activeQueueTrack) return;
    const audioUrl = activeQueueTrack.url || activeQueueTrack.tracks?.find((track) => track?.url)?.url;
    if (!audioUrl) return;
    updateRadioNowPlaying(broadcastStation.id, {
      title: activeQueueTrack.name || activeQueueTrack.title || 'Mixer queue track',
      audioUrl,
      genre: selectedGenreLabel,
    }).catch(() => {});
  }, [broadcastStation?.id, activeQueueTrack, selectedGenreLabel]);

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
          <div className="mixer-now-copy min-w-0">
            <p className="mixer-kicker">Prompt preview</p>
            <h1 className="line-clamp-2 font-display text-3xl font-black tracking-tight text-white xl:text-4xl" title={promptTitle}>
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
          <button type="button" onClick={handleGenerateTrack} disabled={generateBusy} className="mixer-generate-button">
            <span>{generateBusy ? 'Queued' : 'Generate'}</span>
            <small>{generateBusy ? 'ready in list' : 'queue to playlist'}</small>
          </button>
        </section>

        <section className="mixer-panel mixer-ai-dj-panel">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <span className="mixer-kicker">AI DJ</span>
              <h2 className="mt-1 text-xl font-black tracking-tight text-white">Talk to DJ</h2>
            </div>
            {aiBusy && <span className="font-mono text-[10px] text-amber-300">GENERATING</span>}
          </div>
          <div className="mixer-ai-chat-log">
            {aiMessages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`mixer-ai-message is-${message.role}`}>
                {message.text}
              </div>
            ))}
          </div>
          <form className="mixer-ai-chat-form" onSubmit={handleAiSubmit}>
            <input
              value={aiInput}
              onChange={(event) => setAiInput(event.target.value)}
              placeholder="例如：给我一首适合凌晨写代码的低速 synthwave，保留一点紧张感"
              disabled={aiBusy}
            />
            <button type="submit" disabled={aiBusy || !aiInput.trim()}>
              {aiBusy ? 'Working' : 'Send'}
            </button>
          </form>
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
              <button key={item.title} type="button" onClick={() => handleSelectTrack(item)} disabled={Boolean(loadingQueueId)} className="mixer-collection-card">
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
        actionMessage={actionMessage}
        actionBusy={broadcastBusy || exportBusy || shareBusy}
        canExport={exportTargets.length > 0}
        canBroadcast={playlistTracks.length > 0}
        broadcastLabel={broadcastStation ? 'Live' : 'Broadcast'}
        isBroadcasting={Boolean(broadcastStation)}
        canShare={Boolean(shareUrl)}
        onExport={handleExportSelected}
        onBroadcast={handleBroadcast}
        onShare={handleShareBroadcast}
      >
        <UserPlaylistPanel
          user={user}
          playlistTracks={playlistTracks}
          activeIndex={activePlaylistIndex}
          selectedIds={selectedQueueIds}
          selectionMode={selectionMode}
          savedLists={savedLists}
          activeSavedListId={activeSavedListId}
          busy={Boolean(loadingQueueId)}
          saveBusy={saveBusy}
          canSave={playlistTracks.length > 0}
          loadingTrackId={loadingQueueId}
          onAddTrack={handleSelectTrack}
          onToggleSelection={toggleQueueSelection}
          onToggleSelectionMode={toggleSelectionMode}
          onRemoveSelected={removeSelectedFromQueue}
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
          busy={mixer.loading || Boolean(loadingQueueId)}
          master={mixer.master}
          playlistCount={playlistTracks.length}
          activePlaylistIndex={activePlaylistIndex}
          playMode={playMode}
          onMasterUpdate={mixer.updateMaster}
          onPlay={handleTransportPlay}
          onPause={mixer.pause}
          onStop={mixer.stop}
          onPrevious={() => handlePlaylistStep(-1, mixer.playing)}
          onNext={() => handlePlaylistStep(1, mixer.playing)}
          onCyclePlayMode={cyclePlayMode}
        />
      </div>
    </div>
  );
}
