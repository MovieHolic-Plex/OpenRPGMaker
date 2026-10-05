/** Small, deterministic sound design patches authored by the assistant. */
export type SoundWave = 'sine' | 'triangle' | 'square' | 'bell' | 'noise';
export type SoundLayer = { wave: SoundWave; at: number; duration: number; frequency: number; endFrequency: number; attack: number; release: number; gain: number; pan: number };
export type SoundPatch = { duration: number; layers: SoundLayer[] };
const WAVES = ['sine', 'triangle', 'square', 'bell', 'noise'];
const RATE = 22_050;

export function parseSoundPatch(raw: unknown): SoundPatch {
  const object = (value: unknown, keys: string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new TypeError('효과음에 지원하지 않는 필드가 있습니다.');
    return value as Record<string, unknown>;
  };
  const num = (value: unknown, min: number, max: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw new TypeError(`효과음 숫자는 ${min}~${max}여야 합니다.`);
    return value;
  };
  const patch = object(raw, ['duration', 'layers']);
  const duration = num(patch.duration, 0.02, 5);
  if (!Array.isArray(patch.layers) || !patch.layers.length || patch.layers.length > 8) throw new TypeError('효과음 layers는 1~8개입니다.');
  const layers = patch.layers.map(rawLayer => {
    const layer = object(rawLayer, ['wave', 'at', 'duration', 'frequency', 'endFrequency', 'attack', 'release', 'gain', 'pan']);
    if (!WAVES.includes(layer.wave as string)) throw new TypeError('wave는 sine/triangle/square/bell/noise입니다.');
    const at = num(layer.at, 0, duration), hold = num(layer.duration, 0.01, duration);
    const attack = num(layer.attack, 0.001, hold), release = num(layer.release, 0.001, hold);
    if (at + hold > duration + 1e-9 || attack + release > hold + 1e-9) throw new TypeError('레이어와 attack/release는 지정한 재생 길이 안에 있어야 합니다.');
    return { wave: layer.wave as SoundWave, at, duration: hold, attack, release,
      frequency: num(layer.frequency, 30, 8000), endFrequency: num(layer.endFrequency, 30, 8000),
      gain: num(layer.gain, 0.01, 1), pan: num(layer.pan, -1, 1) };
  });
  return { duration, layers };
}

export function renderOriginalSound(patch: SoundPatch): { bytes: Uint8Array; durationSeconds: number; peak: number; rms: number } {
  const length = Math.ceil(patch.duration * RATE), left = new Float32Array(length), right = new Float32Array(length);
  let seed = 0x51f15e;
  for (const layer of patch.layers) {
    const start = Math.round(layer.at * RATE), end = Math.min(length, start + Math.ceil(layer.duration * RATE));
    let phase = 0;
    for (let i = start; i < end; i++) {
      const t = (i - start) / RATE, progress = t / layer.duration;
      phase += 2 * Math.PI * (layer.frequency + (layer.endFrequency - layer.frequency) * progress) / RATE;
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const signal = layer.wave === 'noise' ? (seed >>> 0) / 0x80000000 - 1
        : layer.wave === 'square' ? Math.tanh(Math.sin(phase) * 3)
        : layer.wave === 'triangle' ? 2 / Math.PI * Math.asin(Math.sin(phase))
        : layer.wave === 'bell' ? (Math.sin(phase) + 0.3 * Math.sin(phase * 2.01)) * Math.exp(-progress * 4)
        : Math.sin(phase);
      const envelope = Math.min(1, t / layer.attack, (layer.duration - t) / layer.release);
      const value = signal * Math.max(0, envelope) * layer.gain * 0.3;
      left[i] += value * Math.cos((layer.pan + 1) * Math.PI / 4);
      right[i] += value * Math.sin((layer.pan + 1) * Math.PI / 4);
    }
  }
  let peak = 0, sum = 0;
  for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (peak < 0.0001) throw new TypeError('효과음이 무음입니다.');
  // Preserve the author's quiet UI mix; limit clipping without making every cue loud.
  const gain = Math.min(1, 0.7 / peak), bytes = new Uint8Array(44 + length * 4), view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); };
  ascii(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, length * 4, true);
  for (let i = 0; i < length; i++) {
    const l = left[i] * gain, r = right[i] * gain;
    view.setInt16(44 + i * 4, Math.round(l * 32767), true); view.setInt16(46 + i * 4, Math.round(r * 32767), true); sum += l * l + r * r;
  }
  return { bytes, durationSeconds: patch.duration, peak: peak * gain, rms: Math.sqrt(sum / (length * 2)) };
}
