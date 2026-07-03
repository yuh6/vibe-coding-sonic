# AI 即时生成音乐调音台前端方案

> ⚠️ **文档状态：构想方案，技术选型仅供参考，与当前代码不一致。**
> 本文 §7/§14 推荐的 Next.js + TypeScript + Zustand + wavesurfer.js + PostgreSQL + Redis
> 是撰写时的产品构想，**实际项目采用 Vite + React（纯 JS）+ SQLite（better-sqlite3）+ Howler**，
> 也没有引入 wavesurfer.js/Zustand。已实现的调音台代码见 `src/components/mixer/`、
> `src/audio/mixerEngine.js`、`src/hooks/useMixer.js`。阅读本文时请把它当"方向参考"，
> 不要按文中依赖清单去安装或期待项目已具备这些能力。

## 1. 项目定位

本项目不是传统 DJ 软件，也不是完整 DAW，而是一个：

> **AI 即时音乐生成控制台 + Web 调音台仪表盘**

用户通过 Prompt、曲风、BPM、Key、情绪、能量等参数生成音乐，然后在前端用调音台控制生成结果，包括播放、分轨、音量、EQ、Pan、Mute、Solo、效果器、循环、局部重生成和导出。

建议产品定位：

> **AI Music Mixer Dashboard**

核心体验路径：

```text
输入音乐需求
  ↓
生成多轨音乐
  ↓
显示波形和分轨
  ↓
用户用调音台控制声音
  ↓
不满意的片段局部重生成
  ↓
保存版本 / 导出成品
```

---

## 2. 产品目标

### 2.1 核心目标

构建一个以“调音台”为主要视觉和交互核心的 AI 音乐生成前端仪表盘，让用户能够：

1. 用自然语言和参数生成音乐。
2. 查看 AI 生成的多轨音乐。
3. 像操作调音台一样控制每条音轨。
4. 对局部片段进行再生成。
5. 保存不同生成版本和混音状态。
6. 导出最终音乐结果。

### 2.2 一句话定义

> 一个面向 AI 即时音乐生成的 Web 调音台，用户可以用 Prompt 生成音乐，并通过分轨、波形、EQ、音量、效果器、局部重生成和版本管理来实时控制结果。

---

## 3. 参考对象

### 3.1 Mixxx

Mixxx 是成熟的开源 DJ 软件，适合参考其 DJ 交互逻辑，包括：

- Deck
- BPM
- Key
- Sync
- Cue
- FX
- Mixer
- Controller Mapping
- Library

项目地址：

- https://mixxx.org/
- https://github.com/mixxxdj/mixxx

### 3.2 Eyevinn/audio-mixer

Eyevinn/audio-mixer 是 React + TypeScript 的 Web 数字调音台项目，适合参考：

- Web 调音台布局
- Channel Strip
- Routing
- Meter
- WebSocket 控制
- 实时音频处理界面

项目地址：

- https://github.com/Eyevinn/audio-mixer

注意：该项目许可证为 AGPL-3.0，商用闭源产品不建议直接复制代码，更适合参考信息架构和交互方式后自行实现。

### 3.3 wavesurfer.js

wavesurfer.js 适合实现：

- 音频波形显示
- 时间轴
- 片段选择
- Region
- Loop
- Marker
- 多轨可视化

项目地址：

- https://wavesurfer.xyz/
- https://github.com/katspaugh/wavesurfer.js

### 3.4 Web Audio API

Web Audio API 是浏览器中实现音频控制的核心能力，适合实现：

- 音量控制
- Pan 声像控制
- EQ
- Compressor
- Meter
- Master Bus
- Send FX
- 音频节点路由

参考文档：

- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

## 4. 页面总体布局

建议采用：

> **上生成，中编辑，下调音**

整体页面结构如下：

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶部：AI 音乐生成控制区                                      │
│ Prompt / Style / BPM / Key / Energy / Generate / Regenerate  │
├───────────────┬───────────────────────────────┬──────────────┤
│ 左侧素材库     │ 中央多轨波形与时间轴           │ 右侧AI控制区 │
│ Clips          │ Drums waveform                │ 编曲建议      │
│ Stems          │ Bass waveform                 │ 变奏生成      │
│ Versions       │ Melody waveform               │ 局部重生成    │
│ Presets        │ Vocal waveform                │ 参数解释      │
├───────────────┴───────────────────────────────┴──────────────┤
│ 底部：Mixer 调音台                                            │
│ Drums | Bass | Chords | Melody | Vocal | FX | Master          │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 核心功能模块

