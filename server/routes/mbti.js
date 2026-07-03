import { Router } from 'express';
import { composePrompt, getMbtiProfile, listMbtiTypes } from '../services/promptComposer.js';

const router = Router();

router.get('/types', (_req, res) => {
  res.json({ types: listMbtiTypes() });
});

router.post('/profile', (req, res) => {
  const { mbti, mode = 'focus', projectAnalysis } = req.body || {};
  if (!mbti) {
    return res.status(400).json({ error: 'mbti is required' });
  }

  const profile = getMbtiProfile(mbti);
  if (!profile) {
    return res.status(404).json({ error: 'Unknown MBTI type' });
  }

  const composed = composePrompt({ mbti, mode, projectAnalysis });
  res.json({
    mbti,
    traits: profile.traits,
    genres: profile.genres,
    theme: profile.theme,
    ...composed,
  });
});

export default router;
