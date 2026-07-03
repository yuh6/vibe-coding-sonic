# AI 音乐引擎 · 设计文档 v2

> vibe-coding-sonic 核心模块

---

## 架构总览

```
┌─────────────────────────────────────────────────────┐
│                    用户输入层                         │
│  MBTI 滑块 │ 项目阶段 │ 项目内容 │ 风格 │ 人声 │ 备注 │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                   组装器 (Assembler)                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────────┐   │
│  │ Prompt     │ │ Lyrics     │ │ Structure      │   │
│  │ Composer   │ │ Generator  │ │ Tag Builder    │   │
│  └────────────┘ └────────────┘ └────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│               编排引擎 (Arranger) 🎧                  │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │ Macro Arc│ │ Phase    │ │ Sensing Layer      │   │
│  │ 宏观弧线  │ │ Arranger │ │ 感知层             │   │
│  └──────────┘ └──────────┘ └────────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │ Track    │ │ Mood     │ │ Serendipity        │   │
│  │ Decision │ │ Pacing   │ │ 惊喜机制            │   │
│  └──────────┘ └──────────┘ └────────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                  生成器 (Generator)                   │
│  ┌──────────┐ ┌──────────────┐ ┌────────────────┐   │
│  │ TTAPI    │ │ Generation   │ │ Crossfade      │   │
│  │ Suno     │ │ Scheduler    │ │ Player         │   │
│  │          │ │ 生成调度+缓冲 │ │ 交叉淡入        │   │
│  └──────────┘ └──────────────┘ └────────────────┘   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│                   存储层 (Storage)                    │
│  SQLite: sessions / track_pool / play_history /      │
│          project_cache                               │
└─────────────────────────────────────────────────────┘
```

---

## 1. MBTI 模块

### 1.1 滑块设计

四个独立滑块，每个范围 0-100，中间值 50 为分界：

```
I ◄─────────┼─────────► E
0          50         100

S ◄─────────┼─────────► N
0          50         100

T ◄─────────┼─────────► F
0          50         100

J ◄─────────┼─────────► P
0          50         100
```

### 1.2 类型判定规则

```javascript
function resolveMBTI(sliders) {
  return {
    type: [
      sliders.IE < 50 ? 'I' : 'E',
      sliders.SN < 50 ? 'S' : 'N',
      sliders.TF < 50 ? 'T' : 'F',
      sliders.JP < 50 ? 'J' : 'P',
    ].join(''),
    // 每个维度的强度（0-1），用于 prompt 权重
    intensity: {
      IE: Math.abs(sliders.IE - 50) / 50,   // 0=中间态, 1=极端
      SN: Math.abs(sliders.SN - 50) / 50,
      TF: Math.abs(sliders.TF - 50) / 50,
      JP: Math.abs(sliders.JP - 50) / 50,
    },
  };
}
```

### 1.3 视觉映射

四个维度组合成最终颜色：

| 维度 | 映射规则 |
|------|---------|
| 基底色 | NT=🟣紫, NF=🟢绿, SJ=🔵蓝, SP=🟡黄 |
| I/E → 明暗 | I 偏暗（低明度），E 偏亮（高明度） |
| S/N → 饱和度 | S 偏灰（低饱和），N 偏鲜艳（高饱和） |
| T/F → 色温 | T 偏冷色，F 偏暖色 |
| J/P → 纹理 | J 偏几何/规则纹理，P 偏有机/流体纹理 |

**颜色计算公式**：
```
base = 氛围色（紫/绿/蓝/黄）
lightness = 40% + (IE值 / 100) × 30%    // I→40%暗, E→70%亮
saturation = 40% + (SN值 / 100) × 40%    // S→40%灰, N→80%艳
warmth = TF值 / 100                       // T→冷调偏移, F→暖调偏移
```

### 1.4 MBTI → Prompt 映射逻辑

```
MBTI 类型 + 维度强度 → 查询 mbti-prompts.js → 获取基础 prompt
强度修正：
  - 某维度接近 50（中间态）→ 该维度对应的音乐特征减弱
  - 某维度极端（接近 0 或 100）→ 该维度对应的音乐特征加强
```

示例：INTJ 但 I 强度只有 0.2（接近中间态）
→ 基础 prompt 是 INTJ 暗色系，但"内省"特征减弱，适当增加一些"社交感"元素

---

## 2. 项目阶段模块

### 2.1 预设阶段

| 阶段 ID | 名称 | BPM 修正 | 风格倾向 | 触发方式 |
|---------|------|---------|---------|---------|
| `brainstorm` | 头脑风暴 | +5 | playful, varied, surprising | 手动 / 日程 |
| `focus` | 专注构思 | -10 | ambient, minimal, steady | 手动 / 日程 |
| `sprint` | 代码冲刺 | +20 | driving, urgent, high energy | 手动 / 偏差 |
| `charge` | 战鼓催阵 | +15 | epic, powerful, heroic | 手动 / 日程 |
| `behind` | 落后了 | +25 | urgent, tense, pushing | 手动 |
| `break` | 休息一下 | -20 | chill, relaxed, mellow | 手动 |
| `celebrate` | 完成了！ | +10 | triumphant, joyful, euphoric | 手动 |

### 2.2 自动切换逻辑

```
用户设置日程时间线
    ↓
系统每分钟检查当前时间 vs 日程节点
    ↓
到达节点 → 自动切换阶段 → 触发音乐生成
    ↓
用户手动切换 → 覆盖自动判断
```

### 2.3 阶段 → 音乐参数映射

