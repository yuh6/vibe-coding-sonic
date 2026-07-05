import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

/**
 * 可拖动 + 可缩小/放大的悬浮窗口。
 * - 顶部把手拖动；右上角按钮缩小（只留标题条）/ 放大（展开完整内容）。
 * - 位置记忆在 localStorage（storageKey），始终约束在视口内，拖不丢。
 * - 首次无记忆位置时，可用 anchorId 把初始位置放到某个元素下方。
 */
export default function FloatingWindow({
  title = '',
  children,
  width = 420,
  initial = { x: 400, y: 120 },
  storageKey,
  anchorId,
}) {
  const [pos, setPos] = useState(() => {
    if (storageKey) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
      } catch {
        /* ignore */
      }
    }
    return initial;
  });
  const [collapsed, setCollapsed] = useState(false);

  const posRef = useRef(pos);
  posRef.current = pos;
  const dragRef = useRef(null);

  // 首次挂载：无记忆位置时，把窗口放到锚点元素（Arranger）下方
  const placedRef = useRef(false);
  useEffect(() => {
    if (placedRef.current) return;
    placedRef.current = true;
    const hasSaved = storageKey && localStorage.getItem(storageKey);
    if (hasSaved || !anchorId) return;
    const el = document.getElementById(anchorId);
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      x: clamp(r.left, 0, Math.max(0, window.innerWidth - width)),
      y: clamp(r.bottom + 12, 0, Math.max(0, window.innerHeight - 60)),
    });
  }, [anchorId, storageKey, width]);

  // 视口变化时把窗口拉回可见范围
  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({
        x: clamp(p.x, 0, Math.max(0, window.innerWidth - width)),
        y: clamp(p.y, 0, Math.max(0, window.innerHeight - 60)),
      }));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [width]);

  const onPointerDown = useCallback((e) => {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: posRef.current.x,
      origY: posRef.current.y,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = clamp(d.origX + (e.clientX - d.startX), 0, Math.max(0, window.innerWidth - width));
    const ny = clamp(d.origY + (e.clientY - d.startY), 0, Math.max(0, window.innerHeight - 60));
    setPos({ x: nx, y: ny });
  }, [width]);

  const endDrag = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(posRef.current));
      } catch {
        /* ignore */
      }
    }
  }, [storageKey]);

  return (
    <div
      className="fixed z-40 overflow-hidden rounded-[2rem] border border-theme shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
      style={{ left: pos.x, top: pos.y, width }}
    >
      {/* 拖动把手 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="flex cursor-move touch-none select-none items-center justify-between bg-led-panel px-4 py-1.5"
        title="拖动移动窗口"
      >
        <span className="flex items-center gap-1.5 text-faint">
          <span className="text-xs leading-none tracking-[-2px]">⣿</span>
          <span className="font-mono text-[10px] tracking-widest">{title}</span>
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? '放大' : '缩小'}
          className="flex h-6 w-6 flex-none items-center justify-center rounded-full border border-theme bg-black/30 text-faint transition-colors hover:text-theme"
        >
          <span className="text-xs leading-none">{collapsed ? '▢' : '—'}</span>
        </button>
      </div>

      {!collapsed && <div>{children}</div>}
    </div>
  );
}
