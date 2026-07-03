import { useRef, useState } from 'react';

const PRESETS = [
  { name: '足球经理游戏', description: '复古像素风格的足球经理策略游戏，强调竞技与战术' },
  { name: '佛学概念工具', description: '帮助用户理解佛学概念的冥想与知识工具' },
  { name: '户外徒步平台', description: '户外徒步路线分享与社区探索平台' },
];

const TABS = [
  { id: 'text', label: '✏️ 手动输入' },
  { id: 'folder', label: '📁 项目文件夹' },
  { id: 'github', label: '🐙 GitHub' },
];

const READABLE_FILES = ['readme.md', 'readme.txt', 'package.json', 'pyproject.toml', 'cargo.toml', 'go.mod'];
const MAX_READ_SIZE = 60 * 1024;

async function summarizeFolder(fileList) {
  const files = Array.from(fileList);
  if (!files.length) return null;

  const rootName = files[0].webkitRelativePath.split('/')[0] || '项目';
  const extCount = {};
  for (const f of files) {
    const ext = f.name.includes('.') ? f.name.split('.').pop().toLowerCase() : '';
    if (ext) extCount[ext] = (extCount[ext] || 0) + 1;
  }
  const topExts = Object.entries(extCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([ext, n]) => `${ext}(${n})`)
    .join(', ');

  const excerpts = [];
  for (const f of files) {
    const depth = f.webkitRelativePath.split('/').length;
    if (depth <= 2 && READABLE_FILES.includes(f.name.toLowerCase()) && f.size < MAX_READ_SIZE) {
      const text = await f.text();
      excerpts.push(`--- ${f.name} ---\n${text.slice(0, 1200)}`);
      if (excerpts.length >= 3) break;
    }
  }

  const description = [
    `本地项目文件夹，共 ${files.length} 个文件。主要文件类型: ${topExts}`,
    ...excerpts,
  ].join('\n');

  return { name: rootName, description };
}

export default function ProjectDeck({
  name,
  description,
  onNameChange,
  onDescriptionChange,
  onApplyPreset,
  onGithubAnalyze,
  analysisSource,
}) {
  const [tab, setTab] = useState('text');
  const [githubUrl, setGithubUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const folderRef = useRef(null);

  const handleFolder = async (e) => {
    setBusy(true);
    setMessage('正在读取文件夹...');
    try {
      const summary = await summarizeFolder(e.target.files);
      if (summary) {
        onNameChange(summary.name);
        onDescriptionChange(summary.description);
        setMessage(`已解析「${summary.name}」，AI 正在提取音乐主题`);
      }
    } catch (err) {
      setMessage(`读取失败: ${err.message}`);
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleGithub = async () => {
    if (!githubUrl.trim()) return;
    setBusy(true);
    setMessage('正在解析 GitHub 仓库...');
    try {
      await onGithubAnalyze(githubUrl.trim());
      setMessage('仓库解析完成');
    } catch (err) {
      setMessage(`解析失败: ${err.message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="glass rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="deck-label">Project Input</span>
        {analysisSource && (
          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-white/50">
            via {analysisSource}
          </span>
        )}
      </div>

      <div className="mb-3 flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`pad flex-1 py-2 text-xs ${tab === t.id ? 'pad-active' : 'text-white/50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'text' && (
        <div>
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="项目名称"
            className="mb-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          />
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="一句话描述你在做什么..."
            rows={2}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'folder' && (
        <div className="text-center">
          <input
            ref={folderRef}
            type="file"
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={handleFolder}
          />
          <button
            type="button"
            onClick={() => folderRef.current?.click()}
            disabled={busy}
            className="pad w-full py-6 text-sm text-white/70 disabled:opacity-50"
          >
            <span className="mb-1 block text-3xl">📁</span>
            {busy ? '解析中...' : '点击选择项目文件夹'}
            <span className="mt-1 block text-[10px] text-white/40">
              自动读取 README / package.json 提取项目主题
            </span>
          </button>
        </div>
      )}

      {tab === 'github' && (
        <div className="flex gap-2">
          <input
            type="text"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGithub()}
            placeholder="https://github.com/owner/repo"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleGithub}
            disabled={busy || !githubUrl.trim()}
            className="pad px-4 text-sm disabled:opacity-40"
          >
            {busy ? '...' : '解析'}
          </button>
        </div>
      )}

      {message && <p className="mt-2 text-[11px] text-white/45">{message}</p>}
    </div>
  );
}