```javascript
const PHASE_PRESETS = {
  brainstorm: {
    bpmOffset: +5,
    styleTags: 'playful, varied, dynamic, surprising, moderate energy',
    weirdness: 60,        // V5 参数：偏高，更多变化
    styleInfluence: 50,   // V5 参数：中等，允许 AI 发挥
  },
  focus: {
    bpmOffset: -10,
    styleTags: 'ambient, minimal, spacious, steady, low energy',
    weirdness: 40,
    styleInfluence: 70,   // 更贴合 prompt
  },
  sprint: {
    bpmOffset: +20,
    styleTags: 'driving, urgent, high energy, relentless, propulsive',
    weirdness: 45,
    styleInfluence: 75,
  },
  charge: {
    bpmOffset: +15,
    styleTags: 'epic, powerful, heroic, building to climax',
    weirdness: 50,
    styleInfluence: 65,
  },
  behind: {
    bpmOffset: +25,
    styleTags: 'urgent, tense, pushing, countdown, high stakes',
    weirdness: 45,
    styleInfluence: 70,
  },
  break: {
    bpmOffset: -20,
    styleTags: 'chill, relaxed, mellow, easygoing, soft',
    weirdness: 55,
    styleInfluence: 60,
  },
  celebrate: {
    bpmOffset: +10,
    styleTags: 'triumphant, joyful, euphoric, confetti, celebration',
    weirdness: 55,
    styleInfluence: 60,
  },
};
```

---

## 3. 项目内容解析器（可选）

### 3.1 流程

```
用户关联项目文件夹
    ↓
扫描文件列表（排除 node_modules, .git, dist 等）
    ↓
读取关键文件：README.md, package.json, pyproject.toml, Cargo.toml 等
    ↓
LLM 分析 → 输出结构化 JSON
    ↓
注入 prompt 构造器
```

### 3.2 LLM 分析 Prompt

```
分析以下项目文件，提取音乐生成相关的关键词。

项目文件：
{file_contents}

输出 JSON 格式：
{
  "project_type": "game|tool|ai_agent|social|data|creative|education|nature|finance|health",
  "themes": ["关键词1", "关键词2", "关键词3"],
  "mood": ["情绪1", "情绪2"],
  "instruments": ["适合的乐器1", "乐器2"],
  "avoid": ["不想要的风格1"],
  "description": "一段话描述这个项目是什么"
}

要求：
- themes 用英文，2-4 个关键词
- mood 用英文，2-3 个情绪词
- instruments 用 Suno 能识别的乐器名
- avoid 用 Suno 能识别的风格名
```

### 3.3 缓存

- 同一文件夹只解析一次，结果存 SQLite
- 文件变更时自动重新解析（watch 模式，可选）

---

## 4. 人声模块

### 4.1 开关

```
人声开关: ON / OFF
  OFF → Instrumental 模式，不生成歌词
  ON  → 调用歌词生成模块，生成带歌词的音乐
```

### 4.2 歌词生成模块

**输入变量**：
- MBTI 类型 + 强度
- 项目阶段
- 项目内容（可选）
- 用户备注（可选）

**生成流程**：

```
构建歌词生成 prompt
    ↓
调用 LLM（GPT-4 / Claude）
    ↓
输出结构化歌词（含结构标签）
    ↓
用户可编辑/确认
    ↓
发送到 Suno（Custom Mode + 歌词）
```

### 4.3 歌词生成 Prompt 模板

```
你是一个专业的歌词创作者，为 AI 音乐生成平台 Suno 创作歌词。

要求：
1. 根据以下信息创作歌词：
   - MBTI 类型：{mbti_type}（特质：{mbti_description}）
   - 当前阶段：{phase}（氛围：{phase_description}）
   - 项目主题：{project_themes}
   - 额外要求：{user_notes}

2. 歌词结构：
   - 使用 Suno 结构标签：[Intro], [Verse], [Chorus], [Bridge], [Outro]
   - 每段 4-8 行
   - 副歌要有 hook，朗朗上口
   - 适合 {language} 演唱

3. 风格参考：
   - 情绪：{mood_keywords}
   - 适合的演唱风格：{vocal_style}

4. 输出格式：
   直接输出带标签的歌词文本，不要额外解释。

示例输出：
[Intro: Ambient Texture]

[Verse 1]
代码在指尖流淌
屏幕映着星光
...
```

### 4.4 人声类型推荐（按 MBTI）

| MBTI 维度 | 推荐人声 |
|-----------|---------|
| I + T | Whispered, Spoken Word, Low-key Male/Female |
| I + F | Breathy, Ethereal, Intimate, Soft |
| E + T | Confident, Spoken, Narration |
| E + F | Powerful, Soulful, Belting, Diva |
| N | Ethereal, Robotic, Vocaloid |
| S | Natural, Raw, Acoustic-friendly |

---

## 5. 风格选择模块（可选）

### 5.1 预设风格列表

从 `genre-keywords.js` 中提取的热门风格，用户可直接选择：

