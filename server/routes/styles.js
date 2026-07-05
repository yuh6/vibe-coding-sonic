import { Router } from 'express';
import { listGenreStyles } from '../services/genreStyles.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json(listGenreStyles());
});

export default router;
