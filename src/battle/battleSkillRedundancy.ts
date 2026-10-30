import { resolveBattleTargets } from "@/battle/battleTargetResolver";
import type { BattleBattlerSnapshot } from "@/battle/types";
import type { Project, SkillRecord } from "@/project/types";

/**
 * 순수 보조 기술(피해·회복 없음, 상태 부여만)이 이 대상에게 아무것도 새로 하지 않는가.
 * 전투 상태 부여는 이미 걸린 상태를 다시 걸어도 지속 차례를 늘리지 않는다(battleStates.applyStateEffects) —
 * 그래서 이미 「공격 상승」인 파티에 같은 버프를 또 쓰면 「…는 이미 공격 상승 상태다」 한 줄로 차례가 사라졌다
 * (이세계 고딩 첫인상 리뷰 2026-10-30). 능력치 단계·날씨·상태 해제가 섞인 기술은 다른 효과가 남으므로 헛수가 아니다.
 */
export function skillAddsNothingTo(skill: SkillRecord, target: Pick<BattleBattlerSnapshot, "stateIds">): boolean {
  const adds = pureStateAdds(skill);
  return adds !== undefined && adds.every((stateId) => target.stateIds.includes(stateId));
}

/** 보조 기술이 고를 수 있는 모든 대상에게 이미 다 걸려 있으면 그 첫 상태 id(메뉴 사유용), 아니면 undefined. */
export function skillAlreadyAppliedStateId(
  skill: SkillRecord,
  user: BattleBattlerSnapshot,
  actors: readonly BattleBattlerSnapshot[],
  enemies: readonly BattleBattlerSnapshot[],
): string | undefined {
  const adds = pureStateAdds(skill);
  if (!adds) return undefined;
  const resolution = resolveBattleTargets({ scope: skill.scope, user, actors, enemies });
  const reachable = resolution.requiresSelection ? resolution.candidates : resolution.targets;
  if (reachable.length === 0) return undefined;
  return reachable.every((target) => skillAddsNothingTo(skill, target)) ? adds[0] : undefined;
}

/** 메뉴 사유 문구: 「이미 공격 상승」. 상태 이름이 없으면 「이미 적용됨」. */
export function alreadyAppliedLabel(project: Project, stateId: string): string {
  const name = project.database.states.find((state) => state.id === stateId)?.name?.trim();
  return name ? `이미 ${name}` : "이미 적용됨";
}

function pureStateAdds(skill: SkillRecord): readonly string[] | undefined {
  if (skill.effect.kind !== "support") return undefined;
  if ((skill.statStageEffects?.length ?? 0) > 0 || skill.weather || skill.battleGimmick || skill.gaugeShift || skill.comboSwitchId) return undefined;
  const effects = skill.stateEffects ?? [];
  if (effects.length === 0 || effects.some((effect) => effect.operation !== "add")) return undefined;
  return effects.map((effect) => effect.stateId);
}
