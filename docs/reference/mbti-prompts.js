/**
 * ⚠️ 未接入代码：本文件全仓库搜索无任何 import 引用，仅作素材参考存放于 docs/reference/。
 * 服务端实际生效的模式修饰词在 server/services/promptComposer.js 的 MODE_MODIFIERS
 * （Focus/Spark/Sprint/Charge 四模式），与本文件的设计不是同一套，不要假设两者已同步。
 *
 * MBTI × 模式 → Suno Prompt 数据库 v2
 *
 * 基于 Suno V5 最佳实践重构：
 * - 优先级：流派 → 细分风格 → 乐器 → 情绪 → BPM → 制作质量
 * - 前置锚点：前 6-10 词放最关键信息
 * - 具体乐器名（Fingerpicking Acoustic Guitar 而非 guitar）
 * - 制作质感词（Polished, Hi-Fi, Lo-Fi, Raw）
 * - 正向描述（Instrumental 而非 no vocals）
 * - 结构标签（[Intro] [Build] [Climax] [Outro]）
 * - 控制在 200 字符内（Suno Style 限制）
 */

// ─── 项目主题关键词库 ───
export const PROJECT_THEME_PRESETS = {
  game:     { instruments: 'chiptune, synth, drum machine', mood: 'competitive, energetic, playful', avoid: 'acoustic, folk' },
  ai_agent: { instruments: 'generative synth, granular textures, modular', mood: 'futuristic, intelligent, mysterious', avoid: 'country, acoustic' },
  tool:     { instruments: 'clean synth, minimal percussion, piano', mood: 'focused, efficient, modern', avoid: 'dramatic orchestral' },
  social:   { instruments: 'warm pads, acoustic elements, soft drums', mood: 'connective, warm, inclusive', avoid: 'harsh distortion' },
  data:     { instruments: 'glitch, IDM percussion, modular synth', mood: 'analytical, precise, complex', avoid: 'sentimental, pop' },
  creative: { instruments: 'lush synths, strings, piano', mood: 'expressive, artistic, dreamy', avoid: 'generic pop' },
  education:{ instruments: 'bright piano, light percussion, acoustic', mood: 'encouraging, clear, accessible', avoid: 'aggressive' },
  nature:   { instruments: 'acoustic guitar, flute, field recordings', mood: 'organic, peaceful, grounding', avoid: 'heavy electronic' },
  finance:  { instruments: 'driving bass, clean synths, structured beats', mood: 'confident, precise, ambitious', avoid: 'whimsical' },
  health:   { instruments: 'calm piano, ambient pads, soft bells', mood: 'healing, serene, hopeful', avoid: 'dark ambient' },
};

// ─── 进度状态修正器 ───
export const MODE_MODIFIERS = {
  Focus: {
    bpmOffset: -10,
    styleModifier: 'ambient, minimal, spacious, steady',
    structureTags: '[Intro: Ambient Texture]\n\n[Main Theme]\n\n[Outro: Fade Out]\n\n[End]',
    description: '降低信息密度，提供稳定听觉锚点',
  },
  Spark: {
    bpmOffset: +5,
    styleModifier: 'playful, varied, dynamic, surprising',
    structureTags: '[Intro]\n\n[Verse: Sparse]\n\n[Build]\n\n[Climax]\n\n[Outro]\n\n[End]',
    description: '适度新奇感和变化，激活发散思维',
  },
  Sprint: {
    bpmOffset: +20,
    styleModifier: 'driving, urgent, high energy, relentless',
    structureTags: '[Intro: Cold Open]\n\n[Build: Rising Tension]\n\n[Climax: Full Power]\n\n[Outro: Cold End]\n\n[End]',
    description: '模拟心跳加速，驱动运动皮层激活',
  },
  Charge: {
    bpmOffset: +15,
    styleModifier: 'epic, powerful, heroic, building to climax',
    structureTags: '[Intro: Ambient Texture]\n\n[Build: Rising Tension, Orchestral Hits]\n\n[Climax: Full Orchestra, Triumphant]\n\n[Outro: Reprise]\n\n[End]',
    description: '触发多巴胺释放，赛前动员感',
  },
};

// ─── MBTI Prompt 数据库 v2 ───
// 格式: { style, structureTags, bpm, notes }
// style 控制在 200 字符内，遵循 Suno 优先级

