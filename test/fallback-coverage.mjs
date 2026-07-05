import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const manifestPath = join(root, 'server/data/fallback-manifest.json');

const REQUIRED_MODES = [
  'brainstorm',
  'focus',
  'sprint',
  'charge',
  'behind',
  'break',
  'celebrate',
];
const PERSONALITY_BUCKET = 'personality';
const STARTUP_BUCKET = 'startup';
const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

const MIN_TRACKS_PER_MODE = 2;

function isPlayableUrl(value) {
  if (typeof value !== 'string') return false;
  if (value.startsWith('/samples/')) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const seenIds = new Set();

function validateTracks(bucket) {
  manifest[bucket].forEach((track, index) => {
    assert.equal(typeof track.id, 'string', `${bucket}[${index}].id must be a string`);
    assert.ok(track.id.trim(), `${bucket}[${index}].id is required`);
    assert.equal(seenIds.has(track.id), false, `Duplicate fallback track id: ${track.id}`);
    seenIds.add(track.id);

    assert.equal(typeof track.title, 'string', `${bucket}[${index}].title must be a string`);
    assert.ok(track.title.trim(), `${bucket}[${index}].title is required`);
    assert.ok(isPlayableUrl(track.url), `${bucket}[${index}].url must be http(s) or /samples/...`);
    if (track.mbti !== undefined) {
      assert.ok(MBTI_TYPES.includes(track.mbti), `${bucket}[${index}].mbti must be a known MBTI type`);
    }
  });
}

for (const mode of REQUIRED_MODES) {
  assert.ok(Array.isArray(manifest[mode]), `Missing fallback mode: ${mode}`);
  assert.ok(
    manifest[mode].length >= MIN_TRACKS_PER_MODE,
    `${mode} needs at least ${MIN_TRACKS_PER_MODE} fallback tracks`
  );
  validateTracks(mode);
}

assert.ok(Array.isArray(manifest[PERSONALITY_BUCKET]), `Missing fallback bucket: ${PERSONALITY_BUCKET}`);
validateTracks(PERSONALITY_BUCKET);
const personalityTypes = new Set(manifest[PERSONALITY_BUCKET].map((track) => track.mbti).filter(Boolean));
for (const type of MBTI_TYPES) {
  assert.ok(personalityTypes.has(type), `Missing personality fallback track for ${type}`);
}

assert.ok(Array.isArray(manifest[STARTUP_BUCKET]), `Missing fallback bucket: ${STARTUP_BUCKET}`);
assert.ok(manifest[STARTUP_BUCKET].length >= 1, `${STARTUP_BUCKET} needs at least 1 fallback track`);
validateTracks(STARTUP_BUCKET);

const allowedBuckets = [...REQUIRED_MODES, PERSONALITY_BUCKET, STARTUP_BUCKET];
const unexpectedModes = Object.keys(manifest).filter((mode) => !allowedBuckets.includes(mode));
assert.deepEqual(unexpectedModes, [], `Unexpected fallback modes: ${unexpectedModes.join(', ')}`);

console.log('Fallback coverage passed');
