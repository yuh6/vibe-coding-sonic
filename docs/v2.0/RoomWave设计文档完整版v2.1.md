# RoomWave 设计文档 v1.0

> MBTI 人格 AI 音乐生成器 + 音乐库 + 双模式 Web DJ 控制台
> 整合原版 v0.1 + 设计评审补充 + MBTI 生成器升级设计

---

## 1. 项目定位

RoomWave 是一个结合 MBTI 人格类型、AI 音乐生成、音乐库管理、播放列表管理与 Web DJ 控制台的音乐产品。

它不是普通播放器，也不是单纯的 AI 音乐生成器，而是一个以"人格"为创作入口、以"音乐资产库"为核心、以"双模式播放器"为交互形态的 AI 音乐系统。

**核心定位**：用户选择或测试自己的 MBTI 类型，系统将人格特征转译成 Music DNA 音乐参数，再通过 TTAPI / Suno 等 AI 音乐生成服务生成音乐，并进入音乐库、人格歌单、DJ 素材箱与 DJ Set 编排系统。

## 2. 产品核心概念

RoomWave 的核心不是"输入一句 prompt 生成一首歌"，而是建立一套完整链路：

```
MBTI 人格类型（可调四维滑块 + AI 对话微调）
    ↓
人格音乐画像 Type Profile
    ↓
Music DNA 音乐基因
    ↓
Prompt Compiler 提示词编译器（三层结构）
    ↓
TTAPI / Suno / 其他 AI 音乐服务
    ↓
Track / Stem / Loop
    ↓
音乐库 / 人格歌单 / DJ Crate / DJ Set / Deck
```

**核心判断**：MBTI 不应该直接等于音乐风格，而应该作为"人格语义层"；真正驱动音乐生成的是 Music DNA。

## 3. 产品目标

### 3.1 普通用户目标

- 选择 MBTI 类型生成音乐
- 根据人格、心情、场景生成歌单
- 收藏、播放、分享人格音乐
- 管理自己的 AI 生成音乐库
- 根据已有音乐生成相似版本
- 获得类似 Spotify 的轻量播放器体验

### 3.2 进阶用户目标

- 管理不同人格类型的音乐资产
- 按 BPM、Mood、Energy、Vocal、Genre、MBTI 筛选音乐
- 将人格歌单转为 DJ 素材箱
- 使用智能歌单自动整理 AI 生成音乐
- 对同一首音乐进行版本管理

### 3.3 DJ 用户目标

- 切换到 DJ 模式
- 使用 Deck A / Deck B 双播放器
- 使用 Crossfader、Volume、EQ、Filter 等混音控件
- 从 DJ Crate 中拖拽素材到 Deck
- 编排人格 DJ Set
- 使用 Cue、Loop、Stem、Transition 控制音乐
- 根据 MBTI 认知功能设计人格能量曲线

## 4. 产品模式设计

RoomWave 采用**模式切换**设计：

- **普通模式 Listener Mode** — 面向听歌、生成、收藏、歌单管理
- **DJ 模式 DJ Mode** — 面向选素材、混音、编排、表演

两种模式共用同一套音乐资产库，但使用完全不同的前端面板。

### 4.1 普通模式 Listener Mode

核心体验：**我选择 MBTI 类型 → 生成音乐 → 加入人格歌单 → 播放 / 收藏 / 分享**

主要功能：

- MBTI 音乐生成
- 人格歌单
- 最近生成
- 收藏
- 音乐库
- 当前播放
- 播放队列
- 相似音乐生成
- Prompt 反查与再生成

普通模式更接近 Spotify / Apple Music 的体验。

### 4.2 DJ 模式 DJ Mode

核心体验：**我从人格素材箱选择音乐 → 拖到 Deck A/B → 混音 → 编排 DJ Set**

主要功能：

- Deck A / Deck B
- Waveform
- Cue 点
- Loop
- Stem 开关
- Mixer
- Crossfader
- DJ Crate
- Track Browser
- Set Builder
- Energy Curve
- Transition Plan

DJ 模式更接近 Serato / Rekordbox / VirtualDJ 的体验，但需要降低专业门槛。

## 5. 信息架构

### 5.1 顶层结构

```
RoomWave
├── 普通模式 Listener Mode
│   ├── 首页
│   ├── MBTI 生成器
│   ├── 音乐库
│   ├── 人格歌单
│   ├── 最近生成
│   ├── 收藏
│   ├── 当前播放
│   └── 播放队列
│
└── DJ 模式 DJ Mode
    ├── Deck A
    ├── Deck B
    ├── Mixer
    ├── DJ Crate
    ├── Track Browser
    ├── Set Builder
    ├── Waveform
    ├── Cue / Loop
    └── Stem / Transition 控制
```

## 6. 核心对象关系

RoomWave 不应该只设计"歌曲"和"播放列表"，而应该设计成音乐资产系统。

```
Music Library 音乐资产库
├── Track 完整歌曲
├── Stem 分轨
├── Loop 循环片段
├── Prompt 生成提示词
├── Music DNA 音乐基因
├── MBTI Type Profile 人格画像
├── Playlist 人格歌单
├── Crate DJ 素材箱
├── Set DJ 演出编排
├── Queue 当前播放队列
└── DeckState DJ 播放状态
```

## 7. 播放列表体系设计

RoomWave 采用三级结构：

```
Persona Playlist 人格歌单
    ↓
DJ Crate DJ 素材箱
    ↓
DJ Set 人格演出编排
```

再加上临时播放状态：**Queue 当前播放队列**

### 7.1 Persona Playlist：人格歌单

面向普通用户。用途：听歌、收藏、分享、人格音乐合集、自动生成相似音乐、根据 MBTI 和场景组织音乐。

示例：
- INTJ 深夜专注
- INFP 雨天独白
- ENTP 混乱灵感
- ESFP 派对高能
- INFJ 神秘电影感

### 7.2 DJ Crate：DJ 素材箱

面向 DJ 模式。用途：快速选素材、按用途组织音乐、按 BPM / Key / Energy / MBTI 筛选、拖拽到 Deck、为 DJ Set 准备素材。

示例：
- INTJ / Ni Intro
- INTJ / Te Build
- ENTP / Ne Glitch
- INFP / Fi Vocal
- ESFP / Se Peak
- Transition Loops
- Emergency Tracks

Crate 不是为了顺序播放，而是为了表演准备。

### 7.3 DJ Set：人格演出编排

面向完整演出结构。用途：编排播放顺序、管理能量曲线、设置转场方式、设置 Cue In / Cue Out、分配 Deck A / Deck B、设计人格叙事。

示例 — INTJ Strategic Night Set：

```
1. Ni Intro       冷感氛围铺底
2. Te Build       工业节奏推进
3. Ni/Te Peak     冷峻高能爆发
4. Fi Shadow      情绪暗面释放
5. Se Release     低频身体冲击
6. Outro          回到冷静空间
```

### 7.4 Queue：当前播放队列

Queue 是当前播放行为的临时状态，不应该污染 Playlist / Crate / Set。用途：当前播放、接下来播放、临时插入、跳过、随机、循环、播放历史。

## 8. MBTI 到 Music DNA 的映射

MBTI 不能直接映射为固定风格，而应该转译为音乐参数。

### 8.1 四个维度映射

**E / I：外放程度与空间感**

| 维度 | 音乐倾向 | 参数 |
|------|---------|------|
| E 外倾 | 外放、社交、明亮、强律动 | 高 Energy、强鼓组、清晰 Hook |
| I 内倾 | 沉浸、私密、空间化、细腻 | Ambient、Lo-fi、低密度编曲、更多 Reverb |

**S / N：具象感与抽象感**

| 维度 | 音乐倾向 | 参数 |
|------|---------|------|
| S 实感 | 真实乐器、稳定节奏、生活感歌词 | Acoustic、Rock、Pop、清晰结构 |
| N 直觉 | 概念、未来感、实验感、隐喻歌词 | Synth、Ambient、Experimental、复杂变化 |

**T / F：情感表达方式**

| 维度 | 音乐倾向 | 参数 |
|------|---------|------|
| T 思考 | 冷感、结构化、机械感、技术感 | Minimal Techno、IDM、Synthwave |
| F 情感 | 温暖、共情、叙事、人声情绪明显 | Indie Pop、R&B、Dream Pop、Folk |

**J / P：结构秩序与变化程度**

| 维度 | 音乐倾向 | 参数 |
|------|---------|------|
| J 判断 | 结构清晰、段落明确、完成感强 | Intro-Verse-Chorus-Bridge-Chorus |
| P 感知 | 自由变化、Jam 感、即兴、非线性 | Loop-based、Improvisational、Evolving |

## 9. 16 型人格音乐预设

