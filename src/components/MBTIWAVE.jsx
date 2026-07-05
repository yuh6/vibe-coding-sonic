import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, Send, Volume2, VolumeX, Play, Pause,
  Music, ChevronRight,
  Activity, Disc, Headphones, Radio, Zap, MessageSquare,
  Compass, SlidersHorizontal
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/mbtiwave.css';
import { usePlayer, useMusicPoll } from '../hooks/usePlayer';
import { useArranger } from '../hooks/useArranger';
import { generateMusic, getFallback, analyzeProject, analyzeGithub, previewPrompt, getHealth, authMe, getMyProfile, getDemoSchedule, syncSchedule } from '../lib/api';
import { mbtiFromAxes, getTheme, MODES } from '../lib/mbti';
import AuthPanel from './AuthPanel';
import AudioVisualizer from './AudioVisualizer';
import ModePads from './ModePads';
import VocalMode from './VocalMode';
import ProjectDeck from './ProjectDeck';
import PromptCard from './PromptCard';
import ArrangerPanel from './ArrangerPanel';
import MBTIRemixDeck from './MBTIRemixDeck';
import Timeline from './Timeline';

const STARTUP_FALLBACK_MODE = 'startup';

// ┌─────────────────────────────────────────────────────────────┐
// │ 首页顶部可翻页的本地视频 —— 想换/加视频，改 HERO_VIDEOS 数组     │
// │ 把视频文件放到项目 public/ 目录，例：public/hero1.mp4 ...       │
// │ 数组里按顺序写它们的根路径（public 下文件走根路径）。           │
// │ ⚠️ 浏览器会拦截带声音的自动播放，故默认静音自动播；             │
// │    观众点一下播放器/取消静音即可出声。                          │
// └─────────────────────────────────────────────────────────────┘
const HERO_VIDEOS = ['/hero1.mp4', '/hero2.mp4', '/hero3.mp4']; // 放到 public/ 下

