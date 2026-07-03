export default function ThemeToggle({ isDark, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="pad flex h-9 w-9 items-center justify-center text-base"
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '浅色模式' : '深色模式'}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
}
