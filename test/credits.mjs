import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmpRoot = await mkdtemp(join(tmpdir(), 'vibe-coding-sonic-credits-'));
process.env.NODE_ENV = 'test';
process.env.DB_DRIVER = 'sqlite';
process.env.DB_PATH = join(tmpRoot, 'credits.db');

try {
  const { dal } = await import('../server/db.js');
  const {
    CREDIT_COST_PER_TRACK,
    createRedemptionCode,
    disableRedemptionCode,
    chargeGenerationCredits,
    getRedemptionCode,
    getCredits,
    redeemCode,
    refundGenerationCredits,
  } = await import('../server/services/creditService.js');

  const now = Date.now();
  const user = { id: 'user-credits-a', email: 'credits-a@example.test', name: 'Credits A', role: 'user' };
  const userB = { id: 'user-credits-b', email: 'credits-b@example.test', name: 'Credits B', role: 'user' };
  const userC = { id: 'user-credits-c', email: 'credits-c@example.test', name: 'Credits C', role: 'user' };
  const userD = { id: 'user-credits-d', email: 'credits-d@example.test', name: 'Credits D', role: 'user' };
  const guest = { id: 'guest-credits', email: 'guest-credits@guest.local', name: 'Guest', role: 'guest', isGuest: true };
  const concurrentUser = {
    id: 'user-credits-concurrent',
    email: 'credits-concurrent@example.test',
    name: 'Credits Concurrent',
    role: 'user',
  };
  const claimRaceUsers = Array.from({ length: 8 }, (_, index) => ({
    id: `user-credits-claim-race-${index}`,
    email: `credits-claim-race-${index}@example.test`,
    name: `Credits Claim Race ${index}`,
    role: 'user',
  }));

  for (const item of [user, userB, userC, userD, concurrentUser, ...claimRaceUsers]) {
    await dal.run(
      'INSERT INTO users (id, email, password_hash, name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [item.id, item.email, 'hash', item.name, item.role, now]
    );
  }

  assert.equal((await getCredits(user)).balance, 100);
  assert.equal((await getCredits(guest)).balance, 0);

  const firstCharge = await chargeGenerationCredits(user, 'job-a');
  assert.equal(firstCharge.ok, true);
  assert.equal(firstCharge.credits.balance, 90);
  assert.equal((await chargeGenerationCredits(user, 'job-a')).credits.balance, 90);

  for (let index = 0; index < 9; index += 1) {
    const charged = await chargeGenerationCredits(user, `job-drain-${index}`);
    assert.equal(charged.ok, true);
  }
  assert.equal((await getCredits(user)).balance, 0);
  const denied = await chargeGenerationCredits(user, 'job-denied');
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'INSUFFICIENT_CREDITS');

  await refundGenerationCredits(user.id, 'job-a');
  assert.equal((await getCredits(user)).balance, CREDIT_COST_PER_TRACK);
  await refundGenerationCredits(user.id, 'job-a');
  assert.equal((await getCredits(user)).balance, CREDIT_COST_PER_TRACK);

  const code = await createRedemptionCode({
    points: 25,
    maxUses: 1,
    expiresAt: Date.now() + 60_000,
    code: 'MW-TEST-ONCE',
  });
  assert.equal(code.points, 25);
  const redeemed = await redeemCode(user, 'mw-test-once');
  assert.equal(redeemed.credits.balance, 35);
  await assert.rejects(() => redeemCode(user, code.code), /已兑换/);
  assert.equal((await getCredits(userB)).balance, 100);
  await assert.rejects(() => redeemCode(userB, code.code), /人数已满/);
  await assert.rejects(() => redeemCode(guest, code.code), /请先登录/);

  const multiUseCode = await createRedemptionCode({
    points: 15,
    maxUses: 2,
    expiresAt: Date.now() + 60_000,
    code: 'MW-TEST-MULTI',
  });
  assert.equal((await redeemCode(userB, multiUseCode.code)).credits.balance, 115);
  assert.equal((await redeemCode(userC, multiUseCode.code)).credits.balance, 115);
  await assert.rejects(() => redeemCode(userD, multiUseCode.code), /人数已满/);
  assert.equal((await getRedemptionCode(multiUseCode.code)).claimedCount, 2);

  await dal.run(
    `INSERT INTO redemption_codes (code, points, max_uses, expires_at, created_by, created_at, disabled_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)`,
    ['MW-EXPIRED', 10, 1, Date.now() - 1000, 'test', Date.now()]
  );
  await assert.rejects(() => redeemCode(userB, 'MW-EXPIRED'), /已过期/);

  await createRedemptionCode({
    points: 10,
    maxUses: 1,
    expiresAt: Date.now() + 60_000,
    code: 'MW-DISABLED',
  });
  await disableRedemptionCode('MW-DISABLED');
  await assert.rejects(() => redeemCode(userB, 'MW-DISABLED'), /已停用/);

  const concurrentResults = await Promise.all(
    Array.from({ length: 12 }, (_, index) => chargeGenerationCredits(concurrentUser, `job-concurrent-${index}`))
  );
  assert.equal(concurrentResults.filter((item) => item.ok).length, 10);
  assert.equal(concurrentResults.filter((item) => !item.ok).length, 2);
  assert.equal((await getCredits(concurrentUser)).balance, 0);

  await createRedemptionCode({
    points: 7,
    maxUses: 3,
    expiresAt: Date.now() + 60_000,
    code: 'MW-TEST-RACE',
  });
  const claimRaceResults = await Promise.all(
    claimRaceUsers.map((item) => redeemCode(item, 'MW-TEST-RACE')
      .then((result) => ({ ok: true, result }))
      .catch((err) => ({ ok: false, err })))
  );
  assert.equal(claimRaceResults.filter((item) => item.ok).length, 3);
  assert.equal(claimRaceResults.filter((item) => !item.ok).length, 5);
  assert.ok(claimRaceResults.filter((item) => !item.ok).every((item) => /人数已满/.test(item.err.message)));
  assert.equal((await getRedemptionCode('MW-TEST-RACE')).claimedCount, 3);

  console.log('Credit service tests passed');
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}
