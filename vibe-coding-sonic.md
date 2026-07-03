# Vibe Coding 有歌声 — PRD

> MBTI 黑客松参赛项目 · 2026-07-04~05

**文档版本**：v0.2 · 对齐当前代码实现（DJ 控制台 + 管理后台）

---

## 1. 项目概述

**一句话**：根据团队 MBTI 类型、项目内容与比赛节奏，AI 实时生成个性化背景音乐，让黑客松的每一分钟都有对的氛围。

**核心洞察**：
- 黑客松团队来自不同背景，MBTI 标签贴了但没人真正用起来
- 比赛节奏剧烈切换（破冰→头脑风暴→沉浸开发→冲刺→上台），但氛围是断层的
- 音乐是最直觉的情绪工具，但没人有精力在 coding 的同时 DJ

**产品形态**：
- **DJ 控制台**（`/`）：三 Deck 布局，推子/打击垫/LED 面板交互，零文本块操作感
- **管理后台**（`#/admin`）：API Key 配置、预生成音乐库管理
- Web 单页应用，支持公网/局域网访问

**目标用户**：MBTI 黑客松参赛选手和队伍

**交付原则**：先打通「一首歌从 prompt 到耳朵」，再补 UI 和智能层；任何时刻停手都能 demo。

---

## 2. 实现状态总览

| 模块 | 状态 | 说明 |
|------|------|------|
| MBTI Remix 四轴推子 | ✅ 已实现 | I/E、N/S、T/F、J/P 连续调节 + 16 型快速选择 |
| Style FX 风格推子 | ✅ 已实现 | CHILL↔HYPE、SYNTH↔ACOUSTIC、DARK↔BRIGHT |
| 项目输入（手动/文件夹/GitHub） | ✅ 已实现 | 浏览器选文件夹解析 README；GitHub API 拉仓库 |
| Prompt 四层监视器 | ✅ 已实现 | MBTI / 项目 / 模式 / DJ 微调 |
| TTAPI 音乐生成 + 兜底库 | ✅ 已实现 | 轮询 + fallback-manifest.json |
| 多供应商 LLM + CLI | ✅ 已实现 | 11 种 provider，运行时配置热生效 |
| 管理后台 | ✅ 已实现 | API Key + 音乐库 CRUD |
| Mode Pads + Panic | ✅ 已实现 | 打击垫切换 + 一键 Sprint |
| 音频可视化 + MBTI 主题色 | ✅ 已实现 | AnalyserNode 波形 + 16 型配色 |
| 黑客松日程时间线 | ✅ 已实现 | 展示当前阶段（不自动切模式） |
| 预生成队列（70% 触发） | ⏳ 未实现 | P1 |
| 队伍模式（多人 MBTI 融合） | ⏳ 未实现 | P1 |
| 演示模式自动播放 | ⏳ 未实现 | P1 |
| 12 题 MBTI 测试 | ❌ 砍掉 | P2 |

---

## 3. 核心功能

### 3.1 MBTI Remix 【已实现】

替代原「16 宫格选择器」，升级为 **四轴连续调节**：

| 轴 | 左极 (0) | 右极 (100) | 作用 |
|----|---------|-----------|------|
| ie | I 内向 | E 外向 | 影响内向/外向音乐气质 |
| ns | N 直觉 | S 实感 | 抽象 vs 具象节奏 |
| tf | T 思考 | F 情感 | 结构感 vs 温暖和谐 |
| jp | J 判断 | P 感知 | 稳定推进 vs 即兴流动 |

- 四轴值合成当前 MBTI 类型（如 ie=30, ns=70 → ISTP），LED 大屏实时显示
- 偏离中心 ≥15% 的轴会生成 remix 描述词，进入 Prompt 第四层「DJ 微调」
- 「快速选择」展开 16 宫格，一键定位到典型类型

### 3.2 Style FX 风格推子 【已实现】

专业制作台级别的三条推子，实时影响 BPM 与 prompt：

| 推子 | 左极 | 右极 | 效果 |
|------|------|------|------|
| energy | CHILL | HYPE | BPM ±15，能量感关键词 |
| texture | SYNTH | ACOUSTIC | 电子合成 vs 原声乐器 |
| brightness | DARK | BRIGHT | 暗调氛围 vs 明亮 uplifting |

