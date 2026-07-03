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
import { attachUser } from './middleware/userAuth.js';
import { requireAdmin } from './middleware/adminAuth.js';
import { isSunoConfigured } from './services/sunoClient.js';
import { isLlmConfigured } from './services/llm/index.js';
import { resolveLlmConfig, resolveTtapiConfig } from './config/providers.js';
import { getSetting } from './config/runtimeConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
const isProd = process.env.NODE_ENV === 'production';

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
app.use('/api/library', requireAdmin, libraryRoutes);

app.use('/api/mbti', mbtiRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/schedule', scheduleRoutes);

if (isProd) {
  const distPath = join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(join(distPath, 'index.html'));
  });
}

app.listen(PORT, HOST, () => {
  console.log(`[server] http://${HOST}:${PORT}`);
  console.log(`[server] TTAPI Suno: ${isSunoConfigured() ? 'enabled' : 'fallback mode'}`);
  const llm = resolveLlmConfig();
  console.log(`[server] LLM: ${isLlmConfigured() ? `${llm.label} (${llm.providerId})` : 'template mode'}`);
});
