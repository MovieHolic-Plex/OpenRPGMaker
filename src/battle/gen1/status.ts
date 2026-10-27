import { computeGen1BaseDamage, type Gen1DamageClass } from "@/battle/gen1/damage";
import type { Gen1NextByte } from "@/battle/gen1/rng";
import type { Gen1MajorStatus } from "@/battle/gen1/capture";
import type { Gen1CanonicalType } from "@/battle/typeChart";

export type { Gen1MajorStatus } from "@/battle/gen1/capture";

/** 주요 상태와 따로 걸리고 교체하면 풀리는 상태. 지금은 혼란 하나. */
export type Gen1VolatileStatus = "confusion";

export interface Gen1StateRecordRef {
  readonly id: string;
  readonly gen1MajorStatus?: Gen1MajorStatus;
  /** 주요 상태와 겹쳐 걸리는 휘발 상태(교체·전투 종료로 사라진다). */
  readonly volatileStatus?: Gen1VolatileStatus;
  /** 얼음만: 행동 전 녹을 확률(%). 0·없음이면 1세대처럼 치료할 때까지 못 움직인다. 3세대는 20. */
  readonly thawChance?: number;
}

export interface Gen1StatusState {
  readonly stateIds: readonly string[];
  readonly stateTurns: Readonly<Record<string, number>>;
  readonly stateRecords: readonly Gen1StateRecordRef[];
}

export interface Gen1MajorStatusView {
  readonly stateId: string;
  readonly kind: Gen1MajorStatus;
  readonly turns?: number;
}

export interface Gen1ApplyStatusInput extends Gen1StatusState {
  readonly incomingStateId: string;
}

export interface Gen1ApplyStatusResult {
  readonly applied: boolean;
  readonly reason?: "majorStatusPresent" | "notMajorStatus";
  readonly stateIds: readonly string[];
  readonly stateTurns: Readonly<Record<string, number>>;
  readonly trace: {
    readonly rejectedSleepBytes: readonly number[];
    readonly sleepByte?: number;
  };
}

export interface Gen1PreActionResult {
  readonly canAct: boolean;
  readonly reason?: "asleep" | "wokeUp" | "frozen" | "thawed" | "fullyParalyzed";
  readonly stateIds: readonly string[];
  readonly stateTurns: Readonly<Record<string, number>>;
  readonly trace: { readonly paralysisByte?: number };
}

/**
 * Converts authored post-hit percentages to the cartridge comparison boundary.
 * Red/Blue side effects generally compare against `N percent + 1`, where the
 * percent macro is floor(N * 255 / 100). A guaranteed effect is not rolled.
 */
export function gen1EffectChanceThreshold(percent: number): number {
  const normalized = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  if (normalized <= 0) return 0;
  return Math.min(256, Math.floor((normalized * 255) / 100) + 1);
}

export function gen1EffectChanceSucceeds(percent: number, nextByte: Gen1NextByte): boolean {
  const threshold = gen1EffectChanceThreshold(percent);
  if (threshold <= 0) return false;
  if (threshold >= 256) return true;
  return normalizeByte(nextByte()) < threshold;
}

/**
 * 상태 기술이 대상 타입 때문에 막힐 때 그 타입.
 * 불꽃은 화상, 얼음은 얼음, 독·강철은 독·맹독에 걸리지 않는다. 기술을 준 타입과 무관하다
 * (노말 기술로 거는 화상, 타입이 없는 접촉 특성도 포함). 전기 마비는 땅 타입에만 막힌다.
 * 피해 기술의 「같은 타입이면 부가 상태가 안 붙는」 1세대 규칙은 여기 없다.
 */
export function gen1StatusMoveBlockedByTargetType(
  status: Gen1MajorStatus,
  moveType: Gen1CanonicalType | undefined,
  targetTypes: readonly Gen1CanonicalType[],
): Gen1CanonicalType | undefined {
  const poisonous = status === "poison" || status === "toxic";
  if (poisonous && targetTypes.includes("poison")) return "poison";
  // 3세대 이후: 강철은 독 상태에 걸리지 않는다(15타입 1세대 프로젝트에는 강철 타입이 없어 영향 없음).
  if (poisonous && targetTypes.includes("steel")) return "steel";
  if (status === "burn" && targetTypes.includes("fire")) return "fire";
  if (status === "freeze" && targetTypes.includes("ice")) return "ice";
  if (status === "paralysis" && moveType === "electric" && targetTypes.includes("ground")) return "ground";
  return undefined;
}

