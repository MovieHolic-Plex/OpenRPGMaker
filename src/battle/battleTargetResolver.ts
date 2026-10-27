import type { BattleBattlerSnapshot, TargetedActorCommand } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import type { Project, SkillArea, SkillRecord } from "@/project/types";

export type BattleTargetScope = SkillRecord["scope"];
export type BattleTargetSide = "actor" | "enemy";
export type BattleTarget = MutableBattler | BattleBattlerSnapshot;

/**
 * 부활 기술: HP 회복이면서 state_death 를 해제한다.
 * 런타임 대상 해결(commandRevives)과 적 AI·자동 전투가 같은 판정을 쓴다.
 * 쓰러짐 자체는 HP 0 이고, 이 상태 해제는 「쓰러진 아군도 대상」이라는 표식이다.
 */
export function skillRevivesDefeatedAllies(skill: Pick<SkillRecord, "effect" | "stateEffects"> | undefined): boolean {
  return skill?.effect.kind === "healing"
    && (skill.stateEffects ?? []).some((effect) => effect.operation === "remove" && effect.stateId === "state_death");
}

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
  readonly includeDefeatedAllies?: boolean;
  /** 위치 범위기(SkillRecord.area). 단일 대상 스코프에서 주 대상이 정해진 뒤에만 넓힌다. */
  readonly area?: SkillArea;
}): BattleTargetResolution<T> {
  const userSide: BattleTargetSide = options.actors.some((entry) => sameBattler(entry, options.user)) ? "actor" : "enemy";
  const allies = (userSide === "actor" ? options.actors : options.enemies).filter(target => options.includeDefeatedAllies || isLiving(target));
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
    targets: selected ? areaTargets(selected, candidates, options.area) : [],
    requiresSelection: true,
  };
}

/**
 * 주 대상 + 같은 편에서 범위 안에 있는 살아 있는 배틀러. 주 대상이 항상 첫째다.
 * 좌표는 배틀러 battleX/battleY(전투장 픽셀) — 좌표가 없는 배틀러는 범위에 들지 않는다.
 */
export function areaTargets<T extends BattleTarget>(primary: T, candidates: readonly T[], area: SkillArea | undefined): T[] {
  if (!area || area.radius <= 0) return [primary];
  const px = primary.battleX;
  const py = primary.battleY;
  if (px === undefined || py === undefined) return [primary];
  const splash = candidates.filter((entry) => {
    if (entry === primary || !isLiving(entry) || entry.battleX === undefined || entry.battleY === undefined) return false;
    if (area.shape === "line") return Math.abs(entry.battleY - py) <= area.radius / 2;
    return Math.hypot(entry.battleX - px, entry.battleY - py) <= area.radius;
  });
  return [primary, ...splash];
}

export function targetIdFor(target: BattleTarget): string {
  return target.id;
}

/**
 * 고른 단일 대상이 행동 전에 쓰러졌을 때, 같은 명단에서 다음으로 맞출 수 있는 배틀러.
 * 요청 id 가 명단에 없으면 undefined — 없는 대상은 다른 배틀러로 돌리지 않는다.
 * `candidates` 는 지금 맞출 수 있는 쪽(살아 있는 상대, 또는 화면에 있는 적)만 담는다.
 */
export function nextLivingBattler<T extends Pick<BattleTarget, "id" | "recordId">>(
  roster: readonly T[],
  candidates: readonly T[],
  requestedId: string,
): T | undefined {
  const start = roster.findIndex((entry) => battlerIds(entry).includes(requestedId));
  if (start < 0) return undefined;
  for (let step = 1; step <= roster.length; step += 1) {
    const entry = roster[(start + step) % roster.length];
    if (entry && candidates.includes(entry)) return entry;
  }
  return undefined;
}

function battlerIds(target: Pick<BattleTarget, "id" | "recordId">): readonly string[] {
  return target.id === target.recordId ? [target.id] : [target.id, target.recordId];
}

function sameBattler(left: BattleTarget, right: BattleTarget): boolean {
  return left === right || battlerIds(left).some((id) => battlerIds(right).includes(id));
}

function isLiving(target: BattleTarget): boolean {
  return target.hp > 0 && !("defeated" in target && target.defeated);
}