| MBTI | 人格定位 | 推荐风格 | 声音关键词 |
|------|---------|---------|-----------|
| INTJ | 冷静战略家 | Dark Synthwave / Minimal Techno | 精密、冷感、未来、压迫 |
| INTP | 抽象实验者 | IDM / Glitch / Ambient Techno | 非线性、算法感、碎片 |
| ENTJ | 指挥型推进者 | Industrial Techno / Epic Electronic | 强势、推进、领袖感 |
| ENTP | 混乱发明家 | Electro Punk / Glitch Pop | 跳跃、反转、讽刺 |
| INFJ | 神秘叙事者 | Dream Pop / Cinematic Ambient | 深层、隐喻、神圣 |
| INFP | 私密诗人 | Indie Folk / Bedroom Pop | 柔软、孤独、想象 |
| ENFJ | 共鸣召集者 | Anthem Pop / Uplifting House | 温暖、群体、上升 |
| ENFP | 灵感漫游者 | Indie Pop / Nu Disco | 多彩、自由、爆发 |
| ISTJ | 秩序守护者 | Classic Rock / Clean Pop | 稳定、规整、可靠 |
| ISFJ | 温柔照护者 | Acoustic Pop / Soft R&B | 温暖、怀旧、安全感 |
| ESTJ | 执行型节奏 | Big Beat / Driving House | 明确、硬朗、行动 |
| ESFJ | 社交治愈者 | Dance Pop / Funk Pop | 明亮、亲和、合唱 |
| ISTP | 冷面技师 | Blues Rock / Minimal Bass | 低调、锋利、机械 |
| ISFP | 感官艺术家 | Neo Soul / Chillwave | 细腻、色彩、身体感 |
| ESTP | 现场玩家 | EDM / Trap / Breakbeat | 冲击、速度、危险 |
| ESFP | 派对表演者 | Dance Pop / Disco / House | 明亮、舞台、释放 |

## 10. 认知功能与 DJ 编排

RoomWave 使用 8 种认知功能作为 DJ Set 的编排语言。

| 功能 | 音乐转译 | DJ 角色 |
|------|---------|---------|
| Ni | 深层、预言感、神秘氛围、长线推进 | Intro / Deep Build |
| Ne | 跳跃、多变、意外转折、拼贴感 | Glitch / Surprise Drop |
| Si | 怀旧、稳定、复古、熟悉质感 | Warm Intro / Memory Loop |
| Se | 冲击、现场感、低频、身体律动 | Peak / Release |
| Ti | 精密结构、复杂节奏、数学感 | Technical Build |
| Te | 推进、效率、硬朗、工业感 | Main Drive / Build |
| Fi | 私密、真诚、情绪独白 | Emotional Break / Shadow |
| Fe | 合唱、共鸣、群体情绪 | Crowd Moment / Anthem |

**示例 — INTJ DJ Set**：Ni Intro → Te Build → Ni/Te Peak → Fi Shadow → Se Release

普通模式里，MBTI 是一种听感标签。DJ 模式里，认知功能是演出结构。

## 11. 人格混合功能

人格混合是 RoomWave 最适合传播的功能之一。

示例：
- INTJ 70% + ENFP 30%
- INFP + ENTJ
- 我和伴侣的人格混音
- 老板 ENTJ + 员工 INFP 的职场战歌

三种混合方式：

| 模式 | 效果 |
|------|------|
| Merge 融合 | 两种人格混合成统一音乐风格 |
| Contrast 对撞 | 主歌一种人格，副歌另一种人格 |
| Dialogue 对话 | 两种音色或两个人声互相回应 |

数据结构：

```ts
type MBTIBlend = {
  primaryType: string
  secondaryType?: string
  ratio: {
    primary: number
    secondary?: number
  }
  conflictMode: 'merge' | 'contrast' | 'dialogue'
}
```

## 12. 核心数据模型

### 12.1 Track

```ts
type Track = {
  id: string
  title: string
  artistName?: string
  albumName?: string
  durationMs: number

  sourceType: 'local' | 'stream' | 'ai_generated' | 'imported'
  sourceProvider?: 'suno' | 'ttapi' | 'udio' | 'local' | 'custom'
  sourceRefId?: string

  audioUrl: string
  coverUrl?: string
  waveformUrl?: string

  // 存储相关（补充）
  storageType: 'local' | 's3' | 'r2' | 'oss'
  localPath?: string
  format: 'mp3' | 'wav' | 'm4a' | 'flac' | 'ogg'
  sampleRate?: number
  bitDepth?: number
  bitRate?: number
  fileSize?: number

  mbtiType?: string
  musicDNAId?: string
  generationPrompt?: string
  generationParams?: Record<string, any>

  bpm?: number
  key?: string
  genre?: string[]
  mood?: string[]
  energy?: number
  vocalType?: 'none' | 'male' | 'female' | 'mixed' | 'choir' | 'unknown'

  // 播放统计（补充）
  playCount: number
  lastPlayedAt?: string
  totalPlayDurationMs: number

  // 版本控制（补充）
  versionGroupId?: string
  versionIndex?: number

  // 音频分析（补充）
  analyzedAt?: string
  timeSignature?: string
  loudness?: number

  status: 'ready' | 'processing' | 'failed' | 'archived'

  createdAt: string
  updatedAt: string
}
```

### 12.2 MusicDNA

```ts
type MusicDNA = {
  id: string
  sourceMBTI: string

  genre: string[]
  mood: string[]
  bpm: number
  energy: number

  vocal: {
    enabled: boolean
    type?: 'male' | 'female' | 'mixed'
    emotion?: 'restrained' | 'expressive' | 'dramatic' | 'calm'
    language?: string
  }

  instruments: string[]

  rhythm: {
    groove: 'straight' | 'swing' | 'syncopated' | 'broken'
    intensity: number
  }

  structure: {
    form: 'pop' | 'cinematic' | 'loop' | 'progressive' | 'experimental'
    sections: string[]
  }

  soundDesign: {
    texture: string[]
    space: 'dry' | 'wide' | 'immersive' | 'intimate'
    brightness: number
  }

  lyricConcept?: {
    perspective: 'first_person' | 'second_person' | 'third_person' | 'mythic'
    imagery: string[]
    theme: string[]
  }
}
```

### 12.3 AITrackMeta

```ts
type AITrackMeta = {
  trackId: string
  prompt: string
  negativePrompt?: string

  genre?: string[]
  mood?: string[]
  bpm?: number
  vocal?: string
  instruments?: string[]
  structure?: string

  modelProvider: 'suno' | 'udio' | 'ttapi' | 'custom'
  modelVersion?: string
  generationTaskId?: string

  parentTrackId?: string
  versionGroupId?: string

  seed?: string
  params?: Record<string, any>

  generationStatus: 'queued' | 'generating' | 'completed' | 'failed'
}
```

### 12.4 Stem

```ts
type Stem = {
  id: string
  trackId: string

  type: 'vocal' | 'drums' | 'bass' | 'melody' | 'harmony' | 'fx' | 'other'
  audioUrl: string
  durationMs: number

  volume: number
  muted: boolean
  solo: boolean

  createdAt: string
}
```

### 12.5 Loop

```ts
type Loop = {
  id: string
  trackId: string

  startAtMs: number
  endAtMs: number
  bars?: number

  bpm?: number
  key?: string

  role: 'intro' | 'build' | 'drop' | 'transition' | 'outro' | 'drum' | 'bass' | 'vocal'

  audioUrl?: string
  createdAt: string
}
```

### 12.6 Playlist

```ts
type Playlist = {
  id: string
  name: string
  description?: string
  coverUrl?: string

  type: 'manual' | 'smart' | 'mbti' | 'ai_generated' | 'dj_crate'

  mbtiType?: string
  mbtiBlend?: Record<string, number>

  scene?: 'focus' | 'sleep' | 'party' | 'workout' | 'writing' | 'game'

  visibility: 'private' | 'public' | 'unlisted'

  ownerId: string
  collaborative: boolean

  sortMode: 'custom' | 'added_at' | 'title' | 'bpm' | 'energy' | 'recently_played'
  snapshotId: string

  // 智能歌单（补充）
  rules?: SmartPlaylistRule[]
  maxTracks?: number
  autoRefresh?: boolean

  // 统计（补充）
  totalDurationMs: number
  trackCount: number
  lastPlayedAt?: string

  // 封面（补充）
  coverMode: 'auto' | 'custom' | 'first_track'

  createdAt: string
  updatedAt: string
}
```

### 12.7 PlaylistItem

```ts
type PlaylistItem = {
  id: string
  playlistId: string

  itemType: 'track' | 'stem' | 'loop' | 'set_marker'
  itemId: string

  position: number
  addedBy: string
  addedAt: string

  note?: string
  transitionHint?: 'cut' | 'fade' | 'beatmatch' | 'echo_out' | 'loop_in'

  startAtMs?: number
  endAtMs?: number
}
```

### 12.8 DJSet

```ts
type DJSet = {
  id: string
  name: string

  theme: string
  mbtiArc?: string[]
  scene?: string

  targetDurationMin?: number
  bpmCurve?: number[]
  energyCurve?: number[]

  items: DJSetItem[]

  createdAt: string
  updatedAt: string
}
```

### 12.9 DJSetItem

```ts
type DJSetItem = {
  id: string
  djSetId: string
  trackId: string

  position: number
  deck?: 'A' | 'B'

  role: 'intro' | 'build' | 'peak' | 'transition' | 'reset' | 'outro'

  cognitiveFunction?: 'Ni' | 'Ne' | 'Si' | 'Se' | 'Ti' | 'Te' | 'Fi' | 'Fe'

  startAtMs?: number
  endAtMs?: number

  cueInMs?: number
  cueOutMs?: number
  loopStartMs?: number
  loopEndMs?: number

  transitionToNext?: 'cut' | 'fade' | 'beatmatch' | 'echo_out' | 'filter_sweep' | 'loop_roll'

  energyStage: 1 | 2 | 3 | 4 | 5
}
```

### 12.10 VersionGroup（补充）

