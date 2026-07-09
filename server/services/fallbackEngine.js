import { refundGenerationCredits } from './creditService.js';
import { pickFromSharedLibrary } from './libraryStore.js';
import { pickFromCatalog, seedFallbackTracks } from './songCatalog.js';
import { masterTracks, saveJobToDB } from './jobStore.js';
import { saveUserTrack } from './audioPersistor.js';

export async function completeWithFallbackJob(job, { delayMs = 0, reason = 'fallback', emitJob = () => {} } = {}) {
  const finish = async () => {
    const shared = await pickFromCatalog({
      mode: job.mode,
      mbti: job.mbti,
      genre: job.selectedGenre || job.profile?.genre,
      bpm: job.bpm,
      excludeJobIds: [job.id],
    }) || await pickFromSharedLibrary({
      mode: job.mode,
      mbti: job.mbti,
      genre: job.selectedGenre || job.profile?.genre,
      bpm: job.bpm,
    });
    const track = shared || await seedFallbackTracks({ mode: job.mode, mbti: job.mbti });
    if (!track) {
      job.status = 'failed';
      job.error = 'No fallback track available';
      await saveJobToDB(job);
      emitJob('generation:failed', job, { reason: job.error });
      await refundGenerationCredits(job.userId, job.id, { fallbackSource: 'empty', reason }).catch(() => {});
      return job;
    }

    const url = track.audioLocal || track.audioUrl || track.url;
    job.status = 'completed';
    job.audioUrl = url;
    job.audioLocal = track.audioLocal || url;
    job.title = track.title || job.title;
    job.fallbackTitle = track.title || null;
    job.tracks = masterTracks({ url, title: track.title || 'Fallback' });
    job.fallback = true;
    job.fallbackSource = track.source || (shared ? 'song_catalog' : 'manifest');
    job.completedAt = Date.now();
    job.stemStatus = 'skipped';
    await saveJobToDB(job);
    await saveUserTrack(job);
    await refundGenerationCredits(job.userId, job.id, { fallbackSource: job.fallbackSource, reason }).catch((err) => {
      console.warn('[pipeline] credit refund skipped:', err.message);
    });
    emitJob('generation:completed', job, { fallback: true });
    emitJob('stem:status', job, { stemStatus: 'skipped' });
    return job;
  };

  if (delayMs > 0) {
    setTimeout(() => finish().catch(console.error), delayMs);
    return job;
  }
  return finish();
}
