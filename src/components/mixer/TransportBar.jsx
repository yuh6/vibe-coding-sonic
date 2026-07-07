import { Pause, Play, Repeat, RotateCcw, SkipBack, SkipForward, Square, Volume2 } from 'lucide-react';

function fmt(time) {
  if (!Number.isFinite(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function TransportBar({
  playing,
  time,
  duration,
  loop,
  hasTracks,
  tracks = [],
  loading = false,
  master,
  playlistCount = 0,
  activePlaylistIndex = -1,
  onMasterUpdate,
  onPlay,
  onPause,
  onStop,
  onPrevious,
  onNext,
  onClearLoop,
}) {
  const progress = duration > 0 ? Math.max(0, Math.min(100, (time / duration) * 100)) : 0;
  const activeTrack = tracks[0];
  const title = activeTrack?.name || (loading ? 'Loading audio' : 'No track loaded');
  const canStepPlaylist = playlistCount > 0;

  return (
    <div className="mixer-transport">
      <div className="mixer-transport-track min-w-0">
        <div className="mixer-transport-cover" style={{ '--track-color': activeTrack?.color || '#34d399' }}>
          <span />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-white" title={title}>{title}</div>
          <div className="truncate font-mono text-[10px] text-white/40">
            {tracks.length
              ? `Playlist loop ${activePlaylistIndex + 1 || 1}/${playlistCount || 1}`
              : playlistCount
                ? `Playlist loop ready · ${playlistCount} tracks`
                : 'Load a track from Library'}
          </div>
        </div>
      </div>

      <div className="mixer-transport-center">
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={onPrevious} className="mixer-icon-button" disabled={!canStepPlaylist} aria-label="Previous">
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={playing ? onPause : onPlay}
            disabled={!hasTracks && !playlistCount}
            className="mixer-play-button"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause className="h-5 w-5 fill-current" /> : <Play className="ml-0.5 h-5 w-5 fill-current" />}
          </button>
          <button type="button" onClick={onNext} className="mixer-icon-button" disabled={!canStepPlaylist} aria-label="Next">
            <SkipForward className="h-4 w-4" />
          </button>
          <button type="button" onClick={onStop} className="mixer-icon-button" disabled={!hasTracks} aria-label="Stop">
            <Square className="h-3.5 w-3.5 fill-current" />
          </button>
          <button
            type="button"
            onClick={onClearLoop}
            className={`mixer-icon-button ${loop || playlistCount ? 'is-active' : ''}`}
            disabled={!loop && !playlistCount}
            title={loop ? `Clear loop ${fmt(loop.start)}-${fmt(loop.end)}` : 'Playlist loop is on by default'}
            aria-label="Clear loop"
          >
            {loop ? <RotateCcw className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
          </button>
        </div>

        <div className="mixer-progress-row">
          <span>{fmt(time)}</span>
          <div className="mixer-progress-track" aria-label="Playback progress">
            <div style={{ width: `${progress}%` }} />
          </div>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      <div className="mixer-transport-tools">
        <Volume2 className="h-4 w-4 text-white/55" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={master?.volume ?? 0.85}
          onChange={(event) => onMasterUpdate?.({ volume: Number(event.target.value) })}
          className="mixer-volume"
          aria-label="Master volume"
        />
      </div>
    </div>
  );
}
