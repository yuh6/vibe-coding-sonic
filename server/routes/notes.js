import { Router } from 'express';
import { parseNotes } from '../services/llm/index.js';
import { requireIdentity } from '../middleware/userAuth.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = Router();
const notesLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(process.env.NOTES_RATE_LIMIT || 30),
  keyPrefix: 'notes-parse',
});

router.post('/parse', requireIdentity, notesLimit, async (req, res) => {
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
