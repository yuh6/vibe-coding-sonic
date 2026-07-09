# RoomWave 项目整改计划

> 基线：`~/Her工作间/RoomWave设计文档完整版.md`（v1.0）
> 目标项目：`/Users/niunan/project/vibe-coding-sonic`
> 生成日期：2026-07-09

---

## 一、现状总览

### 1.1 项目规模

| 维度 | 现状 |
|------|------|
| 前端 | 68 文件，584KB，React 18 + Vite + Tailwind |
| 后端 | 31 服务文件 + 12 路由文件，Express |
| 数据库 | 22 张表，SQLite/PG 双驱动，手写 SQL |
| 依赖 | 无 TypeScript，无 ORM，无状态管理库 |
| 架构 | 单体 monolith，无 workspace 拆分 |

### 1.2 与设计文档的匹配度

| 设计文档模块 | 匹配度 | 状态 |
|-------------|--------|------|
| MBTI 16型预设 | ★★★★☆ | 基本完整，mbti-profiles.json 有 16 型 |
| Prompt Composer | ★★★☆☆ | 有 PHASE_PRESETS + axis remix，缺三层结构 |
| 生成流水线 | ★★★★☆ | GenerationPipeline 完整，但过于臃肿 |
| TTAPI/Suno 对接 | ★★★★☆ | sunoClient 完整，V5 参数支持需升级 |
| 普通播放器 | ★★☆☆☆ | usePlayer 单曲播放，缺底部播放器/队列管理 |
| DJ 模式 | ★★☆☆☆ | DJConsolePage 仅 96 行骨架，缺核心功能 |
| 音乐库 | ★★☆☆☆ | 4 张表碎片化，无统一 Track 模型 |
| 音频分析 | ★☆☆☆☆ | 完全缺失（BPM 仅由 Suno 返回） |
| 版本管理 | ★☆☆☆☆ | 完全缺失 |
| 智能歌单 | ★☆☆☆☆ | 完全缺失 |
| 标签系统 | ★☆☆☆☆ | 完全缺失 |
| MBTI 生成器升级 | ★☆☆☆☆ | 仅有基础 4 轴滑块，缺 AI 对话/锁定/连续滑块 |
| Crossfade | ★★☆☆☆ | crossfadeDeck.js 基础实现，缺曲线/预加载 |
| Waveform | ★★☆☆☆ | WaveformTrack.jsx 存在但简陋 |

---

## 二、逐模块差距分析

### 2.1 数据库层（差距最大）

**现状**：22 张表，但 Track 相关数据碎片化在 4 张表中：

```
tracks            → 用户个人库（极简：id, user_id, title, mbti, mode, prompt, audio_url）
generation_jobs   → 生成任务生命周期
shared_library    → 社区共享库
song_catalog      → 统一目录（但字段不够）
```

**设计文档要求**：一个统一的 Track 模型（§12.1），包含：
- 存储字段：storageType, localPath, format, sampleRate, bitDepth, bitRate, fileSize
- 播放统计：playCount, lastPlayedAt, totalPlayDurationMs
- 版本控制：versionGroupId, versionIndex
- 音频分析：analyzedAt, timeSignature, loudness

**缺失的表**：

| 表 | 设计文档章节 | 优先级 |
|----|-------------|--------|
| `version_groups` | §12.10 | P1 |
| `version_edges` | §12.10 | P1 |
| `tags` + `track_tags` | §12.12 | P2 |
| `smart_playlist_rules` | §12.11 | P2 |
| `audio_analysis` | §26.3 | P1 |
| `user_play_sessions` | §12.14 | P1 |
| `crates` | §7.2 | P2 |
| `dj_sets` + `dj_set_items` | §7.3 / §12.8-9 | P2 |

**整改建议**：

```
Phase 1: 统一 Track 模型
  - 新建 roomwave_tracks 表，合并 tracks + generation_jobs + shared_library + song_catalog
  - 添加缺失字段（storage, analysis, version, stats）
  - 写迁移脚本，从旧表导入数据
  - 保留旧表为只读（向后兼容）

Phase 2: 补齐缺失表
  - version_groups + version_edges
  - audio_analysis
  - tags + track_tags
  - smart_playlist_rules（扩展 playlists 表）
```