```javascript
const POPULAR_STYLES = [
  { id: 'citypop',     label: 'City Pop',       category: '复古电子' },
  { id: 'futurefunk',  label: 'Future Funk',     category: '复古电子' },
  { id: 'synthwave',   label: 'Synthwave',       category: '复古电子' },
  { id: 'lofi',        label: 'Lo-Fi Hip Hop',   category: 'Chill' },
  { id: 'vaporwave',   label: 'Vaporwave',       category: '复古电子' },
  { id: 'kpop',        label: 'K-Pop',           category: '日韩流行' },
  { id: 'jpop',        label: 'J-Pop',           category: '日韩流行' },
  { id: '8bit',        label: '8-bit / Chiptune', category: '游戏' },
  { id: 'hiphop',      label: 'Hip Hop',         category: '嘻哈' },
  { id: 'trap',        label: 'Trap',            category: '嘻哈' },
  { id: 'house',       label: 'House',           category: '电子' },
  { id: 'techno',      label: 'Techno',          category: '电子' },
  { id: 'ambient',     label: 'Ambient',         category: '氛围' },
  { id: 'cinematic',   label: 'Cinematic',       category: '电影配乐' },
  { id: 'folk',        label: 'Folk',            category: '民谣' },
  { id: 'jazz',        label: 'Jazz',            category: '爵士' },
  { id: 'rock',        label: 'Rock',            category: '摇滚' },
  { id: 'piano',       label: 'Piano Solo',      category: '古典' },
  { id: 'orchestral',  label: 'Orchestral',      category: '古典' },
  { id: 'reggaeton',   label: 'Reggaeton',       category: '拉丁' },
];
```

### 5.2 风格优先级

```
用户手动选择 > 项目内容推荐 > MBTI 默认映射
```

用户留空 → 用 MBTI + 项目内容自动推断
用户选择 → 直接覆盖自动推断

---

## 6. 备注模块（可选）

### 6.1 自由文本输入

用户可以输入任意自然语言描述，例如：
- "想要有点赛博朋克的感觉"
- "不要太吵，适合深夜 coding"
- "参考《银翼杀手》的配乐风格"

### 6.2 AI 解析

```
用户备注 → LLM 解析 → 输出结构化关键词

输入："想要有点赛博朋克的感觉，不要太吵"
输出：
{
  "keywords": ["cyberpunk", "dark ambient", "synth"],
  "avoid": ["loud", "aggressive", "noisy"],
  "mood": ["futuristic", "dark", "atmospheric"]
}
```

---

## 7. 组装器 (Assembler)

### 7.1 核心职责

将所有模块的输出组装成最终的 Suno API 请求。

### 7.2 组装流程

```
┌─────────────┐
│ MBTI 模块    │ → 基础风格 + BPM 范围 + 人声类型
└──────┬──────┘
       │
┌──────┴──────┐
│ 阶段模块     │ → BPM 修正 + 阶段风格标签 + V5 参数
└──────┬──────┘
       │
┌──────┴──────┐
│ 内容解析器   │ → 项目主题关键词 + 乐器 + 情绪（可选）
└──────┬──────┘
       │
┌──────┴──────┐
│ 风格选择     │ → 覆盖或补充风格关键词（可选）
└──────┬──────┘
       │
┌──────┴──────┐
│ 备注解析     │ → 额外关键词 + 排除项（可选）
└──────┬──────┘
       │
┌──────┴──────┐
│ 歌词模块     │ → 结构标签 + 歌词文本（人声模式）
└──────┬──────┘
       ↓
┌──────────────────────────────────────────┐
│           最终 Suno 请求                  │
│                                          │
│  Style: [组装后的 prompt，≤200 字符]      │
│  Lyrics: [结构标签 + 歌词]（可选）        │
│  Instrumental: true/false                │
│  Weirdness: [阶段参数]                   │
│  Style Influence: [阶段参数]             │
│  Exclude: [排除项]                       │
└──────────────────────────────────────────┘
```

### 7.3 Prompt 组装规则

```javascript
function assemblePrompt({ mbti, phase, project, style, notes, vocals }) {
  // 1. 从 MBTI 数据库获取基础 prompt
  const base = MBTI_PROMPTS[mbti.type][phase.mode];

  // 2. 应用 BPM 修正
  const bpm = clamp(base.bpm + phase.bpmOffset, 60, 180);

  // 3. 合并风格关键词（优先级：用户选择 > 项目内容 > MBTI 默认）
  const styleParts = [
    base.style.split(',')[0],           // 流派锚点（保留）
    style || project?.instruments || '', // 用户选择或项目乐器
    phase.styleTags,                     // 阶段风格
    project?.mood || '',                 // 项目情绪
    notes?.keywords || '',               // 备注关键词
  ].filter(Boolean);

  // 4. 组装最终 prompt（控制在 200 字符内）
  let finalStyle = truncateStyle(styleParts.join(', '), 200);

  // 5. 确保以流派开头
  if (!isGenreFirst(finalStyle)) {
    finalStyle = `${base.style.split(',')[0]}, ${finalStyle}`;
  }

  // 6. 排除项
  const exclude = [
    project?.avoid || '',
    notes?.avoid || '',
  ].filter(Boolean).join(', ');

  return {
    style: finalStyle,
    lyrics: vocals?.lyrics || null,
    instrumental: !vocals?.enabled,
    weirdness: phase.weirdness,
    styleInfluence: phase.styleInfluence,
    exclude: exclude || undefined,
  };
}
```

---

## 8. 编排引擎 (Arranger) 🎧

> 24 小时持续音乐流的大脑。不是一首一首生成，而是编排一场完整的演出。

### 8.1 设计理念

```
单曲生成：用户点 → 生成一首 → 播完就没了
编排引擎：预生成曲库 → 按情绪弧线排列 → 实时感知调整 → 24h 无缝音乐流
```

核心思路：**预算控制 + 最大变化 + 按需生成**。Suno 每首约 $0.05-0.10，不一次性全量预生成。策略是渐进积累曲库池——冷启动生成 2-3 首，播放过程中按需补货，24h 累计约 30-50 首，编排引擎从中挑选排列，用交叉淡入实现无缝衔接。

