import { useEffect, useRef } from 'react';

export default function AudioVisualizer({ playing, theme }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const phaseRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const bars = 48;
      const gap = 3;
      const barWidth = (width - gap * (bars - 1)) / bars;
      phaseRef.current += playing ? 0.08 : 0.02;

      for (let i = 0; i < bars; i++) {
        const t = phaseRef.current + i * 0.25;
        const amp = playing ? 0.35 + Math.abs(Math.sin(t)) * 0.55 : 0.08 + Math.abs(Math.sin(t)) * 0.06;
        const barHeight = height * amp;
        const x = i * (barWidth + gap);
        const y = (height - barHeight) / 2;

        const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
        gradient.addColorStop(0, theme.glow);
        gradient.addColorStop(1, theme.accent);
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, theme]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-24 w-full rounded-xl opacity-80"
      aria-hidden="true"
    />
  );
}
