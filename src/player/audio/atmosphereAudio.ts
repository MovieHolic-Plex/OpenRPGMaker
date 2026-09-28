import { DEFAULT_ATMOSPHERE_SOUNDS, type AtmosphereEffect, type AtmosphereSound } from "@/project/atmosphere";

type Voice = { source: AudioBufferSourceNode; gain: GainNode; level: number };
/** A separate SE-controlled ambience bus; authored BGM/BGS/ambient remain untouched. */
export class AtmosphereAudio {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private voices = new Map<AtmosphereSound, Voice>();
  private buffers = new Map<AtmosphereSound, AudioBuffer>();
  /** 굽는 중인 버퍼. 12초 스테레오 합성(약 60ms)을 한 프레임에 하지 않고 update 마다 조금씩 이어 간다. */
  private baking = new Map<AtmosphereSound, AtmosphereBake>();
  private pending: readonly AtmosphereEffect[] = [];
  private mixer = 0.8;

  unlock(): void {
    this.update(this.pending, true);
    if (this.context?.state === "suspended") void this.context.resume().catch(() => {});
  }

  setVolume(volume: number): void {
    this.mixer = volume;
    if (this.context && this.bus) this.bus.gain.setTargetAtTime(volume, this.context.currentTime, 0.04);
  }

  update(effects: readonly AtmosphereEffect[], unlocked: boolean): void {
    this.pending = effects;
    const levels = new Map<AtmosphereSound, number>();
    for (const effect of effects) {
      const sound = effect.sound ?? DEFAULT_ATMOSPHERE_SOUNDS[effect.kind];
      const level = (effect.volume ?? 0.35) * effect.amount;
      if (sound !== "none" && level > 0) levels.set(sound, Math.max(levels.get(sound) ?? 0, level));
    }
    if (!levels.size) { this.stop(); return; }
    if (!unlocked || typeof AudioContext === "undefined") return;
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.bus = this.context.createGain();
        this.bus.gain.value = this.mixer;
        this.bus.connect(this.context.destination);
        void this.context.resume().catch(() => {});
      } catch { this.stop(); return; }
    }
    const context = this.context;
    for (const [sound, voice] of this.voices) {
      if (!levels.has(sound)) {
        // Source.stop also disconnects removed one-shots without leaving timer work behind.
        voice.gain.gain.cancelScheduledValues(context.currentTime);
        voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.06);
        voice.source.stop(context.currentTime + 0.3);
        voice.source.onended = () => { voice.source.disconnect(); voice.gain.disconnect(); };
        this.voices.delete(sound);
      }
    }
    // Adding many effects never linearly multiplies volume; duplicate sound pairs share a voice.
    // 합성 예산은 소리마다가 아니라 update 한 번 전체가 나눠 쓴다 — 세 소리가 한꺼번에 굽히면 한 프레임에
    // 30만 표본(약 25ms)을 돌렸다. 예산이 떨어지면 남은 소리는 다음 update 에서 이어 간다.
    let bakeBudget = ATMOSPHERE_BAKE_SAMPLES_PER_UPDATE;
    for (const [sound, rawLevel] of levels) {
      const level = rawLevel / Math.sqrt(levels.size);
      let voice = this.voices.get(sound);
      if (!voice) {
        let buffer = this.buffers.get(sound);
        if (!buffer) {
          if (bakeBudget <= 0) continue;
          const bake = this.baking.get(sound) ?? startAtmosphereBake(context, sound);
          this.baking.set(sound, bake);
          const spent = stepAtmosphereBake(bake, bakeBudget);
          bakeBudget -= spent.samples;
          if (!spent.done) continue;
          this.baking.delete(sound);
          buffer = bake.buffer;
          this.buffers.set(sound, buffer);
        }
        const source = context.createBufferSource();
        source.buffer = buffer; source.loop = true;
        const gain = context.createGain(); gain.gain.value = 0;
        source.connect(gain); gain.connect(this.bus!); source.start();
        voice = { source, gain, level: -1 };
        this.voices.set(sound, voice);
      }
      if (Math.abs(voice.level - level) > 0.0001) {
        voice.gain.gain.setTargetAtTime(level, context.currentTime, 0.25);
        voice.level = level;
      }
    }
  }

  stop(): void {
    for (const voice of this.voices.values()) { voice.source.stop(); voice.source.disconnect(); voice.gain.disconnect(); }
    this.voices.clear(); this.buffers.clear(); this.baking.clear(); this.pending = [];
    this.bus?.disconnect(); this.bus = null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}

/** Soft procedural ambiences. No network/license dependency in exported players.
 * Stereo periodic buffers with an overlap seam; this is ambience, not replacement BGM.
 *
 * 합성은 채널별로 샘플 한 개씩 이어지는 상태(잡음 시드·저역 필터)를 가진다. 그 상태를 bake 객체에 담아
 * 두면 몇 프레임에 나눠 돌려도 한 번에 돌린 것과 **같은 샘플**이 나온다. 한 번에 약 60ms 였다.
 */
const ATMOSPHERE_RATE = 22050;
const ATMOSPHERE_SECONDS = 12;
const ATMOSPHERE_LENGTH = ATMOSPHERE_RATE * ATMOSPHERE_SECONDS;
const ATMOSPHERE_SEAM = Math.round(ATMOSPHERE_RATE * 0.18);
/** update 한 번(대개 한 프레임)에 합성하는 샘플 수(두 채널 합). 약 8ms 분량이다. */
const ATMOSPHERE_BAKE_SAMPLES_PER_UPDATE = 100_000;