## 5.1 AI 音乐生成控制区

这是产品的核心入口，建议放在页面顶部。

### 主要控件

| 控件 | 说明 |
|---|---|
| Prompt | 用自然语言描述想生成的音乐 |
| Style | 曲风，如 Lo-fi、House、Techno、Ambient、Cinematic |
| BPM | 节奏速度 |
| Key | 调性 |
| Mood | 情绪 |
| Energy | 音乐强度 |
| Density | 编曲密度 |
| Duration | 生成时长 |
| Structure | Intro / Verse / Drop / Outro |
| Seed | 固定随机种子，方便复现 |
| Generate | 生成新音乐 |
| Variation | 生成变体 |
| Extend | 续写当前音乐 |
| Remix | 基于当前音乐重混 |
| Freeze Track | 锁定某些轨道不被重生成 |

### 设计原则

不要只做成聊天框，而要做成：

> **Prompt + 参数控制 + 一键生成 + 版本管理**

目标是让用户感觉自己在“驾驶音乐生成器”，而不是简单地向系统提交请求。

---

## 5.2 多轨波形区

AI 生成音乐最好返回分轨，而不是只返回一个 Master 文件。

建议默认分为：

| Track | 说明 |
|---|---|
| Drums | 鼓组 |
| Bass | 贝斯 |
| Chords | 和声 |
| Melody | 主旋律 |
| Vocal | 人声，可选 |
| FX | 过渡音效 |
| Master | 总混音 |

### 波形区功能

| 功能 | 说明 |
|---|---|
| Waveform | 显示每条轨道波形 |
| Playhead | 播放指针 |
| Timeline | 时间刻度 |
| Region Select | 框选某一段 |
| Loop Region | 循环播放选区 |
| Cue Point | 标记关键点 |
| Section Marker | Intro / Build / Drop / Outro |
| Regenerate Region | 局部重生成 |
| Clip Replace | 替换某一段音频 |
| Version Compare | 对比不同生成版本 |

### 局部重生成示例

用户在 Melody 轨道选中 00:16–00:24：

```text
让这段旋律更梦幻，但保持 BPM 和和弦不变
```

系统只重生成这一段，而不是重新生成整首歌。

---

## 5.3 Mixer 调音台区

底部做成传统调音台的 Channel Strip。

每条轨道一条 Strip：

```text
┌─────────────┐
│ Track Name  │
│ Level Meter │
│ Gain        │
│ EQ High     │
│ EQ Mid      │
│ EQ Low      │
│ Compressor  │
│ Reverb Send │
│ Delay Send  │
│ Pan         │
│ Mute / Solo │
│ Volume      │
└─────────────┘
```

### 每条轨道功能

| 控件 | 技术实现 |
|---|---|
| Volume | Web Audio API `GainNode` |
| Pan | Web Audio API `StereoPannerNode` |
| EQ Low / Mid / High | Web Audio API `BiquadFilterNode` |
| Compressor | Web Audio API `DynamicsCompressorNode` |
| Meter | Web Audio API `AnalyserNode` |
| Mute | Gain 设置为 0 |
| Solo | 其他轨道临时静音 |
| Reverb Send | Send Bus |
| Delay Send | Send Bus |
| Freeze | 锁定该轨道，不参与重生成 |
| Regenerate | 只重生成当前轨道 |

---

## 5.4 版本管理区

AI 音乐生成的核心问题是结果不可完全预测，因此版本管理非常重要。

### 建议功能

| 功能 | 说明 |
|---|---|
| Version List | 显示所有生成版本 |
| Snapshot | 保存当前混音状态 |
| Compare | 对比两个版本 |
| Restore | 恢复历史版本 |
| Duplicate | 基于当前版本复制新版本 |
| Rename | 给版本命名 |
| Delete | 删除不需要的版本 |

### 版本保存内容

每个版本建议保存：

- Prompt
- 生成参数
- Track 音频地址
- Mixer 状态
- Region 信息
- Section Marker
- 创建时间
- Seed
- 导出状态

