import { Router } from 'express';
import { generateLyrics } from '../services/lyricsGenerator.js';

const router = Router();

router.post('/generate', async (req, res) => {
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
