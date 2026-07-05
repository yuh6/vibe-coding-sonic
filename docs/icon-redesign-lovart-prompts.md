# Frontend Emoji Inventory and Lovart Icon Prompts

Date: 2026-07-05

Scope: scanned `src/**/*.{js,jsx,css,html}` only. Server files and docs are excluded. The list includes true emoji plus UI glyphs currently used like play, close, arrows, and music note symbols.

## Current Inventory

| Current | Count | Suggested icon name | Meaning / use | Locations |
|---|---:|---|---|---|
| 🏠 | 1 | `home` | Home navigation | `src/App.jsx:475` |
| 🌊 | 3 | `roomwave` | RoomWave team music space | `src/App.jsx:482`, `src/components/LandingHub.jsx:47`, `src/components/RoomWave.jsx:534` |
| 🎛 | 5 | `dj-console` | AI DJ console / return to console | `src/App.jsx:488`, `src/App.jsx:494`, `src/App.jsx:500`, `src/components/LandingHub.jsx:17`, `src/components/RoomWave.jsx:540` |
| 🎚 | 3 | `mixer` | Multi-track mixer | `src/App.jsx:494`, `src/components/LandingHub.jsx:27`, `src/components/RoomWave.jsx:538` |
| 🌍 | 4 | `discover` | Discover music | `src/App.jsx:488`, `src/components/LandingHub.jsx:37`, `src/components/DiscoverPage.jsx:138`, `src/components/RoomWave.jsx:537` |
| ⚙️ | 2 | `settings-admin` | Admin / settings | `src/App.jsx:500`, `src/components/RoomWave.jsx:539` |
| 👤 | 1 | `user-login` | Login | `src/components/AuthPanel.jsx:141` |
| ☀️ | 3 | `sun` | Morning greeting / light mode | `src/components/LandingHub.jsx:8`, `src/components/ThemeToggle.jsx:10`, `src/components/RoomWave.jsx:526` |
| 🌙 | 3 | `moon` | Night greeting / dark mode | `src/components/LandingHub.jsx:7`, `src/components/ThemeToggle.jsx:10`, `src/components/RoomWave.jsx:526` |
| 🌤 | 1 | `noon-sun-cloud` | Noon greeting | `src/components/LandingHub.jsx:9` |
| 🌆 | 1 | `evening-city` | Evening greeting | `src/components/LandingHub.jsx:11` |
| 💡 / 🧠 | 3 | `mode-brainstorm` | Brainstorm mode; currently inconsistent | `src/lib/mbti.js:10`, `src/components/AdminPanel.jsx:29`, `src/components/DiscoverPage.jsx:8` |
| 🎯 | 3 | `mode-focus` | Focus mode | `src/lib/mbti.js:11`, `src/components/AdminPanel.jsx:30`, `src/components/DiscoverPage.jsx:8` |
| ⚡ | 3 | `mode-sprint` / `mode-charge` | Sprint in `lib` and admin; charge in Discover. Resolve by mode id. | `src/lib/mbti.js:12`, `src/components/AdminPanel.jsx:31`, `src/components/DiscoverPage.jsx:9` |
| 🏃 | 1 | `mode-sprint` | Sprint mode in Discover | `src/components/DiscoverPage.jsx:8` |
| 🔥 | 5 | `mode-charge` / `mode-behind` / `feedback-more-drive` | Charge in `lib` and admin; behind in Discover; more-drive feedback; afternoon greeting. Resolve by context. | `src/lib/mbti.js:13`, `src/components/AdminPanel.jsx:32`, `src/components/ArrangerPanel.jsx:5`, `src/components/DiscoverPage.jsx:9`, `src/components/LandingHub.jsx:10` |
| ⏰ | 2 | `mode-behind` | Behind schedule / urgent mode in `lib` and admin | `src/lib/mbti.js:14`, `src/components/AdminPanel.jsx:33` |
| ☕ | 3 | `mode-break` | Break mode | `src/lib/mbti.js:15`, `src/components/AdminPanel.jsx:34`, `src/components/DiscoverPage.jsx:9` |
| 🎉 | 4 | `mode-celebrate` | Celebrate / share result | `src/lib/mbti.js:16`, `src/components/AdminPanel.jsx:35`, `src/components/DiscoverPage.jsx:9`, `src/components/MusicWheel.jsx:210` |
| 🔉 | 1 | `feedback-too-loud` | Feedback: too loud | `src/components/ArrangerPanel.jsx:4` |
| ⏭ | 1 | `feedback-skip` | Feedback: skip | `src/components/ArrangerPanel.jsx:6` |
| ❤️ | 1 | `feedback-like` | Feedback: like | `src/components/ArrangerPanel.jsx:7` |
| 📻 | 4 | `radio` | Radio / publish station | `src/components/ArrangerPanel.jsx:176`, `src/components/DiscoverPage.jsx:20`, `src/components/DiscoverPage.jsx:146` |
| 🎵 | 4 | `music` | Generic music / playlist / CTA / fallback mood | `src/components/ArrangerPanel.jsx:114`, `src/components/DiscoverPage.jsx:56`, `src/components/DiscoverPage.jsx:154`, `src/components/LandingHub.jsx:177` |
| ♪ | 3 | `music-note-small` | Small musical status / quota marker | `src/components/AuthPanel.jsx:131`, `src/components/DiscoverPage.jsx:37`, `src/components/LandingHub.jsx:123` |
| 👥 | 1 | `listeners` | Listener count | `src/components/DiscoverPage.jsx:41` |
| ▶ | 4 | `play` | Play / play count / start arranger | `src/components/ArrangerPanel.jsx:167`, `src/components/DiscoverPage.jsx:64`, `src/components/PlayerDeck.jsx:90`, `src/components/SharedLibraryBrowser.jsx:87` |
| ⏸ | 1 | `pause` | Pause playback | `src/components/PlayerDeck.jsx:90` |
| ⏹ | 1 | `stop` | Stop arranger | `src/components/ArrangerPanel.jsx:167` |
| 🔊 | 1 | `volume-on` | Volume on | `src/components/PlayerDeck.jsx:98` |
| 🔇 | 1 | `volume-muted` | Muted | `src/components/PlayerDeck.jsx:98` |
| ✏️ | 1 | `project-manual-input` | Manual project input | `src/components/ProjectDeck.jsx:10` |
| 📁 | 2 | `project-folder` | Project folder input | `src/components/ProjectDeck.jsx:11`, `src/components/ProjectDeck.jsx:171` |
| 🐙 | 1 | `project-git-repo` | GitHub repository input. Prefer a neutral git/repo icon unless brand use is intentional. | `src/components/ProjectDeck.jsx:12` |
| 🎰 | 1 | `spin-rhythm` | Music wheel spin feature | `src/components/MusicWheel.jsx:315` |
| ✕ | 2 | `close` | Close / delete | `src/components/AuthPanel.jsx:42`, `src/components/AdminPanel.jsx:337` |
| ← | 2 | `back` | Back navigation | `src/components/DiscoverPage.jsx:202`, `src/components/RoomWave.jsx:737` |
| → | 1 | `forward` | Feature-card arrow indicator | `src/components/LandingHub.jsx:83` |
| © | 2 | Keep as text | Copyright mark; not recommended as an icon asset | `src/components/MusicWheel.jsx:558`, `src/components/RoomWave.jsx:1243` |

