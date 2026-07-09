const ALBUM_COVERS = Array.from({ length: 15 }, (_, i) => `/albums/${i + 1}.jpg`);

export default function AlbumMarquee({ covers = ALBUM_COVERS }) {
  const list = covers.filter(Boolean);
  if (!list.length) return null;
  const loop = [...list, ...list];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.55),rgba(9,9,11,0.7))] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="mono-font text-xs uppercase tracking-[0.32em] text-[#00FF66]">Now Spinning</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">正在转动的专辑</h2>
        </div>
        <span className="mono-font text-[10px] text-zinc-500">悬停暂停</span>
      </div>

      <div className="album-marquee">
        <div className="album-marquee-track gap-4">
          {loop.map((src, i) => (
            <div
              key={i}
              className="group relative h-40 w-40 flex-none overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg transition-transform duration-300 hover:scale-105 hover:border-[#00FF66]/40"
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
