/**
 * 播放列表服务 — 用户创建和管理��曲合集
 */
import { randomUUID } from 'crypto';
import { db } from '../db.js';

export async function createPlaylist(userId, { title, description = '' }) {
  const id = randomUUID();
  const now = Date.now();
  await db.prepare(
    `INSERT INTO playlists (id, user_id, title, description, is_public, play_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, 0, ?, ?)`
  ).run(id, userId, title, description, now, now);
  return { id, title, description, isPublic: true, playCount: 0, trackCount: 0, createdAt: now };
}

export async function updatePlaylist(playlistId, userId, { title, description, isPublic }) {
  const pl = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
  if (!pl) return null;
  await db.prepare(
    `UPDATE playlists SET title = COALESCE(?, title), description = COALESCE(?, description),
     is_public = COALESCE(?, is_public), updated_at = ? WHERE id = ?`
  ).run(title || null, description ?? null, isPublic != null ? (isPublic ? 1 : 0) : null, Date.now(), playlistId);
  return getPlaylist(playlistId);
}

export async function deletePlaylist(playlistId, userId) {
  const result = await db.prepare('DELETE FROM playlists WHERE id = ? AND user_id = ?').run(playlistId, userId);
  return result.changes > 0;
}

export async function getPlaylist(playlistId) {
  const pl = await db.prepare('SELECT * FROM playlists WHERE id = ?').get(playlistId);
  if (!pl) return null;
  const tracks = await db.prepare(
    `SELECT pt.position, pt.added_at, sl.*
     FROM playlist_tracks pt
     JOIN shared_library sl ON sl.id = pt.track_id
     WHERE pt.playlist_id = ?
     ORDER BY pt.position`
  ).all(playlistId);
  return {
    id: pl.id, userId: pl.user_id, title: pl.title, description: pl.description,
    isPublic: Boolean(pl.is_public), playCount: pl.play_count,
    createdAt: pl.created_at, updatedAt: pl.updated_at,
    tracks: tracks.map((t) => ({
      id: t.id, title: t.title, genre: t.genre, bpm: t.bpm, mbti: t.mbti, mode: t.mode,
      audioUrl: t.audio_local || t.audio_url, position: t.position,
    })),
  };
}

export async function listPublicPlaylists({ sort = 'popular', page = 1, limit = 20 }) {
  const offset = (Math.max(1, page) - 1) * limit;
  const orderBy = sort === 'newest' ? 'created_at DESC' : 'play_count DESC';
  const total = Number((await db.prepare("SELECT COUNT(*) as cnt FROM playlists WHERE is_public = 1").get())?.cnt || 0);
  const rows = await db.prepare(
    `SELECT p.id, p.user_id, p.title, p.description, p.is_public, p.play_count, p.created_at, p.updated_at,
            COUNT(pt.id) as track_count, MAX(u.name) as user_name
     FROM playlists p
     LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.is_public = 1
     GROUP BY p.id, p.user_id, p.title, p.description, p.is_public, p.play_count, p.created_at, p.updated_at
     ORDER BY ${orderBy} LIMIT ? OFFSET ?`
  ).all(limit, offset);

  return {
    total, page, limit,
    playlists: rows.map((r) => ({
      id: r.id, title: r.title, description: r.description,
      userName: r.user_name, playCount: r.play_count,
      trackCount: Number(r.track_count || 0), createdAt: r.created_at,
    })),
  };
}

export async function addTrackToPlaylist(playlistId, userId, trackId) {
  const pl = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
  if (!pl) return null;
  const track = await db.prepare('SELECT id FROM shared_library WHERE id = ?').get(trackId);
  if (!track) return null;
  const maxPos = (await db.prepare('SELECT MAX(position) as mp FROM playlist_tracks WHERE playlist_id = ?').get(playlistId))?.mp || 0;
  await db.prepare(
    'INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)'
  ).run(playlistId, trackId, maxPos + 1, Date.now());
  await db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId);
  return { position: maxPos + 1 };
}

export async function removeTrackFromPlaylist(playlistId, userId, trackId) {
  const pl = await db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(playlistId, userId);
  if (!pl) return false;
  const result = await db.prepare(
    'DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?'
  ).run(playlistId, trackId);
  if (result.changes > 0) {
    await db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').run(Date.now(), playlistId);
  }
  return result.changes > 0;
}

export async function recordPlaylistPlay(playlistId) {
  await db.prepare('UPDATE playlists SET play_count = play_count + 1 WHERE id = ?').run(playlistId);
}

export async function getUserPlaylists(userId) {
  const rows = await db.prepare(
    `SELECT p.id, p.user_id, p.title, p.description, p.is_public, p.play_count, p.created_at, p.updated_at,
            COUNT(pt.id) as track_count
     FROM playlists p LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
     WHERE p.user_id = ?
     GROUP BY p.id, p.user_id, p.title, p.description, p.is_public, p.play_count, p.created_at, p.updated_at
     ORDER BY p.updated_at DESC`
  ).all(userId);
  return rows.map((r) => ({
    id: r.id, title: r.title, description: r.description,
    isPublic: Boolean(r.is_public), playCount: r.play_count,
    trackCount: Number(r.track_count || 0), createdAt: r.created_at,
  }));
}
