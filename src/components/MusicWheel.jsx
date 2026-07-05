import { useEffect, useState, useRef } from 'react';
import { Share2, Play, Pause, Music, Disc, Radio, HelpCircle, Sparkles, X, Heart } from 'lucide-react';
import '../styles/music-wheel.css';

// 12 种音乐流派
const GENRES = [
  { id: 'pop', name: 'Pop 流行', color: '#FF2A7A' },
  { id: 'jazz', name: 'Jazz 爵士', color: '#00F5D4' },
  { id: 'rock', name: 'Rock 摇滚', color: '#FF9F1C' },
  { id: 'hiphop', name: 'Hip-Hop 说唱', color: '#9D4EDD' },
  { id: 'classical', name: 'Classical 古典', color: '#2EC4B6' },
  { id: 'electronic', name: 'Electronic 电子', color: '#E01E37' },
  { id: 'rnb', name: 'R&B 节奏蓝调', color: '#FF007F' },
  { id: 'country', name: 'Country 乡村', color: '#00B4D8' },
  { id: 'latin', name: 'Latin 拉丁', color: '#FF7006' },
  { id: 'metal', name: 'Metal 重金属', color: '#7209B7' },
  { id: 'indie', name: 'Indie 独立', color: '#4CC9F0' },
  { id: 'funk', name: 'Funk 放克', color: '#F15BB5' },
];