> 原 PRD 砍掉的「风格微调滑块」已以 DJ 推子形式重新实现，且与 prompt 预览实时联动。

### 3.3 项目内容感知 【已实现】

三种输入方式（Project Input 三 tab）：

| 方式 | 实现 | 数据流 |
|------|------|--------|
| 手动输入 | 项目名 + 描述 + 预设标签 | → LLM / 模板分析 |
| 项目文件夹 | 浏览器 `webkitdirectory` 选文件夹 | 读 README、package.json 等 → 拼接描述 → 分析 |
| GitHub 仓库 | 输入 `github.com/owner/repo` | 后端拉 repo 信息 + README → 分析 |

LLM 不可用时回退到 8 个预设项目类型关键词模板（`project-templates.json`）。

### 3.4 节奏模式 【已实现】

| 模式 | 触发 | 音乐风格 |
|------|------|---------|
| 专注 (Focus) | Mode Pad / 日程 | Lo-fi、环境音、低 BPM |
| 头脑风暴 (Spark) | Mode Pad / 日程 | 欢快、跳跃、中高 BPM |
| 冲刺 (Sprint) | Mode Pad / **Panic 按钮** | 节奏感强、推进感、高 BPM |
| 战鼓 (Charge) | Mode Pad / 日程 | 史诗、鼓点、燃 |

- **Mode Pads**：2×2 打击垫，点击秒切兜底曲目（demo 不赌生成）
- **「我们落后了!」**：红色呼吸灯 Panic 键，一键 Sprint

### 3.5 AI 音乐生成引擎 【已实现】

**生成策略**：四层融合

```
MBTI 底色（四轴合成类型 → 规则映射）
    ↓
+ 项目主题关键词（LLM / 模板 / GitHub / 文件夹）
    ↓
+ 进度状态（Focus / Spark / Sprint / Charge）
    ↓
+ DJ 微调（四轴 remix 描述 + Style FX 关键词）
    ↓
→ 最终 TTAPI Suno prompt
```

**播放能力**：
- TTAPI：`POST /suno/v1/music` → `GET /suno/v2/fetch` 轮询（3s 间隔）
- Howler.js：交叉淡入 2s、loop、音量推子
- 失败/未配置 → `fallback-manifest.json` 兜底曲目

**预生成队列**（P1，未实现）：播放至 70% 触发下一段生成。

### 3.6 Main Deck 播放器 【已实现】

- LED 数码面板：BPM / TYPE / MODE 三块辉光显示
- 旋转黑胶转盘（播放时 spin）
- 波形可视化（AnalyserNode）
- 音量推子 + 静音 + 播放/暂停
- **DROP THE BEAT** 大按钮触发 TTAPI 生成

### 3.7 Prompt Monitor 【已实现】

四层分色高亮：

| 颜色 | 层 | 来源 |
|------|-----|------|
| 蓝 | mbti | MBTI 底色 + 合成类型 |
| 绿 | project | 项目主题关键词 |
| 橙 | mode | 状态模式 + BPM |
| 紫 | console | 四轴 remix + Style FX |

任何推子/输入变化 → 250ms 防抖后实时刷新预览。

### 3.8 管理后台 【已实现】

路由：`#/admin`（Hash 路由，无需额外依赖）

| 功能 | 说明 |
|------|------|
| 系统状态 | TTAPI / LLM 连接状态 LED |
| API 配置 | TTAPI Key、11 种 LLM 供应商按钮、模型覆盖、彩排模式 |
| 音乐库管理 | 按 4 模式分 tab，曲目试听/删除/新增 |

配置保存到 `server/data/runtime-config.json`（gitignore），**优先级高于 .env，立即生效无需重启**。

### 3.9 赛后迭代 【P1/P2】

- 预生成队列（70% 触发下一段）
- 队伍模式（多人 MBTI BPM 均值 + 风格词融合）
- 演示模式自动播放全流程
- 日程到点自动切模式（当前仅高亮，不自动播放）
- 12 题 MBTI 测试、MusicGen 本地生成、进度偏差计算

---

## 4. 技术架构

