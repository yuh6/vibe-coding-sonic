const LAYERS = [
  { key: 'mbti', label: 'MBTI 底色', className: 'layer-mbti', bg: 'rgba(99,102,241,0.1)', ring: 'rgba(129,140,248,0.2)' },
  { key: 'project', label: '项目主题', className: 'layer-project', bg: 'rgba(16,185,129,0.1)', ring: 'rgba(52,211,153,0.2)' },
  { key: 'mode', label: '状态模式', className: 'layer-mode', bg: 'rgba(245,158,11,0.1)', ring: 'rgba(251,191,36,0.2)' },
  { key: 'console', label: 'DJ 微调', className: 'layer-console', bg: 'rgba(217,70,239,0.1)', ring: 'rgba(232,121,249,0.2)' },
];

export default function PromptCard({ layers, fullPrompt, loading }) {
  return (
    <div className="glass rounded-2xl p-4">
      <span className="deck-label">Prompt Monitor</span>

      {loading && (
        <div className="mt-3 animate-pulse space-y-2">
          <div className="h-4 rounded bg-white/10" />
          <div className="h-4 rounded bg-white/10" />
        </div>
      )}

      {!loading && !layers && (
        <p className="mt-3 text-sm text-white/40">调节推子后，这里会实时展示 prompt 融合过程</p>
      )}

      {!loading && layers && (
        <div className="mt-3 space-y-2">
          {LAYERS.map((layer) => {
            const text = layers[layer.key];
            if (!text) return null;
            return (
              <div
                key={layer.key}
                className="rounded-xl p-2.5"
                style={{ backgroundColor: layer.bg, boxShadow: `inset 0 0 0 1px ${layer.ring}` }}
              >
                <div className="mb-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-white/40">
                  {layer.label}
                </div>
                <p className={`${layer.className} text-xs leading-relaxed`}>{text}</p>
              </div>
            );
          })}
        </div>
      )}

      {fullPrompt && (
        <details className="group mt-3">
          <summary className="cursor-pointer text-xs text-white/40 transition hover:text-white/60">
            查看完整 Suno Prompt
          </summary>
          <p className="mt-2 rounded-lg bg-black/30 p-3 font-mono text-[11px] leading-relaxed text-white/50">
            {fullPrompt}
          </p>
        </details>
      )}
    </div>
  );
}
