import { randomBytes, randomUUID } from 'crypto';
import { dal } from '../db.js';

export const CREDIT_COST_PER_TRACK = 10;
export const INITIAL_USER_CREDITS = 100;

function isGuestUser(user) {
  return !user || user.role === 'guest' || user.isGuest;
}

function normalizeCode(code) {
  return String(code || '').trim().toUpperCase();
}

function parsePositiveInt(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label}必须是正整数`);
  }
  return Math.floor(parsed);
}

function parseNullableTimestamp(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error('有效期格式不正确');
  return Math.floor(parsed);
}

function publicCredits(balance) {
  const normalized = Math.max(0, Number(balance || 0));
  return {
    balance: normalized,
    costPerTrack: CREDIT_COST_PER_TRACK,
    canGenerate: normalized >= CREDIT_COST_PER_TRACK,
  };
}

function withStatus(err, status, code) {
  err.status = status;
  err.code = code;
  return err;
}

async function resolveUser(userOrId, executor = dal) {
  if (userOrId && typeof userOrId === 'object') return userOrId;
  return executor.get('SELECT id, email, name, role FROM users WHERE id = ?', [userOrId]);
}

async function insertTransaction(executor, {
  userId,
  delta,
  balanceAfter,
  reason,
  referenceType = null,
  referenceId = null,
  metadata = null,
}) {
  await executor.run(
    `INSERT INTO credit_transactions
     (id, user_id, delta, balance_after, reason, reference_type, reference_id, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      userId,
      delta,
      balanceAfter,
      reason,
      referenceType,
      referenceId,
      metadata ? JSON.stringify(metadata) : null,
      Date.now(),
    ]
  );
}

async function ensureInitialCreditsRow(executor, user) {
  if (isGuestUser(user)) return false;
  const now = Date.now();
  const result = await executor.run(
    `INSERT INTO user_credits (user_id, balance, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO NOTHING`,
    [user.id, INITIAL_USER_CREDITS, now]
  );
  if (!result.changes) return false;
  await insertTransaction(executor, {
    userId: user.id,
    delta: INITIAL_USER_CREDITS,
    balanceAfter: INITIAL_USER_CREDITS,
    reason: 'initial_grant',
    referenceType: 'initial_grant',
    referenceId: user.id,
  });
  return true;
}

async function creditRow(executor, userId) {
  return executor.get('SELECT balance FROM user_credits WHERE user_id = ?', [userId]);
}

export async function ensureInitialCreditsForUser(userOrId) {
  const user = await resolveUser(userOrId);
  if (!user || isGuestUser(user)) return publicCredits(0);
  return dal.transaction((tx) => ensureInitialCreditsForUserInTransaction(tx, user));
}

export async function ensureInitialCreditsForUserInTransaction(executor, userOrId) {
  const user = await resolveUser(userOrId, executor);
  if (!user || isGuestUser(user)) return publicCredits(0);
  await ensureInitialCreditsRow(executor, user);
  const row = await creditRow(executor, user.id);
  return publicCredits(row?.balance || 0);
}

export async function getCredits(userOrId) {
  const user = await resolveUser(userOrId);
  if (!user || isGuestUser(user)) return publicCredits(0);
  await ensureInitialCreditsForUser(user);
  const row = await creditRow(dal, user.id);
  return publicCredits(row?.balance || 0);
}

