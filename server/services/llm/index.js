import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resolveLlmRuntime } from '../../config/providers.js';
import { callHttpLlm } from './httpProviders.js';
import { callCliLlm } from './cliProvider.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templates = JSON.parse(readFileSync(join(__dirname, '../../data/project-templates.json'), 'utf-8'));

const ANALYSIS_PROMPT = `Analyze this hackathon project and return ONLY valid JSON (no markdown):
{
  "themes": ["english theme keywords, 2-4 items"],
  "mood": ["english mood keywords, 2-4 items"],
  "instruments": ["english instrument keywords, 2-4 items"],
  "avoid": ["vocals", "..."]
}

Project name: {name}
Description: {description}`;

function matchTemplate(text) {
  const lower = text.toLowerCase();
  let best = templates.find((t) => t.id === 'default');
  let bestScore = 0;

  for (const template of templates) {
    if (template.id === 'default') continue;
    const score = template.keywords.reduce((acc, kw) => {
      return lower.includes(kw.toLowerCase()) ? acc + 1 : acc;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = template;
    }
  }

  return { ...best, source: bestScore > 0 ? 'template' : 'default' };
}

function parseJsonFromLlm(content) {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Invalid LLM response: no JSON found');
  return JSON.parse(jsonMatch[0]);
}

export async function callLlm(prompt) {
  const config = resolveLlmRuntime();
  if (!config) {
    throw new Error('LLM not configured');
  }

  if (config.type === 'cli') {
    return callCliLlm(config, prompt);
  }

  return callHttpLlm(config, prompt);
}

export function isLlmConfigured() {
  return Boolean(resolveLlmRuntime());
}

export async function analyzeProject({ name = '', description = '' }) {
  const combined = `${name} ${description}`.trim();
  if (!combined) {
    const fallback = templates.find((t) => t.id === 'default');
    return { ...fallback, source: 'default' };
  }

  const config = resolveLlmRuntime();
  if (!config) {
    return matchTemplate(combined);
  }

  try {
    const prompt = ANALYSIS_PROMPT.replace('{name}', name).replace('{description}', description);
    const content = await callLlm(prompt);
    const parsed = parseJsonFromLlm(content);

    return {
      themes: parsed.themes || [],
      mood: parsed.mood || [],
      instruments: parsed.instruments || [],
      avoid: parsed.avoid || ['vocals'],
      source: config.type === 'cli' ? `cli:${config.providerId}` : config.providerId,
    };
  } catch (err) {
    console.warn(`[llm:${config.providerId}] fallback to template:`, err.message);
    return matchTemplate(combined);
  }
}
