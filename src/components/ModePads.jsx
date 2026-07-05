import { MODES } from '../lib/mbti';

const MODE_COLORS = {
  brainstorm: '#facc15',
  focus: '#38bdf8',
  sprint: '#fb7185',
  charge: '#f97316',
  behind: '#ef4444',
  break: '#34d399',
  celebrate: '#c084fc',
};

// "落后了" 阶段单独渲染为醒目的紧急按钮，其余 6 个阶段走常规网格
const GRID_MODES = MODES.filter((m) => m.id !== 'behind');
const BEHIND_MODE = MODES.find((m) => m.id === 'behind');

export default function ModePads({ mode, onModeChange, onPanic }) {
  return (
    <div className="glass relative overflow-hidden rounded-2xl p-4">
      <img
        src="/music.gif"
        alt=""
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20"
      />
      <div className="pointer-events-none absolute inset-0 bg-black/55"></div>
      <div className="relative z-10">
      <span className="deck-label">Mode Pads</span>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {GRID_MODES.map((m) => {
          const active = mode === m.id;
          const color = MODE_COLORS[m.id];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onModeChange(m.id)}
              className={`pad flex flex-col items-center py-3 ${active ? 'pad-active' : ''}`}
              style={{ '--pad-glow': `${color}66` }}
            >
              <span className="text-xl">{m.emoji}</span>
              <span
                className="mt-1 text-center font-display text-xs font-bold"
                style={{ color: active ? color : undefined }}
              >
                {m.label}
              </span>
              {active && <span className="led-dot mt-1" style={{ color }} />}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onPanic}
        className="pad panic-pulse mt-2 w-full py-3 font-display text-sm font-bold text-red-500"
        style={{ '--pad-glow': `${MODE_COLORS.behind}80`, borderColor: 'rgba(239,68,68,0.4)' }}
      >
        {BEHIND_MODE?.emoji} 我们落后了!
      </button>
      </div>
    </div>
  );
}

