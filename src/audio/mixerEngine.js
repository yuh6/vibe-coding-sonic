// Web Audio 调音台引擎
// 单轨链路：Source → Gain → EQ(Low/Mid/High) → Compressor → Panner → Analyser → Master
// Master 链路：MasterGain → Limiter → MasterAnalyser → destination

export const TRACK_COLORS = [
  '#6366f1', '#22d3ee', '#f59e0b', '#ec4899',
  '#84cc16', '#f97316', '#a78bfa', '#2dd4bf',
];

const EQ_BANDS = {
  low: { type: 'lowshelf', frequency: 320 },
  mid: { type: 'peaking', frequency: 1000, Q: 1 },
  high: { type: 'highshelf', frequency: 3200 },
};

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
  for (let c = 0; c < buffer.numberOfChannels; c++) channels.push(buffer.getChannelData(c));
  const step = Math.floor(buffer.length / buckets) || 1;
  for (let i = 0; i < buckets; i++) {
    let max = 0;
    const start = i * step;
    const end = Math.min(start + step, buffer.length);
    for (let j = start; j < end; j += 8) {
      for (const data of channels) {
        const v = Math.abs(data[j]);
        if (v > max) max = v;
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
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
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

  async addTrack({ name, url }) {
    const ctx = this.ensureContext();
    const res = await fetch(url);
    if (!res.ok) throw new Error(`音频下载失败 (HTTP ${res.status})`);
    const raw = await res.arrayBuffer();
    const buffer = await ctx.decodeAudioData(raw);

    const id = `t${++uid}`;
    const gain = ctx.createGain();
    const eq = {};
    let head = gain;
    for (const band of ['low', 'mid', 'high']) {
      const f = ctx.createBiquadFilter();
      const spec = EQ_BANDS[band];
      f.type = spec.type;
      f.frequency.value = spec.frequency;
      if (spec.Q) f.Q.value = spec.Q;
      f.gain.value = 0;
      head.connect(f);
      head = f;
      eq[band] = f;
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
    track.nodes.analyser.disconnect();
    track.nodes.gain.disconnect();
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
      color: track.color,
      duration: track.buffer.duration,
      peaks: track.peaks,
      state: { ...track.state, eq: { ...track.state.eq } },
    };
  }

  listTracks() {
    return [...this.tracks.values()].map((t) => this.trackInfo(t));
  }

  duration() {
    let max = 0;
    for (const t of this.tracks.values()) max = Math.max(max, t.buffer.duration);
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
    if (track.source) {
      try {
        track.source.stop();
      } catch {
        // 已停止的 source 重复 stop 会抛错，忽略
      }
      track.source.disconnect();
      track.source = null;
    }
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
    const t = Math.max(0, Math.min(time, this.duration()));
    if (this.playing) {
      for (const track of this.tracks.values()) this.#stopSource(track);
      this.startCtxTime = this.ctx.currentTime;
      this.startOffset = t;
      for (const track of this.tracks.values()) this.#startSource(track, t);
    } else {
      this.startOffset = t;
    }
  }

  // ── 通道控制 ──

  #applyGains() {
    const anySolo = [...this.tracks.values()].some((t) => t.state.solo);
    for (const t of this.tracks.values()) {
      const audible = !t.state.muted && (!anySolo || t.state.solo);
      const target = audible ? t.state.volume : 0;
      t.nodes.gain.gain.setTargetAtTime(target, this.ctx?.currentTime ?? 0, 0.02);
    }
  }

  setVolume(id, v) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.state.volume = v;
    this.#applyGains();
  }

  setPan(id, v) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.state.pan = v;
    t.nodes.panner.pan.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setEq(id, band, db) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.state.eq[band] = db;
    t.nodes.eq[band].gain.setTargetAtTime(db, this.ctx.currentTime, 0.02);
  }

  setMuted(id, muted) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.state.muted = muted;
    this.#applyGains();
  }

  setSolo(id, solo) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.state.solo = solo;
    this.#applyGains();
  }

  setCompressor(id, enabled) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.state.compressor = enabled;
    this.#tuneCompressor(t.nodes.comp, enabled);
  }

  setMasterVolume(v) {
    this.masterState.volume = v;
    if (this.master) this.master.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  setMasterLimiter(enabled) {
    this.masterState.limiter = enabled;
    if (this.master) this.#tuneLimiter(this.master.limiter, enabled);
  }

  // ── 电平表 ──

  #peakOf(analyser, buf) {
    analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (let i = 0; i < buf.length; i += 4) {
      const v = Math.abs(buf[i] - 128) / 128;
      if (v > peak) peak = v;
    }
    return peak;
  }

  getTrackLevel(id) {
    const t = this.tracks.get(id);
    if (!t || !this.playing) return 0;
    return this.#peakOf(t.nodes.analyser, t.meterBuf);
  }

  getMasterLevel() {
    if (!this.master || !this.playing) return 0;
    return this.#peakOf(this.master.analyser, this.master.meterBuf);
  }

  // ── 快照 ──

  getMixState() {
    return {
      master: { ...this.masterState },
      tracks: [...this.tracks.values()].map((t) => ({
        name: t.name,
        url: t.url,
        state: { ...t.state, eq: { ...t.state.eq } },
      })),
    };
  }

  applyTrackState(id, state) {
    const t = this.tracks.get(id);
    if (!t) return;
    t.state = { ...state, eq: { ...state.eq } };
    for (const band of ['low', 'mid', 'high']) {
      t.nodes.eq[band].gain.setTargetAtTime(state.eq[band], this.ctx.currentTime, 0.02);
    }
    t.nodes.panner.pan.setTargetAtTime(state.pan, this.ctx.currentTime, 0.02);
    this.#tuneCompressor(t.nodes.comp, state.compressor);
    this.#applyGains();
  }
}
