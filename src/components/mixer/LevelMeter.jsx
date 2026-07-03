import { useEffect, useRef } from 'react';

export default function LevelMeter({ getLevel, className = '' }) {
  const canvasRef = useRef(null);
  const peakRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf;

    const draw = () => {
      const { width, height } = canvas;
      const level = Math.min(1, getLevel());
      peakRef.current = Math.max(peakRef.current * 0.985, level);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
      ctx.fillRect(0, 0, width, height);

      const h = level * height;
      const grad = ctx.createLinearGradient(0, height, 0, 0);
      grad.addColorStop(0, '#4ade80');
      grad.addColorStop(0.7, '#facc15');
      grad.addColorStop(1, '#ef4444');
      ctx.fillStyle = grad;
      ctx.fillRect(0, height - h, width, h);

      const py = height - peakRef.current * height;
      ctx.fillStyle = peakRef.current > 0.9 ? '#ef4444' : '#e2e8f0';
      ctx.fillRect(0, Math.max(0, py - 1), width, 2);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getLevel]);

  return <canvas ref={canvasRef} width={8} height={120} className={`rounded-sm ${className}`} />;
}
