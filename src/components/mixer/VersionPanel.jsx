import { useEffect, useState } from 'react';

const STORAGE_KEY = 'vibe-mix-versions';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// 混音快照：保存当前轨道 + 混音参数，可随时恢复
export default function VersionPanel({ getMixState, onRestore, trackCount }) {
  const [versions, setVersions] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  }, [versions]);

  const save = () => {
    const mixState = getMixState();
    const hasBlob = mixState.tracks.some((t) => t.url.startsWith('blob:'));
    const snapshot = {
      id: `v${Date.now()}`,
      name: `Mix ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
      createdAt: new Date().toISOString(),
      trackCount: mixState.tracks.length,
      hasBlob,
      mixState,
    };
    setVersions((v) => [snapshot, ...v].slice(0, 20));
  };

  const remove = (id) => setVersions((v) => v.filter((x) => x.id !== id));

  const rename = (id) => {
    const name = window.prompt('版本名称');
    if (name) setVersions((v) => v.map((x) => (x.id === id ? { ...x, name } : x)));
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="deck-label">Versions</span>
        <button
          type="button"
          disabled={trackCount === 0}
          onClick={save}
          className="btn-ghost rounded-lg px-2.5 py-1 text-[10px] disabled:opacity-40"
        >
          📸 保存快照
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="text-[11px] text-faint">还没有快照。调好一版满意的混音后点「保存快照」。</p>
      ) : (
        <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
          {versions.map((v) => (
            <div key={v.id} className="flex items-center gap-2 rounded-lg bg-chip px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => rename(v.id)}
                className="min-w-0 flex-1 truncate text-left text-[11px] text-theme"
                title="点击重命名"
              >
                {v.name}
                <span className="ml-1.5 font-mono text-[9px] text-faint">{v.trackCount} 轨</span>
                {v.hasBlob && (
                  <span className="ml-1 text-[9px] text-amber-500" title="包含本地文件，刷新页面后无法恢复">
                    ⚠︎
                  </span>
                )}
              </button>
              <button type="button" onClick={() => onRestore(v.mixState)} className="btn-ghost rounded px-2 py-0.5 text-[10px]">
                恢复
              </button>
              <button
                type="button"
                onClick={() => remove(v.id)}
                className="text-faint transition hover:text-red-400"
                aria-label="删除版本"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
