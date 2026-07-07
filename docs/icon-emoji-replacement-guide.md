# Emoji to Icon Replacement Guide

Date: 2026-07-05

This guide is for agents replacing frontend emoji/glyph strings with the generated icon assets.

## Asset Sets

Badge version, approved first:

- Directory: `assets/icon-previews/`
- Format: transparent PNG
- Style: dark rounded-square badge plus colored glyph
- Manifest: `assets/icon-previews/manifest.txt`

Glyph-only version, no badge:

- Directory: `assets/icon-glyphs/`
- Format: transparent PNG
- Style: isolated colored glyph only, no rounded-square background
- Manifest: `assets/icon-glyphs/manifest.txt`

Use the badge version where the old emoji sat alone as a large card/entry icon. Use the glyph-only version inside existing buttons, pills, nav links, headings, or anywhere the component already supplies a container/background.

These directories are checked-in source/reference assets. Vite does not publish the repository-root `assets/` directory as `/assets/...` at runtime. The current app also keeps the deployed glyphs in `public/icons/`, so rendered UI should use `/icons/{name}.png`. If a future asset set is not copied to `public/icons/`, move it under `src/assets/icons/` and import it instead.

## Implementation Pattern

Recommended helper shape:

```jsx
const ICON_BASE = '/icons';

function Icon({ name, alt = '', className = 'inline-block h-4 w-4' }) {
  return <img src={`${ICON_BASE}/${name}.png`} alt={alt} className={className} />;
}
```

If using Vite import URLs instead of public paths, move or copy the selected assets under `src/assets/icons/` and import via `new URL('../assets/icons/name.png', import.meta.url).href`.

## Replacement Rules

- Replace by semantic context, not by literal emoji.
- Preserve accessible labels already expressed by surrounding text. For decorative inline icons, use `alt=""`.
- Do not replace `©`; keep it as text.
- Player controls (`play`, `pause`, `stop`, `close`, `back`, `forward`) can also be replaced by lucide/SVG icons if the UI needs dynamic color inheritance.
- For mode labels, centralize the mapping in `src/lib/mbti.js` first, then reuse that mapping from `AdminPanel`, `DiscoverPage`, and `ArrangerPanel`.

## Literal Emoji / Glyph Mapping

| Current | Default icon | Notes |
|---|---|---|
| 🏠 | `home` | Home navigation |
| 🌊 | `roomwave` | RoomWave navigation/entry |
| 🎛 | `dj-console` | AI DJ console / return console |
| 🎚 | `mixer` | Mixer navigation/entry |
| 🌍 | `discover` | Discover music navigation/header |
| ⚙️ | `settings-admin` | Admin/settings |
| 👤 | `user-login` | Login button |
| ☀️ | `sun` | Light mode / morning greeting |
| 🌙 | `moon` | Dark mode / night greeting |
| 🌤 | `noon-sun-cloud` | Noon greeting |
| 🌆 | `evening-city` | Evening greeting |
| 💡 | `mode-brainstorm` | Brainstorm mode |
| 🧠 | `mode-brainstorm` | Brainstorm mode in Discover |
| 🎯 | `mode-focus` | Focus mode |
| 🏃 | `mode-sprint` | Sprint mode in Discover |
| ⚡ | context-dependent | Use `mode-sprint` in `src/lib/mbti.js` and `AdminPanel`; use `mode-charge` in `DiscoverPage` charge label |
| 🔥 | context-dependent | Use `mode-charge` for charge mode; `mode-behind` in `DiscoverPage` behind label; `feedback-more-drive` in Arranger feedback; `mode-charge` or a future `afternoon-energy` for afternoon greeting |
| ⏰ | `mode-behind` | Behind schedule / urgent mode |
| ☕ | `mode-break` | Break mode |
| 🎉 | `mode-celebrate` | Celebrate mode and music-wheel share text, if share text should also drop emoji |
| 🔉 | `feedback-too-loud` | Arranger feedback |
| ⏭ | `feedback-skip` | Arranger feedback |
| ❤️ | `feedback-like` | Arranger feedback |
| 📻 | `radio` | Radio / publish station |
| 🎵 | `music` | Generic music, playlist, fallback mood |
| ♪ | `music-note-small` | Small quota/status marker |
| 👥 | `listeners` | Listener count |
| ▶ | `play` | Playback/start/play count |
| ⏸ | `pause` | Pause playback |
| ⏹ | `stop` | Stop arranger |
| 🔊 | `volume-on` | Volume on |
| 🔇 | `volume-muted` | Muted |
| ✏️ | `project-manual-input` | Manual project input tab |
| 📁 | `project-folder` | Project folder tab/upload |
| 🐙 | `project-git-repo` | GitHub/repo input; generated as neutral git repo, not Octocat |
| 🎰 | `spin-rhythm` | Music wheel spin feature |
| ✕ | `close` | Close/delete |
| ← | `back` | Back navigation |
| → | `forward` | Feature-card arrow indicator |
| © | Keep text | Copyright mark |

## Known Replacement Locations

| File | Replace |
|---|---|
| `src/App.jsx` | Header nav: `home`, `roomwave`, `dj-console`, `discover`, `mixer`, `settings-admin` |
| `src/components/LandingHub.jsx` | Greeting icons; feature cards; CTA music icon; last-track note |
| `src/lib/mbti.js` | Prefer replacing `emoji` field with `icon` field or adding `icon` beside label |
| `src/components/AdminPanel.jsx` | Mode labels should read mode icon names from shared mapping |
| `src/components/DiscoverPage.jsx` | Mode labels, radio cards, playlist cards, listener count, play count, tab buttons |
| `src/components/ArrangerPanel.jsx` | Feedback buttons, mode buttons, radio toggle, play/stop controls |
| `src/components/AuthPanel.jsx` | Login icon and quota note marker |
| `src/components/ThemeToggle.jsx` | `sun` / `moon` |
| `src/components/RoomWave.jsx` | Theme toggle and nav links |
| `src/components/ProjectDeck.jsx` | Input method tabs and folder picker |
| `src/components/PlayerDeck.jsx` | Play/pause and volume buttons |
| `src/components/SharedLibraryBrowser.jsx` | Play count glyph |
| `src/components/MusicWheel.jsx` | `spin-rhythm`; share text may keep or remove `🎉` depending product copy |

## Suggested Shared Data Refactor

Add an icon key to mode data:

```js
export const MODES = [
  { id: 'brainstorm', label: '头脑风暴', icon: 'mode-brainstorm', desc: '欢快 · 选题讨论' },
  { id: 'focus', label: '专注构思', icon: 'mode-focus', desc: 'Lo-fi · 沉浸开发' },
  { id: 'sprint', label: '代码冲刺', icon: 'mode-sprint', desc: '高 BPM · 赶工' },
  { id: 'charge', label: '战鼓催阵', icon: 'mode-charge', desc: '史诗 · 上台前' },
  { id: 'behind', label: '落后了', icon: 'mode-behind', desc: '紧迫 · 追赶进度' },
  { id: 'break', label: '休息一下', icon: 'mode-break', desc: '放松 · 短暂充电' },
  { id: 'celebrate', label: '完成了！', icon: 'mode-celebrate', desc: '狂欢 · 庆祝胜利' },
];
```

Then render:

```jsx
<Icon name={modeInfo.icon} alt="" className="h-4 w-4" />
```
