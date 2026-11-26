// 전투 소리 자리(project.system.seCues, project/seCues.ts) 중 전투가 읽지 않던 자리를 사건에 잇는 순수 함수.
// 왜(2026-11-26 전투 소리 다양성 분석): attack-blunt/pierce/claw 와 강화·약화·독·수면·마비·반사·흡수·부활은 표에는 있는데 부르는 곳이 없었다.
// 저작한 소리가 있을 때만 울린다 — 자리가 비면 예전 소리 그대로(battleJuice.ts playAuthoredSeCue).
import { stateBehavior } from "@/battle/battleStates";
import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { CharacterMotionStyle } from "@/battle/characterMotion";
import type { StateRecord } from "@/project/types";

export type AttackFamily = "blunt" | "pierce" | "claw";

/** 전투 모션 계열(무기·몸) → 공격 소리 계열. 균형(검술)·마법·부유·탈것은 기본 공격(베기) 자리 그대로다. */
export function attackFamilyOfStyle(style: CharacterMotionStyle | undefined): AttackFamily | undefined {
  switch (style) {
    case "heavy": case "martial": case "soft": return "blunt";
    case "agile": case "lancer": case "ranged": return "pierce";
    case "beast": return "claw";
    default: return undefined;
  }
}

/**
 * 걸린 상태의 소리 자리. 상태 이름이 아니라 상태가 실제로 하는 일(stateBehavior)로 가른다:
 * 마법 반사 → reflect, 행동 불가 → 맞으면 풀리면 sleep 아니면 paralyze, 턴마다 HP 가 깎이면 poison, 공격·방어·민첩이 오르면 buff 내리면 debuff.
 */
export function stateAddedSeCue(record: Pick<StateRecord, "id" | "name" | "gen1MajorStatus" | "runtimeEffects" | "restriction" | "hpReleaseTurn" | "recoverWhenHitChance"> | undefined): string | undefined {
  if (!record) return undefined;
  const behavior = stateBehavior(record as StateRecord);
  if (behavior.reflect) return "reflect";
  if (record.gen1MajorStatus === "sleep") return "sleep";
  if (record.gen1MajorStatus === "paralysis") return "paralyze";
  if (behavior.restrictsAction) return behavior.recoverWhenHitChance > 0 ? "sleep" : "paralyze";
  if (record.gen1MajorStatus === "poison" || record.gen1MajorStatus === "toxic" || behavior.hpDamagePercentPerTurn > 0) return "poison";
  const multipliers = [behavior.attackMultiplier, behavior.defenseMultiplier, behavior.agilityMultiplier];
  if (multipliers.some((value) => value > 1)) return "buff";
  if (multipliers.some((value) => value < 1)) return "debuff";
  return undefined;
}

/** 전투 타임라인 엔트리 → 소리 자리(상태 걸림·능력 단계 변화·흡수·부활). 해당 없으면 undefined. */
export function battleEntrySeCue(
  entry: Pick<BattleTimelineEntrySnapshot, "kind" | "stateId" | "statStage" | "aside">,
  states: ReadonlyArray<StateRecord>,
): string | undefined {
  if (entry.kind === "revive") return "revive";
  if (entry.aside === "drain") return "absorb";
  if (entry.kind === "stateAdded" && entry.stateId) return stateAddedSeCue(states.find((state) => state.id === entry.stateId));
  if (entry.kind === "special" && entry.statStage) {
    if (entry.statStage.after > entry.statStage.before) return "buff";
    if (entry.statStage.after < entry.statStage.before) return "debuff";
  }
  return undefined;
}
