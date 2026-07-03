import { useEffect, useState } from 'react';

const STORAGE_KEY = 'vibe-mix-versions';

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export default function VersionPanel({ getMixState, onRestore, trackCount }) {
  const [versions, setVersions] = useState(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
  }, [versions]);

  const save = () => {
    const mixState = getMixState();
    const hasBlob = mixState.tracks.some((track) => track.url?.startsWith('blob:'));
    const snapshot = {
      id: `v${Date.now()}`,
      name: `Mix ${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
      createdAt: new Date().toISOString(),
      trackCount: mixState.tracks.length,
      hasBlob,
      mixState,
    };
    setVersions((prev) => [snapshot, ...prev].slice(0, 20));
  };

  const remove = (id) => setVersions((prev) => prev.filter((version) => version.id !== id));

  const rename = (id) => {
    const name = window.prompt('Version name');
    if (name) setVersions((prev) => prev.map((version) => (version.id === id ? { ...version, name } : version)));
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
          Save
        </button>
      </div>

      {versions.length === 0 ? (
        <p className="text-[11px] text-white/35">No snapshots yet.</p>
      ) : (
        <div className="flex max-h-52 flex-col gap-1.5 overflow-y-auto">
          {versions.map((version) => (
            <div key={version.id} className="flex items-center gap-2 rounded-lg bg-white/10 px-2.5 py-1.5">
              <button
                type="button"
                onClick={() => rename(version.id)}
                className="min-w-0 flex-1 truncate text-left text-[11px] text-white/85"
                title="Rename"
              >
                {version.name}
                <span className="ml-1.5 font-mono text-[9px] text-white/35">{version.trackCount} tracks</span>
                {version.hasBlob && (
                  <span className="ml-1 text-[9px] text-amber-400" title="Local files cannot be restored after refresh">
                    local
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onRestore(version.mixState)}
                className="btn-ghost rounded px-2 py-0.5 text-[10px]"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => remove(version.id)}
                className="text-white/35 transition hover:text-red-400"
                aria-label="Delete version"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
