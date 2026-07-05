import { Router } from 'express';
import {
  listLlmProviders,
  resolveLlmConfig,
  resolveTtapiConfig,
} from '../config/providers.js';
import { maskedSettings, updateSettings } from '../config/runtimeConfig.js';
import { isLlmConfigured } from '../services/llm/index.js';
import { isSunoConfigured } from '../services/sunoClient.js';
import { quotaSettings } from '../services/quotaService.js';
import { listUsers, updateUserRole } from '../services/userAdminService.js';

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

router.get('/quota-settings', (_req, res) => {
  res.json(quotaSettings());
});

router.post('/quota-settings', async (req, res) => {
  try {
    const patch = {};
    if (req.body?.guestLimit !== undefined) patch.GUEST_GENERATION_LIMIT = String(req.body.guestLimit);
    if (req.body?.userLimit !== undefined) patch.USER_GENERATION_LIMIT = String(req.body.userLimit);
    const { applied, skipped } = await updateSettings(patch);
    res.json({ ok: true, applied, skipped, ...quotaSettings() });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/users', async (req, res) => {
  res.json({ users: await listUsers({ limit: Number(req.query.limit) || 100 }) });
});

router.patch('/users/:id', async (req, res) => {
  try {
    const user = await updateUserRole(req.params.id, req.body?.role);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
