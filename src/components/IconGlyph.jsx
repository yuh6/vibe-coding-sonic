import {
  AudioWaveform,
  Brain,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleStop,
  Clock,
  CloudSun,
  Coffee,
  Compass,
  Flame,
  Folder,
  Gauge,
  GitBranch,
  Heart,
  Home,
  Images,
  Keyboard,
  LogIn,
  Moon,
  Music,
  Music2,
  PartyPopper,
  Pause,
  Play,
  Radio,
  RefreshCw,
  Settings,
  SkipForward,
  SlidersHorizontal,
  Sun,
  Table2,
  Target,
  Users,
  Volume2,
  VolumeX,
  Waves,
  X,
  Zap,
} from 'lucide-react';

const ICON_COMPONENTS = {
  back: ChevronLeft,
  close: X,
  discover: Compass,
  'dj-console': AudioWaveform,
  'evening-city': Building2,
  'feedback-like': Heart,
  'feedback-more-drive': Gauge,
  'feedback-skip': SkipForward,
  'feedback-too-loud': VolumeX,
  forward: ChevronRight,
  home: Home,
  listeners: Users,
  mixer: SlidersHorizontal,
  'mode-behind': Clock,
  'mode-brainstorm': Brain,
  'mode-break': Coffee,
  'mode-celebrate': PartyPopper,
  'mode-charge': Flame,
  'mode-focus': Target,
  'mode-sprint': Zap,
  moon: Moon,
  'music-note-small': Music2,
  music: Music,
  'noon-sun-cloud': CloudSun,
  pause: Pause,
  play: Play,
  'preview-sheet-all': Images,
  'preview-sheet': Table2,
  'project-folder': Folder,
  'project-git-repo': GitBranch,
  'project-manual-input': Keyboard,
  radio: Radio,
  roomwave: Waves,
  'settings-admin': Settings,
  'spin-rhythm': RefreshCw,
  stop: CircleStop,
  sun: Sun,
  'user-login': LogIn,
  'volume-muted': VolumeX,
  'volume-on': Volume2,
};

export default function IconGlyph({ name, alt = '', className = 'h-4 w-4', ...props }) {
  if (!name) return null;
  const Icon = ICON_COMPONENTS[name] || Music;

  return (
    <Icon
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt === '' ? true : undefined}
      className={`inline-block shrink-0 ${className}`}
      focusable="false"
      strokeWidth={2}
      {...props}
    />
  );
}
