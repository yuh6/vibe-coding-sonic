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
import {
  createRedemptionCode,
  disableRedemptionCode,
  listRedemptionCodes,
} from '../services/creditService.js';

const router = Router();

function parseQuotaLimit(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} 必须是 0 或正整数`);
  }
  return Math.floor(parsed);
}

function parseVipQuotaLimit(value) {
  if (value === null || value === '') return null;
  const text = String(value).trim().toLowerCase();
  if (['unlimited', 'infinite', 'infinity', 'none', 'null'].includes(text)) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) {
    throw new Error('VIP 额度必须是 0 或正整数，或留空表示不限');
  }
  return parsed < 0 ? null : Math.floor(parsed);
}

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
    if (req.body?.guestLimit !== undefined) {
      patch.GUEST_GENERATION_LIMIT = String(parseQuotaLimit(req.body.guestLimit, '游客额度'));
    }
    if (req.body?.userLimit !== undefined) {
      patch.USER_GENERATION_LIMIT = String(parseQuotaLimit(req.body.userLimit, '普通用户额度'));
    }
    if (req.body?.vipLimit !== undefined) {
      const vipLimit = parseVipQuotaLimit(req.body.vipLimit);
      patch.VIP_GENERATION_LIMIT = vipLimit === null ? null : String(vipLimit);
    }
    if (req.body?.globalDailyLimit !== undefined) {
      patch.GLOBAL_DAILY_LIMIT = String(parseQuotaLimit(req.body.globalDailyLimit, '每日总限额'));
    }
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

router.get('/redemption-codes', async (req, res) => {
  res.json({ codes: await listRedemptionCodes({ limit: Number(req.query.limit) || 100 }) });
});

router.post('/redemption-codes', async (req, res) => {
  try {
    const code = await createRedemptionCode({
      points: req.body?.points,
      maxUses: req.body?.maxUses,
      expiresAt: req.body?.expiresAt,
      code: req.body?.code,
      createdBy: 'admin',
    });
    res.json({ code });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.patch('/redemption-codes/:code', async (req, res) => {
  try {
    const action = String(req.body?.action || 'disable');
    if (action !== 'disable') return res.status(400).json({ error: 'Unsupported action' });
    const code = await disableRedemptionCode(req.params.code);
    if (!code) return res.status(404).json({ error: 'Code not found' });
    res.json({ code });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