```ts
type VersionGroup = {
  id: string
  rootTrackId: string
  name: string
  createdAt: string
}

type VersionEdge = {
  id: string
  fromTrackId: string
  toTrackId: string
  operation: 'regenerate' | 'extend' | 'modify_prompt' | 'remove_vocal' |
             'add_drums' | 'stem_separate' | 'bpm_change' | 'style_change'
  params?: Record<string, any>
  createdAt: string
}
```

### 12.11 SmartPlaylistRule（补充）

```ts
type SmartPlaylistRule = {
  field: 'mbti' | 'genre' | 'mood' | 'bpm' | 'energy' | 'vocal' |
         'createdAt' | 'playCount' | 'lastPlayed' | 'tag' | 'sourceProvider'
  operator: 'equals' | 'contains' | 'range' | 'in' | 'not_in' |
            'greater_than' | 'less_than' | 'before' | 'after'
  value: string | number | string[] | [number, number]
  logic: 'and' | 'or'
}
```

### 12.12 Tag（补充）

```ts
type Tag = {
  id: string
  name: string
  type: 'system' | 'user' | 'ai_generated'
  color?: string
  usageCount: number
  createdAt: string
}

type TrackTag = {
  trackId: string
  tagId: string
  addedBy: 'system' | 'user' | 'ai'
  addedAt: string
}
```

### 12.13 Favorite & PlayHistory（补充）

```ts
type Favorite = {
  id: string
  userId: string
  trackId: string
  createdAt: string
}

type PlayHistory = {
  id: string
  userId: string
  trackId: string
  playedAt: string
  durationPlayedMs: number
  completed: boolean
  source: 'playlist' | 'queue' | 'direct' | 'dj_deck' | 'recommendation'
}
```

### 12.14 UserPlaySession（补充）

```ts
type UserPlaySession = {
  id: string
  userId: string
  currentTrackId: string
  currentTimeMs: number
  queue: Array<{ trackId: string }>
  queueIndex: number
  volume: number
  repeatMode: string
  shuffleMode: boolean
  updatedAt: string
  deviceId: string
}
```

## 13. Prompt Compiler 设计

RoomWave 不应该让前端直接拼接 prompt，而应该有专门的 Prompt Compiler。

输入：

```json
{
  "mbti": "INTJ",
  "scene": "深夜写代码",
  "duration": "2 minutes",
  "vocal": false,
  "styleStrength": 0.8,
  "energy": 0.65
}
```

生成 Music DNA：

```json
{
  "genre": ["dark synthwave", "minimal techno", "cinematic electronic"],
  "mood": ["focused", "cold", "futuristic", "strategic"],
  "bpm": 118,
  "energy": 0.65,
  "vocal": { "enabled": false },
  "instruments": [
    "analog synth bass",
    "tight electronic drums",
    "cold pads",
    "arpeggiator"
  ],
  "structure": {
    "form": "progressive",
    "sections": ["intro", "build", "main groove", "variation", "outro"]
  },
  "soundDesign": {
    "texture": ["dark", "precise", "wide", "metallic"],
    "space": "immersive"
  }
}
```

编译为 TTAPI / Suno prompt：

```
Dark synthwave and minimal techno instrumental for an INTJ-like strategic mood.
118 BPM, cold futuristic atmosphere, precise electronic drums, analog synth bass,
subtle arpeggiators, wide cinematic pads, focused late-night coding energy.
Structured but progressive arrangement: intro, build, main groove, variation, outro.
No vocals, no cheesy EDM drop, no happy pop melody.
```

### 13.1 三层 Prompt Compiler 结构（MBTI 生成器升级）

| 层 | 来源 | 职责 |
|----|------|------|
| Personality Layer 人格层 | MBTI 主型 + 四维滑块 + 人格混合 + 认知功能权重 | 控制"谁在做音乐" |
| Music Control Layer 音乐控制层 | BPM + Genre + Mood + Energy + Vocal + Instruments + Structure + Scene | 控制"做什么音乐" |
| Conversation Patch Layer 对话修正层 | 用户自然语言微调（"更冷一点""不要太商业"） | 控制"微调方向" |

### 13.2 Suno V5 生成参数最佳实践

**Prompt 优先级顺序**：Genre → Sub-genre → Instruments → Mood → Tempo → Vocal → Production

**关键约束**：
- Style 字段中使用否定词（"no drums"）效果差，负面内容放 Exclude 字段
- 大写字母略增权重，可用于强调关键词
- 200 字符硬截断，关键信息放前 120 字符
- Exclude 字段专门放负面标签

## 14. 普通模式前端设计

### 14.1 普通模式布局

```
┌────────────────────────────────────────────┐
│ 顶部栏：RoomWave / 模式切换 / 搜索 / 用户   │
├──────────────┬─────────────────────────────┤
│ 左侧导航      │ 主内容区                     │
│              │                             │
│ 首页          │ MBTI 生成器                  │
│ 音乐库        │ 人格歌单                     │
│ 最近生成      │ 推荐歌曲                     │
│ 我的歌单      │ 最近播放                     │
│ 收藏          │                             │
│ 16型人格      │                             │
├──────────────┴─────────────────────────────┤
│ 底部播放器：封面 / 进度 / 播放控制 / 队列   │
└────────────────────────────────────────────┘
```

### 14.2 普通模式主要面板

**首页模块**：最近生成、最近播放、人格推荐、收藏、未整理、高能量、适合混音、失败任务。

**MBTI 生成面板字段**：MBTI 类型、场景、BPM、Genre、Mood、Vocal、Instruments、Structure、Energy、人格强度、抽象程度、情绪温度、结构感、是否生成歌词、是否生成封面。

**操作**：生成音乐、生成相似版本、生成反人格版本、生成人格混合版本、加入人格歌单、进入 DJ 模式。

**人格歌单面板功能**：播放、收藏、分享、排序、搜索、AI 补全、生成相似音乐、转为 DJ Crate、转为 DJ Set。

**音乐库面板普通模式显示字段**：封面、标题、MBTI、场景、Mood、BPM、时长、收藏、更多操作。

**高级字段可折叠**：Prompt、Model、生成时间、Stem 状态、Waveform、Drop 位置、播放次数。

## 15. DJ 模式前端设计

### 15.1 DJ 模式布局

```
┌──────────────────────────────────────────────┐
│ 顶部栏：DJ Mode / BPM Sync / Rec / Set Name   │
├──────────────────────┬───────────────────────┤
│ Deck A               │ Deck B                │
│ Waveform             │ Waveform              │
│ Cue / Loop / Stem     │ Cue / Loop / Stem      │
├──────────────────────┴───────────────────────┤
│ Mixer：EQ / Filter / Volume / Crossfader      │
├──────────────┬───────────────────────────────┤
│ 左侧 Crate    │ Track Browser / Set Builder   │
│              │                               │
│ INTJ Crate    │ 可拖拽曲目列表                 │
│ Drop 素材     │ 当前 Set 编排                  │
│ Loop 素材     │ Energy Curve                   │
│ Transition    │                               │
└──────────────┴───────────────────────────────┘
```

### 15.2 Deck A / Deck B

每个 Deck 显示：歌曲标题、MBTI 类型、认知功能、BPM、Key、Energy、Waveform、播放/暂停、Cue、Loop、Sync、Stem 开关。

### 15.3 Mixer 面板

MVP 版本：Deck A Volume、Deck B Volume、Crossfader、Master Volume。

进阶版本：Gain、EQ High、EQ Mid、EQ Low、Filter、FX、Limiter、Recorder。

### 15.4 DJ Crate 面板

Crate 分类：Intro、Build、Peak、Drop、Transition、Outro、Loop、Stem、Emergency。

人格分类：INTJ / Ni Intro、INTJ / Te Build、INFP / Fi Vocal、ENTP / Ne Glitch、ESFP / Se Peak。

### 15.5 Track Browser

DJ 模式显示字段：标题、MBTI、认知功能、BPM、Key、Energy、Role、Duration、Vocal、Stem、Loopable、Cue。

### 15.6 Set Builder

Set Builder 显示：Set 名称、人格叙事、曲目顺序、Deck 分配、Cue In / Cue Out、转场方式、Energy Curve、BPM Curve、认知功能结构。

## 16. 模式切换状态设计

### 16.1 普通模式 → DJ 模式

如果普通模式正在播放音乐：当前播放 Track → 自动载入 Deck A；Queue → 转为 Up Next；当前 Playlist → 可转为 Crate 或 Set。

用户体验：点击 DJ 模式 → 系统将当前歌曲载入 Deck A → 用户可继续拖拽歌曲到 Deck B。

### 16.2 DJ 模式 → 普通模式

如果 DJ 模式正在播放：Deck A 当前播放 → 普通播放器当前播放；Deck B 准备曲目 → 加入接下来播放；DJ Set → 自动保存为草稿；DJ Session → 保留恢复入口。

普通模式底部可以显示"返回 DJ Session"。

## 17. 搜索与筛选

RoomWave 的搜索不应该只搜标题。应支持：title、artist、genre、mood、prompt、instrument、lyrics、bpm、key、source、tag、mbti、cognitiveFunction、energy、vocal。

### 17.1 搜索 API 设计（补充）

```ts
// 音乐库搜索 API
GET /api/v1/tracks?
  q=dark+techno           // 全文搜索（标题、标签、prompt）
  &mbti=INTJ              // MBTI 筛选
  &genre=techno           // 流派筛选
  &bpm_min=120            // BPM 范围
  &bpm_max=140
  &energy_min=0.6         // 能量范围
  &mood=dark              // 情绪筛选
  &vocal=none             // 人声筛选
  &source=ai              // 来源筛选
  &tag=客户演示           // 标签筛选
  &status=ready           // 状态筛选
  &sort=bpm               // 排序字段
  &order=asc              // 排序方向
  &page=1                 // 分页
  &limit=20
```

