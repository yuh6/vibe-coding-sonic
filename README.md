# MBTIWAVE

> 你的 MBTI 类型不只决定你是哪种社恐——它还决定你写代码时该听什么歌。

**MBTI × 项目 × 黑客松节奏 = AI 实时生成你的专属 BGM。**

别再开 Spotify 随机 Lo-fi 了。MBTIWAVE 是一台 AI DJ 控制台：读取你的人格四轴、项目代码上下文、当前比赛阶段，实时合成只属于这一刻的音乐。推子一拉，INTJ 的暗黑 Minimal Techno 秒变 ENFP 的阳光 Funk——Prompt 四层实时可见，所听即所见。

---

## 30 秒体验

```bash
npm install
npm run dev
```

打开 http://localhost:5173 ，你就是 DJ。

---

## 这东西能干嘛？

| 你想… | MBTIWAVE 怎么做 |
|-------|----------------|
| 写代码时有背景音乐 | 四轴推子调 MBTI → AI 生成专属曲目 |
| 冲刺阶段需要鸡血 | 点 **Sprint** 打击垫，BPM 秒飙 |
| 落后进度开始焦虑 | 砸 **我们落后了!** 红色 Panic 键 |
| 团队一起嗨 | 开台直播 → 队友一键 tune in |
| Demo 上台不翻车 | `USE_FALLBACK_ONLY=true` 全部秒切预录曲 |
| 想搓碟 | `#/mixer` 多轨调音台，stems 自动导入 |

---

## 五个页面，五种玩法

| 路由 | 干什么 | 一句话 |
|------|--------|--------|
| `#/mbtiwave` | 首页（默认） | Hero 视频 + Solo Remix + 一键开台 |
| `#/` | DJ 控制台 | 三栏推子面板，零表单感操作 |
| `#/discover` | 发现 | 电台、歌单、共享曲库、猜你喜欢 |
| `#/mixer` | 调音台 | AI stems 多轨混音 |
| `#/admin` | 管理后台 | Key 配置、配额、用户、曲库 |

---

## 界面长这样

```
┌─────────────────────────────────────────────────────────────┐
│  MBTIWAVE                    [TTAPI ●] [LLM ●]  [⚙️ Admin]  │
├──────────────┬──────────────────────┬───────────────────────┤
│ MBTI Remix   │  ◉ Main Deck         │  Mode Pads            │
│ ──I━━━━E──   │  LED: 128 BPM        │  [brainstorm] [focus] │
│ ──N━━━━S──   │  ~~~波形~~~黑胶~~~    │  [sprint]   [charge]  │
│ Style FX     │                      │  [break]  [celebrate] │
│ CHILL↔HYPE   │  ┌──────────────┐    │  [🔥 我们落后了!]     │
│ SYNTH↔ACOUSTIC│  │ DROP THE BEAT│    │                       │
│ DARK↔BRIGHT  │  └──────────────┘    │  Prompt Monitor       │
├──────────────┴──────────────────────┴───────────────────────┤
│  ▸▸▸ Hackathon Timeline ━━━━━━━━━━━━━━━━━━━●━━━━━━━━━━━━▸▸▸ │
└─────────────────────────────────────────────────────────────┘
```

---

## 配置（两步搞定）

### 快捷方式：管理后台

