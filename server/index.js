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
import { isSunoConfigured } from './services/sunoClient.js';
import { isLlmConfigured } from './services/llm/index.js';
import { resolveLlmConfig, resolveTtapiConfig } from './config/providers.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// 生产环境 CORS 收紧到同源（前端由 Express 自己托管）；开发环境放开给 Vite
app.use(cors(isProd ? { origin: process.env.APP_ORIGIN || false, credentials: true } : { credentials: true, origin: true }));
app.use(express.json());
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

app.use('/api/config', configRoutes);
app.use('/api/library', libraryRoutes);

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

app.listen(PORT, () => {
  console.log(`[server] http://localhost:${PORT}`);
  console.log(`[server] TTAPI Suno: ${isSunoConfigured() ? 'enabled' : 'fallback mode'}`);
  const llm = resolveLlmConfig();
  console.log(`[server] LLM: ${isLlmConfigured() ? `${llm.label} (${llm.providerId})` : 'template mode'}`);
});
