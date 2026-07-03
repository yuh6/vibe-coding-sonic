const STYLE_AXES = [
  { key: 'energy', leftLabel: 'CHILL', rightLabel: 'HYPE', from: '#0ea5e9', to: '#f43f5e' },
  { key: 'texture', leftLabel: 'SYNTH', rightLabel: 'ACOUSTIC', from: '#8b5cf6', to: '#84cc16' },
  { key: 'brightness', leftLabel: 'DARK', rightLabel: 'BRIGHT', from: '#334155', to: '#fbbf24' },
];

export default function StyleFaders({ style, onStyleChange }) {
  return (
    <div className="glass rounded-2xl p-4">
      <span className="deck-label">Style FX</span>
      <div className="mt-3 space-y-3">
        {STYLE_AXES.map((axis) => (
          <div key={axis.key}>
            <div className="mb-1 flex items-center justify-between font-mono text-[9px] tracking-widest text-faint">
              <span>{axis.leftLabel}</span>
              <span className="text-muted">{style[axis.key]}</span>
              <span>{axis.rightLabel}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={style[axis.key]}
              onChange={(e) => onStyleChange({ ...style, [axis.key]: Number(e.target.value) })}
              className="fader"
              style={{
                '--fader-from': axis.from,
                '--fader-to': axis.to,
                '--fader-glow': `${axis.to}66`,
              }}
              aria-label={`${axis.leftLabel} / ${axis.rightLabel}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