简单搜索：`dark techno female vocal`

高级搜索：`mbti:INTJ bpm:110-125 mood:dark vocal:none source:ai`

认知功能搜索：`function:Ni mood:mysterious structure:progressive`

## 18. 标签系统

### 18.1 系统标签

AI Generated、Has Stems、Instrumental、High Energy、Needs Analysis、Long Intro、Has Drop、Loopable、INTJ、Ni、Te。

### 18.2 用户标签

客户演示、适合视频、适合开场、备用、灵感、深夜、孩子睡觉背景。

## 19. AI 音乐特殊管理

AI 音乐会不断生成、延展、修改，因此需要特殊管理。

### 19.1 生成任务视图

状态：排队中、生成中、生成成功、生成失败、可重试、已入库。

### 19.2 版本树

```
Track A 初版
├── Track A-1 延长版
├── Track A-2 去人声版
├── Track A-3 更强鼓点版
└── Track A-4 Stem 分离版
```

### 19.3 Prompt 反查

每首 AI 音乐都应能回看：原始 Prompt、MBTI 类型、Music DNA、BPM、Genre、Mood、Instruments、Vocal、生成模型、生成参数。

并支持：重新生成、生成变体、改 BPM、改人声、改风格、延长、生成 Stem、加入 DJ Crate。

## 20. 技术模块建议

1. **Personality Engine** — MBTI 类型、认知功能、人格混合
2. **Music DNA Engine** — 将人格转译为音乐参数
3. **Prompt Compiler** — 将 Music DNA 编译为 TTAPI / Suno prompt
4. **Generation Manager** — 提交任务、轮询状态、失败重试、结果入库
5. **Music Asset Library** — Track / Stem / Loop / Prompt / Version 管理
6. **Playlist Service** — 人格歌单、智能歌单、收藏、分享
7. **Crate Service** — DJ 素材箱、智能筛选、用途分类
8. **Set Builder Service** — DJ Set 编排、能量曲线、转场计划
9. **Audio Analysis Service** — BPM、Key、Waveform、Beat Grid、Cue、段落识别
10. **Player Engine** — 普通播放器、Queue、播放历史
11. **DJ Engine** — Deck A/B、Mixer、Crossfader、Loop、Stem、Sync
12. **UI Mode Controller** — 普通模式 / DJ 模式状态切换

## 21. MVP 版本规划

### V1：普通模式 MVP

**目标**：先让产品能生成、播放、收藏。

**功能**：MBTI 选择、场景选择、TTAPI / Suno 生成、生成任务状态、音乐库、最近生成、人格歌单、收藏、普通播放器、播放队列、基础搜索。

暂不做复杂 DJ 功能。

### V2：人格音乐库

**目标**：让 AI 音乐可管理。

**功能**：Music DNA 保存、Prompt 反查、版本树、按 MBTI 筛选、按 BPM / Mood / Energy 筛选、智能歌单、标签系统、生成相似版本、人格混合生成。

### V3：DJ 模式基础版

**目标**：实现核心 Web DJ 控制台。

**功能**：模式切换、Deck A / Deck B 双播放器、Crossfader、Master Volume、Track Browser、拖拽歌曲到 Deck、当前播放映射到 Deck A、基础 DJ Crate。

### V4：DJ 模式进阶版

**目标**：让 RoomWave 具备真正差异化。

**功能**：Waveform、Cue 点、Loop、BPM Sync、Key 显示、Energy Curve、Set Builder、Crate → Set、Playlist → Crate、Playlist → Set、Stem 控制、自动过渡推荐。

### V5：人格 DJ 系统

**目标**：把 MBTI 与 DJ 编排深度结合。

**功能**：认知功能 Set 编排、人格能量曲线、人格对撞 DJ Set、INTJ + ENFP 混合 Set、AI 自动生成过渡段、AI 自动补全 Set、演出回放导出为歌单、分享人格 DJ Set。

## 22. 产品差异化总结

RoomWave 的差异化不在于"AI 生成音乐"本身，而在于：

1. 用 MBTI 作为音乐生成入口
2. 用 Music DNA 控制生成稳定性
3. 用人格歌单降低用户门槛
4. 用 DJ Crate 管理可表演素材
5. 用 DJ Set 表达人格叙事
6. 用双模式界面兼容普通用户和 DJ 用户
7. 用 Prompt / Version / Stem / Loop 管理 AI 音乐资产

**一句话**：RoomWave 是一个从人格生成音乐、从音乐组织资产、从资产进入 DJ 表演的 AI 音乐系统。

## 23. 最终产品结构

**一个核心**：Music Asset Library 音乐资产库

**两个模式**：Listener Mode 普通模式、DJ Mode DJ 模式

**三种组织方式**：Persona Playlist 人格歌单、DJ Crate 素材箱、DJ Set 演出编排

**四个生成维度**：MBTI 类型、认知功能、场景、Music DNA

**五类音乐资产**：Track、Stem、Loop、Prompt、Version

最终体验：

- 普通用户：我选择 MBTI，然后生成适合自己人格的音乐和歌单。
- 进阶用户：我管理不同人格、场景和版本的 AI 音乐资产。
- DJ 用户：我把人格音乐拖进 DJ 控制台，用 Deck A/B 做实时混音和人格 Set 编排。

## 24. 核心设计结论

1. RoomWave 必须做普通模式和 DJ 模式切换。
2. 两个模式共用音乐资产库，但使用不同面板。
3. 播放列表不能只像 Spotify，也不能只像 DJ Crate。正确结构是 Persona Playlist → DJ Crate → DJ Set。
4. MBTI 不直接等于音乐风格，而是转译为 Music DNA。
5. 普通模式中 MBTI 是生成入口和标签。
6. DJ 模式中 MBTI 和认知功能是编排逻辑。
7. Prompt Compiler 是系统稳定性的关键。
8. AI 音乐必须管理 Prompt、版本、Stem、Loop 和生成参数。
9. MVP 应该先做普通模式，再逐步进入 DJ 模式。

## 25. 修改建议优先级（评审补充）

| 优先级 | 改动 | 理由 |
|--------|------|------|
| **P0** | 音频存储策略（12.1 Track 存储字段） | 不定存储方案，后续设计无法落地 |
| **P0** | 底部播放器功能细化（26.1 PlayerState） | 播放器是核心交互，功能列表太粗 |
| **P0** | 交叉淡入设计（26.2 CrossfadeConfig） | DJ 模式和普通模式都需要 |
| **P1** | 音频分析流水线（26.8 AudioAnalysis） | 波形、BPM、段落识别是 DJ 模式的基础 |
| **P1** | 版本控制数据模型（12.10 VersionGroup） | AI 音乐的核心差异化 |
| **P1** | 播放状态持久化（26.3 PersistedPlayerState） | 用户体验基本要求 |
| **P1** | 预加载和缓冲策略（26.5 PreloadStrategy） | 影响播放流畅度 |
| **P2** | 智能歌单规则引擎（12.11 SmartPlaylistRule） | V2 功能，但数据模型应该现在就设计 |
| **P2** | 标签系统数据模型（12.12 Tag） | V2 功能 |
| **P2** | 收藏和播放历史模型（12.13 Favorite/PlayHistory） | V2 功能 |
| **P2** | 错误恢复策略（26.6 PlayerErrorRecovery） | 影响鲁棒性 |
| **P3** | 搜索和筛选 API 设计（17.1 搜索 API） | V3 功能 |
| **P3** | 键盘快捷键（26.7 KEYBOARD_SHORTCUTS） | 键盘用户需要 |
| **P3** | 无障碍设计 | 合规要求 |
| **P3** | 离线播放策略（26.10 OfflineStrategy） | PWA 功能 |

---

## 26. 音乐库管理详细设计（评审补充）

### 26.1 音频文件存储策略

```ts
type TrackStorage = {
  storageType: 'local' | 's3' | 'r2' | 'oss'
  audioUrl: string          // 远程 URL（TTAPI 返回的）
  localPath?: string        // 本地缓存路径（离线播放用）
  cdnUrl?: string           // CDN 加速 URL

  format: 'mp3' | 'wav' | 'm4a' | 'flac' | 'ogg'
  sampleRate: number        // 44100 | 48000
  bitDepth?: number         // 16 | 24
  bitRate?: number          // 128 | 192 | 320 (kbps)
  fileSize: number          // bytes

  cachePolicy: 'permanent' | 'session' | 'evictable'
  lastAccessedAt?: string
}
```

**关键决策**：
- 本地播放器需要缓存策略：最近播放的 N 首缓存到本地，超过上限自动淘汰 LRU
- 离线播放需要 `localPath` 字段
- Stem 文件单独存储，不和主音轨混在一起
- 本地缓存上限：默认 5GB，可配置
- CDN 存储策略：生成后上传 CDN，本地只保留缓存
- Stem 文件懒加载：只在用户需要时才下载，不预加载
- 旧文件淘汰：超过 30 天未播放的文件标记为可淘汰

### 26.2 缓存策略

```ts
type CacheStrategy = {
  metadata: {
    ttl: 300              // 元数据缓存 5 分钟
    maxEntries: 10000
  }
  audio: {
    ttl: 3600             // 音频缓存 1 小时
    maxSize: '5GB'        // 本地缓存上限
    eviction: 'lru'
  }
  swCache: {
    staticAssets: 'cache-first'
    apiData: 'stale-while-revalidate'
    audioFiles: 'network-first'
  }
}
```

