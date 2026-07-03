import LevelMeter from './LevelMeter';

export default function MasterStrip({ engine, master, onUpdate }) {
  return (
    <div className="glass flex w-[110px] shrink-0 flex-col items-center gap-2 rounded-xl border-2 px-2 py-3"
      style={{ borderColor: 'var(--border-strong)' }}>
      <span className="font-display text-[11px] font-bold text-theme">MASTER</span>

      <div className="flex items-end gap-1.5">
        <LevelMeter getLevel={() => engine.getMasterLevel()} className="h-[132px] w-3" />
      </div>

      <button
        type="button"
        onClick={() => onUpdate({ limiter: !master.limiter })}
        className={`w-full rounded-md py-1 font-mono text-[9px] font-bold transition ${
          master.limiter ? 'bg-emerald-500 text-white' : 'btn-ghost'
        }`}
        title="限制器：防止总线过载"
      >
        LIMIT
      </button>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={master.volume}
        onChange={(e) => onUpdate({ volume: Number(e.target.value) })}
        className="fader w-full"
        style={{ '--fader-from': '#4ade80', '--fader-to': '#a3e635', '--fader-glow': 'rgba(74,222,128,0.4)' }}
        aria-label="主音量"
      />
      <span className="font-mono text-[9px] text-subtle">{Math.round(master.volume * 100)}%</span>
    </div>
  );
}
