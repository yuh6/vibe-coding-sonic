import { useMixer } from '../../hooks/useMixer';
import SourcePanel from './SourcePanel';
import VersionPanel from './VersionPanel';
import TransportBar from './TransportBar';
import WaveformTrack from './WaveformTrack';
import ChannelStrip from './ChannelStrip';
import MasterStrip from './MasterStrip';

export default function MixerPage() {
  const mixer = useMixer();

  return (
    <div className="grid gap-4 lg:grid-cols-12">
      {/* 左：音源 + 版本 */}
      <div className="space-y-4 lg:col-span-3">
        <SourcePanel onAdd={mixer.addTrack} loading={mixer.loading} />
        <VersionPanel
          getMixState={mixer.getMixState}
          onRestore={mixer.applySnapshot}
          trackCount={mixer.tracks.length}
        />
      </div>

      {/* 右：Transport + 波形 + 调音台 */}
      <div className="space-y-4 lg:col-span-9">
        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="deck-label">Transport</span>
            {mixer.loading && <span className="font-mono text-[10px] text-amber-500">LOADING…</span>}
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
            <p className="mt-3 text-[11px] text-faint">
              从左侧音乐库挑一首，或选本地音频文件（多选可模拟分轨），加载后这里会显示波形。
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {mixer.tracks.map((t) => (
                <WaveformTrack
                  key={t.id}
                  track={t}
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

        <div className="glass rounded-2xl p-4">
          <span className="deck-label">Mixer Console</span>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {mixer.tracks.map((t) => (
              <ChannelStrip
                key={t.id}
                track={t}
                engine={mixer.engine}
                onUpdate={(patch) => mixer.updateTrack(t.id, patch)}
                onRemove={() => mixer.removeTrack(t.id)}
              />
            ))}
            <MasterStrip engine={mixer.engine} master={mixer.master} onUpdate={mixer.updateMaster} />
          </div>
        </div>
      </div>
    </div>
  );
}
