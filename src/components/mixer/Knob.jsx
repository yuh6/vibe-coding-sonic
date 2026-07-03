import { useCallback, useRef } from 'react';

// 旋钮：垂直拖动调值，双击复位
export default function Knob({ label, value, min, max, defaultValue = 0, onChange, format, color }) {
  const dragRef = useRef(null);

  const startDrag = useCallback(
    (e) => {
      e.preventDefault();
      const startY = e.clientY ?? e.touches?.[0]?.clientY;
      const startValue = value;
      const range = max - min;

      const move = (ev) => {
        const y = ev.clientY ?? ev.touches?.[0]?.clientY;
        const next = Math.max(min, Math.min(max, startValue + ((startY - y) / 120) * range));
        onChange(next);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [value, min, max, onChange]
  );

  const ratio = (value - min) / (max - min);
  const angle = -135 + ratio * 270;

  return (
    <div className="flex flex-col items-center gap-0.5 select-none">
      <div
        ref={dragRef}
        onPointerDown={startDrag}
        onDoubleClick={() => onChange(defaultValue)}
        className="relative h-9 w-9 cursor-ns-resize rounded-full border border-theme bg-led-panel"
        style={{ boxShadow: `0 0 8px ${color || 'transparent'}22` }}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value * 100) / 100}
      >
        <div
          className="absolute left-1/2 top-1/2 h-3.5 w-0.5 origin-bottom rounded"
          style={{
            background: color || 'var(--text-primary)',
            transform: `translate(-50%, -100%) rotate(${angle}deg)`,
            transformOrigin: '50% 100%',
          }}
        />
      </div>
      <span className="font-mono text-[8px] tracking-wider text-faint">{label}</span>
      <span className="font-mono text-[9px] text-subtle">{format ? format(value) : value}</span>
    </div>
  );
}