```
┌──────────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ MBTI Remix  │  │  Main Deck   │  │    Mode Pads        │  │
│  │ + Style FX  │  │  + Visualizer│  │    + Prompt Monitor │  │
│  └─────────────┘  └──────────────┘  └─────────────────────┘  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Project     │  │  Timeline    │  │  Admin Panel        │  │
│  │ Deck        │  │  (hackathon) │  │  (#/admin)          │  │
│  └─────────────┘  └──────────────┘  └─────────────────────┘  │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST API + 3s 轮询
┌──────────────────────────┴───────────────────────────────────┐
│                  Backend (Node.js + Express)                    │
│  ┌──────────┐ ┌──────────────┐ ┌──────────┐ ┌─────────────┐  │
│  │ routes/  │ │ promptComposer│ │ library  │ │ runtime     │  │
│  │ mbti     │ │ (4-layer)    │ │ Store    │ │ Config      │  │
│  │ project  │ └──────┬───────┘ └──────────┘ └─────────────┘  │
│  │ music    │        │                                          │
│  │ config   │ ┌──────┴───────┐ ┌──────────┐                   │
│  │ library  │ │ musicOrch.   │ │ sunoClient│ (TTAPI)          │
│  │ schedule │ └──────────────┘ └──────────┘                   │
│  └──────────┘                                                   │
│  内存 job 状态 + JSON 文件持久化（无数据库）                      │
└──────────────────────────┬───────────────────────────────────────┘
                           │
         ┌─────────────────┴─────────────────┐
         │  TTAPI (Suno)    │  LLM 多供应商    │
         │  TT-API-KEY      │  HTTP / CLI      │
         └───────────────────────────────────┘
```

### 4.1 技术栈

| 层 | 选型 | 说明 |
|----|------|------|
| 前端 | React 18 + Vite + TailwindCSS | DJ 控制台 UI，自定义 fader/pad/LED 样式 |
| 路由 | Hash (`#/admin`) | 控制台与管理后台切换 |
| 音频播放 | Howler.js | 淡入淡出、loop、交叉切换 |
| 音频可视化 | Canvas + AnalyserNode 模拟 | 波形律动条 |
| 后端 | Node.js + Express | 轻量，JSON 文件持久化 |
| 音乐生成 | TTAPI Suno 代理 | `TT-API-KEY`；Suno 无公开 API |
| 音乐兜底 | fallback-manifest.json | 管理后台可增删，支持 URL 或 `/samples/` |
| 运行时配置 | runtime-config.json | 管理后台写入，覆盖 .env |
| LLM | 多供应商 + CLI | 见 §4.3 |
| 部署 | 本地 + 局域网 IP | `npm run build && NODE_ENV=production npm start` 单端口 |

### 4.2 API 设计

```
GET    /api/health                    # 系统健康 + provider 状态

POST   /api/mbti/profile              # MBTI 类型 → 音乐画像
POST   /api/project/analyze           # 项目描述 → 音乐主题关键词
POST   /api/project/analyze-github    # GitHub URL → 拉仓库 + 分析

POST   /api/music/generate            # 生成音乐（支持 axes/style/previewOnly）
GET    /api/music/status/:id          # 轮询生成状态
GET    /api/music/fallback            # 按模式获取兜底曲目

GET    /api/config/providers          # LLM 供应商列表
GET    /api/config/status             # 当前配置状态（密钥打码）
GET    /api/config/keys               # 可读配置项（密钥打码）
POST   /api/config/keys               # 保存配置（热生效）

GET    /api/library                   # 获取兜底音乐库
POST   /api/library                   # 添加曲目 { mode, title, url }
DELETE /api/library/:mode/:id         # 删除曲目

GET    /api/schedule/demo             # 演示日程模板
POST   /api/schedule/sync             # 同步日程 → 当前阶段
```

**`/api/music/generate` 请求体**：

```json
{
  "mbti": "INTJ",
  "axes": { "ie": 12, "ns": 12, "tf": 12, "jp": 12 },
  "mode": "Focus",
  "style": { "energy": 50, "texture": 35, "brightness": 40 },
  "projectAnalysis": { "themes": ["..."], "mood": ["..."], "instruments": ["..."] },
  "previewOnly": true,
  "forceFallback": false
}
```

`mbti` 与 `axes` 二选一；有 `axes` 时以四轴合成类型为准。