1. 打开 `/#/admin`
2. 填 `TTAPI_KEY`（[ttapi.io](https://ttapi.io) 获取）→ 选 LLM 供应商 → 保存
3. 完事。**立即生效，不用重启。**

### 极客方式：环境变量

```bash
cp .env.example .env
# 改你需要的 Key，启动即用
```

> 没有任何 Key 也能跑——音乐走预录兜底库，项目分析走关键词模板。只是少了「实时生成」的快感。

---

## 音乐从哪来？

```
你的 MBTI 四轴 + 项目 + 阶段 + Style FX
        ↓
   promptComposer（四层融合）
        ↓
   TTAPI → Suno V5 生成
        ↓
   你的耳朵 🎧
```

**如果 Suno 挂了 / 没 Key / 额度用完？**

自动走三级兜底：共享曲库 → 数据库 fallback_tracks → 静态 manifest。安静得像什么都没发生。

---

## LLM 项目分析

告诉 AI 你在做什么项目，它会提取音乐关键词融入 prompt。支持 11 种 LLM 供应商——从 OpenAI 到 DeepSeek 到本机 CLI，总有一个你能用的。

没 LLM？不影响。退回 8 个项目模板关键词匹配，照样出活。

---

## 七个阶段，七种氛围

| 模式 | 状态 | 音乐画风 |
|------|------|---------|
| `brainstorm` | 脑暴 | 跳跃、灵感刺激 |
| `focus` | 专注 | Lo-fi、环境音、低 BPM |
| `sprint` | 冲刺 | 节奏猛推、高 BPM |
| `charge` | 冲锋 | 史诗鼓点、燃 |
| `behind` | 落后了 | 紧迫追赶、倒计时感 |
| `break` | 休息 | 放松充电 |
| `celebrate` | 庆祝 | 狂欢派对 |

---

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 前端 (5173) + 后端 (3001) 一起跑 |
| `npm run build` | 构建生产前端 |
| `npm test` | 兜底曲库覆盖 + E2E smoke |
| `npm start` | 生产模式（单端口服务所有东西） |

---

## 生产部署

```bash
npm run build && NODE_ENV=production npm start
```

想正经上线？Railway + Cloudflare R2，见 [DEPLOYMENT.md](DEPLOYMENT.md)。支持 PostgreSQL、Redis、S3 对象存储——全都是可选项，不配也能单机跑。

---

## 项目结构（极简版）

```
src/                  # React 前端
├── components/       #   DJ 控制台、首页、Discover、Mixer、Admin
├── hooks/            #   usePlayer / useMixer / useArranger
└── lib/              #   api 客户端 + MBTI 工具

server/               # Express 后端
├── routes/           #   REST API（music / auth / radio / …）
├── services/         #   prompt 融合、Suno、LLM、编排引擎
├── db/               #   SQLite / PostgreSQL DAL
└── storage/          #   音频持久化（local / R2 / S3）
```

完整 PRD 和 API 文档见 [vibe-coding-sonic.md](vibe-coding-sonic.md)。

---

## Demo 速查（上台前看这个）

1. 拖 MBTI 推子 → LED 屏变、配色变、Prompt 实时变
2. 喂个 GitHub 项目链接
3. 推 Style FX 到 HYPE
4. 砸 **DROP THE BEAT** → 等 15 秒 → 播放
5. 切 Mode Pad 对比风格
6. 保底：`USE_FALLBACK_ONLY=true`，所有切换秒响应

---

## 技术栈一览

| 角色 | 选手 |
|------|------|
| 前端 | React 18 + Vite + Tailwind + Framer Motion |
| 音频 | Howler.js（单曲）+ Web Audio API（多轨/编排） |
| 后端 | Express + 手写 WebSocket（零依赖） |
| 数据库 | SQLite（开发）/ PostgreSQL（生产） |
| 缓存 | 内存 LRU / Redis |
| 音乐生成 | TTAPI → Suno V5 |
| AI 分析 | 11 种 LLM provider |
| 存储 | 本地 / Cloudflare R2 / S3 |

---

## 常见问题

**Q: 没有 TTAPI Key 能用吗？**
A: 能。所有生成会走兜底曲库，推子和界面照常玩。

**Q: 支持几个人同时用？**
A: 多用户系统已内置。游客自动分配身份，注册用户有独立配额和曲库。

**Q: 我的 MBTI 测不准怎么办？**
A: 四轴是连续滑块，不是非 I 即 E。随手调到你觉得舒服的位置就行。

**Q: 上台 Demo 网断了怎么办？**
A: 本地后端 + 兜底曲全走 `/samples/` 本地文件。断网照放。

---

<p align="center"><b>把 MBTI 从破冰标签变成你的 BGM 引擎。</b></p>
