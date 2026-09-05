import type { BattleBattlerSnapshot, TargetedActorCommand } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { Project, SkillRecord } from "@/project/types";

export type BattleTargetScope = SkillRecord["scope"];
export type BattleTargetSide = "actor" | "enemy";
export type BattleTarget = MutableBattler | BattleBattlerSnapshot;

export interface BattleTargetResolution<T extends BattleTarget> {
  readonly scope: BattleTargetScope;
  readonly side: BattleTargetSide;
  readonly candidates: readonly T[];
  readonly targets: readonly T[];
  readonly requiresSelection: boolean;
}

export function targetScopeForCommand(project: Project, command: TargetedActorCommand): BattleTargetScope {
  switch (command.kind) {
    case "attack":
    case "capture":
      return "enemy";
    case "skill":
      return project.database.skills.find((skill) => skill.id === command.skillId)?.scope ?? "enemy";
    case "item": {
      const item = project.database.items.find((record) => record.id === command.itemId);
      if (!item) return "self";
      if (item.scope === "ally" || item.scope === "allAllies" || item.scope === "enemy") return item.scope;
      const skillId = item.type === "special" ? item.activateSkillId ?? item.skillId : undefined;
      return project.database.skills.find((skill) => skill.id === skillId)?.scope ?? "self";
    }
  }
}

export function requestedTargetId(command: { readonly targetEnemyId?: string; readonly targetActorId?: string }): string | undefined {
  return command.targetActorId ?? command.targetEnemyId;
}

export function resolveBattleTargets<T extends BattleTarget>(options: {
  readonly scope: BattleTargetScope;
  readonly user: T;
  readonly actors: readonly T[];
  readonly enemies: readonly T[];
  readonly requestedTargetId?: string;
}): BattleTargetResolution<T> {
  const userSide: BattleTargetSide = options.actors.some((entry) => sameBattler(entry, options.user)) ? "actor" : "enemy";
  const allies = (userSide === "actor" ? options.actors : options.enemies).filter(isLiving);
  const opponents = (userSide === "actor" ? options.enemies : options.actors).filter(isLiving);
  const side: BattleTargetSide = options.scope === "self" || options.scope === "ally" || options.scope === "allAllies"
    ? userSide
    : userSide === "actor" ? "enemy" : "actor";

  if (options.scope === "self") {
    return { scope: options.scope, side, candidates: [options.user], targets: [options.user], requiresSelection: false };
  }

  const candidates = options.scope === "ally" || options.scope === "allAllies" ? allies : opponents;
  if (options.scope === "allAllies" || options.scope === "allEnemies") {
    return { scope: options.scope, side, candidates, targets: candidates, requiresSelection: false };
  }

  const selected = options.requestedTargetId
    ? candidates.find((entry) => battlerIds(entry).includes(options.requestedTargetId as string))
    : undefined;
  return {
    scope: options.scope,
    side,
    candidates,
    targets: selected ? [selected] : [],
    requiresSelection: true,
  };
}

export function targetIdFor(target: BattleTarget): string {
  return target.id;
}

function battlerIds(target: BattleTarget): readonly string[] {
  return target.id === target.recordId ? [target.id] : [target.id, target.recordId];
}

function sameBattler(left: BattleTarget, right: BattleTarget): boolean {
  return left === right || battlerIds(left).some((id) => battlerIds(right).includes(id));
}

function isLiving(target: BattleTarget): boolean {
  return target.hp > 0 && !("defeated" in target && target.defeated);
}
