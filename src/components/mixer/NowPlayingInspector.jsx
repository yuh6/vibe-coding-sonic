import { Download, Radio, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';

export function UserPlaylistPanel({
  user,
  playlistTracks = [],
  activeIndex = -1,
  selectedIds = new Set(),
  selectionMode = false,
  savedLists = [],
  activeSavedListId = '',
  busy = false,
  saveBusy = false,
  canSave = true,
  loadingTrackId = '',
  onAddTrack,
  onToggleSelection,
  onToggleSelectionMode,
  onRemoveSelected,
  onSaveList,
  onLoadList,
  onDeleteList,
}) {
  const [showSavedLists, setShowSavedLists] = useState(false);
  const activeSavedList = savedLists.find((list) => list.id === activeSavedListId);
  const selectedCount = selectedIds.size || 0;

  return (
    <div className="mixer-panel mixer-playlist-panel">
      <div className="mixer-playlist-head">
        <div className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 flex-none text-emerald-300" />
          <span className="mixer-kicker">Local queue</span>
        </div>
        <div className="mixer-list-actions">
          <button type="button" onClick={onSaveList} className="mixer-mini-button" disabled={!canSave || saveBusy}>
            {saveBusy ? 'Saved' : 'Save local'}
          </button>
          <button type="button" onClick={onToggleSelectionMode} className={`mixer-mini-button ${selectionMode ? 'is-active' : ''}`} disabled={!playlistTracks.length || busy}>
            {selectionMode ? `${selectedCount} selected` : 'Select'}
          </button>
          {selectionMode && selectedCount > 0 && (
            <button type="button" onClick={onRemoveSelected} className="mixer-mini-button danger">
              Delete
            </button>
          )}
          <button type="button" onClick={() => setShowSavedLists((open) => !open)} className="mixer-mini-button">
            Lists
          </button>
        </div>
      </div>
      {showSavedLists && (
        <div className="mixer-saved-list-menu">
          {savedLists.length === 0 ? (
            <div className="mixer-saved-empty">No local snapshots</div>
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
                  <small>{list.tracks?.length || 0} local tracks</small>
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteList?.(list.id)}
                  className="mixer-saved-list-delete"
                  aria-label={`Delete ${list.name}`}
                  title="Delete local snapshot only"
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
        <span className="font-mono text-[10px] text-white/38">{playlistTracks.length} queued</span>
      </div>
      <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto">
        {playlistTracks.map((track, index) => {
          const trackKey = track.id || track.name;
          const isLoading = loadingTrackId === trackKey;
          return (
            <button
              key={trackKey}
              type="button"
              disabled={!selectionMode && busy}
              onClick={() => {
                if (selectionMode) onToggleSelection?.(trackKey);
                else onAddTrack?.(track, index);
              }}
              className={`mixer-row-button compact ${index === activeIndex ? 'is-active' : ''} ${selectedIds.has(trackKey) ? 'is-selected' : ''}`}
            >
              {selectionMode && <span className="mixer-row-check">{selectedIds.has(trackKey) ? '✅' : ''}</span>}
              <span className="min-w-0 flex-1">
                <strong>{track.name}</strong>
                <small>{track.status || track.type || 'stem'}</small>
              </span>
              <span className="mixer-row-action">{isLoading ? 'Loading' : selectionMode ? 'Pick' : 'Play'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function NowPlayingInspector({
  tracks,
  error,
  actionMessage,
  broadcastLabel = 'Broadcast',
  isBroadcasting = false,
  canShare = false,
  actionBusy = false,
  canExport = false,
  canBroadcast = false,
  onExport,
  onBroadcast,
  onShare,
  children,
}) {
  return (
    <aside className="mixer-inspector min-w-0">
      {children}

      <div className="mixer-panel mixer-actions-panel">
        <span className="mixer-kicker">Session actions</span>
        <div className={`mixer-actions-grid ${isBroadcasting ? 'has-share' : ''}`}>
          <button type="button" onClick={onExport} className="mixer-action-button" disabled={!canExport || actionBusy}>
            <Download className="h-4 w-4" />
            Export
          </button>
          <button type="button" onClick={onBroadcast} className={`mixer-action-button ${isBroadcasting ? 'is-live' : ''}`} disabled={!canBroadcast || actionBusy}>
            <Radio className="h-4 w-4" />
            {isBroadcasting && <span className="mixer-live-indicator" />}
            {broadcastLabel}
          </button>
          {isBroadcasting && (
            <button type="button" onClick={onShare} className="mixer-action-button mixer-share-button" disabled={!canShare || actionBusy}>
              Share
            </button>
          )}
        </div>
        {(actionMessage || error) && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-[11px] ${error ? 'bg-red-500/10 text-red-300' : 'bg-emerald-400/10 text-emerald-200'}`}>
            {error || actionMessage}
          </p>
        )}
      </div>
    </aside>
  );
}
