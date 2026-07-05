# 主页入口重新设计方案

## 问题分析

当前 `#/` 路由直接展示完整 DJ 控制台（MBTI 滑块、风格推子、播放器、项目面板、工作模式、Prompt 卡片、编排引擎、时间轴），信息密度极高，新用户进入后容易迷茫。

## 设计方案：Landing Hub 首页

新增一个 **Landing Hub 页面** 作为 `#/` 默认入口，将 DJ 控制台移到 `#/console`。首页以卡片式布局呈现，分为三个区域：

### 1. Hero 区域（顶部）
- **动态问候语**：根据时段显示不同问候（早上好 / 下午好 / 深夜了还在 coding？）
- **当前 MBTI 标签 + 人格主题色光晕**
- **一键开始按钮**："开始 Vibe Coding 🎵" → 跳转 DJ 控制台
- **背景**：人格色渐变 + 微弱粒子/波纹动效

### 2. 功能入口卡片（中部，2×2 网格）

四张大卡片，每张有图标 + 标题 + 一句话描述 + hover 光效：

| 卡片 | 图标 | 标题 | 说明 | 路由 |
|------|------|------|------|------|
| DJ 控制台 | 🎛 | AI DJ 台 | MBTI × 项目 × 节奏，个性化 BGM | `#/console` |
| 调音台 | 🎚 | 多轨调音台 | 多音轨混音 & Stem 分离 | `#/mixer` |
| 发现 | 🌍 | 发现音乐 | 电台、播放列表、音乐轮盘 | `#/discover` |
| RoomWave | 🌊 | RoomWave | 沉浸式团队音乐空间 | `#/roomwave` |

### 3. 快速状态栏（底部）
- 服务状态指示灯（TTAPI / LLM）
- 今日已生成曲目数 / 配额
- 最近播放的一首歌（可点击播放）

## 实现方案

### 文件变更

1. **新建** `src/components/LandingHub.jsx` — Landing Hub 页面组件
2. **修改** `src/App.jsx` — 路由调整：
   - `#/` 或空 hash → 渲染 `LandingHub`
   - `#/console` → 渲染原来的 DJ 控制台
   - 其他路由不变（`#/mixer`, `#/discover`, `#/roomwave`, `#/admin`）
   - 导航栏增加 "首页" 链接
3. 不新增任何依赖

### 路由变更

```
Before:                    After:
#/        → DJ Console     #/          → Landing Hub (新)
#/mixer   → Mixer          #/console   → DJ Console (原 #/)
#/discover → Discover      #/mixer     → Mixer
#/roomwave → RoomWave      #/discover  → Discover
#/admin   → Admin          #/roomwave  → RoomWave
                           #/admin     → Admin
```

### LandingHub 组件设计

- 纯展示组件，接收 props: `{ user, quota, health, mbti, theme, lastTrack, player }`
- 使用 TailwindCSS 实现响应式 2×2 卡片网格（移动端 1 列）
- 沿用现有 glass morphism 风格（`glass` 类 + `backdrop-blur`）
- 卡片 hover 时显示主题色光晕（使用 `theme.accent` / `theme.glow`）
- 问候语无需外部库，纯 JS `new Date().getHours()` 判断时段
- 一键开始按钮自带呼吸灯/脉冲动画

### 导航栏更新

在 header 中增加"🏠 首页"链接，当用户不在首页时显示。同时：
- 原来的 `isDiscover ? '🎛 DJ 台' : '🌍 发现'` 中 DJ 台链接改为 `#/console`
- 同理 `isMixer ? '🎛 DJ 台'` 改为 `#/console`

### 视觉风格

- 与现有深色主题一致（`var(--page-bg)` + radial gradient）
- 卡片使用 `border-white/10 bg-white/5 backdrop-blur` 沿用 glass 风格
- 动画保持克制：hover 放大 1.02 + 边框高亮 + shadow，不用大幅位移
- 响应式：大屏 2×2，平板 2×1，手机 1×1
