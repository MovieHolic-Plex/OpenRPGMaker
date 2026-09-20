import { DEFAULT_ATMOSPHERE_SOUNDS, type AtmosphereEffect, type AtmosphereSound } from "@/project/atmosphere";

type Voice = { source: AudioBufferSourceNode; gain: GainNode; level: number };
/** A separate SE-controlled ambience bus; authored BGM/BGS/ambient remain untouched. */
export class AtmosphereAudio {
  private context: AudioContext | null = null;
  private bus: GainNode | null = null;
  private voices = new Map<AtmosphereSound, Voice>();
  private buffers = new Map<AtmosphereSound, AudioBuffer>();
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
    for (const [sound, rawLevel] of levels) {
      const level = rawLevel / Math.sqrt(levels.size);
      let voice = this.voices.get(sound);
      if (!voice) {
        const source = context.createBufferSource();
        let buffer = this.buffers.get(sound);
        if (!buffer) { buffer = makeAtmosphereBuffer(context, sound); this.buffers.set(sound, buffer); }
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
    this.voices.clear(); this.buffers.clear(); this.pending = [];
    this.bus?.disconnect(); this.bus = null;
    if (this.context) void this.context.close().catch(() => {});
    this.context = null;
  }
}

/** Soft procedural ambiences. No network/license dependency in exported players.
 * Stereo periodic buffers with an overlap seam; this is ambience, not replacement BGM.
 */
function makeAtmosphereBuffer(context: AudioContext, sound: AtmosphereSound): AudioBuffer {
  const rate = 22050, seconds = 12, length = rate * seconds, seam = Math.round(rate * 0.18);
  const buffer = context.createBuffer(2, length, rate);
  for (let channel = 0; channel < 2; channel++) {
    const raw = new Float32Array(length + seam);
    let low = 0, deep = 0, seed = 1234567 + channel * 7919 + sound.length * 313;
    const pulse = (time: number, start: number, decay: number) => time < start ? 0 : Math.min(1, (time - start) * 35) * Math.exp(-(time - start) * decay);
    for (let i = 0; i < raw.length; i++) {
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
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) data[i] = i < seam ? raw[length + i]! * (1 - i / seam) + raw[i]! * i / seam : raw[i]!;
  }
  return buffer;
}
