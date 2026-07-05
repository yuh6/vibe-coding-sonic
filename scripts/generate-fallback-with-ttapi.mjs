import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitGeneration, pollGeneration, isSunoConfigured } from '../server/services/sunoClient.js';
import { db } from '../server/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MANIFEST_PATH = join(ROOT, 'server/data/fallback-manifest.json');
const SAMPLES_DIR = join(ROOT, 'public/samples');
const POLL_INTERVAL_MS = Number(process.env.FALLBACK_TTAPI_POLL_MS || 5000);
const POLL_TIMEOUT_MS = Number(process.env.FALLBACK_TTAPI_TIMEOUT_MS || 12 * 60 * 1000);

const PLAN = [
  {
    mode: 'startup',
    id: 'startup-horizon-a',
    title: 'Startup Horizon',
    filename: 'fallback-startup-horizon-a.mp3',
    prompt: 'futuristic city pop instrumental, dreamy deep synth pads, glassy DX7 electric piano, neon analog arpeggios, smooth fretless bass, crisp gated drums, airy percussion, exploratory atmosphere, night skyline, cosmic discovery, seamless loop friendly, 96 BPM, no vocals, over one minute, polished hi-fi production, wide stereo',
    weirdnessConstraint: 58,
    styleWeight: 68,
  },
  {
    mode: 'brainstorm',
    id: 'brainstorm-1',
    title: 'Creative Spark',
    filename: 'fallback-brainstorm-a.mp3',
    prompt: 'playful indie electronic, funky synth bass, marimba accents, claps, bright arpeggios, dynamic, varied, 110 BPM, instrumental, polished production',
    weirdnessConstraint: 60,
    styleWeight: 55,
  },
  {
    mode: 'brainstorm',
    id: 'brainstorm-2',
    title: 'Brainstorm Beat',
    filename: 'fallback-brainstorm-b.mp3',
    prompt: 'upbeat electro funk, syncopated drums, bouncy bass, playful synth stabs, curious melody, ideation energy, 114 BPM, instrumental, wide stereo',
    weirdnessConstraint: 60,
    styleWeight: 55,
  },
  {
    mode: 'brainstorm',
    id: 'brainstorm-3',
    title: 'Idea Burst',
    filename: 'fallback-brainstorm-c.mp3',
    prompt: 'upbeat electro pop, plucky synths, light percussion, curious melody, bright arpeggios, wide stereo, 118 BPM, instrumental',
    weirdnessConstraint: 60,
    styleWeight: 55,
  },
  {
    mode: 'focus',
    id: 'focus-1',
    title: 'Lo-fi Study',
    filename: 'fallback-focus-a.mp3',
    prompt: 'lo-fi hip hop, warm Rhodes, soft vinyl texture, steady drums, mellow bass, calm study music, 82 BPM, instrumental, clean mix',
    weirdnessConstraint: 45,
    styleWeight: 65,
  },
  {
    mode: 'focus',
    id: 'focus-2',
    title: 'Ambient Flow',
    filename: 'fallback-focus-b.mp3',
    prompt: 'ambient electronica, soft pads, minimal pulse, spacious reverb, calm, low distraction, 76 BPM, instrumental, intimate recording',
    weirdnessConstraint: 45,
    styleWeight: 65,
  },
  {
    mode: 'focus',
    id: 'focus-3',
    title: 'Deep Focus',
    filename: 'fallback-focus-c.mp3',
    prompt: 'minimal downtempo, warm bass, soft keys, subtle percussion, focused, steady, spacious, 78 BPM, instrumental, clean mix',
    weirdnessConstraint: 45,
    styleWeight: 65,
  },
  {
    mode: 'sprint',
    id: 'sprint-1',
    title: 'Sprint Drive',
    filename: 'fallback-sprint-a.mp3',
    prompt: 'driving synthwave, punchy kick, tight bass, fast hi hats, urgent, high energy, relentless groove, 138 BPM, instrumental',
    weirdnessConstraint: 45,
    styleWeight: 75,
  },
  {
    mode: 'sprint',
    id: 'sprint-2',
    title: 'Deadline Rush',
    filename: 'fallback-sprint-b.mp3',
    prompt: 'energetic electronic rock, arpeggiated synths, compressed drums, tight low end, urgent coding sprint, 145 BPM, instrumental',
    weirdnessConstraint: 45,
    styleWeight: 75,
  },
  {
    mode: 'sprint',
    id: 'sprint-3',
    title: 'Night Push',
    filename: 'fallback-sprint-c.mp3',
    prompt: 'late night cyberpunk synthwave, fast sequenced bass, crisp drums, neon tension, forward motion, 142 BPM, instrumental',
    weirdnessConstraint: 45,
    styleWeight: 75,
  },
  {
    mode: 'charge',
    id: 'charge-1',
    title: 'Epic Charge',
    filename: 'fallback-charge-a.mp3',
    prompt: 'epic trailer music, big percussion, synth pulses, building tension, triumphant hook, heroic, 132 BPM, instrumental, wide stereo',
    weirdnessConstraint: 55,
    styleWeight: 65,
  },
  {
    mode: 'charge',
    id: 'charge-2',
    title: 'Stage Ready',
    filename: 'fallback-charge-b.mp3',
    prompt: 'cinematic hybrid orchestral, taiko drums, brass stabs, rising strings, heroic, presentation ready, 128 BPM, instrumental, wide stereo',
    weirdnessConstraint: 55,
    styleWeight: 65,
  },
  {
    mode: 'charge',
    id: 'charge-3',
    title: 'Final Boss',
    filename: 'fallback-charge-c.mp3',
    prompt: 'cinematic final boss theme, massive drums, brass hits, aggressive synth bass, escalating tension, 136 BPM, instrumental',
    weirdnessConstraint: 55,
    styleWeight: 65,
  },
  {
    mode: 'behind',
    id: 'behind-1',
    title: 'Catch Up Countdown',
    filename: 'fallback-behind-a.mp3',
    prompt: 'tense electronic score, ticking percussion, pulsing bass, urgent synth ostinato, high stakes, countdown, 150 BPM, instrumental',
    weirdnessConstraint: 40,
    styleWeight: 75,
  },
  {
    mode: 'behind',
    id: 'behind-2',
    title: 'Tense Push',
    filename: 'fallback-behind-b.mp3',
    prompt: 'dark techno, sharp hats, countdown risers, tight low end, intense, catch-up pressure, 156 BPM, instrumental',
    weirdnessConstraint: 40,
    styleWeight: 75,
  },
  {
    mode: 'break',
    id: 'break-1',
    title: 'Chill Breather',
    filename: 'fallback-break-a.mp3',
    prompt: 'chill lo-fi, nylon guitar, soft keys, relaxed groove, warm tape, restorative break, 72 BPM, instrumental',
    weirdnessConstraint: 50,
    styleWeight: 60,
  },
  {
    mode: 'break',
    id: 'break-2',
    title: 'Mellow Pause',
    filename: 'fallback-break-b.mp3',
    prompt: 'downtempo ambient, gentle percussion, airy pads, mellow bass, laid-back, short recharge, 68 BPM, instrumental',
    weirdnessConstraint: 50,
    styleWeight: 60,
  },
  {
    mode: 'celebrate',
    id: 'celebrate-1',
    title: 'Victory Lap',
    filename: 'fallback-celebrate-a.mp3',
    prompt: 'euphoric dance pop, bright piano chords, four on the floor, joyful synth lead, victory feeling, 124 BPM, instrumental',
    weirdnessConstraint: 55,
    styleWeight: 60,
  },
  {
    mode: 'celebrate',
    id: 'celebrate-2',
    title: 'Confetti Drop',
    filename: 'fallback-celebrate-b.mp3',
    prompt: 'festival house, big claps, uplifting bassline, triumphant melody, polished hi-fi, celebration, 128 BPM, instrumental',
    weirdnessConstraint: 55,
    styleWeight: 60,
  },
  {
    mode: 'personality',
    mbti: 'INTJ',
    id: 'personality-intj-a',
    title: 'Strategic Depth',
    filename: 'fallback-personality-intj-a.mp3',
    prompt: 'dark ambient, minimal techno, deep synth pads, sub bass, atmospheric, brooding, strategic, 100 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'INTP',
    id: 'personality-intp-a',
    title: 'Logic Drift',
    filename: 'fallback-personality-intp-a.mp3',
    prompt: 'IDM, experimental electronic, glitch textures, modular synth, ambient pads, mysterious, contemplative, 90 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ENTJ',
    id: 'personality-entj-a',
    title: 'Command Rise',
    filename: 'fallback-personality-entj-a.mp3',
    prompt: 'cinematic orchestral, brass section, timpani, string orchestra, powerful, commanding, leadership energy, 130 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ENTP',
    id: 'personality-entp-a',
    title: 'Voltage Debate',
    filename: 'fallback-personality-entp-a.mp3',
    prompt: 'electro funk, future bass, funky synth, playful arpeggios, 808 bass, clever, playful, groovy, 120 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'INFJ',
    id: 'personality-infj-a',
    title: 'Quiet Vision',
    filename: 'fallback-personality-infj-a.mp3',
    prompt: 'neoclassical ambient, grand piano, ethereal strings, celesta, healing, visionary, spacious, 80 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'INFP',
    id: 'personality-infp-a',
    title: 'Dream Archive',
    filename: 'fallback-personality-infp-a.mp3',
    prompt: 'dream pop, indie folk, fingerpicked acoustic guitar, soft pads, flute, nostalgic, dreamy, 90 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ENFJ',
    id: 'personality-enfj-a',
    title: 'Warm Signal',
    filename: 'fallback-personality-enfj-a.mp3',
    prompt: 'indie pop, tropical house, bright synths, ukulele, warm pads, uplifting, connected, warm, 110 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ENFP',
    id: 'personality-enfp-a',
    title: 'Spark Carnival',
    filename: 'fallback-personality-enfp-a.mp3',
    prompt: 'indie rock, pop, electric guitar, synth hooks, claps, upbeat, joyful, free spirited, 120 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ISTJ',
    id: 'personality-istj-a',
    title: 'Steady Ledger',
    filename: 'fallback-personality-istj-a.mp3',
    prompt: 'lo-fi hip hop, downtempo, vinyl crackle, jazz piano, mellow drums, steady, calm, reliable, 88 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ISFJ',
    id: 'personality-isfj-a',
    title: 'Gentle Harbor',
    filename: 'fallback-personality-isfj-a.mp3',
    prompt: 'acoustic folk, nylon guitar, soft piano, warm bass, gentle, comforting, protective, 80 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ESTJ',
    id: 'personality-estj-a',
    title: 'Organized Drive',
    filename: 'fallback-personality-estj-a.mp3',
    prompt: 'tech house, progressive house, synth bass, drum machine, synth stabs, driving, determined, organized, 124 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ESFJ',
    id: 'personality-esfj-a',
    title: 'United Hearts',
    filename: 'fallback-personality-esfj-a.mp3',
    prompt: 'pop soul, Rhodes, warm bass, gospel chord voicings, harmonious, friendly, collaborative, 110 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ISTP',
    id: 'personality-istp-a',
    title: 'Cool Mechanic',
    filename: 'fallback-personality-istp-a.mp3',
    prompt: 'minimal techno, industrial, drum machine, metallic synth, cold bass, cool, precise, practical, 112 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ISFP',
    id: 'personality-isfp-a',
    title: 'Soft Prism',
    filename: 'fallback-personality-isfp-a.mp3',
    prompt: 'chillhop, art pop, electric piano, soft drums, synth pad, mellow, expressive, artistic, 90 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ESTP',
    id: 'personality-estp-a',
    title: 'Action Pulse',
    filename: 'fallback-personality-estp-a.mp3',
    prompt: 'EDM, drum and bass, 808 sub bass, breakbeats, Reese bass, energetic, bold, aggressive, 150 BPM, instrumental',
  },
  {
    mode: 'personality',
    mbti: 'ESFP',
    id: 'personality-esfp-a',
    title: 'Spotlight Dance',
    filename: 'fallback-personality-esfp-a.mp3',
    prompt: 'dance pop, reggaeton, latin percussion, funky bassline, brass stabs, euphoric, festive, spotlight, 108 BPM, instrumental',
  },
];