### 8.2 三层时间架构

```
┌─────────────────────────────────────────────────────┐
│  宏观弧线 (Macro Arc)                                │
│  整场黑客松的情绪走势：开赛 → 爆发 → 低谷 → 冲刺 → 收官│
│  跨度：8-24 小时                                     │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  阶段编排 (Phase Arrangement)                         │
│  每个阶段内的曲目序列：能量起伏 + 风格轮换              │
│  跨度：30-120 分钟                                   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│  单曲决策 (Track Decision)                            │
│  下一首播什么：从曲库池中按规则选取                      │
│  跨度：3-5 分钟（一首歌的长度）                         │
└─────────────────────────────────────────────────────┘
```

### 8.3 宏观弧线 (Macro Arc)

根据黑客松时间线预设能量曲线：

```
能量
100│                    ╱╲        ╱╲
   │         ╱╲       ╱  ╲  ╱╲  ╱  ╲     ╱╲
 80│        ╱  ╲     ╱    ╲╱  ╲╱    ╲   ╱  ╲
   │       ╱    ╲   ╱              ╲ ╱    ╲
 60│      ╱      ╲ ╱                ╲      ╲
   │     ╱        ╲                        ╲
 40│    ╱                                  ╲
   │   ╱                                    ╲
 20│──╱                                      ╲──
   │
   └──┬────┬────┬────┬────┬────┬────┬────┬────┬──→ 时间
     开赛  热身  脑暴  构思  冲刺  瓶颈  休息  终冲  收官
```

```javascript
const MACRO_ARC = {
  // [阶段, 能量范围, 时长占比, 说明]
  opening:    { energy: [20, 40],  duration: 0.05, label: '开赛·热身' },
  brainstorm: { energy: [40, 85],  duration: 0.15, label: '头脑风暴' },
  focus:      { energy: [30, 60],  duration: 0.20, label: '专注构思' },
  sprint:     { energy: [70, 95],  duration: 0.20, label: '代码冲刺' },
  bottleneck: { energy: [40, 65],  duration: 0.10, label: '瓶颈期' },
  rest:       { energy: [15, 35],  duration: 0.05, label: '休息充电' },
  finalPush:  { energy: [80, 100], duration: 0.15, label: '终极冲刺' },
  celebrate:  { energy: [60, 90],  duration: 0.10, label: '收官庆祝' },
};
```

### 8.4 阶段内编排 (Phase Arrangement)

每个阶段内部不是一条直线，而是**波浪式能量起伏**：

```
阶段内能量曲线（以 Sprint 为例）：

能量
95│    ╱╲      ╱╲
  │   ╱  ╲    ╱  ╲
80│  ╱    ╲  ╱    ╲
  │ ╱      ╲╱      ╲
70│╱                ╲
  │
  └──┬──┬──┬──┬──┬──→
    T1  T2  T3  T4  T5

T1: 引入（能量 70）→ 热身
T2: 爬升（能量 85）→ 加速
T3: 峰值（能量 95）→ 全力输出
T4: 回落（能量 80）→ 缓冲
T5: 过渡（能量 70）→ 衔接下一阶段
```

**阶段内曲目序列生成规则**：

```javascript
function generatePhaseSequence(phase, trackCount, phaseDuration) {
  const baseEnergy = PHASE_PRESETS[phase].energyBase;
  const wavePattern = getWavePattern(phase); // 不同阶段的波形不同
  
  return wavePattern.map((energyMultiplier, i) => ({
    targetEnergy: clamp(baseEnergy * energyMultiplier, 0, 100),
    duration: phaseDuration / trackCount,
    transitionType: i === 0 ? 'fade-in' : 
                    i === wavePattern.length - 1 ? 'fade-out' : 'crossfade',
  }));
}
```

**不同阶段的波形**：