export const MBTI_PROMPTS = {

  // ═══════════════════════════════════════
  //  NT 组合：理性 + 直觉
  // ═══════════════════════════════════════

  INTJ: {
    Focus: {
      style: 'Dark Ambient, Minimal Techno, Deep Synth Pads, Spacious Reverb, Instrumental, {theme}, 85 BPM, Hi-Fi, Polished',
      bpm: [80, 90],
      notes: '内省+抽象+克制+秩序。深沉合成器纹理，极少打击乐，有建筑感。',
    },
    Spark: {
      style: 'Intellectual Electronica, Layered Synth Arpeggios, Complex Rhythmic Patterns, Instrumental, {theme}, 100 BPM, Polished',
      bpm: [95, 105],
      notes: '保持深度但增加变化，像在推演多种可能性。',
    },
    Sprint: {
      style: 'Dark Synthwave, Pulsating Bassline, Urgent Sequencer, Instrumental, {theme}, 120 BPM, Punchy Mix, Hi-Fi',
      bpm: [115, 125],
      notes: '战略紧迫感，有目标的加速。',
    },
    Charge: {
      style: 'Cinematic Hybrid Orchestral, Deep Brass, Building Tension, Powerful Strings, Instrumental, {theme}, 100 BPM, Polished',
      bpm: [95, 105],
      notes: '像将军在战前做最后一次战略推演。',
    },
  },

  INTP: {
    Focus: {
      style: 'Glitch Ambient, Generative Textures, Subtle Digital Artifacts, Instrumental, {theme}, 80 BPM, Lo-Fi, Raw',
      bpm: [75, 85],
      notes: '内省+抽象+逻辑+自由。像在拆解一个有趣的算法。',
    },
    Spark: {
      style: 'Experimental Electronica, Modular Synth Patches, Unexpected Sound Design, Instrumental, {theme}, 95 BPM, Polished',
      bpm: [90, 100],
      notes: '像在实验室里发现了一个有趣的bug。',
    },
    Sprint: {
      style: 'IDM Breakbeat, Intricate Percussion, Rapid Glitch Textures, Instrumental, {theme}, 130 BPM, Punchy, Hi-Fi',
      bpm: [125, 135],
      notes: '思维高速运转的听觉化。',
    },
    Charge: {
      style: 'Cinematic Electronic Hybrid, Building Synth Crescendo, Intellectual Triumph, Instrumental, {theme}, 110 BPM, Polished',
      bpm: [105, 115],
      notes: '像终于证明了一个定理的快感。',
    },
  },

  ENTJ: {
    Focus: {
      style: 'Commanding Ambient, Powerful Synth Bass, Structured Atmosphere, Instrumental, {theme}, 95 BPM, Hi-Fi, Polished',
      bpm: [90, 100],
      notes: '外向+抽象+逻辑+秩序。像在指挥一场战役。',
    },
    Spark: {
      style: 'Epic Orchestral Electronic, Bold Brass Motifs, Energetic Strings, Instrumental, {theme}, 115 BPM, Polished',
      bpm: [110, 120],
      notes: '像在董事会上提出一个改变格局的方案。',
    },
    Sprint: {
      style: 'Powerful Hybrid Orchestral, Driving Percussion, Relentless Brass, Instrumental, {theme}, 140 BPM, Punchy, Hi-Fi',
      bpm: [135, 145],
      notes: '像在最后期限前果断执行。',
    },
    Charge: {
      style: 'Grand Cinematic Epic, Full Orchestra, Thundering Timpani, Triumphant Brass Fanfare, Instrumental, {theme}, 110 BPM, Polished',
      bpm: [105, 115],
      notes: '像站在巅峰俯瞰全局。',
    },
  },

  ENTP: {
    Focus: {
      style: 'Cool Electro Funk, Groovy Bassline, Minimal Catchy, Instrumental, {theme}, 100 BPM, Polished, Warm',
      bpm: [95, 105],
      notes: '外向+抽象+逻辑+自由。像在构思一个疯狂的点子。',
    },
    Spark: {
      style: 'Funky Future Bass, Bouncing Synths, Playful Drops, Clever Sound Design, Instrumental, {theme}, 120 BPM, Polished',
      bpm: [115, 125],
      notes: '像在辩论中抛出一个让所有人愣住的论点。',
    },
    Sprint: {
      style: 'High-Energy Electro House, Pumping Bass, Rapid Synth Stabs, Instrumental, {theme}, 135 BPM, Punchy, Hi-Fi',
      bpm: [130, 140],
      notes: '像在混乱中找到最优解的兴奋。',
    },
    Charge: {
      style: 'Explosive Festival Electronic, Massive Build-Up, Epic Drop, Rebellious Energy, Instrumental, {theme}, 128 BPM, Polished',
      bpm: [125, 130],
      notes: '像摇滚明星登场。',
    },
  },

  // ═══════════════════════════════════════
  //  NF 组合：情感 + 直觉
  // ═══════════════════════════════════════

  INFJ: {
    Focus: {
      style: 'Neo-Classical Piano, Gentle Ambient Strings, Ethereal Reverb, Instrumental, {theme}, 75 BPM, Polished, Intimate',
      bpm: [70, 80],
      notes: '内省+抽象+温暖+秩序。像在雨天读一本深刻的书。',
    },
    Spark: {
      style: 'Dreamy Orchestral Ambient, Gentle Piano Melodies, Warm String Swells, Instrumental, {theme}, 85 BPM, Polished',
      bpm: [80, 90],
      notes: '像在冥想中获得一个深刻的洞见。',
    },
    Sprint: {
      style: 'Building Cinematic Ambient, Urgent Strings, Pulsing Piano, Instrumental, {theme}, 105 BPM, Polished, Dynamic',
      bpm: [100, 110],
      notes: '优雅地紧迫，不是慌乱而是坚定。',
    },
    Charge: {
      style: 'Epic Emotional Orchestral, Soaring Strings, Powerful Piano, Cathartic Build, Instrumental, {theme}, 95 BPM, Polished',
      bpm: [90, 100],
      notes: '像在分享一个人生中最重要的感悟。',
    },
  },

  INFP: {
    Focus: {
      style: 'Soft Ambient Guitar, Gentle Reverb, Dreamy Textures, Instrumental, {theme}, 80 BPM, Lo-Fi, Warm',
      bpm: [75, 85],
      notes: '内省+抽象+感性+自由。像在写一封不会寄出的信。',
    },
    Spark: {
      style: 'Indie Folk Dreamy, Whimsical Guitar Patterns, Gentle Synths, Instrumental, {theme}, 90 BPM, Warm, Intimate',
      bpm: [85, 95],
      notes: '像在日记本上画满了奇思妙想。',
    },
    Sprint: {
      style: 'Emotional Indie Rock, Driving Guitar, Building Intensity, Instrumental, {theme}, 120 BPM, Punchy, Raw',
      bpm: [115, 125],
      notes: '带着感情冲刺，感性驱动的紧迫。',
    },
    Charge: {
      style: 'Cinematic Indie Orchestral, Lush Strings, Emotional Crescendo, Instrumental, {theme}, 100 BPM, Polished',
      bpm: [95, 105],
      notes: '像在台上说出最真实的自己。',
    },
  },

  ENFJ: {
    Focus: {
      style: 'Warm Ambient Electronic, Gentle Pads, Smooth Textures, Instrumental, {theme}, 85 BPM, Polished, Warm',
      bpm: [80, 90],
      notes: '外向+抽象+感性+秩序。像在篝火旁安静地陪伴朋友。',
    },
    Spark: {
      style: 'Uplifting Indie Pop, Bright Synths, Communal Energy, Instrumental, {theme}, 105 BPM, Polished',
      bpm: [100, 110],
      notes: '像在激励整个团队看到共同的愿景。',
    },
    Sprint: {
      style: 'Driving Warm Electronic, Pulsing Bass, Motivational Build, Instrumental, {theme}, 125 BPM, Punchy, Hi-Fi',
      bpm: [120, 130],
      notes: '像在带领团队做最后的冲刺。',
    },
    Charge: {
      style: 'Epic Emotional Pop Anthem, Soaring Melody, Empowering Build, Instrumental, {theme}, 110 BPM, Polished',
      bpm: [105, 115],
      notes: '像在毕业典礼上做最打动人的演讲。',
    },
  },

  ENFP: {
    Focus: {
      style: 'Bright Lo-Fi Chill, Cozy Synths, Gentle Groove, Instrumental, {theme}, 90 BPM, Lo-Fi, Warm',
      bpm: [85, 95],
      notes: '外向+抽象+感性+自由。像在阳光下的咖啡馆发呆。',
    },
    Spark: {
      style: 'Tropical Indie Pop, Bouncy Synths, Colorful Production, Instrumental, {theme}, 115 BPM, Polished, Bright',
      bpm: [110, 120],
      notes: '像在旅行中突然冒出一个改变人生的点子。',
    },
    Sprint: {
      style: 'High-Energy Indie Dance, Euphoric Synths, Fast Drums, Instrumental, {theme}, 135 BPM, Punchy, Hi-Fi',
      bpm: [130, 140],
      notes: '像在截止时间前嗨着把活干完。',
    },
    Charge: {
      style: 'Anthemic Festival Pop, Massive Melody, Confetti Drop Energy, Instrumental, {theme}, 125 BPM, Polished',
      bpm: [120, 130],
      notes: '像在音乐节主舞台登场。',
    },
  },

  // ═══════════════════════════════════════
  //  SJ 组合：实感 + 情感
  // ═══════════════════════════════════════

  ISTJ: {
    Focus: {
      style: 'Lo-Fi Hip Hop, Warm Vinyl Crackle, Steady Simple Rhythm, Instrumental, {theme}, 85 BPM, Lo-Fi, Raw',
      bpm: [80, 90],
      notes: '最具体+最克制+最有秩序。像在有条不紊地完成清单。',
    },
    Spark: {
      style: 'Jazzy Lo-Fi Beats, Walking Bass, Gentle Keys, Instrumental, {theme}, 95 BPM, Lo-Fi, Warm',
      bpm: [90, 100],
      notes: '像在整理一份完美的计划书。',
    },
    Sprint: {
      style: 'Driving Downtempo, Urgent Controlled Beats, Precise Percussion, Instrumental, {theme}, 110 BPM, Punchy, Hi-Fi',
      bpm: [105, 115],
      notes: '有条不紊地加速，不慌不忙但很高效。',
    },
    Charge: {
      style: 'Stadium Rock Anthem, Steady Powerful Drums, Confident Guitar Riff, Instrumental, {theme}, 110 BPM, Polished',
      bpm: [105, 115],
      notes: '像一个可靠的队友站出来说"交给我"。',
    },
  },

  ISFJ: {
    Focus: {
      style: 'Soft Acoustic Fingerpicking, Gentle Piano, Warm Organic, Instrumental, {theme}, 75 BPM, Intimate, Raw',
      bpm: [70, 80],
      notes: '具体+温暖+有秩序。像在厨房里和家人一起做饭。',
    },
    Spark: {
      style: 'Gentle Folk Acoustic, Warm Guitar Strumming, Cozy Atmosphere, Instrumental, {theme}, 88 BPM, Warm, Intimate',
      bpm: [83, 93],
      notes: '像在午后和朋友一起商量周末计划。',
    },
    Sprint: {
      style: 'Urgent Warm Acoustic, Driving Strumming, Gentle Percussion, Instrumental, {theme}, 105 BPM, Punchy, Raw',
      bpm: [100, 110],
      notes: '为了保护在乎的人而加速。',
    },
    Charge: {
      style: 'Heartwarming Orchestral Folk, Swelling Strings, Gentle Power, Instrumental, {theme}, 95 BPM, Polished',
      bpm: [90, 100],
      notes: '像默默做了很多然后被感谢时的温暖。',
    },
  },

  ESTJ: {
    Focus: {
      style: 'Clean Tech House, Steady 4/4 Kick, Crisp Hi-Hats, Instrumental, {theme}, 100 BPM, Polished, Hi-Fi',
      bpm: [95, 105],
      notes: '外向+具体+逻辑+秩序。像在管理一个运转良好的团队。',
    },
    Spark: {
      style: 'Driving Minimal Techno, Structured Builds, Crisp Percussion, Instrumental, {theme}, 118 BPM, Polished',
      bpm: [113, 123],
      notes: '像在主持一场高效的头脑风暴。',
    },
    Sprint: {
      style: 'Peak Time Techno, Relentless Kick Drum, Industrial Textures, Instrumental, {theme}, 130 BPM, Punchy, Hi-Fi',
      bpm: [125, 135],
      notes: '像在最后期限前发号施令。',
    },
    Charge: {
      style: 'Powerful Arena Electronic, Massive Beats, Commanding Presence, Instrumental, {theme}, 120 BPM, Polished',
      bpm: [115, 125],
      notes: '像CEO在年会上发表演讲。',
    },
  },

  ESFJ: {
    Focus: {
      style: 'Smooth Soulful Jazz, Warm Rhodes Piano, Gentle Bass, Instrumental, {theme}, 85 BPM, Warm, Intimate',
      bpm: [80, 90],
      notes: '外向+具体+感性+秩序。像在组织一场完美的聚会。',
    },
    Spark: {
      style: 'Feel-Good Motown Groove, Upbeat Bass, Bright Horns, Instrumental, {theme}, 108 BPM, Polished, Warm',
      bpm: [103, 113],
      notes: '像在为朋友策划一个惊喜派对。',
    },
    Sprint: {
      style: 'Upbeat Soul Pop, Driving Rhythm, Energetic Horns, Instrumental, {theme}, 122 BPM, Punchy, Hi-Fi',
      bpm: [117, 127],
      notes: '像在带领大家一起赶ddl。',
    },
    Charge: {
      style: 'Triumphant Soul Anthem, Big Brass Section, Empowering, Instrumental, {theme}, 108 BPM, Polished',
      bpm: [103, 113],
      notes: '像被大家真心拥戴的那个人。',
    },
  },

  // ═══════════════════════════════════════
  //  SP 组合：实感 + 自由
  // ═══════════════════════════════════════

  ISTP: {
    Focus: {
      style: 'Minimal Industrial, Clean Mechanical Beats, Precise Synth Textures, Instrumental, {theme}, 100 BPM, Raw, Hi-Fi',
      bpm: [95, 105],
      notes: '具体+逻辑+自由。像在拆解一台精密仪器。',
    },
    Spark: {
      style: 'Tech Minimal, Clever Percussive Patterns, Experimental Sound Design, Instrumental, {theme}, 108 BPM, Polished',
      bpm: [103, 113],
      notes: '像在车库里捣鼓一个新发明。',
    },
    Sprint: {
      style: 'Hard-Hitting Industrial Techno, Relentless Mechanical Drive, Razor-Sharp, Instrumental, {theme}, 130 BPM, Punchy, Hi-Fi',
      bpm: [125, 135],
      notes: '像在拆炸弹时的冷静专注。',
    },
    Charge: {
      style: 'Epic Industrial Hybrid, Massive Mechanical Beats, Metallic Textures, Instrumental, {theme}, 115 BPM, Polished',
      bpm: [110, 120],
      notes: '像动作片主角在最后一秒完成任务。',
    },
  },

  ISFP: {
    Focus: {
      style: 'Chillhop Lo-Fi, Soft Jazz Samples, Gentle Pads, Instrumental, {theme}, 82 BPM, Lo-Fi, Warm',
      bpm: [77, 87],
      notes: '具体+感性+自由。像在画一幅抽象画。',
    },
    Spark: {
      style: 'Art Pop Ambient, Dreamy Synths, Painterly Textures, Instrumental, {theme}, 92 BPM, Polished, Warm',
      bpm: [87, 97],
      notes: '像在美术馆里获得了灵感。',
    },
    Sprint: {
      style: 'Emotional Lo-Fi Beats, Building Intensity, Heartfelt Urgency, Instrumental, {theme}, 112 BPM, Punchy, Raw',
      bpm: [107, 117],
      notes: '带着对美的追求赶工期。',
    },
    Charge: {
      style: 'Cinematic Art Pop, Lush Atmospheric Build, Emotional Beauty, Instrumental, {theme}, 100 BPM, Polished',
      bpm: [95, 105],
      notes: '像在展览开幕时看到自己的作品被欣赏。',
    },
  },

  ESTP: {
    Focus: {
      style: 'Punchy Electro, Clean Bass Drops, Energetic Minimal, Instrumental, {theme}, 108 BPM, Punchy, Hi-Fi',
      bpm: [103, 113],
      notes: '外向+具体+逻辑+自由。像在极限运动中保持冷静。',
    },
    Spark: {
      style: 'Big Room Electro, Heavy Bass Drops, Euphoric Builds, Instrumental, {theme}, 128 BPM, Polished, Punchy',
      bpm: [123, 133],
      notes: '像在派对上即兴表演。',
    },
    Sprint: {
      style: 'Hard Drum And Bass, Rapid Breakbeats, Maximum Energy, Instrumental, {theme}, 170 BPM, Punchy, Hi-Fi',
      bpm: [165, 175],
      notes: '像在蹦极跳台上的肾上腺素飙升。',
    },
    Charge: {
      style: 'Massive Festival Trap, Earth-Shaking 808s, Hype Builds, Instrumental, {theme}, 140 BPM, Polished, Punchy',
      bpm: [135, 145],
      notes: '像超级碗中场秀的登场。',
    },
  },

  ESFP: {
    Focus: {
      style: 'Tropical House Chill, Warm Pads, Gentle Steel Drums, Instrumental, {theme}, 95 BPM, Warm, Polished',
      bpm: [90, 100],
      notes: '外向+具体+感性+自由。像在海边享受当下。',
    },
    Spark: {
      style: 'Latin Dance Pop, Reggaeton Rhythm, Vibrant Percussion, Instrumental, {theme}, 108 BPM, Polished, Bright',
      bpm: [103, 113],
      notes: '像在舞池里突然开始领舞。',
    },
    Sprint: {
      style: 'High-Energy Reggaeton, Aggressive Dembow, Fiery Percussion, Instrumental, {theme}, 128 BPM, Punchy, Hi-Fi',
      bpm: [123, 133],
      notes: '像在舞蹈比赛的最后冲刺。',
    },
    Charge: {
      style: 'Massive Latin Pop Anthem, Explosive Brass, Carnival Drums, Instrumental, {theme}, 120 BPM, Polished',
      bpm: [115, 125],
      notes: '像在格莱美颁奖典礼上的压轴表演。',
    },
  },
};

