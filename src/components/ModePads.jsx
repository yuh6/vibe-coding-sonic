import { MODES } from '../lib/mbti';

const MODE_COLORS = {
  Focus: '#38bdf8',
  Spark: '#facc15',
  Sprint: '#fb7185',
  Charge: '#f97316',
};

export default function ModePads({ mode, onModeChange, onPanic }) {
  return (
    <div className="glass rounded-2xl p-4">
      <span className="deck-label">Mode Pads</span>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          const color = MODE_COLORS[m.id];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              className={`pad flex flex-col items-center py-4 ${active ? 'pad-active' : ''}`}
              style={{ '--pad-glow': `${color}66` }}
            >
              <span className="text-2xl">{m.emoji}</span>
              <span
                className="mt-1 font-display text-sm font-bold"
                style={{ color: active ? color : 'rgba(255,255,255,0.75)' }}
              >
                {m.label}
              </span>
              {active && (
                <span className="led-dot mt-1.5" style={{ color }} />
              )}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onPanic}
        className="pad panic-pulse mt-2 w-full py-3 font-display text-sm font-bold text-red-300"
        style={{ '--pad-glow': 'rgba(239,68,68,0.5)', borderColor: 'rgba(239,68,68,0.4)' }}
      >
        我们落后了!
      </button>
    </div>
  );
}
