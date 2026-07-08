/**
 * 歌词生成服务 — 设计文档 §4
 * 按 Suno V5 手册最佳实践：结构标签带描述、中文可唱性约束、MBTI 人声推荐。
 */
import { callLlm, isLlmConfigured } from './llm/index.js';
import { getMbtiProfile } from './promptComposer.js';

// §4.4 人声类型推荐（按 MBTI 维度细分）
const VOCAL_STYLES = {
  IT: { style: 'Whispered Male Vocals, Low-key, Spoken Word', desc: '低吟耳语' },
  IF: { style: 'Breathy Female Vocals, Ethereal, Intimate', desc: '气声空灵' },
  ET: { style: 'Confident Baritone Male Vocals, Resonant', desc: '自信共鸣' },
  EF: { style: 'Powerful Female Vocals, Soulful, Belting', desc: '有力灵魂' },
};

function suggestVocalStyle(mbtiType) {
  const fallback = !mbtiType || mbtiType.length < 4
    ? VOCAL_STYLES.IF
    : VOCAL_STYLES[`${mbtiType[0]}${mbtiType[2]}`] || VOCAL_STYLES.IF;
  const profile = getMbtiProfile(mbtiType);
  if (profile?.vocalHint) {
    return { style: profile.vocalHint, desc: fallback.desc };
  }
  return fallback;
}

function buildLyricsPrompt({ mbtiType, phase, projectThemes, notes, language }) {
  const lang = language === 'en' ? 'English' : '中文';
  const isZh = language !== 'en';
  const noteText = notes?.keywords?.length ? notes.keywords.join(', ') : '';
  const vocal = suggestVocalStyle(mbtiType);

  return `You are a professional songwriter creating lyrics for Suno AI V5.

STRICT RULES (follow exactly):
1. Output ONLY the lyrics with structure tags. No explanations, no comments.
2. Structure (each tag on its own line, description ≤8 words after colon):
   [Intro: Soft, Building Atmosphere]
   (instrumental, no lyrics here)

   [Verse 1: Sparse, Gentle]
   ${isZh ? '主歌歌词（每行 ≤15 字，4-6 行）' : 'Verse lyrics (8-12 words/line, 4-6 lines)'}

   [Pre-Chorus: Building Tension]
   ${isZh ? '过渡（2-3 行）' : 'Transition (2-3 lines)'}

   [Chorus: Catchy Hook, Memorable Melody, Full Energy]
   ${isZh ? '副歌（每行 ≤10 字，押韵，开口元音结尾）' : 'Chorus (short punchy lines, rhyming)'}

   [Verse 2: More Instruments]
   [Chorus]
   [Bridge: Contrast, Stripped Back]
   [Final Chorus: Maximum Energy]
   [Outro: Gentle Ending, Fade Out]
   [End]

3. Songwriting rules:
   ${isZh ? '- 中文每行 ≤15 字，副歌每行 ≤10 字' : '- English: 8-12 words per line, chorus lines shorter'}
   - Chorus must have a strong hook (catchy, repeatable phrase)
   - ${isZh ? '副歌句末用开口元音（啊/哦/爱/ei/ou）' : 'End chorus lines with open vowels'}
   - ${isZh ? '押韵放句末，副歌必须押韵' : 'Rhyme at line ends, chorus must rhyme'}
   - Leave blank lines between sections for instrumental transitions
   - Tags SHORT and COMMAND-LIKE (≤8 words after colon)

4. Context:
   - MBTI: ${mbtiType || 'INTJ'}
   - Phase: ${phase || 'focus'}
   - Theme: ${projectThemes || 'hackathon coding'}
   ${noteText ? `- Extra: ${noteText}` : ''}
   - Vocal style: ${vocal.style}

5. Total output ≤ 800 characters. End with [End].`;
}

/**
 * 生成歌词
 * @returns {{ lyrics: string, vocalStyle: string, vocalDesc: string, structure: string[] } | null}
 */
export async function generateLyrics({ mbtiType, mode, projectAnalysis, notes, language = 'zh' }) {
  if (!isLlmConfigured()) {
    return null;
  }

  const projectThemes = projectAnalysis?.themes?.join(', ') || '';
  const prompt = buildLyricsPrompt({
    mbtiType,
    phase: mode,
    projectThemes,
    notes,
    language,
  });

  const content = await callLlm(prompt);

  // 提取结构标签
  const structureTags = (content.match(/\[[^\]]+\]/g) || []).map((t) => t.replace(/[[\]]/g, ''));
  const vocal = suggestVocalStyle(mbtiType);

  return {
    lyrics: content.trim(),
    vocalStyle: vocal.style,
    vocalDesc: vocal.desc,
    structure: structureTags,
  };
}

export { suggestVocalStyle };