// ─── 辅助函数 ───

/**
 * 构造最终 Suno prompt
 * @param {string} mbtiType - 4字母MBTI类型
 * @param {string} mode - Focus | Spark | Sprint | Charge
 * @param {object} projectTheme - { instruments, mood, avoid }
 * @returns {{ style: string, structureTags: string, bpm: number, exclude: string, notes: string }}
 */
export function buildSunoPrompt(mbtiType, mode, projectTheme = null) {
  const entry = MBTI_PROMPTS[mbtiType]?.[mode];
  if (!entry) return null;

  const modifier = MODE_MODIFIERS[mode];
  const theme = projectTheme || PROJECT_THEME_PRESETS.tool;

  // 注入项目主题关键词到 {theme} 占位符
  let style = entry.style;
  const themeStr = [theme.instruments, theme.mood].join(', ');
  style = style.replace('{theme}', themeStr);

  // 调整 BPM
  const avgBpm = (entry.bpm[0] + entry.bpm[1]) / 2;
  const adjustedBpm = Math.max(60, Math.min(180, Math.round(avgBpm + modifier.bpmOffset)));

  // 合并风格修饰
  style = [style, modifier.styleModifier].join(', ');

  // Exclude 列表（用正向描述的反面）
  const exclude = theme.avoid || '';

  return {
    style,
    structureTags: modifier.structureTags,
    bpm: adjustedBpm,
    exclude,
    notes: entry.notes,
    modeDescription: modifier.description,
  };
}

