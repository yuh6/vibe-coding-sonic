import { useEffect, useState } from 'react';
import {
  getConfigKeys,
  saveConfigKeys,
  getConfigStatus,
  getProviders,
  getQuotaSettings,
  saveQuotaSettings,
  getAdminUsers,
  updateAdminUser,
  getLibrary,
  addLibraryTrack,
  deleteLibraryTrack,
  getStoredAdminToken,
  setStoredAdminToken,
} from '../lib/api';

const PROVIDER_KEY_MAP = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini: 'GEMINI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  siliconflow: 'SILICONFLOW_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  custom: 'LLM_API_KEY',
  'cli-codex': 'CODEX_API_KEY',
  'cli-claude': 'ANTHROPIC_API_KEY',
  'cli-kimi': 'KIMI_API_KEY',
};

const MODES = ['brainstorm', 'focus', 'sprint', 'charge', 'behind', 'break', 'celebrate', 'personality', 'startup'];
const MODE_LABELS = {
  brainstorm: '💡 头脑风暴',
  focus: '🎯 专注构思',
  sprint: '⚡ 代码冲刺',
  charge: '🔥 战鼓催阵',
  behind: '⏰ 落后了',
  break: '☕ 休息一下',
  celebrate: '🎉 完成了！',
  personality: '🧬 人格底色',
  startup: '🚀 生成启动',
};
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];
const ROLE_LABELS = {
  guest: '普通用户',
  user: '登录用户',
  vip: 'VIP',
};

function SecretInput({ label, placeholder, value, onChange, hint }) {
  return (
    <div>
      <label className="mb-1 block font-mono text-[10px] tracking-widest text-subtle">{label}</label>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="bg-input w-full rounded-xl px-3 py-2 font-mono text-xs"
      />
      {hint && <p className="mt-1 text-[10px] text-faint">{hint}</p>}
    </div>
  );
}

