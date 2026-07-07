# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MBTIWAVE** — MBTI × Hackathon AI DJ Console. Generates personalized BGM during hackathons based on MBTI personality, project context, and work phase. Uses TTAPI proxy to Suno API (V5/chirp-v5) for music generation with a multi-tier fallback system.

**Default entry**: empty hash redirects to `#/mbtiwave` (marketing-style homepage). Classic DJ console lives at `#/`.

## Commands

```bash
# Development (frontend + backend concurrently)
npm run dev

# Frontend only (Vite dev server, port 5173)
npm run dev:client

# Backend only (with --watch auto-restart, port 3001)
npm run dev:server

# Production build
npm run build

# Start production server (serves built frontend)
npm start

# Tests (no Jest/Vitest — plain Node scripts)
npm test                  # fallback coverage + smoke
npm run test:fallback     # 七阶段 + 16 人格兜底曲库覆盖
npm run test:smoke        # E2E: auth / prompt / fallback generate / status

# Regenerate fallback manifest via TTAPI (requires TTAPI_KEY)
npm run generate:fallback
```

No linter is configured.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TailwindCSS + Framer Motion + Lucide icons (SPA at `src/`)
- **Backend**: Express.js on port 3001 (`server/`)
- **Database**: SQLite (default) or PostgreSQL via `DB_DRIVER` — DAL at `server/db/index.js`, migrations at `server/db/migrations.js`
- **Cache**: In-memory LRU (default) or Redis via `REDIS_URL` — `server/cache/index.js`; also Redis Pub/Sub for arranger events across instances
- **Object storage**: Local `server/data/audio-cache/` (default) or S3-compatible R2/S3/OSS via `STORAGE_DRIVER` — `server/storage/index.js`
- **Module system**: ESM throughout (`"type": "module"` in package.json)

### Hash Routes

| Route | Page |
|-------|------|
| `#/mbtiwave` | Homepage (default when hash is empty) |
| `#/` | Classic DJ console (3-column layout) |
| `#/discover` | Discover: radio, playlists, shared library, recommendations |
| `#/mixer` | Multi-track mixer (Web Audio) |
| `#/admin` | Admin panel (API keys, library, quota, users) |

### Core Data Flow

```
User DJ Console → composePrompt() → submitGeneration() (TTAPI/Suno) → pollGeneration()
                                                                          ↓
                                                          applyGeneratedMusic() → persistTrackAsync()
                                                                          ↓                    ↓
                                                                    stem separation    storage.upload() → R2/local
                                                                          ↓                    ↓
                                                                      completed        shared_library + generation_jobs
```

When quota is exhausted or Suno fails: `completeWithFallback()` → tries `shared_library` table (smart match by mode/genre/mbti/bpm) → falls back to `fallback_tracks` DB table (seeded from `fallback-manifest.json`).

### Key Services (`server/services/`)

- **promptComposer.js**: Assembles Suno V5 prompts following priority order: genre → instruments → mood → BPM → production quality. Reads `mbti-profiles.json`. Returns `{fullPrompt, negativeTags, layers, bpm, weirdnessConstraint, styleWeight}`.
- **musicOrchestrator.js**: Job lifecycle manager. **Dual-layer**: `generation_jobs` table (persistent) + in-memory hot cache (TTL 30min). Handles creation → Suno submission → polling → completion/fallback. Async audio upload via `storage` + `shared_library` insertion on completion.
- **sunoClient.js**: TTAPI proxy client. POSTs to `{TTAPI_BASE_URL}/suno/v1/music`. Polls task status. Also handles stem separation.
- **libraryStore.js**: Three-tier fallback: `shared_library` (user-generated, local/R2 cache) + `fallback_tracks` (DB) + static `fallback-manifest.json` (seed). `pickFromSharedLibrary()` does 4-level priority matching.
- **quotaService.js**: Per-identity total generation quota (`GUEST_GENERATION_LIMIT` / `USER_GENERATION_LIMIT`, default 30 each, admin-configurable) + global daily limit (`GLOBAL_DAILY_LIMIT`, default 100). VIP/admin roles are exempt from quota checks. Includes refund on Suno failure. Also handles user profiles and personal track library.
- **authService.js**: Register/login, HttpOnly session cookies, auto guest identity via `GUEST_COOKIE`.
- **lyricsGenerator.js**: LLM-based lyrics with Suno structure tags (`[Verse]`, `[Chorus]`, etc.). Vocal style recommendations by MBTI.
- **llm/index.js**: 11-provider LLM router (openai, anthropic, gemini, deepseek, siliconflow, openrouter, custom, + 4 CLI). Project analysis with SHA-256 cache.
- **recommendService.js**: Popular tracks, for-you recommendations, play history.
- **radioService.js**: Live radio stations tied to arranger sessions; listener counts; now-playing snapshots.
- **playlistService.js** / **favoriteService.js**: Public playlists, favorites, 1–5 star ratings.
- **genreStyles.js**: Genre/style catalog exposed via `/api/styles`.

### Arranger Engine (`server/services/arranger/`)

Continuous DJ sessions with automated phase transitions, energy curves, concurrent Suno generation scheduling, real-time user feedback sensing, and crossfade mixing. Real-time events pushed via:
- `/ws/events` — arranger events (track_changed, phase_changed, pool_refill, etc.)
- `/ws/radio` — radio station track_change broadcasts

Both use hand-written WebSocket server (`server/ws/wsServer.js`, RFC 6455, zero deps). Arranger events also broadcast via Redis Pub/Sub when `REDIS_URL` is set.

