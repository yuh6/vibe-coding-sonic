export const TRACK_COLORS = [
  '#6366f1',
  '#22d3ee',
  '#f59e0b',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#a78bfa',
  '#2dd4bf',
];

const EQ_BANDS = {
  low: { type: 'lowshelf', frequency: 320 },
  mid: { type: 'peaking', frequency: 1000, Q: 1 },
  high: { type: 'highshelf', frequency: 3200 },
};

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|flac|ogg|opus)(\?|#|$)/i;

function isLikelyAudioResponse(res, url) {
  const contentType = (res.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
  if (!contentType) return AUDIO_EXT_RE.test(url);
  return (
    contentType.startsWith('audio/') ||
    contentType === 'application/octet-stream' ||
    contentType === 'binary/octet-stream'
  );
}

const DEFAULT_TRACK_STATE = () => ({
  volume: 0.8,
  pan: 0,
  muted: false,
  solo: false,
  eq: { low: 0, mid: 0, high: 0 },
  compressor: false,
});

let uid = 0;

function computePeaks(buffer, buckets = 480) {
  const peaks = new Float32Array(buckets);
  const channels = [];
  for (let c = 0; c < buffer.numberOfChannels; c += 1) channels.push(buffer.getChannelData(c));
  const step = Math.floor(buffer.length / buckets) || 1;
  for (let i = 0; i < buckets; i += 1) {
    let max = 0;
    const start = i * step;
    const end = Math.min(start + step, buffer.length);
    for (let j = start; j < end; j += 8) {
      for (const data of channels) {
        const value = Math.abs(data[j]);
        if (value > max) max = value;
      }
    }
    peaks[i] = max;
  }
  return peaks;
}

export class MixerEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.tracks = new Map();
    this.playing = false;
    this.startCtxTime = 0;
    this.startOffset = 0;
    this.masterState = { volume: 0.85, limiter: true };
  }

  ensureContext() {
    if (this.ctx) return this.ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioCtx();
    const gain = this.ctx.createGain();
    gain.gain.value = this.masterState.volume;
    const limiter = this.ctx.createDynamicsCompressor();
    this.#tuneLimiter(limiter, this.masterState.limiter);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 2048;
    gain.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(this.ctx.destination);
    this.master = { gain, limiter, analyser, meterBuf: new Uint8Array(analyser.fftSize) };
    return this.ctx;
  }

  #tuneLimiter(node, enabled) {
    node.threshold.value = enabled ? -3 : 0;
    node.ratio.value = enabled ? 20 : 1;
    node.knee.value = 0;
    node.attack.value = 0.003;
    node.release.value = 0.25;
  }

  #tuneCompressor(node, enabled) {
    node.threshold.value = enabled ? -24 : 0;
    node.ratio.value = enabled ? 4 : 1;
    node.knee.value = 6;
    node.attack.value = 0.01;
    node.release.value = 0.25;
  }

  #throwIfAborted(signal) {
    if (!signal?.aborted) return;
    const err = new Error('Audio load aborted');
    err.name = 'AbortError';
    throw err;
  }

  async addTrack({ name, url, sourceUrl = url, type = 'stem', signal }) {
    this.#throwIfAborted(signal);
    const ctx = this.ensureContext();
    const res = await fetch(url, { signal });
    this.#throwIfAborted(signal);
    if (!res.ok) throw new Error(`Audio download failed (HTTP ${res.status})`);
    if (!isLikelyAudioResponse(res, url)) {
      throw new Error(`Unsupported audio response (${res.headers.get('content-type') || 'unknown content type'})`);
    }
    const raw = await res.arrayBuffer();
    this.#throwIfAborted(signal);
    let buffer;
    try {
      buffer = await ctx.decodeAudioData(raw);
    } catch {
      throw new Error('Audio decode failed: unsupported or invalid audio file');
    }
    this.#throwIfAborted(signal);

    const id = `t${++uid}`;
    const gain = ctx.createGain();
    const eq = {};
    let head = gain;
    for (const band of ['low', 'mid', 'high']) {
      const filter = ctx.createBiquadFilter();
      const spec = EQ_BANDS[band];
      filter.type = spec.type;
      filter.frequency.value = spec.frequency;
      if (spec.Q) filter.Q.value = spec.Q;
      filter.gain.value = 0;
      head.connect(filter);
      head = filter;
      eq[band] = filter;
    }
    const comp = ctx.createDynamicsCompressor();
    this.#tuneCompressor(comp, false);
    const panner = ctx.createStereoPanner();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    head.connect(comp);
    comp.connect(panner);
    panner.connect(analyser);
    analyser.connect(this.master.gain);

    const track = {
      id,
      name,
      url,
      sourceUrl,
      type,
      buffer,
      peaks: computePeaks(buffer),
      color: TRACK_COLORS[(this.tracks.size + uid) % TRACK_COLORS.length],
      nodes: { gain, eq, comp, panner, analyser },
      meterBuf: new Uint8Array(analyser.fftSize),
      state: DEFAULT_TRACK_STATE(),
      source: null,
    };
    this.tracks.set(id, track);
    this.#applyGains();

    if (this.playing) this.#startSource(track, this.currentTime());
    return this.trackInfo(track);
  }

  removeTrack(id) {
    const track = this.tracks.get(id);
    if (!track) return;
    this.#stopSource(track);
    track.nodes.gain.disconnect();
    track.nodes.analyser.disconnect();
    this.tracks.delete(id);
    this.#applyGains();
  }

  clear() {
    for (const id of [...this.tracks.keys()]) this.removeTrack(id);
    this.stop();
  }

  trackInfo(track) {
    return {
      id: track.id,
      name: track.name,
      url: track.url,
      sourceUrl: track.sourceUrl,
      type: track.type,
      color: track.color,
      duration: track.buffer.duration,
      peaks: track.peaks,
      state: { ...track.state, eq: { ...track.state.eq } },
    };
  }

  listTracks() {
    return [...this.tracks.values()].map((track) => this.trackInfo(track));
  }

  duration() {
    let max = 0;
    for (const track of this.tracks.values()) max = Math.max(max, track.buffer.duration);
    return max;
  }

  currentTime() {
    if (!this.ctx) return 0;
    return this.playing ? this.startOffset + this.ctx.currentTime - this.startCtxTime : this.startOffset;
  }

  #startSource(track, offset) {
    if (offset >= track.buffer.duration) return;
    const source = this.ctx.createBufferSource();
    source.buffer = track.buffer;
    source.connect(track.nodes.gain);
    source.start(0, offset);
    track.source = source;
  }

  #stopSource(track) {
    if (!track.source) return;
    try {
      track.source.stop();
    } catch {
      // no-op
    }
    track.source.disconnect();
    track.source = null;
  }

  async play() {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') await ctx.resume();
    if (this.playing) return;
    const offset = Math.min(this.startOffset, this.duration());
    this.startCtxTime = ctx.currentTime;
    this.startOffset = offset;
    for (const track of this.tracks.values()) this.#startSource(track, offset);
    this.playing = true;
  }

  pause() {
    if (!this.playing) return;
    this.startOffset = this.currentTime();
    for (const track of this.tracks.values()) this.#stopSource(track);
    this.playing = false;
  }

  stop() {
    for (const track of this.tracks.values()) this.#stopSource(track);
    this.playing = false;
    this.startOffset = 0;
  }

  seek(time) {
    const nextTime = Math.max(0, Math.min(time, this.duration()));
    if (this.playing) {
      for (const track of this.tracks.values()) this.#stopSource(track);
      this.startCtxTime = this.ctx.currentTime;
      this.startOffset = nextTime;
      for (const track of this.tracks.values()) this.#startSource(track, nextTime);
    } else {
      this.startOffset = nextTime;
    }
  }

  #applyGains() {
    const anySolo = [...this.tracks.values()].some((track) => track.state.solo);
    for (const track of this.tracks.values()) {
      const audible = !track.state.muted && (!anySolo || track.state.solo);
      const target = audible ? track.state.volume : 0;
      track.nodes.gain.gain.setTargetAtTime(target, this.ctx?.currentTime ?? 0, 0.02);
    }
  }

  setVolume(id, value) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.state.volume = value;
    this.#applyGains();
  }

  setPan(id, value) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.state.pan = value;
    track.nodes.panner.pan.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }

  setEq(id, band, db) {
    const track = this.tracks.get(id);
    if (!track || !track.nodes.eq[band]) return;
    track.state.eq[band] = db;
    track.nodes.eq[band].gain.setTargetAtTime(db, this.ctx.currentTime, 0.02);
  }

  setMuted(id, muted) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.state.muted = muted;
    this.#applyGains();
  }

  setSolo(id, solo) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.state.solo = solo;
    this.#applyGains();
  }

  setCompressor(id, enabled) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.state.compressor = enabled;
    this.#tuneCompressor(track.nodes.comp, enabled);
  }

  setMasterVolume(value) {
    this.masterState.volume = value;
    if (this.master) this.master.gain.gain.setTargetAtTime(value, this.ctx.currentTime, 0.02);
  }

  setMasterLimiter(enabled) {
    this.masterState.limiter = enabled;
    if (this.master) this.#tuneLimiter(this.master.limiter, enabled);
  }

  #peakOf(analyser, buf) {
    analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const value = Math.abs(buf[i] - 128) / 128;
      if (value > peak) peak = value;
    }
    return peak;
  }

  getTrackLevel(id) {
    const track = this.tracks.get(id);
    if (!track || !this.playing) return 0;
    return this.#peakOf(track.nodes.analyser, track.meterBuf);
  }

  getMasterLevel() {
    if (!this.master || !this.playing) return 0;
    return this.#peakOf(this.master.analyser, this.master.meterBuf);
  }

  getMixState() {
    return {
      master: { ...this.masterState },
      tracks: [...this.tracks.values()].map((track) => ({
        name: track.name,
        url: track.sourceUrl || track.url,
        type: track.type,
        state: { ...track.state, eq: { ...track.state.eq } },
      })),
    };
  }

  applyTrackState(id, state) {
    const track = this.tracks.get(id);
    if (!track) return;
    track.state = { ...DEFAULT_TRACK_STATE(), ...state, eq: { ...DEFAULT_TRACK_STATE().eq, ...(state.eq || {}) } };
    for (const band of ['low', 'mid', 'high']) {
      track.nodes.eq[band].gain.setTargetAtTime(track.state.eq[band], this.ctx.currentTime, 0.02);
    }
    track.nodes.panner.pan.setTargetAtTime(track.state.pan, this.ctx.currentTime, 0.02);
    this.#tuneCompressor(track.nodes.comp, track.state.compressor);
    this.#applyGains();
  }
}
