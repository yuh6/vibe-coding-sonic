/**
 * 数据库迁移 — 兼容 SQLite / PostgreSQL 的 DDL
 *
 * SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
 * PG:     SERIAL PRIMARY KEY 或 TEXT PRIMARY KEY
 *
 * 策略：统一使用 TEXT PRIMARY KEY（UUID），自增序列用 SERIAL（PG）/ INTEGER AUTOINCREMENT（SQLite）
 * 在本项目中，所有主键均为 TEXT（UUID），仅 playlist_tracks/play_history/track_pool 用自增 id。
 */

const MIGRATIONS_SQLITE = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT DEFAULT 'user',
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS profiles (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  axes_json  TEXT,
  style_json TEXT,
  mode       TEXT,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS tracks (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT,
  mbti        TEXT,
  mode        TEXT,
  prompt      TEXT,
  audio_url   TEXT,
  tracks_json TEXT,
  fallback    INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tracks_user ON tracks(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS quotas (
  user_id TEXT NOT NULL,
  day     TEXT NOT NULL,
  used    INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  mbti_type     TEXT,
  mbti_sliders  TEXT,
  schedule_json TEXT,
  budget_limit  REAL DEFAULT 10.0,
  budget_spent  REAL DEFAULT 0,
  created_at    TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS track_pool (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  phase          TEXT NOT NULL,
  mood_tag       TEXT NOT NULL,
  energy_level   INTEGER NOT NULL,
  genre          TEXT NOT NULL,
  instruments    TEXT,
  prompt_config  TEXT NOT NULL,
  audio_url      TEXT,
  audio_local    TEXT,
  duration_sec   INTEGER,
  play_count     INTEGER DEFAULT 0,
  last_played_at TEXT,
  created_at     TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_track_pool_session ON track_pool(session_id, phase);

CREATE TABLE IF NOT EXISTS play_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  track_pool_id INTEGER NOT NULL REFERENCES track_pool(id),
  phase         TEXT NOT NULL,
  started_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  ended_at      TEXT,
  user_skipped  INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_play_history_session ON play_history(session_id, started_at DESC);

CREATE TABLE IF NOT EXISTS project_cache (
  folder_path   TEXT PRIMARY KEY,
  analysis_json TEXT NOT NULL,
  analyzed_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shared_library (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  title         TEXT,
  mbti          TEXT,
  mode          TEXT,
  genre         TEXT,
  tags          TEXT,
  mood          TEXT,
  bpm           INTEGER,
  audio_url     TEXT,
  audio_local   TEXT,
  duration_sec  INTEGER,
  play_count    INTEGER DEFAULT 0,
  quality_score REAL DEFAULT 0,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shared_lib_mode  ON shared_library(mode);
CREATE INDEX IF NOT EXISTS idx_shared_lib_mbti  ON shared_library(mbti);
CREATE INDEX IF NOT EXISTS idx_shared_lib_genre ON shared_library(genre);
CREATE INDEX IF NOT EXISTS idx_shared_lib_bpm   ON shared_library(bpm);

CREATE TABLE IF NOT EXISTS playlists (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  is_public   INTEGER DEFAULT 1,
  play_count  INTEGER DEFAULT 0,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playlists_public ON playlists(is_public, play_count DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_user   ON playlists(user_id);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL,
  position    INTEGER NOT NULL,
  added_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_pl ON playlist_tracks(playlist_id, position);

CREATE TABLE IF NOT EXISTS radio_stations (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  mode        TEXT,
  mbti        TEXT,
  is_live     INTEGER DEFAULT 0,
  listener_count INTEGER DEFAULT 0,
  current_track_id TEXT,
  current_track_started_at INTEGER,
  session_id  TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_radio_live ON radio_stations(is_live, listener_count DESC);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT,
  status          TEXT NOT NULL DEFAULT 'processing',
  mbti            TEXT,
  mode            TEXT,
  full_prompt     TEXT,
  negative_tags   TEXT,
  bpm             INTEGER,
  weirdness       INTEGER,
  style_weight    INTEGER,
  suno_task_id    TEXT,
  music_id        TEXT,
  audio_url       TEXT,
  audio_local     TEXT,
  title           TEXT,
  duration_sec    INTEGER,
  tracks_json     TEXT,
  layers_json     TEXT,
  profile_json    TEXT,
  fallback        INTEGER DEFAULT 0,
  fallback_source TEXT,
  error           TEXT,
  split_stems     INTEGER DEFAULT 1,
  stem_task_id    TEXT,
  stem_status     TEXT DEFAULT 'idle',
  created_at      INTEGER NOT NULL,
  completed_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_jobs_user ON generation_jobs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);

-- === Phase 2: 收藏 + 评分 ===

CREATE TABLE IF NOT EXISTS favorites (
  user_id    TEXT NOT NULL,
  track_id   TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ratings (
  user_id    TEXT NOT NULL,
  track_id   TEXT NOT NULL,
  score      INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX IF NOT EXISTS idx_ratings_track ON ratings(track_id);

-- === Phase 2: 用户播放历史（推荐用） ===

CREATE TABLE IF NOT EXISTS user_play_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  track_id    TEXT NOT NULL,
  duration_sec INTEGER,
  completed   INTEGER DEFAULT 0,
  played_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_uph_user ON user_play_history(user_id, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_uph_track ON user_play_history(track_id);
`;

// PostgreSQL 版本 — 语法差异：SERIAL 替代 AUTOINCREMENT，BOOLEAN 替代 INTEGER 0/1
const MIGRATIONS_PG = MIGRATIONS_SQLITE
  .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
  .replace(/CREATE INDEX IF NOT EXISTS/g, 'CREATE INDEX IF NOT EXISTS')
  .replace(/INTEGER DEFAULT 0/g, 'INTEGER DEFAULT 0')  // 保持兼容
  .replace(/TEXT DEFAULT CURRENT_TIMESTAMP/g, "TIMESTAMPTZ DEFAULT NOW()");

export function getMigrationSQL(driver) {
  return driver === 'pg' ? MIGRATIONS_PG : MIGRATIONS_SQLITE;
}
