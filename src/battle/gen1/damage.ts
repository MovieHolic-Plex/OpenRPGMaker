import { rotateLeft8, rotateRight8, type Gen1NextByte } from "@/battle/gen1/rng";

export const GEN1_RANDOM_MIN = 217;
export const GEN1_RANDOM_MAX = 255;
export const GEN1_NEUTRAL_DAMAGE_CAP = 999;

export type Gen1DamageClass = "physical" | "special";
export type Gen1CriticalRate = "normal" | "high";

export interface Gen1BaseDamageInput {
  readonly level: number;
  readonly power: number;
  readonly attack: number;
  readonly defense: number;
  readonly critical?: boolean;
}

export type Gen1BaseDamageResult =
  | { readonly ok: true; readonly damage: number; readonly attack: number; readonly defense: number }
  | { readonly ok: false; readonly reason: "divisionByZero"; readonly attack: number; readonly defense: 0 };

export interface Gen1DamageStatPair {
  readonly unmodified: number;
  readonly modified: number;
}

export interface Gen1MoveInput {
  readonly level: number;
  readonly power: number;
  readonly damageClass: Gen1DamageClass;
  readonly baseSpeed: number;
  readonly criticalRate: Gen1CriticalRate;
  readonly focusEnergy?: boolean;
  readonly offense: Gen1DamageStatPair;
  readonly defense: Gen1DamageStatPair;
  readonly burned: boolean;
  readonly stab: boolean;
  /** Type factors in cartridge tenths: 0, 5, 10, 15, or 20. */
  readonly typeFactors: readonly number[];
  readonly baseAccuracyByte: number;
  readonly accuracyStage?: number;
  readonly evasionStage?: number;
  readonly alwaysHits?: boolean;
}

export interface Gen1MoveResolution {
  readonly hit: boolean;
  readonly critical: boolean;
  readonly damage: number;
  readonly neutralDamage: number;
  readonly scaledAccuracy: number;
  readonly missReason?: "accuracy" | "type" | "divisionByZero";
  readonly trace: {
    readonly critByte?: number;
    readonly rejectedDamageBytes: readonly number[];
    readonly damageByte?: number;
    readonly accuracyByte?: number;
  };
}

const STAT_MODIFIER_RATIOS: readonly (readonly [number, number])[] = [
  [25, 100],
  [28, 100],
  [33, 100],
  [40, 100],
  [50, 100],
  [66, 100],
  [1, 1],
  [15, 10],
  [2, 1],
  [25, 10],
  [3, 1],
  [35, 10],
  [4, 1],
];

export function scaleGen1DamageStats(attack: number, defense: number): { readonly attack: number; readonly defense: number } {
  let scaledAttack = normalizeStat(attack, 1);
  let scaledDefense = normalizeStat(defense, 1);
  if (scaledAttack > 255 || scaledDefense > 255) {
    scaledAttack = Math.floor(scaledAttack / 4);
    scaledDefense = Math.floor(scaledDefense / 4);
  }
  return { attack: Math.max(1, scaledAttack), defense: scaledDefense };
}

export function computeGen1BaseDamageResult(input: Gen1BaseDamageInput): Gen1BaseDamageResult {
  const stats = scaleGen1DamageStats(input.attack, input.defense);
  if (stats.defense === 0) {
    return { ok: false, reason: "divisionByZero", attack: stats.attack, defense: 0 };
  }
  const power = Math.max(0, Math.trunc(input.power));
  if (power === 0) {
    return { ok: true, damage: 0, ...stats };
  }
  const baseLevel = Math.max(1, Math.trunc(input.level));
  const level = input.critical ? baseLevel * 2 : baseLevel;
  const levelTerm = Math.floor((2 * level) / 5) + 2;
  const dividedByDefense = Math.floor((levelTerm * power * stats.attack) / stats.defense);
  const neutralDamage = Math.floor(dividedByDefense / 50) + 2;
  return { ok: true, damage: Math.min(GEN1_NEUTRAL_DAMAGE_CAP, neutralDamage), ...stats };
}

export function computeGen1BaseDamage(input: Gen1BaseDamageInput): number {
  const result = computeGen1BaseDamageResult(input);
  return result.ok ? result.damage : 0;
}

export function applyGen1StabAndType(
  neutralDamage: number,
  stab: boolean,
  typeFactors: readonly number[],
): number {
  let damage = Math.max(0, Math.trunc(neutralDamage));
  if (stab) damage += Math.floor(damage / 2);
  for (const rawFactor of typeFactors) {
    const factor = Math.max(0, Math.trunc(rawFactor));
    damage = Math.floor((damage * factor) / 10);
  }
  return damage;
}

