# 合并 RoomWave 前端到 vibe-coding-sonic

## 背景
`C:\Users\XPS9320\Downloads\latestfronted.tar.gz` 是一个用 Eazo Creator 生成的独立单文件
React 应用「RoomWave — 地下俱乐部视频播放社群」(991 行 HTML)。技术上用的是
CDN + importmap + Babel 浏览器内编译(React 19 / framer-motion / lucide-react / Tailwind CDN)。

目标(已与用户确认):把它改造成正规 Vite 组件,挂到**新路由 `#/roomwave`**,
现有 DJ 控制台功能**完全不动**,只是多一个页面入口。

## RoomWave 应用结构(改造后保持一致)
单个 `App()` 组件,内部用 `currentView` state 切 4 个视图:
- `home` — 首页/三个入口卡片(随机 Room / MBTI Music / Solo)
- `mbti-hub` — 16 人格卡片网格
- `room` — 视频播放 + 弹幕聊天室 + 在线成员
- `solo` — 四轴推子调音 + 播放器

依赖的外部数据:`mbtiData`(16 条,含 mixkit CDN 视频 URL)、`commentsPool`。
用到的能力:`useState/useEffect/useRef`、`framer-motion`(motion/AnimatePresence)、
`lucide-react` 图标约 25 个、Tailwind、自定义 CSS 动画(ambient-flow / radial-wave-bar / scanline)。

## 实施步骤

### 1. 安装依赖
```
npm install framer-motion lucide-react
```
(两者当前都未安装;RoomWave 原用 React19,本项目是 React18 —— framer-motion@11 / lucide
最新版均兼容 React18,用与项目一致的 React18。)

### 2. 新建组件 `src/components/RoomWave.jsx`
- 把 HTML 里 `<script type="text/babel">` 中的 JS 原样搬进来,改成标准模块:
  - 顶部换成 `import React, { useState, useEffect, useRef } from 'react';`
    `import { motion, AnimatePresence } from 'framer-motion';`
    `import { Tv, Sparkles, ... } from 'lucide-react';`(按原 import 列表)
  - 去掉 `createRoot(...).render(<App/>)`,改为 `export default function RoomWave() { ...原 App 函数体... }`
  - `App` 内部逻辑、JSX 原样保留(含 mixkit 视频 URL、弹幕定时器等)。
  - `new Date().getFullYear()` 页脚保留(运行期没问题)。
- 组件自带深色底(`bg-[#050505]`),它内部有自己的明暗切换 state(isLightMode),
  与全站的 data-theme 主题**独立**,不冲突。

### 3. 新建样式 `src/styles/roomwave.css`
把 HTML `<style>` 里 RoomWave 专有的 CSS 抽出来(body 除外):
`.mono-font`、`@keyframes slow-spin/radial-wave/ambient-flow`、`.radial-wave-bar`、
`.ambient-flow`、`.scanline` 等,以及 JetBrains Mono 字体 @import。
在 `RoomWave.jsx` 顶部 `import '../styles/roomwave.css';`。
(不改全局 body 样式,避免影响现有页面。)

### 4. Tailwind safelist(关键)
RoomWave 的 `mbtiData` 把颜色类名(如 `from-emerald-500/20`、`border-emerald-500/30`、
`shadow-[...]`)存成字符串动态拼接。本项目用构建期扫描的本地 Tailwind,扫不到这些拼接类。
在 `tailwind.config.js` 增加 `safelist`,列出全部动态 from-/to-/via-/border- 颜色类
(已提取完整清单,约 90 个)。shadow 用的是任意值 `shadow-[0_0_20px_...]`,写死在字符串里,
Tailwind 的任意值 JIT 对 safelist 里的字符串同样需要列出 → 一并加入 safelist。

### 5. 接入路由 `src/App.jsx`
- 顶部 `import RoomWave from './components/RoomWave';`
- 加 `const isRoomWave = hash === '#/roomwave';`
- 渲染分支链最前面加:`isRoomWave ? <RoomWave /> :` (让它全屏接管,不套现有 header/grid)
  —— RoomWave 自带 header/footer,应整页渲染,所以放在最外层 return 里单独判断:
  若 isRoomWave,直接 `return <RoomWave />;`(在现有 return 之前),最简洁。
- 在现有顶栏导航区加一个入口链接 `<a href="#/roomwave">🌊 RoomWave</a>`,风格同其它 pad 链接。

### 6. 验证
- `npm run dev` 已在跑;改完热更新。
- 访问 `http://localhost:5173/#/roomwave` 逐个视图点一遍:
  首页三卡 → MBTI 星系 16 卡颜色是否正确(验证 safelist 生效)→ 进房间视频播放 +
  弹幕滚动 → solo 推子调音 + 播放器旋转动画。
- 确认现有页面(#/、#/mixer、#/discover、#/admin)不受影响。

## 风险 / 注意
- **颜色丢失**:若 safelist 漏了某个类,MBTI 卡片颜色会变透明/黑 —— 逐一核对清单。
- **视频加载**:mbtiData 用 mixkit CDN 视频,需联网;离线则视频区黑屏但不报错。
- **React18 vs 19**:原代码没用 React19 独有 API,兼容。StrictMode 下定时器会双跑一次
  (开发期正常现象,不影响)。
- 不触碰后端 / 其它组件 / 现有 CSS 变量。

## 交付
新增 3 处:`src/components/RoomWave.jsx`、`src/styles/roomwave.css`、tailwind safelist;
改动 2 处:`src/App.jsx`(路由+导航)、`package.json`(2 个依赖)。
