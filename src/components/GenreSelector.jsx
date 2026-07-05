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
    <div className="genre-panel">
      {/* 标题区 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Explore Genres</span>
        <span className="genre-subtitle">选择流派 · 影响生成的音乐风格</span>
      </div>

      {error && <div className="mb-2 text-xs text-red-300">{error}</div>}

      {/* 分类行 */}
      <div className="space-y-4">
        {groups.map(([cat, items]) => (
          <div key={cat}>
            <div className="genre-cat-row">
              <span className="genre-cat-zh">{cat}</span>
              <span className="genre-cat-en">{CATEGORY_LABELS[cat] || cat}</span>
              <span className="genre-cat-line" />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
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
          </div>
        ))}
      </div>
    </div>
  );
}
