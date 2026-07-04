import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mbtiRoutes from './routes/mbti.js';
import projectRoutes from './routes/project.js';
import musicRoutes from './routes/music.js';
import scheduleRoutes from './routes/schedule.js';
import configRoutes from './routes/config.js';
import libraryRoutes from './routes/library.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import sessionRoutes from './routes/session.js';
import arrangerRoutes from './routes/arranger.js';
import stylesRoutes from './routes/styles.js';
import notesRoutes from './routes/notes.js';
import lyricsRoutes from './routes/lyrics.js';
import playlistsRoutes from './routes/playlists.js';
import radioRoutes from './routes/radio.js';
import favoritesRoutes from './routes/favorites.js';
import recommendRoutes from './routes/recommend.js';
import { attachUser } from './middleware/userAuth.js';
import { requireAdmin } from './middleware/adminAuth.js';
import { isSunoConfigured } from './services/sunoClient.js';
import { isLlmConfigured } from './services/llm/index.js';
import { resolveLlmConfig, resolveTtapiConfig } from './config/providers.js';
import { getSetting } from './config/runtimeConfig.js';
import { attachWsEvents } from './ws/events.js';
import { attachWsRadio } from './ws/radio.js';
import { dal } from './db.js';
import { cache } from './cache/index.js';
import { cleanupLocalCache } from './storage/local.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';
const HOST = resolveHost();

function isLoopbackHost(host) {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}

function resolveHost() {
  const configuredHost = process.env.HOST;
  if (isProd && process.env.RAILWAY_PROJECT_ID && isLoopbackHost(configuredHost)) {
    console.warn(`[server] Ignoring Railway loopback HOST=${configuredHost}; using 0.0.0.0`);
    return '0.0.0.0';
  }
  return configuredHost || (isProd ? '0.0.0.0' : '127.0.0.1');
}

function parseCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function isLoopbackOrigin(origin) {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.');
  } catch {
    return false;
  }
}

function isCorsOriginAllowed(origin) {
  if (!origin) return true;
  const configured = parseCsv(getSetting('CORS_ORIGINS'));
  if (configured.includes('*') || configured.includes(origin)) return true;
  if (!isProd && isLoopbackOrigin(origin)) return true;
  return Boolean(process.env.APP_ORIGIN && origin === process.env.APP_ORIGIN);
}

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin));
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);
app.use(express.json({ limit: '128kb' }));
app.use(attachUser);

app.get('/api/health', (_req, res) => {
  const llm = resolveLlmConfig();
  const ttapi = resolveTtapiConfig();
  res.json({
    ok: true,
    ttapi: ttapi.configured,
    ttapiLabel: ttapi.configured ? 'TTAPI 在线' : '兜底模式',
    llm: isLlmConfigured(),
    llmProvider: llm.providerId,
    llmLabel: llm.label,
    fallbackOnly: process.env.USE_FALLBACK_ONLY === 'true',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/config', requireAdmin, configRoutes);
app.use('/api/library', libraryRoutes);

app.use('/api/mbti', mbtiRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/schedule', scheduleRoutes);
app.use('/api/session', sessionRoutes);
app.use('/api/arranger', arrangerRoutes);
app.use('/api/styles', stylesRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/lyrics', lyricsRoutes);
app.use('/api/playlists', playlistsRoutes);
app.use('/api/radio', radioRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/recommend', recommendRoutes);

// 编排引擎生成音频的本地缓存（TTAPI CDN URL 会过期，§9.1 落盘后从这里提供）
app.use('/audio-cache', express.static(join(__dirname, 'data/audio-cache')));

if (isProd) {
  const distPath = join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

// ═══════════════════════════════════════════════════════════════
//  404 兜底
// ═══════════════════════════════════════════════════════════════

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ═══════════════════════════════════════════════════════════════
//  全局错误处理中间件（必须 4 个参数）
// ═══════════════════════════════════════════════════════════════

app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  const message = isProd ? '服务器内部错误' : (err.message || '服务器内部错误');
  console.error('[server] Unhandled error:', err.stack || err.message || err);
  res.status(status).json({ error: message, code: 'INTERNAL_ERROR' });
});

// ═══════════════════════════════════════════════════════════════
//  进程级异常兜底
// ═══════════════════════════════════════════════════════════════

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[process] uncaughtException:', err);
  process.exit(1);
});

// ═══════════════════════════════════════════════════════════════
//  启动服务器
// ═══════════════════════════════════════════════════════════════

const server = app.listen(PORT, HOST, () => {
  console.log(`[server] http://${HOST}:${PORT}`);
  console.log(`[server] TTAPI Suno: ${isSunoConfigured() ? 'enabled' : 'fallback mode'}`);
  const llm = resolveLlmConfig();
  console.log(`[server] LLM: ${isLlmConfigured() ? `${llm.label} (${llm.providerId})` : 'template mode'}`);
  console.log(`[server] WS /ws/events: enabled`);
});

attachWsEvents(server);
attachWsRadio(server);

// ═══════════════════════════════════════════════════════════════
//  音频缓存定期清理（每小时，清除 7 天前的本地缓存文件）
// ═══════════════════════════════════════════════════════════════

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 小时
const cleanupTimer = setInterval(() => {
  cleanupLocalCache(7 * 24 * 60 * 60 * 1000).catch((err) => {
    console.warn('[cleanup] audio cache cleanup failed:', err.message);
  });
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

// ═══════════════════════════════════════════════════════════════
//  优雅关闭
// ═══════════════════════════════════════════════════════════════

async function gracefulShutdown(signal) {
  console.log(`[server] ${signal} received, shutting down gracefully...`);
  server.close(() => {
    console.log('[server] HTTP server closed');
  });
  try { await cache.close(); } catch {}
  try { await dal.close(); } catch {}
  setTimeout(() => process.exit(0), 3000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
