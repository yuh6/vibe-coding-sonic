import { useMemo } from 'react';

export default function Knob({ label, value, min, max, onChange, format, color = '#6366f1' }) {
  const percent = (value - min) / (max - min);
  const angle = -135 + percent * 270;
  const display = useMemo(() => (format ? format(value) : value.toFixed(1)), [format, value]);

  return (
    <label className="flex flex-col items-center gap-1">
      <span className="font-mono text-[8px] tracking-widest text-white/35">{label}</span>
      <span
        className="relative h-9 w-9 rounded-full border border-white/10 bg-black/40 shadow-inner"
        style={{ boxShadow: `inset 0 0 14px rgba(0,0,0,0.55), 0 0 10px ${color}30` }}
      >
        <span
          className="absolute left-1/2 top-1/2 h-3.5 w-0.5 origin-bottom -translate-x-1/2 -translate-y-full rounded-full"
          style={{ background: color, transform: `translate(-50%, -100%) rotate(${angle}deg)` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step="0.1"
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </span>
      <span className="font-mono text-[8px] text-white/45">{display}</span>
    </label>
  );
}