export async function recentCreditTransactions(userId, { limit = 20 } = {}) {
  const capped = Math.max(1, Math.min(Number(limit) || 20, 100));
  const rows = await dal.query(
    `SELECT id, delta, balance_after, reason, reference_type, reference_id, metadata_json, created_at
     FROM credit_transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, capped]
  );
  return rows.map((row) => ({
    id: row.id,
    delta: Number(row.delta || 0),
    balanceAfter: Number(row.balance_after || 0),
    reason: row.reason,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    createdAt: Number(row.created_at || 0),
  }));
}

export async function chargeGenerationCredits(userOrId, referenceId) {
  const user = await resolveUser(userOrId);
  if (!user || isGuestUser(user)) {
    return {
      ok: false,
      status: 402,
      code: 'INSUFFICIENT_CREDITS',
      error: '游客没有积分，已切到兜底曲库',
      credits: publicCredits(0),
    };
  }

  return dal.transaction(async (tx) => {
    await ensureInitialCreditsRow(tx, user);
    const existing = await tx.get(
      `SELECT balance_after FROM credit_transactions
       WHERE reference_type = ? AND reference_id = ?`,
      ['generation_charge', referenceId]
    );
    if (existing) {
      return { ok: true, credits: publicCredits(existing.balance_after), alreadyCharged: true };
    }

    const now = Date.now();
    const result = await tx.run(
      `UPDATE user_credits
       SET balance = balance - ?, updated_at = ?
       WHERE user_id = ? AND balance >= ?`,
      [CREDIT_COST_PER_TRACK, now, user.id, CREDIT_COST_PER_TRACK]
    );
    const row = await creditRow(tx, user.id);
    if (!result.changes) {
      return {
        ok: false,
        status: 402,
        code: 'INSUFFICIENT_CREDITS',
        error: '积分不足，已切到兜底曲库',
        credits: publicCredits(row?.balance || 0),
      };
    }

    await insertTransaction(tx, {
      userId: user.id,
      delta: -CREDIT_COST_PER_TRACK,
      balanceAfter: row.balance,
      reason: 'generation_charge',
      referenceType: 'generation_charge',
      referenceId,
    });

    return { ok: true, credits: publicCredits(row.balance) };
  });
}

export async function refundGenerationCredits(userId, referenceId, metadata = null) {
  if (!userId || !referenceId) return { ok: true, skipped: true };
  return dal.transaction(async (tx) => {
    const existingRefund = await tx.get(
      `SELECT balance_after FROM credit_transactions
       WHERE reference_type = ? AND reference_id = ?`,
      ['generation_refund', referenceId]
    );
    if (existingRefund) {
      return { ok: true, alreadyRefunded: true, credits: publicCredits(existingRefund.balance_after) };
    }

    const charge = await tx.get(
      `SELECT delta FROM credit_transactions
       WHERE reference_type = ? AND reference_id = ?`,
      ['generation_charge', referenceId]
    );
    if (!charge) return { ok: true, skipped: true };

    const amount = Math.abs(Number(charge.delta || CREDIT_COST_PER_TRACK));
    await tx.run(
      'UPDATE user_credits SET balance = balance + ?, updated_at = ? WHERE user_id = ?',
      [amount, Date.now(), userId]
    );
    const row = await creditRow(tx, userId);
    await insertTransaction(tx, {
      userId,
      delta: amount,
      balanceAfter: row.balance,
      reason: 'generation_refund',
      referenceType: 'generation_refund',
      referenceId,
      metadata,
    });
    return { ok: true, credits: publicCredits(row.balance) };
  });
}

export async function redeemCode(userOrId, rawCode) {
  const user = await resolveUser(userOrId);
  if (!user || isGuestUser(user)) {
    throw withStatus(new Error('请先登录后再兑换积分'), 401, 'UNAUTHORIZED');
  }
  const code = normalizeCode(rawCode);
  if (!code) throw withStatus(new Error('请输入兑换码'), 400, 'CODE_REQUIRED');

  return dal.transaction(async (tx) => {
    await ensureInitialCreditsRow(tx, user);
    const redemption = await tx.get('SELECT * FROM redemption_codes WHERE code = ?', [code]);
    if (!redemption) throw withStatus(new Error('兑换码不存在'), 404, 'CODE_NOT_FOUND');
    if (redemption.disabled_at) throw withStatus(new Error('兑换码已停用'), 400, 'CODE_DISABLED');
    const now = Date.now();
    if (redemption.expires_at && Number(redemption.expires_at) < now) {
      throw withStatus(new Error('兑换码已过期'), 400, 'CODE_EXPIRED');
    }

    const existing = await tx.get(
      'SELECT 1 FROM redemption_claims WHERE code = ? AND user_id = ?',
      [code, user.id]
    );
    if (existing) throw withStatus(new Error('你已兑换过该兑换码'), 400, 'CODE_ALREADY_CLAIMED');

    const reserve = await tx.run(
      `UPDATE redemption_codes
       SET used_count = used_count + 1
       WHERE code = ?
         AND disabled_at IS NULL
         AND (expires_at IS NULL OR expires_at >= ?)
         AND used_count < max_uses`,
      [code, now]
    );
    if (!reserve.changes) {
      const current = await tx.get('SELECT * FROM redemption_codes WHERE code = ?', [code]);
      if (!current) throw withStatus(new Error('兑换码不存在'), 404, 'CODE_NOT_FOUND');
      if (current.disabled_at) throw withStatus(new Error('兑换码已停用'), 400, 'CODE_DISABLED');
      if (current.expires_at && Number(current.expires_at) < now) {
        throw withStatus(new Error('兑换码已过期'), 400, 'CODE_EXPIRED');
      }
      throw withStatus(new Error('兑换码可兑换人数已满'), 400, 'CODE_EXHAUSTED');
    }

    const points = Number(redemption.points || 0);
    const claim = await tx.run(
      `INSERT INTO redemption_claims (code, user_id, points, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(code, user_id) DO NOTHING`,
      [code, user.id, points, now]
    );
    if (!claim.changes) throw withStatus(new Error('你已兑换过该兑换码'), 400, 'CODE_ALREADY_CLAIMED');
    await tx.run(
      'UPDATE user_credits SET balance = balance + ?, updated_at = ? WHERE user_id = ?',
      [points, now, user.id]
    );
    const row = await creditRow(tx, user.id);
    await insertTransaction(tx, {
      userId: user.id,
      delta: points,
      balanceAfter: row.balance,
      reason: 'redemption',
      referenceType: 'redemption_code',
      referenceId: `${code}:${user.id}`,
      metadata: { code },
    });

    return { ok: true, code, credits: publicCredits(row.balance) };
  });
}

function generateCode() {
  const hex = randomBytes(6).toString('hex').toUpperCase();
  return `MW-${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

export async function createRedemptionCode({ points, maxUses, expiresAt = null, createdBy = null, code = null } = {}) {
  const normalizedPoints = parsePositiveInt(points, '积分数');
  const normalizedMaxUses = parsePositiveInt(maxUses, '可兑换用户数');
  const normalizedExpiresAt = parseNullableTimestamp(expiresAt);
  if (normalizedExpiresAt && normalizedExpiresAt <= Date.now()) {
    throw new Error('有效期必须晚于当前时间');
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nextCode = normalizeCode(code || generateCode());
    const result = await dal.run(
      `INSERT INTO redemption_codes (code, points, max_uses, expires_at, created_by, created_at, disabled_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL)
       ON CONFLICT(code) DO NOTHING`,
      [nextCode, normalizedPoints, normalizedMaxUses, normalizedExpiresAt, createdBy, Date.now()]
    );
    if (result.changes) return getRedemptionCode(nextCode);
    if (code) throw new Error('兑换码已存在');
  }
  throw new Error('生成兑换码失败，请重试');
}

export async function getRedemptionCode(code) {
  const rows = await listRedemptionCodes({ code });
  return rows[0] || null;
}

export async function listRedemptionCodes({ limit = 100, code = null } = {}) {
  const capped = Math.max(1, Math.min(Number(limit) || 100, 500));
  const params = [];
  let where = '';
  if (code) {
    where = 'WHERE rc.code = ?';
    params.push(normalizeCode(code));
  }
  params.push(capped);
  const rows = await dal.query(
    `SELECT rc.code, rc.points, rc.max_uses, rc.expires_at, rc.created_by,
            rc.created_at, rc.disabled_at, COUNT(cl.user_id) AS claimed_count
     FROM redemption_codes rc
     LEFT JOIN redemption_claims cl ON cl.code = rc.code
     ${where}
     GROUP BY rc.code, rc.points, rc.max_uses, rc.expires_at, rc.created_by, rc.created_at, rc.disabled_at
     ORDER BY rc.created_at DESC
     LIMIT ?`,
    params
  );
  return rows.map((row) => ({
    code: row.code,
    points: Number(row.points || 0),
    maxUses: Number(row.max_uses || 0),
    claimedCount: Number(row.claimed_count || 0),
    expiresAt: row.expires_at == null ? null : Number(row.expires_at),
    createdBy: row.created_by,
    createdAt: Number(row.created_at || 0),
    disabledAt: row.disabled_at == null ? null : Number(row.disabled_at),
  }));
}

export async function disableRedemptionCode(code) {
  const normalized = normalizeCode(code);
  const result = await dal.run(
    'UPDATE redemption_codes SET disabled_at = COALESCE(disabled_at, ?) WHERE code = ?',
    [Date.now(), normalized]
  );
  if (!result.changes) return null;
  return getRedemptionCode(normalized);
}

async function backfillInitialCreditsForExistingUsers() {
  const users = await dal.query(
    `SELECT u.id, u.email, u.name, u.role
     FROM users u
     LEFT JOIN user_credits c ON c.user_id = u.id
     WHERE COALESCE(u.role, 'user') <> 'guest' AND c.user_id IS NULL`
  );
  for (const user of users) {
    await ensureInitialCreditsForUser(user);
  }
}

await backfillInitialCreditsForExistingUsers().catch((err) => {
  console.error('[credits] initial backfill failed:', err.message);
});
