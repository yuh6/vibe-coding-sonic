export default function EmptyStrip({ index }) {
  return (
    <div className="flex min-w-[88px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-2 py-3">
      <span className="font-mono text-[10px] text-white/25">CH {String(index).padStart(2, '0')}</span>
    </div>
  );
}