### 2.2 Prompt Compiler（差距大）

**现状**：`promptComposer.js`（415 行）
- 有 PHASE_PRESETS（7 阶段）
- 有 AXIS_DESCRIPTORS（4 轴关键词）
- 有 buildStyleAdjustments（energy/texture/brightness 3 个推子）
- composePrompt() 拼接 prompt，200 字符截断
- 无 MusicDNA 中间结构
- 无三层编译架构

**设计文档要求**（§13.1）：

| 层 | 现状 | 差距 |
|----|------|------|
| Personality Layer | axes + profile 基础映射 | 缺认知功能权重、人格混合输入 |
| Music Control Layer | 3 个推子 | 缺 BPM/Genre/Mood/Vocal/Instruments/Structure/Scene 独立控制 |
| Conversation Patch Layer | 无 | 完全缺失 |

**整改建议**：

```
Phase 1: 引入 MusicDNA 中间结构
  - 在 promptComposer 中间层生成 MusicDNA 对象
  - composePrompt() 改为 MusicDNA → prompt 字符串
  - 保持向后兼容（旧调用方式走默认 MusicDNA）

Phase 2: 三层编译架构
  - PersonalityLayer: axes + profile + cognitiveFunctions + blend
  - MusicControlLayer: 10 个音乐控制滑块 → MusicDNA
  - ConversationPatchLayer: AI 对话 → patch MusicDNA
```

### 2.3 MBTI 生成器前端（差距大）

**现状**：
- `MBTIRemixDeck.jsx`（116 行）：4 个 axis 滑块（ie/ns/tf/jp）
- `StyleFaders.jsx`：energy/texture/brightness 3 个推子
- `ModePads.jsx`：7 个阶段选择
- 无 AI 对话面板
- 无参数锁定
- 无连续滑块（当前是 0-100 但语义不清晰）

**设计文档要求**（§28）：

| 功能 | 现状 | 差距 |
|------|------|------|
| 四维人格滑块（0-100 连续） | 有，但范围 -100~100 | 需统一为 0-100 |
| 音乐风格滑块（10 个） | 仅 3 个 | 缺 7 个 |
| AI 对话调参 | 无 | 完全缺失 |
| 参数锁定 | 无 | 完全缺失 |
| 状态优先级（4 层） | 无 | 完全缺失 |
| 人格混合 UI | 无 | 完全缺失 |

**整改建议**：

```
Phase 1: 滑块升级
  - axes 范围从 -100~100 改为 0~100
  - 新增 7 个音乐风格滑块（warmth, abstractness, structure, groove, vocalPresence, experimental, space, retro, darkness）
  - 前端布局改为左右分栏（左：人格控制，右：AI 对话）

Phase 2: AI 对话面板
  - 新增 ChatPanel 组件
  - 用户输入 → LLM 解析 intent → 生成 MusicControlState patch
  - 显示 AI 建议改动 + 确认/撤销按钮

Phase 3: 参数锁定 + 状态优先级
  - 每个参数旁加锁定图标
  - 4 层优先级：Base Preset < User Slider < Chat Patch < Manual Override
```

### 2.4 播放器（差距大）

**现状**：
- `usePlayer.js`（255 行）：Howler.js 单曲播放
- 无底部播放器 UI 组件
- 无 Queue 管理
- 无 Crossfade 配置
- 无播放状态持久化
- 无预加载策略

**设计文档要求**（§27）：

| 功能 | 现状 | 差距 |
|------|------|------|
| 底部播放器 UI | 无 | 需新建 |
| QueueItem 结构 | 无 | 需新建 |
| CrossfadeConfig | crossfadeDeck.js 基础实现 | 缺曲线/配置 |
| PersistedPlayerState | 无 | 需新建 |
| PreloadStrategy | 无 | 需新建 |
| PlayerErrorRecovery | 无 | 需新建 |
| KEYBOARD_SHORTCUTS | 无 | 需新建 |