function parseArgs(argv) {
  const options = {
    dryRun: false,
    force: false,
    continueOnError: false,
    limit: Infinity,
    startAfter: '',
    only: null,
  };

  for (const arg of argv) {
    if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--force') options.force = true;
    else if (arg === '--continue-on-error') options.continueOnError = true;
    else if (arg.startsWith('--limit=')) options.limit = Number(arg.slice('--limit='.length));
    else if (arg.startsWith('--start-after=')) options.startAfter = arg.slice('--start-after='.length);
    else if (arg.startsWith('--only=')) {
      options.only = new Set(arg.slice('--only='.length).split(',').map((value) => value.trim()).filter(Boolean));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!Number.isFinite(options.limit) || options.limit <= 0) options.limit = Infinity;
  return options;
}

function sampleUrl(filename) {
  return `/samples/${filename}`;
}

async function readManifest() {
  return JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
}

async function writeManifest(manifest) {
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function fileExists(path) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}

async function waitForCompletion(taskId, title) {
  const startedAt = Date.now();
  for (;;) {
    const result = await pollGeneration(taskId);
    if (result.status === 'completed') return result;
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error(`${title} timed out after ${Math.round(POLL_TIMEOUT_MS / 1000)}s`);
    }
    const progress = result.progress ? ` ${result.progress}` : '';
    console.log(`    polling ${taskId}: ${result.status}${progress}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function downloadAudio(url, filePath) {
  const tmpPath = `${filePath}.tmp-${Date.now()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok || !res.body) {
    throw new Error(`Audio download failed (${res.status})`);
  }
  try {
    const bytes = Buffer.from(await res.arrayBuffer());
    await writeFile(tmpPath, bytes);
    await rename(tmpPath, filePath);
  } catch (err) {
    await rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}

function findManifestTrack(manifest, item) {
  const tracks = manifest[item.mode];
  if (!Array.isArray(tracks)) {
    manifest[item.mode] = [];
    return null;
  }
  return tracks.find((track) => track.id === item.id) || null;
}

async function updateDb(item, url) {
  const result = await db.prepare(
    'UPDATE fallback_tracks SET mode = ?, mbti = ?, title = ?, url = ? WHERE id = ?'
  ).run(item.mode, item.mbti || null, item.title, url, item.id);

  if (result.changes > 0) return;

  await db.prepare(
    `INSERT INTO fallback_tracks (id, mode, mbti, title, url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       mode = excluded.mode,
       mbti = excluded.mbti,
       title = excluded.title,
       url = excluded.url`
  ).run(item.id, item.mode, item.mbti || null, item.title, url, Date.now());
}

async function markGenerated(item) {
  const manifest = await readManifest();
  const track = findManifestTrack(manifest, item);
  const next = {
    id: item.id,
    ...(item.mbti ? { mbti: item.mbti } : {}),
    title: item.title,
    url: sampleUrl(item.filename),
  };

  if (track) Object.assign(track, next);
  else manifest[item.mode].push(next);

  await writeManifest(manifest);
  await updateDb(item, next.url);
}

async function shouldSkip(item, options) {
  if (options.force) return false;
  const manifest = await readManifest();
  const track = findManifestTrack(manifest, item);
  const filePath = join(SAMPLES_DIR, item.filename);
  return track?.url === sampleUrl(item.filename) && await fileExists(filePath);
}

async function generateOne(item, index, total, options) {
  const filePath = join(SAMPLES_DIR, item.filename);
  const url = sampleUrl(item.filename);

  if (await shouldSkip(item, options)) {
    console.log(`[${index}/${total}] skip ${item.id}: ${url}`);
    return { skipped: true };
  }

  console.log(`[${index}/${total}] generate ${item.id}: ${item.title}`);
  console.log(`    ${item.prompt}`);

  if (options.dryRun) return { dryRun: true };

  const { taskId } = await submitGeneration({
    prompt: item.prompt,
    title: item.title,
    tags: item.prompt.slice(0, 200),
    negativeTags: 'vocals, lyrics, speech, singing',
    weirdnessConstraint: item.weirdnessConstraint,
    styleWeight: item.styleWeight,
  });
  console.log(`    submitted: ${taskId}`);

  const result = await waitForCompletion(taskId, item.title);
  await downloadAudio(result.audioUrl, filePath);
  await markGenerated(item);
  console.log(`    saved: ${url}`);
  return { generated: true };
}

function selectPlan(options) {
  let items = PLAN;
  if (options.only) items = items.filter((item) => options.only.has(item.id));
  if (options.startAfter) {
    const index = items.findIndex((item) => item.id === options.startAfter);
    if (index >= 0) items = items.slice(index + 1);
  }
  return items.slice(0, options.limit);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.dryRun && !isSunoConfigured()) {
    throw new Error('TTAPI is not configured or USE_FALLBACK_ONLY=true');
  }

  await mkdir(SAMPLES_DIR, { recursive: true });
  const items = selectPlan(options);
  const stats = { generated: 0, skipped: 0, failed: 0 };

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    try {
      const result = await generateOne(item, i + 1, items.length, options);
      if (result.skipped) stats.skipped += 1;
      else if (result.dryRun) stats.skipped += 1;
      else stats.generated += 1;
    } catch (err) {
      stats.failed += 1;
      console.error(`    failed ${item.id}: ${err.message}`);
      if (!options.continueOnError) throw err;
    }
  }

  console.log(`done: generated=${stats.generated} skipped=${stats.skipped} failed=${stats.failed}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
