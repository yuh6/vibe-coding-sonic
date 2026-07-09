import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlayerDeck from './components/PlayerDeck';
import AuthPanel from './components/AuthPanel';
import ThemeToggle from './components/ThemeToggle';
import IconGlyph from './components/IconGlyph';
import { DJConsolePage } from './components/DJConsole';
import { getTheme, mbtiFromAxes } from './lib/mbti';
import { useColorMode } from './hooks/useColorMode';
import { ROUTES, navigateTo, usePathRoute } from './hooks/useRouter';
import { useDJConsole } from './hooks/useDJConsole';
import {
  analyzeProject,
  analyzeGithub,
  authMe,
  generateMusic,
  getDemoSchedule,
  getFallback,
  getMyProfile,
  previewPrompt,
  saveMyProfile,
  startRadio,
  stopRadio,
  syncSchedule,
  updateRadioNowPlaying,
} from './lib/api';
import { useMusicStatusStream, usePlayer } from './hooks/usePlayer';
import { useArranger } from './hooks/useArranger';

const AdminPanel = lazy(() => import('./components/AdminPanel'));
const MixerPage = lazy(() => import('./components/mixer/MixerPage'));
const DiscoverPage = lazy(() => import('./components/DiscoverPage'));
const MBTIWAVE = lazy(() => import('./components/MBTIWAVE'));
const AccountPage = lazy(() => import('./components/AccountPage'));

const STARTUP_FALLBACK_MODE = 'startup';

