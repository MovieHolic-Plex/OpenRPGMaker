import type { Gen1NextByte } from "@/battle/gen1/rng";

export type Gen1BallClass = "poke" | "great" | "ultra" | "master";
export type Gen1MajorStatus = "poison" | "burn" | "sleep" | "freeze" | "paralysis";

export interface Gen1CaptureInput {
  readonly ballClass: Gen1BallClass;
  readonly maxHp: number;
  readonly currentHp: number;
  readonly catchRate: number;
  readonly majorStatus?: Gen1MajorStatus;
  readonly trainerBattle?: boolean;
}

export interface Gen1CaptureProbability {
  readonly numerator: number;
  readonly denominator: number;
  readonly value: number;
  readonly w: number;
  readonly x: number;
}

export interface Gen1CaptureAttempt {
  readonly caught: boolean;
  readonly shakes: 0 | 1 | 2 | 3;
  readonly failureReason?: "trainerBattle" | "rand1" | "rand2";
  readonly probability: Gen1CaptureProbability;
  readonly trace: {
    readonly rejectedRand1Bytes: readonly number[];
    readonly rand1?: number;
    readonly adjustedRand1?: number;
    readonly rand2?: number;
  };
}

interface BallRules {
  readonly rand1Max: number;
  readonly rand1Domain: number;
  readonly hpFactor: number;
  readonly shakeFactor: number;
}

const BALL_RULES: Readonly<Record<Exclude<Gen1BallClass, "master">, BallRules>> = {
  poke: { rand1Max: 255, rand1Domain: 256, hpFactor: 12, shakeFactor: 255 },
  great: { rand1Max: 200, rand1Domain: 201, hpFactor: 8, shakeFactor: 200 },
  ultra: { rand1Max: 150, rand1Domain: 151, hpFactor: 12, shakeFactor: 150 },
};

// Cartridge rejection sampling is unbounded because its hardware RNG advances.
// Injected deterministic RNGs can be pathological (for example, always 255), so
// cap only that impossible-to-progress seam and fold the last byte into-domain.
const MAX_RAND1_REJECTIONS = 32;

export function gen1CaptureProbability(input: Gen1CaptureInput): Gen1CaptureProbability {
  if (input.trainerBattle === true) return rational(0, 1, 255, 255);
  if (input.ballClass === "master") return rational(1, 1, 255, 255);

  const rules = BALL_RULES[input.ballClass];
  const { w, x } = captureThresholds(input, rules);
  const status = statusBonus(input.majorStatus);
  const catchRate = normalizeByte(input.catchRate);
  const immediateSuccesses = Math.min(status, rules.rand1Domain);
  const gatedSuccesses = status >= rules.rand1Domain
    ? 0
    : Math.min(catchRate + 1, rules.rand1Domain - status);

  if (w > 255) {
    return rational(immediateSuccesses + gatedSuccesses, rules.rand1Domain, w, x);
  }
  const numerator = immediateSuccesses * 256 + gatedSuccesses * (x + 1);
  return rational(numerator, rules.rand1Domain * 256, w, x);
}

