import { MODES } from '../lib/mbti';
import IconGlyph from './IconGlyph';
import MotionBackdrop from './MotionBackdrop';

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
    <MotionBackdrop
      className="glass relative overflow-hidden rounded-2xl p-4"
      poster="/posters/music.webp"
      webm="/motion/music.webm"
      mp4="/motion/music.mp4"
      opacity={0.2}
      active={mode === 'charge' || mode === 'behind'}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/55"></div>
      <div className="relative z-10">
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Mode Pads</span>
      </div>
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
              <IconGlyph name={m.icon} className="h-6 w-6" />
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
        className="pad panic-pulse mt-2 flex w-full items-center justify-center gap-2 py-3 font-display text-sm font-bold text-red-500"
        style={{ '--pad-glow': `${MODE_COLORS.behind}80`, borderColor: 'rgba(239,68,68,0.4)' }}
      >
        <IconGlyph name={BEHIND_MODE?.icon || 'mode-behind'} className="h-5 w-5" />
        <span>我们落后了!</span>
      </button>
      </div>
    </MotionBackdrop>
  );
}