---

## 5.5 右侧 AI 控制区

右侧面板不建议只做聊天窗口，而应服务于具体音乐编辑动作。

### 建议功能

| 功能 | 说明 |
|---|---|
| Suggestions | AI 对当前音乐提出修改建议 |
| Regenerate Panel | 针对选区进行局部重生成 |
| Arrangement Panel | 调整 Intro / Drop / Outro |
| Style Transfer | 改变曲风 |
| Mood Shift | 改变情绪 |
| Explain Parameters | 解释当前参数 |
| History | 显示用户最近操作 |

---

## 6. MVP 功能范围

第一版不要做成完整 DAW。建议聚焦：

> **生成 → 分轨 → 播放 → 调音 → 保存版本**

### 6.1 MVP 必做功能

| 模块 | 功能 |
|---|---|
| AI 生成 | Prompt、Style、BPM、Key、Duration |
| 音频播放 | Play、Pause、Stop、Seek |
| 多轨 | Drums、Bass、Melody、Master 至少 4 轨 |
| 调音台 | Volume、Mute、Solo、Pan |
| EQ | Low、Mid、High |
| 可视化 | Waveform、播放指针、Level Meter |
| 版本管理 | 保存每次生成结果 |
| Master | 总音量、Limiter |
| 项目保存 | 保存 Prompt、参数、轨道、混音状态 |

### 6.2 MVP 暂缓功能

| 功能 | 暂缓原因 |
|---|---|
| MIDI 控制器 | 浏览器兼容性和权限处理较复杂 |
| 多人协作 | 会显著增加状态同步复杂度 |
| 完整编曲系统 | 容易变成 DAW，开发量过大 |
| 插件市场 | 不适合早期 |
| 高精度离线母带 | 第二阶段再做 |
| 实时直播模式 | 对延迟和稳定性要求高 |

---

## 7. 前端技术架构

推荐架构：

```text
Next.js / React / TypeScript
  │
  ├─ UI Layer
  │   ├─ GeneratorPanel
  │   ├─ TimelineEditor
  │   ├─ WaveformTrack
  │   ├─ MixerConsole
  │   ├─ ChannelStrip
  │   ├─ MasterStrip
  │   └─ VersionPanel
  │
  ├─ State Layer
  │   ├─ Zustand / Redux
  │   ├─ tracks state
  │   ├─ generation state
  │   ├─ mixer state
  │   └─ project state
  │
  ├─ Audio Engine
  │   ├─ AudioContext
  │   ├─ Track Source
  │   ├─ GainNode
  │   ├─ BiquadFilterNode
  │   ├─ StereoPannerNode
  │   ├─ DynamicsCompressorNode
  │   ├─ AnalyserNode
  │   └─ Master Bus
  │
  ├─ Waveform Layer
  │   ├─ wavesurfer.js
  │   ├─ Regions Plugin
  │   └─ Timeline Plugin
  │
  ├─ API Client
  │   ├─ generate
  │   ├─ regenerate
  │   ├─ extend
  │   ├─ remix
  │   ├─ split stems
  │   └─ render export
  │
  └─ Realtime Layer
      ├─ WebSocket / SSE
      ├─ generation progress
      ├─ stem ready event
      └─ render status
```

---

## 8. Audio Engine 设计

### 8.1 单轨音频链路

```text
AudioBufferSource / MediaElementSource
  ↓
Track Gain
  ↓
EQ Low
  ↓
EQ Mid
  ↓
EQ High
  ↓
Compressor
  ↓
Stereo Panner
  ↓
Track Analyser
  ↓
Track Bus
  ↓
Master Gain
  ↓
Master Compressor / Limiter
  ↓
Master Analyser
  ↓
AudioContext.destination
```

### 8.2 Send FX 链路

如果加入 Reverb / Delay：

```text
Track Bus
  ├─ Dry Signal → Master Bus
  ├─ Reverb Send → Reverb Bus → Master Bus
  └─ Delay Send → Delay Bus → Master Bus
```

### 8.3 多轨同步原则

多条 Stem 必须严格对齐，不能使用多个独立 `<audio>` 标签各自播放。

建议：

