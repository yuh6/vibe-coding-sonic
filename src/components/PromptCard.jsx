const LAYERS = [
  { key: 'mbti', label: 'MBTI 底色', className: 'layer-mbti', boxClass: 'layer-box-mbti' },
  { key: 'project', label: '项目主题', className: 'layer-project', boxClass: 'layer-box-project' },
  { key: 'mode', label: '状态模式', className: 'layer-mode', boxClass: 'layer-box-mode' },
  { key: 'console', label: 'DJ 微调', className: 'layer-console', boxClass: 'layer-box-console' },
];

export default function PromptCard({ layers, fullPrompt, loading }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Prompt Monitor</span>
      </div>

      {loading && (
        <div className="mt-3 animate-pulse space-y-2">
          <div className="h-4 rounded bg-chip" />
          <div className="h-4 rounded bg-chip" />
        </div>
      )}

      {!loading && !layers && (
        <p className="mt-3 text-sm text-subtle">调节推子后，这里会实时展示 prompt 融合过程</p>
      )}

      {!loading && layers && (
        <div className="mt-3 space-y-2">
          {LAYERS.map((layer) => {
            const text = layers[layer.key];
            if (!text) return null;
            return (
              <div key={layer.key} className={`rounded-xl p-2.5 ${layer.boxClass}`}>
                <div className="mb-0.5 font-mono text-[9px] font-semibold uppercase tracking-widest text-faint">
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
          <summary className="cursor-pointer text-xs text-subtle transition hover:text-muted">
            查看完整 Suno Prompt
          </summary>
          <p className="mt-2 rounded-lg bg-led-panel p-3 font-mono text-[11px] leading-relaxed text-faint">
            {fullPrompt}
          </p>
        </details>
      )}
    </div>
  );
}
