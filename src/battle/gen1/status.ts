import type { Gen1DamageClass } from "@/battle/gen1/damage";
import type { Gen1NextByte } from "@/battle/gen1/rng";
import type { Gen1MajorStatus } from "@/battle/gen1/capture";
import type { Gen1CanonicalType } from "@/battle/typeChart";

export type { Gen1MajorStatus } from "@/battle/gen1/capture";

export interface Gen1StateRecordRef {
  readonly id: string;
  readonly gen1MajorStatus?: Gen1MajorStatus;
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
  readonly reason?: "asleep" | "wokeUp" | "frozen" | "fullyParalyzed";
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

export function gen1MajorStatusBlockedByType(
  status: Gen1MajorStatus,
  moveType: Gen1CanonicalType | undefined,
  targetTypes: readonly Gen1CanonicalType[],
  moveKind: "damage" | "status",
): boolean {
  if (status === "poison" && targetTypes.includes("poison")) return true;
  if (!moveType) return false;
  if (moveKind === "damage" && status !== "sleep") return targetTypes.includes(moveType);
  return moveKind === "status"
    && status === "paralysis"
    && moveType === "electric"
    && targetTypes.includes("ground");
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

export function applyGen1PostActionResidual(input: {
  readonly kind: Gen1MajorStatus | undefined;
  readonly maxHp: number;
  readonly currentHp: number;
}): { readonly damage: number; readonly currentHp: number; readonly fainted: boolean } {
  const maxHp = normalizeHp(input.maxHp, 1);
  const currentHp = Math.min(maxHp, normalizeHp(input.currentHp, 0));
  if (input.kind !== "burn" && input.kind !== "poison") {
    return { damage: 0, currentHp, fainted: currentHp === 0 };
  }
  const damage = Math.max(1, Math.floor(maxHp / 16));
  const remainingHp = Math.max(0, currentHp - damage);
  return { damage, currentHp: remainingHp, fainted: remainingHp === 0 };
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
