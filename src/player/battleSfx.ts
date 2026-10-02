import { mulberry32 } from "@/util/rng";

/**
 * 합성 전투 효과음 — 오디오 에셋 없이 WebAudio 오실레이터/노이즈로 만든다.
 * 프로젝트에 효과음 리소스가 없어도 전투가 무음이 되지 않게 하는 최소 레이어.
 * (BGM 은 battleAudio.ts 가 프로젝트 리소스로 처리한다 — 여기는 UI/타격음 전용.)
 */

export type BattleSfxKind =
  | "cursor"
  | "confirm"
  | "cancel"
  | "hit"
  | "thud"
  | "critical"
  | "miss"
  | "heal"
  | "faint"
  | "victory"
  | "escape"
  | "defeat";

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
/** 착탄 아래층 전용 버스 — 샘플(0.4, 곧장 출력)과 같은 크기로 들려야 해서 UI 합성음 master(0.14)를 거치지 않는다.
 *  master 를 거치면 녹화의 저음 대역 에너지가 층을 넣기 전과 같았다(2026-10-02 측정). */
let impactBus: GainNode | undefined;

function ensureContext(): AudioContext | undefined {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") return undefined;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.14;
    master.connect(ctx.destination);
    impactBus = ctx.createGain();
    impactBus.gain.value = 0.42;
    impactBus.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** 브라우저 autoplay 정책 통과용 — 전투의 첫 사용자 입력(키/클릭)에서 호출한다. */
export function unlockBattleSfx(): void {
  ensureContext();
}

/** 샘플 캐시(battleSeSamples)가 합성 보이스와 같은 컨텍스트를 쓰게 내준다 —
 *  컨텍스트가 둘이면 언락 시점이 갈라져 한쪽만 무음이 된다. */
export function battleAudioContext(): AudioContext | undefined {
  return ensureContext();
}

interface ToneSpec {
  readonly freq: number;
  readonly type?: OscillatorType;
  readonly at?: number;
  readonly duration?: number;
  readonly gain?: number;
  readonly slideTo?: number;
  readonly bus?: "impact";
}

function tone(spec: ToneSpec): void {
  const ac = ensureContext();
  if (!ac || !master) return;
  const t0 = ac.currentTime + (spec.at ?? 0);
  const duration = spec.duration ?? 0.08;
  const osc = ac.createOscillator();
  osc.type = spec.type ?? "square";
  osc.frequency.setValueAtTime(spec.freq, t0);
  if (spec.slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, spec.slideTo), t0 + duration);
  }
  const gainNode = ac.createGain();
  const peak = spec.gain ?? 0.5;
  gainNode.gain.setValueAtTime(0, t0);
  gainNode.gain.linearRampToValueAtTime(peak, t0 + 0.008);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(gainNode).connect(spec.bus === "impact" && impactBus ? impactBus : master);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise(options: { readonly at?: number; readonly duration?: number; readonly gain?: number; readonly filterFrom?: number; readonly filterTo?: number; readonly seed: number; readonly bus?: "impact" }): void {
  const ac = ensureContext();
  if (!ac || !master) return;
  const t0 = ac.currentTime + (options.at ?? 0);
  const duration = options.duration ?? 0.12;
  const frames = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  // SFX must not consume gameplay RNG or bypass the deterministic runtime.
  // A stable seed makes each procedural effect replay the same waveform.
  const rng = mulberry32(options.seed);
  for (let i = 0; i < frames; i += 1) data[i] = rng() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(options.filterFrom ?? 1200, t0);
  if (options.filterTo !== undefined) {
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, options.filterTo), t0 + duration);
  }
  const gainNode = ac.createGain();
  const peak = options.gain ?? 0.5;
  gainNode.gain.setValueAtTime(peak, t0);
  gainNode.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  source.connect(filter).connect(gainNode).connect(options.bus === "impact" && impactBus ? impactBus : master);
  source.start(t0);
}

