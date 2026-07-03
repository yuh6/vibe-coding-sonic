function fmt(t) {
  if (!Number.isFinite(t)) return '0:00';
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TransportBar({ playing, time, duration, loop, hasTracks, onPlay, onPause, onStop, onClearLoop }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={playing ? onPause : onPlay}
          disabled={!hasTracks}
          className="pad flex h-10 w-10 items-center justify-center text-lg disabled:opacity-40"
          aria-label={playing ? '暂停' : '播放'}
        >
          {playing ? '⏸' : '▶️'}
        </button>
        <button
          type="button"
          onClick={onStop}
          disabled={!hasTracks}
          className="pad flex h-10 w-10 items-center justify-center text-lg disabled:opacity-40"
          aria-label="停止"
        >
          ⏹
        </button>
      </div>

      <div className="led-display rounded-lg border border-theme bg-led-panel px-3 py-1.5 font-mono text-sm text-theme">
        {fmt(time)} <span className="text-faint">/ {fmt(duration)}</span>
      </div>

      {loop && (
        <button
          type="button"
          onClick={onClearLoop}
          className="btn-ghost rounded-lg px-2.5 py-1.5 font-mono text-[10px]"
          title="点击取消循环"
        >
          🔁 {fmt(loop.start)}–{fmt(loop.end)} ×
        </button>
      )}

      <span className="text-[10px] text-faint">波形上点击定位 · 拖拽框选循环</span>
    </div>
  );
}
