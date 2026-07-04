import { Router } from 'express';
import { generateLyrics } from '../services/lyricsGenerator.js';
import { requireUser } from '../middleware/userAuth.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = Router();
const lyricsLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(process.env.LYRICS_RATE_LIMIT || 10),
  keyPrefix: 'lyrics-generate',
});

router.post('/generate', requireUser, lyricsLimit, async (req, res) => {
  const { mbtiType, mode, projectAnalysis, notes, language } = req.body || {};
  try {
    const result = await generateLyrics({ mbtiType, mode, projectAnalysis, notes, language });
    if (!result) {
      return res.status(503).json({ error: 'LLM 未配置，无法生成歌词' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
