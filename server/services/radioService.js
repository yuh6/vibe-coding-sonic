/**
 * 电台服务 — 用户可公开自己的 arranger session 为电台，其他人实时同步收听
 */
import { randomUUID } from 'crypto';
import { db } from '../db.js';

export async function goLive(userId, { title, description = '', sessionId, mode, mbti }) {
  // 一个用户同时只能开一个电台
  await db.prepare('UPDATE radio_stations SET is_live = 0 WHERE user_id = ? AND is_live = 1').run(userId);

  const id = randomUUID();
  await db.prepare(
    `INSERT INTO radio_stations (id, user_id, title, description, mode, mbti, is_live, listener_count, session_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
  ).run(id, userId, title, description, mode || null, mbti || null, sessionId || null, Date.now());
  return { id, title, description, isLive: true, listenerCount: 0 };
}

export async function goOffline(stationId, userId) {
  const result = await db.prepare(
    'UPDATE radio_stations SET is_live = 0 WHERE id = ? AND user_id = ?'
  ).run(stationId, userId);
  return result.changes > 0;
}

export async function updateNowPlaying(stationId, trackId) {
  await db.prepare(
    'UPDATE radio_stations SET current_track_id = ?, current_track_started_at = ? WHERE id = ?'
  ).run(trackId, Date.now(), stationId);
}

export async function updateNowPlayingSnapshot(stationId, userId, track) {
  const title = String(track?.title || track?.moodTag || 'Untitled Track').slice(0, 160);
  const genre = track?.genre ? String(track.genre).slice(0, 120) : null;
  const bpm = Number.isFinite(Number(track?.bpm)) ? Number(track.bpm) : null;
  const audioUrl = track?.audioUrl || track?.audioLocal || null;

  if (!audioUrl) return false;

  const result = await db.prepare(
    `UPDATE radio_stations
     SET current_track_id = NULL,
         current_track_title = ?,
         current_track_genre = ?,
         current_track_bpm = ?,
         current_track_audio_url = ?,
         current_track_started_at = ?
     WHERE id = ? AND user_id = ? AND is_live = 1`
  ).run(title, genre, bpm, audioUrl, Date.now(), stationId, userId);

  return result.changes > 0;
}

export async function updateStationInfo(stationId, userId, { title, description, mode }) {
  const result = await db.prepare(
    `UPDATE radio_stations SET title = COALESCE(?, title), description = COALESCE(?, description),
     mode = COALESCE(?, mode) WHERE id = ? AND user_id = ?`
  ).run(title || null, description ?? null, mode || null, stationId, userId);
  return result.changes > 0;
}

export async function joinStation(stationId) {
  await db.prepare('UPDATE radio_stations SET listener_count = listener_count + 1 WHERE id = ?').run(stationId);
}

export async function leaveStation(stationId) {
  await db.prepare(
    'UPDATE radio_stations SET listener_count = CASE WHEN listener_count > 0 THEN listener_count - 1 ELSE 0 END WHERE id = ?'
  ).run(stationId);
}

export async function getStation(stationId) {
  const s = await db.prepare(
    `SELECT r.*, u.name as user_name, sl.title as track_title, sl.genre as track_genre,
            sl.bpm as track_bpm, COALESCE(sl.audio_local, sl.audio_url) as track_audio_url
     FROM radio_stations r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN shared_library sl ON sl.id = r.current_track_id
     WHERE r.id = ?`
  ).get(stationId);
  if (!s) return null;
  return formatStation(s);
}

export async function listLiveStations({ page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const total = Number((await db.prepare('SELECT COUNT(*) as cnt FROM radio_stations WHERE is_live = 1').get())?.cnt || 0);
  const rows = await db.prepare(
    `SELECT r.*, u.name as user_name, sl.title as track_title, sl.genre as track_genre,
            sl.bpm as track_bpm, COALESCE(sl.audio_local, sl.audio_url) as track_audio_url
     FROM radio_stations r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN shared_library sl ON sl.id = r.current_track_id
     WHERE r.is_live = 1
     ORDER BY r.listener_count DESC, r.created_at DESC
     LIMIT ? OFFSET ?`
  ).all(limit, offset);
  return { total, page, limit, stations: rows.map(formatStation) };
}

export async function getStationBySession(sessionId) {
  const s = await db.prepare('SELECT id FROM radio_stations WHERE session_id = ? AND is_live = 1').get(sessionId);
  return s?.id || null;
}

function formatStation(s) {
  const snapshotTrack = s.current_track_audio_url ? {
    id: null,
    title: s.current_track_title,
    genre: s.current_track_genre,
    bpm: s.current_track_bpm,
    audioUrl: s.current_track_audio_url,
    startedAt: s.current_track_started_at,
  } : null;

  const sharedTrack = s.current_track_id ? {
    id: s.current_track_id,
    title: s.track_title,
    genre: s.track_genre,
    bpm: s.track_bpm,
    audioUrl: s.track_audio_url,
    startedAt: s.current_track_started_at,
  } : null;

  return {
    id: s.id, userId: s.user_id, userName: s.user_name,
    title: s.title, description: s.description,
    mode: s.mode, mbti: s.mbti,
    isLive: Boolean(s.is_live), listenerCount: Number(s.listener_count || 0),
    currentTrack: snapshotTrack || sharedTrack,
    sessionId: s.session_id, createdAt: s.created_at,
  };
}