### 26.3 音频分析流水线

```ts
type AudioAnalysis = {
  trackId: string

  // 自动分析结果（生成后自动触发）
  bpm: number
  key: string              // "C# minor"
  timeSignature: string    // "4/4"
  durationMs: number
  loudness: number         // LUFS
  waveform: number[]       // 峰值数据，用于波形显示

  // 段落识别
  sections: Array<{
    startMs: number
    endMs: number
    label: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'drop' | 'break'
    energy: number         // 0-1
  }>

  // Beat Grid（DJ 模式需要）
  beatGrid: number[]       // 每个 beat 的时间戳（ms）
  downbeats: number[]      // 每小节第一拍的时间戳

  // 语义标签（AI 或规则生成）
  tags: string[]
  mood: string[]
  energy: number           // 0-1
  danceability: number     // 0-1
  valence: number          // 0-1（快乐/悲伤）

  analyzedAt: string
}
```

**触发时机**：生成完成后自动触发（异步）、导入外部音频自动触发、用户手动重新分析。

### 26.4 与现有代码的对齐

| 设计文档概念 | 当前代码实现 | 差距 |
|-------------|-------------|------|
| Track 模型 | `generation_jobs` + `shared_library` + `tracks` + `song_catalog` 四张表 | 需要统一为一个 Track 模型 |
| MusicDNA | promptComposer 的 layers + profile | 结构化程度不够，缺少 rhythm/structure/soundDesign |
| VersionGroup | 无 | 完全缺失 |
| SmartPlaylist | 无 | 完全缺失 |
| AudioAnalysis | 无（BPM 由 Suno 返回，不自己分析） | 需要补充本地分析能力 |
| Waveform | 无 | DJ 模式必须有 |
| Crossfade | crossfadeDeck.js 有基础实现 | 需要完善曲线和预加载 |
| Queue | usePlayer 中有简单 queue | 需要完善持久化和同步 |
| DJ Crate | trackPool + sessionStore | 概念不同，需要重新映射 |
| DJSet | arranger 的 phaseArrangement | 部分实现，缺少 Set Builder UI |

**建议**：以 RoomWave 设计文档为目标架构，当前代码作为 V1 实现，逐步迁移。优先统一 Track 模型和存储策略。

---

## 27. 播放器详细设计（评审补充）

### 27.1 PlayerState

```ts
type PlayerState = {
  // 当前播放
  currentTrack: Track | null
  currentTimeMs: number
  durationMs: number
  isPlaying: boolean
  volume: number           // 0-1
  isMuted: boolean
  repeatMode: 'off' | 'all' | 'one'
  shuffleMode: boolean

  // 播放队列
  queue: QueueItem[]
  queueIndex: number

  // 播放模式
  crossfadeDurationMs: number

  // 音频分析
  waveformData: number[]
  bpm: number
  key: string

  // 播放源
  source: 'queue' | 'playlist' | 'dj_deck' | 'radio'
  sourceId?: string
}

type QueueItem = {
  trackId: string
  addedBy: 'user' | 'system' | 'auto'
  addedAt: string
  transitionHint?: 'crossfade' | 'gapless' | 'beatmatch'
}
```

### 27.2 CrossfadeConfig

```ts
type CrossfadeConfig = {
  enabled: boolean
  durationMs: number          // 默认 3000ms（3秒）
  curve: 'linear' | 'equal_power' | 'exponential'
  autoDj: boolean             // 是否自动接下一首
}
```

**行为设计**：
- 当前歌曲剩余 < crossfadeDuration 时，预加载下一首
- 两首歌同时播放，音量按 curve 交叉
- 结束后卸载上一首的 Howl 实例，释放内存
- Gapless 模式（无间隙）：下一首在当前歌最后一帧时开始播放

### 27.3 播放状态持久化

```ts
type PersistedPlayerState = {
  currentTrackId: string
  currentTimeMs: number
  queue: Array<{ trackId: string; addedBy: string }>
  queueIndex: number
  volume: number
  repeatMode: string
  shuffleMode: boolean
  crossfadeDurationMs: number
  lastPlayedAt: string
}
```

**恢复策略**：
- 页面刷新：从 localStorage 恢复，跳到上次位置继续播放
- 关闭再打开：从 localStorage 恢复，但不自动播放（需要用户点击）
- 跨设备：从服务端同步（需要登录）

### 27.4 音频格式兼容性

```ts
type AudioFormatSupport = {
  mp3: boolean    // 所有现代浏览器
  wav: boolean    // 所有现代浏览器
  m4a: boolean    // Safari 原生，Chrome/Firefox 需要 AAC
  aac: boolean    // 大部分浏览器
  ogg: boolean    // Chrome/Firefox，Safari 不支持
  flac: boolean   // Chrome 89+, Safari 11+
}
```

播放器初始化时检测支持情况，不支持的格式自动转码或提示。

### 27.5 预加载和缓冲策略

```ts
type PreloadStrategy = {
  preloadThresholdMs: number  // 当前歌曲剩余多少时开始预加载，默认 10000ms
  bufferSize: number
  maxConcurrentLoads: number  // 最大并发加载数，默认 2
  cacheMaxTracks: number      // 本地缓存最多多少首，默认 20
  cacheEvictionPolicy: 'lru' | 'lfu'
}
```

### 27.6 错误恢复策略

```ts
type PlayerErrorRecovery = {
  onLoadError: {
    retry: {
      maxAttempts: number     // 默认 3
      delayMs: number         // 默认 2000ms
      backoff: 'linear' | 'exponential'
    }
    fallback: {
      tryLocalCache: boolean
      tryAlternativeCdn: boolean
      skipToNext: boolean
    }
  }
  onOffline: {
    pause: boolean
    useCache: boolean
    notify: boolean
  }
  onPlaybackError: {
    reload: boolean
    skipToNext: boolean
    stop: boolean
  }
}
```

### 27.7 键盘快捷键

```ts
const KEYBOARD_SHORTCUTS = {
  // 普通模式
  ' ':          'play/pause',
  'ArrowLeft':  'seek backward 5s',
  'ArrowRight': 'seek forward 5s',
  'ArrowUp':    'volume up',
  'ArrowDown':  'volume down',
  'n':          'next track',
  'p':          'previous track',
  's':          'shuffle toggle',
  'r':          'repeat toggle',
  'm':          'mute toggle',
  'q':          'toggle queue',
  '/':          'focus search',

  // DJ 模式
  'a':          'Deck A play/pause',
  'l':          'Deck B play/pause',
  '1-9':        'Deck A cue points',
  'Shift+1-9':  'Deck B cue points',
  'z':          'Deck A loop',
  'x':          'Deck B loop',
  'b':          'BPM sync',
  'f':          'crossfader center',
}
```

### 27.8 无障碍设计

- 所有播放控件需要 `aria-label`
- 波形显示需要 `role="img"` + `aria-label` 描述
- 键盘可操作所有功能
- 高对比度模式支持
- 屏幕阅读器兼容

### 27.9 离线播放策略

```ts
type OfflineStrategy = {
  cacheName: 'roomwave-audio-v1'
  maxCachedTracks: 50
  prefetchNext: 3

  available: [
    'play cached tracks',
    'view library metadata',
    'manage playlists',
    'play queue',
  ]

  unavailable: [
    'generate new music',
    'stream audio',
    'sync across devices',
  ]
}
```

---

## 28. MBTI 生成器升级设计

> 以下内容整合了评审后的补充设计。MBTI 不再是固定标签，而是一组可被用户调节的人格参数。AI 对话作为自然语言调参入口。

### 28.1 生成器核心结构

```
MBTI 类型选择
    ↓
四维人格滑块
    ↓
音乐风格滑块
    ↓
AI 对话调参
    ↓
Music DNA
    ↓
Prompt Compiler（三层）
    ↓
TTAPI / Suno / 其他生成服务
```

最终用户不是只能点 `INTJ` / `INTP` / `ENTP`，而是可以自己调出：

```
INTJ 作为主型
E/I：I 80%    S/N：N 70%    T/F：T 65%    J/P：J 75%
再加入 30% ENFP 的明亮感
BPM 提高到 126，减少人声，增加复古合成器
```

### 28.2 四维人格滑块

四个双向滑块，每个 0-100：

```
外倾 E  ←────────────→  内倾 I     (EI: 0=极E, 100=极I)
实感 S  ←────────────→  直觉 N     (SN: 0=极S, 100=极N)
思考 T  ←────────────→  情感 F     (TF: 0=极T, 100=极F)
判断 J  ←────────────→  感知 P     (JP: 0=极J, 100=极P)
```

示例：`{ EI: 82, SN: 74, TF: 31, JP: 79 }` → 系统推导 INTJ，但这是连续人格坐标，不是死板标签。

用户手动选择主型后，系统给出默认滑块（如 INTJ: `{ EI:80, SN:75, TF:25, JP:80 }`），用户可继续微调。

### 28.3 人格混合

主型 + 副型 + 比例 + 混合模式：

```ts
type MBTIBlendInput = {
  primaryType: string
  secondaryType?: string
  primaryRatio: number       // 0-100
  secondaryRatio?: number
  blendMode: 'merge' | 'contrast' | 'dialogue'
}
```

