import { useEffect, useRef, useState } from 'react';
import { getLibrary, getMyTracks } from '../../lib/api';

export default function SourcePanel({ onAdd, onAddMany, loading }) {
  const [library, setLibrary] = useState(null);
  const [myTracks, setMyTracks] = useState(null);
  const [url, setUrl] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    getLibrary().then(setLibrary).catch(() => {});
    getMyTracks()
      .then((data) => setMyTracks(data.tracks || []))
      .catch(() => setMyTracks(null)); // 未登录时隐藏该区块
  }, []);

  const loadSavedTrack = (saved) => {
    const items = (saved.tracks?.length ? saved.tracks : [{ name: saved.title, url: saved.audioUrl }])
      .filter((track) => track?.url)
      .map((track) => ({ name: track.name || saved.title, url: track.url, type: track.type || 'stem' }));
    if (items.length === 0) return;
    if (onAddMany) onAddMany(items, { replace: false });
    else items.forEach(onAdd);
  };

  const handleFiles = (event) => {
    for (const file of event.target.files) {
      onAdd({ name: file.name.replace(/\.[^.]+$/, ''), url: URL.createObjectURL(file), type: 'stem' });
    }
    event.target.value = '';
  };

  const handleUrl = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    const name = trimmed.split('/').pop()?.split('?')[0] || 'URL Track';
    onAdd({ name, url: trimmed, type: 'stem' });
    setUrl('');
  };

  return (
    <div className="glass rounded-2xl p-4">
      <span className="deck-label">Source</span>

      <div className="mt-3 space-y-3">
        {myTracks && myTracks.length > 0 && (
          <div>
            <div className="mb-1.5 font-mono text-[10px] tracking-widest text-white/35">MY TRACKS</div>
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {myTracks.map((track) => (
                <button
                  key={track.id}
                  type="button"
                  disabled={loading}
                  onClick={() => loadSavedTrack(track)}
                  className="btn-ghost flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] disabled:opacity-40"
                >
                  <span className="truncate">{track.title || `${track.mbti} · ${track.mode}`}</span>
                  <span className="ml-2 shrink-0 font-mono text-[9px] text-white/35">
                    {track.fallback ? 'cached' : `${track.tracks?.length || 1} trk`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="mb-1.5 font-mono text-[10px] tracking-widest text-white/35">LIBRARY</div>
          <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
            {library ? (
              Object.entries(library).flatMap(([mode, tracks]) =>
                tracks.map((track) => (
                  <button
                    key={`${mode}-${track.id}`}
                    type="button"
                    disabled={loading}
                    onClick={() => onAdd({ name: track.title, url: track.url, type: 'stem' })}
                    className="btn-ghost flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-[11px] disabled:opacity-40"
                  >
                    <span className="truncate">{track.title}</span>
                    <span className="ml-2 shrink-0 font-mono text-[9px] text-white/35">{mode}</span>
                  </button>
                ))
              )
            ) : (
              <span className="text-[11px] text-white/35">Loading library...</span>
            )}
          </div>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] tracking-widest text-white/35">LOCAL FILES</div>
          <input ref={fileRef} type="file" accept="audio/*" multiple onChange={handleFiles} className="hidden" />
          <button
            type="button"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
            className="btn-ghost w-full rounded-lg px-2.5 py-2 text-[11px] disabled:opacity-40"
          >
            Select audio files
          </button>
        </div>

        <div>
          <div className="mb-1.5 font-mono text-[10px] tracking-widest text-white/35">URL</div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleUrl()}
              placeholder="https://.../track.mp3"
              className="bg-input min-w-0 flex-1 rounded-lg px-2.5 py-1.5 font-mono text-[11px]"
            />
            <button
              type="button"
              disabled={loading || !url.trim()}
              onClick={handleUrl}
              className="btn-ghost shrink-0 rounded-lg px-3 text-[11px] disabled:opacity-40"
            >
              Load
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