### 4.3 LLM 供应商

| LLM_PROVIDER | 类型 | 密钥环境变量 |
|--------------|------|-------------|
| openai | HTTP | OPENAI_API_KEY |
| anthropic | HTTP | ANTHROPIC_API_KEY |
| gemini | HTTP | GEMINI_API_KEY |
| deepseek | HTTP | DEEPSEEK_API_KEY |
| siliconflow | HTTP | SILICONFLOW_API_KEY |
| openrouter | HTTP | OPENROUTER_API_KEY |
| custom | HTTP | LLM_API_KEY + LLM_API_BASE |
| cli-codex | CLI | CODEX_API_KEY（或 codex auth） |
| cli-gemini | CLI | 本机 gemini 登录态 |
| cli-claude | CLI | ANTHROPIC_API_KEY |
| cli-kimi | CLI | KIMI_API_KEY |

配置优先级：`runtime-config.json` > `.env` > 默认值。

---

## 5. MBTI 音乐风格映射表

### 5.1 人格底色

（数据文件：`server/data/mbti-profiles.json`）

| MBTI | 核心特质 | 音乐风格关键词 | BPM 范围 | 推荐流派 |
|------|---------|---------------|---------|---------|
| INTJ | 战略、独立、深邃 | 深沉、电子、极简、架构感 | 90-110 | Dark Ambient, Minimal Techno |
| INTP | 好奇、分析、自由 | 实验、ambient、glitch、探索感 | 80-100 | IDM, Glitch, Experimental |
| ENTJ | 领导、果断、高效 | 史诗、鼓点、推进、力量感 | 120-140 | Cinematic, Epic Orchestral |
| ENTP | 机智、创新、挑战 | 跳跃、电子、funk、碰撞感 | 110-130 | Electro Funk, Future Bass |
| INFJ | 洞察、理想、温暖 | 空灵、钢琴、弦乐、治愈 | 70-90 | Neo-Classical, Ambient Piano |
| INFP | 梦幻、创造、感性 | 民谣、梦幻、自然、诗意 | 80-100 | Dream Pop, Indie Folk |
| ENFJ | 热情、鼓舞、连接 | 明亮、流行、温暖、包容 | 100-120 | Indie Pop, Tropical House |
| ENFP | 活力、乐观、自由 | 欢快、明亮、节奏强、阳光 | 110-130 | Pop, Indie Rock, Funk |
| ISTJ | 可靠、有序、稳重 | 稳定、节奏清晰、工业感 | 90-110 | Lo-fi Hip Hop, Downtempo |
| ISFJ | 温暖、细致、守护 | 柔和、acoustic、田园、温馨 | 70-90 | Acoustic, Folk, Lullaby |
| ESTJ | 高效、组织、务实 | 节奏强、结构清晰、推进感 | 110-130 | House, Tech House, Driving |
| ESFJ | 友善、协作、和谐 | 流行、合唱感、温暖、团体 | 100-120 | Pop, Soul, Motown |
| ISTP | 实用、冷静、灵活 | 冷峻、电子、机械感、精准 | 100-120 | Tech Minimal, Industrial |
| ISFP | 敏感、艺术、自由 | 柔和、电子融合、艺术感 | 80-100 | Lo-fi, Chillhop, Art Pop |
| ESTP | 大胆、行动、刺激 | 高能、电子、bass、肾上腺素 | 120-140 | EDM, Drum & Bass, Trap |
| ESFP | 热情、表演、享受 | 流行、舞曲、拉丁、派对感 | 110-130 | Dance Pop, Reggaeton, Latin |

### 5.2 四轴 Remix 描述词

（`promptComposer.js` → `AXIS_DESCRIPTORS`）

| 轴 | 偏左 (0-49) | 偏右 (50-100) |
|----|------------|--------------|
| ie | introspective inward-focused depth | outgoing expressive stage energy |
| ns | abstract visionary soundscapes | grounded tactile rhythmic detail |
| tf | precise architectural structure | warm emotive harmonies |
| jp | organized steady progression | improvised fluid transitions |

偏离中心 <15% 的轴不产生描述词。

### 5.3 状态模式修正

