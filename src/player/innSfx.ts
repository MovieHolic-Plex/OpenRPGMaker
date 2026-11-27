import { battleAudioContext } from "@/player/battleSfx";
import { getPlayerPreferences } from "@/player/playerPreferences";

/**
 * 여관 숙박 기본 멜로디·기상 차임(Web Audio 합성).
 *
 * 프로젝트의 `system.seCues.innRest` 자리가 비어 있을 때만 울린다.
 * 음량은 ME(효과 음악) 규칙에 맞춰 사용자 BGM 설정(0이면 SE 설정으로 폴백하지 않고 무음)을 따른다.
 */
function innJingleVolume(): number {
  const prefs = getPlayerPreferences();
  const level = Number.isFinite(prefs.bgm) ? Math.max(0, Math.min(1, prefs.bgm)) : 0.7;
  return level * 0.24;
}

function scheduleCelestaNote(
  ac: AudioContext,
  master: GainNode,
  freq: number,
  startOffsetSec: number,
  durationSec: number,
  gain: number
): void {
  const t0 = ac.currentTime + Math.max(0, startOffsetSec);
  const osc = ac.createOscillator();
  const harmonic = ac.createOscillator();
  const env = ac.createGain();
  const harmGain = ac.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, t0);
  harmonic.type = "sine";
  harmonic.frequency.setValueAtTime(freq * 2, t0);
  harmGain.gain.setValueAtTime(0.28, t0);
  harmGain.gain.exponentialRampToValueAtTime(0.01, t0 + durationSec * 0.65);

  env.gain.setValueAtTime(0.0001, t0);
  env.gain.linearRampToValueAtTime(gain, t0 + 0.018);
  env.gain.exponentialRampToValueAtTime(0.0008, t0 + durationSec);

  osc.connect(env);
  harmonic.connect(harmGain).connect(env);
  env.connect(master);

  osc.start(t0);
  harmonic.start(t0);
  osc.stop(t0 + durationSec + 0.03);
  harmonic.stop(t0 + durationSec + 0.03);
}

/**
 * 잠들 때 울리는 고전 RPG풍 자장가 프레이즈(E5 → D5 → C5 → G4 → A4 → C5).
 * 암전 시간(restMs)에 맞춰 템포를 자연스럽게 맞춘다.
 */
export function playInnRestJingle(restDurationMs: number): void {
  const ac = battleAudioContext();
  if (!ac) return;
  const vol = innJingleVolume();
  if (vol <= 0.001) return;

  const master = ac.createGain();
  master.gain.value = vol;
  master.connect(ac.destination);

  // 암전 시간에 맞춰 프레이즈 전체 길이를 0.55s~1.55s 범위로 자연스럽게 조절한다.
  const spanSec = Math.max(0.55, Math.min(1.55, Math.max(500, restDurationMs) / 1000 * 0.92));
  const step = spanSec / 6.5;

  // 부드러운 오르골·하프 자장가 진행 (C major / A minor 따뜻한 종지)
  const melody: readonly { readonly freq: number; readonly beat: number; readonly dur: number; readonly gain: number }[] = [
    { freq: 659.25, beat: 0.0, dur: step * 1.4, gain: 0.72 }, // E5
    { freq: 587.33, beat: 1.0, dur: step * 1.4, gain: 0.68 }, // D5
    { freq: 523.25, beat: 2.0, dur: step * 1.7, gain: 0.76 }, // C5
    { freq: 392.0, beat: 3.1, dur: step * 1.5, gain: 0.62 },  // G4
    { freq: 440.0, beat: 4.1, dur: step * 1.5, gain: 0.66 },  // A4
    { freq: 523.25, beat: 5.1, dur: step * 2.4, gain: 0.8 },  // C5 (resolve)
  ];

  // 따뜻한 저음 패드(C4 + G3)로 포근한 밤 느낌을 더한다.
  scheduleCelestaNote(ac, master, 261.63, 0, spanSec * 0.95, 0.34);
  scheduleCelestaNote(ac, master, 196.0, step * 3.0, spanSec * 0.6, 0.3);

  for (const note of melody) {
    scheduleCelestaNote(ac, master, note.freq, note.beat * step, note.dur, note.gain);
  }
}

/** 아침 기상과 함께 울리는 밝고 상쾌한 회복 차임(G5 → B5 → D6 → G6). */
export function playInnWakeChime(): void {
  const ac = battleAudioContext();
  if (!ac) return;
  const vol = innJingleVolume();
  if (vol <= 0.001) return;

  const master = ac.createGain();
  master.gain.value = vol;
  master.connect(ac.destination);

  const notes: readonly { readonly freq: number; readonly at: number; readonly dur: number; readonly gain: number }[] = [
    { freq: 783.99, at: 0.0, dur: 0.28, gain: 0.58 },  // G5
    { freq: 987.77, at: 0.09, dur: 0.3, gain: 0.62 },  // B5
    { freq: 1174.66, at: 0.18, dur: 0.36, gain: 0.66 }, // D6
    { freq: 1567.98, at: 0.27, dur: 0.55, gain: 0.54 }, // G6
  ];
  for (const n of notes) {
    scheduleCelestaNote(ac, master, n.freq, n.at, n.dur, n.gain);
  }
}
