import { Router } from 'express';
import {
  listLlmProviders,
  resolveLlmConfig,
  resolveTtapiConfig,
} from '../config/providers.js';
import { maskedSettings, updateSettings } from '../config/runtimeConfig.js';
import { isLlmConfigured } from '../services/llm/index.js';
import { isSunoConfigured } from '../services/sunoClient.js';

const router = Router();

router.get('/providers', (_req, res) => {
  res.json({
    llm: listLlmProviders(),
    current: resolveLlmConfig(),
    ttapi: resolveTtapiConfig(),
  });
});

router.get('/status', (_req, res) => {
  const llm = resolveLlmConfig();
  const ttapi = resolveTtapiConfig();

  res.json({
    llm: {
      ...llm,
      active: isLlmConfigured(),
    },
    ttapi: {
      ...ttapi,
      active: isSunoConfigured(),
      note: 'Suno 无公开 API，音乐生成经 TTAPI 代理',
    },
  });
});

router.get('/keys', (_req, res) => {
  res.json({ settings: maskedSettings() });
});

router.post('/keys', async (req, res) => {
  try {
    const { applied, skipped } = await updateSettings(req.body || {});
    res.json({
      ok: true,
      applied,
      skipped,
      llm: resolveLlmConfig(),
      ttapi: resolveTtapiConfig(),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