| 模式 | 含义 | 音乐效果 |
|------|------|---------|
| Merge 融合 | 两种人格混成统一风格 | 风格自然融合 |
| Contrast 对撞 | 主歌一种人格，副歌另一种 | 段落反差明显 |
| Dialogue 对话 | 两种人格像两个角色对话 | 双人声/双音色/call & response |

### 28.4 音乐风格滑块

MBTI 滑块控制"人格倾向"，音乐滑块控制"听感"：

| 滑块 | 范围 | 进入 Music DNA 的字段 |
|------|------|----------------------|
| 能量 Energy | 低←→高 | `energy` |
| 情绪温度 | 冷←→暖 | `soundDesign.brightness` 反向 + `mood` |
| 抽象程度 | 具象←→抽象 | `structure.form` + `genre` |
| 结构感 | 自由←→严谨 | `structure.form` |
| 律动感 | 弱←→强 | `rhythm.intensity` |
| 人声比例 | 无人声←→强人声 | `vocal.enabled` + `vocal.emotion` |
| 实验程度 | 流行←→实验 | `genre` + `soundDesign.texture` |
| 空间感 | 贴耳←→宽广 | `soundDesign.space` |
| 复古感 | 现代←→复古 | `soundDesign.texture` |
| 黑暗感 | 明亮←→黑暗 | `mood` + `soundDesign.brightness` |

### 28.5 AI 对话式风格调参

**关键原则**：AI 对话不要直接拼 prompt，而是转成结构化参数修改。

用户说："让它更像深夜开车听的 INTJ 电子音乐，BPM 快一点，不要人声。"

系统解析为：

```json
{
  "mbtiPatch": {
    "type": "INTJ",
    "EI": 85, "SN": 78, "TF": 25, "JP": 80
  },
  "musicPatch": {
    "scene": "night_drive",
    "genre": ["dark synthwave", "minimal techno"],
    "bpm": 124,
    "vocal": { "enabled": false },
    "mood": ["focused", "cold", "futuristic", "driving"]
  }
}
```

前端显示：

```
AI 建议调整：
- 主型保持 INTJ
- BPM 调整为 124
- 人声关闭
- 增加 dark synthwave / minimal techno
- 情绪改为 focused / cold / futuristic / driving

[应用调整] [撤销] [继续修改]
```

MVP 建议先做"确认后应用"模式，避免 AI 改动过大导致用户失控。

### 28.6 参数锁定

每个关键参数旁边有锁定按钮。锁定后 AI 对话不能修改该字段。

适合锁定的参数：MBTI 主型、BPM、Vocal、Genre、Language、Duration、Scene。

如果用户锁定了"人声：关闭"，即使用户说"让它更像流行歌"，AI 会提示：

> 这个方向通常会加入人声，但你已锁定"无人声"。是否解除锁定？

### 28.7 生成器交互状态四层

```
Base Preset（MBTI 默认预设）
    ↓ 优先级最低
User Slider（用户滑块调整）
    ↓
Chat Patch（AI 对话修改）
    ↓
Manual Override（用户手动锁定项）
    ↓ 优先级最高
```

**优先级**：`Manual Override > Chat Patch > User Slider > Base Preset`

### 28.8 前端布局

```
┌──────────────────────────────────────────────┐
│ MBTI Music Generator                         │
├──────────────────────┬───────────────────────┤
│ 左侧：人格控制面板    │ 右侧：AI 对话助手       │
│                      │                       │
│ 主型选择 INTJ         │ 用户输入：              │
│ E/I 滑块              │ "更冷一点，别太压抑"    │
│ S/N 滑块              │                       │
│ T/F 滑块              │ AI 建议改动：           │
│ J/P 滑块              │ - Darkness +15          │
│ 人格混合              │ - Warmth +10            │
│                      │ - Vocal 关闭            │
├──────────────────────┴───────────────────────┤
│ 下方：音乐控制滑块                             │
│ Energy / BPM / Vocal / Structure / Mood       │
├──────────────────────────────────────────────┤
│ Prompt Preview / Music DNA Preview            │
│ [生成音乐] [生成变体] [保存预设] [进入DJ模式]  │
└──────────────────────────────────────────────┘
```

### 28.9 MBTI Generator 数据模型

```ts
type MBTIControlState = {
  selectedType: string
  dimensions: { EI: number; SN: number; TF: number; JP: number }
  blend?: {
    primaryType: string
    secondaryType?: string
    primaryRatio: number
    secondaryRatio?: number
    blendMode: 'merge' | 'contrast' | 'dialogue'
  }
  cognitiveFunctions?: {
    Ni?: number; Ne?: number; Si?: number; Se?: number
    Ti?: number; Te?: number; Fi?: number; Fe?: number
  }
}

type MusicControlState = {
  scene?: string
  genre: string[]
  mood: string[]
  instruments: string[]
  bpm?: number
  bpmRange?: [number, number]
  energy: number
  warmth: number
  abstractness: number
  structure: number
  groove: number
  vocalPresence: number
  experimental: number
  space: number
  retro: number
  darkness: number
  vocal: {
    enabled: boolean
    type?: 'male' | 'female' | 'mixed'
    language?: string
    emotion?: 'calm' | 'restrained' | 'expressive' | 'dramatic'
  }
}

type ChatStylePatch = {
  id: string
  userMessage: string
  intent: 'adjust_mbti' | 'adjust_music_style' | 'adjust_structure' |
          'adjust_vocal' | 'adjust_instruments' | 'adjust_scene' |
          'generate_variant' | 'explain_style'
  mbtiPatch?: Partial<MBTIControlState>
  musicPatch?: Partial<MusicControlState>
  promptHints?: { add?: string[]; remove?: string[]; avoid?: string[] }
  explanation: string
  status: 'preview' | 'applied' | 'discarded'
  createdAt: string
}

type GenerationSnapshot = {
  id: string
  trackId?: string
  mbtiControlState: MBTIControlState
  musicControlState: MusicControlState
  chatPatches: ChatStylePatch[]
  compiledPrompt: string
  negativePrompt?: string
  provider: 'ttapi' | 'suno' | 'udio' | 'custom'
  providerParams?: Record<string, any>
  createdAt: string
}
```

### 28.10 滑块与 Music DNA 的映射规则

滑块不是装饰，必须真正影响 Music DNA。示例映射：

| 滑块变化 | Music DNA 影响 |
|---------|---------------|
| I 值提高 | → 降低 Energy → 增加 Space → 减少 Hook → 增加 Ambient/Reverb/Intimate |
| N 值提高 | → 增加 abstractness → genre 偏向 Experimental/Ambient → 减少 Pop/Rock |
| T 值提高 | → mood 偏向 cold/mechanical → genre 偏向 Minimal Techno/IDM |
| darkness 提高 | → mood 加入 dark/mysterious → brightness 降低 → 减少 major key |
| energy 提高 | → BPM 上限提高 → rhythm.intensity 增加 → 减少 Ambient |
| groove 提高 | → rhythm.groove 偏向 syncopated/broken → 增加 funk/house 元素 |

### 28.11 与现有 promptComposer 的对齐

当前 promptComposer 的 PHASE_PRESETS（7 阶段）和 MBTI profiles（16 型）可以作为 Base Preset 层。升级路径：

```
当前：PHASE_PRESETS[phase] + profiles[mbti] → composePrompt()
升级：MBTIControlState + MusicControlState + ChatStylePatch → Music DNA → composePrompt()
```

`MBTIControlState.dimensions` 可以直接替换当前的 `axes`（`{ ie, ns, tf, jp }`），只是范围从 -100~100 改为 0~100，语义更清晰。

### 28.12 两种控制方式必须同步

- 用户通过滑块修改 → AI 对话面板显示当前参数
- 用户通过对话修改 → 滑块跟着变化
- 两者操作的是同一套 `MBTIControlState` + `MusicControlState`

### 28.13 设计结论

```
选择 MBTI 主型
    ↓
调整四维人格占比
    ↓
调整音乐风格滑块
    ↓
通过 AI 对话继续微调
    ↓
生成 Music DNA
    ↓
编译 Prompt（三层）
    ↓
生成音乐
```

**滑块负责精确控制，AI 对话负责自然语言调参，Prompt Compiler 负责把人格与音乐参数稳定转译为可生成的音乐提示词。**

---

## 29. 效果器设计（专业功能补充）

> 本节补充 RoomWave DJ 模式的效果器链设计，面向专业 DJ / MC 用户。

### 29.1 架构定位

效果器是 DJ 模式的核心差异化能力。RoomWave 的效果器设计基于 Web Audio API 原生节点，不依赖第三方 DSP 库，保证浏览器内零安装运行。

### 29.2 信号链架构

**每轨信号链（改造后）：**

```
AudioBufferSource / MediaStreamSource
    │
GainNode（volume / mute / solo）
    │
BiquadFilterNode [lowshelf @ 320Hz]     ← 3-band EQ
BiquadFilterNode [peaking @ 1kHz, Q=1]
BiquadFilterNode [highshelf @ 3200Hz]
    │
DynamicsCompressorNode（可选压缩）
    │
StereoPannerNode（声像）
    │
┌─────────────────────────────┐
│   EffectsChain（效果器链）    │  ← 新增插入点
│                             │
│   dry ──→ outputGain        │
│   wet ──→ [效果1]           │
│         → [效果2]           │
│         → [效果3]           │
│         → [效果4]           │
│         → wetMix ──→ output  │
└─────────────────────────────┘
    │
AnalyserNode（电平检测）
    │
master.gain → master.limiter → [MasterEffects] → master.analyser → destination
```

