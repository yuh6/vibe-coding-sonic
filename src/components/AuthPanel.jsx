import { useState } from 'react';
import { createPortal } from 'react-dom';
import { authLogin, authRegister, authLogout } from '../lib/api';
import IconGlyph from './IconGlyph';

function AuthModal({ onClose, onSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = isRegister
        ? await authRegister({ email, password, name })
        : await authLogin({ email, password });
      onSuccess(data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  // 用 Portal 渲染到 body，脱离含 backdrop-filter/transform 的祖先，
  // 否则 fixed 定位会以祖先为基准导致弹窗偏移（如 MBTIWAVE 顶栏）。
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(event) => event.stopPropagation()}
        className="glass w-full max-w-sm rounded-2xl p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{isRegister ? '注册账号' : '登录'}</h2>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center text-white/40 hover:text-white/80" aria-label="关闭">
            <IconGlyph name="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          {isRegister && (
            <input
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="昵称（可选）"
              className="bg-input w-full rounded-xl px-3 py-2.5 text-sm"
            />
          )}
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="邮箱"
            className="bg-input w-full rounded-xl px-3 py-2.5 text-sm"
            autoFocus
          />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={isRegister ? '密码（至少 8 位）' : '密码'}
            className="bg-input w-full rounded-xl px-3 py-2.5 text-sm"
          />
        </div>

        {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 font-display text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? '请稍候…' : isRegister ? '注册并登录' : '登录'}
        </button>

        <button
          type="button"
          onClick={() => {
            setIsRegister((value) => !value);
            setError('');
          }}
          className="mt-3 w-full text-center text-[12px] text-white/50 hover:text-white/80"
        >
          {isRegister ? '已有账号？直接登录' : '没有账号？注册一个'}
        </button>
      </form>
    </div>,
    document.body
  );
}

export default function AuthPanel({
  user,
  credits,
  open,
  onOpenChange,
  onAuth,
  onLogout,
  onBeforeLogout,
  onAccountOpen = () => {},
  triggerClass,
  chipClass,
  loading = false,
}) {
  const isGuest = user?.isGuest || user?.role === 'guest';
  const [logoutBusy, setLogoutBusy] = useState(false);
  const handleLogout = async () => {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await onBeforeLogout?.();
    } catch (err) {
      console.error('[auth before logout]', err);
    }
    try {
      await authLogout();
    } finally {
      onLogout();
      setLogoutBusy(false);
    }
  };

  // 默认沿用 DJ 台原样式；传入自定义类时（如 MBTIWAVE 绿色主题）覆盖。
  const btnClass = triggerClass || 'pad flex h-9 w-9 items-center justify-center text-base';
  const userChipClass = chipClass || 'flex min-w-[108px] items-center justify-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5';

  if (loading) {
    return (
      <>
        <div className="flex items-center gap-2" aria-busy="true">
          <div className={`${userChipClass} opacity-60`}>
            <span className="font-display text-xs font-semibold text-white/85">...</span>
            <span className="font-mono text-[10px] text-white/45">积分 --</span>
          </div>
          <button type="button" disabled className={`${btnClass} opacity-60`} title="登录状态加载中" aria-label="登录状态加载中">
            <IconGlyph name="user-login" className="h-4 w-4" />
          </button>
        </div>
        {open && <AuthModal onClose={() => onOpenChange(false)} onSuccess={onAuth} />}
      </>
    );
  }

  return (
    <>
      {user ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isGuest ? () => onOpenChange(true) : onAccountOpen}
            className={`${userChipClass} text-left`}
            title={isGuest ? '登录' : '账户资料'}
            aria-label={isGuest ? '登录' : '打开账户资料'}
          >
            <span className="font-display text-xs font-semibold text-white/85">
              {isGuest ? '游客' : user.name}
              {user.isVip && <span className="ml-1 text-amber-300">VIP</span>}
            </span>
            {credits && (
              <span
                className="font-mono text-[10px] text-white/45"
                title={`每首生成消耗 ${credits.costPerTrack} 积分`}
              >
                积分 {credits.balance}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={isGuest ? () => onOpenChange(true) : handleLogout}
            disabled={logoutBusy}
            className={btnClass}
            title={isGuest ? '登录' : logoutBusy ? '正在登出' : '登出'}
            aria-label={isGuest ? '登录' : logoutBusy ? '正在登出' : '登出'}
          >
            <IconGlyph name={isGuest ? 'user-login' : 'close'} className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => onOpenChange(true)} className={btnClass} title="登录" aria-label="登录">
          <IconGlyph name="user-login" className="h-4 w-4" />
        </button>
      )}

      {open && <AuthModal onClose={() => onOpenChange(false)} onSuccess={onAuth} />}
    </>
  );
}