export function gen1MajorStatusBlockedByType(
  status: Gen1MajorStatus,
  moveType: Gen1CanonicalType | undefined,
  targetTypes: readonly Gen1CanonicalType[],
  moveKind: "damage" | "status",
): boolean {
  const immune = gen1StatusMoveBlockedByTargetType(status, moveType, targetTypes);
  // 땅의 전기 마비 무효는 상태 기술(전기자석파)만. 피해 기술의 부가 마비는 상성 0 배가 맡는다.
  if (immune && (immune !== "ground" || moveKind === "status")) return true;
  if (!moveType) return false;
  // 1세대: 피해 기술의 부가 상태(수면 제외)는 기술과 같은 타입에게 붙지 않는다.
  if (moveKind === "damage" && status !== "sleep") return targetTypes.includes(moveType);
  return false;
}

export function readGen1MajorStatus(
  stateIds: readonly string[],
  stateTurns: Readonly<Record<string, number>>,
  stateRecords: readonly Gen1StateRecordRef[],
): Gen1MajorStatusView | undefined {
  const records = new Map(stateRecords.map((record) => [record.id, record]));
  for (const stateId of stateIds) {
    const kind = records.get(stateId)?.gen1MajorStatus;
    if (kind) return { stateId, kind, turns: stateTurns[stateId] };
  }
  return undefined;
}

export function applyGen1MajorStatus(
  input: Gen1ApplyStatusInput,
  nextByte: Gen1NextByte,
): Gen1ApplyStatusResult {
  const trace: { rejectedSleepBytes: number[]; sleepByte?: number } = { rejectedSleepBytes: [] };
  if (readGen1MajorStatus(input.stateIds, input.stateTurns, input.stateRecords)) {
    return {
      applied: false,
      reason: "majorStatusPresent",
      stateIds: [...input.stateIds],
      stateTurns: { ...input.stateTurns },
      trace,
    };
  }
  const incoming = input.stateRecords.find((record) => record.id === input.incomingStateId);
  if (!incoming?.gen1MajorStatus) {
    return {
      applied: false,
      reason: "notMajorStatus",
      stateIds: [...input.stateIds],
      stateTurns: { ...input.stateTurns },
      trace,
    };
  }

  const stateIds = input.stateIds.includes(input.incomingStateId)
    ? [...input.stateIds]
    : [...input.stateIds, input.incomingStateId];
  const stateTurns = { ...input.stateTurns };
  if (incoming.gen1MajorStatus === "sleep") {
    let sleepByte: number;
    let turns: number;
    do {
      sleepByte = normalizeByte(nextByte());
      turns = sleepByte & 0x07;
      if (turns === 0) trace.rejectedSleepBytes.push(sleepByte);
    } while (turns === 0);
    stateTurns[input.incomingStateId] = turns;
    trace.sleepByte = sleepByte;
  }
  return { applied: true, stateIds, stateTurns, trace };
}

export function stepGen1MajorStatus(input: Gen1StatusState, nextByte: Gen1NextByte): Gen1PreActionResult {
  const stateIds = [...input.stateIds];
  const stateTurns = { ...input.stateTurns };
  const current = readGen1MajorStatus(stateIds, stateTurns, input.stateRecords);
  if (!current) return { canAct: true, stateIds, stateTurns, trace: {} };

  if (current.kind === "sleep") {
    const remaining = normalizeSleepTurns(current.turns) - 1;
    if (remaining === 0) {
      const index = stateIds.indexOf(current.stateId);
      if (index >= 0) stateIds.splice(index, 1);
      delete stateTurns[current.stateId];
      return { canAct: false, reason: "wokeUp", stateIds, stateTurns, trace: {} };
    }
    stateTurns[current.stateId] = remaining;
    return { canAct: false, reason: "asleep", stateIds, stateTurns, trace: {} };
  }
  if (current.kind === "freeze") {
    const thawChance = input.stateRecords.find((record) => record.id === current.stateId)?.thawChance ?? 0;
    if (thawChance > 0 && normalizeByte(nextByte()) < Math.round(thawChance * 256 / 100)) {
      const index = stateIds.indexOf(current.stateId);
      if (index >= 0) stateIds.splice(index, 1);
      delete stateTurns[current.stateId];
      return { canAct: true, reason: "thawed", stateIds, stateTurns, trace: {} };
    }
    return { canAct: false, reason: "frozen", stateIds, stateTurns, trace: {} };
  }
  if (current.kind === "paralysis") {
    const paralysisByte = normalizeByte(nextByte());
    return paralysisByte < 63
      ? { canAct: false, reason: "fullyParalyzed", stateIds, stateTurns, trace: { paralysisByte } }
      : { canAct: true, stateIds, stateTurns, trace: { paralysisByte } };
  }
  return { canAct: true, stateIds, stateTurns, trace: {} };
}

