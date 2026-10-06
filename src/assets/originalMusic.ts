/** Model-authored score → original PCM. No network, samples, or external account. */
export type MusicInstrument = 'piano' | 'bell' | 'strings' | 'bass' | 'flute' | 'pluck' | 'drum';
export type MusicNote = { pitch: number; beat: number; duration: number; velocity: number };
export type MusicScore = { tempo: number; bars: number; loop?: boolean; tracks: { instrument: MusicInstrument; gain: number; pan: number; notes: MusicNote[] }[] };
const INSTRUMENTS = ['piano', 'bell', 'strings', 'bass', 'flute', 'pluck', 'drum'] as const;
const RATE = 22_050;

export function parseMusicScore(raw: unknown): MusicScore {
  const record = (value: unknown, keys: string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw new TypeError('악보에 지원하지 않는 필드가 있습니다.');
    return value as Record<string, unknown>;
  };
  const number = (value: unknown, min: number, max: number, integer = false): number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new TypeError(`악보 숫자는 ${min}~${max}${integer ? ' 정수' : ''}여야 합니다.`);
    return value;
  };
  const score = record(raw, ['tempo', 'bars', 'tracks', 'loop']);
  if (score.loop !== undefined && typeof score.loop !== 'boolean') throw new TypeError('loop는 boolean입니다.');
  const tempo = number(score.tempo, 40, 160, true), bars = number(score.bars, 4, 32, true);
  if (bars * 240 / tempo > 90) throw new TypeError('곡은 90초 이내여야 합니다.');
  if (!Array.isArray(score.tracks) || score.tracks.length < 1 || score.tracks.length > 5) throw new TypeError('악보 tracks는 1~5개입니다.');
  let count = 0;
  const tracks = score.tracks.map(value => {
    const track = record(value, ['instrument', 'gain', 'pan', 'notes']);
    if (!INSTRUMENTS.includes(track.instrument as MusicInstrument)) throw new TypeError(`악기는 ${INSTRUMENTS.join('/')}입니다.`);
    if (!Array.isArray(track.notes) || !track.notes.length || track.notes.length > 128) throw new TypeError('트랙 notes는 1~128개입니다.');
    count += track.notes.length;
    const notes = track.notes.map(value => {
      const note = record(value, ['pitch', 'beat', 'duration', 'velocity']);
      const beat = number(note.beat, 0, bars * 4), duration = number(note.duration, 0.125, 8);
      if (beat + duration > bars * 4) throw new TypeError('음표가 곡의 끝을 넘습니다.');
      return { pitch: number(note.pitch, 36, 96, true), beat, duration, velocity: number(note.velocity, 0.05, 1) };
    });
    return { instrument: track.instrument as MusicInstrument, gain: number(track.gain, 0.05, 1), pan: number(track.pan, -1, 1), notes };
  });
  if (count > 512) throw new TypeError('음표는 전체 512개까지입니다.');
  return { tempo, bars, tracks, ...(score.loop !== undefined ? { loop: score.loop as boolean } : {}) };
}