| 阶段 | 波形 | 说明 |
|------|------|------|
| brainstorm | `/\/\/\` | 高频起伏，刺激灵感 |
| focus | `----__----` | 平稳为主，偶尔微波 |
| sprint | `_/‾‾\_` | 快速爬升→维持→缓冲 |
| charge | `_/‾‾‾‾\` | 持续爬升到高潮 |
| bottleneck | `--_--_--` | 低能量中寻找小突破 |
| rest | `\____/` | 先降后升，留白 |
| celebrate | `/‾‾‾‾‾` | 持续高位，庆典感 |

### 8.5 曲库池 (Track Pool)

**渐进生成策略**：不一次性全量预生成，而是按需逐步积累。

```
启动时：生成 2-3 首（覆盖当前阶段）
播放中：当前阶段曲库 < 3 首时 → 后台补生成
阶段切换：提前 1-2 首开始为下个阶段生成
缓冲池：始终维持 2-3 首待播缓冲
```

**生成节奏**：

| 时机 | 触发条件 | 生成数量 | 说明 |
|------|---------|---------|------|
| 冷启动 | 用户点击开始 | 2-3 首 | 只生成当前阶段的 |
| 后台补货 | 当前阶段剩余 ≤2 首 | 1-2 首 | 同阶段不同变体 |
| 阶段预热 | 距离下一阶段 ≤2 首 | 2-3 首 | 提前为下阶段准备 |
| 惊喜注入 | 每 10-15 首 | 1 首 | 风格偏移的意外曲目 |
| 花费预警 | 余额 < $2 | 暂停生成 | 只用已有曲库循环 |

```javascript
const TRACK_POOL_SCHEMA = {
  id: 'track_001',
  phase: 'sprint',
  moodTag: 'driving',           // 情绪标签
  energyLevel: 85,              // 能量等级 0-100
  genre: 'Techno',              // 主流派
  instruments: ['Synth', '808'], // 乐器组合
  promptConfig: { ... },        // Suno 请求配置
  audioUrl: 'https://...',      // 音频 URL
  audioLocal: './cache/xxx.mp3', // 本地缓存
  durationSec: 180,             // 时长
  generatedAt: '2026-07-04T08:00:00',
  playCount: 0,                 // 播放次数
  lastPlayedAt: null,
};
```

**变体生成矩阵**（以 Sprint 阶段为例，按需逐首生成）：

| 序号 | 流派变体 | 乐器侧重 | 能量 | 情绪 | 生成时机 |
|------|---------|---------|------|------|---------|
| 1 | Techno | Synth Bass + Drum Machine | 80 | driving | 冷启动 |
| 2 | DnB | Breakbeats + Reese Bass | 90 | urgent | 冷启动 |
| 3 | Industrial Techno | Metallic + Distorted | 85 | intense | 补货 |
| 4 | Electro House | Pumping Bass + Synth Stabs | 88 | energetic | 补货 |
| 5 | Trance | Arpeggiated Synths + Pads | 82 | euphoric | 补货 |

**防重复规则**：
```
连续 3 首不重复同一主风格
连续 5 首不重复同一乐器组合
同一首歌间隔 ≥4 首再重复播放
```

### 8.6 单曲决策 (Track Decision)

每一首播完后，编排引擎决定下一首：

```javascript
class Arranger {
  constructor(trackPool, macroArc, sensing) {
    this.pool = trackPool;        // 曲库池
    this.arc = macroArc;          // 宏观弧线
    this.sensing = sensing;       // 感知层
    this.history = [];            // 播放历史
    this.currentPhase = null;
    this.currentBlockIndex = 0;
  }

  // 核心决策：下一首播什么
  decideNext() {
    // 1. 确定当前应该在哪个阶段
    const targetPhase = this.sensing.getCurrentPhase();
    const targetEnergy = this.sensing.getTargetEnergy();

    // 2. 从曲库池中筛选候选
    let candidates = this.pool.filter(t => 
      t.phase === targetPhase &&
      Math.abs(t.energyLevel - targetEnergy) < 20 && // 能量接近
      !this.recentlyPlayed(t.id, 4)                    // 近4首没播过
    );

    // 3. 防重复过滤
    candidates = this.applyAntiRepeat(candidates);

    // 4. 如果候选为空，放宽条件
    if (candidates.length === 0) {
      candidates = this.pool.filter(t => 
        t.phase === targetPhase && !this.recentlyPlayed(t.id, 2)
      );
    }

    // 5. 仍为空 → 循环本阶段任意未播过的
    if (candidates.length === 0) {
      candidates = this.pool.filter(t => t.phase === targetPhase);
    }

    // 6. 选最高"新鲜度×匹配度"分的
    return this.scoreAndPick(candidates, targetEnergy);
  }

  // 打分：能量匹配度 + 新鲜度 + 变化奖励
  scoreAndPick(candidates, targetEnergy) {
    return candidates
      .map(track => ({
        track,
        score: 
          (1 - Math.abs(track.energyLevel - targetEnergy) / 100) * 0.5 +  // 能量匹配 50%
          (1 - track.playCount / 10) * 0.3 +                              // 新鲜度 30%
          this.varietyBonus(track) * 0.2,                                  // 变化奖励 20%
      }))
      .sort((a, b) => b.score - a.score)[0]?.track;
  }

  // 变化奖励：和上一首风格差异越大分越高
  varietyBonus(track) {
    const last = this.history[this.history.length - 1];
    if (!last) return 1;
    const genreDiff = track.genre !== last.genre ? 1 : 0;
    const instrumentDiff = this.jaccardSimilarity(
      track.instruments, last.instruments
    );
    return (genreDiff + (1 - instrumentDiff)) / 2;
  }
}
```

### 8.7 感知层 (Sensing)

实时感知用户状态，动态调整编排：

```javascript
class SensingLayer {
  constructor(schedule, session) {
    this.schedule = schedule;     // 黑客松日程
    this.session = session;       // 当前会话状态
    this.userMood = 'neutral';    // 用户情绪推断
    this.commitFrequency = 0;     // 提交频率（次/小时）
    this.stallDuration = 0;       // 卡住时长（分钟）
  }

  // 感知输入源
  signals = {
    time: () => this.getTimeSignal(),           // 当前时间 vs 日程
    commits: () => this.getCommitSignal(),       // Git 提交频率
    interaction: () => this.getInteractionSignal(), // 用户交互频率
    phase: () => this.getPhaseSignal(),          // 手动阶段切换
    explicit: () => this.getExplicitSignal(),    // 用户显式调节（"太吵了"）
  };

  // 综合判断当前应该是什么阶段
  getCurrentPhase() {
    const timePhase = this.signals.time();
    const manualPhase = this.signals.phase();
    return manualPhase || timePhase; // 手动覆盖自动
  }

  // 目标能量（0-100）
  getTargetEnergy() {
    let base = this.arcBaseEnergy();        // 宏观弧线基础能量
    
    // 感知修正
    if (this.commitFrequency > 5) base += 10;  // 提交频繁 → 加速
    if (this.stallDuration > 30) base -= 15;    // 卡住超30分钟 → 降温
    if (this.userMood === 'frustrated') base -= 10; // 用户烦躁 → 柔和
    if (this.userMood === 'energized') base += 10;  // 用户兴奋 → 推高
    
    return clamp(base, 0, 100);
  }