export default function App() {
  const path = usePathRoute();
  const route = ROUTES.has(path) ? path : '/mbtiwave';
  const isAdmin = route === '/admin';
  const isMixer = route === '/mixer';
  const isDiscover = route === '/discover';
  const isAccount = route === '/account';
  const isHome = route === '/' || route === '/mbtiwave';

  const {
    axes, setAxes,
    style, setStyle,
    mode, setMode,
    vocalMode, setVocalMode,
    genre, setGenre,
    projectName, setProjectName,
    projectDesc, setProjectDesc,
    projectAnalysis, setProjectAnalysis,
    analysisSource, setAnalysisSource,
    promptData, setPromptData,
    promptLoading, setPromptLoading,
    generating, setGenerating,
    fallback, setFallback,
    schedule, setSchedule,
    currentPhase, setCurrentPhase,
    mixerImport, setMixerImport,
  } = useDJConsole();
  const [user, setUser] = useState(null);
  const [credits, setCredits] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [liveStation, setLiveStation] = useState(null);
  const [radioBusy, setRadioBusy] = useState(false);

  const mbti = mbtiFromAxes(axes);
  const theme = getTheme(mbti);
  const { isDark, toggle: toggleColorMode } = useColorMode();
  const player = usePlayer();
  const poll = useMusicStatusStream();
  const arranger = useArranger();
  const analyzeTimer = useRef(null);
  const promptTimer = useRef(null);
  const profileTimer = useRef(null);
  const previousRouteRef = useRef(route);
  const profileLoadedRef = useRef(false);
  const skipAnalyzeRef = useRef(false);
  const generationSeqRef = useRef(0);
  const startupHoldPlayedRef = useRef(false);
  const authRequestSeqRef = useRef(0);

  const applyProfileToApp = useCallback((profile) => {
    if (profile?.axes) setAxes(profile.axes);
    if (profile?.style) setStyle((s) => ({ ...s, ...profile.style }));
    if (profile?.mode) setMode(profile.mode);
  }, []);

  const handleAuthSuccess = useCallback((data) => {
    const seq = authRequestSeqRef.current + 1;
    authRequestSeqRef.current = seq;
    setUser(data.user);
    setCredits(data.credits);
    setAuthReady(true);
    getMyProfile()
      .then((res) => {
        if (seq !== authRequestSeqRef.current) return;
        applyProfileToApp(res?.profile);
        profileLoadedRef.current = true;
      })
      .catch(() => {
        if (seq === authRequestSeqRef.current) profileLoadedRef.current = true;
      });
  }, [applyProfileToApp]);

  const handleAuthLogout = useCallback(() => {
    authRequestSeqRef.current += 1;
    setUser(null);
    setCredits(null);
    setAuthReady(true);
    setLiveStation(null);
  }, []);

  useEffect(() => {
    if (!ROUTES.has(path)) navigateTo('/mbtiwave', { replace: true });
  }, [path]);

  useEffect(() => {
    const seq = authRequestSeqRef.current + 1;
    authRequestSeqRef.current = seq;
    getDemoSchedule().then(setSchedule).catch(() => {});
    // 恢复登录态 + 应用个人档案
    authMe()
      .then((data) => {
        if (seq !== authRequestSeqRef.current) return null;
        setUser(data.user);
        setCredits(data.credits);
        setAuthReady(true);
        return getMyProfile();
      })
      .then((data) => {
        if (seq !== authRequestSeqRef.current || !data) return;
        applyProfileToApp(data?.profile);
        profileLoadedRef.current = true;
      })
      .catch(() => {
        if (seq === authRequestSeqRef.current) {
          setAuthReady(true);
          profileLoadedRef.current = true;
        }
      });
  }, [applyProfileToApp]);

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

  const vocalModeToVocals = useCallback((vm) => {
    if (vm === 'vocal') return { enabled: true };
    if (vm === 'mixed') return { enabled: true };
    return { enabled: false };
  }, []);

  const arrangerGenerationParams = useMemo(() => ({
    projectAnalysis: projectAnalysis || null,
    style,
    selectedGenre: genre || null,
    vocals: vocalModeToVocals(vocalMode),
  }), [projectAnalysis, style, genre, vocalMode, vocalModeToVocals]);

  const refreshPrompt = useCallback(async (nextAxes, nextMode, analysis, nextStyle, nextGenre, nextVocalMode) => {
    setPromptLoading(true);
    try {
      const data = await previewPrompt({
        axes: nextAxes,
        mode: nextMode,
        projectAnalysis: analysis,
        style: nextStyle,
        selectedGenre: nextGenre || undefined,
        vocals: vocalModeToVocals(nextVocalMode),
      });
      setPromptData(data);
    } catch (err) {
      console.error('[prompt]', err);
    } finally {
      setPromptLoading(false);
    }
  }, [vocalModeToVocals]);

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
      refreshPrompt(axes, mode, projectAnalysis, style, genre, vocalMode);
    }, 250);
    return () => clearTimeout(promptTimer.current);
  }, [axes, mode, projectAnalysis, style, genre, vocalMode, refreshPrompt]);

  useEffect(() => {
    if (!arranger.sessionId) return undefined;
    const timer = setTimeout(() => {
      arranger.syncGenerationParams(arrangerGenerationParams).catch((err) => {
        console.error('[arranger params]', err);
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [arranger.sessionId, arrangerGenerationParams, arranger.syncGenerationParams]);

  useEffect(() => {
    const previousRoute = previousRouteRef.current;
    previousRouteRef.current = route;
    if (previousRoute !== '/dj' || route === '/dj') return;

    generationSeqRef.current += 1;
    poll.stopPolling();
    poll.setStatus('idle');
    setGenerating(false);
    player.unload();
    arranger.stop();
  }, [route, poll.stopPolling, poll.setStatus, player.unload, arranger.stop]);

  useEffect(() => {
    if (route !== '/dj') return;
    if (poll.audioUrl) {
      if (poll.meta?.credits) setCredits(poll.meta.credits);
      setFallback(Boolean(poll.meta?.fallback));
      player.playUrl(poll.audioUrl, {
        title: poll.meta?.title || poll.meta?.fallbackTitle || `${mbti} · ${mode}`,
        loop: true,
      });
      setGenerating(false);
    }
  }, [
    route,
    poll.audioUrl,
    poll.meta?.credits,
    poll.meta?.fallback,
    poll.meta?.title,
    poll.meta?.fallbackTitle,
    mbti,
    mode,
    player.playUrl,
  ]);

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
  }, [poll.jobId, poll.status, poll.meta, mbti, mode]);

  const playFallbackNow = useCallback(
    async (nextMode, seq, message = '正在生成，已先接入兜底音乐', options = {}) => {
      const fallbackMode = options.fallbackMode || nextMode;
      const fb = await getFallback({ mode: fallbackMode, mbti });
      if (seq !== generationSeqRef.current) return null;

      setPromptData(fb);
      setFallback(true);
      const url = fb.audioUrl || fb.url;
      if (url) {
        player.playUrl(url, { title: fb.title || `${mbti} · ${fallbackMode}`, loop: true });
      }
      if (fb.tracks?.length) {
        setMixerImport({
          jobId: `fallback-hold-${Date.now()}`,
          title: fb.title || `${mbti} · ${fallbackMode}`,
          status: 'completed',
          stemStatus: 'skipped',
          fallback: true,
          tracks: fb.tracks,
        });
      }
      if (message) setNotice(message);
      return fb;
    },
    [mbti, player]
  );

  const handleGenerate = async (opts = {}) => {
    const nextMode = opts.mode || mode;
    const nextVocalMode = opts.vocalMode || vocalMode;
    if (!opts.skipArrangerStart) {
      arranger.start({
        name: projectName || 'Main Deck',
        mbtiType: mbti,
        mbtiSliders: axes,
        schedule: schedule?.phases,
        generationParams: arrangerGenerationParams,
        playback: false,
      }).catch((err) => {
        console.error('[arranger linked start]', err);
        setNotice('编排缓冲池启动失败，Main Deck 仍会继续生成');
      });
    }
    const shouldPlayStartupHold = Boolean(
      opts.allowStartupHold &&
      !startupHoldPlayedRef.current &&
      !player.currentTitle &&
      !poll.audioUrl &&
      !fallback &&
      !mixerImport?.tracks?.length
    );
    const seq = generationSeqRef.current + 1;
    generationSeqRef.current = seq;
    setGenerating(true);
    poll.setStatus('processing');
    setFallback(false);
    if (shouldPlayStartupHold) {
      startupHoldPlayedRef.current = true;
      await playFallbackNow(nextMode, seq, '正在生成，已先接入启动音效', {
        fallbackMode: STARTUP_FALLBACK_MODE,
      }).catch((err) => {
        console.error('[fallback hold]', err);
        return null;
      });
    }

    try {
      const job = await generateMusic({
        axes,
        mode: nextMode,
        projectAnalysis,
        style,
        selectedGenre: genre || undefined,
        vocals: vocalModeToVocals(nextVocalMode),
        splitStems: nextVocalMode === 'mixed',
        forceFallback: opts.forceFallback,
      });
      if (seq !== generationSeqRef.current) return;
      setPromptData(job);
      if (job.credits) setCredits(job.credits);
      if (job.creditNotice) setNotice(job.creditNotice);
      poll.startPolling(job.jobId);
    } catch (err) {
      console.error('[generate]', err);
      if (err.status === 401) {
        await playFallbackNow(nextMode, seq, '未登录，已切到兜底音乐（登录后可真实生成）').catch((fbErr) => {
          console.error('[fallback]', fbErr);
        });
        setAuthOpen(true);
        setGenerating(false);
        poll.setStatus('completed');
        return;
      }
      try {
        await playFallbackNow(nextMode, seq, '生成失败，已无缝切到兜底音乐');
      } catch (fbErr) {
        console.error('[fallback]', fbErr);
      }
      setGenerating(false);
      poll.setStatus('completed');
    }
  };

  const handleVocalModeChange = (nextVocalMode) => {
    setVocalMode(nextVocalMode);
    handleGenerate({ vocalMode: nextVocalMode });
  };

  const handleArrangerStart = () => {
    arranger.start({
      name: projectName,
      mbtiType: mbti,
      mbtiSliders: axes,
      schedule: schedule?.phases,
      generationParams: arrangerGenerationParams,
      playback: true,
    });
  };

  const stopLiveStation = useCallback(async (message = '电台已下线') => {
    const stationId = liveStation?.id;
    if (!stationId) return;

    setRadioBusy(true);
    try {
      await stopRadio(stationId);
      if (message) setNotice(message);
    } catch (err) {
      console.error('[radio stop]', err);
      setNotice(err.status === 401 ? '登录状态已变化，已清除本地电台状态' : '电台下线请求失败，已清除本地状态');
    } finally {
      setLiveStation((current) => (current?.id === stationId ? null : current));
      setRadioBusy(false);
    }
  }, [liveStation?.id]);

  const handleArrangerStop = async () => {
    await arranger.stop();
    await stopLiveStation('编排已停止，电台已下线');
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

  const handleRadioToggle = async () => {
    if (liveStation) {
      await stopLiveStation('电台已下线');
      return;
    }

    if (!user) {
      setNotice('登录后可以公开电台');
      setAuthOpen(true);
      return;
    }

    if (!arranger.sessionId) {
      setNotice('先开始编排，再公开为电台');
      return;
    }

    setRadioBusy(true);
    try {
      const station = await startRadio({
        title: `${projectName || 'Vibe Coding'} · ${mbti} Radio`,
        description: projectDesc || '',
        sessionId: arranger.sessionId,
        mode: arranger.phase || mode,
        mbti,
      });
      setLiveStation(station);
      setNotice('电台已公开');
    } catch (err) {
      if (err.status === 401) {
        setAuthOpen(true);
        setNotice('登录后可以公开电台');
      } else {
        setNotice(err.message || '电台公开失败');
      }
    } finally {
      setRadioBusy(false);
    }
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

  // 同步 arranger 正在播放的曲目到电台 now-playing snapshot
  useEffect(() => {
    if (!liveStation?.id || !arranger.nowPlayingTrack) return;
    const track = arranger.nowPlayingTrack;
    const audioUrl = track.audioLocal || track.audioUrl;
    if (!audioUrl) return;

    updateRadioNowPlaying(liveStation.id, {
      title: track.title || track.moodTag || `${track.genre || 'Live'} Track`,
      genre: track.genre,
      bpm: track.bpm,
      audioUrl,
    }).catch((err) => {
      console.error('[radio now-playing]', err);
    });
  }, [liveStation?.id, arranger.nowPlayingTrack]);

  const pageBg = isMixer
    ? `radial-gradient(ellipse at 18% 0%, rgba(52, 211, 153, 0.16) 0%, transparent 48%),
       radial-gradient(ellipse at 82% 100%, rgba(14, 165, 233, 0.12) 0%, transparent 52%),
       #050505`
    : isDark
      ? `radial-gradient(ellipse at 20% 0%, ${theme.primary} 0%, transparent 55%),
         radial-gradient(ellipse at 80% 100%, ${theme.accent}26 0%, transparent 50%),
         var(--page-bg)`
      : `radial-gradient(ellipse at 20% 0%, ${theme.accent}22 0%, transparent 50%),
         radial-gradient(ellipse at 80% 100%, ${theme.glow}18 0%, transparent 55%),
         var(--page-bg)`;

  // MBTIWAVE 整页接管（自带页头/页脚），单独渲染，不套用 DJ 控制台的外层布局。
  if (isHome) {
    return (
      <Suspense fallback={null}>
        <MBTIWAVE
          isDark={isDark}
          onToggleColorMode={toggleColorMode}
          user={user}
          credits={credits}
          authReady={authReady}
          authOpen={authOpen}
          onAuthOpenChange={setAuthOpen}
          onAuth={handleAuthSuccess}
          onLogout={handleAuthLogout}
          onCreditsChange={setCredits}
          onAccountOpen={() => navigateTo('/account')}
          onBeforeLogout={() => stopLiveStation('登出前电台已下线')}
          onNavigate={navigateTo}
        />
      </Suspense>
    );
  }

  const mainDeck = (
    <PlayerDeck
      playing={player.playing}
      volume={player.volume}
      muted={player.muted}
      hasAudio={player.hasAudio}
      playbackError={player.playbackError}
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
      onGenerate={() => handleGenerate({ forceFallback: false, allowStartupHold: true })}
      generating={generating}
      engineSessionId={arranger.sessionId}
      engineState={arranger.state}
      enginePhase={arranger.phase || arranger.nowPlayingTrack?.phase || mode}
      poolStatus={arranger.poolStatus}
    />
  );

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isMixer ? 'mixer-app-frame' : ''}`} style={{ background: pageBg }}>
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
                MBTIWAVE
              </h1>
              <p className="text-[11px] text-subtle">MBTI × 项目 × 节奏 · AI DJ 控制台</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <AuthPanel
              user={user}
              credits={credits}
              loading={!authReady}
              open={authOpen}
              onOpenChange={setAuthOpen}
              onBeforeLogout={() => stopLiveStation('登出前电台已下线')}
              onAuth={handleAuthSuccess}
              onLogout={handleAuthLogout}
              onAccountOpen={() => navigateTo('/account')}
            />
            <ThemeToggle isDark={isDark} onToggle={toggleColorMode} />
            <a
              href="/mbtiwave"
              onClick={(event) => {
                event.preventDefault();
                navigateTo('/mbtiwave');
              }}
              className="pad flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold no-underline hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
            >
              <IconGlyph name="roomwave" className="h-4 w-4" />
              <span>MBTIWAVE</span>
            </a>
            {/* {!isDiscover && (
              <a
                href="/discover"
                className="pad px-3 py-1.5 text-xs font-bold no-underline hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                🌍 发现
              </a>
            )} */}
            {/* {!isMixer && (
              <a
                href="/mixer"
                className="pad px-3 py-1.5 text-xs font-bold no-underline hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              >
                🎚 调音台
              </a>
            )} */}
            {/* {!isAdmin && (
              <a
                href="/admin"
                className="pad px-3.5 py-2 text-xs text-muted no-underline"
              >
                ⚙️ 管理后台
              </a>
            )} */}
          </div>
        </header>

        {isAdmin ? (
          <Suspense fallback={null}>
            <AdminPanel />
          </Suspense>
        ) : isAccount ? (
          <Suspense fallback={null}>
            <AccountPage
              user={user}
              credits={credits}
              onUserChange={setUser}
              onCreditsChange={setCredits}
              onRequireAuth={() => setAuthOpen(true)}
            />
          </Suspense>
        ) : isMixer ? (
          <Suspense fallback={null}>
            <MixerPage
              incomingMix={mixerImport}
              user={user}
              onRequireAuth={(message = '登录后才能加载远程音频 URL') => {
                setNotice(message);
                setAuthOpen(true);
              }}
            />
          </Suspense>
        ) : isDiscover ? (
          <Suspense fallback={null}>
            <DiscoverPage
              user={user}
              onPlayTrack={(track) => player.playUrl(track.audioUrl, { title: track.title || '' })}
              onTogglePlayback={player.togglePlay}
              onStopPlayback={player.unload}
              onRequireAuth={(message = '登录后可以使用此功能') => {
                setNotice(message);
                setAuthOpen(true);
              }}
            />
          </Suspense>
        ) : (
          <DJConsolePage
            axes={axes}
            onAxesChange={setAxes}
            theme={theme}
            style={style}
            onStyleChange={setStyle}
            projectName={projectName}
            projectDesc={projectDesc}
            onProjectNameChange={setProjectName}
            onProjectDescChange={setProjectDesc}
            onApplyPreset={handleApplyPreset}
            onGithubAnalyze={handleGithubAnalyze}
            analysisSource={analysisSource}
            mainDeck={mainDeck}
            genre={genre}
            onGenreChange={setGenre}
            arranger={arranger}
            onArrangerStart={handleArrangerStart}
            onArrangerStop={handleArrangerStop}
            onArrangerPhaseChange={handleArrangerPhaseChange}
            onArrangerFeedback={handleArrangerFeedback}
            liveStation={liveStation}
            radioBusy={radioBusy}
            onRadioToggle={handleRadioToggle}
            vocalMode={vocalMode}
            onVocalModeChange={handleVocalModeChange}
            promptData={promptData}
            promptLoading={promptLoading}
          />
        )}      </div>
    </div>
  );
}