- 使用统一 `AudioContext`
- 所有轨道使用同一个 `startTime`
- Stem 文件长度保持一致
- 后端统一 sample rate
- 前端统一 transport 控制
- Seek 时所有轨道一起重建 source node 并从相同 offset 播放

---

## 9. 数据结构建议

### 9.1 Track

```ts
type Track = {
  id: string
  name: 'Drums' | 'Bass' | 'Chords' | 'Melody' | 'Vocal' | 'FX' | 'Master'
  type: 'stem' | 'master'
  audioUrl: string
  waveformUrl?: string
  volume: number
  pan: number
  muted: boolean
  solo: boolean
  frozen: boolean
  eq: {
    low: number
    mid: number
    high: number
  }
  compressor: {
    enabled: boolean
    threshold: number
    ratio: number
    attack: number
    release: number
  }
  sends: {
    reverb: number
    delay: number
  }
}
```

### 9.2 GenerationState

```ts
type GenerationState = {
  prompt: string
  style: string
  bpm: number
  key: string
  mood?: string
  energy?: number
  duration: number
  structure: string[]
  seed?: number
  status: 'idle' | 'generating' | 'ready' | 'failed'
  progress: number
  currentVersionId?: string
}
```

### 9.3 GeneratedVersion

```ts
type GeneratedVersion = {
  id: string
  name: string
  createdAt: string
  prompt: string
  params: {
    style: string
    bpm: number
    key: string
    duration: number
    seed?: number
  }
  tracks: Track[]
  mixState: MixerState
}
```

### 9.4 Region

```ts
type Region = {
  id: string
  trackId: string
  start: number
  end: number
  label?: string
  type: 'loop' | 'section' | 'regenerate'
}
```

### 9.5 MixerState

```ts
type MixerState = {
  masterVolume: number
  masterLimiterEnabled: boolean
  tracks: Record<string, {
    volume: number
    pan: number
    muted: boolean
    solo: boolean
    eq: {
      low: number
      mid: number
      high: number
    }
    sends: {
      reverb: number
      delay: number
    }
  }>
}
```

---

## 10. 后端接口建议

### 10.1 生成音乐

```http
POST /api/music/generate
```

请求：

```json
{
  "prompt": "生成一段适合夜晚开车的 Lo-fi house",
  "style": "lo-fi house",
  "bpm": 118,
  "key": "A minor",
  "duration": 60,
  "stems": ["drums", "bass", "chords", "melody", "master"]
}
```

返回：

```json
{
  "jobId": "gen_123",
  "status": "generating"
}
```

---

### 10.2 查询生成进度

```http
GET /api/music/jobs/gen_123
```

返回：

```json
{
  "jobId": "gen_123",
  "status": "ready",
  "progress": 100,
  "result": {
    "bpm": 118,
    "key": "A minor",
    "tracks": {
      "drums": "https://cdn.example.com/drums.wav",
      "bass": "https://cdn.example.com/bass.wav",
      "chords": "https://cdn.example.com/chords.wav",
      "melody": "https://cdn.example.com/melody.wav",
      "master": "https://cdn.example.com/master.wav"
    }
  }
}
```

---

### 10.3 局部重生成

```http
POST /api/music/regenerate-region
```

请求：

```json
{
  "projectId": "project_001",
  "versionId": "version_001",
  "trackId": "melody",
  "start": 16,
  "end": 24,
  "instruction": "让这段旋律更梦幻，但保持节奏和和弦不变",
  "keepContext": true
}
```

返回：

```json
{
  "jobId": "regen_456",
  "status": "generating"
}
```

---

### 10.4 导出混音

```http
POST /api/music/render
```

请求：

```json
{
  "projectId": "project_001",
  "versionId": "version_001",
  "format": "wav",
  "mixState": {
    "tracks": []
  }
}
```

返回：

```json
{
  "jobId": "render_789",
  "status": "rendering"
}
```

---

## 11. React 组件拆分

建议组件树：

