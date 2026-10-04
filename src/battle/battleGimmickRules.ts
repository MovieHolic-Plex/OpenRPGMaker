/** Turn battle rules. Presentation reads these facts; it never modifies this ledger. */
import {
  BATTLE_MOTION_PATTERNS,
  type BattleMotionPattern,
} from "@/battle/battleMotionProgram";
export interface BattleGimmick {
  pattern: BattleMotionPattern;
  durationTurns?: number;
  markKey?: string;
  maxStacks?: number;
  consumeMarks?: boolean;
  requiredMark?: boolean;
  followOnHit?: boolean;
  allyActorId?: string;
  elementId?: string;
  resourceId?: string;
  radius?: number;
  triggerChance?: number;
  powerMultiplier?: number;
  killRefundPercent?: number;
}
export function normalizeBattleGimmick(
  raw: unknown,
): BattleGimmick | undefined {
  if (!raw || typeof raw !== "object") return;
  const v = raw as Record<string, unknown>;
  if (!(BATTLE_MOTION_PATTERNS as readonly unknown[]).includes(v.pattern))
    return;
  const out: BattleGimmick = { pattern: v.pattern as BattleMotionPattern };
  const bounds = {
    durationTurns: [1, 6],
    maxStacks: [1, 9],
    radius: [16, 800],
    triggerChance: [0, 100],
    powerMultiplier: [0.1, 3],
    killRefundPercent: [0, 100],
  } as const;
  for (const key of Object.keys(bounds) as (keyof typeof bounds)[]) {
    const n = v[key];
    if (typeof n === "number" && Number.isFinite(n)) {
      const bounded = Math.max(bounds[key][0], Math.min(bounds[key][1], n));
      out[key] =
        key === "durationTurns" || key === "maxStacks"
          ? Math.round(bounded)
          : bounded;
    }
  }
  for (const key of [
    "markKey",
    "allyActorId",
    "elementId",
    "resourceId",
  ] as const)
    if (typeof v[key] === "string" && v[key].trim())
      out[key] = v[key].trim().slice(0, 96);
  for (const key of ["consumeMarks", "requiredMark", "followOnHit"] as const)
    if (typeof v[key] === "boolean") out[key] = v[key];
  return out;
}
export interface GimmickStatus {
  kind:
    | "mark"
    | "airborne"
    | "trap"
    | "zone"
    | "summon"
    | "counter"
    | "cover"
    | "absorb"
    | "transform";
  ownerId: string;
  targetId: string;
  skillId: string;
  remaining: number;
  stacks: number;
  stored: number;
  createdAction: number;
  config: BattleGimmick;
  x?: number;
  y?: number;
}
export interface GimmickStatusSnapshot {
  kind: GimmickStatus["kind"];
  ownerId: string;
  skillId: string;
  turnsLeft: number;
  stacks: number;
  stored: number;
  resourceId?: string;
}
export class BattleGimmickLedger {
  private statuses: GimmickStatus[] = [];
  get(
    targetId: string,
    kind: GimmickStatus["kind"],
    key?: string,
  ): GimmickStatus | undefined {
    return this.statuses.find(
      (s) =>
        s.targetId === targetId &&
        s.kind === kind &&
        (!key || (s.config.markKey ?? "default") === key),
    );
  }
  set(status: GimmickStatus): void {
    this.statuses = this.statuses.filter(
      (s) =>
        !(
          s.targetId === status.targetId &&
          s.kind === status.kind &&
          (s.config.markKey ?? "default") ===
            (status.config.markKey ?? "default")
        ),
    );
    // Finite, battle-local storage, including hostile imported data.
    if (this.statuses.length < 128) this.statuses.push(status);
  }
  remove(status: GimmickStatus): void {
    this.statuses = this.statuses.filter((s) => s !== status);
  }
  all(): readonly GimmickStatus[] {
    return this.statuses;
  }
  snapshot(id: string): GimmickStatusSnapshot[] {
    return this.statuses
      .filter((s) => s.targetId === id)
      .map((s) => ({
        kind: s.kind,
        ownerId: s.ownerId,
        skillId: s.skillId,
        turnsLeft: s.remaining,
        stacks: s.stacks,
        stored: s.stored,
        ...(s.config.resourceId ? { resourceId: s.config.resourceId } : {}),
      }));
  }
  clear(): void {
    this.statuses = [];
  }
}