### Frontend Structure (`src/`)

- **App.jsx**: Hash router + lazy-loaded sub-pages; classic DJ console state (axes, style, mode, project, arranger).
- **MBTIWAVE.jsx**: Homepage with hero video, solo remix deck, arranger integration, live radio.
- **DiscoverPage.jsx**: Radio tuning, playlists, shared library browser, favorites/history/for-you.
- All state managed via `useState`/`useRef` — no external state library.

### Auth & Middleware

- **Guest + user auth**: `requireIdentity` auto-creates guest via `GUEST_COOKIE`; registered users get `SESSION_COOKIE` (`server/middleware/userAuth.js`)
- **Admin auth**: `X-Admin-Token` header checked against `ADMIN_TOKEN` env var (`server/middleware/adminAuth.js`)
- **Rate limits**: `server/middleware/rateLimit.js` on auth, paid generation, lyrics, notes parsing

### Seven Work Phases

`brainstorm`, `focus`, `sprint`, `charge`, `behind`, `break`, `celebrate` — each has distinct BPM delta, style tags, production style, and Suno weirdness/styleWeight parameters in `PHASE_PRESETS`.

### Audio Stacks

Two independent audio systems coexist — do not use both simultaneously:
- **Howler.js** (`usePlayer` hook) — simple single-track playback for the DJ console
- **Web Audio API** (`useMixer`/`useArranger` hooks) — multi-track mixer and auto-DJ crossfade for the arranger engine

### Dependency Map

```
promptComposer ──► mbti-profiles.json
musicOrchestrator ──► promptComposer + sunoClient + libraryStore + quotaService + storage
llm/index ──► llm/httpProviders ──► OpenAI / Anthropic / Gemini / etc.
arranger/ ──► sunoClient + promptComposer + dal (track_pool, sessions)
radioService ──► arranger events + dal (radio_stations)
All DB users ──► dal (server/db/index.js) ──► sqlite.js | pg.js
runtimeConfig ──► app_settings table (legacy JSON import on first boot)
```

## Critical Implementation Details

- **LLM HTTP providers** (`llm/httpProviders.js`): `callOpenAiCompatible(config, prompt)` takes config and prompt as **two separate arguments**. The prompt is NOT inside the config object. Same for `callAnthropic` and `callGemini`.
- **TTAPI CDN URLs expire** (~24h). `musicOrchestrator.persistTrackAsync()` uploads audio via `storage.upload()` (local or R2). The `shared_library` / `generation_jobs` tables store both `audio_url` (CDN, may expire) and `audio_local` (persistent path/URL).
- **TTAPI response shapes are inconsistent** — `sunoClient.js` tries multiple field paths (camelCase/snake_case, `data.X`/`data.data.X`) for each access. Follow this pattern when modifying.
- **Suno prompt rules**: Style field ≤200 chars, genre must be first, no negation words in style (use `negative_tags`/Exclude instead), keep negative_tags to 2-6 words. See `docs/20260703_Suno_AI_全面使用手册_音乐生成工程指南.md` for comprehensive Suno V5 best practices.
- **Jobs are DB-backed** — `generation_jobs` table survives restart; in-memory `hotCache` is performance layer only (30min TTL). Polling is client-driven (`refreshJob` on GET `/status/:id`), not background.
- **MBTI fallbacks are silent** — `getTheme()` and `axesFromMbti()` return INTJ data for invalid input with no warning. `mbtiFromAxes({})` returns ESFP (all defaults evaluate to ≥50).
- **Vite proxy**: Dev server proxies `/api` and `/audio-cache` to `127.0.0.1:3001` (configured in `vite.config.js`).
- **Database migrations**: `server/db/migrations.js` via `CREATE TABLE IF NOT EXISTS` + `applyCompatibilityMigrations()` for additive column changes. No migration framework; schema changes must be additive.
- **Runtime config**: Stored in `app_settings` table. Legacy `server/data/runtime-config.json` imported once on first boot. Production: env vars with `KEY`/`TOKEN`/`SECRET` in name lock out admin overrides.
- **Bilingual app**: Error messages and UI labels are in Chinese. `parseNotesSimple` handles Chinese negation patterns (`不要`). No i18n framework.
- **Production deploy**: See `DEPLOYMENT.md` for Railway + Cloudflare R2 setup.

## Environment Variables

See `.env.example`. Key vars:

| Category | Variables |
|----------|-----------|
| Server | `PORT`, `HOST`, `NODE_ENV`, `APP_ORIGIN`, `CORS_ORIGINS`, `ADMIN_TOKEN` |
| Database | `DB_DRIVER` (sqlite\|pg), `DB_PATH`, `DATABASE_URL` |
| Cache | `REDIS_URL` |
| Storage | `STORAGE_DRIVER` (local\|r2\|s3\|oss), `S3_*` |
| Suno | `TTAPI_BASE_URL`, `TTAPI_KEY`, `TTAPI_SUNO_MV`, `USE_FALLBACK_ONLY` |
| LLM | `LLM_PROVIDER`, provider-specific keys, `LLM_MODEL` |
| Limits | `GLOBAL_DAILY_LIMIT`, `GUEST_GENERATION_LIMIT`, `USER_GENERATION_LIMIT` (latter two also admin-configurable), `MUSIC_GENERATE_RATE_LIMIT`, `MUSIC_JOB_TTL_MS`, `MUSIC_MAX_JOBS` |
