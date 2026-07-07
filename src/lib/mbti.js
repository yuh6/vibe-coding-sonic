export const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

// 七阶段体系（v3 替换原 Focus/Spark/Sprint/Charge 四模式）
export const MODES = [
  { id: 'brainstorm', label: '头脑风暴', emoji: '💡', icon: 'mode-brainstorm', desc: '欢快 · 选题讨论' },
  { id: 'focus', label: '专注构思', emoji: '🎯', icon: 'mode-focus', desc: 'Lo-fi · 沉浸开发' },
  { id: 'sprint', label: '代码冲刺', emoji: '⚡', icon: 'mode-sprint', desc: '高 BPM · 赶工' },
  { id: 'charge', label: '战鼓催阵', emoji: '🔥', icon: 'mode-charge', desc: '史诗 · 上台前' },
  { id: 'behind', label: '落后了', emoji: '⏰', icon: 'mode-behind', desc: '紧迫 · 追赶进度' },
  { id: 'break', label: '休息一下', emoji: '☕', icon: 'mode-break', desc: '放松 · 短暂充电' },
  { id: 'celebrate', label: '完成了！', emoji: '🎉', icon: 'mode-celebrate', desc: '狂欢 · 庆祝胜利' },
];

export const MBTI_THEMES = {
  INTJ: { primary: '#1e1b4b', accent: '#6366f1', glow: '#818cf8' },
  INTP: { primary: '#0f172a', accent: '#22d3ee', glow: '#67e8f9' },
  ENTJ: { primary: '#1c1917', accent: '#dc2626', glow: '#f87171' },
  ENTP: { primary: '#172554', accent: '#f59e0b', glow: '#fbbf24' },
  INFJ: { primary: '#134e4a', accent: '#2dd4bf', glow: '#5eead4' },
  INFP: { primary: '#3b0764', accent: '#c084fc', glow: '#e9d5ff' },
  ENFJ: { primary: '#713f12', accent: '#f97316', glow: '#fdba74' },
  ENFP: { primary: '#7c2d12', accent: '#fb923c', glow: '#fed7aa' },
  ISTJ: { primary: '#1e293b', accent: '#94a3b8', glow: '#cbd5e1' },
  ISFJ: { primary: '#365314', accent: '#84cc16', glow: '#bef264' },
  ESTJ: { primary: '#1e3a5f', accent: '#3b82f6', glow: '#93c5fd' },
  ESFJ: { primary: '#831843', accent: '#ec4899', glow: '#f9a8d4' },
  ISTP: { primary: '#0c0a09', accent: '#78716c', glow: '#a8a29e' },
  ISFP: { primary: '#4a044e', accent: '#e879f9', glow: '#f0abfc' },
  ESTP: { primary: '#450a0a', accent: '#ef4444', glow: '#fca5a5' },
  ESFP: { primary: '#7f1d1d', accent: '#f43f5e', glow: '#fb7185' },
};

export function getTheme(mbti) {
  return MBTI_THEMES[mbti] || MBTI_THEMES.INTJ;
}

// ── MBTI 四轴 remix ──
// 每轴 0-100：0 = 左极（I/N/T/J），100 = 右极（E/S/F/P）
export const AXES = [
  { key: 'ie', left: 'I', right: 'E', leftLabel: '内向', rightLabel: '外向' },
  { key: 'ns', left: 'N', right: 'S', leftLabel: '直觉', rightLabel: '实感' },
  { key: 'tf', left: 'T', right: 'F', leftLabel: '思考', rightLabel: '情感' },
  { key: 'jp', left: 'J', right: 'P', leftLabel: '判断', rightLabel: '感知' },
];

export function mbtiFromAxes(axes) {
  return (
    (axes.ie < 50 ? 'I' : 'E') +
    (axes.ns < 50 ? 'N' : 'S') +
    (axes.tf < 50 ? 'T' : 'F') +
    (axes.jp < 50 ? 'J' : 'P')
  );
}

export function axesFromMbti(type) {
  const t = String(type || 'INTJ').toUpperCase();
  return {
    ie: t[0] === 'I' ? 12 : 88,
    ns: t[1] === 'N' ? 12 : 88,
    tf: t[2] === 'T' ? 12 : 88,
    jp: t[3] === 'J' ? 12 : 88,
  };
}