export function gen1BurnAdjustedAttack(
  attack: number,
  damageClass: Gen1DamageClass,
  burned: boolean,
  critical: boolean,
): number {
  const normalized = normalizeStat(attack);
  return burned && damageClass === "physical" && !critical
    ? Math.max(1, Math.floor(normalized / 2))
    : normalized;
}

export function gen1ParalyzedSpeed(speed: number, paralyzed: boolean): number {
  const normalized = normalizeStat(speed);
  return paralyzed ? Math.max(1, Math.floor(normalized / 4)) : normalized;
}

export const GEN1_TOXIC_COUNTER_MAX = 15;

/** 맹독 카운터: 매 차례 말에 1 올라 15 에서 멈춘다. 0 이하·비정상은 첫 차례(1)로 본다. */
export function gen1NextToxicCounter(previous: number | undefined): number {
  const counter = Math.trunc(Number.isFinite(previous) ? previous! : 0);
  return Math.min(GEN1_TOXIC_COUNTER_MAX, Math.max(0, counter) + 1);
}

export function applyGen1PostActionResidual(input: {
  readonly kind: Gen1MajorStatus | undefined;
  readonly maxHp: number;
  readonly currentHp: number;
  /** 맹독일 때 이번 차례의 카운터(1~15). 없으면 1. */
  readonly toxicCounter?: number;
}): { readonly damage: number; readonly currentHp: number; readonly fainted: boolean } {
  const maxHp = normalizeHp(input.maxHp, 1);
  const currentHp = Math.min(maxHp, normalizeHp(input.currentHp, 0));
  if (input.kind !== "burn" && input.kind !== "poison" && input.kind !== "toxic") {
    return { damage: 0, currentHp, fainted: currentHp === 0 };
  }
  const unit = Math.max(1, Math.floor(maxHp / 16));
  const damage = input.kind === "toxic"
    ? unit * Math.min(GEN1_TOXIC_COUNTER_MAX, Math.max(1, Math.trunc(input.toxicCounter ?? 1)))
    : unit;
  const remainingHp = Math.max(0, currentHp - damage);
  return { damage, currentHp: remainingHp, fainted: remainingHp === 0 };
}

/** 혼란이 걸릴 때 남는 행동 수(2~5). 바이트 하나를 쓴다. */
export function gen1ConfusionTurns(nextByte: Gen1NextByte): number {
  return (normalizeByte(nextByte()) & 0x03) + 2;
}

export interface Gen1ConfusionStep {
  /** acts = 평소처럼 행동, selfHit = 자신을 때리고 이번 행동을 잃음, snappedOut = 풀려서 평소처럼 행동. */
  readonly outcome: "acts" | "selfHit" | "snappedOut";
  readonly turnsLeft: number;
  readonly trace: { readonly confusionByte?: number };
}

/**
 * 행동 직전 혼란 판정. 남은 횟수를 하나 줄이고, 0 이 되면 풀려 정상 행동한다.
 * 아직 걸려 있으면 바이트 하나로 절반(<128)이 자신을 때린다.
 */
export function stepGen1Confusion(turnsLeft: number, nextByte: Gen1NextByte): Gen1ConfusionStep {
  const remaining = Math.max(0, Math.trunc(Number.isFinite(turnsLeft) ? turnsLeft : 0)) - 1;
  if (remaining <= 0) return { outcome: "snappedOut", turnsLeft: 0, trace: {} };
  const confusionByte = normalizeByte(nextByte());
  return { outcome: confusionByte < 128 ? "selfHit" : "acts", turnsLeft: remaining, trace: { confusionByte } };
}

/** 혼란 자해: 위력 40 무속성 물리, 자기 공격 ÷ 자기 방어. 급소·자속·난수 없음(카트리지와 같다). 최소 1. */
export function gen1ConfusionSelfDamage(level: number, attack: number, defense: number): number {
  return Math.max(1, computeGen1BaseDamage({ level, power: 40, attack: normalizeStat(attack), defense: normalizeStat(defense) }));
}

function normalizeSleepTurns(turns: number | undefined): number {
  return Math.min(7, Math.max(1, Math.trunc(Number.isFinite(turns) ? turns! : 1)));
}

function normalizeStat(value: number): number {
  return Math.min(999, Math.max(1, Math.trunc(Number.isFinite(value) ? value : 1)));
}

function normalizeHp(value: number, minimum: number): number {
  return Math.min(999, Math.max(minimum, Math.trunc(Number.isFinite(value) ? value : minimum)));
}

function normalizeByte(value: number): number {
  return Math.min(255, Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0)));
}
