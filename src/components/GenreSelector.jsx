import { useEffect, useMemo, useState } from 'react';
import { getStyles } from '../lib/api';

export default function GenreSelector({ value, onChange, theme }) {
  const [styles, setStyles] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getStyles()
      .then((data) => setStyles(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message || '流派加载失败'));
  }, []);

  const groups = useMemo(() => {
    const map = {};
    for (const s of styles) {
      const cat = s.category || '其他';
      if (!map[cat]) map[cat] = [];
      map[cat].push(s);
    }
    return Object.entries(map);
  }, [styles]);

  return (
    <div className="glass rounded-2xl p-4">
      <span className="deck-label">Genre</span>

      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}

      <div className="mt-3 space-y-3">
        {groups.map(([cat, items]) => (
          <div key={cat}>
            <div className="mb-1.5 font-mono text-[9px] tracking-widest text-faint">{cat}</div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((s) => {
                const active = value === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onChange(active ? '' : s.id)}
                    className={`pad py-1.5 px-3 text-xs ${active ? 'pad-active' : ''}`}
                    style={active ? { '--pad-glow': `${theme?.accent || '#22c55e'}66`, color: theme?.glow } : undefined}
                    title={`${s.label} · ${s.bpmRange?.[0]}–${s.bpmRange?.[1]} BPM`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