  // Git 提交频率感知（轮询 git log）
  getCommitSignal() {
    // 每 5 分钟检查一次
    // 命令: git log --since="1 hour ago" --oneline | wc -l
    const commitsPerHour = this.lastCommitCheck || 0;
    if (commitsPerHour >= 8) return 'sprint';      // 高频提交 → 冲刺
    if (commitsPerHour >= 3) return 'productive';   // 正常节奏
    if (commitsPerHour === 0) {
      // 检查卡住时长
      this.stallDuration += 5;
      if (this.stallDuration > 60) return 'stuck';  // 超1小时无提交
    } else {
      this.stallDuration = 0;                        // 有提交 → 重置卡住计时
    }
    return 'idle';
  }

  // 用户情绪推断（基于交互模式）
  getInteractionSignal() {
    const recentActions = this.session.getRecentActions(30); // 最近30分钟
    const switchCount = recentActions.filter(a => a.type === 'phase_switch').length;
    const skipCount = recentActions.filter(a => a.type === 'track_skip').length;
    const volumeChange = recentActions.filter(a => a.type === 'volume_change');

    // 频繁切阶段 → 焦虑/找不到方向
    if (switchCount >= 3) return 'anxious';

    // 频繁跳歌 → 对当前音乐不满意
    if (skipCount >= 3) return 'displeased';

    // 长时间不操作 → 深度专注
    if (recentActions.length === 0) return 'focused';

    // 手动调大音量 → 想要更多刺激
    const lastVol = volumeChange[volumeChange.length - 1];
    if (lastVol && lastVol.value > 0.7) return 'energized';

    return 'neutral';
  }

  // 用户显式反馈
  getExplicitSignal() {
    const lastCommand = this.session.getLastCommand();
    if (!lastCommand) return null;

    const commands = {
      '太吵':    { action: 'lower_energy', delta: -20 },
      '太安静':  { action: 'raise_energy', delta: +20 },
      '来点刺激': { action: 'raise_energy', delta: +15, style: 'high-energy' },
      '安静点':  { action: 'lower_energy', delta: -15, style: 'ambient' },
      '换首':    { action: 'skip' },
      '这首不错': { action: 'like', boost: 0.3 },
      '不好听':   { action: 'dislike', penalty: 0.5 },
    };

    for (const [keyword, effect] of Object.entries(commands)) {
      if (lastCommand.includes(keyword)) return effect;
    }
    return null;
  }
}
```

### 8.8 情绪起伏 (Mood Pacing)

**长时段同阶段的防疲劳策略**：

```
连续 Focus 2小时：
  0-30min:  Ambient Piano      (能量 30)
  30-60min: Lo-Fi Beats        (能量 40) ← 轻微提升
  60-90min: Soft Electronic    (能量 35) ← 微降+换风格
  90-120min: Classical Guitar  (能量 25) ← 大幅切换，给耳朵休息

触发点：
  - 同阶段连续 >4首 → 强制风格切换
  - 同流派连续 >2首 → 下一首换流派
  - 用户 >15分钟无操作 → 偶尔插入一首惊喜曲目
```

**惊喜机制（Serendipity）**：

```javascript
// 每 10-15 首插入一首"意外"曲目
// 风格在当前阶段的常规范围外，但情绪相近
// 例如 Focus 阶段插入一首 Bossa Nova（而非 Ambient）
// 如果用户跳过 → 记住偏好，减少类似惊喜
// 如果用户听完 → 增加惊喜频率

const SERENDIPITY_RULES = {
  interval: [10, 15],      // 每 10-15 首插入一次
  deviationRange: 0.3,     // 风格偏离度 ≤30%
  energyMatch: 0.2,        // 能量匹配容差 ±20
  adaptive: true,          // 根据用户反应调整频率
};
```

### 8.9 编排状态机

```
┌──────────┐
│  IDLE    │ ← 等待用户启动
└────┬─────┘
     │ 用户点击"开始"
     ↓
┌──────────┐
│ BOOTSTRAP│ ← 冷启动：生成当前阶段首批 2-3 首
└────┬─────┘
     │ 首批就绪
     ↓
┌──────────┐     ┌──────────┐
│ PLAYING  │────→│TRANSITION│ ← 交叉淡入下一首
└────┬─────┘     └────┬─────┘
     │                │
     │    ┌───────────┘
     │    ↓
     │  ┌──────────┐
     │  │ DECIDING │ ← 编排引擎选择下一首
     │  └────┬─────┘
     │       │
     │       ↓
     │  ┌──────────┐     ┌──────────┐
     │  │GENERATING│────→│ CACHED   │ ← 存入缓冲池
     │  │(async,   │     └──────────┘
     │  │ 按需补货)│
     │  └──────────┘
     │
     │ 用户切阶段 / 调参数
     ↓
┌──────────┐
│ PHASE_CHANGE │ ← 重新计算编排序列
└────┬─────┘
     │
     ↓ (回到 PLAYING)
```

### 8.10 费用预估

```
假设：
  黑客松时长：24 小时
  平均每首时长：3 分钟
  总曲目数：24 × 60 / 3 = 480 首（大量循环复用）

渐进生成模型：
  冷启动：2-3 首 ≈ $0.20
  每 30 分钟补货：1-2 首 ≈ $0.10-0.16
  24h 总计：约 30-50 首（含循环复用）
  总费用：30 × $0.08 ≈ $2.40 - $4.00