export default function AdminPanel() {
  const [settings, setSettings] = useState(null);
  const [status, setStatus] = useState(null);
  const [providers, setProviders] = useState([]);
  const [library, setLibrary] = useState(null);
  const [quotaSettings, setQuotaSettings] = useState(null);
  const [users, setUsers] = useState([]);

  const [form, setForm] = useState({});
  const [quotaForm, setQuotaForm] = useState({ guestLimit: '5', userLimit: '5' });
  const [libMode, setLibMode] = useState('focus');
  const [newTrack, setNewTrack] = useState({ title: '', url: '', mbti: '' });
  const [toast, setToast] = useState('');
  const [authToken, setAuthToken] = useState(getStoredAdminToken());
  const [loadError, setLoadError] = useState('');

  const refresh = async () => {
    setLoadError('');
    const [keys, st, prov, lib, quotaCfg, adminUsers] = await Promise.all([
      getConfigKeys(),
      getConfigStatus(),
      getProviders(),
      getLibrary(),
      getQuotaSettings(),
      getAdminUsers(),
    ]);
    setSettings(keys.settings);
    setStatus(st);
    setProviders(prov.llm || []);
    setLibrary(lib);
    setQuotaSettings(quotaCfg);
    setQuotaForm({
      guestLimit: String(quotaCfg.guestLimit ?? 5),
      userLimit: String(quotaCfg.userLimit ?? 5),
    });
    setUsers(adminUsers.users || []);
  };

  useEffect(() => {
    refresh().catch((err) => {
      setLoadError(err.message);
      setToast(`加载失败: ${err.message}`);
    });
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const currentProvider = form.LLM_PROVIDER || settings?.LLM_PROVIDER?.value || 'openai';
  const providerKeyName = PROVIDER_KEY_MAP[currentProvider];

  const handleSave = async () => {
    try {
      const patch = Object.fromEntries(
        Object.entries(form).filter(([, v]) => v !== undefined && v !== '')
      );
      if (providerKeyName && patch[providerKeyName] && !patch.LLM_PROVIDER) {
        patch.LLM_PROVIDER = currentProvider;
      }
      if (!Object.keys(patch).length) {
        showToast('没有修改');
        return;
      }
      await saveConfigKeys(patch);
      setForm({});
      await refresh();
      showToast('已保存，立即生效');
    } catch (err) {
      showToast(`保存失败: ${err.message}`);
    }
  };

  const handleSaveQuota = async () => {
    try {
      const guestLimit = Number(quotaForm.guestLimit);
      const userLimit = Number(quotaForm.userLimit);
      if (!Number.isFinite(guestLimit) || guestLimit < 0 || !Number.isFinite(userLimit) || userLimit < 0) {
        showToast('额度必须是 0 或正整数');
        return;
      }
      const next = await saveQuotaSettings({
        guestLimit: Math.floor(guestLimit),
        userLimit: Math.floor(userLimit),
      });
      setQuotaSettings(next);
      setQuotaForm({
        guestLimit: String(next.guestLimit ?? 5),
        userLimit: String(next.userLimit ?? 5),
      });
      showToast('生成额度已保存');
    } catch (err) {
      showToast(`保存额度失败: ${err.message}`);
    }
  };

  const handleUserRoleChange = async (userId, role) => {
    try {
      const result = await updateAdminUser(userId, { role });
      setUsers((items) => items.map((item) => (item.id === userId ? result.user : item)));
      showToast('用户身份已更新');
    } catch (err) {
      showToast(`更新用户失败: ${err.message}`);
    }
  };

  const handleAddTrack = async () => {
    try {
      await addLibraryTrack({ mode: libMode, title: newTrack.title, url: newTrack.url, mbti: newTrack.mbti });
      setNewTrack({ title: '', url: '', mbti: '' });
      setLibrary(await getLibrary());
      showToast('曲目已添加');
    } catch (err) {
      showToast(`添加失败: ${err.message}`);
    }
  };

  const handleDeleteTrack = async (id) => {
    try {
      await deleteLibraryTrack(libMode, id);
      setLibrary(await getLibrary());
      showToast('曲目已删除');
    } catch (err) {
      showToast(`删除失败: ${err.message}`);
    }
  };

  const handleUnlock = async () => {
    setStoredAdminToken(authToken);
    try {
      await refresh();
      showToast('已解锁');
    } catch (err) {
      setLoadError(err.message);
    }
  };

  if (!settings) {
    return (
      <div className="glass mx-auto max-w-xl rounded-2xl p-6">
        <span className="deck-label">管理后台</span>
        <p className="mt-3 text-sm text-subtle">{loadError || '加载中...'}</p>
        <div className="mt-4 flex gap-2">
          <input
            type="password"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
            placeholder="ADMIN_TOKEN"
            autoComplete="off"
            className="bg-input flex-1 rounded-xl px-3 py-2 font-mono text-xs"
          />
          <button type="button" onClick={handleUnlock} className="pad px-4 text-sm">
            解锁
          </button>
        </div>
      </div>
    );
  }

  const tracks = library?.[libMode] || [];

  return (
    <div className="space-y-4">
      {toast && (
        <div className="toast-bar fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl px-4 py-2 text-sm">
          {toast}
        </div>
      )}

      {/* 系统状态 */}
      <div className="glass rounded-2xl p-4">
        <span className="deck-label">系统状态</span>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-theme bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="led-dot" style={{ color: status?.ttapi?.active ? '#4ade80' : '#f59e0b' }} />
              <span className="font-display text-sm font-semibold text-theme">TTAPI Suno</span>
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              {status?.ttapi?.active ? `已连接 · ${status.ttapi.modelVersion}` : '未配置，走兜底曲目'}
            </p>
          </div>
          <div className="rounded-xl border border-theme bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className="led-dot" style={{ color: status?.llm?.active ? '#4ade80' : '#f59e0b' }} />
              <span className="font-display text-sm font-semibold text-theme">LLM</span>
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              {status?.llm?.active ? `${status.llm.label}` : '未配置，走关键词模板'}
            </p>
          </div>
        </div>
      </div>

      {/* API Key 配置 */}
      <div className="glass rounded-2xl p-4">
        <span className="deck-label">API 配置</span>
        <div className="mt-3 space-y-3">
          <SecretInput
            label="TTAPI_KEY (Suno 音乐生成)"
            placeholder={settings.TTAPI_KEY?.set ? settings.TTAPI_KEY.value : '在 ttapi.io 获取'}
            value={form.TTAPI_KEY ?? ''}
            onChange={(v) => setForm({ ...form, TTAPI_KEY: v })}
            hint="Suno 无公开 API，经 TTAPI 代理调用"
          />

          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-widest text-subtle">
              LLM 供应商
            </label>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
              {providers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setForm({ ...form, LLM_PROVIDER: p.id })}
                  className={`pad px-2 py-2 text-[11px] ${currentProvider === p.id ? 'pad-active' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {providerKeyName && (
            <SecretInput
              label={providerKeyName}
              placeholder={settings[providerKeyName]?.set ? settings[providerKeyName].value : '输入密钥'}
              value={form[providerKeyName] ?? ''}
              onChange={(v) => setForm({ ...form, [providerKeyName]: v })}
            />
          )}

          {currentProvider === 'custom' && (
            <div>
              <label className="mb-1 block font-mono text-[10px] tracking-widest text-subtle">
                LLM_API_BASE
              </label>
              <input
                type="text"
                value={form.LLM_API_BASE ?? settings.LLM_API_BASE?.value ?? ''}
                onChange={(e) => setForm({ ...form, LLM_API_BASE: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="bg-input w-full rounded-xl px-3 py-2 font-mono text-xs"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-widest text-subtle">
              LLM_MODEL（留空用默认）
            </label>
            <input
              type="text"
              value={form.LLM_MODEL ?? settings.LLM_MODEL?.value ?? ''}
              onChange={(e) => setForm({ ...form, LLM_MODEL: e.target.value })}
              placeholder="如 gpt-4o-mini / claude-3-5-haiku-latest"
              className="bg-input w-full rounded-xl px-3 py-2 font-mono text-xs"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={(form.USE_FALLBACK_ONLY ?? settings.USE_FALLBACK_ONLY?.value) === 'true'}
              onChange={(e) =>
                setForm({ ...form, USE_FALLBACK_ONLY: e.target.checked ? 'true' : 'false' })
              }
              className="accent-amber-400"
            />
            强制只用兜底曲目（demo 彩排模式，不消耗 TTAPI 额度）
          </label>

          <button
            type="button"
            onClick={handleSave}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 font-display text-sm font-bold text-white transition active:scale-[0.98]"
          >
            保存配置
          </button>
          <p className="text-[10px] text-faint">
            保存到 server/data/runtime-config.json（已 gitignore），优先级高于 .env，立即生效无需重启。
          </p>
        </div>
      </div>

      {/* 生成额度 */}
      <div className="glass rounded-2xl p-4">
        <span className="deck-label">生成额度</span>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-widest text-subtle">
              普通用户总生成数
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={quotaForm.guestLimit}
              onChange={(e) => setQuotaForm({ ...quotaForm, guestLimit: e.target.value })}
              className="bg-input w-full rounded-xl px-3 py-2 font-mono text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[10px] tracking-widest text-subtle">
              登录用户总生成数
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={quotaForm.userLimit}
              onChange={(e) => setQuotaForm({ ...quotaForm, userLimit: e.target.value })}
              className="bg-input w-full rounded-xl px-3 py-2 font-mono text-xs"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[10px] text-faint">
            当前：普通 {quotaSettings?.guestLimit ?? 5} 首，登录 {quotaSettings?.userLimit ?? 5} 首；VIP 不限制。
          </p>
          <button type="button" onClick={handleSaveQuota} className="pad px-4 py-2 text-sm">
            保存额度
          </button>
        </div>
      </div>

      {/* 用户身份 */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="deck-label">用户身份</span>
          <button type="button" onClick={() => refresh().then(() => showToast('用户列表已刷新')).catch((err) => showToast(err.message))} className="pad px-3 py-1.5 text-xs">
            刷新
          </button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="font-mono text-[10px] uppercase tracking-widest text-faint">
              <tr>
                <th className="px-2 py-2">用户</th>
                <th className="px-2 py-2">身份</th>
                <th className="px-2 py-2">生成数</th>
                <th className="px-2 py-2">曲目</th>
                <th className="px-2 py-2">创建时间</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id} className="border-t border-theme">
                  <td className="px-2 py-2">
                    <div className="font-medium text-theme">{item.role === 'guest' ? item.name || '游客' : item.name}</div>
                    <div className="font-mono text-[10px] text-faint">{item.email}</div>
                  </td>
                  <td className="px-2 py-2">
                    <select
                      value={item.role}
                      onChange={(e) => handleUserRoleChange(item.id, e.target.value)}
                      className="bg-input rounded-lg px-2 py-1.5 text-xs"
                      aria-label="用户身份"
                    >
                      {['guest', 'user', 'vip'].map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px]">
                    {item.role === 'vip' ? '不限' : item.generationCount}
                  </td>
                  <td className="px-2 py-2 font-mono text-[11px]">{item.trackCount}</td>
                  <td className="px-2 py-2 font-mono text-[10px] text-faint">
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : '-'}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td className="px-2 py-6 text-center text-faint" colSpan={5}>
                    暂无用户身份记录
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 音乐库管理 */}
      <div className="glass rounded-2xl p-4">
        <span className="deck-label">预生成音乐库</span>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setLibMode(m)}
              className={`pad px-2 py-2 text-xs ${libMode === m ? 'pad-active' : ''}`}
            >
              {MODE_LABELS[m]}
              <span className="ml-1 text-faint">({library?.[m]?.length || 0})</span>
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-1.5">
          {tracks.length === 0 && (
            <p className="py-4 text-center text-xs text-faint">该模式下暂无曲目</p>
          )}
          {tracks.map((track) => (
            <div
              key={track.id}
              className="flex items-center gap-2 rounded-xl border border-theme bg-input px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-theme">
                  {track.title}
                  {track.mbti && <span className="ml-1 font-mono text-[10px] text-subtle">{track.mbti}</span>}
                </div>
                <div className="truncate font-mono text-[10px] text-faint">{track.url}</div>
              </div>
              <audio src={track.url} controls preload="none" className="h-8 w-40" />
              <button
                type="button"
                onClick={() => handleDeleteTrack(track.id)}
                className="pad flex h-8 w-8 flex-none items-center justify-center text-sm text-red-500"
                aria-label="删除曲目"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={newTrack.title}
            onChange={(e) => setNewTrack({ ...newTrack, title: e.target.value })}
            placeholder="曲目名称"
            className="bg-input w-32 rounded-xl px-3 py-2 text-xs"
          />
          <select
            value={newTrack.mbti}
            onChange={(e) => setNewTrack({ ...newTrack, mbti: e.target.value })}
            className="bg-input w-28 rounded-xl px-2 py-2 font-mono text-xs"
            aria-label="人格类型"
          >
            <option value="">{libMode === 'personality' ? '选择人格' : '通用'}</option>
            {MBTI_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newTrack.url}
            onChange={(e) => setNewTrack({ ...newTrack, url: e.target.value })}
            placeholder="MP3 URL 或 /samples/xxx.mp3"
            className="bg-input flex-1 rounded-xl px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={handleAddTrack}
            disabled={!newTrack.url.trim()}
            className="pad px-4 text-sm disabled:opacity-40"
          >
            添加
          </button>
        </div>
        <p className="mt-2 text-[10px] text-faint">
          本地文件放入 public/samples/ 后填 /samples/文件名.mp3；赛前用 Suno 批量生成后在此登记。
        </p>
      </div>
    </div>
  );
}
