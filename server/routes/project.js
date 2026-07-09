import { Router } from 'express';
import { analyzeProject, parseNotes } from '../services/llm/index.js';
import { requireIdentity } from '../middleware/userAuth.js';
import { createRateLimit } from '../middleware/rateLimit.js';

const router = Router();
const notesLimit = createRateLimit({
  windowMs: 60_000,
  max: Number(process.env.NOTES_RATE_LIMIT || 30),
  keyPrefix: 'notes-parse',
});

router.post('/analyze', requireIdentity, async (req, res) => {
  try {
    const { name = '', description = '' } = req.body || {};
    const analysis = await analyzeProject({ name, description });
    res.json(analysis);
  } catch (err) {
    console.error('[project/analyze]', err);
    res.status(500).json({ error: err.message });
  }
});

function parseGithubUrl(input) {
  const trimmed = String(input || '').trim();
  const match = trimmed.match(
    /(?:github\.com[/:])([\w.-]+)\/([\w.-]+?)(?:\.git)?(?:[/?#].*)?$/i
  );
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}

async function fetchGithub(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'vibe-coding-sonic',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${path}`);
  }
  return res.json();
}

router.post('/analyze-github', requireIdentity, async (req, res) => {
  try {
    const parsed = parseGithubUrl(req.body?.url);
    if (!parsed) {
      return res.status(400).json({ error: '无法识别的 GitHub 地址' });
    }

    const { owner, repo } = parsed;
    const repoInfo = await fetchGithub(`/repos/${owner}/${repo}`);

    let readmeExcerpt = '';
    try {
      const readme = await fetchGithub(`/repos/${owner}/${repo}/readme`);
      const decoded = Buffer.from(readme.content || '', 'base64').toString('utf-8');
      readmeExcerpt = decoded.slice(0, 1500);
    } catch {
      // README 可选
    }

    let languages = [];
    try {
      const langData = await fetchGithub(`/repos/${owner}/${repo}/languages`);
      languages = Object.keys(langData).slice(0, 5);
    } catch {
      // languages 可选
    }

    const description = [
      repoInfo.description || '',
      repoInfo.topics?.length ? `Topics: ${repoInfo.topics.join(', ')}` : '',
      languages.length ? `Languages: ${languages.join(', ')}` : '',
      readmeExcerpt ? `README: ${readmeExcerpt}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const analysis = await analyzeProject({
      name: repoInfo.full_name || `${owner}/${repo}`,
      description,
    });

    res.json({
      ...analysis,
      repo: {
        fullName: repoInfo.full_name,
        description: repoInfo.description,
        stars: repoInfo.stargazers_count,
        topics: repoInfo.topics || [],
        languages,
      },
    });
  } catch (err) {
    console.error('[project/analyze-github]', err);
    res.status(502).json({ error: err.message });
  }
});

router.post('/notes/parse', requireIdentity, notesLimit, async (req, res) => {
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
