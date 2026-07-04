import { Router } from 'express';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const styles = JSON.parse(readFileSync(join(__dirname, '../data/genre-styles.json'), 'utf-8'));

const router = Router();

router.get('/', (_req, res) => {
  res.json(styles);
});

export default router;