export function gen1CriticalThreshold(
  baseSpeed: number,
  criticalRate: Gen1CriticalRate,
  focusEnergy: boolean,
): number {
  let threshold = Math.floor(normalizeByte(baseSpeed) / 2);
  threshold = focusEnergy ? Math.floor(threshold / 2) : shiftLeftAndCap(threshold);
  if (criticalRate === "normal") return Math.floor(threshold / 2);
  threshold = shiftLeftAndCap(threshold);
  return shiftLeftAndCap(threshold);
}

export function isGen1CriticalHit(
  baseSpeed: number,
  criticalRate: Gen1CriticalRate,
  focusEnergy: boolean,
  randomByte: number,
): boolean {
  return rotateLeft8(randomByte, 3) < gen1CriticalThreshold(baseSpeed, criticalRate, focusEnergy);
}

export function accuracyByteFromPercent(percent: number): number {
  const normalized = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return Math.floor((normalized * 255) / 100);
}

export function scaledGen1Accuracy(baseAccuracyByte: number, accuracyStage = 0, evasionStage = 0): number {
  let accuracy = normalizeByte(baseAccuracyByte);
  accuracy = applyStatRatio(accuracy, accuracyStage);
  accuracy = applyStatRatio(accuracy, -evasionStage);
  return Math.min(255, accuracy);
}

export function resolveGen1DamagingMove(input: Gen1MoveInput, nextByte: Gen1NextByte): Gen1MoveResolution {
  const rejectedDamageBytes: number[] = [];
  const critByte = nextByte();
  const critical = isGen1CriticalHit(
    input.baseSpeed,
    input.criticalRate,
    input.focusEnergy === true,
    critByte,
  );
  const selectedAttack = critical ? input.offense.unmodified : input.offense.modified;
  const selectedDefense = critical ? input.defense.unmodified : input.defense.modified;
  const attack = !critical && input.damageClass === "physical" && input.burned
    ? Math.max(1, Math.floor(normalizeStat(selectedAttack, 1) / 2))
    : selectedAttack;
  const base = computeGen1BaseDamageResult({
    level: input.level,
    power: input.power,
    attack,
    defense: selectedDefense,
    critical,
  });
  const scaledAccuracy = scaledGen1Accuracy(
    input.baseAccuracyByte,
    input.accuracyStage,
    input.evasionStage,
  );
  if (!base.ok) {
    return {
      hit: false,
      critical,
      damage: 0,
      neutralDamage: 0,
      scaledAccuracy,
      missReason: "divisionByZero",
      trace: { critByte, rejectedDamageBytes },
    };
  }

  let damage = applyGen1StabAndType(base.damage, input.stab, input.typeFactors);
  let damageByte: number | undefined;
  if (damage > 1) {
    do {
      damageByte = rotateRight8(nextByte());
      if (damageByte < GEN1_RANDOM_MIN) rejectedDamageBytes.push(damageByte);
    } while (damageByte < GEN1_RANDOM_MIN);
    damage = Math.floor((damage * damageByte) / GEN1_RANDOM_MAX);
  }

  let accuracyByte: number | undefined;
  const accuracyHit = input.alwaysHits === true || (() => {
    accuracyByte = nextByte();
    return accuracyByte < scaledAccuracy;
  })();
  const typeMiss = damage === 0;
  const missReason = typeMiss ? "type" : accuracyHit ? undefined : "accuracy";
  return {
    hit: missReason === undefined,
    critical,
    damage: missReason === undefined ? damage : 0,
    neutralDamage: base.damage,
    scaledAccuracy,
    missReason,
    trace: { critByte, rejectedDamageBytes, damageByte, accuracyByte },
  };
}

function applyStatRatio(value: number, stage: number): number {
  const normalizedStage = Math.min(6, Math.max(-6, Math.trunc(stage)));
  const ratio = STAT_MODIFIER_RATIOS[normalizedStage + 6] ?? [1, 1];
  return Math.max(1, Math.floor((value * ratio[0]) / ratio[1]));
}

function shiftLeftAndCap(value: number): number {
  return value >= 128 ? 255 : value * 2;
}

function normalizeByte(value: number): number {
  return Math.min(255, Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
}

function normalizeStat(value: number, minimum: number): number {
  return Math.min(999, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)));
}
