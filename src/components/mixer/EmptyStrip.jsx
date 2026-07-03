// 未使用的通道槽位：模拟真实调音台上的空通道，保持台面视觉完整
export default function EmptyStrip({ index }) {
  return (
    <div className="flex min-w-[96px] flex-1 flex-col items-center gap-2 rounded-xl border border-dashed border-theme px-2 py-3 opacity-35 select-none">
      <span className="font-mono text-[10px] tracking-widest text-faint">CH {index}</span>

      <div className="flex items-end gap-1.5">
        <div className="flex flex-col gap-1.5">
          {['HIGH', 'MID', 'LOW'].map((band) => (
            <div key={band} className="flex flex-col items-center gap-0.5">
              <div className="h-9 w-9 rounded-full border border-theme bg-led-panel" />
              <span className="font-mono text-[8px] tracking-wider text-faint">{band}</span>
              <span className="font-mono text-[9px] text-faint">—</span>
            </div>
          ))}
        </div>
        <div className="h-[132px] w-2 rounded-sm bg-chip" />
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <div className="h-9 w-9 rounded-full border border-theme bg-led-panel" />
        <span className="font-mono text-[8px] tracking-wider text-faint">PAN</span>
        <span className="font-mono text-[9px] text-faint">—</span>
      </div>

      <div className="h-[28px] w-full rounded bg-chip" />

      <div className="flex w-full gap-1">
        {['M', 'S', 'C'].map((k) => (
          <span key={k} className="flex-1 rounded-md border border-theme py-1 text-center font-mono text-[9px] text-faint">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}
