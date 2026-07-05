# 最小兜底音乐生成清单

目标：基于当前七阶段功能，为每个用户场景准备 1 首必备兜底曲和 1 首备用兜底曲，并为 16 种 MBTI 人格各准备 1 首人格底色曲。实时生成失败、TTAPI 未配置、配额耗尽、Mode Pad 秒切、Panic、Arranger 曲池不足时，都能立刻播放。

## 覆盖范围

当前系统兜底分类分两层：

- 场景阶段：`brainstorm / focus / sprint / charge / behind / break / celebrate`。
- 人格底色：`personality`，每首曲目用 `mbti` 标记 16 种人格。

这些分类同时覆盖：

- Mode Pads：6 个常规阶段。
- Panic：`behind`。
- Arranger：七阶段连续播放和曲池补货。
- `/api/music/generate` fallback：TTAPI 不可用、失败、强制兜底、配额不足。
- `/api/music/fallback`：按 mode 获取秒切曲目。
- MBTI 兜底：优先匹配 `mode + mbti`，没有时使用 `personality + mbti`，再回落到通用阶段曲。

## 验收规则

- 每个 mode 至少 2 首：A 轨为默认兜底，B 轨为同场景备用。
- `personality` 至少覆盖 16 种 MBTI，每种至少 1 首人格底色曲。
- 每首 90-180 秒，纯音乐优先，开头 3 秒内进入可识别节奏。
- 结尾可循环或自然淡出，不要突然断尾。
- 同一 mode 的两首曲子情绪一致，但乐器或节奏层次有明显差异。
- URL 使用 `/samples/<file>.mp3` 或稳定的 `https://...mp3`；正式演示优先本地 `/samples/`。
- 生成后登记到管理后台音乐库，或写入 `server/data/fallback-manifest.json`。
- 提交前运行 `npm run test:fallback`，确认七阶段每类至少 2 首，且 16 种 MBTI 都有人格底色曲。

## 最小生成清单

| Mode | 用户场景 | A 轨标题 | A 轨 Style/Tags | B 轨标题 | B 轨 Style/Tags |
|------|----------|----------|-----------------|----------|-----------------|
| `brainstorm` | 选题讨论、灵感发散、产品命名 | Creative Spark | playful indie electronic, funky synth bass, marimba accents, claps, bright arpeggios, dynamic, varied, 110 BPM, instrumental, polished production | Idea Burst | upbeat electro pop, plucky synths, light percussion, curious melody, wide stereo, 118 BPM, instrumental |
| `focus` | 写代码、读文档、低干扰沉浸 | Deep Focus | lo-fi hip hop, warm Rhodes, soft vinyl texture, steady drums, mellow bass, 82 BPM, instrumental, clean mix | Ambient Flow | ambient electronica, soft pads, minimal pulse, spacious reverb, calm, 76 BPM, instrumental |
| `sprint` | 冲刺开发、修 bug、赶进度 | Sprint Drive | driving synthwave, punchy kick, tight bass, fast hi hats, urgent, high energy, 138 BPM, instrumental | Deadline Rush | energetic electronic rock, arpeggiated synths, compressed drums, relentless groove, 145 BPM, instrumental |
| `charge` | 上台前、展示前、团队动员 | Stage Ready | cinematic hybrid orchestral, taiko drums, brass stabs, rising strings, heroic, 128 BPM, instrumental, wide stereo | Epic Charge | epic trailer music, big percussion, synth pulses, building tension, triumphant hook, 132 BPM, instrumental |
| `behind` | Panic、落后追赶、时间紧张 | Catch Up Countdown | tense electronic score, ticking percussion, pulsing bass, urgent synth ostinato, high stakes, 150 BPM, instrumental | Tense Push | dark techno, sharp hats, countdown risers, tight low end, intense, 156 BPM, instrumental |
| `break` | 休息、吃饭、短暂恢复 | Chill Breather | chill lo-fi, nylon guitar, soft keys, relaxed groove, warm tape, 72 BPM, instrumental | Mellow Pause | downtempo ambient, gentle percussion, airy pads, mellow bass, laid-back, 68 BPM, instrumental |
| `celebrate` | 完成、提交、获奖、结束彩蛋 | Victory Lap | euphoric dance pop, bright piano chords, four on the floor, joyful synth lead, 124 BPM, instrumental | Confetti Drop | festival house, big claps, uplifting bassline, triumphant melody, polished hi-fi, 128 BPM, instrumental |

## 16 人格底色清单

