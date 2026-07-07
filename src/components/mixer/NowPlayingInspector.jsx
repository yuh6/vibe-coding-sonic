import { Download, ListMusic, Radio, RotateCcw, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';

export function UserPlaylistPanel({
  user,
  playlistTracks = [],
  activeIndex = -1,
  savedLists = [],
  activeSavedListId = '',
  onAddTrack,
  onSaveList,
  onLoadList,
  onDeleteList,
}) {
  const [showSavedLists, setShowSavedLists] = useState(false);
  const activeSavedList = savedLists.find((list) => list.id === activeSavedListId);

  return (
    <div className="mixer-panel mixer-playlist-panel">
      <div className="mixer-playlist-head">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 flex-none text-emerald-300" />
          <span className="mixer-kicker">User playlist</span>
        </div>
        <div className="mixer-list-actions">
          <button type="button" onClick={onSaveList} className="mixer-mini-button">
            Save list
          </button>
          <button type="button" onClick={() => setShowSavedLists((open) => !open)} className="mixer-mini-button">
            Select
          </button>
        </div>
      </div>
      {showSavedLists && (
        <div className="mixer-saved-list-menu">
          {savedLists.length === 0 ? (
            <div className="mixer-saved-empty">No saved lists</div>
          ) : (
            savedLists.map((list) => (
              <div key={list.id} className={`mixer-saved-list-row ${list.id === activeSavedListId ? 'is-active' : ''}`}>
                <button
                  type="button"
                  onClick={() => {
                    onLoadList?.(list);
                    setShowSavedLists(false);
                  }}
                  className="mixer-saved-list-load"
                >
                  <strong>{list.name}</strong>
                  <small>{list.tracks?.length || 0} tracks</small>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteList?.(list.id)}
                  className="mixer-saved-list-delete"
                  aria-label={`Delete ${list.name}`}
                  title="Delete list only"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
        <span className="truncate text-sm font-semibold text-white/85">{activeSavedList?.name || user?.name || user?.email || 'Guest crate'}</span>
        <span className="font-mono text-[10px] text-white/38">{playlistTracks.length} saved</span>
      </div>
      <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
        {playlistTracks.map((track, index) => (
          <button
            key={track.id || track.name}
            type="button"
            onClick={() => onAddTrack?.(track, index)}
            className={`mixer-row-button compact ${index === activeIndex ? 'is-active' : ''}`}
          >
            <span className="min-w-0 flex-1">
              <strong>{track.name}</strong>
              <small>{track.status || track.type || 'stem'}</small>
            </span>
            <span className="mixer-row-action">Play</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function NowPlayingInspector({
  tracks,
  error,
  onClear,
  children,
}) {
  return (
    <aside className="mixer-inspector min-w-0">
      {children}

      <div className="mixer-panel mixer-actions-panel">
        <span className="mixer-kicker">Session actions</span>
        <div className="mixer-actions-grid">
          <button type="button" className="mixer-action-button" disabled={tracks.length === 0}>
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" className="mixer-action-button" disabled={tracks.length === 0}>
            <Radio className="h-4 w-4" />
            Broadcast
          </button>
          <button type="button" className="mixer-action-button" disabled={tracks.length === 0}>
            <ListMusic className="h-4 w-4" />
            Queue
          </button>
          <button type="button" onClick={onClear} className="mixer-action-button danger" disabled={tracks.length === 0}>
            <RotateCcw className="h-4 w-4" />
            Clear
          </button>
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[11px] text-red-300">{error}</p>}
      </div>
    </aside>
  );
}
