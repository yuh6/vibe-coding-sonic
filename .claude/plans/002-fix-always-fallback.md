# 修复：音乐生成总是走兜底曲库

## 问题根因

在 `MBTIWAVE.jsx` 和 `App.jsx` 中，切换工作模式（mode pad）和紧急模式（panic）时，`forceFallback` 被错误地设为 `true`，导致 Suno 生成完全被跳过，始终播放兜底音乐。

### MBTIWAVE.jsx (line 421)
```js
forceFallback: opts.force || false,  // opts.force 本意是"强制重新生成"而非"强制兜底"
```
`handleModePadChange` 和 `handleModePanic` 都传 `{ force: true }`，结果映射到 `forceFallback: true`。

### App.jsx (lines 330, 335)
```js
handleGenerate({ mode: nextMode, forceFallback: true });  // 切模式直接跳过 Suno
handleGenerate({ mode: 'behind', forceFallback: true });  // panic 也直接跳过
```

## 修复方案

将 `force`（强制重新生成）和 `forceFallback`（强制使用兜底）两个概念分离：

### 1. `src/components/MBTIWAVE.jsx`
- `handleSoloGenerate` 中将 `opts.force` 用于控制是否跳过 play/pause toggle（已有的签名检查逻辑），不再传递给 `forceFallback`
- `forceFallback` 固定为 `false`（始终尝试 Suno 生成）

### 2. `src/App.jsx`
- `handleModeChange` 和 `handlePanic` 改为 `forceFallback: false`
- 保留 `playFallbackNow` 先播兜底音乐的"占位"逻辑（用户无感等待），但后端会同时启动 Suno 真实生成，轮询完成后自动替换

## 设计思路

当前架构已经有完美的"先播兜底 → 生成完成后替换"机制：
1. `handleGenerate` 先调用 `playFallbackNow()` 立即播放兜底音乐
2. 然后调用 `generateMusic()` 启动真实 Suno 生成
3. `poll.startPolling(job.jobId)` 轮询状态
4. `useEffect([poll.audioUrl])` 监听到新 URL → 自动播放替换

这个流程是正确的，问题只是 `forceFallback: true` 让后端直接走兜底而不提交 Suno。

## 影响范围

- `src/App.jsx` — 2 行改动
- `src/components/MBTIWAVE.jsx` — 1 行改动
- 不涉及后端改动
