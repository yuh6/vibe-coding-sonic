/**
 * 交叉淡入 (Crossfade) — docs/ai-music-engine-design.md §9.3
 * v3 修正：不用双 <audio> + 定时器步进调音量，复用 MixerEngine 的 Web Audio 链路，
 * 交叉淡入 = 两条轨的 GainNode ramp，采样级平滑，无阶梯噪声。
 */

const DEFAULT_FADE_SEC = 3;
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

function connectChain(ctx, buffer, destination) {
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  source.connect(gain);
  gain.connect(destination);
  return { source, gain };
}

export class CrossfadeDeck {
  /**
   * engine: 复用 src/audio/mixerEngine.js 的 MixerEngine 实例（提供 AudioContext + master 总线）。
   * fadeSec: 交叉淡入时长，默认 3 秒（§9.3）。
   */
  constructor(engine, { fadeSec = DEFAULT_FADE_SEC } = {}) {
    this.engine = engine;
    this.fadeSec = fadeSec;
    this.current = null; // { source, gain, buffer, url, startedAtCtxTime, offsetSec }
    this.next = null; // 预加载好、待切入的下一首
    this.decodedCache = new Map(); // url -> AudioBuffer，避免重复下载解码
  }

  get ctx() {
    return this.engine.ensureContext();
  }

  get destination() {
    return this.engine.master.gain;
  }

  /** fetch + decodeAudioData，提前解码好；走 /api/music/proxy 解决 CORS（调用方传入代理后的 url） */
  async decode(url) {
    if (this.decodedCache.has(url)) return this.decodedCache.get(url);
    const ctx = this.ctx;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Crossfade decode failed (HTTP ${res.status}): ${url}`);
    if (!isLikelyAudioResponse(res, url)) {
      throw new Error(`Crossfade decode failed: unsupported response (${res.headers.get('content-type') || 'unknown content type'})`);
    }
    const raw = await res.arrayBuffer();
    let buffer;
    try {
      buffer = await ctx.decodeAudioData(raw);
    } catch {
      throw new Error('Crossfade decode failed: unsupported or invalid audio file');
    }
    this.decodedCache.set(url, buffer);
    return buffer;
  }

  /** 预加载下一首（不影响当前播放）；track 为业务层元数据（曲目信息），随 next 一起保存供 UI 展示 */
  async preload(url, track = null) {
    const buffer = await this.decode(url);
    const { source, gain } = connectChain(this.ctx, buffer, this.destination);
    gain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.next = { source, gain, buffer, url, track, started: false };
    return this.next;
  }

  /** 直接播放第一首（BOOTSTRAP 阶段，没有"上一首"可淡出） */
  async playFirst(url, track = null) {
    const buffer = await this.decode(url);
    const { source, gain } = connectChain(this.ctx, buffer, this.destination);
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(1, t);
    source.start(t);
    this.current = { source, gain, buffer, url, track, startedAtCtxTime: t, offsetSec: 0 };
    return this.current;
  }

  /** 触发交叉淡入：下一首淡入 + 当前淡出。未 preload 时返回 false，调用方应继续 loop 当前曲目 */
  transition() {
    if (!this.next) return false;
    const t = this.ctx.currentTime;
    const { source, gain } = this.next;

    gain.gain.setValueAtTime(0, t);
    source.start(t);
    gain.gain.linearRampToValueAtTime(1, t + this.fadeSec);

    if (this.current) {
      const cur = this.current;
      cur.gain.gain.setValueAtTime(cur.gain.gain.value, t);
      cur.gain.gain.linearRampToValueAtTime(0, t + this.fadeSec);
      const stopSource = cur.source;
      // 淡出结束后再 stop + disconnect，避免 ramp 未完成就截断产生咔哒声
      setTimeout(() => {
        try {
          stopSource.stop();
        } catch {
          // 已经停止，忽略
        }
        stopSource.disconnect();
        cur.gain.disconnect();
      }, (this.fadeSec + 0.1) * 1000);
    }

    this.current = { ...this.next, startedAtCtxTime: t, offsetSec: 0 };
    this.next = null;
    return true;
  }

  /** 当前播放进度（秒），供调用方判断是否到达 85%/95% 触发点 */
  currentProgressSec() {
    if (!this.current) return 0;
    return this.ctx.currentTime - this.current.startedAtCtxTime;
  }

  currentDurationSec() {
    return this.current?.buffer?.duration || 0;
  }

  /** 无下一首可切时 loop 当前曲目（§9.3 触发时机：无下一首 → loop） */
  loopCurrent() {
    if (!this.current) return;
    const buffer = this.current.buffer;
    const { source, gain } = connectChain(this.ctx, buffer, this.destination);
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(1, t);
    source.start(t);

    const prevSource = this.current.source;
    const prevGain = this.current.gain;
    try {
      prevSource.stop();
    } catch {
      // 已停止，忽略
    }
    prevSource.disconnect();
    prevGain.disconnect();

    this.current = { source, gain, buffer, url: this.current.url, startedAtCtxTime: t, offsetSec: 0 };
  }

  stop() {
    for (const deck of [this.current, this.next]) {
      if (!deck) continue;
      try {
        deck.source.stop();
      } catch {
        // 已停止，忽略
      }
      deck.source.disconnect();
      deck.gain.disconnect();
    }
    this.current = null;
    this.next = null;
  }
}
