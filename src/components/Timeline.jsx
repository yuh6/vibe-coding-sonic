import { MODES } from '../lib/mbti';

export default function Timeline({ phases, currentPhase }) {
  if (!phases?.length) return null;

  return (
    <div className="glass rounded-2xl p-4">
      <span className="deck-label">Hackathon Timeline</span>
      <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {phases.map((phase) => {
          const active = currentPhase?.name === phase.name;
          const modeInfo = MODES.find((m) => m.id === phase.mode);
          return (
            <div
              key={phase.name}
              className={`pad min-w-[120px] flex-none px-3 py-2.5 text-center ${active ? 'pad-active' : ''}`}
              style={active ? { '--pad-glow': 'rgba(255,255,255,0.3)' } : undefined}
            >
              <div className="text-lg">{modeInfo?.emoji}</div>
              <div className="mt-0.5 text-xs font-medium">{phase.name}</div>
              <div className="font-mono text-[10px] text-white/40">
                {phase.start}–{phase.end}
              </div>
              {active && <div className="led-dot mx-auto mt-1.5 text-emerald-400" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