| 模式 | BPM 修正 | 风格修正 |
|------|---------|---------|
| Focus | -10 | 更 ambient，减少节奏元素 |
| Spark | +5 | 增加跳跃感和变化 |
| Sprint | +20 | 增加鼓点和推进感 |
| Charge | +15 | 史诗化、鼓点加强 |

### 5.4 Style FX 修正

| 推子 | 偏左 | 偏右 | BPM 影响 |
|------|------|------|---------|
| energy ≤35 | calm relaxed feel | — | -7.5 |
| energy ≥65 | high energy drive | — | +7.5 |
| texture ≤35 | synthetic electronic textures | — | — |
| texture ≥65 | organic acoustic instrumentation | — | — |
| brightness ≤35 | dark moody atmosphere | — | — |
| brightness ≥65 | bright uplifting tone | — | — |

---

## 6. Suno Prompt 模板

### 6.1 构造规则

```
[MBTI promptBase] + [模式修饰] + [项目主题] + [DJ 微调] + [BPM] + [质量后缀]
```

### 6.2 响应结构（四层）

```json
{
  "fullPrompt": "...",
  "layers": {
    "mbti": "dark ambient minimal techno, deep, electronic, minimal, architectural",
    "project": "competitive, strategic, retro pixel",
    "mode": "ambient concentration, reduced percussion, 90 BPM",
    "console": "introspective inward-focused depth, synthetic electronic textures, dark moody atmosphere"
  },
  "bpm": 90,
  "mbti": "INTJ",
  "mode": "Focus"
}
```

### 6.3 Negative Tags

所有生成默认添加：
> "no vocals, no lyrics, no speech, no singing"

---

## 7. 日程与模式切换

### 7.1 日程模型

（`server/data/demo-schedule.json`，底部横向 Timeline 展示）

| 阶段 | 时间 | 模式 |
|------|------|------|
| 签到破冰 | 10:00–10:30 | Spark |
| 选题分工 | 11:00–12:00 | Spark |
| 沉浸开发 | 13:00–18:00 | Focus |
| MBTI 派对 | 19:00–21:00 | Spark |
| 夜间冲刺 | 22:00–06:00 | Sprint |
| 最终冲刺 | 08:00–11:00 | Sprint |
| Demo 准备 | 11:00–14:00 | Charge |
| 上台演示 | 14:00–15:00 | Charge |

### 7.2 模式切换

- **Mode Pad（已实现）**：点击切换 + 秒切兜底曲目
- **Panic 按钮（已实现）**：一键 Sprint
- **日程高亮（已实现）**：每分钟同步当前阶段，仅 UI 高亮
- **日程自动切模式（未实现）**：P1

---

## 8. 目录结构

```
vibe-coding-sonic/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── index.html
├── .env.example
├── README.md
├── vibe-coding-sonic.md          # 本 PRD
│
├── src/
│   ├── main.jsx
│   ├── App.jsx                   # Hash 路由：控制台 / 管理后台
│   ├── components/
│   │   ├── MBTIRemixDeck.jsx     # 四轴 Remix 推子 + 16 型快选
│   │   ├── StyleFaders.jsx       # Style FX 三条推子
│   │   ├── ModePads.jsx          # 2×2 模式打击垫 + Panic
│   │   ├── PlayerDeck.jsx        # Main Deck：LED + 转盘 + 生成键
│   │   ├── ProjectDeck.jsx       # 项目输入三 tab
│   │   ├── PromptCard.jsx        # Prompt Monitor 四层
│   │   ├── AudioVisualizer.jsx   # 波形可视化
│   │   ├── Timeline.jsx          # 黑客松日程横条
│   │   └── AdminPanel.jsx        # 管理后台
│   ├── hooks/
│   │   └── usePlayer.js          # Howler 封装 + 轮询
│   ├── lib/
│   │   ├── mbti.js               # 类型/主题色/四轴工具
│   │   └── api.js                # 后端 API 客户端
│   └── styles/
│       └── index.css             # fader / pad / LED 样式
│
├── server/
│   ├── index.js
│   ├── config/
│   │   ├── providers.js          # LLM/TTAPI 供应商预设
│   │   └── runtimeConfig.js      # 运行时配置读写
│   ├── routes/
│   │   ├── mbti.js
│   │   ├── project.js            # analyze + analyze-github
│   │   ├── music.js
│   │   ├── config.js             # keys / providers / status
│   │   ├── library.js            # 音乐库 CRUD
│   │   └── schedule.js
│   ├── services/
│   │   ├── sunoClient.js         # TTAPI 封装
│   │   ├── musicOrchestrator.js  # 生成任务 + 兜底
│   │   ├── libraryStore.js       # fallback-manifest 读写
│   │   ├── promptComposer.js     # 四层 prompt 融合
│   │   ├── llmClient.js          # re-export
│   │   └── llm/
│   │       ├── index.js
│   │       ├── httpProviders.js  # OpenAI/Anthropic/Gemini
│   │       └── cliProvider.js    # Codex/Gemini/Claude/Kimi CLI
│   └── data/
│       ├── mbti-profiles.json
│       ├── project-templates.json
│       ├── demo-schedule.json
│       ├── fallback-manifest.json    # 兜底曲目（可 git 提交）
│       └── runtime-config.json     # 管理后台配置（gitignore）
│
└── public/
    └── samples/                  # 可选：本地 MP3 文件
```

