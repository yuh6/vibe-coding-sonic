import MotionBackdrop from './MotionBackdrop';

const VOCAL_MODES = [
  { id: 'vocal', emoji: '🎤', label: '人声', desc: 'AI Vocal', color: '#c084fc' },
  { id: 'instrumental', emoji: '🎹', label: '纯伴奏', desc: 'Instrumental', color: '#38bdf8' },
  { id: 'mixed', emoji: '🎶', label: '混合', desc: 'Vocal+Inst', color: '#34d399' },
];

export default function VocalMode({ vocalMode, onVocalModeChange }) {
  return (
    <MotionBackdrop
      className="glass relative overflow-hidden rounded-2xl p-4"
      poster="/posters/music.webp"
      webm="/motion/music.webm"
      mp4="/motion/music.mp4"
      opacity={0.2}
    >
      <div className="pointer-events-none absolute inset-0 bg-black/55"></div>
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <span className="deck-label">Vocal Mode</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {VOCAL_MODES.map((m) => {
            const active = vocalMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onVocalModeChange(m.id)}
                className={`pad flex flex-col items-center py-3 ${active ? 'pad-active' : ''}`}
                style={{ '--pad-glow': `${m.color}66` }}
              >
                <span className="text-xl">{m.emoji}</span>
                <span
                  className="mt-1 text-center font-display text-xs font-bold"
                  style={{ color: active ? m.color : undefined }}
                >
                  {m.label}
                </span>
                <span
                  className="mt-0.5 text-[9px] text-subtle mono-font"
                  style={{ color: active ? m.color : undefined }}
                >
                  {m.desc}
                </span>
                {active && <span className="led-dot mt-1" style={{ color: m.color }} />}
              </button>
            );
          })}
        </div>
      </div>
    </MotionBackdrop>
  );
}
