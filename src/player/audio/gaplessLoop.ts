// player/audio/gaplessLoop.ts
// 환경음(BGS) 루프를 틈 없이 돌리는 재생기. <audio loop> 는 끝에서 처음으로 되감을 때 소리가 끊긴다 —
// 2026-10-31 실측(헤드리스 Chromium, 같은 40초 OGG): 요소 루프는 감는 자리에 10ms(한가할 때)~60ms(부하) 무음,
// AudioBufferSourceNode.loop 는 0ms. 스토어 환경음 팩은 이음매를 맞춰 만들었으므로 재생기가 틈을 내면 안 된다.
//
// 엔진(audioEngine.ts)이 요소에 쓰는 만큼만 흉내 낸다: volume·playbackRate·loop·preload·currentTime·src=""·play()·pause()·
// error/ended 듣기·setAttribute·remove. 디코딩은 play() 에서 한 번. 팬은 setPan 으로 자기 StereoPanner 에 건다.
// AudioContext 가 없는 환경(단위 테스트·옛 브라우저)에서는 쓰지 않는다 — canUseGaplessLoop 가 false 면 엔진이 요소를 쓴다.

const decoded = new Map<string, Promise<AudioBuffer>>();

export function canUseGaplessLoop(context: AudioContext | null): context is AudioContext {
  return context !== null && typeof context.createBufferSource === "function" && typeof context.decodeAudioData === "function" && typeof fetch === "function";
}

export class GaplessLoopAudio extends EventTarget {
  loop = true;
  preload = "auto";
  private readonly gain: GainNode;
  private readonly panner: StereoPannerNode | null;
  private source: AudioBufferSourceNode | null = null;
  private buffer: AudioBuffer | null = null;
  private rate = 1;
  private startedAt = 0;
  private offset = 0;
  private stopped = false;

  constructor(private readonly context: AudioContext, private url: string) {
    super();
    this.gain = context.createGain();
    this.gain.gain.value = 0;
    this.panner = typeof context.createStereoPanner === "function" ? context.createStereoPanner() : null;
    if (this.panner) { this.gain.connect(this.panner); this.panner.connect(context.destination); }
    else this.gain.connect(context.destination);
  }

  get volume(): number { return this.gain.gain.value; }
  set volume(value: number) { this.gain.gain.value = Math.max(0, Math.min(1, value)); }

  get playbackRate(): number { return this.rate; }
  set playbackRate(value: number) {
    this.offset = this.currentTime; this.startedAt = this.context.currentTime;
    this.rate = value;
    if (this.source) this.source.playbackRate.value = value;
  }

  get currentTime(): number {
    const duration = this.buffer?.duration ?? 0;
    if (!this.source || duration <= 0) return this.offset;
    return (this.offset + (this.context.currentTime - this.startedAt) * this.rate) % duration;
  }
  set currentTime(value: number) { this.offset = Math.max(0, value); if (this.source) this.restart(); }

  get duration(): number { return this.buffer?.duration ?? Number.NaN; }

  get src(): string { return this.url; }
  set src(value: string) {
    this.url = value;
    if (!value) { this.stopped = true; this.stopSource(); try { this.gain.disconnect(); this.panner?.disconnect(); } catch { /* 이미 끊김 */ } }
  }

  setPan(pan: number): void { if (this.panner) this.panner.pan.value = pan; }

  async play(): Promise<void> {
    this.stopped = false;
    if (this.context.state === "suspended") {
      await this.context.resume().catch(() => undefined);
      if (this.context.state === "suspended") throw new DOMException("audio context is suspended", "NotAllowedError");
    }
    if (!this.buffer) {
      try {
        let pending = decoded.get(this.url);
        if (!pending) {
          pending = fetch(this.url).then((response) => response.arrayBuffer()).then((bytes) => this.context.decodeAudioData(bytes));
          decoded.set(this.url, pending);
          pending.catch(() => decoded.delete(this.url));
        }
        this.buffer = await pending;
      } catch {
        this.dispatchEvent(new Event("error"));
        return;
      }
    }
    if (this.stopped || this.source) return;
    this.restart();
  }

  pause(): void {
    this.offset = this.currentTime;
    this.stopSource();
  }

  setAttribute(): void { /* 문서에 달지 않는다(요소가 아니다). */ }
  remove(): void { /* 문서에 달지 않았다. */ }

  private restart(): void {
    this.stopSource();
    if (!this.buffer || this.stopped) return;
    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.loop = this.loop;
    source.playbackRate.value = this.rate;
    source.connect(this.gain);
    source.onended = () => { if (this.source === source && !this.loop) { this.source = null; this.dispatchEvent(new Event("ended")); } };
    const at = this.buffer.duration > 0 ? this.offset % this.buffer.duration : 0;
    source.start(0, at);
    this.source = source;
    this.startedAt = this.context.currentTime;
    this.offset = at;
  }

  private stopSource(): void {
    const source = this.source;
    this.source = null;
    if (!source) return;
    source.onended = null;
    try { source.stop(); source.disconnect(); } catch { /* 이미 멈춤 */ }
  }
}