export function renderOriginalMusic(score: MusicScore): { bytes: Uint8Array; durationSeconds: number; peak: number; rms: number } {
  const durationSeconds = score.bars * 240 / score.tempo;
  const length = Math.ceil(durationSeconds * RATE), left = new Float32Array(length), right = new Float32Array(length);
  const secondsPerBeat = 60 / score.tempo;
  for (const track of score.tracks) {
    const lg = Math.cos((track.pan + 1) * Math.PI / 4) * track.gain, rg = Math.sin((track.pan + 1) * Math.PI / 4) * track.gain;
    for (const note of track.notes) {
      const start = Math.round(note.beat * secondsPerBeat * RATE);
      const hold = note.duration * secondsPerBeat;
      const release = track.instrument === 'strings' ? 0.6 : 0.25;
      const end = score.loop ? start + Math.ceil((hold + release) * RATE) : Math.min(length, start + Math.ceil((hold + release) * RATE));
      const frequency = 440 * 2 ** ((note.pitch - 69) / 12);
      for (let i = start; i < end; i++) {
        const t = (i - start) / RATE, phase = 2 * Math.PI * frequency * t;
        const attack = Math.min(1, t / (track.instrument === 'strings' ? 0.18 : 0.008));
        const tail = t <= hold ? 1 : Math.max(0, 1 - (t - hold) / release) ** 2;
        let signal: number;
        switch (track.instrument) {
          case 'piano': signal = (Math.sin(phase) + 0.3 * Math.sin(phase * 2) * Math.exp(-t * 4) + 0.12 * Math.sin(phase * 3) * Math.exp(-t * 6)) * Math.exp(-t * 1.8); break;
          case 'bell': signal = (Math.sin(phase) + 0.25 * Math.sin(phase * 2.01) + 0.12 * Math.sin(phase * 3.98)) * Math.exp(-t * 2.4); break;
          case 'strings': signal = (Math.sin(phase * 0.998) + Math.sin(phase * 1.002) + 0.2 * Math.sin(phase * 2)) / 2.2; break;
          case 'bass': signal = Math.sin(phase) + 0.15 * Math.sin(phase * 3); break;
          case 'flute': signal = (Math.sin(phase + 0.02 * Math.sin(t * 32)) + 0.07 * Math.sin(phase * 2)) * 0.8; break;
          case 'pluck': signal = (Math.sin(phase) + 0.4 * Math.sin(phase * 2) + 0.2 * Math.sin(phase * 4)) * Math.exp(-t * 5); break;
          case 'drum': signal = Math.sin(2 * Math.PI * (50 * t + 55 * (1 - Math.exp(-t * 25)) / 25)) * Math.exp(-t * 18); break;
        }
        const value = signal * attack * tail * note.velocity * 0.22;
        const output = i % length;
        left[output] += value * lg; right[output] += value * rg;
      }
    }
  }
  // A small cross-channel room tail, with bounded stable feedback; deterministic in browser/Node.
  const delays = [Math.round(RATE * 0.173), Math.round(RATE * 0.271), Math.round(RATE * 0.389)];
  if (score.loop) {
    // Finite circular taps include the previous cycle's releases/room tail at frame zero.
    const dryLeft = left.slice(), dryRight = right.slice();
    for (const delay of delays) for (let i = 0; i < length; i++) {
      const previous = (i - delay + length) % length;
      left[i] += dryRight[previous] * 0.13; right[i] += dryLeft[previous] * 0.13;
    }
  } else for (const delay of delays) for (let i = delay; i < length; i++) {
    const a = left[i - delay], b = right[i - delay];
    left[i] += b * 0.13; right[i] += a * 0.13;
  }
  let maximum = 0;
  for (let i = 0; i < length; i++) {
    const fade = score.loop ? 1 : Math.min(1, i / (RATE * 0.4), (length - 1 - i) / (RATE * 1.2));
    left[i] *= fade; right[i] *= fade;
    maximum = Math.max(maximum, Math.abs(left[i]), Math.abs(right[i]));
  }
  if (maximum < 0.0001) throw new TypeError('곡이 무음입니다. 악보를 다시 작성하세요.');
  const gain = Math.min(3, 0.8 / maximum);
  const bytes = new Uint8Array(44 + length * 4), view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); };
  ascii(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); ascii(8, 'WAVE'); ascii(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, RATE, true); view.setUint32(28, RATE * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, length * 4, true);
  let sum = 0;
  for (let i = 0; i < length; i++) {
    const l = left[i] * gain, r = right[i] * gain;
    view.setInt16(44 + i * 4, Math.round(l * 32767), true); view.setInt16(46 + i * 4, Math.round(r * 32767), true);
    sum += l * l + r * r;
  }
  return { bytes, durationSeconds, peak: maximum * gain, rms: Math.sqrt(sum / (length * 2)) };
}

export function musicWavDataUrl(bytes: Uint8Array): string {
  // Avoid spread limits and Buffer: the same pure tool runs in browser and Bun.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const chunks: string[] = [];
  let chunk = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    chunk += alphabet[n >>> 18] + alphabet[(n >>> 12) & 63] + (i + 1 < bytes.length ? alphabet[(n >>> 6) & 63] : '=') + (i + 2 < bytes.length ? alphabet[n & 63] : '=');
    if (chunk.length >= 8192) { chunks.push(chunk); chunk = ''; }
  }
  return 'data:audio/wav;base64,' + chunks.join('') + chunk;
}
