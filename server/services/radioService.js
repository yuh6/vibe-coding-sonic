/**
 * 电台服务 — 用户可公开自己的 arranger session 为电台，其他人实时同步收听
 */
import { randomUUID } from 'crypto';
import { db } from '../db.js';

export function goLive(userId, { title, description = '', sessionId, mode, mbti }) {
  // 一个用户同时只能开一个电台
  db.prepare('UPDATE radio_stations SET is_live = 0 WHERE user_id = ? AND is_live = 1').run(userId);

  const id = randomUUID();
  db.prepare(
    `INSERT INTO radio_stations (id, user_id, title, description, mode, mbti, is_live, listener_count, session_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?)`
  ).run(id, userId, title, description, mode || null, mbti || null, sessionId || null, Date.now());
  return { id, title, description, isLive: true, listenerCount: 0 };
}

export function goOffline(stationId, userId) {
  const result = db.prepare(
    'UPDATE radio_stations SET is_live = 0 WHERE id = ? AND user_id = ?'
  ).run(stationId, userId);
  return result.changes > 0;
}

export function updateNowPlaying(stationId, trackId) {
  db.prepare(
    'UPDATE radio_stations SET current_track_id = ?, current_track_started_at = ? WHERE id = ?'
  ).run(trackId, Date.now(), stationId);
}

export function updateStationInfo(stationId, userId, { title, description, mode }) {
  const result = db.prepare(
    `UPDATE radio_stations SET title = COALESCE(?, title), description = COALESCE(?, description),
     mode = COALESCE(?, mode) WHERE id = ? AND user_id = ?`
  ).run(title || null, description ?? null, mode || null, stationId, userId);
  return result.changes > 0;
}

export function joinStation(stationId) {
  db.prepare('UPDATE radio_stations SET listener_count = listener_count + 1 WHERE id = ?').run(stationId);
}

export function leaveStation(stationId) {
  db.prepare('UPDATE radio_stations SET listener_count = MAX(0, listener_count - 1) WHERE id = ?').run(stationId);
}

export function getStation(stationId) {
  const s = db.prepare(
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

export function listLiveStations({ page = 1, limit = 20 } = {}) {
  const offset = (Math.max(1, page) - 1) * limit;
  const total = db.prepare('SELECT COUNT(*) as cnt FROM radio_stations WHERE is_live = 1').get()?.cnt || 0;
  const rows = db.prepare(
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

export function getStationBySession(sessionId) {
  const s = db.prepare('SELECT id FROM radio_stations WHERE session_id = ? AND is_live = 1').get(sessionId);
  return s?.id || null;
}

function formatStation(s) {
  return {
    id: s.id, userId: s.user_id, userName: s.user_name,
    title: s.title, description: s.description,
    mode: s.mode, mbti: s.mbti,
    isLive: Boolean(s.is_live), listenerCount: s.listener_count,
    currentTrack: s.current_track_id ? {
      id: s.current_track_id, title: s.track_title,
      genre: s.track_genre, bpm: s.track_bpm,
      audioUrl: s.track_audio_url,
      startedAt: s.current_track_started_at,
    } : null,
    sessionId: s.session_id, createdAt: s.created_at,
  };
}
