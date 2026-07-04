import { useCallback, useEffect, useRef, useState } from 'react';
import MBTIRemixDeck from './components/MBTIRemixDeck';
import StyleFaders from './components/StyleFaders';
import ModePads from './components/ModePads';
import PlayerDeck from './components/PlayerDeck';
import ProjectDeck from './components/ProjectDeck';
import PromptCard from './components/PromptCard';
import Timeline from './components/Timeline';
import ArrangerPanel from './components/ArrangerPanel';
import AdminPanel from './components/AdminPanel';
import MixerPage from './components/mixer/MixerPage';
import DiscoverPage from './components/DiscoverPage';
import AuthPanel from './components/AuthPanel';
import ThemeToggle from './components/ThemeToggle';
import { getTheme, mbtiFromAxes, axesFromMbti } from './lib/mbti';
import { useColorMode } from './hooks/useColorMode';
import {
  analyzeProject,
  analyzeGithub,
  authMe,
  generateMusic,
  getDemoSchedule,
  getFallback,
  getHealth,
  getMyProfile,
  previewPrompt,
  saveMyProfile,
  syncSchedule,
} from './lib/api';
import { useMusicPoll, usePlayer } from './hooks/usePlayer';
import { useArranger } from './hooks/useArranger';

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();
  const isAdmin = hash === '#/admin';
  const isMixer = hash === '#/mixer';
  const isDiscover = hash === '#/discover';

  const [axes, setAxes] = useState(axesFromMbti('INTJ'));
  const [style, setStyle] = useState({ energy: 50, texture: 35, brightness: 40 });
  const [mode, setMode] = useState('focus');
  const [projectName, setProjectName] = useState('足球经理游戏');
  const [projectDesc, setProjectDesc] = useState('复古像素风格的足球经理策略游戏，强调竞技与战术');
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [analysisSource, setAnalysisSource] = useState('');
  const [promptData, setPromptData] = useState(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [health, setHealth] = useState(null);
  const [schedule, setSchedule] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(null);
  const [mixerImport, setMixerImport] = useState(null);
  const [user, setUser] = useState(null);
  const [quota, setQuota] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const mbti = mbtiFromAxes(axes);
  const theme = getTheme(mbti);
  const { isDark, toggle: toggleColorMode } = useColorMode();
  const player = usePlayer();
  const poll = useMusicPoll();
  const arranger = useArranger();
  const analyzeTimer = useRef(null);
  const promptTimer = useRef(null);
  const profileTimer = useRef(null);
  const profileLoadedRef = useRef(false);
  const skipAnalyzeRef = useRef(false);
  const autoRoutedJobRef = useRef(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
    getDemoSchedule().then(setSchedule).catch(() => {});
    // 恢复登录态 + 应用个人档案
    authMe()
      .then((data) => {
        setUser(data.user);
        setQuota(data.quota);
        return getMyProfile();
      })
      .then((data) => {
        const profile = data?.profile;
        if (profile?.axes) setAxes(profile.axes);
        if (profile?.style) setStyle((s) => ({ ...s, ...profile.style }));
        if (profile?.mode) setMode(profile.mode);
        profileLoadedRef.current = true;
      })
      .catch(() => {
        profileLoadedRef.current = true;
      });
  }, []);

  // 档案自动保存（防抖，登录后才生效）
  useEffect(() => {
    if (!user || !profileLoadedRef.current) return;
    clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(() => {
      saveMyProfile({ axes, style, mode }).catch(() => {});
    }, 1200);
    return () => clearTimeout(profileTimer.current);
  }, [user, axes, style, mode]);

  // 顶部提示条自动消失
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!schedule?.phases) return;
    const sync = () =>
      syncSchedule(schedule.phases)
        .then((data) => setCurrentPhase(data.current))
        .catch(() => {});
    sync();
    const interval = setInterval(sync, 60000);
    return () => clearInterval(interval);
  }, [schedule]);

  const refreshPrompt = useCallback(async (nextAxes, nextMode, analysis, nextStyle) => {
    setPromptLoading(true);
    try {
      const data = await previewPrompt({
        axes: nextAxes,
        mode: nextMode,
        projectAnalysis: analysis,
        style: nextStyle,
      });
      setPromptData(data);
    } catch (err) {
      console.error('[prompt]', err);
    } finally {
      setPromptLoading(false);
    }
  }, []);

  // 项目文本变化 → LLM/模板分析（防抖）
  useEffect(() => {
    if (skipAnalyzeRef.current) {
      skipAnalyzeRef.current = false;
      return;
    }
    clearTimeout(analyzeTimer.current);
    analyzeTimer.current = setTimeout(async () => {
      if (!projectName && !projectDesc) {
        setProjectAnalysis(null);
        setAnalysisSource('');
        return;
      }
      try {
        const analysis = await analyzeProject({ name: projectName, description: projectDesc });
        setProjectAnalysis(analysis);
        setAnalysisSource(analysis.source || '');
      } catch (err) {
        console.error('[analyze]', err);
      }
    }, 600);
    return () => clearTimeout(analyzeTimer.current);
  }, [projectName, projectDesc]);

  // 任何输入变化 → 刷新 prompt 预览（防抖）
  useEffect(() => {
    clearTimeout(promptTimer.current);
    promptTimer.current = setTimeout(() => {
      refreshPrompt(axes, mode, projectAnalysis, style);
    }, 250);
    return () => clearTimeout(promptTimer.current);
  }, [axes, mode, projectAnalysis, style, refreshPrompt]);

  useEffect(() => {
    if (poll.audioUrl) {
      setFallback(Boolean(poll.meta?.fallback));
      player.playUrl(poll.audioUrl, {
        title: poll.meta?.fallbackTitle || `${mbti} · ${mode}`,
        loop: true,
      });
      setGenerating(false);
    }
  }, [poll.audioUrl]);

  useEffect(() => {
    const tracks = Array.isArray(poll.meta?.tracks)
      ? poll.meta.tracks.filter((track) => track?.url)
      : [];
    if (!poll.jobId || tracks.length === 0) return;

    const title = poll.meta?.title || poll.meta?.fallbackTitle || `${mbti} · ${mode}`;
    setMixerImport({
      jobId: poll.jobId,
      title,
      status: poll.status,
      stemStatus: poll.meta?.stemStatus,
      stemProgress: poll.meta?.stemProgress,
      stemError: poll.meta?.stemError,
      fallback: Boolean(poll.meta?.fallback),
      tracks,
    });

    if (!poll.meta?.fallback && autoRoutedJobRef.current !== poll.jobId) {
      autoRoutedJobRef.current = poll.jobId;
      window.location.hash = '#/mixer';
    }
  }, [poll.jobId, poll.status, poll.meta, mbti, mode]);

  const handleGenerate = async (opts = {}) => {
    const nextMode = opts.mode || mode;
    setGenerating(true);
    poll.setStatus('processing');
    setFallback(false);

    try {
      const job = await generateMusic({
        axes,
        mode: nextMode,
        projectAnalysis,
        style,
        forceFallback: opts.forceFallback,
      });
      setPromptData(job);
      if (job.quota) setQuota(job.quota);
      if (job.quotaNotice) setNotice(job.quotaNotice);
      poll.startPolling(job.jobId);
    } catch (err) {
      console.error('[generate]', err);
      if (err.status === 401) {
        setAuthOpen(true);
        setNotice('登录后即可生成专属音乐');
        setGenerating(false);
        poll.setStatus('idle');
        return;
      }
      try {
        const fb = await getFallback({ mode: nextMode, mbti });
        setPromptData(fb);
        setFallback(true);
        if (fb.url) player.playUrl(fb.url, { title: fb.title, loop: true });
        if (fb.tracks?.length) {
          const jobId = `fallback-${Date.now()}`;
          setMixerImport({
            jobId,
            title: fb.title || `${mbti} · ${nextMode}`,
            status: 'completed',
            stemStatus: 'skipped',
            fallback: true,
            tracks: fb.tracks,
          });
        }
      } catch (fbErr) {
        console.error('[fallback]', fbErr);
      }
      setGenerating(false);
      poll.setStatus('failed');
    }
  };

  const handleModeChange = (nextMode) => {
    setMode(nextMode);
    handleGenerate({ mode: nextMode, forceFallback: true });
  };

  const handlePanic = () => {
    setMode('behind');
    handleGenerate({ mode: 'behind', forceFallback: true });
  };

  const handleArrangerStart = () => {
    arranger.start({ name: projectName, mbtiType: mbti, mbtiSliders: axes, schedule: schedule?.phases });
  };

  const handleArrangerStop = () => {
    arranger.stop();
  };

  const handleArrangerPhaseChange = (nextPhase) => {
    arranger.changePhase(nextPhase);
  };

  const handleArrangerFeedback = (action) => {
    arranger.feedback(action);
  };

  const handleApplyPreset = (preset) => {
    setProjectName(preset.name);
    setProjectDesc(preset.description);
  };

  const handleGithubAnalyze = async (url) => {
    const analysis = await analyzeGithub(url);
    skipAnalyzeRef.current = true;
    setProjectName(analysis.repo?.fullName || url);
    skipAnalyzeRef.current = true;
    setProjectDesc(analysis.repo?.description || '');
    setProjectAnalysis(analysis);
    setAnalysisSource(`github · ${analysis.source || ''}`);
  };

  const pageBg = isDark
    ? `radial-gradient(ellipse at 20% 0%, ${theme.primary} 0%, transparent 55%),
       radial-gradient(ellipse at 80% 100%, ${theme.accent}26 0%, transparent 50%),
       var(--page-bg)`
    : `radial-gradient(ellipse at 20% 0%, ${theme.accent}22 0%, transparent 50%),
       radial-gradient(ellipse at 80% 100%, ${theme.glow}18 0%, transparent 55%),
       var(--page-bg)`;

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: pageBg }}>
      <div className="mx-auto max-w-7xl px-4 py-6">
        {notice && (
          <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-xl border border-amber-400/40 bg-black/85 px-4 py-2 text-sm text-amber-200 backdrop-blur">
            {notice}
          </div>
        )}
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`vinyl-disc flex h-10 w-10 items-center justify-center rounded-full ${
                player.playing ? 'spin-vinyl' : ''
              }`}
              style={{ boxShadow: `0 0 16px ${theme.accent}55` }}
            >
              <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.accent }} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight text-theme sm:text-2xl">
                Vibe Coding 有歌声
              </h1>
              <p className="text-[11px] text-subtle">MBTI × 项目 × 节奏 · AI DJ 控制台</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AuthPanel
              user={user}
              quota={quota}
              open={authOpen}
              onOpenChange={setAuthOpen}
              onAuth={(data) => {
                setUser(data.user);
                setQuota(data.quota);
                getMyProfile()
                  .then((res) => {
                    const profile = res?.profile;
                    if (profile?.axes) setAxes(profile.axes);
                    if (profile?.style) setStyle((s) => ({ ...s, ...profile.style }));
                    if (profile?.mode) setMode(profile.mode);
                  })
                  .catch(() => {});
              }}
              onLogout={() => {
                setUser(null);
                setQuota(null);
              }}
            />
            {health && (
              <div className="status-pill flex items-center gap-3 rounded-full px-3 py-1.5 font-mono text-[10px]">
                <span className="flex items-center gap-1.5">
                  <span className="led-dot" style={{ color: health.ttapi ? '#4ade80' : '#f59e0b' }} />
                  <span className="text-muted">TTAPI</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="led-dot" style={{ color: health.llm ? '#4ade80' : '#f59e0b' }} />
                  <span className="text-muted">LLM</span>
                </span>
              </div>
            )}
            <ThemeToggle isDark={isDark} onToggle={toggleColorMode} />
            <a
              href={isDiscover ? '#/' : '#/discover'}
              className="pad px-3.5 py-2 text-xs text-muted no-underline"
            >
              {isDiscover ? '🎛 DJ 台' : '🌍 发现'}
            </a>
            <a
              href={isMixer ? '#/' : '#/mixer'}
              className="pad px-3.5 py-2 text-xs text-muted no-underline"
            >
              {isMixer ? '🎛 DJ 台' : '🎚 调音台'}
            </a>
            <a
              href={isAdmin ? '#/' : '#/admin'}
              className="pad px-3.5 py-2 text-xs text-muted no-underline"
            >
              {isAdmin ? '🎛 返回控制台' : '⚙️ 管理后台'}
            </a>
          </div>
        </header>

        {isAdmin ? (
          <AdminPanel />
        ) : isMixer ? (
          <MixerPage incomingMix={mixerImport} />
        ) : isDiscover ? (
          <DiscoverPage onPlayTrack={(track) => player.playUrl(track.audioUrl, { title: track.title || '' })} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-12">
            {/* 左 Deck：MBTI Remix + 风格 */}
            <div className="space-y-4 lg:col-span-4">
              <MBTIRemixDeck axes={axes} onAxesChange={setAxes} theme={theme} />
              <StyleFaders style={style} onStyleChange={setStyle} />
            </div>

            {/* 中 Deck：播放器 */}
            <div className="space-y-4 lg:col-span-5">
              <PlayerDeck
                playing={player.playing}
                volume={player.volume}
                muted={player.muted}
                status={generating ? 'processing' : poll.status}
                currentTitle={player.currentTitle}
                fallback={fallback}
                bpm={promptData?.bpm}
                mbti={mbti}
                mode={mode}
                theme={theme}
                onTogglePlay={player.togglePlay}
                onVolumeChange={player.setVolume}
                onToggleMute={player.toggleMute}
                onGenerate={() => handleGenerate({ forceFallback: false })}
                generating={generating}
              />
              <ProjectDeck
                name={projectName}
                description={projectDesc}
                onNameChange={setProjectName}
                onDescriptionChange={setProjectDesc}
                onApplyPreset={handleApplyPreset}
                onGithubAnalyze={handleGithubAnalyze}
                analysisSource={analysisSource}
              />
            </div>

            {/* 右 Deck：模式 + Prompt 监视器 + 编排引擎 */}
            <div className="space-y-4 lg:col-span-3">
              <ModePads mode={mode} onModeChange={handleModeChange} onPanic={handlePanic} />
              <PromptCard
                layers={promptData?.layers}
                fullPrompt={promptData?.fullPrompt}
                loading={promptLoading}
              />
              <ArrangerPanel
                arranger={arranger}
                theme={theme}
                onStart={handleArrangerStart}
                onStop={handleArrangerStop}
                onPhaseChange={handleArrangerPhaseChange}
                onFeedback={handleArrangerFeedback}
              />
            </div>

            {/* 底部：日程 */}
            {schedule && (
              <div className="lg:col-span-12">
                <Timeline phases={schedule.phases} currentPhase={currentPhase} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