**关键设计决策**：
- 效果器插入在 Panner 之后、Analyser 之前：效果处理后的信号被电平表准确反映
- Wet/Dry 并行架构：dry 信号始终通过，效果器只处理 wet 路径，避免 latency 累积
- 每轨最多 4 个效果器串联，防止 CPU 过载
- Master Effects 总线独立于每轨效果器，用于全局空间效果

### 29.3 效果器类型

#### 29.3.1 Reverb（混响）

| 参数 | 类型 | 范围 | 默认值 |
|------|------|------|--------|
| wet | float | 0.0 ~ 1.0 | 0.3 |
| decay | float | 0.1 ~ 10.0 秒 | 2.0 |
| preDelay | float | 0 ~ 100ms | 20ms |
| ir | Buffer | impulse response 音频 | built-in room |

- 实现：ConvolverNode + 自定义 IR buffer
- 内置 6 种预设 IR：Room / Hall / Plate / Chamber / Spring / Gated
- 支持加载自定义 .wav impulse response 文件

#### 29.3.2 Delay（延迟）

| 参数 | 类型 | 范围 | 默认值 |
|------|------|------|--------|
| wet | float | 0.0 ~ 1.0 | 0.3 |
| time | float | 0.01 ~ 2.0 秒 | 0.375 |
| feedback | float | 0.0 ~ 0.95 | 0.4 |
| filter | float | 200 ~ 8000 Hz | 3000 |
| tempoSync | bool | — | false |

- 实现：DelayNode + feedback loop + BiquadFilterNode（衰减高频模拟磁带延迟）
- Tempo Sync 模式：delay time 锁定到 BPM 的 1/4、1/8、1/16、1/32
- 反馈上限 0.95 防止自激振荡

#### 29.3.3 Distortion / Saturation（失真/饱和）

| 参数 | 类型 | 范围 | 默认值 |
|------|------|------|--------|
| wet | float | 0.0 ~ 1.0 | 0.2 |
| drive | float | 0 ~ 100 | 20 |
| tone | float | 200 ~ 8000 Hz | 1000 |
| type | enum | soft_clip / hard_clip / tube / bitcrush | soft_clip |

- 实现：WaveShaperNode + 不同 curve 函数
- tube 模式：对称软削波，温暖饱和
- bitcrush 模式：降低采样率/位深，制造 Lo-fi 效果

#### 29.3.4 Filter Sweep（滤波扫频）

| 参数 | 类型 | 范围 | 默认值 |
|------|------|------|--------|
| wet | float | 0.0 ~ 1.0 | 0.5 |
| type | enum | lowpass / highpass / bandpass | lowpass |
| frequency | float | 20 ~ 20000 Hz | 1000 |
| resonance | float | 0.1 ~ 30 | 5 |
| sweepSpeed | float | 0.1 ~ 10 Hz | 0 |

- 实现：BiquadFilterNode + requestAnimationFrame 自动扫频
- 扫频模式：frequency 在 [frequency - sweepRange, frequency + sweepRange] 间正弦振荡
- 手动模式：用户拖拽频率旋钮

#### 29.3.5 Phaser（相位器）

| 参数 | 类型 | 范围 | 默认值 |
|------|------|------|--------|
| wet | float | 0.0 ~ 1.0 | 0.3 |
| rate | float | 0.1 ~ 10 Hz | 1.0 |
| depth | float | 0 ~ 1.0 | 0.7 |
| stages | int | 2 ~ 8 | 4 |
| feedback | float | 0 ~ 0.9 | 0.5 |

- 实现：多级 AllpassFilterNode + LFO 调制 delay time
- stages 越多相位效果越丰富，但 CPU 消耗越大

### 29.4 效果器预设

| 预设名 | 效果组合 | 典型场景 |
|--------|---------|---------|
| Club Reverb | Reverb (Hall, 2.5s) + EQ boost low | 大空间感，适合 House/Techno |
| Tape Delay | Delay (3/8, feedback 0.6, filter 2kHz) | Dub/Delay 效果 |
| Vinyl Crackle | Distortion (tube, drive 15) + HPF 80Hz | 复古黑胶质感 |
| Radio Voice | BPF 300-3000Hz + Distortion (bitcrush) | 对讲机/收音机人声 |
| Space Echo | Delay (1/4, feedback 0.7) + Reverb (Plate) | 太空回声 |
| Stutter | Delay (1/16, feedback 0.9) | 结巴/卡顿效果 |
| Warm Body | Distortion (soft_clip, drive 10) + LPF 5kHz | 温暖低频增强 |

### 29.5 效果器 UI 设计

**EffectsRack 组件**（每轨一个）：

```
┌─────────────────────────────────────────┐
│  Track 1: 人声采样                        │
│                                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│  │Slot 1│→│Slot 2│→│Slot 3│→│Slot 4│  │
│  │Reverb│ │Delay │ │ ---- │ │ ---- │  │
│  │ ● Mix│ │ ● Mix│ │  +   │ │  +   │  │
│  └──────┘ └──────┘ └──────┘ └──────┘  │
│                                         │
│  Preset: [Club Reverb ▾]   Bypass: ○   │
└─────────────────────────────────────────┘
```

**Knob 旋钮控件**：
- 鼠标拖拽 / 触控旋转
- 垂直拖拽 = 增大，水平拖拽 = 减小
- 双击重置为默认值
- 显示当前值 + 参数名
- 右键菜单：拷贝值 / 粘贴值 / 重置

---

## 30. 人声录入设计（专业功能补充）

> 本节补充 RoomWave 的实时麦克风输入、耳返监听、Set 录制和采样触发设计。

### 30.1 架构定位

人声录入是 DJ 模式的表演层能力。设计目标：
- MC/DJ 可以通过麦克风实时叠加人声
- 演出全程可录制并导出
- 录制片段可截取为采样，触发复用

### 30.2 麦克风输入

#### 30.2.1 技术方案

```javascript
// mixerEngine.js 新增方法
addMicTrack({ name = 'Mic 1', monitoring = true }) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,    // 关闭回声消除，保留原始音质
      noiseSuppression: false,    // 关闭降噪，由效果器链处理
      autoGainControl: false,     // 关闭自动增益，手动控制
      sampleRate: 48000,
      channelCount: 2
    }
  });

  const source = ctx.createMediaStreamSource(stream);
  // 接入标准信号链：gain → eq → comp → panner → effects → analyser → master
  this._connectToTrackChain('mic-1', source, stream);
}
```

**关键设计决策**：
- 关闭所有浏览器自动处理（echoCancellation/noiseSuppression/autoGainControl）：专业用户需要原始音频，通过效果器链自行处理
- 采样率锁定 48000Hz，与项目音频一致
- 立体声输入：支持立体声麦克风

#### 30.2.2 耳返监听（Monitoring）

独立于主输出的监听路径：

```
MediaStreamSource
    │
    ├─→ 主信号链 → master output（扬声器）
    │
    └─→ MonitoringGainNode → headphones output（耳机监听）
```

| 参数 | 范围 | 默认值 | 说明 |
|------|------|--------|------|
| monitoring | bool | true | 耳返开关 |
| monitoringGain | 0.0 ~ 1.0 | 0.8 | 耳返音量 |
| monitoringDelay | 0 ~ 50ms | 0 | 耳返延迟补偿（消除处理链 latency） |

**为什么需要独立监听路径**：
- 主输出经过完整效果器链，有处理延迟
- 耳返需要零延迟或极低延迟，让表演者听到自己的声音
- 监听路径跳过效果器链，直接从源到耳机

#### 30.2.3 变声器（Voice FX）

实时变声是人声录入的核心差异化能力。变声器不是独立于效果器链的新架构，而是**麦克风专用的效果器预设链**——通过组合基础 DSP 节点实现不同嗓音变换。

**信号链位置**：

```
MediaStreamSource
    │
GainNode（mic volume）
    │
┌─────────────────────────────┐
│  VoiceFX（变声器处理器）      │  ← 在 EQ/Compressor 之前
│                             │
│  pitchShift → formantShift  │
│  → distortion → ringMod     │
│  → chorus → output          │
└─────────────────────────────┘
    │
EQ → Compressor → Panner → EffectsChain → Analyser → Master
```

**为什么变声器在 EQ 之前**：变声后的信号频率分布会改变，EQ 应该对变换后的信号做修正，而不是变换前。

##### 核心 DSP 模块

| 模块 | Web Audio 节点 | 作用 | 可调参数 |
|------|---------------|------|---------|
| Pitch Shifter | DelayNode + crossfade（TD-PSOLA 简化版） | 升高/降低音高 | semitones: -12 ~ +12 |
| Formant Shifter | BiquadFilterNode 组（3 段共振峰偏移） | 改变声道共鸣特征，不改变音高 | shift: -1.0 ~ +1.0 |
| Distortion | WaveShaperNode | 嗓音失真/破音 | drive: 0 ~ 100 |
| Ring Modulator | OscillatorNode × GainNode（乘法调制） | 金属质感/机器人声 | frequency: 20 ~ 2000Hz, mix: 0 ~ 1.0 |
| Chorus | 3 × DelayNode + LFO 调制 | 嗓音增厚/合唱效果 | rate: 0.1 ~ 10Hz, depth: 0 ~ 1.0, voices: 2 ~ 4 |
| Octave | Pitch Shifter 固定 ±12 semitones + mix | 叠加八度 | mix: 0 ~ 1.0 |
| Compressor | DynamicsCompressorNode | 压限，让变声后音量稳定 | threshold: -30 ~ 0dB, ratio: 2 ~ 20 |

