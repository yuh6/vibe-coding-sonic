import { useEffect, useMemo, useState } from 'react';
import { getStyles } from '../lib/api';

const CATEGORY_LABELS = {
  '复古电子': 'Retro-Electronic',
  'Chill': 'Chill',
  '流行': 'Pop',
  '游戏': 'Gaming',
  '嘻哈': 'Hip-Hop',
  '电子': 'Electronic',
  '氛围': 'Ambient',
  '民谣': 'Folk',
  '爵士': 'Jazz',
  '摇滚': 'Rock',
  '古典': 'Classical',
  '拉丁': 'Latin',
};

export default function GenreSelector({ value, onChange, theme }) {
  const [styles, setStyles] = useState([]);
  const [error, setError] = useState('');
  const [expandedCat, setExpandedCat] = useState(null);

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

  const selectedLabel = styles.find((s) => s.id === value)?.label || '';

  return (
    <div className="genre-panel">
      {/* 标题区 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Explore Genres</span>
        <span className="genre-subtitle">
          {selectedLabel ? (
            <>
              已选 <span className="text-white/70 font-semibold">{selectedLabel}</span>
              <button
                type="button"
                onClick={() => onChange('')}
                className="ml-1.5 text-white/30 hover:text-white/60 transition-colors"
                title="清除选择"
              >
                ✕
              </button>
            </>
          ) : (
            '选择流派 · 影响生成的音乐风格'
          )}
        </span>
      </div>

      {error && <div className="mb-2 text-xs text-red-300">{error}</div>}

      {/* 分类行：每行可展开 */}
      <div className="space-y-1">
        {groups.map(([cat, items]) => {
          const isOpen = expandedCat === cat;
          const hasActive = items.some((s) => s.id === value);
          return (
            <div key={cat}>
              <button
                type="button"
                onClick={() => setExpandedCat(isOpen ? null : cat)}
                className={`genre-cat-trigger ${hasActive ? 'genre-cat-trigger-active' : ''}`}
              >
                <span className="genre-cat-zh">{cat}</span>
                <span className="genre-cat-en">{CATEGORY_LABELS[cat] || cat}</span>
                <span className="genre-cat-line" />
                <span className={`genre-cat-arrow ${isOpen ? 'genre-cat-arrow-open' : ''}`}>▾</span>
              </button>

              {isOpen && (
                <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1">
                  {items.map((s) => {
                    const active = value === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onChange(active ? '' : s.id)}
                        className={`genre-chip ${active ? 'genre-chip-active' : ''}`}
                        title={`${s.bpmRange?.[0]}–${s.bpmRange?.[1]} BPM`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
