import type { DamageFeedback } from "@/player/battleSequencer";

/** One timed presentation beat for a resolved battle action. */
export type BattleActionBeatKind = "approach" | "impact" | "recover";

export type BattleUserMotion = "lunge" | "return" | "idle";
export type BattleTargetMotion = "knockback" | "idle";

export interface BattleActionBeat {
  readonly kind: BattleActionBeatKind;
  /** Director step stamped while this beat is live. */
  readonly directorStep: "acting" | "impact";
  readonly durationMs: number;
  /** Attacker / caster battler id (enemy id or actor recordId). */
  readonly userId?: string;
  readonly targetId?: string;
  readonly userMotion: BattleUserMotion;
  readonly targetMotion: BattleTargetMotion;
  readonly feedback?: DamageFeedback;
  /** True while the short hit-stop freeze should hold. */
  readonly hitStop: boolean;
}

export interface PlanActionBeatsInput {
  readonly userId: string;
  readonly targetId?: string;
  readonly feedback?: DamageFeedback;
  readonly actingMs: number;
  readonly hitStopMs: number;
  readonly impactMs: number;
}

/**
 * Classic side-view attack cadence:
 * approach (lunge) → impact (popup + hit-stop + knockback) → recover (return).
 * Timing matches the existing sequencer constants so tests stay stable.
 */
export function planActionBeats(input: PlanActionBeatsInput): readonly BattleActionBeat[] {
  const targetId = input.targetId ?? input.feedback?.targetId;
  const damaging =
    Boolean(input.feedback)
    && !input.feedback?.healing
    && !input.feedback?.miss
    && (input.feedback?.amount ?? 0) > 0;
  const miss = input.feedback?.miss === true;

  const approach: BattleActionBeat = {
    kind: "approach",
    directorStep: "acting",
    durationMs: input.actingMs,
    userId: input.userId,
    targetId,
    userMotion: "lunge",
    targetMotion: "idle",
    hitStop: false,
  };

  const impact: BattleActionBeat = {
    kind: "impact",
    directorStep: "impact",
    // Hit-stop only freezes on a real damaging connect; miss/heal skip the freeze.
    durationMs: damaging ? input.hitStopMs : 0,
    userId: input.userId,
    targetId,
    userMotion: "lunge",
    targetMotion: damaging ? "knockback" : "idle",
    feedback: input.feedback,
    hitStop: damaging,
  };

  const recover: BattleActionBeat = {
    kind: "recover",
    directorStep: "impact",
    durationMs: input.impactMs,
    userId: input.userId,
    targetId,
    // Misses still read as a short lunge then settle; heals skip knockback already.
    userMotion: miss || damaging || Boolean(input.feedback) ? "return" : "idle",
    targetMotion: "idle",
    hitStop: false,
  };

  return [approach, impact, recover];
}

/** Enemy multi-action beats skip a long approach (already mid-field). */
export function planEnemyActionBeats(input: {
  readonly userId: string;
  readonly feedback?: DamageFeedback;
  readonly hitStopMs: number;
  readonly impactMs: number;
}): readonly BattleActionBeat[] {
  const targetId = input.feedback?.targetId;
  const damaging =
    Boolean(input.feedback)
    && !input.feedback?.healing
    && !input.feedback?.miss
    && (input.feedback?.amount ?? 0) > 0;

  const impact: BattleActionBeat = {
    kind: "impact",
    directorStep: "impact",
    durationMs: damaging ? input.hitStopMs : 0,
    userId: input.userId,
    targetId,
    userMotion: "lunge",
    targetMotion: damaging ? "knockback" : "idle",
    feedback: input.feedback,
    hitStop: damaging,
  };

  const recover: BattleActionBeat = {
    kind: "recover",
    directorStep: "impact",
    durationMs: input.impactMs,
    userId: input.userId,
    targetId,
    userMotion: "return",
    targetMotion: "idle",
    hitStop: false,
  };

  return [impact, recover];
}