```text
App
├─ ProjectHeader
│  ├─ ProjectName
│  ├─ SaveButton
│  └─ ExportButton
│
├─ GeneratorPanel
│  ├─ PromptInput
│  ├─ StyleSelector
│  ├─ BPMControl
│  ├─ KeySelector
│  ├─ EnergyKnob
│  ├─ DurationSelector
│  └─ GenerateButton
│
├─ Workspace
│  ├─ LeftLibraryPanel
│  │  ├─ ClipLibrary
│  │  ├─ StemList
│  │  └─ VersionList
│  │
│  ├─ TimelineEditor
│  │  ├─ TransportBar
│  │  ├─ TimeRuler
│  │  ├─ WaveformTrackList
│  │  └─ RegionOverlay
│  │
│  └─ RightAIPanel
│     ├─ Suggestions
│     ├─ RegeneratePanel
│     ├─ ArrangementPanel
│     └─ HistoryPanel
│
└─ MixerConsole
   ├─ ChannelStrip Drums
   ├─ ChannelStrip Bass
   ├─ ChannelStrip Chords
   ├─ ChannelStrip Melody
   ├─ ChannelStrip Vocal
   ├─ FXReturnStrip
   └─ MasterStrip
```

---

## 12. UI 视觉方向

### 12.1 视觉原则

| 项目 | 建议 |
|---|---|
| 整体风格 | 深色专业音频仪表盘 |
| 参考气质 | Ableton + Rekordbox + OBS Audio Mixer |
| 主视觉 | 波形、音轨、推子、电平表 |
| AI 感 | 参数化控制台，而不是聊天机器人界面 |
| 色彩 | 深灰背景，绿色电平，黄色峰值，红色过载 |
| 控件 | 推子、旋钮、开关、按钮、轨道卡片 |
| 反馈 | 所有参数变化都要实时反映到声音和 Meter |

### 12.2 核心设计判断

调音台 UI 的价值不是“像不像设备”，而是让用户相信：

> **AI 生成音乐是可控制、可编辑、可保存、可迭代的。**

---

## 13. 开发阶段规划

## Phase 0：原型验证

目标：确认 UI 方向和音频链路可行。

交付物：

| 任务 | 结果 |
|---|---|
| Figma / HTML 原型 | 完成页面布局 |
| 固定音频素材 | 用本地音频模拟 AI 生成结果 |
| 简单播放 | 多轨同时播放 |
| 基础调音 | Volume / Mute / Solo |

---

## Phase 1：前端音频引擎

目标：做出真正可用的 Web 调音台。

交付物：

| 任务 | 结果 |
|---|---|
| AudioContext 管理 | 初始化音频引擎 |
| Track Node Graph | 每条轨道独立音频链路 |
| Volume / Pan | 可实时控制 |
| EQ | 三段 EQ |
| Meter | 每条轨道实时电平 |
| Master Bus | 总线控制 |

---

## Phase 2：波形与时间轴

目标：把音乐从“播放文件”变成“可视化编辑对象”。

交付物：

| 任务 | 结果 |
|---|---|
| wavesurfer.js 接入 | 显示波形 |
| 多轨时间轴 | 多条 Stem 对齐 |
| Region 选择 | 可框选片段 |
| Loop | 选区循环播放 |
| Marker | 标记 Intro / Drop / Outro |

---

## Phase 3：AI 生成接口接入

目标：把前端调音台和音乐生成服务打通。

交付物：

| 任务 | 结果 |
|---|---|
| Generate API | 根据 Prompt 生成 |
| Job 状态 | 显示生成进度 |
| Stem 加载 | 自动加载到各轨道 |
| Version 保存 | 保存生成历史 |
| Error State | 处理失败、超时、重试 |

---

## Phase 4：局部重生成与导出

目标：形成差异化产品能力。

交付物：

| 任务 | 结果 |
|---|---|
| Region Regenerate | 选中片段后重生成 |
| Freeze Track | 锁定不想改的轨道 |
| Mix Snapshot | 保存混音状态 |
| Render API | 后端渲染导出 |
| Export | WAV / MP3 导出 |

---

## 14. 技术选型建议

| 层级 | 推荐 |
|---|---|
| 前端框架 | Next.js / React |
| 语言 | TypeScript |
| 状态管理 | Zustand |
| UI 组件 | Radix UI / shadcn/ui |
| 样式 | Tailwind CSS |
| 波形 | wavesurfer.js |
| 音频引擎 | Web Audio API |
| 实时通信 | SSE / WebSocket |
| 可视化 | Canvas / SVG |
| 后端 | FastAPI / Node.js |
| 音频处理 | Python / FFmpeg |
| 存储 | S3 / R2 / MinIO |
| 数据库 | PostgreSQL |
| 队列 | Redis Queue / Celery / BullMQ |

