import { useState } from 'react';
import { AXES, MBTI_TYPES, mbtiFromAxes, getTheme } from '../lib/mbti';

function AxisFader({ axis, value, onChange, theme }) {
  const leaning = value < 50 ? axis.left : axis.right;
  const strength = Math.round(Math.abs(value - 50) * 2);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className={`font-display font-bold ${value < 50 ? 'text-white' : 'text-white/30'}`}>
          {axis.left}
          <span className="ml-1 text-[9px] font-normal text-white/40">{axis.leftLabel}</span>
        </span>
        <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
          {leaning} {strength}%
        </span>
        <span className={`font-display font-bold ${value >= 50 ? 'text-white' : 'text-white/30'}`}>
          <span className="mr-1 text-[9px] font-normal text-white/40">{axis.rightLabel}</span>
          {axis.right}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={value}
        onChange={(e) => onChange(axis.key, Number(e.target.value))}
        className="fader"
        style={{
          '--fader-from': theme.primary,
          '--fader-to': theme.accent,
          '--fader-glow': `${theme.accent}88`,
        }}
        aria-label={`${axis.left}/${axis.right} 比例`}
      />
    </div>
  );
}

export default function MBTIRemixDeck({ axes, onAxesChange, theme }) {
  const [showGrid, setShowGrid] = useState(false);
  const currentType = mbtiFromAxes(axes);

  const handleAxis = (key, value) => {
    onAxesChange({ ...axes, [key]: value });
  };

  const handleQuickPick = (type) => {
    const t = type.toUpperCase();
    onAxesChange({
      ie: t[0] === 'I' ? 12 : 88,
      ns: t[1] === 'N' ? 12 : 88,
      tf: t[2] === 'T' ? 12 : 88,
      jp: t[3] === 'J' ? 12 : 88,
    });
    setShowGrid(false);
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">MBTI Remix</span>
        <button
          type="button"
          onClick={() => setShowGrid((s) => !s)}
          className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          {showGrid ? '收起' : '快速选择'}
        </button>
      </div>

      <div
        className="led-display mb-4 rounded-xl border border-white/10 bg-black/50 py-3 text-center text-4xl font-bold"
        style={{ color: theme.glow }}
      >
        {currentType}
      </div>

      {showGrid && (
        <div className="mb-4 grid grid-cols-4 gap-1.5">
          {MBTI_TYPES.map((type) => {
            const t = getTheme(type);
            const active = type === currentType;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleQuickPick(type)}
                className={`pad py-1.5 font-display text-xs font-semibold ${active ? 'pad-active' : ''}`}
                style={active ? { '--pad-glow': `${t.accent}66`, color: t.glow } : { color: 'rgba(255,255,255,0.6)' }}
              >
                {type}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3">
        {AXES.map((axis) => (
          <AxisFader
            key={axis.key}
            axis={axis}
            value={axes[axis.key]}
            onChange={handleAxis}
            theme={theme}
          />
        ))}
      </div>
    </div>
  );
}
