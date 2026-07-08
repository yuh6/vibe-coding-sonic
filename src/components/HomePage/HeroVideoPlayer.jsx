import { useState } from 'react';
import { ChevronRight } from 'lucide-react';

export const HERO_VIDEOS = ['/hero1.mp4', '/hero2.mp4', '/hero3.mp4'];
export const HERO_VIDEO_POSTERS = ['/posters/hero1.webp', '/posters/hero2.webp', '/posters/hero3.webp'];

export default function HeroVideoPlayer({ sources, posters = [] }) {
  const list = (sources || []).filter(Boolean);
  const [idx, setIdx] = useState(0);
  if (!list.length) return null;
  const current = Math.min(idx, list.length - 1);
  const poster = posters[current] || undefined;
  const go = (n) => setIdx((n + list.length) % list.length);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
      <video
        key={list[current]}
        className="absolute inset-0 h-full w-full object-contain"
        src={list[current]}
        poster={poster}
        preload="metadata"
        autoPlay
        muted
        loop
        playsInline
        controls
      />

      {list.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(current - 1)}
            title="上一个"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            title="下一个"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                title={`第 ${i + 1} 个`}
                className={`h-2 rounded-full transition-all ${
                  i === current ? 'w-5 bg-[#00FF66]' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
