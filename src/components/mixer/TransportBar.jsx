function fmt(time) {
  if (!Number.isFinite(time)) return '0:00';
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function TransportBar({ playing, time, duration, loop, hasTracks, onPlay, onPause, onStop, onClearLoop }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          disabled={!hasTracks}
          className="pad flex h-10 w-10 items-center justify-center text-lg disabled:opacity-40"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!hasTracks}
          className="pad flex h-10 w-12 items-center justify-center text-xs disabled:opacity-40"
          aria-label="Stop"
        >
          Stop
        </button>
      </div>

      <div className="led-display rounded-lg border border-white/10 bg-black/50 px-3 py-1.5 font-mono text-sm text-emerald-300">
        {fmt(time)} <span className="text-white/35">/ {fmt(duration)}</span>
      </div>

      {loop && (
        <button
          type="button"
          onClick={onClearLoop}
          className="btn-ghost rounded-lg px-2.5 py-1.5 font-mono text-[10px]"
          title="Clear loop"
        >
          Loop {fmt(loop.start)}-{fmt(loop.end)} x
        </button>
      )}

      <span className="min-w-0 truncate text-[10px] text-white/35">Click waveform to seek. Drag to loop.</span>
    </div>
  );
}
