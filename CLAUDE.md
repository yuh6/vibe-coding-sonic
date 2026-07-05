# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**MBTIWAVE** — MBTI × Hackathon AI DJ Console. Generates personalized BGM during hackathons based on MBTI personality, project context, and work phase. Uses TTAPI proxy to Suno API (V5/chirp-v5) for music generation with a multi-tier fallback system.

## Commands

```bash
# Development (frontend + backend concurrently)
npm run dev

# Frontend only (Vite dev server)
npm run dev:client

# Backend only (with --watch auto-restart)
npm run dev:server

# Production build
npm run build

# Start production server (serves built frontend)
npm start
```

No test framework is configured. No linter is configured.

## Architecture

### Stack
- **Frontend**: React 18 + Vite + TailwindCSS (SPA at `src/`)
- **Backend**: Express.js on port 3001 (`server/`)
- **Database**: SQLite via better-sqlite3 at `server/data/app.db` by default (`DB_PATH` overrides it)
- **Module system**: ESM throughout (`"type": "module"` in package.json)

### Core Data Flow

```
User DJ Console → composePrompt() → submitGeneration() (TTAPI/Suno) → pollGeneration()
                                                                          ↓
                                                          applyGeneratedMusic() → persistTrackAsync()
                                                                          ↓                    ↓
                                                                    stem separation    download audio to
                                                                          ↓            audio-cache/ +
                                                                      completed        write shared_library
```

When quota is exhausted or Suno fails: `completeWithFallback()` → tries `shared_library` table (smart match by mode/genre/mbti/bpm) → falls back to static `fallback-manifest.json`.

### Key Services (`server/services/`)

- **promptComposer.js**: Assembles Suno V5 prompts following priority order: genre → instruments → mood → BPM → production quality. Reads `mbti-profiles.json`. Returns `{fullPrompt, negativeTags, layers, bpm, weirdnessConstraint, styleWeight}`.
- **musicOrchestrator.js**: Job lifecycle manager. In-memory `Map` (TTL 30min, max 100). Handles creation → Suno submission → polling → completion/fallback. Async audio download + shared_library insertion on completion.
- **sunoClient.js**: TTAPI proxy client. POSTs to `{TTAPI_BASE_URL}/suno/v1/music`. Polls task status. Also handles stem separation.
- **libraryStore.js**: Two-tier fallback: shared_library (SQLite, user-generated songs with local audio cache) + static manifest. `pickFromSharedLibrary()` does 4-level priority matching.
- **quotaService.js**: Per-user daily quota (`QUOTA_PER_DAY`, default 5) + global daily limit (`GLOBAL_DAILY_LIMIT`, default 100). Includes refund on Suno failure.
- **lyricsGenerator.js**: LLM-based lyrics with Suno structure tags (`[Verse]`, `[Chorus]`, etc.). Vocal style recommendations by MBTI.
- **llm/index.js**: 11-provider LLM router (openai, anthropic, gemini, deepseek, siliconflow, openrouter, custom, + 4 CLI). Project analysis with SHA-256 cache.

### Arranger Engine (`server/services/arranger/`)

A more advanced system for continuous DJ sessions with automated phase transitions, energy curves, concurrent Suno generation scheduling, real-time user feedback sensing, and crossfade mixing. Real-time events pushed to browser via hand-written WebSocket server (`server/ws/wsServer.js`, RFC 6455, zero deps).

### Frontend Structure (`src/`)

Single-page app in `App.jsx` with 3-column layout (MBTI+Style | Player+Project | Mode+Notes+Prompt+Library). Hash routing: `#/` (DJ console), `#/mixer` (mixer page), `#/admin` (admin panel). All state managed via `useState`/`useRef` in App.jsx — no external state library.

### Auth & Middleware

- **User auth**: Opaque session token in an HttpOnly cookie (`server/middleware/userAuth.js`)
- **Admin auth**: `X-Admin-Token` header checked against `ADMIN_TOKEN` env var (`server/middleware/adminAuth.js`)

### Seven Work Phases

`brainstorm`, `focus`, `sprint`, `charge`, `behind`, `break`, `celebrate` — each has distinct BPM delta, style tags, production style, and Suno weirdness/styleWeight parameters in `PHASE_PRESETS`.

### Audio Stacks

Two independent audio systems coexist — do not use both simultaneously:
- **Howler.js** (`usePlayer` hook) — simple single-track playback for the DJ console
- **Web Audio API** (`useMixer`/`useArranger` hooks) — multi-track mixer and auto-DJ crossfade for the arranger engine

### Dependency Map

```
promptComposer ──► mbti-profiles.json
musicOrchestrator ──► promptComposer + sunoClient + libraryStore + quotaService
llm/index ──► llm/httpProviders ──► OpenAI / Anthropic / Gemini / etc.
arranger/ ──► sunoClient + promptComposer + SQLite (track_pool, sessions)
All DB users ──► shared db.js (single better-sqlite3 connection)
```

## Critical Implementation Details

- **LLM HTTP providers** (`llm/httpProviders.js`): `callOpenAiCompatible(config, prompt)` takes config and prompt as **two separate arguments**. The prompt is NOT inside the config object. Same for `callAnthropic` and `callGemini`.
- **TTAPI CDN URLs expire** (~24h). `musicOrchestrator.persistTrackAsync()` downloads audio to `server/data/audio-cache/` asynchronously. The `shared_library` table stores both `audio_url` (CDN, may expire) and `audio_local` (cached path).
- **TTAPI response shapes are inconsistent** — `sunoClient.js` tries multiple field paths (camelCase/snake_case, `data.X`/`data.data.X`) for each access. Follow this pattern when modifying.
- **Suno prompt rules**: Style field ≤200 chars, genre must be first, no negation words in style (use `negative_tags`/Exclude instead), keep negative_tags to 2-6 words. See `docs/20260703_Suno_AI_全面使用手册_音乐生成工程指南.md` for comprehensive Suno V5 best practices.
- **Jobs are in-memory** — `musicOrchestrator` uses a `Map` with 30min TTL. Server restart loses all in-flight jobs. Polling is client-driven (`refreshJob` on GET `/status/:id`), not background.
- **MBTI fallbacks are silent** — `getTheme()` and `axesFromMbti()` return INTJ data for invalid input with no warning. `mbtiFromAxes({})` returns ESFP (all defaults evaluate to ≥50).
- **Vite proxy**: Dev server proxies `/api` and `/audio-cache` to `127.0.0.1:3001` (configured in `vite.config.js`).
- **Database migrations**: All in `server/db.js` via `CREATE TABLE IF NOT EXISTS` — no migration framework, schema changes must be additive.
- **Bilingual app**: Error messages and UI labels are in Chinese. `parseNotesSimple` handles Chinese negation patterns (`不要`). No i18n framework.
- **README.md is outdated** — describes a different app. Ignore its claims about Zustand, React Router, or task management.

## Environment Variables

See `.env.example`. Key vars: `TTAPI_BASE_URL`, `TTAPI_KEY` (Suno proxy), `LLM_PROVIDER`, provider-specific LLM API keys, `LLM_MODEL`, `ADMIN_TOKEN`, `QUOTA_PER_DAY`, `GLOBAL_DAILY_LIMIT` (limits).
