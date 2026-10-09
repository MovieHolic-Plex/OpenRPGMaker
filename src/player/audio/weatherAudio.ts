import type { WeatherParams } from "@/player/weather/weatherModel";

/**
 * 잡음 버퍼 공용 보관. 비가 그칠 때마다 컨텍스트를 닫으므로 비가 다시 올 때마다 8초 스테레오 잡음
 * (48kHz 면 샘플 77만 개, 약 19ms)을 메인 스레드에서 다시 합성했다. AudioBuffer 는 어느 컨텍스트에서나
 * 재생할 수 있으므로 표본율·길이·종류별로 한 번만 만든다.
 */
const sharedNoiseBuffers = new Map<string, AudioBuffer>();

/** Asset-free stereo rain and thunder, owned by the shared audio engine.
 * Separate bus: never replaces authored BGS/ambient tracks. Uses the SE mixer.
 */
export class WeatherAudio {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private rain: GainNode | null = null;
  private sources = new Set<AudioBufferSourceNode>();
  private params: WeatherParams = { kind: "none", intensity: 0 };
  private volume = 0.8;
  private previousClock: number | null = null;
  private storm = false;
  /**
   * 천둥 잡음 버퍼. 폭풍 중 약 2.4초마다 2.2초 길이 스테레오 버퍼(48kHz 면 샘플 약 21만 개)를
   * 메인 스레드에서 매번 새로 합성했다. 한 번 만들어 두고 재생 노드만 새로 만든다 — 필터·엔벨로프가
   * 소리의 모양을 정하므로 매번 같은 잡음이어도 귀로 구분되지 않는다. 컨텍스트를 닫으면 버린다.
   */
  private thunderBuffer: AudioBuffer | null = null;

  unlock(): void {
    if (!this.context && (this.params.kind === "rain" || this.params.kind === "storm")) this.start();
    if (this.context?.state === "suspended") void this.context.resume().catch(() => {});
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.context && this.bus) this.bus.gain.setTargetAtTime(volume, this.context.currentTime, 0.03);
  }

  update(params: WeatherParams, clockMs: number, unlocked: boolean): void {
    this.params = params;
    const wet = (params.kind === "rain" || params.kind === "storm") && params.intensity > 0;
    if (!wet) { this.stop(); return; }
    if (unlocked && !this.context) this.start();
    if (this.context && this.rain) {
      this.rain.gain.setTargetAtTime(params.intensity * (params.kind === "storm" ? 0.48 : 0.34), this.context.currentTime, 0.12);
      // One rumble after the paired flashes (120/290ms), never queue stale thunder
      // while locked or replay missed bolts after a clock jump / session restore.
      const phase = ((clockMs % 2400) + 2400) % 2400;
      const previous = this.previousClock;
      if (params.kind === "storm" && this.storm && previous !== null && clockMs > previous && clockMs - previous < 500 &&
          Math.floor((clockMs - 460) / 2400) > Math.floor((previous - 460) / 2400) && phase < 960 &&
          this.context.state === "running") this.thunder(params.intensity);
    }
    this.storm = params.kind === "storm";
    this.previousClock = clockMs;
  }

  stop(): void {
    for (const source of this.sources) { source.stop(); source.disconnect(); }
    this.sources.clear();
    this.bus?.disconnect();
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
    this.bus = null;
    this.rain = null;
    this.thunderBuffer = null;
    this.previousClock = null;
    this.storm = false;
    this.params = { kind: "none", intensity: 0 };
  }

  private start(): void {
    if (typeof AudioContext === "undefined") return;
    try {
      const context = new AudioContext();
      this.context = context;
      this.bus = context.createGain();
      this.bus.gain.value = this.volume;
      this.bus.connect(context.destination);
      this.rain = context.createGain();
      this.rain.gain.value = 0;
      this.rain.connect(this.bus);
      // Broad soft patter + low wash; independent stereo channels prevent a mono hiss.
      const noise = this.noise(8, false);
      const low = context.createBiquadFilter();
      low.type = "lowpass"; low.frequency.value = 6500;
      const high = context.createBiquadFilter();
      high.type = "highpass"; high.frequency.value = 380;
      noise.loop = true;
      noise.connect(low); low.connect(high); high.connect(this.rain);
      noise.start();
      void context.resume().catch(() => {});
    } catch { this.stop(); }
  }

  private noiseBuffer(seconds: number, brown: boolean): AudioBuffer {
    const context = this.context!;
    const key = `${context.sampleRate}:${seconds}:${brown ? "brown" : "white"}`;
    const shared = sharedNoiseBuffers.get(key);
    if (shared) return shared;
    const buffer = context.createBuffer(2, Math.ceil(context.sampleRate * seconds), context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let last = 0;
      for (let index = 0; index < data.length; index++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.035 * white) / 1.035;
        data[index] = brown ? last * 4 : white * 0.7 + last;
      }
    }
    sharedNoiseBuffers.set(key, buffer);
    return buffer;
  }

  private noise(seconds: number, brown: boolean, buffer?: AudioBuffer): AudioBufferSourceNode {
    const context = this.context!;
    const source = context.createBufferSource();
    source.buffer = buffer ?? this.noiseBuffer(seconds, brown);
    this.sources.add(source);
    source.onended = () => { this.sources.delete(source); source.disconnect(); };
    return source;
  }

  private thunder(intensity: number): void {
    const context = this.context!;
    this.thunderBuffer ??= this.noiseBuffer(2.2, true);
    const source = this.noise(2.2, true, this.thunderBuffer);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(130, context.currentTime + 1.8);
    const envelope = context.createGain();
    const now = context.currentTime;
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.3 + intensity * 0.65, now + 0.035);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 2.15);
    source.connect(filter); filter.connect(envelope); envelope.connect(this.bus!);
    source.onended = () => {
      this.sources.delete(source); source.disconnect(); filter.disconnect(); envelope.disconnect();
    };
    source.start();
  }
}