| MBTI | 人格气质 | 标题 | Style/Tags |
|------|----------|------|------------|
| INTJ | 战略、独立、深邃 | Strategic Depth | dark ambient, minimal techno, deep synth pads, sub bass, atmospheric, brooding, 100 BPM, instrumental |
| INTP | 好奇、分析、自由 | Logic Drift | IDM, experimental electronic, glitch textures, modular synth, ambient pads, mysterious, contemplative, 90 BPM, instrumental |
| ENTJ | 领导、果断、高效 | Command Rise | cinematic orchestral, brass section, timpani, string orchestra, powerful, commanding, 130 BPM, instrumental |
| ENTP | 机智、创新、挑战 | Voltage Debate | electro funk, future bass, funky synth, playful arpeggios, 808 bass, playful, groovy, 120 BPM, instrumental |
| INFJ | 洞察、理想、温暖 | Quiet Vision | neoclassical ambient, grand piano, ethereal strings, celesta, healing, spacious, 80 BPM, instrumental |
| INFP | 梦幻、创造、感性 | Dream Archive | dream pop, indie folk, fingerpicked acoustic guitar, soft pads, flute, nostalgic, dreamy, 90 BPM, instrumental |
| ENFJ | 热情、鼓舞、连接 | Warm Signal | indie pop, tropical house, bright synths, ukulele, warm pads, uplifting, warm, 110 BPM, instrumental |
| ENFP | 活力、乐观、自由 | Spark Carnival | indie rock, pop, electric guitar, synth hooks, claps, upbeat, joyful, 120 BPM, instrumental |
| ISTJ | 可靠、有序、稳重 | Steady Ledger | lo-fi hip hop, downtempo, vinyl crackle, jazz piano, mellow drums, steady, calm, 88 BPM, instrumental |
| ISFJ | 温暖、细致、守护 | Gentle Harbor | acoustic folk, nylon guitar, soft piano, warm bass, gentle, comforting, 80 BPM, instrumental |
| ESTJ | 高效、组织、务实 | Organized Drive | tech house, progressive house, synth bass, drum machine, synth stabs, driving, determined, 124 BPM, instrumental |
| ESFJ | 友善、协作、和谐 | United Hearts | pop soul, Rhodes, warm bass, gospel chord voicings, harmonious, warm, 110 BPM, instrumental |
| ISTP | 实用、冷静、灵活 | Cool Mechanic | minimal techno, industrial, drum machine, metallic synth, cold bass, cool, precise, 112 BPM, instrumental |
| ISFP | 敏感、艺术、自由 | Soft Prism | chillhop, art pop, electric piano, soft drums, synth pad, mellow, expressive, 90 BPM, instrumental |
| ESTP | 大胆、行动、刺激 | Action Pulse | EDM, drum and bass, 808 sub bass, breakbeats, Reese bass, energetic, aggressive, 150 BPM, instrumental |
| ESFP | 热情、表演、享受 | Spotlight Dance | dance pop, reggaeton, latin percussion, funky bassline, brass stabs, euphoric, festive, 108 BPM, instrumental |

## 文件命名

建议生成后放到 `public/samples/`：

```text
fallback-brainstorm-a.mp3
fallback-brainstorm-b.mp3
fallback-focus-a.mp3
fallback-focus-b.mp3
fallback-sprint-a.mp3
fallback-sprint-b.mp3
fallback-charge-a.mp3
fallback-charge-b.mp3
fallback-behind-a.mp3
fallback-behind-b.mp3
fallback-break-a.mp3
fallback-break-b.mp3
fallback-celebrate-a.mp3
fallback-celebrate-b.mp3
fallback-personality-intj-a.mp3
fallback-personality-intp-a.mp3
fallback-personality-entj-a.mp3
fallback-personality-entp-a.mp3
fallback-personality-infj-a.mp3
fallback-personality-infp-a.mp3
fallback-personality-enfj-a.mp3
fallback-personality-enfp-a.mp3
fallback-personality-istj-a.mp3
fallback-personality-isfj-a.mp3
fallback-personality-estj-a.mp3
fallback-personality-esfj-a.mp3
fallback-personality-istp-a.mp3
fallback-personality-isfp-a.mp3
fallback-personality-estp-a.mp3
fallback-personality-esfp-a.mp3
```

对应 manifest 条目示例：

```json
{
  "id": "personality-intj-a",
  "mbti": "INTJ",
  "title": "Strategic Depth",
  "url": "/samples/fallback-personality-intj-a.mp3"
}
```

## 赛前核对

- [ ] 七个 mode 都有 A/B 两首。
- [ ] `personality` 覆盖 16 种 MBTI，每种至少一首。
- [ ] 所有音频 URL 在断网或内网演示环境中可播放。
- [ ] `USE_FALLBACK_ONLY=true` 下点击 `DROP THE BEAT` 能完成播放。
- [ ] Mode Pad 六个常规阶段能秒切。
- [ ] Panic 按钮能进入 `behind` 并播放紧迫兜底曲。
- [ ] `npm run test:fallback` 通过。