**整改建议**：

```
Phase 1: 底部播放器 + Queue
  - 新建 BottomPlayer.jsx 组件（封面/进度/控制/队列）
  - usePlayer 升级：支持 Queue、repeat、shuffle
  - localStorage 持久化播放状态

Phase 2: Crossfade 升级
  - crossfadeDeck.js 加入曲线配置（linear/equal_power/exponential）
  - 预加载下一首（剩余 < threshold 时触发）
  - Howl 实例生命周期管理
```

### 2.5 DJ 模式（差距大）

**现状**：
- `DJConsolePage.jsx`（96 行）：仅骨架
- `MixerPage.jsx`（769 行）：Web Audio 多轨混音
- `arranger/` 目录：自动 DJ 引擎（状态机）
- 无 Deck A/B 双播放器
- 无 DJ Crate
- 无 Set Builder
- 无 Waveform 显示

**设计文档要求**（§15）：

| 功能 | 现状 | 差距 |
|------|------|------|
| Deck A/B 双播放器 | 无 | 需新建 |
| Waveform | WaveformTrack.jsx 简陋 | 需重写 |
| Cue / Loop | 无 | 需新建 |
| Stem 开关 | 无 | 需新建 |
| Mixer (EQ/Filter) | MixerPage 有基础 | 需完善 |
| Crossfader | 无 | 需新建 |
| DJ Crate | trackPool 概念不同 | 需重新映射 |
| Track Browser | 无 | 需新建 |
| Set Builder | arranger 有 phaseArrangement | 需新建 UI |
| Energy Curve | arranger 有 macroArc | 需可视化 |

**整改建议**：

```
Phase 1: DJ 模式基础
  - 重写 DJConsolePage.jsx 为完整布局
  - 新建 DeckA.jsx / DeckB.jsx 双播放器
  - 新建 MixerPanel.jsx（Volume/Crossfader/ EQ MVP）
  - 新建 CratePanel.jsx（DJ 素材箱）

Phase 2: DJ 模式进阶
  - Waveform 重写（canvas 绘制）
  - Cue/Loop 控件
  - Stem 开关
  - Set Builder UI
```

### 2.6 音乐库管理（差距中等）

**现状**：
- `SharedLibraryBrowser.jsx`（138 行）：简单浏览
- `PlaylistManager.jsx`（322 行）：基础 CRUD
- 搜索仅支持标题

**设计文档要求**（§17-18）：

| 功能 | 现状 | 差距 |
|------|------|------|
| 全文搜索 | 无 | 需新建 |
| 多维筛选 | 无 | 需新建 |
| 标签系统 | 无 | 需新建 |
| 智能歌单 | 无 | 需新建 |
| 版本历史面板 | 无 | 需新建 |

**整改建议**：

```
Phase 1: 搜索与筛选
  - 后端 GET /api/v1/tracks 支持 q/mbti/genre/bpm/energy/mood/vocal/source/tag/sort/page
  - 前端搜索栏 + 筛选面板

Phase 2: 标签 + 智能歌单
  - 标签 CRUD API
  - 智能歌单规则引擎
```

### 2.7 音频分析（完全缺失）

**设计文档要求**（§26.3）：生成后自动触发分析，产出 BPM/Key/Waveform/Beat Grid/段落识别。

**现状**：BPM 仅由 Suno 返回，无本地分析能力。

**整改建议**：

```
Phase 2: Audio Analysis Service
  - 引入 Web Audio API 或 audiowaveform 做本地分析
  - 新建 audio_analysis 表
  - 生成完成后异步触发分析
  - 波形数据存储 + 前端 canvas 渲染
```

---

## 三、整改优先级排序

### P0 — 阻塞性（不做后续无法推进）

| # | 改动 | 涉及文件 | 预估工时 |
|---|------|---------|---------|
| 1 | 统一 Track 数据模型 | migrations.js, 新建 trackService.js | 2 天 |
| 2 | MusicDNA 中间结构 | promptComposer.js | 1 天 |
| 3 | 底部播放器 + Queue | 新建 BottomPlayer.jsx, usePlayer.js | 2 天 |
| 4 | axes 范围统一 (0-100) | promptComposer.js, MBTIRemixDeck.jsx, profiles 表 | 0.5 天 |