export function attemptGen1Capture(input: Gen1CaptureInput, nextByte: Gen1NextByte): Gen1CaptureAttempt {
  const probability = gen1CaptureProbability(input);
  const rejectedRand1Bytes: number[] = [];
  if (input.trainerBattle === true) {
    return {
      caught: false,
      shakes: 0,
      failureReason: "trainerBattle",
      probability,
      trace: { rejectedRand1Bytes, rand1: undefined, adjustedRand1: undefined, rand2: undefined },
    };
  }

  if (input.ballClass === "master") {
    const rand1 = normalizeByte(nextByte());
    return {
      caught: true,
      shakes: 3,
      probability,
      trace: { rejectedRand1Bytes, rand1, adjustedRand1: undefined, rand2: undefined },
    };
  }

  const rules = BALL_RULES[input.ballClass];
  let rand1: number;
  let rejections = 0;
  do {
    rand1 = normalizeByte(nextByte());
    if (rand1 > rules.rand1Max) {
      rejectedRand1Bytes.push(rand1);
      rejections += 1;
      if (rejections >= MAX_RAND1_REJECTIONS) {
        rand1 %= rules.rand1Domain;
        break;
      }
    }
  } while (rand1 > rules.rand1Max);

  const status = statusBonus(input.majorStatus);
  if (rand1 < status) {
    return {
      caught: true,
      shakes: 3,
      probability,
      trace: { rejectedRand1Bytes, rand1, adjustedRand1: undefined, rand2: undefined },
    };
  }

  const adjustedRand1 = rand1 - status;
  const catchRate = normalizeByte(input.catchRate);
  const { w, x } = captureThresholds(input, rules);
  if (adjustedRand1 > catchRate) {
    return failedAttempt("rand1", input.majorStatus, catchRate, rules, probability, {
      rejectedRand1Bytes,
      rand1,
      adjustedRand1,
      rand2: undefined,
    });
  }
  if (w > 255) {
    return {
      caught: true,
      shakes: 3,
      probability,
      trace: { rejectedRand1Bytes, rand1, adjustedRand1, rand2: undefined },
    };
  }

  const rand2 = normalizeByte(nextByte());
  if (rand2 <= x) {
    return {
      caught: true,
      shakes: 3,
      probability,
      trace: { rejectedRand1Bytes, rand1, adjustedRand1, rand2 },
    };
  }
  return failedAttempt("rand2", input.majorStatus, catchRate, rules, probability, {
    rejectedRand1Bytes,
    rand1,
    adjustedRand1,
    rand2,
  });
}

function failedAttempt(
  failureReason: "rand1" | "rand2",
  majorStatus: Gen1MajorStatus | undefined,
  catchRate: number,
  rules: BallRules,
  probability: Gen1CaptureProbability,
  trace: Gen1CaptureAttempt["trace"],
): Gen1CaptureAttempt {
  const y = Math.floor((catchRate * 100) / rules.shakeFactor);
  const status2 = majorStatus === "sleep" || majorStatus === "freeze"
    ? 10
    : majorStatus === undefined
      ? 0
      : 5;
  const z = Math.floor((probability.x * y) / 255) + status2;
  const shakes: 0 | 1 | 2 | 3 = z < 10 ? 0 : z < 30 ? 1 : z < 70 ? 2 : 3;
  return { caught: false, shakes, failureReason, probability, trace };
}

function captureThresholds(input: Gen1CaptureInput, rules: BallRules): { readonly w: number; readonly x: number } {
  const maxHp = normalizeHp(input.maxHp);
  const currentHp = Math.min(maxHp, normalizeHp(input.currentHp));
  const hpQuarter = Math.max(Math.floor(currentHp / 4), 1);
  const w = Math.floor(Math.floor((maxHp * 255) / rules.hpFactor) / hpQuarter);
  return { w, x: Math.min(w, 255) };
}

function statusBonus(status: Gen1MajorStatus | undefined): number {
  if (status === "sleep" || status === "freeze") return 25;
  return status === undefined ? 0 : 12;
}

function rational(numerator: number, denominator: number, w: number, x: number): Gen1CaptureProbability {
  const divisor = greatestCommonDivisor(numerator, denominator);
  const reducedNumerator = numerator / divisor;
  const reducedDenominator = denominator / divisor;
  return {
    numerator: reducedNumerator,
    denominator: reducedDenominator,
    value: reducedNumerator / reducedDenominator,
    w,
    x,
  };
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(Math.trunc(left));
  let b = Math.abs(Math.trunc(right));
  while (b !== 0) {
    const remainder = a % b;
    a = b;
    b = remainder;
  }
  return Math.max(1, a);
}

function normalizeHp(value: number): number {
  return Math.min(999, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)));
}

function normalizeByte(value: number): number {
  return Math.min(255, Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
}