## Recommended Icon Set

Generate 38 assets:

`home`, `roomwave`, `dj-console`, `mixer`, `discover`, `settings-admin`, `user-login`, `sun`, `moon`, `noon-sun-cloud`, `evening-city`, `mode-brainstorm`, `mode-focus`, `mode-sprint`, `mode-charge`, `mode-behind`, `mode-break`, `mode-celebrate`, `feedback-too-loud`, `feedback-more-drive`, `feedback-skip`, `feedback-like`, `radio`, `music`, `music-note-small`, `listeners`, `play`, `pause`, `stop`, `volume-on`, `volume-muted`, `project-manual-input`, `project-folder`, `project-git-repo`, `spin-rhythm`, `close`, `back`, `forward`.

If you want to reduce the set, `back` and `forward` can become CSS/lucide icons, and `music-note-small` can share the `music` asset at smaller size.

## Lovart Master Prompt

Use this as the global prompt for the whole set:

```text
Create a cohesive custom icon system for a dark neon AI music-coding web app called Vibe Coding Sonic / RoomWave.

Design 38 original icons: home, roomwave, dj-console, mixer, discover, settings-admin, user-login, sun, moon, noon-sun-cloud, evening-city, mode-brainstorm, mode-focus, mode-sprint, mode-charge, mode-behind, mode-break, mode-celebrate, feedback-too-loud, feedback-more-drive, feedback-skip, feedback-like, radio, music, music-note-small, listeners, play, pause, stop, volume-on, volume-muted, project-manual-input, project-folder, project-git-repo, spin-rhythm, close, back, forward.

Visual style: premium neon-glass vector icons, rounded geometric shapes, clean silhouette, subtle depth, dark graphite base, thin luminous rim, soft inner glow, consistent 2.5D front-facing perspective. Use transparent background. Each icon should work at 16px, 24px, 32px, and 48px in a React dashboard.

Palette: graphite #0B0F14, off-white #E8F0FF, neon green #00FF66, cyan #22D3EE, violet #8B5CF6, hot pink #FF2A7A, amber #F59E0B, danger red #EF4444. Use one primary accent and one secondary accent per icon. Keep contrast high on dark UI.

Composition: square 1024x1024 canvas, icon centered, occupies 72-80% of canvas, no outer app tile, no label, no text, no watermark. Maintain consistent stroke weight, corner radius, glow strength, and object scale across the full set.

Important: do not copy Apple, Google, Microsoft, or Twemoji emoji style. Do not create emoji-like faces or stickers. These must be original product icons that preserve the meaning of the current emoji but feel like one designed UI system.

Export individual transparent SVG files if possible, plus transparent PNG previews. Use kebab-case filenames matching the icon names.
```