export function playBattleSfx(kind: BattleSfxKind): void {
  const ac = ensureContext();
  if (!ac) return;
  switch (kind) {
    case "cursor":
      tone({ freq: 700, duration: 0.045, gain: 0.22 });
      return;
    case "confirm":
      tone({ freq: 880, duration: 0.05, gain: 0.3 });
      tone({ freq: 1320, at: 0.05, duration: 0.07, gain: 0.26 });
      return;
    case "cancel":
      tone({ freq: 520, duration: 0.09, gain: 0.26, slideTo: 330 });
      return;
    case "thud":
      // 타격음 아래에 깔리는 저음 한 겹(타격감 impact). 샘플과 겹쳐도 대역이 달라 트랜지언트를 가리지 않는다.
      tone({ freq: 110, type: "sine", duration: 0.2, gain: 0.9, slideTo: 38 });
      return;
    case "hit":
      noise({ duration: 0.11, gain: 0.55, filterFrom: 1100, filterTo: 220, seed: 0x484954 });
      tone({ freq: 170, type: "triangle", duration: 0.1, gain: 0.5, slideTo: 60 });
      return;
    case "critical":
      noise({ duration: 0.16, gain: 0.7, filterFrom: 2400, filterTo: 200, seed: 0x43524954 });
      tone({ freq: 240, type: "sawtooth", duration: 0.14, gain: 0.5, slideTo: 55 });
      tone({ freq: 1500, at: 0.02, duration: 0.05, gain: 0.3 });
      return;
    case "miss":
      noise({ duration: 0.18, gain: 0.2, filterFrom: 2600, filterTo: 500, seed: 0x4d495353 });
      return;
    case "heal":
      tone({ freq: 523, type: "sine", duration: 0.09, gain: 0.3 });
      tone({ freq: 659, type: "sine", at: 0.08, duration: 0.09, gain: 0.3 });
      tone({ freq: 784, type: "sine", at: 0.16, duration: 0.12, gain: 0.3 });
      return;
    case "faint":
      tone({ freq: 320, type: "sawtooth", duration: 0.5, gain: 0.32, slideTo: 70 });
      return;
    case "victory": {
      const notes = [523, 659, 784, 1046];
      notes.forEach((freq, index) => {
        tone({ freq, at: index * 0.11, duration: 0.12, gain: 0.3 });
      });
      tone({ freq: 784, at: 0.46, duration: 0.3, gain: 0.26 });
      tone({ freq: 1046, at: 0.46, duration: 0.3, gain: 0.26 });
      return;
    }
    case "escape":
      noise({ duration: 0.14, gain: 0.25, filterFrom: 800, filterTo: 2400, seed: 0x455343 });
      tone({ freq: 420, at: 0.05, duration: 0.12, gain: 0.2, slideTo: 760 });
      return;
    case "defeat":
      tone({ freq: 220, type: "triangle", duration: 0.3, gain: 0.3 });
      tone({ freq: 175, type: "triangle", at: 0.28, duration: 0.3, gain: 0.3 });
      tone({ freq: 147, type: "triangle", at: 0.56, duration: 0.5, gain: 0.3, slideTo: 110 });
      return;
  }
}

/**
 * 포켓몬 스킨의 착탄 아래층 — 타격 세기(0..1, 최대 HP 대비 피해)에 따라 소리가 달라진다(2026-10-02).
 * 예전에는 4 피해와 15 피해가 같은 샘플 + 같은 110Hz 저음이었다. 샘플(사건 1개 = 소리 1개)은 그대로 두고
 * 이 층만 바꾼다: 세질수록 저음이 낮고 길어지고, 0.3 부터 「퍽」 잡음이, 0.7·급소부터 깊은 울림과 높은 「딱」이 얹힌다.
 */
export function playBattleImpactLayer(power: number, critical: boolean): void {
  const ac = ensureContext();
  if (!ac) return;
  const p = Math.max(0, Math.min(1, power));
  tone({ freq: 135 - p * 55, type: "sine", duration: 0.13 + p * 0.2, gain: 0.35 + p * 0.55, slideTo: 42 - p * 12, bus: "impact" });
  if (p >= 0.3) noise({ duration: 0.05 + p * 0.09, gain: 0.15 + p * 0.4, filterFrom: 1400 + p * 1200, filterTo: 180, seed: 0x50554e43, bus: "impact" });
  if (p >= 0.7 || critical) {
    tone({ freq: 62, type: "sine", at: 0.01, duration: 0.34, gain: 0.8, slideTo: 32, bus: "impact" });
    noise({ duration: 0.035, gain: 0.3, filterFrom: 5200, filterTo: 2600, seed: 0x435241, bus: "impact" });
  }
}
