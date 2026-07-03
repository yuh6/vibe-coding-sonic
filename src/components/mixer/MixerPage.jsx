import { useEffect, useMemo, useRef } from 'react';
import { useMixer } from '../../hooks/useMixer';
import SourcePanel from './SourcePanel';
import VersionPanel from './VersionPanel';
import TransportBar from './TransportBar';
import WaveformTrack from './WaveformTrack';
import ChannelStrip from './ChannelStrip';
import MasterStrip from './MasterStrip';
import EmptyStrip from './EmptyStrip';

const EMPTY_SLOTS = 8;

function importStatusText(incomingMix) {
  if (!incomingMix) return '';
  if (incomingMix.fallback) return 'Cached master loaded';
  if (incomingMix.status === 'splitting') {
    return incomingMix.stemProgress ? `Splitting stems ${incomingMix.stemProgress}` : 'Splitting stems';
  }
  if (incomingMix.stemStatus === 'failed') return `Stem split failed: ${incomingMix.stemError || 'using master only'}`;
  return `Loaded ${incomingMix.tracks?.length || 0} track${incomingMix.tracks?.length === 1 ? '' : 's'}`;
}

export default function MixerPage({ incomingMix = null }) {
  const mixer = useMixer();
  const importedSignatureRef = useRef('');
  const importJobRef = useRef('');

  const incomingTracks = useMemo(
    () => (incomingMix?.tracks || []).filter((track) => track?.url),
    [incomingMix]
  );

  useEffect(() => {
    if (!incomingMix?.jobId || incomingTracks.length === 0) return;
    const signature = `${incomingMix.jobId}:${incomingTracks.map((track) => `${track.name}:${track.url}`).join('|')}`;
    if (signature === importedSignatureRef.current) return;

    const replace = importJobRef.current !== incomingMix.jobId;
    importedSignatureRef.current = signature;
    importJobRef.current = incomingMix.jobId;
    mixer.addTracks(incomingTracks, { replace });
  }, [incomingMix, incomingTracks, mixer.addTracks]);

  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-12">
      <div className="min-w-0 space-y-4 lg:col-span-3">
        {incomingMix && (
          <div className="glass rounded-2xl p-4">
            <span className="deck-label">AI Import</span>
            <div className="mt-3 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
              <div className="truncate font-display text-sm font-semibold text-white/90" title={incomingMix.title}>
                {incomingMix.title || 'Generated mix'}
              </div>
              <div className="mt-1 font-mono text-[10px] text-amber-300">{importStatusText(incomingMix)}</div>
            </div>
          </div>
        )}
        <SourcePanel onAdd={mixer.addTrack} onAddMany={mixer.addTracks} loading={mixer.loading} />
        <VersionPanel
          getMixState={mixer.getMixState}
          onRestore={mixer.applySnapshot}
          trackCount={mixer.tracks.length}
        />
      </div>

      <div className="min-w-0 space-y-4 lg:col-span-9">
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="deck-label">Transport</span>
            {mixer.loading && <span className="font-mono text-[10px] text-amber-400">LOADING</span>}
          </div>
          <TransportBar
            playing={mixer.playing}
            time={mixer.time}
            duration={mixer.duration}
            loop={mixer.loop}
            hasTracks={mixer.tracks.length > 0}
            onPlay={mixer.play}
            onPause={mixer.pause}
            onStop={mixer.stop}
            onClearLoop={() => mixer.setLoop(null)}
          />
          {mixer.error && <p className="mt-2 text-[11px] text-red-400">{mixer.error}</p>}
        </div>

        <div className="glass rounded-2xl p-4">
          <span className="deck-label">Tracks</span>
          {mixer.tracks.length === 0 ? (
            <p className="mt-3 text-[11px] text-white/35">
              Generate with TTAPI, choose a library item, or load local audio files to populate the mixer.
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {mixer.tracks.map((track) => (
                <WaveformTrack
                  key={track.id}
                  track={track}
                  time={mixer.time}
                  duration={mixer.duration}
                  loop={mixer.loop}
                  onSeek={mixer.seek}
                  onLoopChange={mixer.setLoop}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass min-w-0 rounded-2xl p-4 lg:col-span-12">
        <span className="deck-label">Mixer Console</span>
        <div className="mt-3 flex items-stretch gap-2 overflow-x-auto pb-1">
          {mixer.tracks.map((track) => (
            <ChannelStrip
              key={track.id}
              track={track}
              engine={mixer.engine}
              onUpdate={(patch) => mixer.updateTrack(track.id, patch)}
              onRemove={() => mixer.removeTrack(track.id)}
            />
          ))}
          {Array.from({ length: Math.max(0, EMPTY_SLOTS - mixer.tracks.length) }, (_, index) => (
            <EmptyStrip key={`empty-${index}`} index={mixer.tracks.length + index + 1} />
          ))}
          <div className="w-px flex-none self-stretch bg-white/15" />
          <MasterStrip engine={mixer.engine} master={mixer.master} onUpdate={mixer.updateMaster} />
        </div>
      </div>
    </div>
  );
}
