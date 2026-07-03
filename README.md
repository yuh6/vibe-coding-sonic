# Vibe Coding 有歌声

MBTI × 项目 × 节奏 · AI DJ 控制台。根据人格、项目内容与黑客松进程，生成专属 BGM。

## 快速启动

```bash
npm install
npm run dev
```

| 地址 | 用途 |
|------|------|
| http://localhost:5173 | DJ 控制台 |
| http://localhost:5173/#/admin | 管理后台（API Key + 音乐库） |
| http://localhost:3001/api/health | 后端健康检查 |

## 界面概览

```
┌─────────────────────────────────────────────────────────────┐
│  Vibe Coding 有歌声          [TTAPI ●] [LLM ●]  [⚙️ 管理后台] │
├──────────────┬──────────────────────┬───────────────────────┤
│ MBTI Remix   │  Main Deck           │  Mode Pads            │
│ 四轴推子      │  LED: BPM/TYPE/MODE  │  Focus / Spark        │
│ I/E N/S T/F  │  波形 + 黑胶转盘      │  Sprint / Charge      │
│ Style FX     │  DROP THE BEAT       │  [我们落后了!]         │
│ CHILL↔HYPE   │                      │  Prompt Monitor       │
│ SYNTH↔ACOUSTIC│  Project Input       │  四层实时预览          │
│ DARK↔BRIGHT  │  手动/文件夹/GitHub   │                       │
├──────────────┴──────────────────────┴───────────────────────┤
│  Hackathon Timeline（横向日程条）                              │
└─────────────────────────────────────────────────────────────┘
```

## 配置 API Key

### 方式一：管理后台（推荐）

1. 打开 `/#/admin`
2. 填入 `TTAPI_KEY`（[ttapi.io](https://ttapi.io) 获取）
3. 点选 LLM 供应商，填入对应密钥
4. 点「保存配置」→ **立即生效，无需重启**

配置写入 `server/data/runtime-config.json`（已 gitignore），优先级高于 `.env`。

### 方式二：环境变量

```bash
cp .env.example .env
```

详见 [.env.example](.env.example)。

## 音乐生成 — TTAPI

Suno **没有**公开 API，经 TTAPI 代理：

```
POST https://api.ttapi.io/suno/v1/music   →  jobId
GET  https://api.ttapi.io/suno/v2/fetch?jobId=...  →  audioUrl
```

| 变量 | 说明 |
|------|------|
| `TTAPI_KEY` | 必填才走实时生成 |
| `TTAPI_SUNO_MV` | 模型版本，默认 `chirp-v5` |
| `USE_FALLBACK_ONLY` | `true` = 彩排模式，只用兜底曲 |

## LLM 项目分析

`LLM_PROVIDER` 选择供应商：

| Provider | 密钥 |
|----------|------|
| `openai` | `OPENAI_API_KEY` |
| `anthropic` | `ANTHROPIC_API_KEY` |
| `gemini` | `GEMINI_API_KEY` |
| `deepseek` | `DEEPSEEK_API_KEY` |
| `siliconflow` | `SILICONFLOW_API_KEY` |
| `openrouter` | `OPENROUTER_API_KEY` |
| `custom` | `LLM_API_KEY` + `LLM_API_BASE` |
| `cli-codex` | `CODEX_API_KEY` 或 codex auth |
| `cli-gemini` | 本机 gemini CLI |
| `cli-claude` | `ANTHROPIC_API_KEY` |
| `cli-kimi` | `KIMI_API_KEY` |

未配置时自动回退到关键词模板匹配（`server/data/project-templates.json`）。

## 兜底音乐库

- 数据文件：`server/data/fallback-manifest.json`
- 管理后台可按模式（focus / spark / sprint / charge）增删曲目
- 本地文件放 `public/samples/`，URL 填 `/samples/xxx.mp3`
- 赛前用 Suno 批量生成好听的曲，在后台登记

## API 参考

```bash
# 健康检查
curl http://localhost:3001/api/health

# Prompt 预览（四轴 + 风格滑块）
curl -X POST http://localhost:3001/api/music/generate \
  -H 'Content-Type: application/json' \
  -d '{"axes":{"ie":30,"ns":70,"tf":45,"jp":80},"mode":"Sprint","style":{"energy":85,"texture":20,"brightness":30},"previewOnly":true}'

# GitHub 项目解析
curl -X POST http://localhost:3001/api/project/analyze-github \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://github.com/owner/repo"}'

# 配置状态
curl http://localhost:3001/api/config/status

# 音乐库
curl http://localhost:3001/api/library
```

完整 API 见 [vibe-coding-sonic.md](vibe-coding-sonic.md) §4.2。

## Demo 操作

1. 拖 **MBTI Remix** 推子 → LED 屏类型变化 → Prompt Monitor 实时更新
2. 选项目（预设 / 文件夹 / GitHub）
3. 调 **Style FX** 推子 → BPM 和紫层「DJ 微调」变化
4. 点 **DROP THE BEAT** 生成播放
5. 切 **Mode Pad** 或 **Panic** 对比节奏
6. 上台前：`USE_FALLBACK_ONLY=true`，模式切换走秒切兜底

## 生产部署

```bash
npm run build
NODE_ENV=production npm start
# 单端口 3001 同时服务 API + 静态前端
```

现场 demo 优先本地跑 + 局域网 IP 分享。

## 项目结构

```
src/components/     # DJ 控制台 UI 组件
server/routes/      # Express 路由
server/services/    # prompt 融合、TTAPI、LLM、音乐库
server/data/        # MBTI 画像、兜底曲库、运行时配置
```

详细目录与 PRD 见 [vibe-coding-sonic.md](vibe-coding-sonic.md)。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前端 (5173) + 后端 (3001) |
| `npm run build` | 构建前端到 dist/ |
| `npm start` | 生产模式启动后端（含静态文件） |
