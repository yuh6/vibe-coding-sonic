# Solo 页真实化（复用现有后端，不改后端）

## 目标（已确认）
把 RoomWave `#/roomwave` 的 **Solo 调音页**从纯前端演示，接上 DJ 控制台**已有的后端 API**，
达到「核心播放 + 项目输入」：
- 四轴推子 / 风格 FX / 模式 Pad → 真实参与音乐生成
- DROP THE BEAT / 播放按钮 → 真生成 + 真播放（含 fallback）
- Project Input（手动输入 / GitHub 解析）→ 真解析，参与生成
- **后端一行不改**，只调用 `src/lib/api.js` 里已存在的接口

## 现状差异（接线要点）
1. **人格轴方向相反 + 键名不同**（关键，不处理会人格算反）
   - DJ：`axes = {ie, ns, tf, jp}`，`ie<50 → I`（内向）
   - RoomWave Solo：`soloDims = {ei, ns, tf, jp}`，`ei<50 → E`（外向）
   - 转换：`ie = 100 - soloDims.ei`；`ns/tf/jp` 键名一致、方向一致（都 <50 取左字母）可直接用。
     → 统一转成 DJ 的 `axes` 结构后再调 API。
2. **模式**：Solo 页 modePads 中文名 → 后端 mode id
   - 头脑风暴→brainstorm、专注构思→focus、代码冲刺→sprint、战鼓催阵→charge、
     落后了→behind、休息一下→break、完成了！→celebrate（映射表来自 lib/mbti.js MODES）
3. **风格**：Solo `styleFx={chillHype,synthAcoustic,darkBright}` →
   DJ `style={energy,texture,brightness}`（一一对应，值都是 0–100，直接改名）
4. **播放**：复用 `usePlayer()` 的 `playUrl(url,{title,loop})`；
   生成走 `generateMusic({axes,mode,style,projectAnalysis})` → `useMusicPoll().startPolling(jobId)`
   → 轮询出 `audioUrl` → playUrl。失败走 `getFallback({mode,mbti})`。
5. **项目输入**：`analyzeProject({name,description})` / `analyzeGithub(url)` 得到 projectAnalysis，
   传入 generateMusic。文件夹解析逻辑已存在于 ProjectDeck（summarizeFolder），可复用。

## 实施策略：抽共享 hook（推荐）
DJ 控制台 App.jsx 的生成/轮询/播放逻辑（约 60 行）与 Solo 页要做的几乎一致。
为避免复制粘贴，抽出一个 **`src/hooks/useMusicStudio.js`**：
- 输入：初始 axes/style/mode
- 内部：封装 usePlayer + useMusicPoll + handleGenerate + fallback + projectAnalysis 状态
- 输出：`{ axes,setAxes, style,setStyle, mode,setMode, project, generate, player, generating, fallback, promptData, ... }`
- **App.jsx 改为使用该 hook**（等价重构，行为不变），**RoomWave Solo 也用它**。

### 涉及文件
- 🆕 `src/hooks/useMusicStudio.js` — 抽取的共享逻辑
- ✏️ `src/App.jsx` — 用 hook 替换内联的生成/播放逻辑（行为等价，需回归验证现有 DJ 台不变）
- ✏️ `src/components/RoomWave.jsx` — Solo 视图接上 hook：
  - 四轴 onChange → 写入共享 axes（做 ei↔ie 转换）
  - 模式 Pad / STYLE FX → 写入 mode / style
  - DROP THE BEAT / PAUSE → `player.togglePlay` 或 `generate()`
  - MAIN DECK 的 BPM/TYPE 显示改为读共享状态（TYPE 用 mbtiFromAxes）
  - Project Input 三按钮接 analyzeProject / analyzeGithub / 文件夹
  - 播放态用 `player.playing` 驱动唱片旋转（替换本地 soloPlaying）
- RoomWave 的 home/mbti-hub/room 三视图**不动**（它们是独有功能）

### 风险 / 回归点
- App.jsx 重构必须严格等价——改完要回归测：现有 DJ 台生成、模式切换、panic、fallback、
  mixer 自动跳转都正常。
- Solo 页登录态：generateMusic 未登录会 401（DJ 台同样弹登录）。Solo 页也复用该处理。
- 轴转换算错会导致人格反 → 用 mbtiFromAxes 显示当前 TYPE，肉眼可校验。

## 备选策略（更保守，不碰 App.jsx）
不抽 hook，直接在 RoomWave.jsx 内**局部复制**一份精简的生成/播放逻辑（用同样的 api.js 函数）。
优点：完全不动 DJ 台，零回归风险。缺点：约 50 行逻辑重复，日后两处维护。

## 验收
- `#/roomwave` → Solo：拖轴看 TYPE/BPM 变化 → 选模式/风格 → DROP THE BEAT →
  真出现生成中→播放（或 fallback 播放）。
- 手动填项目 / 贴 GitHub url → 能解析并影响生成。
- 回到 `#/` DJ 台：功能完全不受影响。
- `npm run build` 通过。
