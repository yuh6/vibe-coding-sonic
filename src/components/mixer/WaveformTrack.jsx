import { useCallback, useEffect, useRef } from 'react';

export default function WaveformTrack({ track, time, duration, loop, onSeek, onLoopChange }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const dragRef = useRef(null);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const peaks = track.peaks || [];
    const trackRatio = duration > 0 ? track.duration / duration : 1;
    const usableWidth = width * trackRatio;
    const barW = peaks.length ? usableWidth / peaks.length : width;
    const mid = height / 2;
    const playedX = duration > 0 ? (time / duration) * width : 0;

    for (let i = 0; i < peaks.length; i += 1) {
      const x = i * barW;
      const h = Math.max(1, peaks[i] * (height - 4));
      ctx.fillStyle = x < playedX ? track.color : `${track.color}66`;
      ctx.fillRect(x, mid - h / 2, Math.max(1, barW - 0.5), h);
    }

    if (loop && duration > 0) {
      const x1 = (loop.start / duration) * width;
      const x2 = (loop.end / duration) * width;
      ctx.fillStyle = 'rgba(250, 204, 21, 0.15)';
      ctx.fillRect(x1, 0, x2 - x1, height);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(x1, 0, 1.5, height);
      ctx.fillRect(x2, 0, 1.5, height);
    }

    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(playedX, 0, 1.5, height);
  }, [track, time, duration, loop]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const resize = () => {
      canvas.width = wrap.clientWidth;
      canvas.height = 56;
      draw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  const timeAt = (clientX) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * duration;
  };

  const onPointerDown = (event) => {
    const start = timeAt(event.clientX);
    dragRef.current = { start, moved: false };

    const move = (moveEvent) => {
      const current = timeAt(moveEvent.clientX);
      if (Math.abs(current - dragRef.current.start) > 0.2) {
        dragRef.current.moved = true;
        onLoopChange({
          start: Math.min(dragRef.current.start, current),
          end: Math.max(dragRef.current.start, current),
        });
      }
    };

    const up = (upEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      if (!dragRef.current.moved) onSeek(timeAt(upEvent.clientX));
      dragRef.current = null;
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className="w-20 shrink-0 truncate text-right font-mono text-[10px]"
        style={{ color: track.color }}
        title={track.name}
      >
        {track.name}
      </span>
      <div ref={wrapRef} className="min-w-0 flex-1 cursor-crosshair rounded-lg bg-black/45">
        <canvas ref={canvasRef} onPointerDown={onPointerDown} className="block w-full" />
      </div>
    </div>
  );
}
