/**
 * 스킬 → 공격 자세. 스킬마다 그림을 만들지 않는다 — 속성 그림(불꽃·물줄기·잎)은 스킬의 전투 효과
 * 애니메이션(animationId)이 그리고, 몬스터 그림은 몸의 자세만 맡는다. 그래서 종마다 자세 몇 줄이면 된다.
 *
 * 기본 규칙 (스킬에 battlePose 가 있으면 그것이 이긴다):
 *   자기·아군 대상            → buff     (몸을 부풀리고 울부짖음)
 *   속성이 붙은 공격           → special  (버티고 고개를 들어 입을 벌림)
 *   그 밖의 공격(맞닿는 공격)   → tackle   (웅크렸다 몸통·입으로 덤빔)
 * 맞을 때는 스킬과 상관없이 hurt.
 */
export type BattlePose = "tackle" | "special" | "buff";

export type SkillLike = {
  /** 저자가 직접 고른 자세 (있으면 규칙보다 우선) */
  battlePose?: string;
  scope?: string;
  elementId?: string | null;
};

const SELF_SCOPES = new Set(["self", "user", "ally", "allies", "party", "all-allies", "allAllies"]);
const NO_ELEMENT = new Set(["", "none", "physical", "normal"]);

export function poseForSkill(skill: SkillLike, available: readonly string[] = ["tackle", "special", "buff"]): BattlePose {
  const wanted = skill.battlePose && available.includes(skill.battlePose) ? (skill.battlePose as BattlePose) : null;
  if (wanted) return wanted;
  if (skill.scope && SELF_SCOPES.has(skill.scope)) return "buff";
  if (skill.elementId && !NO_ELEMENT.has(skill.elementId)) return "special";
  return "tackle";
}