type AtmosphereChannelState = { readonly raw: Float32Array; low: number; deep: number; seed: number; index: number };
type AtmosphereBake = {
  readonly sound: AtmosphereSound;
  readonly buffer: AudioBuffer;
  readonly channels: AtmosphereChannelState[];
  channel: number;
};

function startAtmosphereBake(context: AudioContext, sound: AtmosphereSound): AtmosphereBake {
  const buffer = context.createBuffer(2, ATMOSPHERE_LENGTH, ATMOSPHERE_RATE);
  const channels = [0, 1].map((channel) => ({
    raw: new Float32Array(ATMOSPHERE_LENGTH + ATMOSPHERE_SEAM),
    low: 0, deep: 0, seed: 1234567 + channel * 7919 + sound.length * 313, index: 0,
  }));
  return { sound, buffer, channels, channel: 0 };
}

/**
 * budget 샘플만큼 이어서 합성한다. 두 채널이 다 끝나 버퍼가 채워졌으면 done. 채널을 마칠 때 버퍼로 옮기는
 * 복사(채널 길이만큼)도 쓴 표본 수에 넣는다 — 호출부가 여러 소리에 한 예산을 나눠 쓴다.
 */
function stepAtmosphereBake(bake: AtmosphereBake, budget: number): { readonly done: boolean; readonly samples: number } {
  let remaining = Math.max(1, Math.floor(budget));
  const initial = remaining;
  while (bake.channel < bake.channels.length && remaining > 0) {
    const state = bake.channels[bake.channel]!;
    const start = state.index;
    const end = Math.min(state.raw.length, start + remaining);
    synthesizeAtmosphere(bake.sound, bake.channel, state, end);
    remaining -= end - start;
    if (state.index < state.raw.length) return { done: false, samples: initial - remaining };
    const data = bake.buffer.getChannelData(bake.channel);
    const raw = state.raw;
    for (let i = 0; i < ATMOSPHERE_LENGTH; i++) {
      data[i] = i < ATMOSPHERE_SEAM ? raw[ATMOSPHERE_LENGTH + i]! * (1 - i / ATMOSPHERE_SEAM) + raw[i]! * i / ATMOSPHERE_SEAM : raw[i]!;
    }
    // 이음매 복사는 합성보다 훨씬 싸다(표본당 곱셈 몇 개). 합성 표본의 1/8 로 친다.
    remaining -= Math.ceil(ATMOSPHERE_LENGTH / 8);
    bake.channel += 1;
  }
  return { done: bake.channel >= bake.channels.length, samples: initial - remaining };
}

function synthesizeAtmosphere(sound: AtmosphereSound, channel: number, state: AtmosphereChannelState, end: number): void {
  const rate = ATMOSPHERE_RATE, seconds = ATMOSPHERE_SECONDS;
  const raw = state.raw;
  let { low, deep, seed } = state;
  const pulse = (time: number, start: number, decay: number) => time < start ? 0 : Math.min(1, (time - start) * 35) * Math.exp(-(time - start) * decay);
  for (let i = state.index; i < end; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 2147483648 - 1;
    low += 0.065 * (noise - low); deep += 0.008 * (noise - deep);
    const t = i / rate;
    const phase = (t + channel * 0.027) % seconds;
    const wind = 0.65 + 0.3 * Math.sin(t * Math.PI / 3 + channel * 0.3);
    let value = 0;
    switch (sound) {
      case "breeze": value = low * 1.1 * wind; break;
      case "rustle": value = low * wind + noise * 0.13 * Math.pow(0.5 + 0.5 * Math.sin(t * 2.4), 5); break;
      case "rumble": value = deep * 2 * wind + Math.sin(t * Math.PI * 2 * 48) * 0.035; break;
      case "steam": value = (noise - low) * 0.22 * wind; break;
      case "insects": {
        const chirp = pulse(phase % 3, 0.3, 5) + pulse(phase % 3, 0.6, 6);
        value = Math.sin(t * Math.PI * 2 * (3100 + channel * 80)) * chirp * 0.12;
        break;
      }
      case "chimes": {
        const notes = [880, 1320, 1760];
        for (let n = 0; n < notes.length; n++) value += Math.sin(t * Math.PI * 2 * notes[n]!) * pulse(phase, 0.7 + n * 3.5, 1.8) * 0.16;
        break;
      }
      case "whisper": value = low * 0.3 + (Math.sin(t * Math.PI * 2 * 220) + Math.sin(t * Math.PI * 2 * 330)) * 0.035 * wind; break;
      case "fire": value = deep * 1.2 + noise * Math.pow(Math.max(0, Math.sin(t * 37) * Math.sin(t * 53 + channel)), 22) * 0.55; break;
      case "electric": value = Math.sin(t * Math.PI * 2 * 60) * 0.025 + noise * pulse(phase % 2.4, 0.12, 24) * 0.45; break;
      case "drips": case "bubbles": {
        const interval = sound === "drips" ? 1.7 : 0.85;
        const p = (phase + channel * 0.08) % interval;
        const envelope = pulse(p, 0.12, sound === "drips" ? 16 : 11);
        const u = Math.max(0, p - 0.12);
        const pitch = sound === "drips" ? 1100 : 260;
        value = Math.sin(Math.PI * 2 * (pitch * u + 650 * u * u)) * envelope * 0.32;
        if (sound === "bubbles") value += deep * 1.2;
        break;
      }
    }
    raw[i] = value;
  }
  state.low = low; state.deep = deep; state.seed = seed; state.index = end;
}