### P1 — 核心功能（产品可用性）

| # | 改动 | 涉及文件 | 预估工时 |
|---|------|---------|---------|
| 5 | 三层 Prompt Compiler | promptComposer.js 重构 | 2 天 |
| 6 | 音乐风格滑块（10 个） | 新建 MusicSliders.jsx | 1 天 |
| 7 | Crossfade 升级 | crossfadeDeck.js, usePlayer.js | 1 天 |
| 8 | DJ 模式基础（Deck A/B + Mixer） | 重写 DJConsolePage.jsx, 新建 Deck*.jsx | 3 天 |
| 9 | 音频分析服务 | 新建 audioAnalysis.js, 新建 audio_analysis 表 | 2 天 |
| 10 | 版本管理 | 新建 versionService.js, version_groups/edges 表 | 1.5 天 |
| 11 | 播放状态持久化 | usePlayer.js + localStorage | 0.5 天 |
| 12 | 预加载策略 | usePlayer.js | 0.5 天 |

### P2 — 增强功能（差异化）

| # | 改动 | 涉及文件 | 预估工时 |
|---|------|---------|---------|
| 13 | AI 对话调参面板 | 新建 ChatPanel.jsx, LLM 解析 | 3 天 |
| 14 | 参数锁定 + 状态优先级 | MBTIRemixDeck.jsx, 新增 lockState | 1 天 |
| 15 | 人格混合 UI | 新建 BlendPanel.jsx | 1 天 |
| 16 | 搜索与筛选 | 新建搜索 API + SearchBar.jsx | 1.5 天 |
| 17 | 标签系统 | tagService.js, TagManager.jsx | 1 天 |
| 18 | 智能歌单 | smartPlaylistService.js | 1.5 天 |
| 19 | DJ Crate | 重写 trackPool → crate 概念 | 1 天 |
| 20 | Set Builder UI | 新建 SetBuilder.jsx | 2 天 |
| 21 | Waveform 重写 | canvas 绘制 + beat grid | 1.5 天 |

### P3 — 完善（体验打磨）

| # | 改动 | 涉及文件 | 预估工时 |
|---|------|---------|---------|
| 22 | 键盘快捷键 | 新建 keyboardShortcuts.js | 0.5 天 |
| 23 | 错误恢复策略 | usePlayer.js | 0.5 天 |
| 24 | 无障碍 | 全局 aria-label | 1 天 |
| 25 | 离线播放 | Service Worker | 2 天 |
| 26 | Cue / Loop 控件 | Deck 组件 | 1 天 |
| 27 | Stem 开关 | Deck 组件 | 1 天 |
| 28 | Energy Curve 可视化 | SetBuilder 内 | 1 天 |

---

## 四、推荐执行路径

### 阶段一：数据层统一 + 播放器（3-4 天）

**目标**：解决最大的架构债务，让后续开发有统一的数据基础。

1. 新建 `roomwave_tracks` 表，合并 4 张碎片表
2. 写迁移脚本，从旧表导入
3. 新建 `BottomPlayer.jsx`（Spotify 风格底部播放器）
4. `usePlayer.js` 升级：Queue、repeat、shuffle、localStorage 持久化
5. axes 范围统一为 0-100

**验收标准**：旧数据可查询，新播放器可播放/暂停/切歌/队列管理，刷新页面状态不丢失。

### 阶段二：MBTI 生成器升级（3-4 天）

**目标**：从"选预设生成"升级为"连续参数 + AI 对话调参"。

1. `promptComposer.js` 引入 MusicDNA 中间结构
2. 三层 Prompt Compiler 架构
3. 10 个音乐风格滑块前端
4. AI 对话面板（LLM 解析 intent → patch MusicDNA）
5. 参数锁定 + 4 层状态优先级

**验收标准**：用户可调 10 个滑块 + AI 对话微调，生成结果可预测。

### 阶段三：DJ 模式 + 音乐库（4-5 天）