---

## 15. 关键风险与解决方案

### 15.1 多轨同步风险

问题：

多条 Stem 必须严格对齐，否则听感会崩。

解决方案：

- 所有 Stem 使用同一个 `AudioContext.currentTime` 启动。
- 统一 BPM、Duration、Sample Rate。
- 后端生成时保证所有 Stem 等长。
- 前端避免每条轨道独立 `<audio>` 播放。
- Seek 时统一重新调度所有 Track Source。

---

### 15.2 浏览器音频延迟风险

问题：

Web Audio API 可用，但复杂实时音频仍会受到浏览器、设备性能、音频文件大小影响。

解决方案：

- MVP 使用较短音频片段。
- 优先加载压缩预览文件。
- 导出时交给后端离线渲染。
- 前端负责实时预听，不负责最终母带级渲染。

---

### 15.3 许可证风险

问题：

部分开源项目可以参考，但不适合直接复制代码。

解决方案：

- Mixxx、Eyevinn/audio-mixer 等项目只借鉴产品结构和交互逻辑。
- 商用闭源产品核心代码建议自行实现。
- 使用依赖前确认许可证兼容性。
- 对 AGPL 项目尤其谨慎。

---

### 15.4 AI 生成不可控风险

问题：

用户最怕的是“生成结果玄学”。

解决方案：

- 提供 Seed。
- 提供版本历史。
- 提供 Freeze Track。
- 提供局部重生成。
- 提供参数可视化。
- 提供 A/B 对比。
- 支持恢复历史版本。

---

## 16. 最终推荐 MVP

第一版建议做成：

> **一个可以输入 Prompt 生成多轨音乐，并用 Web 调音台实时控制 Drums / Bass / Melody / Master 的前端仪表盘。**

MVP 页面包含：

```text
1. 顶部生成控制区
2. 左侧版本和素材栏
3. 中央多轨波形区
4. 右侧局部重生成和 AI 参数区
5. 底部调音台
```

MVP 功能包含：

```text
Prompt 生成
BPM / Key / Style 设置
多轨加载
播放 / 暂停 / 定位
Volume
Mute
Solo
Pan
三段 EQ
实时电平
版本保存
基础导出
```

---

## 17. 示例使用场景

用户输入：

```text
生成一段适合赛博澡堂子游戏大厅的电子音乐，120 BPM，偏复古合成器风格。
```

系统返回：

```text
Drums / Bass / Melody / Master 四条轨道。
```

用户操作：

```text
降低鼓组音量，提高 Bass，给 Melody 加一点 Reverb，框选 16–24 秒，让旋律更怪诞。
```

系统结果：

```text
生成一个新版本，可保存，可导出。
```

---

## 18. 后续增强方向

### 18.1 AI 自动混音

让系统根据曲风和频谱自动调整：

- 各轨音量
- EQ
- 压缩
- Reverb
- Delay
- Master Loudness

### 18.2 AI 自动编曲

支持自动生成：

- Intro
- Build-up
- Drop
- Break
- Outro

### 18.3 MIDI 控制器支持

后续可以通过 Web MIDI API 支持实体设备：

- 旋钮
- 推子
- Pad
- Transport 控制键

### 18.4 Live Mode

支持实时生成 Loop，并不断接入播放中的音乐：

```text
当前播放 8 小节
  ↓
AI 后台生成下一个 8 小节
  ↓
无缝接入
  ↓
用户继续调音和控制
```

### 18.5 多人协作

支持多人同时编辑同一个音乐项目：

- 一人负责生成
- 一人负责混音
- 一人负责编曲
- 一人负责导出

---

## 19. 总结

这个项目前端应该做成：

> **以调音台为视觉和交互核心的 AI 音乐生成仪表盘：上层负责生成，中层负责波形编辑，下层负责实时混音控制。**

最优先实现路径：

```text
生成控制 → 多轨波形 → Web Audio 调音台 → 版本管理 → 局部重生成
```

最终目标不是复刻传统 DJ 软件，而是建立一种新的交互方式：

> **让用户像操作调音台一样控制 AI 生成音乐。**
