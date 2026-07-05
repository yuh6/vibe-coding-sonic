import AudioVisualizer from './AudioVisualizer';

const STATUS_LABEL = {
  idle: 'STANDBY',
  processing: 'GENERATING',
  splitting: 'SPLITTING STEMS',
  completed: 'ON AIR',
  failed: 'ERROR',
};

export default function PlayerDeck({
  playing,
  volume,
  muted,
  status,
  currentTitle,
  fallback,
  bpm,
  mbti,
  mode,
  theme,
  onTogglePlay,
  onVolumeChange,
  onToggleMute,
  onGenerate,
  generating,
}) {
  const busy = status === 'processing' || status === 'splitting';
  const statusColor = busy ? '#facc15' : playing ? '#4ade80' : undefined;

  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4">
      <img
        src="/player.gif"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/45"></div>
      <div className="relative z-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Main Deck</span>
        <div
          className={`flex items-center gap-2 font-mono text-[10px] tracking-widest ${!statusColor ? 'text-faint' : ''}`}
          style={statusColor ? { color: statusColor } : undefined}
        >
          <span
            className={`led-dot ${busy ? 'animate-pulse' : ''}`}
            style={{ color: statusColor || 'currentColor' }}
          />
          {STATUS_LABEL[status] || status}
          {fallback && <span className="text-amber-500">· CACHED</span>}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        {['BPM', 'TYPE', 'MODE'].map((label, i) => (
          <div key={label} className="rounded-xl border border-theme bg-led-panel px-3 py-2 text-center">
            <div className="font-mono text-[9px] tracking-widest text-faint">{label}</div>
            <div
              className={`led-display text-2xl font-bold ${i === 2 ? 'uppercase' : ''}`}
              style={{ color: theme.glow }}
            >
              {i === 0 ? bpm || '--' : i === 1 ? mbti : mode}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3">
        <AudioVisualizer playing={playing} theme={theme} />
      </div>

      <div className="mb-3 flex items-center gap-3">
        <div
          className={`vinyl-disc relative flex h-16 w-16 flex-none items-center justify-center rounded-full shadow-lg ${
            playing ? 'spin-vinyl' : ''
          }`}
          style={{ boxShadow: `0 0 20px ${theme.accent}44` }}
          aria-hidden="true"
        >
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: theme.accent }} />
          <div className="absolute top-1 h-2 w-0.5 bg-chip" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-semibold text-theme">
            {currentTitle || '等待播放'}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className="pad flex h-11 w-11 items-center justify-center text-lg"
              style={{ '--pad-glow': `${theme.accent}66` }}
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? '⏸' : '▶'}
            </button>
            <button
              type="button"
              onClick={onToggleMute}
              className="pad flex h-11 w-11 items-center justify-center text-lg"
              aria-label={muted ? '取消静音' : '静音'}
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <div className="ml-1 flex-1">
              <div className="mb-0.5 font-mono text-[9px] tracking-widest text-faint">VOLUME</div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="fader"
                style={{
                  '--fader-from': '#334155',
                  '--fader-to': theme.accent,
                  '--fader-glow': `${theme.accent}66`,
                }}
                aria-label="音量"
              />
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="w-full rounded-full py-3.5 font-display text-sm font-extrabold uppercase tracking-wider text-white transition-all hover:scale-[1.03] active:scale-[0.97] disabled:opacity-50 disabled:hover:scale-100"
        style={{
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.glow})`,
          boxShadow: `0 4px 24px ${theme.accent}55`,
        }}
      >
        {generating ? '◉ GENERATING...' : '⏻ DROP THE BEAT'}
      </button>
      </div>
    </div>
  );
}