对比全量预生成：
  全量 50 首 → $4.00（一次性支出，可能浪费）
  渐进 30 首 → $2.40（按需生成，不浪费）

预算控制：
  硬上限：$10/天
  软上限：每小时 ≤ $0.50
  花费预警：< $2 余额时 → 暂停生成，只用已有曲库循环
```

---

## 9. 生成器 (Generator)

### 9.1 TTAPI Suno 客户端

```javascript
class SunoGenerator {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.ttapi.io/suno/v1';
  }

  // 提交生成任务
  async submit({ style, lyrics, instrumental, weirdness, styleInfluence, exclude }) {
    const body = {
      customMode: !instrumental,
      instrumental,
      style,
      ...(lyrics && { lyrics }),
      model: 'chirp-v4-5',
    };

    const res = await fetch(`${this.baseUrl}/music`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTAPI-KEY': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return { taskId: data.id, pollUrl: data.poll_url };
  }

  // 轮询结果
  async poll(taskId) {
    const res = await fetch(`${this.baseUrl}/music/${taskId}`, {
      headers: { 'TTAPI-KEY': this.apiKey },
    });
    return res.json();
  }

  // 等待完成（带超时）
  async waitForCompletion(taskId, timeoutMs = 120000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const result = await this.poll(taskId);
      if (result.status === 'succeeded') return result;
      if (result.status === 'failed') throw new Error(result.error);
      await sleep(3000); // 3秒轮询一次
    }
    throw new Error('Generation timeout');
  }
}
```

### 9.2 生成调度 (Generation Scheduler)

编排引擎决定下一首后，由调度器负责实际生成：

```
编排引擎输出: { promptConfig, urgency }
    ↓
调度器检查缓冲池
    ↓
缓冲池有空位 → 提交 Suno 任务 → 异步等待 → 存入缓冲池
缓冲池满 → 排队等待空位
紧急(当前无歌可播) → 立即生成，阻塞等待
```

```javascript
class GenerationScheduler {
  constructor(sunoClient, bufferPool) {
    this.suno = sunoClient;
    this.buffer = bufferPool;     // 编排引擎的缓冲池
    this.pending = [];            // 排队中的任务
    this.maxConcurrent = 2;       // 最多同时生成 2 首
    this.activeCount = 0;         // 当前进行中的任务数
  }

  // 提交生成任务
  async submit(promptConfig, urgency = 'normal') {
    if (urgency === 'immediate') {
      // 紧急：立即阻塞生成
      const result = await this.suno.submit(promptConfig);
      return this.suno.waitForCompletion(result.taskId);
    }

    if (this.activeCount >= this.maxConcurrent) {
      // 并发上限：排队
      return new Promise((resolve, reject) => {
        this.pending.push({ promptConfig, resolve, reject });
      });
    }

    // 正常：异步生成
    this.startGeneration(promptConfig);
  }

  async startGeneration(promptConfig) {
    this.activeCount++;
    try {
      const result = await this.suno.submit(promptConfig);
      const audio = await this.suno.waitForCompletion(result.taskId);
      this.buffer.add(audio);
    } catch (err) {
      console.error('Generation failed:', err);
      // 降级：使用兜底音频
    } finally {
      this.activeCount--;
      this.processPending();
    }
  }

  processPending() {
    while (this.pending.length > 0 && this.activeCount < this.maxConcurrent) {
      const { promptConfig, resolve } = this.pending.shift();
      this.startGeneration(promptConfig).then(resolve);
    }
  }
}
```

### 9.3 交叉淡入 (Crossfade)

```javascript
class CrossfadePlayer {
  constructor() {
    this.audioA = new Audio();  // 当前播放
    this.audioB = new Audio();  // 下一首预加载
    this.active = 'A';         // 当前活跃音频元素
    this.fadeDuration = 3000;  // 淡入淡出时长 3 秒
  }

  // 预加载下一首
  preload(url) {
    const inactive = this.active === 'A' ? this.audioB : this.audioA;
    inactive.src = url;
    inactive.load();
  }

  // 交叉淡入切换
  async transition() {
    const current = this.active === 'A' ? this.audioA : this.audioB;
    const next = this.active === 'A' ? this.audioB : this.audioA;

    if (!next.src || next.readyState < 2) {
      // 下一首未就绪 → loop 当前段
      current.loop = true;
      return false;
    }

    // 同时播放两轨
    next.currentTime = 0;
    next.volume = 0;
    next.play();

    // 3 秒交叉淡入淡出
    const steps = 60; // 60 帧 ≈ 50ms/帧
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      current.volume = 1 - t;      // 当前轨淡出
      next.volume = t;              // 下一轨淡入
      await sleep(this.fadeDuration / steps);
    }

    current.pause();
    current.volume = 1;
    next.volume = 1;
    this.active = this.active === 'A' ? 'B' : 'A';
    return true;
  }
}
```

**触发时机**：
```
当前曲目播放到 85% → 检查缓冲池
  有下一首 → preload → 到 95% 时触发 crossfade
  无下一首 → loop 当前曲目 → 每 10 秒检查缓冲池
