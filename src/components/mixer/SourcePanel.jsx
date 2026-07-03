import { useEffect, useRef, useState } from 'react';
import { getLibrary } from '../../lib/api';

// 音源面板：音乐库 / 本地文件 / URL 三种方式往调音台加轨
export default function SourcePanel({ onAdd, loading }) {
  const [library, setLibrary] = useState(null);
  const [url, setUrl] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    getLibrary().then(setLibrary).catch(() => {});
  }, []);

  const handleFiles = (e) => {
    for (const file of e.target.files) {
      onAdd({ name: file.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(file) });
    }
    e.target.value = '';
  };

  const handleUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const name = trimmed.split('/').pop()?.split('?')[0] || 'URL 音轨';
    onAdd({ name, url: trimmed });
    setUrl('');
  };

  return (
    <div className="glass rounded-2xl p-4">
      <span className="deck-label">Source</span>

      <div className="mt-3 space-y-3">
        <div>
          <div className="mb-1.5 font-mono text-[10px] tracking-widest text-subtle">音乐库</div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {library ? (
              Object.entries(library).flatMap(([mode, tracks]) =>
                tracks.map((t) => (
                  <button
                    key={`${mode}-${t.id}`}
                    type="button"
                    disabled={loading}
                    onClick={() => onAdd({ name: t.title, url: t.url })}
                    className="btn-ghost flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] disabled:opacity-40"
                  >
                    <span className="truncate">{t.title}</span>
                    <span className="ml-2 shrink-0 font-mono text-[9px] text-faint">{mode}</span>
                  </button>
                ))
              )
            ) : (
              <span className="text-[11px] text-faint">音乐库加载中…</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] tracking-widest text-subtle">本地文件</div>
          <input ref={fileRef} type="file" accept="audio/*" multiple onChange={handleFiles} className="hidden" />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="btn-ghost w-full rounded-lg px-2.5 py-2 text-[11px] disabled:opacity-40"
          >
            选择音频文件（可多选，模拟分轨）
          </button>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] tracking-widest text-subtle">URL</div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleUrl()}
              placeholder="https://…/track.mp3"
              className="bg-input min-w-0 flex-1 rounded-lg px-2.5 py-1.5 font-mono text-[11px]"
            />
            <button
              type="button"
              disabled={loading || !url.trim()}
              onClick={handleUrl}
              className="btn-ghost shrink-0 rounded-lg px-3 text-[11px] disabled:opacity-40"
            >
              加载
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