## Negative Prompt

```text
No emoji rendering, no Apple emoji, no Google emoji, no Twemoji, no sticker style, no mascot, no text, no Chinese characters, no random letters, no white square background, no app launcher tile, no photographic 3D render, no excessive detail, no thin fragile lines, no inconsistent perspective, no cropped glow, no watermark, no mockup frame.
```

## Per-Icon Prompts

Use the master prompt above, then append one of these icon-specific directions:

| Icon | Add-on prompt |
|---|---|
| `home` | A compact home shape built from a roof line and small glowing window, suggesting the dashboard landing page. |
| `roomwave` | A sound wave flowing through a shared room outline, combining wave motion and collaborative space. |
| `dj-console` | A DJ controller with two small decks, knobs, and a central fader, simplified for small UI sizes. |
| `mixer` | Three vertical mixer faders at different levels, with glowing slider caps and minimal tick marks. |
| `discover` | A globe combined with a music radar sweep, suggesting exploration and music discovery. |
| `settings-admin` | A precise gear with a small shield/keyhole detail, suggesting admin controls and configuration. |
| `user-login` | A user silhouette entering through a neon doorway or keyhole, minimal and friendly. |
| `sun` | A clean neon sun disk with short geometric rays, optimized for light-mode toggle and morning greeting. |
| `moon` | A crescent moon with a small circuit-like star, optimized for dark-mode toggle and night greeting. |
| `noon-sun-cloud` | A small sun partly behind a soft cloud, with light cyan rim and warm amber core. |
| `evening-city` | A tiny skyline with a setting neon sun and one audio-wave line across the horizon. |
| `mode-brainstorm` | A lightbulb merged with neural nodes and tiny code sparks, representing idea generation. |
| `mode-focus` | A target reticle enclosing a single glowing note/cursor point, calm and centered. |
| `mode-sprint` | A lightning bolt with a short motion trail and subtle code bracket shape, fast but not chaotic. |
| `mode-charge` | A flame-shaped energy waveform, powerful and upward, with amber-to-pink glow. |
| `mode-behind` | A clock face with a fast-forward tick and urgent amber rim, representing catching up. |
| `mode-break` | A minimal cup with steam forming a soft audio waveform, calm and restorative. |
| `mode-celebrate` | Confetti burst around a glowing music note or small trophy spark, celebratory but clean. |
| `feedback-too-loud` | A speaker with one reduced wave and a small downward limiter mark, meaning reduce loudness. |
| `feedback-more-drive` | A boost button symbol with an upward energy waveform and small spark, meaning add intensity without using a flame emoji shape. |
| `feedback-skip` | A next-track control with a forward bar and motion streak, clear at button size. |
| `feedback-like` | A heart built from two smooth neon strokes with a subtle pulse ring, not emoji-like. |
| `radio` | A broadcast tower or compact radio receiver emitting circular signal waves. |
| `music` | A single eighth note with a waveform tail, suitable for playlist and generic music actions. |
| `music-note-small` | A minimal one-stroke note/dot mark with strong legibility at 12-16px. |
| `listeners` | Two or three abstract user dots connected by a shared audio wave, for listener count. |
| `play` | A triangular play symbol inside a subtle circular glow, strong silhouette. |
| `pause` | Two vertical pause bars with tiny equalizer notches, matching play icon weight. |
| `stop` | A square stop symbol with slightly rounded corners inside a restrained glow. |
| `volume-on` | A speaker cone with two clean sound arcs, cyan-green glow. |
| `volume-muted` | A speaker cone with a diagonal mute slash and no sound arcs, red accent. |
| `project-manual-input` | A stylus or pencil drawing a short code line, representing manual text input. |
| `project-folder` | A folder with a small waveform/file tab, representing project folder upload. |
| `project-git-repo` | A neutral git branch graph inside a repository box; do not use the GitHub Octocat unless brand usage is explicitly required. |
| `spin-rhythm` | A music roulette wheel with a tiny pointer and radial beat segments, energetic nightclub feel. |
| `close` | A clean X made from two rounded neon strokes, balanced for modal close and delete button. |
| `back` | A left arrow with short motion line, same stroke style as navigation icons. |
| `forward` | A right arrow with short motion line, same stroke style as navigation icons. |

## Replacement Notes

- The current code uses different icons for the same mode in different places: `brainstorm` is `💡` and `🧠`; `sprint` is `⚡` and `🏃`; `charge` is `🔥` and `⚡`; `behind` is `⏰` and `🔥`. Replace by semantic mode id, not by literal emoji.
- `🔥` is also used for more-drive feedback and afternoon greeting. Use `feedback-more-drive` for the action button; the afternoon greeting can reuse `mode-charge` unless you want a separate `afternoon-energy` asset.
- For player controls (`play`, `pause`, `stop`, volume, arrows, close), consider using inline SVG or lucide-style React icons instead of raster PNGs so they inherit button color and size.
- Keep `©` as plain text.