**目标**：DJ 模式从骨架变为可用。

1. 重写 `DJConsolePage.jsx` 为完整布局
2. Deck A/B 双播放器
3. Mixer（Volume/Crossfader/EQ MVP）
4. DJ Crate 面板
5. 搜索与筛选 API
6. 音频分析服务（BPM/Waveform/Beat Grid）

**验收标准**：可双 Deck 播放、Crossfade 混音、按 MBTI/BPM 筛选素材。

### 阶段四：差异化功能（5-6 天）

**目标**：RoomWave 独有能力。

1. 版本管理（VersionGroup + VersionEdge）
2. 标签系统
3. 智能歌单规则引擎
4. Set Builder UI
5. 人格混合 UI
6. Waveform 重写（canvas + beat grid）
7. Cue / Loop / Stem 控件

**验收标准**：可管理版本树、自动标签、智能歌单、DJ Set 编排。

### 阶段五：体验打磨（2-3 天）

1. 键盘快捷键
2. 错误恢复
3. 无障碍
4. 离线播放（PWA）
5. Crossfade 曲线配置
6. 预加载策略

---

## 五、架构改造建议

### 5.1 文件拆分（当前最大的代码债务）

| 文件 | 行数 | 建议 |
|------|------|------|
| `MBTIWAVE.jsx` | 1201 | 拆为 HomePage/ + HeroVideoPlayer + SoloRemixDeck + LiveRadioPanel |
| `App.jsx` | 713 | 状态管理提取到 stores/（可用 zustand 或 useReducer） |
| `generationPipeline.js` | 541 | 已拆出 jobStore/audioPersistor/fallbackEngine，剩余 coordinator 逻辑 |
| `MixerPage.jsx` | 769 | 拆为 MixerLayout + ChannelList + MasterSection |

### 5.2 建议引入的工具

| 工具 | 理由 | 优先级 |
|------|------|--------|
| Zustand | App.jsx 20+ useState 需要集中管理 | P1 |
| Canvas API | Waveform 绘制需要高性能渲染 | P1 |
| Web Audio API 分析器 | 本地 BPM/Waveform 分析 | P2 |

### 5.3 不建议引入的

| 工具 | 理由 |
|------|------|
| TypeScript | 当前团队习惯 JS，迁移成本高，MVP 阶段不值得 |
| ORM (Prisma/Drizzle) | 手写 SQL + DAL 已经够用，ORM 增加学习成本 |
| Next.js | 当前 Vite SPA 够用，迁移破坏性大 |

---

## 六、风险与注意事项

1. **数据库迁移风险**：合并 4 张表为 1 张时，必须保留旧表只读 + 新表写入的过渡期，不能一步切换。
2. **向后兼容**：promptComposer 的 composePrompt() 接口不能一步改掉，需要保留旧签名 + 新 MusicDNA 路径并行。
3. **音频文件**：合并 Track 模型时，注意 audio_url 可能指向不同存储（TTAPI CDN / 本地 / R2），迁移脚本需要验证 URL 可达性。
4. **性能**：音频分析是 CPU 密集型，必须异步队列处理，不能阻塞请求。
5. **AI 对话**：需要选择 LLM 供应商，当前项目已有 11 个 LLM provider，可复用 llm/index.js。

---

## 七、总工时估算

| 阶段 | 工时 | 累计 |
|------|------|------|
| 阶段一：数据层 + 播放器 | 3-4 天 | 3-4 天 |
| 阶段二：MBTI 生成器升级 | 3-4 天 | 6-8 天 |
| 阶段三：DJ 模式 + 音乐库 | 4-5 天 | 10-13 天 |
| 阶段四：差异化功能 | 5-6 天 | 15-19 天 |
| 阶段五：体验打磨 | 2-3 天 | 17-22 天 |

**结论**：当前项目已经覆盖了设计文档约 35% 的功能，主要差距在数据模型统一、MBTI 生成器升级、DJ 模式完善、音频分析四个方向。按上述路径执行，约 3-4 周可完成从 hackathon 项目到 RoomWave v1.0 的转型。
