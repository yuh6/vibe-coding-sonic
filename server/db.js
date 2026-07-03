import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data/app.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
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

-- === Arranger 编排引擎（docs/ai-music-engine-design.md §10.1） ===

-- 会话（一次黑客松）；user_id 用于与多用户架构集成（文档 v3 修订说明）
CREATE TABLE IF NOT EXISTS sessions (
  id            TEXT PRIMARY KEY,
  user_id       TEXT REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT,
  mbti_type     TEXT,
  mbti_sliders  TEXT,               -- JSON: { IE, SN, TF, JP }
  schedule_json TEXT,               -- 日程 JSON
  budget_limit  REAL DEFAULT 10.0,  -- 每日预算上限（美元）
  budget_spent  REAL DEFAULT 0,     -- 已花费
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 曲库池（编排引擎用，唯一曲目来源）
CREATE TABLE IF NOT EXISTS track_pool (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  phase          TEXT NOT NULL,
  mood_tag       TEXT NOT NULL,
  energy_level   INTEGER NOT NULL,       -- 0-100
  genre          TEXT NOT NULL,
  instruments    TEXT,                    -- JSON array
  prompt_config  TEXT NOT NULL,           -- Suno 请求配置 JSON
  audio_url      TEXT,
  audio_local    TEXT,                    -- 本地缓存路径
  duration_sec   INTEGER,
  play_count     INTEGER DEFAULT 0,
  last_played_at DATETIME,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_track_pool_session ON track_pool(session_id, phase);

-- 播放历史（编排引擎决策用）
CREATE TABLE IF NOT EXISTS play_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  track_pool_id INTEGER NOT NULL REFERENCES track_pool(id),
  phase         TEXT NOT NULL,
  started_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at      DATETIME,
  user_skipped  BOOLEAN DEFAULT 0        -- 用户是否手动跳过
);
CREATE INDEX IF NOT EXISTS idx_play_history_session ON play_history(session_id, started_at DESC);

-- 项目缓存（LLM 分析结果）
CREATE TABLE IF NOT EXISTS project_cache (
  folder_path   TEXT PRIMARY KEY,
  analysis_json TEXT NOT NULL,
  analyzed_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

export function today() {
  return new Date().toISOString().slice(0, 10);
}