// 首页顶部可翻页视频播放器（16:9，静音自动播放，箭头+圆点翻页）
function HeroVideoPlayer({ sources }) {
  const list = (sources || []).filter(Boolean);
  const [idx, setIdx] = useState(0);
  if (!list.length) return null;
  const current = Math.min(idx, list.length - 1);
  const go = (n) => setIdx((n + list.length) % list.length);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[2rem] border border-white/10 bg-black shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
      {/* key 强制切换时重挂载，触发新视频自动播放 */}
      <video
        key={list[current]}
        className="absolute inset-0 h-full w-full object-contain"
        src={list[current]}
        autoPlay
        muted
        loop
        playsInline
        controls
      />

      {list.length > 1 && (
        <>
          {/* 左右翻页箭头 */}
          <button
            type="button"
            onClick={() => go(current - 1)}
            title="上一个"
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronRight className="h-5 w-5 rotate-180" />
          </button>
          <button
            type="button"
            onClick={() => go(current + 1)}
            title="下一个"
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/80 backdrop-blur transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* 顶部圆点指示 + 直接跳转 */}
          <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 gap-2 rounded-full bg-black/40 px-3 py-1.5 backdrop-blur">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                title={`第 ${i + 1} 个`}
                className={`h-2 rounded-full transition-all ${
                  i === current ? 'w-5 bg-[#00FF66]' : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// 首页专辑封面滚动墙 —— 图片放在 public/albums/ （1.jpg ~ 15.jpg）
const ALBUM_COVERS = Array.from({ length: 15 }, (_, i) => `/albums/${i + 1}.jpg`);

function AlbumMarquee({ covers = ALBUM_COVERS }) {
  const list = covers.filter(Boolean);
  if (!list.length) return null;
  // 复制两份，形成无缝循环
  const loop = [...list, ...list];

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.55),rgba(9,9,11,0.7))] p-6 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
      <div className="mb-4 flex items-end justify-between">
        <div>
          <p className="mono-font text-xs uppercase tracking-[0.32em] text-[#00FF66]">Now Spinning</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white">正在转动的专辑</h2>
        </div>
        <span className="mono-font text-[10px] text-zinc-500">悬停暂停</span>
      </div>

      <div className="album-marquee">
        <div className="album-marquee-track gap-4">
          {loop.map((src, i) => (
            <div
              key={i}
              className="group relative h-40 w-40 flex-none overflow-hidden rounded-2xl border border-white/10 bg-black shadow-lg transition-transform duration-300 hover:scale-105 hover:border-[#00FF66]/40"
            >
              <img
                src={src}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-opacity group-hover:opacity-100"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}



// Solo 页模式中文名 → 后端 mode id
const MODE_ID_BY_LABEL = {
  头脑风暴: 'brainstorm',
  专注构思: 'focus',
  代码冲刺: 'sprint',
  战鼓催阵: 'charge',
  落后了: 'behind',
  休息一下: 'break',
  '完成了！': 'celebrate',
};

// MBTIWAVE soloDims 用 ei（E<50），DJ 后端 axes 用 ie（I<50），方向相反。
// ns/tf/jp 键名与方向一致，可直接沿用。
function soloDimsToAxes(dims) {
  return {
    ie: 100 - dims.ei,
    ns: dims.ns,
    tf: dims.tf,
    jp: dims.jp,
  };
}

// 播放状态文字（照抄 DJ Main Deck 的 STATUS_LABEL）
const SOLO_STATUS_LABEL = {
  idle: 'STANDBY',
  processing: 'GENERATING',
  splitting: 'SPLITTING STEMS',
  completed: 'ON AIR',
  failed: 'ERROR',
};

// MBTI 人格配置及其美学视觉
const mbtiData = [
  { id: 'INFP', name: '调停者', track: 'Sleepless Dream', color: 'from-emerald-500/20 to-teal-500/20', border: 'border-emerald-500/30', glow: 'shadow-[0_0_20px_rgba(16,185,129,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-starry-night-sky-over-a-silent-river-42998-large.mp4', vibe: '梦幻、极简电子、后摇', bpm: '94 BPM' },
  { id: 'INFJ', name: '倡导者', track: 'Cosmic Resonance', color: 'from-indigo-500/20 to-purple-500/20', border: 'border-indigo-500/30', glow: 'shadow-[0_0_20px_rgba(99,102,241,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-abstract-laser-lights-background-41846-large.mp4', vibe: '空灵、氛围声景、新古典', bpm: '80 BPM' },
  { id: 'ENFP', name: '竞选者', track: 'Neon Euphoria', color: 'from-pink-500/20 to-rose-500/20', border: 'border-pink-500/30', glow: 'shadow-[0_0_20px_rgba(244,63,94,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-liquid-iridescent-background-loop-48766-large.mp4', vibe: '迷幻、合成器波、热烈', bpm: '125 BPM' },
  { id: 'ENFJ', name: '主人公', track: 'Rising Pulse', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30', glow: 'shadow-[0_0_20px_rgba(245,158,11,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-dancing-lights-and-flashing-flares-in-a-concert-43105-large.mp4', vibe: '圣洁、现场现场、灵魂乐', bpm: '112 BPM' },

  { id: 'INTJ', name: '建筑师', track: 'Binary Monologue', color: 'from-violet-600/20 to-fuchsia-600/20', border: 'border-violet-500/30', glow: 'shadow-[0_0_20px_rgba(139,92,246,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-digital-code-background-with-green-lines-41851-large.mp4', vibe: '理性、工业极简、IDM', bpm: '128 BPM' },
  { id: 'INTP', name: '思想家', track: 'Cybernetic Drift', color: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/30', glow: 'shadow-[0_0_20px_rgba(6,182,212,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-glowing-digital-grid-looping-background-41855-large.mp4', vibe: '深邃、 glitch-hop、微波', bpm: '105 BPM' },
  { id: 'ENTP', name: '辩论家', track: 'Voltage Paradox', color: 'from-red-500/20 to-orange-500/20', border: 'border-red-500/30', glow: 'shadow-[0_0_20px_rgba(239,68,68,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-electric-sparks-on-black-background-42173-large.mp4', vibe: '张力、噪音摇滚、重拍', bpm: '140 BPM' },
  { id: 'ENTJ', name: '指挥官', track: 'Imperial Drive', color: 'from-amber-600/20 to-rose-700/20', border: 'border-amber-600/30', glow: 'shadow-[0_0_20px_rgba(217,119,6,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-rotating-golden-lines-and-light-particles-43108-large.mp4', vibe: '宏大、深沉科技、交响电子', bpm: '135 BPM' },

  { id: 'ISFP', name: '艺术家', track: 'Silent Canvas', color: 'from-teal-400/20 to-cyan-400/20', border: 'border-teal-400/30', glow: 'shadow-[0_0_20px_rgba(45,212,191,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-smoke-in-colorful-backlight-41847-large.mp4', vibe: '感性、低保真、寒潮', bpm: '85 BPM' },
  { id: 'ISTP', name: '鉴赏家', track: 'Analog Engine', color: 'from-zinc-500/20 to-slate-600/20', border: 'border-zinc-500/30', glow: 'shadow-[0_0_20px_rgba(115,115,115,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-tunnel-of-metallic-pipes-and-gears-42211-large.mp4', vibe: '机械、冷酷、暗潮', bpm: '118 BPM' },
  { id: 'ESFP', name: '表演家', track: 'Fever Disco', color: 'from-yellow-400/20 to-pink-500/20', border: 'border-yellow-400/30', glow: 'shadow-[0_0_20px_rgba(250,204,21,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-close-up-of-shiny-golden-disco-balls-rolling-43096-large.mp4', vibe: '复古、迪斯科、放克', bpm: '122 BPM' },
  { id: 'ESTP', name: '挑战者', track: 'Turbo Pulse', color: 'from-orange-500/20 to-red-600/20', border: 'border-orange-500/30', glow: 'shadow-[0_0_20px_rgba(249,115,22,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-fast-car-driving-in-city-traffic-at-night-42203-large.mp4', vibe: '硬核、重金属、高能电音', bpm: '150 BPM' },

  { id: 'ISFJ', name: '守卫者', track: 'Warm Hearth', color: 'from-green-600/20 to-yellow-600/20', border: 'border-green-600/30', glow: 'shadow-[0_0_20px_rgba(22,163,74,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-candle-flame-flickering-in-dark-room-41618-large.mp4', vibe: '温暖、原声吉他、舒缓', bpm: '75 BPM' },
  { id: 'ISTJ', name: '物流师', track: 'Grid Symphony', color: 'from-blue-600/20 to-indigo-700/20', border: 'border-blue-600/30', glow: 'shadow-[0_0_20px_rgba(37,99,235,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-structured-architectural-lines-41853-large.mp4', vibe: '秩序、极简微电、节拍', bpm: '100 BPM' },
  { id: 'ESFJ', name: '执政官', track: 'United Hearts', color: 'from-sky-400/20 to-teal-500/20', border: 'border-sky-400/30', glow: 'shadow-[0_0_20px_rgba(56,189,248,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-sparks-flying-from-a-bonfire-at-night-43100-large.mp4', vibe: '温馨、流行民谣、律动', bpm: '95 BPM' },
  { id: 'ESTJ', name: '总经理', track: 'Clockwork Rhythm', color: 'from-purple-500/20 to-cyan-500/20', border: 'border-purple-500/30', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.15)]', video: 'https://assets.mixkit.co/videos/preview/mixkit-hands-typing-fast-on-a-glowing-keyboard-41849-large.mp4', vibe: '高效、数字电声、驱动', bpm: '120 BPM' }
];

const commentsPool = [
  { user: '0xKaelen', text: '这一轨的电平正好，瞬间平静了。', type: 'INFP' },
  { user: 'Nico_09', text: 'MBTI 契合度居然这么高，完全是我今天的精神写照。', type: 'INFJ' },
  { user: 'Symphony_', text: '有谁也在等深夜的低频浪潮？', type: 'INTJ' },
  { user: 'VibeSeeker', text: '这视频的视觉质感绝了，Sonicite 风格拉满！', type: 'ENFP' },
  { user: 'TuringTest', text: '用音轨频率寻找同频，比普通社交效率高多了。', type: 'INTP' },
  { user: 'Aura_Wave', text: '在后台挂着听了一下午，极致冷静。', type: 'ISFP' },
  { user: 'Rhythm_R', text: '深夜俱乐部既视感，太对味了。', type: 'ISTP' }
];

export default function MBTIWAVE({ isDark = true, onToggleColorMode = () => {} }) {
  const [currentView, setCurrentView] = useState('home'); // "home" | "room" | "mbti-hub" | "solo"
  const [selectedMBTI, setSelectedMBTI] = useState(mbtiData[0]);
  const [isMuted, setIsMuted] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineCount, setOnlineCount] = useState(128);
  const [activeRoomType, setActiveRoomType] = useState('random'); // "random" | "mbti"
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [soloDims, setSoloDims] = useState({ ei: 35, ns: 62, tf: 48, jp: 70 });
  const [styleFx, setStyleFx] = useState({ chillHype: 59, synthAcoustic: 35, darkBright: 40 });
  const [activeModePad, setActiveModePad] = useState('专注构思');
  const [vocalMode, setVocalMode] = useState('instrumental');
  const videoRef = useRef(null);
  const isLightMode = !isDark;

  // ── Solo 页真实化：复用 DJ 控制台的后端接口，不改后端 ──
  const player = usePlayer();
  const poll = useMusicPoll();
  const [soloGenerating, setSoloGenerating] = useState(false);
  const [soloFallback, setSoloFallback] = useState(false);
  const [soloNotice, setSoloNotice] = useState('');

  const soloAxes = soloDimsToAxes(soloDims);
  const soloMbti = mbtiFromAxes(soloAxes);
  const soloModeId = MODE_ID_BY_LABEL[activeModePad] || 'focus';
  const soloTheme = getTheme(soloMbti);

  // ── 照抄 DJ 控制台的四个面板所需的状态/句柄 ──
  const arranger = useArranger();
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectAnalysis, setProjectAnalysis] = useState(null);
  const [analysisSource, setAnalysisSource] = useState('');
  const [promptData, setPromptData] = useState(null);
  const [promptLoading, setPromptLoading] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(null);
  const analyzeTimer = useRef(null);
  const promptTimer = useRef(null);
  const skipAnalyzeRef = useRef(false);
  const lastSoloSignatureRef = useRef('');
  const soloGenerationSeqRef = useRef(0);
  const startupHoldPlayedRef = useRef(false);

  const soloStyle = {
    energy: styleFx.chillHype,
    texture: styleFx.synthAcoustic,
    brightness: styleFx.darkBright,
  };

  const vocalModeToVocals = (vm) => {
    if (vm === 'vocal') return { enabled: true };
    if (vm === 'mixed') return { enabled: true };
    return { enabled: false };
  };

  useEffect(() => {
    getDemoSchedule().then(setSchedule).catch(() => {});
  }, []);

  // 日程 → 定时同步当前阶段（照抄 DJ 台）
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

  // 顶部提示条自动消失（照抄 DJ 台的 notice）
  useEffect(() => {
    if (!soloNotice) return;
    const timer = setTimeout(() => setSoloNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [soloNotice]);

  // 项目文本变化 → 分析（防抖）
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
        console.error('[mbtiwave analyze]', err);
      }
    }, 600);
    return () => clearTimeout(analyzeTimer.current);
  }, [projectName, projectDesc]);

  // 任何输入变化 → 刷新 prompt 预览（防抖）
  useEffect(() => {
    clearTimeout(promptTimer.current);
    promptTimer.current = setTimeout(async () => {
      setPromptLoading(true);
      try {
        const data = await previewPrompt({ axes: soloAxes, mode: soloModeId, projectAnalysis, style: soloStyle, vocals: vocalModeToVocals(vocalMode) });
        setPromptData(data);
      } catch (err) {
        console.error('[mbtiwave prompt]', err);
      } finally {
        setPromptLoading(false);
      }
    }, 500);
    return () => clearTimeout(promptTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloDims, styleFx, activeModePad, vocalMode, projectAnalysis]);

  const handleModePadChange = (modeId) => {
    const label = MODES.find((m) => m.id === modeId)?.label;
    if (label) setActiveModePad(label);
    handleSoloGenerate({ force: true, mode: modeId, label });
  };
  const handleModePanic = () => {
    setActiveModePad('落后了');
    handleSoloGenerate({ force: true, mode: 'behind', label: '落后了' });
  };
  const handleApplyPreset = (preset) => {
    setProjectName(preset.name);
    setProjectDesc(preset.description);
  };
  const handleGithubAnalyze = async (url) => {
    try {
      const analysis = await analyzeGithub(url);
      skipAnalyzeRef.current = true;
      setProjectName(analysis.repo?.fullName || url);
      skipAnalyzeRef.current = true;
      setProjectDesc(analysis.repo?.description || '');
      setProjectAnalysis(analysis);
      setAnalysisSource(`github · ${analysis.source || ''}`);
    } catch (err) {
      console.error('[roomwave] GitHub analyze failed:', err);
    }
  };
  const handleArrangerStart = () => {
    arranger.start({ name: projectName || 'MBTIWAVE Solo', mbtiType: soloMbti, mbtiSliders: soloAxes, schedule: schedule?.phases });
  };

  // 轮询出音频后自动播放
  useEffect(() => {
    if (!poll.audioUrl) return;
    setSoloFallback(Boolean(poll.meta?.fallback));
    player.playUrl(poll.audioUrl, {
      title: poll.meta?.title || poll.meta?.fallbackTitle || `${soloMbti} · ${activeModePad}`,
      loop: true,
    });
    setSoloGenerating(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.audioUrl]);

  const playSoloFallbackNow = async (
    nextModeId,
    nextModeLabel,
    seq,
    message = '正在生成，已先接入兜底音乐',
    options = {}
  ) => {
    const fallbackMode = options.fallbackMode || nextModeId;
    const fb = await getFallback({ mode: fallbackMode, mbti: soloMbti });
    if (seq !== soloGenerationSeqRef.current) return null;
    if (fb.url || fb.audioUrl) {
      setSoloFallback(true);
      player.playUrl(fb.audioUrl || fb.url, { title: fb.title || `${soloMbti} · ${nextModeLabel}`, loop: true });
      if (message) setSoloNotice(message);
    }
    return fb;
  };

  // 生成音乐（真实）：优先真生成，失败/未配置则回退演示曲
  const handleSoloGenerate = async (opts = {}) => {
    const nextModeId = opts.mode || soloModeId;
    const nextModeLabel = opts.label || activeModePad;
    const shouldPlayStartupHold = Boolean(
      opts.allowStartupHold &&
      !startupHoldPlayedRef.current &&
      !player.currentTitle &&
      !poll.audioUrl &&
      !soloFallback
    );
    const nextSignature = JSON.stringify({
      axes: soloAxes,
      mode: nextModeId,
      style: soloStyle,
      projectAnalysis,
    });

    // 参数未变时，主播放键沿用播放/暂停；参数变化后重新生成新声轨。
    if (!opts.force && (player.playing || player.currentTitle) && lastSoloSignatureRef.current === nextSignature) {
      player.togglePlay();
      return;
    }
    const seq = soloGenerationSeqRef.current + 1;
    soloGenerationSeqRef.current = seq;
    setSoloGenerating(true);
    setSoloFallback(false);
    setSoloNotice('');
    poll.setStatus('processing');
    if (shouldPlayStartupHold) {
      startupHoldPlayedRef.current = true;
      await playSoloFallbackNow(nextModeId, nextModeLabel, seq, '正在生成，已先接入启动音效', {
        fallbackMode: STARTUP_FALLBACK_MODE,
      }).catch((err) => {
        console.error('[roomwave fallback hold]', err);
        return null;
      });
    }
    try {
      const job = await generateMusic({
        axes: soloAxes,
        mode: nextModeId,
        style: soloStyle,
        projectAnalysis: projectAnalysis || undefined,
        vocals: vocalModeToVocals(vocalMode),
        splitStems: vocalMode === 'mixed',
        forceFallback: false,
      });
      if (seq !== soloGenerationSeqRef.current) return;
      if (job.quota) setQuota(job.quota);
      if (job.quotaNotice) setSoloNotice(job.quotaNotice);
      lastSoloSignatureRef.current = nextSignature;
      poll.startPolling(job.jobId);
    } catch (err) {
      // 未登录 / 未配置 key → 回退演示曲，保证有声音
      try {
        const fb = await playSoloFallbackNow(
          nextModeId,
          nextModeLabel,
          seq,
          err.status === 401 ? '未登录，先播放兜底音乐（登录后可真实生成）' : '生成失败，已切到兜底音乐'
        );
        if (fb?.url || fb?.audioUrl) {
          lastSoloSignatureRef.current = nextSignature;
        } else {
          setSoloNotice('生成失败，请稍后再试');
        }
      } catch {
        setSoloNotice('生成失败，请稍后再试');
      }
      poll.setStatus('completed');
      setSoloGenerating(false);
    }
  };

  // 唱片旋转 / 播放态由真实播放器驱动
  const isSoloPlaying = player.playing;

  // ── 顶栏：登录 / TTAPI·LLM 状态 / 主题切换（接真实接口）──
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [quota, setQuota] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);

  const applyProfile = useCallback(() => {
    getMyProfile()
      .then((res) => {
        const profile = res?.profile;
        if (profile?.axes) {
          // DJ axes(ie) → MBTIWAVE soloDims(ei) 反向换算
          setSoloDims((d) => ({
            ei: 100 - profile.axes.ie,
            ns: profile.axes.ns,
            tf: profile.axes.tf,
            jp: profile.axes.jp,
          }));
        }
        if (profile?.style) {
          setStyleFx((s) => ({
            chillHype: profile.style.energy ?? s.chillHype,
            synthAcoustic: profile.style.texture ?? s.synthAcoustic,
            darkBright: profile.style.brightness ?? s.darkBright,
          }));
        }
        if (profile?.mode) {
          const label = MODES.find((m) => m.id === profile.mode)?.label;
          if (label) setActiveModePad(label);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {});
    authMe()
      .then((data) => {
        setUser(data.user);
        setQuota(data.quota);
        if (data.user) applyProfile();
      })
      .catch(() => {});
  }, [applyProfile]);

  // 进入随机Room
  const enterRandomRoom = () => {
    const randomIndex = Math.floor(Math.random() * mbtiData.length);
    const randomMbti = mbtiData[randomIndex];
    setSelectedMBTI(randomMbti);
    setActiveRoomType('random');
    setCurrentView('room');
    initRoomSystem();
  };

  // 进入指定MBTI Room
  const enterMbtiRoom = (mbtiObj) => {
    setSelectedMBTI(mbtiObj);
    setActiveRoomType('mbti');
    setCurrentView('room');
    initRoomSystem();
  };

  const soloBpm = 72 + Math.round((100 - soloDims.ei) * 0.28 + soloDims.jp * 0.18 + Math.abs(soloDims.tf - 50) * 0.16);
  const extroEnergy = Math.round(100 - soloDims.ei);
  const intuitiveColor = Math.round(100 - soloDims.ns);
  const thinkingLines = Math.round(100 - soloDims.tf);
  const judgingStructure = Math.round(soloDims.jp);
  const soloBgStyle = {
    background: `
      radial-gradient(circle at ${24 + extroEnergy * 0.42}% ${18 + intuitiveColor * 0.18}%, rgba(0,255,102,${0.08 + extroEnergy * 0.004}), transparent ${28 + extroEnergy * 0.08}%),
      radial-gradient(circle at ${78 - thinkingLines * 0.22}% ${22 + judgingStructure * 0.32}%, rgba(127,86,217,${0.08 + intuitiveColor * 0.003}), transparent ${30 + intuitiveColor * 0.06}%),
      linear-gradient(${118 + thinkingLines * 0.6}deg, rgba(5,5,5,0.95), rgba(${8 + extroEnergy},${10 + intuitiveColor},${16 + thinkingLines},0.92), rgba(0,0,0,0.98))
    `
  };
  const soloPulseStyle = {
    animationDuration: `${Math.max(0.42, 1.8 - extroEnergy * 0.012)}s`,
    boxShadow: `0 0 ${18 + extroEnergy * 0.65}px rgba(0,255,102,${0.16 + extroEnergy * 0.004})`
  };
  const soloLineStyle = {
    backgroundSize: `${Math.max(14, 56 - thinkingLines * 0.34)}px ${Math.max(14, 56 - thinkingLines * 0.34)}px`,
    opacity: 0.12 + thinkingLines * 0.006
  };
  const modePads = [
    ['头脑风暴', '01', 'ei', 18],
    ['专注构思', '02', 'tf', 18],
    ['代码冲刺', '03', 'jp', 18],
    ['战鼓催阵', '04', 'ei', 8],
    ['休息一下', '05', 'tf', 72],
    ['完成了！', '06', 'jp', 88]
  ]; // eslint-disable-line no-unused-vars -- 保留：mbti-hub 视图仍可能引用

  // 初始化房间弹幕和在线人数变动
  const initRoomSystem = () => {
    setOnlineCount(Math.floor(Math.random() * 200) + 120);
    // 初始化几条弹幕
    const initialComments = Array.from({ length: 4 }).map(() => {
      const randomComment = commentsPool[Math.floor(Math.random() * commentsPool.length)];
      return {
        id: Math.random().toString(),
        user: randomComment.user,
        text: randomComment.text,
        type: randomComment.type,
        time: '刚刚'
      };
    });
    setChatMessages(initialComments);
  };

  // 定期增加弹幕和波动在线人数
  useEffect(() => {
    if (currentView !== 'room') return;

    const interval = setInterval(() => {
      // 模拟在线人数微小波动
      setOnlineCount(prev => prev + (Math.random() > 0.5 ? 1 : -1));

      // 随机发一条同频弹幕
      const randomComment = commentsPool[Math.floor(Math.random() * commentsPool.length)];
      const newMsg = {
        id: Math.random().toString(),
        user: randomComment.user,
        text: randomComment.text,
        type: randomComment.type,
        time: '刚刚'
      };
      setChatMessages(prev => [...prev.slice(-15), newMsg]); // 保留最近15条
    }, 4000);

    return () => clearInterval(interval);
  }, [currentView]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg = {
      id: Math.random().toString(),
      user: '我',
      text: newMessage,
      type: 'ME',
      time: '刚刚'
    };
    setChatMessages(prev => [...prev, msg]);
    setNewMessage('');
  };

  // 背景随 MBTI 跳动（照抄 DJ 控制台的 pageBg：用当前人格主题色叠加径向渐变）
  const mbtiwaveBg = isLightMode
    ? `radial-gradient(ellipse at 20% 0%, ${soloTheme.accent}22 0%, transparent 50%),
       radial-gradient(ellipse at 80% 100%, ${soloTheme.glow}18 0%, transparent 55%),
       #EEF1F7`
    : `radial-gradient(ellipse at 20% 0%, ${soloTheme.primary} 0%, transparent 55%),
       radial-gradient(ellipse at 80% 100%, ${soloTheme.accent}26 0%, transparent 50%),
       #050505`;

  return (
    <div
      className={`mbtiwave-scope relative min-h-screen w-full ${isLightMode ? 'text-slate-800' : 'text-zinc-100'} overflow-x-clip flex flex-col justify-between transition-colors duration-500`}
      style={{ background: mbtiwaveBg }}
    >

      {/* 顶部提示条（照抄 DJ 台 notice：配额 / 报错提示）*/}
      {soloNotice && (
        <div className="fixed left-1/2 top-4 z-[60] -translate-x-1/2 rounded-xl border border-amber-400/40 bg-black/85 px-4 py-2 text-sm text-amber-200 backdrop-blur">
          {soloNotice}
        </div>
      )}

      {/* 背景流光 */}
      <div className="absolute top-[-200px] left-[-200px] ambient-flow"></div>
      <div className="absolute bottom-[-100px] right-[-100px] ambient-flow" style={{ animationDirection: 'reverse', animationDuration: '35s' }}></div>

      {/* 顶栏 */}
      <header className={`relative z-50 border-b backdrop-blur-md px-4 md:px-6 py-4 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between transition-colors duration-500 ${isLightMode ? 'border-slate-300/50 bg-[#EEF1F7]/82' : 'border-zinc-900 bg-[#050505]/80'}`}>
        <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00FF66] to-[#7F56D9] p-[1.5px] flex items-center justify-center">
              <div className="w-full h-full bg-[#050505] rounded-md flex items-center justify-center">
                <Activity className="w-4 h-4 text-[#00FF66] animate-pulse" />
              </div>
            </div>
            <div>
              <span className="mono-font tracking-widest text-lg font-black bg-clip-text text-transparent bg-gradient-to-r from-white via-zinc-300 to-zinc-500">MBTIWAVE</span>
              <span className="text-[9px] block text-zinc-500 tracking-[0.2em] uppercase mono-font">Basement Audio-Visual System</span>
            </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="hidden xl:flex items-center gap-6 text-xs text-zinc-400 mono-font">
            <span className="hover:text-[#00FF66] transition-colors cursor-pointer" onClick={() => setCurrentView('home')}>[ 探索首页 ]</span>
            <span className="hover:text-[#00FF66] transition-colors cursor-pointer" onClick={() => setCurrentView('mbti-hub')}>[ MBTI 星系 ]</span>
            <span className="text-zinc-600">/</span>
            <span className="flex items-center gap-1.5 text-zinc-500">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-ping"></span>
              12,042 ONLINE
            </span>
          </div>

          {/* ── 顶栏统一绿色主题（登录 / TTAPI·LLM / 主题 / 导航），接真实接口 ── */}
          <AuthPanel
            user={user}
            quota={quota}
            open={authOpen}
            onOpenChange={setAuthOpen}
            triggerClass="flex h-9 w-9 items-center justify-center text-base rounded-full border border-[#00FF66]/40 bg-[#00FF66]/10 text-[#00FF66] hover:bg-[#00FF66] hover:text-black transition-colors"
            chipClass="flex items-center gap-2 rounded-full border border-[#00FF66]/40 bg-[#00FF66]/10 px-3 py-1.5"
            onAuth={(data) => {
              setUser(data.user);
              setQuota(data.quota);
              applyProfile();
            }}
            onLogout={() => {
              setUser(null);
              setQuota(null);
            }}
          />
          {health && (
            <div className="flex items-center gap-3 rounded-full border border-[#00FF66]/40 bg-[#00FF66]/10 px-3 py-1.5 font-mono text-[10px]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health.ttapi ? '#00FF66' : '#f59e0b', boxShadow: `0 0 8px ${health.ttapi ? '#00FF66' : '#f59e0b'}` }} />
                <span className="text-[#00FF66]/80">TTAPI</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: health.llm ? '#00FF66' : '#f59e0b', boxShadow: `0 0 8px ${health.llm ? '#00FF66' : '#f59e0b'}` }} />
                <span className="text-[#00FF66]/80">LLM</span>
              </span>
            </div>
          )}
          <button
            onClick={onToggleColorMode}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[#00FF66]/40 bg-[#00FF66]/10 text-base text-[#00FF66] hover:bg-[#00FF66] hover:text-black transition-colors"
            title={isDark ? '浅色模式' : '深色模式'}
          >
            {isDark ? '☀️' : '🌙'}
          </button>
          {currentView !== 'home' && (
            <button
              onClick={() => setCurrentView('home')}
              className="pad px-3 py-1.5 text-xs font-bold hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
              title="返回 MBTIWAVE 首页"
            >
              🌊 MBTIWAVE
            </button>
          )}
          {/* <a href="#/discover" className="pad px-3 py-1.5 text-xs font-bold no-underline hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">🌍 发现</a> */}
          {/* <a href="#/mixer" className="pad px-3 py-1.5 text-xs font-bold no-underline hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]">🎚 调音台</a> */}
          {/* <a href="#/admin" className="rounded-full border border-[#00FF66]/40 bg-[#00FF66]/10 px-3 py-1.5 text-xs text-[#00FF66] no-underline hover:bg-[#00FF66] hover:text-black transition-colors">⚙️ 管理后台</a> */}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="w-9 h-9 rounded-full border border-[#00FF66]/40 bg-[#00FF66]/10 flex items-center justify-center text-[#00FF66] hover:bg-[#00FF66] hover:text-black transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 核心内容区 */}
      <main className="relative z-10 flex-grow w-full max-w-7xl mx-auto px-4 md:px-8 py-8 flex flex-col">

        <AnimatePresence mode="wait">

          {/* VIEW 1: 首页 / 入口选择 */}
          {currentView === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-12 pb-24"
            >
              {/* 顶部：可翻页的本地视频 */}
              <HeroVideoPlayer sources={HERO_VIDEOS} />

              {/* 往下滚动：每个功能都是独立音乐模块 */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

                {/* 入口 1: MBTI solo music → 进入 DJ 控制台 */}
                <div
                  onClick={() => { window.location.hash = '#/'; }}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-rose-950/45 border border-fuchsia-200/18 hover:border-fuchsia-300/60 p-6 flex flex-col justify-between min-h-[390px] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_42px_rgba(244,114,182,0.18)] scanline"
                >                  <img src="/card-mbti-solo.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75 transition-opacity duration-500 group-hover:opacity-95" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-rose-950/90 via-rose-950/20 to-transparent"></div>
                  <div className="absolute inset-0 bg-[linear-gradient(110deg,rgba(244,114,182,0.18),transparent_40%,rgba(168,85,247,0.18))] opacity-75 group-hover:opacity-100 transition-opacity"></div>
                  <div className="flex items-start justify-between relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-black border border-fuchsia-200/25 flex items-center justify-center text-fuchsia-200 group-hover:bg-fuchsia-200 group-hover:text-black transition-all duration-300">
                      <Music className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] text-fuchsia-200 tracking-wider font-bold uppercase mono-font">Solo Channel</span>
                  </div>
                  <div className="space-y-3 relative z-10 mt-5">
                    <h3 className="text-2xl font-bold text-white group-hover:text-fuchsia-200 transition-colors">MBTI solo music</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed max-w-xl">
                      不进入社群房间，只生成一条属于当前人格的私人背景声轨。适合独处、工作、发呆或深夜循环播放。
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-fuchsia-200 font-bold text-xs mono-font pt-4 relative z-10">
                    <span>START SOLO BGM</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>

                {/* 入口 2: MBTI Music 精致微光入口 */}
                <div
                  onClick={() => setCurrentView('mbti-hub')}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-[#100d1f]/82 border border-violet-300/15 hover:border-violet-400/55 p-6 flex flex-col justify-between min-h-[390px] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_38px_rgba(127,86,217,0.16)]"
                >
                  <img src="/card-mbti-music.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75 transition-opacity duration-500 group-hover:opacity-95" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#100d1f]/90 via-[#100d1f]/25 to-transparent"></div>
                  {/* 流动微光 */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-violet-500/5 to-cyan-500/5 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-[#7F56D9]/10 rounded-full blur-2xl group-hover:scale-125 transition-all duration-500"></div>

                  <div className="flex justify-between items-start relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center text-[#7F56D9] group-hover:bg-[#7F56D9] group-hover:text-white transition-all duration-300">
                      <Headphones className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] text-violet-400 tracking-wider font-bold uppercase mono-font">
                      16 Personalities
                    </span>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <h3 className="text-2xl font-bold text-white group-hover:text-violet-400 transition-colors">MBTI Music</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      16种人格独属声景。根据音乐倾向、心理频率，精确匹配至同频人格音像空间，在相似性中疗愈。
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-violet-400 font-bold text-xs mono-font pt-2 relative z-10">
                    <span>CALIBRATE PERSONALITY</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>

                {/* 入口 3: 随机 Room (重度沉浸) */}
                <div
                  onClick={enterRandomRoom}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-slate-950/60 border border-sky-200/15 hover:border-sky-300/50 p-6 flex flex-col justify-between min-h-[390px] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_38px_rgba(125,211,252,0.13)] scanline"
                >
                  <img src="/card-room.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-75 transition-opacity duration-500 group-hover:opacity-95" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent"></div>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-300/10 rounded-full blur-2xl group-hover:scale-150 transition-all duration-500"></div>

                  <div className="relative z-10 flex justify-between items-start">
                    <div className="w-12 h-12 rounded-xl bg-slate-950/80 border border-slate-700 flex items-center justify-center text-sky-200 group-hover:bg-sky-200 group-hover:text-slate-950 transition-all duration-300">
                      <Radio className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-zinc-400 bg-zinc-950/80 px-2 py-1 rounded border border-zinc-800/80 mono-font">
                      FLOW STATE
                    </div>
                  </div>

                  <div className="relative z-10 space-y-3">
                    <h3 className="text-2xl font-bold text-white group-hover:text-sky-200 transition-colors">进入随机 Room</h3>
                    <p className="text-zinc-300 text-xs leading-relaxed">
                      像掉进一个正在跃迁的异次元电波。随机加入正在播放情绪影像的群组，遇见不可预知的同频旅人。
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center gap-2 text-sky-200 font-bold text-xs mono-font pt-2">
                    <span>LAUNCH INSTANT WAVE</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>

              </div>

              {/* 入口 4 & 5: 发现 / 调音台 */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

                {/* 入口 4: 发现 */}
                <div
                  onClick={() => { window.location.hash = '#/discover'; }}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-emerald-950/45 border border-emerald-300/15 hover:border-emerald-400/55 p-6 flex flex-col justify-between min-h-[390px] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_38px_rgba(52,211,153,0.16)]"
                >
                  <img src="/card-discover.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity duration-500 group-hover:opacity-80" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/25 to-transparent"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/5 to-teal-500/5 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-emerald-400/10 rounded-full blur-2xl group-hover:scale-125 transition-all duration-500"></div>

                  <div className="flex justify-between items-start relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-400 group-hover:text-zinc-950 transition-all duration-300">
                      <Compass className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] text-emerald-400 tracking-wider font-bold uppercase mono-font">
                      Discovery
                    </span>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <h3 className="text-2xl font-bold text-white group-hover:text-emerald-400 transition-colors">发现</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      穿越风格星图，探索未知的音乐疆域。按流派、情绪、节拍漫游全球创作者的声景宇宙，发现下一首属于你的歌。
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs mono-font pt-2 relative z-10">
                    <span>EXPLORE SOUNDSCAPE</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>

                {/* 入口 5: 调音台 */}
                <div
                  onClick={() => { window.location.hash = '#/mixer'; }}
                  className="group relative cursor-pointer overflow-hidden rounded-[2rem] bg-amber-950/45 border border-amber-300/15 hover:border-amber-400/55 p-6 flex flex-col justify-between min-h-[390px] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_0_38px_rgba(251,191,36,0.16)]"
                >
                  <img src="/card-mixer.jpg" alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-60 transition-opacity duration-500 group-hover:opacity-80" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-950/90 via-amber-950/25 to-transparent"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/5 to-orange-500/5 opacity-80 group-hover:opacity-100 transition-opacity"></div>
                  <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-amber-400/10 rounded-full blur-2xl group-hover:scale-125 transition-all duration-500"></div>

                  <div className="flex justify-between items-start relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center text-amber-400 group-hover:bg-amber-400 group-hover:text-zinc-950 transition-all duration-300">
                      <SlidersHorizontal className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] text-amber-400 tracking-wider font-bold uppercase mono-font">
                      Mixer Deck
                    </span>
                  </div>

                  <div className="space-y-3 relative z-10">
                    <h3 className="text-2xl font-bold text-white group-hover:text-amber-400 transition-colors">调音台</h3>
                    <p className="text-zinc-400 text-xs leading-relaxed">
                      多轨混音工作台，独立控制每条声轨的音量、声像与效果。拖入波形，叠加层次，打造只属于你的声场。
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mono-font pt-2 relative z-10">
                    <span>MIX YOUR WAVE</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                  </div>
                </div>

              </div>

              {/* 各种音乐专辑在转 */}
              <AlbumMarquee />

              {/* 首屏：宣言与品牌精神 */}
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.72),rgba(9,9,11,0.86))] p-6 md:p-10 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
                <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-300/10 blur-3xl"></div>
                <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-fuchsia-300/10 blur-3xl"></div>
                <div className="relative z-10 max-w-3xl space-y-8">
                  <div className="space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/80 border border-zinc-800 text-xs text-[#00FF66] mono-font">
                      <Zap className="w-3.5 h-3.5 animate-pulse" />
                      <span>v2.4 SYSTEM ACTIVE</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15] text-white">
                      音乐无处不在，<br />
                      <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#00FF66] to-cyan-400">
                        理解却不是。
                      </span>
                    </h1>
                    <p className="text-zinc-400 text-sm md:text-base leading-relaxed max-w-md">
                      MBTIWAVE 是专为渴望情绪共鸣的年轻人打造的视频播放社群。告别寂寞的单向观看，选择适合你 MBTI 的频率入口，与同频陌生人同步呼吸，探索声音与影像编织的赛博聚落。
                    </p>
                  </div>

                  {/* 快速数据看板 */}
                  <div className="grid grid-cols-3 gap-4 border-l-2 border-[#00FF66] pl-4 py-2 mono-font">
                    <div>
                      <div className="text-xl font-bold text-white">16</div>
                      <div className="text-[10px] text-zinc-500">性格轨道</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white">1.2K+</div>
                      <div className="text-[10px] text-zinc-500">同步电波房</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-white">98%</div>
                      <div className="text-[10px] text-zinc-500">同频反馈率</div>
                    </div>
                  </div>
                </div>

                <div className="relative z-10 mt-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="mono-font text-xs uppercase tracking-[0.32em] text-zinc-500">Three listening routes</p>
                    <h2 className="mt-2 text-3xl font-black tracking-tight text-white">选择你的进入方式</h2>
                  </div>
                  <p className="max-w-sm text-sm leading-6 text-zinc-500">每个入口都是一个会跳动的音乐模块：随机共看、人格声景、个人背景声。</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* VIEW 3: MBTI 16人格高保真微光选择界面 */}
          {currentView === 'mbti-hub' && (
            <motion.div
              key="mbti-hub"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.4 }}
              className="space-y-8"
            >
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer hover:text-zinc-300" onClick={() => setCurrentView('home')}>
                    <span>探索首页</span>
                    <span>/</span>
                    <span className="text-zinc-300">MBTI 性格轨道选择</span>
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
                    <Headphones className="w-7 h-7 text-[#00FF66]" />
                    MBTI 声音定位系统
                  </h2>
                  <p className="text-zinc-400 text-sm max-w-xl">
                    声频是灵魂的自画像。选择下方最符合您或您当下心境的 MBTI 人格，进入与其深度契合的视听流动温室。
                  </p>
                </div>
                <button
                  onClick={enterRandomRoom}
                  className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-[#00FF66] hover:bg-zinc-800 transition-all flex items-center gap-2 mono-font"
                >
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>[ 快速随机进入 ]</span>
                </button>
              </div>

              {/* 16 人格高拟真圆角毛玻璃卡片网格 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {mbtiData.map((mbti, idx) => (
                  <motion.div
                    key={mbti.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03 }}
                    onClick={() => enterMbtiRoom(mbti)}
                    className={`group relative cursor-pointer overflow-hidden rounded-2xl border ${mbti.border} bg-gradient-to-br ${mbti.color} p-5 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] ${mbti.glow}`}
                  >
                    {/* 动态微光颗粒效果 */}
                    <div className="absolute inset-0 bg-zinc-950/60 mix-blend-multiply group-hover:bg-zinc-950/40 transition-colors"></div>
                    <div className="absolute top-0 right-0 w-16 h-16 bg-white/5 rounded-full blur-xl group-hover:bg-white/10 transition-all"></div>

                    <div className="relative z-10 flex flex-col justify-between h-36">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="mono-font text-3xl font-black tracking-tight text-white group-hover:text-[#00FF66] transition-colors">{mbti.id}</span>
                          <span className="block text-xs text-zinc-300 font-medium mt-0.5">{mbti.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-zinc-500 bg-black/40 px-2 py-0.5 rounded border border-zinc-800/50">{mbti.bpm}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                          <Music className="w-3 h-3 text-zinc-500" />
                          <span className="truncate max-w-[150px]">{mbti.track}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">{mbti.vibe}</div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* VIEW 4: 房间播放页面 (左右侧多栏适配) */}
          {currentView === 'room' && (
            <motion.div
              key="room"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
            >

              {/* 左侧：视频主播放区 + 房间信息 */}
              <div className="lg:col-span-8 space-y-4">
                {/* 视频容器 */}
                <div className="relative aspect-video w-full rounded-2xl bg-zinc-950 border border-zinc-800 overflow-hidden shadow-2xl group">

                  {/* 真实模拟视频背景，通过 CDN 循环播放精美短视像 */}
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover opacity-80"
                    src={selectedMBTI.video}
                    autoPlay
                    loop
                    muted={isMuted}
                    playsInline
                  />

                  {/* 视频界面遮罩与氛围标签 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 flex flex-col justify-between p-4 pointer-events-none">

                    {/* 视频上部栏 */}
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#00FF66] animate-ping"></span>
                        <span className="text-xs font-mono font-bold text-white bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-[#00FF66]/30 flex items-center gap-1.5">
                          {activeRoomType === 'random' ? '随机跃迁房' : `MBTI - ${selectedMBTI.id} 房`}
                        </span>
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[10px] text-amber-200">
                          本地体验模式
                        </span>
                      </div>
                    </div>

                    {/* 视频控制提示 & 水印 */}
                    <div className="flex justify-between items-end w-full">
                      <div className="space-y-1">
                        <div className="text-lg font-bold text-white flex items-center gap-2">
                          {selectedMBTI.track}
                        </div>
                        <p className="text-xs text-zinc-400">正在播放：{selectedMBTI.vibe} 氛围视觉流</p>
                      </div>

                      <div className="pointer-events-auto">
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className="w-10 h-10 rounded-xl bg-black/60 backdrop-blur-md hover:bg-black/90 text-white flex items-center justify-center transition-all border border-zinc-800/80"
                        >
                          {isMuted ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-[#00FF66]" />}
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* 房间基础交互、电波对齐度等指标 */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00FF66]/20 to-purple-500/20 flex items-center justify-center border border-zinc-800">
                      <Disc className="w-6 h-6 text-[#00FF66] animate-spin" style={{ animationDuration: '8s' }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white">{selectedMBTI.name}专区 · {selectedMBTI.id}</h3>
                        <span className="text-[10px] text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-950 border border-zinc-800 mono-font">{selectedMBTI.bpm}</span>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">“共振在这个瞬间，我们和而不同。”</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                    <button
                      onClick={() => {
                        // 瞬间切换到另一个随机 MBTI 房
                        const randomIndex = Math.floor(Math.random() * mbtiData.length);
                        setSelectedMBTI(mbtiData[randomIndex]);
                      }}
                      className="flex-grow md:flex-none px-4 py-2 bg-[#00FF66]/10 hover:bg-[#00FF66]/20 border border-[#00FF66]/30 hover:border-[#00FF66]/50 rounded-lg text-xs text-[#00FF66] font-bold transition-all flex items-center justify-center gap-1.5"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>一键跃迁新房间</span>
                    </button>
                    <button
                      onClick={() => setCurrentView('mbti-hub')}
                      className="px-4 py-2 bg-zinc-800/60 hover:bg-zinc-800 border border-zinc-700/50 rounded-lg text-xs text-zinc-300 transition-all"
                    >
                      返回星系
                    </button>
                  </div>
                </div>

                {/* 精美区域：其他 15 个 MBTI 人格的小型正在播放/跳动频谱卡片 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-[#00FF66] animate-pulse" />
                      其他性格轨道共振状态 (实时频谱)
                    </span>
                    <span className="text-[10px] text-zinc-600">点击磁片直接跨房同步</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {mbtiData.filter(m => m.id !== selectedMBTI.id).slice(0, 4).map(mbti => (
                      <div
                        key={mbti.id}
                        onClick={() => enterMbtiRoom(mbti)}
                        className="group cursor-pointer relative overflow-hidden rounded-xl bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700 p-3 flex flex-col justify-between h-20 transition-all hover:bg-zinc-950"
                      >
                        <div className="flex justify-between items-start">
                          <span className="text-xs font-mono font-bold text-zinc-400 group-hover:text-white">{mbti.id}</span>
                          <div className="flex items-end gap-[2px] h-3">
                            <span className="w-[2px] bg-[#00FF66] rounded-full animate-bounce h-2" style={{ animationDelay: '0.1s', animationDuration: '1s' }}></span>
                            <span className="w-[2px] bg-[#00FF66] rounded-full animate-bounce h-3" style={{ animationDelay: '0.3s', animationDuration: '0.8s' }}></span>
                            <span className="w-[2px] bg-[#00FF66] rounded-full animate-bounce h-1" style={{ animationDelay: '0.5s', animationDuration: '1.2s' }}></span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-500 truncate max-w-[80px]">{mbti.track}</span>
                          <span className="text-[#00FF66] opacity-0 group-hover:opacity-100 transition-opacity">进入</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* 右侧：社群成员与实时共振弹幕聊天室 */}
              <div className="lg:col-span-4 space-y-6">

                {/* 聊天和共鸣流模块 */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 flex flex-col">

                  {/* 聊天室头部 */}
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-[#00FF66]" />
                      <span className="text-xs font-bold text-white uppercase mono-font">Resonance Stream</span>
                    </div>
                    <span className="text-[10px] bg-[#00FF66]/10 text-[#00FF66] px-2 py-0.5 rounded border border-[#00FF66]/20">
                      氛围对齐
                    </span>
                  </div>

                  {/* 消息区（随整页滚动，不再内部独立滚动，避免吃掉滚轮）*/}
                  <div className="space-y-3 pr-1 text-xs">
                    <p className="text-[10px] text-zinc-600 text-center py-2 border-b border-zinc-950">
                      - 欢迎加入同频空间。言论将同步电波发生器 -
                    </p>

                    <AnimatePresence initial={false}>
                      {chatMessages.map((msg) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900/60 flex flex-col gap-1"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[#00FF66] font-mono font-bold text-[11px]">{msg.user}</span>
                              {msg.type !== 'ME' && (
                                <span className="text-[9px] px-1 bg-zinc-800 text-zinc-400 rounded scale-90 origin-left">
                                  {msg.type}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] text-zinc-600">{msg.time}</span>
                          </div>
                          <p className="text-zinc-300 leading-relaxed text-[11px]">{msg.text}</p>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* 发送框 */}
                  <form onSubmit={handleSendMessage} className="mt-3 pt-3 border-t border-zinc-800/80 flex gap-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="发送你的同频弹幕..."
                      className="flex-grow bg-zinc-950 border border-zinc-800/80 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#00FF66] transition-colors"
                    />
                    <button
                      type="submit"
                      className="w-9 h-9 rounded-lg bg-zinc-900 hover:bg-[#00FF66] text-[#00FF66] hover:text-black transition-all flex items-center justify-center border border-zinc-800 hover:border-transparent"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>

                </div>

                {/* 在线成员微卡片区 */}
                <div className="bg-zinc-900/20 border border-zinc-800/80 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#00FF66]" />
                      共同振成员 (6人)
                    </span>
                    <span className="text-[10px] text-zinc-500">同频相似性</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { name: 'Kaelen', tag: 'INFP', match: '98%' },
                      { name: 'Nico_09', tag: 'INFJ', match: '94%' },
                      { name: 'Yuki.S', tag: 'INFP', match: '89%' },
                      { name: 'Alpha', tag: 'ENFP', match: '82%' },
                      { name: 'Symph_', tag: 'INTJ', match: '78%' },
                      { name: 'Saya', tag: 'ISFP', match: '75%' }
                    ].map((member, i) => (
                      <div key={i} className="bg-zinc-950/60 p-2 rounded-lg border border-zinc-900 text-center space-y-1">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#00FF66] to-cyan-500 mx-auto flex items-center justify-center text-[10px] font-black text-black">
                          {member.name.charAt(0)}
                        </div>
                        <div className="text-[10px] font-bold text-zinc-300 truncate">{member.name}</div>
                        <div className="text-[8px] text-zinc-500 font-mono flex items-center justify-center gap-0.5">
                          <span className="text-[#00FF66]">{member.tag}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </motion.div>
          )}

        </AnimatePresence>

      </main>

      {/* 页脚 / 安全区域与状态提示 */}
      <footer className="relative z-50 border-t border-zinc-900 bg-[#050505]/90 px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-zinc-600 mono-font">
        <div>
          <span>© {new Date().getFullYear()} MBTIWAVE AUDIO-VISUAL LAB. </span>
          <span className="text-zinc-800">|</span>
          <button type="button" onClick={() => setShowPrivacy(true)} className="ml-1 text-zinc-500 underline-offset-2 hover:text-zinc-400 hover:underline">隐私协议</button>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="flex items-center gap-1 text-[#00FF66]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FF66] animate-pulse"></span>
            SYSTEM STABLE
          </span>
          <span>HOST: 0x29e...1a88</span>
        </div>
      </footer>

      {showPrivacy && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-950 p-5 text-zinc-200 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold">隐私协议</h3>
              <button
                type="button"
                onClick={() => setShowPrivacy(false)}
                className="rounded-lg border border-zinc-700 px-2 py-1 text-xs text-zinc-400 hover:text-white"
              >
                关闭
              </button>
            </div>
            <div className="space-y-2 text-sm leading-6 text-zinc-400">
              <p>当前 MBTIWAVE 房间、聊天和在线人数为本地体验模式，不会上传聊天内容。</p>
              <p>登录信息和音乐生成请求沿用主应用后端接口；真实多人房间上线前，会补充房间成员、消息存储和实时同步规则。</p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
