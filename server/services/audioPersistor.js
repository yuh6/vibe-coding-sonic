import { dal } from '../db.js';
import { storage } from '../storage/index.js';
import { saveTrack } from './quotaService.js';
import { upsertCatalog, updateCatalogAudioLocal } from './songCatalog.js';
import { getPlaybackTracks, getPlaybackUrl, normalizeDurationSec, saveJobToDB } from './jobStore.js';

export async function upsertSharedLibraryTrack(job, { audioLocal = job.audioLocal || null } = {}) {
  if (!job.audioUrl || job.fallback) return;
  await dal.run(
    `INSERT INTO shared_library
     (id, user_id, title, mbti, mode, genre, tags, mood, bpm, audio_url, audio_local, duration_sec, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       genre = excluded.genre,
       tags = excluded.tags,
       mood = excluded.mood,
       bpm = excluded.bpm,
       audio_url = excluded.audio_url,
       audio_local = COALESCE(excluded.audio_local, shared_library.audio_local),
       duration_sec = excluded.duration_sec`,
    [
      job.id,
      job.userId || null,
      job.title || `${job.mbti} · ${job.mode}`,
      job.mbti,
      job.mode,
      job.selectedGenre || job.profile?.genre || null,
      job.fullPrompt || null,
      job.layers?.mode || null,
      job.bpm || null,
      job.audioUrl,
      audioLocal,
      normalizeDurationSec(job.duration),
      Date.now(),
    ]
  );
}

export async function persistJobAudio(job, { emitJob = null } = {}) {
  if (!job.audioUrl || job.fallback) return;
  await upsertSharedLibraryTrack(job);
  await upsertCatalog({
    id: job.id,
    source: 'generated',
    audioUrl: job.audioUrl,
    audioLocal: job.audioLocal || null,
    musicId: job.musicId,
    title: job.title,
    duration: job.duration,
    prompt: job.fullPrompt,
    mbti: job.mbti,
    mode: job.mode,
    genre: job.selectedGenre || job.profile?.genre || null,
    bpm: job.bpm,
    userId: job.userId,
  });

  try {
    const res = await fetch(job.audioUrl);
    if (!res.ok || !res.body) {
      console.warn('[pipeline] audio fetch failed:', res.status);
      return;
    }
    const publicUrl = await storage.upload(`audio/${job.id}.mp3`, res.body, 'audio/mpeg');
    job.audioLocal = publicUrl;
    job.tracks = getPlaybackTracks(job);
    await upsertSharedLibraryTrack(job, { audioLocal: publicUrl });
    await updateCatalogAudioLocal(job.id, publicUrl);
    await dal.run('UPDATE generation_jobs SET audio_local = ?, tracks_json = ? WHERE id = ?', [
      publicUrl,
      JSON.stringify(job.tracks || []),
      job.id,
    ]);
    await dal.run('UPDATE tracks SET audio_url = ?, tracks_json = ? WHERE id = ?', [
      publicUrl,
      JSON.stringify(getPlaybackTracks(job)),
      job.id,
    ]).catch(() => {});
    await saveJobToDB(job);
    emitJob?.('generation:completed', job);
  } catch (err) {
    console.warn('[pipeline] audio upload/save failed:', err.message);
  }
}

export async function saveUserTrack(job) {
  if (!job.userId || !getPlaybackUrl(job)) return;
  try {
    await saveTrack({
      jobId: job.id,
      userId: job.userId,
      title: job.title || job.fallbackTitle || `${job.mbti} · ${job.mode}`,
      mbti: job.mbti,
      mode: job.mode,
      prompt: job.fullPrompt,
      audioUrl: getPlaybackUrl(job),
      tracks: getPlaybackTracks(job),
      fallback: job.fallback,
    });
    job.savedToLibrary = true;
  } catch (err) {
    console.error('[pipeline] saveTrack failed:', err.message);
  }
}