```

---

## 10. 存储层

### 10.1 SQLite Schema

```sql
-- 会话（一次黑客松）
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  name          TEXT,
  mbti_type     TEXT,
  mbti_sliders  TEXT,           -- JSON: { IE, SN, TF, JP }
  schedule_json TEXT,           -- 日程 JSON
  budget_limit  REAL DEFAULT 10.0,  -- 每日预算上限（美元）
  budget_spent  REAL DEFAULT 0,     -- 已花费
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 曲库池（编排引擎用，唯一曲目来源）
CREATE TABLE track_pool (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,
  phase         TEXT NOT NULL,
  mood_tag      TEXT NOT NULL,
  energy_level  INTEGER NOT NULL,       -- 0-100
  genre         TEXT NOT NULL,
  instruments   TEXT,                    -- JSON array
  prompt_config TEXT NOT NULL,           -- Suno 请求配置 JSON
  audio_url     TEXT,
  audio_local   TEXT,                    -- 本地缓存路径
  duration_sec  INTEGER,
  play_count    INTEGER DEFAULT 0,
  last_played_at DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 播放历史（编排引擎决策用）
CREATE TABLE play_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT NOT NULL,
  track_pool_id INTEGER NOT NULL,
  phase         TEXT NOT NULL,
  started_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  ended_at      DATETIME,
  user_skipped  BOOLEAN DEFAULT 0,      -- 用户是否手动跳过
  FOREIGN KEY (track_pool_id) REFERENCES track_pool(id)
);

-- 项目缓存（LLM 分析结果）
CREATE TABLE project_cache (
  folder_path   TEXT PRIMARY KEY,
  analysis_json TEXT NOT NULL,
  analyzed_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 11. API 接口

```
POST   /api/session                    # 创建会话（黑客松）
PUT    /api/session/:id/schedule        # 更新日程

POST   /api/mbti/resolve                # 滑块值 → MBTI 类型
POST   /api/project/analyze             # 项目文件夹 → 分析结果
POST   /api/lyrics/generate             # 生成歌词

POST   /api/arranger/start              # 启动编排引擎（冷启动生成首批 2-3 首）
POST   /api/arranger/stop               # 停止编排引擎
POST   /api/arranger/phase/:phase       # 手动切换阶段
POST   /api/arranger/feedback           # 用户反馈（"太吵了"/"来点刺激的"）
GET    /api/arranger/now-playing        # 当前播放信息
GET    /api/arranger/history            # 播放历史
GET    /api/arranger/pool-status        # 曲库池状态（已生成/缓冲/费用）
GET    /api/arranger/energy-curve       # 宏观能量曲线

POST   /api/player/play/:id             # 播放指定曲目
POST   /api/player/pause                # 暂停
POST   /api/player/next                 # 手动跳到下一首
POST   /api/player/prev                 # 上一首

GET    /api/history                     # 历史生成记录
DELETE /api/history/:id                 # 删除记录

WS     /ws/events                       # 实时推送
  - phase_changed    阶段切换
  - track_changed    曲目切换（编排引擎驱动）
  - energy_shift     能量曲线变化
  - pool_refill      曲库池补充
  - music_ready      音乐生成完成
  - user_feedback    用户反馈响应
  - budget_alert     费用预警
```

---

## 12. 前端 UI 模块

### 12.1 组件清单

```
App
├── Header (项目名 + 阶段指示器)
├── MBTIControls
│   ├── SliderGroup (4 个滑块)
│   ├── TypeDisplay (当前 MBTI 类型)
│   └── ColorPreview (实时颜色预览)
├── PhaseSelector
│   ├── PhaseTimeline (日程时间线)
│   └── PhaseButtons (手动切换按钮)
├── ProjectPanel
│   ├── FileUploader (关联文件夹)
│   ├── AnalysisResult (分析结果展示)
│   └── ContentPreview (项目描述)
├── StyleSelector
│   ├── GenreChips (风格标签选择)
│   └── NotesInput (备注输入框)
├── VocalToggle
│   ├── ToggleSwitch (人声开关)
│   ├── LyricsEditor (歌词编辑器，人声模式)
│   └── VocalStyleSelect (人声类型选择)
├── Player
│   ├── WaveformVisualizer (波形可视化)
│   ├── NowPlaying (当前播放信息)
│   ├── ProgressBar (播放进度 + 预生成触发点)
│   ├── Controls (播放/暂停/下一首)
│   └── VolumeSlider (音量)
├── ArrangerPanel
│   ├── EnergyCurve (能量曲线实时展示)
│   ├── MacroTimeline (全局阶段时间线 + 预测)
│   ├── PoolStatus (曲库池状态：已生成/剩余/费用)
│   └── MoodIndicator (当前情绪标签)
└── Settings
    ├── APIKeyConfig (TTAPI Key 配置)
    └── FallbackToggle (降级开关)
```

### 12.2 交互流程

```
1. 用户调整 MBTI 滑块
   → 颜色实时变化
   → 底部显示当前 MBTI 类型

2. 用户选择阶段
   → 音乐风格自动调整
   → 如果正在播放，交叉淡入新风格

3. 用户点击"开始"
   → 编排引擎冷启动，生成当前阶段首批 2-3 首
   → 显示生成中动画
   → 首批就绪 → 自动播放

4. 播放过程中
   → 85% 进度预加载下一首
   → 95% 进度触发交叉淡入（3秒过渡）
   → 后台按需补货，维持缓冲池 ≥2 首
```

---

## 13. 部署方案

### 13.1 开发环境
```
前端: Vite dev server (localhost:5173)
后端: Express (localhost:3001)
数据库: SQLite (本地文件)
```

### 13.2 黑客松部署
```
方案 A: 局域网
  - 后端部署在本地 Mac
  - 前端打包后由 Express 静态服务
  - 同一局域网内通过 IP 访问

方案 B: 公网
  - 前端: Vercel (免费)
  - 后端: Railway / Render (免费额度)
  - 数据库: SQLite (随后端部署)
```
