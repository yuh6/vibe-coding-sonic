import { MODES } from '../lib/mbti';

const FEEDBACK_BUTTONS = [
  { action: 'too_loud', label: '太吵了', emoji: '🔉' },
  { action: 'more_drive', label: '来点刺激的', emoji: '🔥' },
  { action: 'skip', label: '跳过', emoji: '⏭' },
  { action: 'like', label: '喜欢', emoji: '❤️' },
];

/** 能量曲线实时展示 — §12.1 EnergyCurve */
function EnergyCurve({ curve, progress }) {
  if (!curve?.length) return null;
  const max = Math.max(...curve.map((p) => p.energy), 1);
  return (
    <div>
      <div className="mb-1.5 font-mono text-[9px] tracking-widest text-faint">ENERGY CURVE</div>
      <div className="flex h-12 items-end gap-[1px] overflow-hidden rounded-lg bg-led-panel px-1 py-1">
        {curve.map((point, i) => {
          const height = Math.max(6, (point.energy / max) * 100);
          const isNow = progress != null && i / curve.length <= progress && (i + 1) / curve.length > progress;
          return (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${height}%`,
                backgroundColor: isNow ? '#f59e0b' : 'rgba(99, 102, 241, 0.45)',
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

/** 全局阶段时间线 + 预测 — §12.1 MacroTimeline */
function MacroTimeline({ curve, progress }) {
  if (!curve?.length) return null;
  const segments = [];
  let last = null;
  curve.forEach((point, i) => {
    if (point.segment !== last) {
      segments.push({ segment: point.segment, start: i });
      last = point.segment;
    }
  });
  return (
    <div>
      <div className="mb-1.5 font-mono text-[9px] tracking-widest text-faint">MACRO TIMELINE</div>
      <div className="relative flex h-6 overflow-hidden rounded-lg border border-theme">
        {segments.map((seg, i) => {
          const end = segments[i + 1]?.start ?? curve.length;
          const widthPct = ((end - seg.start) / curve.length) * 100;
          return (
            <div
              key={seg.segment + seg.start}
              className="flex items-center justify-center border-r border-theme/40 text-[8px] text-faint last:border-r-0"
              style={{ width: `${widthPct}%` }}
              title={seg.segment}
            >
              {widthPct > 8 ? seg.segment : ''}
            </div>
          );
        })}
        {progress != null && (
          <div
            className="absolute top-0 h-full w-0.5 bg-amber-400"
            style={{ left: `${progress * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

/** 曲库池状态：已生成/剩余/费用 — §12.1 PoolStatus */
function PoolStatus({ poolStatus }) {
  if (!poolStatus) return null;
  const phases = poolStatus.phases || {};
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between font-mono text-[9px] tracking-widest text-faint">
        <span>POOL STATUS</span>
        <span>
          ${(poolStatus.budgetSpent || 0).toFixed(2)} / ${(poolStatus.budgetLimit || 0).toFixed(2)}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(phases).map(([phase, info]) => {
          const modeInfo = MODES.find((m) => m.id === phase);
          const available = info.available ?? info.ready ?? 0;
          const pending = info.pending ?? 0;
          return (
            <div
              key={phase}
              className="rounded-lg border border-theme bg-led-panel px-2 py-1 text-center text-[10px]"
              title={`未播 ${available} / 生成中 ${pending} / 可播 ${info.ready || 0}`}
            >
              <span className="mr-1">{modeInfo?.emoji || phase}</span>
              <span className="font-mono text-faint">
                {available}+{pending}/{info.total}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** 当前情绪标签 — §12.1 MoodIndicator */
function MoodIndicator({ track, phase, theme }) {
  const modeInfo = MODES.find((m) => m.id === phase);
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{modeInfo?.emoji || '🎵'}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-theme">
          {track?.moodTag || modeInfo?.label || '等待启动'}
        </div>
        <div className="truncate font-mono text-[9px] text-faint">
          {track ? `${track.genre} · energy ${track.energyLevel}` : ''}
        </div>
      </div>
      {track && (
        <span
          className="led-dot animate-pulse"
          style={{ color: theme?.accent || '#4ade80' }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

export default function ArrangerPanel({
  arranger,
  theme,
  onStart,
  onStop,
  onPhaseChange,
  onFeedback,
  liveStation,
  radioBusy,
  onRadioToggle,
}) {
  const {
    state,
    phase,
    nowPlayingTrack,
    poolStatus,
    energyCurve,
    starting,
    error,
  } = arranger;

  const running = state !== 'IDLE';

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Arranger 编排引擎</span>
        <button
          type="button"
          onClick={running ? onStop : onStart}
          disabled={starting}
          className="pad px-3 py-1.5 text-xs disabled:opacity-50"
        >
          {starting ? '启动中...' : running ? '⏹ 停止' : '▶ 开始编排'}
        </button>
        {onRadioToggle && (
          <button
            type="button"
            onClick={onRadioToggle}
            disabled={radioBusy || (!running && !liveStation)}
            className={`pad px-3 py-1.5 text-xs disabled:opacity-50 ${liveStation ? 'pad-active' : ''}`}
          >
            {radioBusy ? '处理中...' : liveStation ? '📻 下线电台' : '📻 公开'}
          </button>
        )}
      </div>

      {error && <div className="mb-2 text-[11px] text-red-400">{error}</div>}

      {liveStation && (
        <div className="mb-2 rounded-lg border border-green-500/20 bg-green-500/10 px-2 py-1.5 text-[11px] text-green-300">
          电台公开中: {liveStation.title}
        </div>
      )}

      <div className="mb-3">
        <MoodIndicator track={nowPlayingTrack} phase={phase} theme={theme} />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => onPhaseChange(m.id)}
            disabled={!running}
            className={`pad px-2 py-1.5 text-xs disabled:opacity-40 ${phase === m.id ? 'pad-active' : ''}`}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>

      <div className="mb-3 space-y-2.5">
        <EnergyCurve curve={energyCurve} />
        <MacroTimeline curve={energyCurve} />
        <PoolStatus poolStatus={poolStatus} />
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {FEEDBACK_BUTTONS.map((btn) => (
          <button
            key={btn.action}
            type="button"
            onClick={() => onFeedback(btn.action)}
            disabled={!running}
            className="pad flex flex-col items-center gap-0.5 py-2 text-[10px] disabled:opacity-40"
          >
            <span className="text-base">{btn.emoji}</span>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
