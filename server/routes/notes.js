import { Router } from 'express';
import { parseNotes } from '../services/llm/index.js';

const router = Router();

router.post('/parse', async (req, res) => {
  const { text } = req.body || {};
  if (!text || !text.trim()) {
    return res.json({ keywords: [], mood: [], avoid: [] });
  }
  try {
    const result = await parseNotes(text);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
