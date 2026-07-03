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
  const statusColor =
    busy ? '#facc15' : playing ? '#4ade80' : 'rgba(255,255,255,0.35)';

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Main Deck</span>
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest" style={{ color: statusColor }}>
          <span className={`led-dot ${busy ? 'animate-pulse' : ''}`} style={{ color: statusColor }} />
          {STATUS_LABEL[status] || status}
          {fallback && <span className="text-amber-400/80">· CACHED</span>}
        </div>
      </div>

      {/* LED 面板 */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-center">
          <div className="font-mono text-[9px] tracking-widest text-white/35">BPM</div>
          <div className="led-display text-2xl font-bold" style={{ color: theme.glow }}>
            {bpm || '--'}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-center">
          <div className="font-mono text-[9px] tracking-widest text-white/35">TYPE</div>
          <div className="led-display text-2xl font-bold" style={{ color: theme.glow }}>
            {mbti}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-center">
          <div className="font-mono text-[9px] tracking-widest text-white/35">MODE</div>
          <div className="led-display text-2xl font-bold uppercase" style={{ color: theme.glow }}>
            {mode}
          </div>
        </div>
      </div>

      <div className="mb-3">
        <AudioVisualizer playing={playing} theme={theme} />
      </div>

      <div className="mb-3 flex items-center gap-3">
        {/* 转盘 */}
        <div
          className={`relative flex h-16 w-16 flex-none items-center justify-center rounded-full border-4 border-black/60 bg-gradient-to-br from-slate-700 to-slate-900 shadow-lg ${
            playing ? 'spin-vinyl' : ''
          }`}
          style={{ boxShadow: `0 0 20px ${theme.accent}44` }}
          aria-hidden="true"
        >
          <div className="h-4 w-4 rounded-full" style={{ backgroundColor: theme.accent }} />
          <div className="absolute top-1 h-2 w-0.5 bg-white/60" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base font-semibold">
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
              <div className="mb-0.5 font-mono text-[9px] tracking-widest text-white/35">VOLUME</div>
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
        className="w-full rounded-xl py-3.5 font-display text-sm font-bold tracking-wider transition active:scale-[0.98] disabled:opacity-50"
        style={{
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.glow})`,
          color: '#fff',
          boxShadow: `0 4px 24px ${theme.accent}55`,
        }}
      >
        {generating ? '◉ GENERATING...' : '⏻ DROP THE BEAT'}
      </button>
    </div>
  );
}
