import Knob from './Knob';
import LevelMeter from './LevelMeter';

const fmtDb = (v) => `${v > 0 ? '+' : ''}${v.toFixed(0)}dB`;
const fmtPan = (v) => (Math.abs(v) < 0.05 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`);

export default function ChannelStrip({ track, engine, onUpdate, onRemove }) {
  const { state } = track;

  return (
    <div className="glass flex min-w-[96px] flex-1 flex-col items-center gap-2 rounded-xl px-2 py-3">
      <div className="flex w-full items-center justify-between gap-1">
        <span
          className="truncate font-display text-[11px] font-bold"
          style={{ color: track.color }}
          title={track.name}
        >
          {track.name}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-faint transition hover:text-red-400"
          aria-label={`移除 ${track.name}`}
        >
          ×
        </button>
      </div>

      <div className="flex items-end gap-1.5">
        <div className="flex flex-col gap-1.5">
          <Knob label="HIGH" value={state.eq.high} min={-12} max={12} format={fmtDb} color={track.color}
            onChange={(v) => onUpdate({ eq: { high: v } })} />
          <Knob label="MID" value={state.eq.mid} min={-12} max={12} format={fmtDb} color={track.color}
            onChange={(v) => onUpdate({ eq: { mid: v } })} />
          <Knob label="LOW" value={state.eq.low} min={-12} max={12} format={fmtDb} color={track.color}
            onChange={(v) => onUpdate({ eq: { low: v } })} />
        </div>
        <LevelMeter getLevel={() => engine.getTrackLevel(track.id)} className="h-[132px]" />
      </div>

      <Knob label="PAN" value={state.pan} min={-1} max={1} format={fmtPan} color={track.color}
        onChange={(v) => onUpdate({ pan: v })} />

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={state.volume}
        onChange={(e) => onUpdate({ volume: Number(e.target.value) })}
        className="fader w-full"
        style={{ '--fader-from': track.color, '--fader-to': track.color, '--fader-glow': `${track.color}66` }}
        aria-label={`${track.name} 音量`}
      />

      <div className="flex w-full gap-1">
        <button
          type="button"
          onClick={() => onUpdate({ muted: !state.muted })}
          className={`flex-1 rounded-md py-1 font-mono text-[9px] font-bold transition ${
            state.muted ? 'bg-red-500 text-white' : 'btn-ghost'
          }`}
        >
          M
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ solo: !state.solo })}
          className={`flex-1 rounded-md py-1 font-mono text-[9px] font-bold transition ${
            state.solo ? 'bg-amber-400 text-black' : 'btn-ghost'
          }`}
        >
          S
        </button>
        <button
          type="button"
          onClick={() => onUpdate({ compressor: !state.compressor })}
          className={`flex-1 rounded-md py-1 font-mono text-[9px] font-bold transition ${
            state.compressor ? 'bg-sky-500 text-white' : 'btn-ghost'
          }`}
          title="压缩器"
        >
          C
        </button>
      </div>
    </div>
  );
}