##### 预设音色库

| 预设名 | 组合 | 效果描述 |
|--------|------|---------|
| **重金属嘶吼** | Distortion(drive=60) + FormantShift(-0.3) + Compressor(threshold=-20, ratio=8) + HPF(100Hz) | 压低共振峰 + 破音 + 压限 = 金属嗓 growl |
| **恶魔低语** | PitchShift(-5) + FormantShift(-0.5) + Reverb(Hall, 3s) + Distortion(drive=25) | 降 5 半音 + 压低共振峰 = 低沉恶魔声 |
| **花栗鼠** | PitchShift(+7) + FormantShift(+0.4) + HPF(300Hz) | 升 7 半音 + 提高共振峰 = 卡通高音 |
| **机器人** | RingMod(100Hz) + Distortion(drive=40) + Chorus(rate=3, depth=0.8) | 环形调制 + 合唱 = 经典机器人声 |
| **电话音** | BPF(400Hz, 3500Hz) + Distortion(drive=15) + Compression(ratio=10) | 带通滤波 + 轻度失真 = 电话/对讲机 |
| **天使合唱** | PitchShift(0) + Chorus(rate=2, depth=0.6, voices=4) + Reverb(Plate, 2s) | 四声合唱 + 板式混响 = 空灵圣洁 |
| **外星人** | PitchShift(+3) + RingMod(400Hz, mix=0.3) + Delay(1/8) + Reverb(Chamber) | 轻度环调 + 延迟 = 异星感 |
| **怪兽** | PitchShift(-8) + FormantShift(-0.7) + Distortion(drive=50) + Chorus(rate=0.5) | 大幅降调 + 极低共振峰 + 失真 = 怪兽吼 |
| **电话录音** | BPF(500Hz, 2500Hz) + NoiseGate + Distortion(drive=10) | 窄带 + 门限 + 轻失真 = 老式电话 |
| **现场 MC** | Compressor(threshold=-15, ratio=6) + HPF(80Hz) + Presence Boost(3kHz +6dB) | 干声压限 + 齿音增强 = 演出 MC 嗓 |
| **空灵回声** | PitchShift(+2) + Reverb(Hall, 4s, wet=0.6) + Delay(3/8, feedback=0.5) | 升调 + 大混响 + 长延迟 = 梦幻空灵 |
| **Vocoder** | OscillatorCarrier(内置合成器) + 16-band FilterBank → vocoder 经典声 | 人声 → 合成器载波 = 经典 Vocoder |

##### 变声器 UI

```
┌─────────────────────────────────────────────┐
│  🎤 Voice FX                                │
│                                             │
│  Preset: [重金属嘶吼 ▾]                      │
│                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│  │Pitch│ │Form.│ │Drive│ │Ring │  ← 参数旋钮
│  │ -3  │ │-0.3 │ │ 60  │ │ off │          │
│  └─────┘ └─────┘ └─────┘ └─────┘          │
│                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐                   │
│  │Chorus│ │Octave│ │Comp │                   │
│  │ off  │ │ off  │ │ -20 │                   │
│  └─────┘ └─────┘ └─────┘                   │
│                                             │
│  Dry/Wet: ████████░░ 80%                    │
│  Bypass: ○  Preview: ▶ (听效果再开)          │
└─────────────────────────────────────────────┘
```

**Preview 模式**：先在耳机里听变声效果（耳返路径），确认满意后再接入主信号链混入输出。避免在演出中突然切换未经试听的变声效果。

##### 性能注意事项

- Pitch Shifter 是计算量最大的模块（需要实时音频时间拉伸），建议限制为单实例
- Ring Modulator 的 OscillatorNode 需要在不用时 `stop()` 释放 CPU
- 所有 VoiceFX 节点在 bypass 时应完全断开连接（不只是 gain=0），避免不必要的音频处理
- 移动端建议减少同时开启的效果模块数量（上限 3 个）

#### 30.2.4 多麦克风支持

支持最多 2 路麦克风输入（立体声分离或两个独立麦克风）：

| 场景 | 配置 |
|------|------|
| 单麦克风 | 1 路 mono mic → 1 个 mic track |
| 双麦克风（对唱） | 2 路 mic → 2 个独立 mic track，各自 EQ/Effects |
| 立体声麦克风 | 1 路 stereo mic → 1 个 mic track，保留立体声像 |

### 30.3 Set 录制

#### 30.3.1 录制架构

```
master.analyser
    │
    └─→ MediaStreamDestination（Web Audio 路由）
            │
            └─→ MediaRecorder（编码）
                    │
                    └─→ Blob chunks → 下载 / 上传
```

**录制源**：从 master.analyser 后截取，确保录制的是所有轨混合后的完整输出（含效果器处理）。

#### 30.3.2 编码格式

| 格式 | 浏览器支持 | 文件大小 | 音质 | 推荐场景 |
|------|-----------|---------|------|---------|
| webm/opus | Chrome/Firefox/Edge | 小 | 良好 | 默认首选 |
| audio/mp4 (aac) | Safari/Chrome | 中 | 优 | Safari 兼容 |
| wav | 全平台 | 大（~10MB/min） | 无损 | 高质量归档 |

- 默认编码：webm/opus（综合最优）
- Safari fallback：audio/mp4
- 用户可手动选择 wav（高质量导出场景）

#### 30.3.3 录制控制

| 功能 | 实现 |
|------|------|
| 开始录制 | MediaRecorder.start()，chunkSize = 1s |
| 暂停/恢复 | MediaRecorder.pause() / resume() |
| 停止录制 | MediaRecorder.stop() → 生成完整 Blob |
| 时长显示 | requestAnimationFrame 更新计时器 |
| 波形预览 | 录制中实时绘制波形（AnalyserNode 数据） |
| 录制完成后 | 弹出面板：试听 / 下载 / 保存到 Track 库 / 截取采样 |

#### 30.3.4 录制文件管理

```
recordings/
├── 2026-07-09_dj-set-001.webm      (完整 Set 录制)
├── 2026-07-09_dj-set-001.meta.json  (元数据：时长、BPM、使用的轨道)
└── samples/                          (从录制中截取的采样)
    ├── vocal-drop-001.wav
    └── scratch-002.wav
```

### 30.4 Sample Pad（采样触发）

#### 30.4.1 Pad 规格

| 属性 | 值 |
|------|-----|
| Pad 数量 | 8 / 16（可切换） |
| 触发模式 | One-shot（按一次播完） / Toggle（按一次开始再按停止） / Loop（循环播放） |
| 每 Pad 参数 | volume, pan, pitch（-12 ~ +12 semitones）, effects |
| 键盘映射 | 8-pad: Q W E R T Y U I / 16-pad: + A S D F G H J K |
| 采样来源 | 录制截取 / Track 截取 / 文件导入 |

#### 30.4.2 SamplerEngine

```javascript
class SamplerEngine {
  constructor(audioContext) {
    this.pads = new Array(16).fill(null);  // { buffer, mode, gain, pan, pitch }
    this.output = audioContext.createGain();
  }

  // 从 AudioBuffer 截取片段加载到 Pad
  loadPad(padIndex, buffer, { start, end, mode = 'one-shot' }) {
    // start/end 为秒数，截取后存储为独立 AudioBuffer
  }

  // 触发 Pad
  trigger(padIndex, velocity = 1.0) {
    // 根据 mode 播放：one-shot / toggle / loop
    // 应用 pitch shift（AudioBufferSourceNode playbackRate）
  }

  // 从 MediaRecorder 的 Blob 中截取
  loadFromRecording(padIndex, blob, { startMs, endMs }) {
    // blob → ArrayBuffer → decodeAudioData → 截取 → loadPad
  }
}
```

#### 30.4.3 SamplePad UI

```
┌─────────────────────────────────────────────┐
│  Sample Pad                          [8|16] │
│                                             │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│  │  Q  │ │  W  │ │  E  │ │  R  │          │
│  │ vocal│ │ scratch│ │  hi  │ │  -  │  ← Pad 状态：已加载/空/播放中
│  │ ▶/■  │ │ ▶/■  │ │ ▶/■  │ │  +  │          │
│  │ ♪vol │ │ ♪vol │ │ ♪vol │ │     │          │
│  └─────┘ └─────┘ └─────┘ └─────┘          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐          │
│  │  T  │ │  Y  │ │  U  │ │  I  │          │
│  │  -  │ │  -  │ │  -  │ │  -  │          │
│  │  +  │ │  +  │ │  +  │ │  +  │          │
│  └─────┘ └─────┘ └─────┘ └─────┘          │
│                                             │
│  Master: ○ Vol   ○ Pan   Mode: [One] [Loop] │
│  Load: [From Recording] [From File] [Clear]  │
└─────────────────────────────────────────────┘
```

### 30.5 浏览器兼容性

| 功能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| getUserMedia | ✓ | ✓ | ✓ (需 HTTPS) | ✓ |
| MediaRecorder (webm/opus) | ✓ | ✓ | ✗ | ✓ |
| MediaRecorder (mp4/aac) | ✓ | ✓ | ✓ | ✓ |
| MediaRecorder (wav) | ✓ | ✓ | ✓ | ✓ |
| ConvolverNode | ✓ | ✓ | ✓ | ✓ |
| StereoPannerNode | ✓ | ✓ | ✓ | ✓ |

**策略**：检测 MediaRecorder 支持的编码格式，优先 webm/opus，不支持时 fallback 到 mp4 或 wav。
