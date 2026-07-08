import { useEffect, useState } from 'react';
import {
  changeMyPassword,
  getMyAccount,
  redeemCreditCode,
  updateMyAccount,
} from '../lib/api';
import IconGlyph from './IconGlyph';

const REASON_LABELS = {
  initial_grant: '注册赠送',
  generation_charge: '音乐生成',
  generation_refund: '生成退款',
  redemption: '兑换码',
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '-';
}

function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason || '积分变动';
}

export default function AccountPage({
  user,
  credits,
  onUserChange,
  onCreditsChange,
  onRequireAuth = () => {},
}) {
  const [account, setAccount] = useState(null);
  const [name, setName] = useState(user?.name || '');
  const [redeemCode, setRedeemCode] = useState('');
  const [passwords, setPasswords] = useState({ currentPassword: '', nextPassword: '', confirmPassword: '' });
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');

  const isGuest = user?.isGuest || user?.role === 'guest';

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3000);
  };

  const refresh = async () => {
    const data = await getMyAccount();
    setAccount(data);
    setName(data.user?.name || '');
    onUserChange?.(data.user);
    onCreditsChange?.(data.credits);
  };

  useEffect(() => {
    if (!user || isGuest) return;
    refresh().catch((err) => setError(err.message));
  }, [user?.id, isGuest]);

  const handleSaveName = async (event) => {
    event.preventDefault();
    setBusy('name');
    setError('');
    try {
      const data = await updateMyAccount({ name });
      onUserChange?.(data.user);
      setAccount((current) => ({ ...(current || {}), user: data.user, credits: data.credits }));
      showToast('用户名已保存');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const handlePassword = async (event) => {
    event.preventDefault();
    setBusy('password');
    setError('');
    try {
      if (passwords.nextPassword !== passwords.confirmPassword) {
        throw new Error('两次输入的新密码不一致');
      }
      await changeMyPassword({
        currentPassword: passwords.currentPassword,
        nextPassword: passwords.nextPassword,
      });
      setPasswords({ currentPassword: '', nextPassword: '', confirmPassword: '' });
      showToast('密码已更新');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  const handleRedeem = async (event) => {
    event.preventDefault();
    setBusy('redeem');
    setError('');
    try {
      const data = await redeemCreditCode(redeemCode);
      setRedeemCode('');
      onCreditsChange?.(data.credits);
      await refresh();
      showToast('兑换成功');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!user || isGuest) {
    return (
      <div className="glass mx-auto max-w-xl rounded-2xl p-6">
        <span className="deck-label">账户资料</span>
        <h2 className="mt-3 font-display text-2xl font-bold text-theme">请先登录</h2>
        <p className="mt-2 text-sm text-subtle">登录后可以查看积分、兑换积分、修改用户名和密码。</p>
        <button type="button" onClick={onRequireAuth} className="pad mt-5 px-4 py-2 text-sm">
          登录 / 注册
        </button>
      </div>
    );
  }

  const currentCredits = account?.credits || credits || { balance: 0, costPerTrack: 10, canGenerate: false };
  const transactions = account?.transactions || [];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="toast-bar fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="deck-label">账户资料</span>
            <h2 className="mt-2 font-display text-2xl font-bold text-theme">{account?.user?.name || user.name}</h2>
            <p className="font-mono text-xs text-faint">{account?.user?.email || user.email}</p>
          </div>
          <div className="rounded-2xl border border-theme bg-surface px-4 py-3 text-right">
            <div className="font-mono text-[10px] uppercase tracking-widest text-faint">Credits</div>
            <div className="font-display text-3xl font-bold text-theme">{currentCredits.balance}</div>
            <div className="text-[11px] text-subtle">每首 {currentCredits.costPerTrack} 积分</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={handleSaveName} className="glass rounded-2xl p-4">
          <span className="deck-label">用户名</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="bg-input mt-3 w-full rounded-xl px-3 py-2 text-sm"
            maxLength={80}
          />
          <button type="submit" disabled={busy === 'name'} className="pad mt-3 px-4 py-2 text-sm disabled:opacity-50">
            保存用户名
          </button>
        </form>

        <form onSubmit={handleRedeem} className="glass rounded-2xl p-4">
          <span className="deck-label">兑换积分</span>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={redeemCode}
              onChange={(event) => setRedeemCode(event.target.value.toUpperCase())}
              placeholder="MW-XXXX-XXXX-XXXX"
              className="bg-input min-w-0 flex-1 rounded-xl px-3 py-2 font-mono text-sm"
            />
            <button type="submit" disabled={!redeemCode.trim() || busy === 'redeem'} className="pad px-4 text-sm disabled:opacity-50">
              兑换
            </button>
          </div>
        </form>
      </div>

      <form onSubmit={handlePassword} className="glass rounded-2xl p-4">
        <span className="deck-label">修改密码</span>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            type="password"
            value={passwords.currentPassword}
            onChange={(event) => setPasswords({ ...passwords, currentPassword: event.target.value })}
            placeholder="当前密码"
            className="bg-input rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="password"
            minLength={8}
            value={passwords.nextPassword}
            onChange={(event) => setPasswords({ ...passwords, nextPassword: event.target.value })}
            placeholder="新密码（至少 8 位）"
            className="bg-input rounded-xl px-3 py-2 text-sm"
          />
          <input
            type="password"
            minLength={8}
            value={passwords.confirmPassword}
            onChange={(event) => setPasswords({ ...passwords, confirmPassword: event.target.value })}
            placeholder="确认新密码"
            className="bg-input rounded-xl px-3 py-2 text-sm"
          />
        </div>
        <button type="submit" disabled={busy === 'password'} className="pad mt-3 px-4 py-2 text-sm disabled:opacity-50">
          更新密码
        </button>
      </form>

      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="deck-label">积分流水</span>
          <button type="button" onClick={() => refresh().catch((err) => setError(err.message))} className="pad flex h-8 w-8 items-center justify-center" aria-label="刷新积分流水">
            <IconGlyph name="spin-rhythm" className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-faint">
              <tr>
                <th className="px-2 py-2">时间</th>
                <th className="px-2 py-2">类型</th>
                <th className="px-2 py-2">变动</th>
                <th className="px-2 py-2">余额</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((item) => (
                <tr key={item.id} className="border-t border-theme">
                  <td className="px-2 py-2 font-mono text-[10px] text-faint">{formatDate(item.createdAt)}</td>
                  <td className="px-2 py-2 text-theme">{reasonLabel(item.reason)}</td>
                  <td className={`px-2 py-2 font-mono text-[11px] ${item.delta >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {item.delta > 0 ? `+${item.delta}` : item.delta}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px]">{item.balanceAfter}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td className="px-2 py-6 text-center text-faint" colSpan={4}>
                    暂无积分流水
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