const SONGS_DATABASE = {
  pop: [
    { title: 'Levitating', artist: 'Dua Lipa', duration: '03:23', likes: '1.2M' },
    { title: 'Blinding Lights', artist: 'The Weeknd', duration: '03:20', likes: '2.5M' },
    { title: 'Cruel Summer', artist: 'Taylor Swift', duration: '03:00', likes: '1.8M' },
    { title: 'As It Was', artist: 'Harry Styles', duration: '02:47', likes: '2.1M' },
  ],
  jazz: [
    { title: 'Fly Me To The Moon', artist: 'Frank Sinatra', duration: '02:27', likes: '940K' },
    { title: 'Take Five', artist: 'The Dave Brubeck Quartet', duration: '05:24', likes: '430K' },
    { title: 'My Funny Valentine', artist: 'Chet Baker', duration: '02:18', likes: '310K' },
    { title: 'Blue In Green', artist: 'Miles Davis', duration: '05:37', likes: '580K' },
  ],
  rock: [
    { title: 'Smells Like Teen Spirit', artist: 'Nirvana', duration: '05:01', likes: '3.1M' },
    { title: 'Bohemian Rhapsody', artist: 'Queen', duration: '05:55', likes: '4.2M' },
    { title: 'Do I Wanna Know?', artist: 'Arctic Monkeys', duration: '04:32', likes: '2.9M' },
    { title: 'Back In Black', artist: 'AC/DC', duration: '04:15', likes: '3.5M' },
  ],
  hiphop: [
    { title: 'HUMBLE.', artist: 'Kendrick Lamar', duration: '02:57', likes: '2.8M' },
    { title: 'Sicko Mode', artist: 'Travis Scott', duration: '05:12', likes: '2.2M' },
    { title: 'Gods Plan', artist: 'Drake', duration: '03:18', likes: '3.4M' },
    { title: 'Lose Yourself', artist: 'Eminem', duration: '05:26', likes: '4.0M' },
  ],
  classical: [
    { title: 'Clair de Lune', artist: 'Claude Debussy', duration: '05:05', likes: '620K' },
    { title: 'Gymnopédie No.1', artist: 'Erik Satie', duration: '03:11', likes: '500K' },
    { title: 'Beethoven Symphony No. 9', artist: 'Leonard Bernstein', duration: '06:45', likes: '890K' },
    { title: 'Four Seasons: Winter', artist: 'Antonio Vivaldi', duration: '03:15', likes: '710K' },
  ],
  electronic: [
    { title: 'Get Lucky', artist: 'Daft Punk', duration: '04:09', likes: '2.4M' },
    { title: 'Strobe', artist: 'deadmau5', duration: '06:12', likes: '850K' },
    { title: 'Scary Monsters and Nice Sprites', artist: 'Skrillex', duration: '04:03', likes: '1.2M' },
    { title: 'Animals', artist: 'Martin Garrix', duration: '05:04', likes: '1.9M' },
  ],
  rnb: [
    { title: 'Kill Bill', artist: 'SZA', duration: '02:33', likes: '1.7M' },
    { title: 'Redbone', artist: 'Childish Gambino', duration: '05:26', likes: '2.0M' },
    { title: 'Die For You', artist: 'The Weeknd', duration: '03:52', likes: '1.8M' },
    { title: 'Adorn', artist: 'Miguel', duration: '03:13', likes: '900K' },
  ],
  country: [
    { title: 'Tennessee Whiskey', artist: 'Chris Stapleton', duration: '04:53', likes: '1.5M' },
    { title: 'Last Night', artist: 'Morgan Wallen', duration: '02:43', likes: '1.1M' },
    { title: 'Jolene', artist: 'Dolly Parton', duration: '02:41', likes: '870K' },
    { title: 'You Belong With Me', artist: 'Taylor Swift', duration: '03:52', likes: '2.3M' },
  ],
  latin: [
    { title: 'Despacito', artist: 'Luis Fonsi ft. Daddy Yankee', duration: '03:47', likes: '6.2M' },
    { title: 'Dakiti', artist: 'Bad Bunny & Jhayco', duration: '03:25', likes: '2.4M' },
    { title: 'Mi Gente', artist: 'J Balvin, Willy William', duration: '03:09', likes: '1.8M' },
    { title: 'Havana', artist: 'Camila Cabello', duration: '03:37', likes: '3.1M' },
  ],
  metal: [
    { title: 'Master of Puppets', artist: 'Metallica', duration: '08:35', likes: '1.9M' },
    { title: 'Chop Suey!', artist: 'System Of A Down', duration: '03:30', likes: '2.2M' },
    { title: 'Duality', artist: 'Slipknot', duration: '04:12', likes: '1.3M' },
    { title: 'Paranoid', artist: 'Black Sabbath', duration: '02:48', likes: '1.6M' },
  ],
  indie: [
    { title: 'Sweater Weather', artist: 'The Neighbourhood', duration: '04:00', likes: '2.8M' },
    { title: 'Take Me To Church', artist: 'Hozier', duration: '04:01', likes: '2.5M' },
    { title: 'Riptide', artist: 'Vance Joy', duration: '03:24', likes: '1.9M' },
    { title: 'Little Talks', artist: 'Of Monsters and Men', duration: '04:26', likes: '1.4M' },
  ],
  funk: [
    { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', duration: '04:30', likes: '3.9M' },
    { title: 'Superstition', artist: 'Stevie Wonder', duration: '04:26', likes: '1.7M' },
    { title: 'Give Life Back to Music', artist: 'Daft Punk', duration: '04:34', likes: '1.1M' },
    { title: 'Cissy Strut', artist: 'The Meters', duration: '03:06', likes: '420K' },
  ],
};

const GENRE_ALIASES = {
  pop: ['pop', '流行'],
  jazz: ['jazz', '爵士'],
  rock: ['rock', '摇滚'],
  hiphop: ['hip-hop', 'hiphop', 'rap', '说唱'],
  classical: ['classical', '古典'],
  electronic: ['electronic', 'edm', '电子'],
  rnb: ['r&b', 'rnb', '节奏蓝调'],
  country: ['country', '乡村'],
  latin: ['latin', '拉丁'],
  metal: ['metal', '重金属'],
  indie: ['indie', '独立'],
  funk: ['funk', '放克'],
};

function matchesGenre(track, genreId) {
  const raw = `${track.genre || ''} ${track.tags || ''}`.toLowerCase();
  return (GENRE_ALIASES[genreId] || [genreId]).some((alias) => raw.includes(alias));
}

function toWheelSong(track) {
  return {
    id: track.id,
    title: track.title || 'Untitled Track',
    artist: [track.mbti, track.mode].filter(Boolean).join(' · ') || 'Shared Library',
    duration: track.durationSec ? `${Math.floor(track.durationSec / 60)}:${String(track.durationSec % 60).padStart(2, '0')}` : '--:--',
    likes: `${track.playCount || 0}`,
    audioUrl: track.audioUrl,
    genre: track.genre,
    source: 'library',
  };
}

export default function MusicWheel({
  backendTracks = [],
  onPlayTrack,
  onTogglePlayback,
  onStopPlayback,
  onRecordTrackPlay,
}) {
  const [spinning, setSpinning] = useState(false);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [selectedGenreIndex, setSelectedGenreIndex] = useState(0);
  const [showResultModal, setShowResultModal] = useState(false);
  const [currentPlayingSong, setCurrentPlayingSong] = useState(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const spinTimerRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => () => {
    clearTimeout(spinTimerRef.current);
    clearTimeout(toastTimerRef.current);
  }, []);

  // 转盘停止时用 Web Audio 合成一段复古激光音效
  const playStopSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.15);
      osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.45);
      // 音效结束后关闭 AudioContext，释放系统音频资源
      osc.onended = () => ctx.close().catch(() => {});
    } catch {
      // 用户尚未交互时浏览器可能拒绝播放，忽略即可
    }
  };

  const handleSpin = () => {
    if (spinning) return;
    if (currentPlayingSong?.audioUrl) {
      onStopPlayback?.();
    }
    setIsPlayingAudio(false);
    setCurrentPlayingSong(null);
    setSpinning(true);
    setShowResultModal(false);

    const sectorCount = GENRES.length;
    const targetIndex = Math.floor(Math.random() * sectorCount);
    const singleSectorAngle = 360 / sectorCount;
    const offsetAngle = 360 - targetIndex * singleSectorAngle;
    const additionalSpins = 5 * 360;
    const newRotation = currentRotation + additionalSpins + (offsetAngle - (currentRotation % 360));
    setCurrentRotation(newRotation);

    clearTimeout(spinTimerRef.current);
    spinTimerRef.current = setTimeout(() => {
      setSpinning(false);
      setSelectedGenreIndex(targetIndex);
      setShowResultModal(true);
      playStopSound();
    }, 5000);
  };

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 3000);
  };

  const handleShare = () => {
    const text = `🎉 我在【霓虹俱乐部】抽中了音乐类型：#${GENRES[selectedGenreIndex].name}#！推荐曲目太好听了，快来试试你的音乐好运！`;
    navigator.clipboard
      .writeText(text)
      .then(() => triggerToast('结果已复制到剪贴板，快去和朋友分享吧！'))
      .catch(() => triggerToast('分享失败，请手动截图或复制页面链接。'));
  };

  const handlePlaySong = (song) => {
    const isSameSong = currentPlayingSong?.title === song.title;
    if (isSameSong && song.audioUrl) {
      onTogglePlayback?.();
      setIsPlayingAudio((value) => !value);
      return;
    }

    if (isSameSong && isPlayingAudio) {
      setIsPlayingAudio(false);
      return;
    }

    setCurrentPlayingSong(song);
    setIsPlayingAudio(true);

    if (song.audioUrl) {
      onPlayTrack?.({ audioUrl: song.audioUrl, title: song.title, trackId: song.id });
      if (song.id) onRecordTrackPlay?.(song.id);
      triggerToast(`正在播放: ${song.title}`);
    } else {
      triggerToast(`示例曲目: ${song.title}。曲库暂无该流派真实音频。`);
    }
  };

  const handleMiniToggle = () => {
    if (!currentPlayingSong?.audioUrl) {
      setIsPlayingAudio((value) => !value);
      return;
    }
    onTogglePlayback?.();
    setIsPlayingAudio((value) => !value);
  };

  const handleMiniClose = () => {
    if (currentPlayingSong?.audioUrl) {
      onStopPlayback?.();
    }
    setIsPlayingAudio(false);
    setCurrentPlayingSong(null);
  };

  const activeGenre = GENRES[selectedGenreIndex];
  const realSongs = backendTracks
    .filter((track) => track?.audioUrl && matchesGenre(track, activeGenre.id))
    .map(toWheelSong);
  const activeSongs = realSongs.length ? realSongs : SONGS_DATABASE[activeGenre.id] || [];
  const usingRealSongs = realSongs.length > 0;

  return (
    <div className="music-wheel-scope relative w-full overflow-hidden rounded-2xl border border-white/10 bg-[#08070b] text-zinc-100 shadow-2xl">

      {/* 背景氛围光 */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-[#ff2a7a]/15 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-[#00f5d4]/15 blur-[150px] pointer-events-none"></div>

      <div className="relative flex flex-col">

        {/* 页头 */}
        <header className="px-4 lg:px-8 py-3 border-b border-white/5 flex justify-between items-center bg-[#0d0c12]/80 backdrop-blur-md z-30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff2a7a] to-[#00f5d4] p-[1.5px] flex items-center justify-center shadow-lg shadow-[#ff2a7a]/20">
              <div className="w-full h-full bg-[#0d0c12] rounded-[10px] flex items-center justify-center">
                <Disc className="w-5 h-5 text-emerald-400 animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-black tracking-widest text-white flex items-center gap-1.5 uppercase font-orbitron">
                NEON <span className="text-[#ff2a7a] neon-glow-pink">CLUB</span>
              </h1>
              <p className="text-[10px] text-zinc-400 tracking-wider">霓虹俱乐部 · 音乐基因转盘</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
              <span className="w-2 h-2 rounded-full bg-[#00f5d4] animate-pulse"></span>
              <span className="text-zinc-300 font-orbitron text-[10px]">STAGE 01 LIVE</span>
            </div>
            <button
              onClick={() => triggerToast('玩法说明：点击转盘中心的播放键，让电光指针带你发掘今晚的最佳旋律！')}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition border border-white/10 text-zinc-400 hover:text-white"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* 主区：桌面分屏（转盘 + 歌单），移动端上下排 */}
        <main className="grid grid-cols-1 lg:grid-cols-12 gap-0 relative">

          {/* 左区：转盘 */}
          <div className="lg:col-span-7 flex flex-col justify-center items-center p-4 lg:p-8 relative overflow-hidden neon-radial-bg">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-40"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] aspect-square max-w-[650px] bg-gradient-to-tr from-[#ff2a7a]/5 to-[#00f5d4]/5 rounded-full filter blur-2xl pointer-events-none"></div>

            <div className="mb-6 text-center z-10 pointer-events-none">
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] uppercase tracking-widest text-[#00f5d4] font-orbitron font-semibold">
                🎰 Spin the Rhythm
              </span>
              <h2 className="text-xl font-bold text-white mt-2 tracking-wide">
                {spinning ? '正在解码今夜旋律...' : `当前锁定流派: ${activeGenre.name}`}
              </h2>
            </div>

            {/* 转盘工作区 */}
            <div className="relative w-full aspect-square max-w-[360px] sm:max-w-[440px] md:max-w-[480px] lg:max-w-[500px] flex items-center justify-center z-10">

              {/* 霓虹外圈 */}
              <div className={`absolute inset-0 rounded-full p-[3px] transition-all duration-700 ${spinning ? 'neon-border-pink animate-pulseScale' : 'neon-border-green'}`}>
                <div className="w-full h-full rounded-full bg-[#0d0c15] border-[4px] border-zinc-900 relative">
                  <div className="absolute inset-1 rounded-full border border-zinc-800 pointer-events-none"></div>
                  <div className="absolute inset-6 rounded-full border border-white/5 pointer-events-none"></div>
                </div>
              </div>

              {/* 转盘本体 */}
              <div
                className="absolute w-[88%] h-[88%] rounded-full overflow-hidden wheel-transition shadow-2xl shadow-black/80"
                style={{
                  transform: `rotate(${currentRotation}deg)`,
                  boxShadow: '0 0 40px rgba(0,0,0,0.9), inset 0 0 25px rgba(255,42,122,0.1)',
                }}
              >
                <svg viewBox="0 0 500 500" className="w-full h-full">
                  <defs>
                    {GENRES.map((g) => (
                      <radialGradient id={`grad-${g.id}`} key={g.id} cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#12101f" />
                        <stop offset="70%" stopColor="#0d0b16" />
                        <stop offset="100%" stopColor={g.color} stopOpacity="0.45" />
                      </radialGradient>
                    ))}
                  </defs>

                  {GENRES.map((genre, index) => {
                    const count = GENRES.length;
                    const angle = 360 / count;
                    const startAngle = index * angle - 90;
                    const endAngle = (index + 1) * angle - 90;
                    const radStart = (startAngle * Math.PI) / 180;
                    const radEnd = (endAngle * Math.PI) / 180;
                    const x1 = 250 + 250 * Math.cos(radStart);
                    const y1 = 250 + 250 * Math.sin(radStart);
                    const x2 = 250 + 250 * Math.cos(radEnd);
                    const y2 = 250 + 250 * Math.sin(radEnd);
                    const pathData = `M 250 250 L ${x1} ${y1} A 250 250 0 0 1 ${x2} ${y2} Z`;
                    const textAngle = startAngle + angle / 2;
                    const radText = (textAngle * Math.PI) / 180;
                    const textDist = 165;
                    const tx = 250 + textDist * Math.cos(radText);
                    const ty = 250 + textDist * Math.sin(radText);
                    const isCurrentlySelected = selectedGenreIndex === index && !spinning;

                    return (
                      <g key={genre.id} className="cursor-pointer group">
                        <path
                          d={pathData}
                          fill={`url(#grad-${genre.id})`}
                          stroke="#000"
                          strokeWidth="1.5"
                          opacity={spinning ? 0.85 : isCurrentlySelected ? 1 : 0.6}
                          className="transition-opacity duration-300 hover:opacity-100"
                        />
                        <line x1="250" y1="250" x2={x1} y2={y1} stroke={genre.color} strokeWidth="0.5" opacity="0.3" />
                        <g transform={`translate(${tx}, ${ty}) rotate(${textAngle})`}>
                          <text
                            x="0"
                            y="4"
                            textAnchor="middle"
                            fill="#ffffff"
                            fontSize={genre.name.length > 8 ? '10' : '11'}
                            fontWeight={isCurrentlySelected ? 'bold' : '600'}
                            letterSpacing="0.05em"
                            fillOpacity={isCurrentlySelected ? 1 : 0.75}
                            className="font-orbitron tracking-tighter"
                            style={{ textShadow: isCurrentlySelected ? `0 0 10px ${genre.color}` : 'none' }}
                          >
                            {genre.name}
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </svg>
              </div>

              {/* 中心触发按钮 */}
              <div className="absolute w-[20%] h-[20%] min-w-[76px] min-h-[76px] rounded-full bg-zinc-950 flex items-center justify-center z-30 shadow-2xl p-1 border border-zinc-800">
                <button
                  onClick={handleSpin}
                  disabled={spinning}
                  className={`w-full h-full rounded-full flex flex-col items-center justify-center transition-all duration-300 relative overflow-hidden group ${
                    spinning
                      ? 'bg-[#ff2a7a]/20 cursor-wait border border-[#ff2a7a]/60 text-[#ff2a7a] scale-95'
                      : 'bg-gradient-to-br from-[#12111d] to-[#0c0a15] hover:from-[#ff2a7a] hover:to-[#ff2a7a]/80 border border-[#00f5d4]/40 text-[#00f5d4] hover:text-white shadow-[0_0_20px_rgba(0,245,212,0.3)] hover:shadow-[0_0_25px_rgba(255,42,122,0.6)]'
                  }`}
                >
                  <div className="absolute inset-0 bg-[#ff2a7a]/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"></div>
                  {spinning ? (
                    <div className="flex flex-col items-center justify-center">
                      <span className="w-5 h-5 border-2 border-[#ff2a7a] border-t-transparent rounded-full animate-spin"></span>
                      <span className="text-[7px] font-bold tracking-widest uppercase mt-1 text-[#ff2a7a]">SPIN</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center">
                      <Play className="w-5 h-5 fill-current animate-pulse" />
                      <span className="text-[8px] font-extrabold tracking-widest uppercase mt-0.5 font-orbitron">PLAY</span>
                    </div>
                  )}
                </button>
              </div>

              {/* 顶部指针 */}
              <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center">
                <div className="w-6 h-6 bg-gradient-to-b from-[#00f5d4] to-[#ff2a7a] rounded-full p-[2px] shadow-lg shadow-[#00f5d4]/30 animate-bounce">
                  <div className="w-full h-full bg-zinc-950 rounded-full flex items-center justify-center">
                    <span className="w-1.5 h-1.5 bg-[#00f5d4] rounded-full"></span>
                  </div>
                </div>
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[16px] border-t-[#00f5d4] -mt-1 drop-shadow-[0_4px_10px_rgba(0,245,212,0.8)]"></div>
              </div>
            </div>

            {/* 正在播放的迷你条 */}
            {currentPlayingSong && (
              <div className="w-full max-w-[450px] mt-6 px-4 py-2.5 rounded-xl bg-[#0e0d16] border border-white/5 flex items-center justify-between z-10 animate-fade-in">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-lg bg-[#ff2a7a]/20 flex items-center justify-center relative shrink-0">
                    <Music className="w-4 h-4 text-[#ff2a7a] animate-bounce" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-white truncate">{currentPlayingSong.title}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{currentPlayingSong.artist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleMiniToggle} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white">
                    {isPlayingAudio ? <Pause className="w-3.5 h-3.5 fill-current text-[#00f5d4]" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  </button>
                  <button onClick={handleMiniClose} className="p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 右区：霓虹歌单 */}
          <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col bg-[#0b0a11] z-20 overflow-hidden">
            <div className="p-4 lg:p-6 border-b border-white/5 bg-[#0d0c14] shrink-0">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded bg-[#00f5d4]/10 text-[#00f5d4]">
                    <Radio className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold tracking-wider text-white uppercase font-orbitron">Recommended Station</h3>
                </div>
                <span className="text-[10px] text-zinc-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-md font-orbitron">
                  {usingRealSongs ? `${activeSongs.length} REAL TRACKS` : `${activeSongs.length} DEMO TRACKS`}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-gradient-to-r from-zinc-900 to-zinc-950 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 bottom-0 left-0 w-[3px] bg-gradient-to-b from-[#ff2a7a] to-[#00f5d4]"></div>
                <div className="pl-2">
                  <p className="text-[10px] uppercase text-zinc-500 font-bold tracking-widest">Selected Style</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-white">{activeGenre.name}</span>
                    <span className="text-[10px] text-emerald-400 font-orbitron font-semibold">MATCH 100%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 歌曲列表（可滚动）*/}
            <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-2.5 neon-scrollbar max-h-[320px]">
              {activeSongs.map((song) => {
                const isSelectedAndPlaying = currentPlayingSong?.title === song.title && isPlayingAudio;
                return (
                  <div
                    key={song.title}
                    className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between group ${
                      isSelectedAndPlaying
                        ? 'bg-[#ff2a7a]/10 border-[#ff2a7a]/40 shadow-[0_0_15px_rgba(255,42,122,0.1)]'
                        : 'bg-[#121019]/60 hover:bg-[#151322] border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <button
                        onClick={() => handlePlaySong(song)}
                        className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                          isSelectedAndPlaying
                            ? 'bg-[#ff2a7a] text-white'
                            : 'bg-white/5 group-hover:bg-[#00f5d4] group-hover:text-black text-zinc-400'
                        }`}
                      >
                        {isSelectedAndPlaying ? <Pause className="w-4 h-4 fill-current animate-pulse" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </button>
                      <div className="overflow-hidden">
                        <p className="text-xs font-bold text-white group-hover:text-[#00f5d4] transition-colors truncate">{song.title}</p>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5">{song.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-zinc-500 font-orbitron bg-white/5 px-2 py-0.5 rounded">
                        <Heart className="w-2.5 h-2.5 text-zinc-500 fill-zinc-500" />
                        {song.likes}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">{song.duration}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 底部操作区 */}
            <div className="p-4 border-t border-white/5 bg-[#0d0c14] space-y-3 shrink-0">
              <div className="flex gap-2">
                <button
                  onClick={handleSpin}
                  disabled={spinning}
                  className="flex-1 py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase font-orbitron bg-gradient-to-r from-[#ff2a7a] to-[#ff2a7a]/80 hover:from-[#ff2a7a]/90 hover:to-[#ff2a7a] text-white transition-transform active:scale-95 flex items-center justify-center gap-1.5 shadow-lg shadow-[#ff2a7a]/20 disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4 text-white" />
                  {spinning ? '正在解码...' : '摇转轮盘 SPIN'}
                </button>
                <button
                  onClick={handleShare}
                  className="py-3 px-4 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 text-zinc-300 transition-colors flex items-center justify-center"
                  title="分享结果"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* 页脚 */}
        <footer className="px-4 py-2 border-t border-white/5 bg-[#050408] text-center z-30 flex justify-between items-center text-[10px] text-zinc-500">
          <span className="font-orbitron">© 2025 NEON CLUB INC.</span>
          <span className="flex items-center gap-1 text-[#00f5d4] font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4] animate-ping"></span>
            夜电波在线 · 直接畅听
          </span>
        </footer>
      </div>

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl bg-zinc-950/90 border border-white/15 backdrop-blur-md text-white text-xs font-medium shadow-2xl flex items-center gap-2 z-50 animate-bounce">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00f5d4]"></span>
          {toastMsg}
        </div>
      )}

      {/* 结果弹窗 */}
      {showResultModal && (
        <div className="fixed inset-0 bg-[#08070b]/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="absolute w-[300px] h-[300px] rounded-full bg-[#00f5d4]/10 blur-[100px] pointer-events-none"></div>
          <div className="w-full max-w-sm rounded-2xl bg-zinc-950 border border-emerald-500/30 p-6 text-center shadow-[0_0_50px_rgba(0,245,212,0.15)] relative overflow-hidden">
            <div className="absolute top-2 left-2 w-2 h-2 border-t border-l border-[#00f5d4]"></div>
            <div className="absolute top-2 right-2 w-2 h-2 border-t border-r border-[#00f5d4]"></div>
            <div className="absolute bottom-2 left-2 w-2 h-2 border-b border-l border-[#00f5d4]"></div>
            <div className="absolute bottom-2 right-2 w-2 h-2 border-b border-r border-[#00f5d4]"></div>

            <div className="w-16 h-16 mx-auto rounded-full bg-[#00f5d4]/10 flex items-center justify-center mb-4 text-[#00f5d4] shadow-inner">
              <Disc className="w-8 h-8 animate-spin" style={{ animationDuration: '4s' }} />
            </div>

            <p className="text-[10px] tracking-widest text-[#00f5d4] uppercase font-semibold font-orbitron">CONGRATULATIONS / 中奖流派</p>
            <h3 className="text-3xl font-black text-white mt-1 mb-2 tracking-wide neon-glow-green">{activeGenre.name}</h3>
            <p className="text-xs text-zinc-400 mb-6 px-4">电音指南已为你智能解密该流派，推荐曲目已自动载入你的专属歌单。</p>

            <div className="bg-white/5 rounded-xl p-2.5 mb-6 text-left space-y-1 border border-white/5 max-h-[140px] overflow-y-auto neon-scrollbar">
              <p className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold mb-1.5 px-1">即将试听 TRACKLIST</p>
              {activeSongs.slice(0, 3).map((song, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 px-2 hover:bg-white/5 rounded transition-colors text-xs">
                  <span className="font-bold text-white truncate mr-2">{idx + 1}. {song.title}</span>
                  <span className="text-zinc-400 shrink-0 text-[10px]">{song.artist}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setShowResultModal(false);
                  if (activeSongs.length > 0) handlePlaySong(activeSongs[0]);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00f5d4] to-[#00f5d4]/80 text-black font-extrabold text-xs tracking-wider uppercase font-orbitron hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-[#00f5d4]/20"
              >
                立刻探索该流派音乐
              </button>
              <div className="flex gap-2">
                <button onClick={handleShare} className="flex-1 py-2 rounded-lg border border-white/10 hover:border-white/20 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-white/5 transition-colors">
                  <Share2 className="w-3.5 h-3.5" /> 分享结果
                </button>
                <button onClick={() => setShowResultModal(false)} className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold transition-colors">
                  返回转盘
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
