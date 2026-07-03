import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Router } from 'express';

const __dirname = dirname(fileURLToPath(import.meta.url));
const demoSchedule = JSON.parse(
  readFileSync(join(__dirname, '../data/demo-schedule.json'), 'utf-8')
);

const router = Router();

function parseTime(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getCurrentPhase(phases, now = new Date()) {
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const phase of phases) {
    const start = parseTime(phase.start);
    let end = parseTime(phase.end);
    if (end <= start) end += 24 * 60;

    let current = minutes;
    if (current < start && end > 24 * 60 && start > end - 24 * 60) {
      current += 24 * 60;
    }

    if (current >= start && current < end) {
      return phase;
    }
  }

  return phases[0];
}

router.get('/demo', (_req, res) => {
  res.json(demoSchedule);
});

router.post('/sync', (req, res) => {
  const phases = req.body?.phases || demoSchedule.phases;
  const current = getCurrentPhase(phases);
  res.json({ current, phases });
});

export default router;