---

## 9. 环境配置

### 9.1 两种方式（优先级：管理后台 > .env）

**方式 A — 管理后台（推荐现场）**
1. 打开 http://localhost:5173/#/admin
2. 填入 TTAPI Key、选择 LLM 供应商、保存
3. 立即生效，无需重启

**方式 B — .env 文件**
```bash
cp .env.example .env
# 编辑 TTAPI_KEY、LLM_PROVIDER、对应 API Key
```

### 9.2 赛前 checklist

| # | 任务 | 验收 |
|---|------|------|
| 1 | TTAPI 全流程 | prompt → jobId → fetch → audioUrl |
| 2 | 兜底曲库 | 管理后台添加 4 模式 × 3+ 首，或更新 fallback-manifest.json |
| 3 | LLM 验证 | 项目分析返回稳定 JSON |
| 4 | Demo 彩排 | `USE_FALLBACK_ONLY=true`，模式切换秒切不卡顿 |

---

## 10. 风险与兜底

| 风险 | 兜底 |
|------|------|
| TTAPI 不可用 | fallback-manifest.json 兜底曲目 |
| 生成太慢 | 上台用预生成秒切；开场后台发起真实生成作彩蛋 |
| LLM 不可用 | 8 个关键词模板自动匹配 |
| 现场网络差 | 本地后端 + 局域网；兜底曲全本地 `/samples/` |
| API Key 忘带 | 管理后台现场填入，热生效 |

---

## 11. Demo 脚本（3 分钟）

### 11.1 Meta 叙事

比赛 24 小时全程用本产品放 BGM →「过去 24 小时，我们的背景音乐就是它放的。」

### 11.2 演示流程（90s）

1. **MBTI Remix**：拖 I↔E 推子，LED 屏 INTJ→ENTJ，配色渐变，Prompt 蓝层变化
2. **项目**：点预设「足球经理游戏」或粘贴 GitHub 链接
3. **Style FX**：推 HYPE 到 80，BPM 跳动，紫层出现 "high energy drive"
4. **DROP THE BEAT**：播放 Focus 曲目
5. **对比**：快速选 ENFP + 同一项目 → 秒切 → 风格反差
6. **Panic**：点「我们落后了!」→ Sprint 垫 → 节奏加快

### 11.3 杀手锏瞬间

> 拖着 I/E 推子从一端滑到另一端，指着 Prompt Monitor 说：「看，四层 prompt 实时变了——这就是你团队的 MBTI 声音。」

---

## 12. 差异化

| 维度 | 普通 BGM | Vibe Coding 有歌声 |
|------|---------|-------------------|
| 交互 | 歌单点选 | DJ 推子 + 打击垫，零表单感 |
| 人格 | 无 | MBTI 四轴连续 remix，非四选一 |
| 项目感知 | 无 | 手动 / 文件夹 / GitHub 三通道 |
| 风格控制 | 固定 | Style FX 实时影响 prompt + BPM |
| 可解释性 | 黑盒 | 四层 Prompt Monitor 所见即所得 |
| 配置 | 改代码 | 管理后台热配置 API Key + 曲库 |
| 生成 | 预录 | TTAPI 实时生成 + 兜底库双保险 |