/**
 * 根据项目描述自动推断主题类型
 */
export function inferProjectTheme(description) {
  const keywords = description.toLowerCase();
  const themeMap = [
    { type: 'game',     signals: ['game', '游戏', 'godot', 'unity', 'pixel', 'sprite'] },
    { type: 'ai_agent', signals: ['agent', 'llm', 'ai', '智能', '模型', 'prompt'] },
    { type: 'tool',     signals: ['tool', '工具', 'editor', 'utility', 'helper'] },
    { type: 'social',   signals: ['social', '社交', 'community', '社区', 'chat', 'forum'] },
    { type: 'data',     signals: ['data', '数据', 'analytics', '分析', 'dashboard', '可视化'] },
    { type: 'creative', signals: ['art', '艺术', 'design', '设计', 'music', '音乐'] },
    { type: 'education',signals: ['learn', '学习', 'education', '教育', 'course', '教程'] },
    { type: 'nature',   signals: ['outdoor', '户外', 'hike', '徒步', 'nature', '自然'] },
    { type: 'finance',  signals: ['finance', '金融', 'trading', '交易', 'investment'] },
    { type: 'health',   signals: ['health', '健康', 'medical', '医疗', 'fitness'] },
  ];

  for (const { type, signals } of themeMap) {
    if (signals.some(s => keywords.includes(s))) {
      return PROJECT_THEME_PRESETS[type];
    }
  }
  return PROJECT_THEME_PRESETS.tool;
}

/**
 * 获取进度偏差对应的模式
 */
export function getModeFromProgress(deviation) {
  if (deviation > 30) return 'Charge';
  if (deviation > 10) return 'Sprint';
  return null; // 正常或领先，保持当前
}
