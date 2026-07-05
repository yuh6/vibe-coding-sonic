import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const styles = JSON.parse(readFileSync(join(__dirname, '../data/genre-styles.json'), 'utf-8'));
const stylesById = new Map(styles.map((style) => [style.id, style]));

function normalizeBpmRange(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const range = value.map(Number);
  return range.every(Number.isFinite) ? range : null;
}

export function listGenreStyles() {
  return styles;
}

export function resolveGenreStyle(value) {
  if (!value) return null;

  if (typeof value === 'string') {
    return stylesById.get(value) || null;
  }

  if (typeof value !== 'object') return null;

  if (value.id && stylesById.has(value.id)) {
    return stylesById.get(value.id);
  }

  if (typeof value.tags !== 'string' || !value.tags.trim()) return null;

  return {
    id: typeof value.id === 'string' ? value.id : null,
    label: typeof value.label === 'string' ? value.label : null,
    category: typeof value.category === 'string' ? value.category : null,
    tags: value.tags.trim(),
    bpmRange: normalizeBpmRange(value.bpmRange),
    instruments: Array.isArray(value.instruments) ? value.instruments : [],
    mood: Array.isArray(value.mood) ? value.mood : [],
  };
}
