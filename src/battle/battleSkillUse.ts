import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/types";
import type { MutableBattler } from "@/battle/battleBattlers";
import { canBattlerAct, stateBlocksSkillUse } from "@/battle/battleStates";
import type { ActorId, Project, SkillId, SkillRecord } from "@/project/types";

export type BattleSkillUser = Pick<
  MutableBattler | BattleBattlerSnapshot,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp" | "skillCooldowns" | "stateIds"
>;
export type MutableBattleSkillUser = Pick<
  MutableBattler,
  "mp" | "maxMp" | "skillIds" | "monsterInstanceId" | "skillPp" | "skillCooldowns"
>;
export type BattleSkillUseFailure =
  | "missingSkill" | "notLearned" | "skillBlocked" | "insufficientMp" | "noPp" | "cooldown"
  | "comboPartnerAbsent" | "comboPartnerNotReady" | "comboPartnerMp";
export type BattleSkillResourceConsumption =
  | { readonly kind: "pp" | "mp"; readonly remaining: number }
  | { readonly kind: "none" };

export function battleSkillMpCost(skill: Pick<SkillRecord, "mpCost">, maxMp: number): number {
  const flat = skill.mpCost.flat ?? 0;
  const percentMax = skill.mpCost.percentMax ?? 0;
  return Math.max(0, Math.trunc(flat) + Math.floor((Math.max(0, maxMp) * percentMax) / 100));
}

export function battleSkillUseFailure(
  project: Project,
  user: BattleSkillUser,
  skillId: SkillId,
  options: { readonly requireLearned?: boolean } = {},
): BattleSkillUseFailure | undefined {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill) return "missingSkill";
  if (options.requireLearned !== false && !user.skillIds.includes(skillId)) return "notLearned";
  if ((user.skillCooldowns?.[skillId] ?? 0) > 0) return "cooldown";
  if (stateBlocksSkillUse(project, user)) return "skillBlocked";
  if (usesSkillPp(project, user, skill)) {
    const currentPp = user.skillPp?.[skillId] ?? Math.max(1, Math.trunc(skill.maxPp ?? 1));
    if (currentPp <= 0) return "noPp";
    return undefined;
  }
  if (user.mp < battleSkillMpCost(skill, user.maxMp)) return "insufficientMp";
  return undefined;
}

/** Runtime-ready single authority for MP/PP consumption. */
export function consumeBattleSkillResource(
  project: Project,
  user: MutableBattleSkillUser,
  skillId: SkillId,
): BattleSkillResourceConsumption {
  const skill = project.database.skills.find((record) => record.id === skillId);
  if (!skill) return { kind: "none" };
  startBattleSkillCooldown(user, skill);
  if (usesSkillPp(project, user, skill)) {
    const maxPp = Math.max(1, Math.trunc(skill.maxPp ?? 1));
    const currentPp = user.skillPp?.[skillId] ?? maxPp;
    const remaining = Math.max(0, Math.trunc(currentPp) - 1);
    user.skillPp ??= {};
    user.skillPp[skillId] = remaining;
    return { kind: "pp", remaining };
  }
  const remaining = Math.max(0, user.mp - battleSkillMpCost(skill, user.maxMp));
  user.mp = remaining;
  return { kind: "mp", remaining };
}

function usesSkillPp(
  project: Pick<Project, "system">,
  user: Pick<BattleSkillUser, "monsterInstanceId">,
  skill: Pick<SkillRecord, "maxPp">,
): boolean {
  return skill.maxPp !== undefined
    && (typeof user.monsterInstanceId === "string" || project.system.battleModel === "gen1");
}

export function battleSkillUseFailureLabel(
  failure: BattleSkillUseFailure,
  skill: SkillRecord | undefined,
  user: Pick<BattleSkillUser, "mp" | "maxMp">,
): string {
  switch (failure) {
    case "missingSkill":
      return "스킬 데이터가 없습니다.";
    case "notLearned":
      return "아직 습득하지 않은 스킬입니다.";
    case "skillBlocked":
      return "침묵 상태라 스킬을 사용할 수 없습니다.";
    case "insufficientMp": {
      const cost = skill ? battleSkillMpCost(skill, user.maxMp) : 0;
      return `MP 부족 (필요 ${cost} / 현재 ${user.mp})`;
    }
    case "cooldown": return "재사용 대기 중입니다.";
    case "noPp":
      return "PP가 부족합니다.";
    case "comboPartnerAbsent":
      return "연계 동료가 전투에 없습니다.";
    case "comboPartnerNotReady":
      return "연계 동료가 아직 준비되지 않았습니다.";
    case "comboPartnerMp":
      return "연계 동료의 MP가 부족합니다.";
  }
}

/** 연계기(듀얼·트리플 테크)의 참가 배우. 정규화가 2~3명일 때만 남기므로 그 밖이면 일반 기술이다. */
export function comboActorIdsOf(skill: Pick<SkillRecord, "comboActorIds"> | undefined): readonly ActorId[] | undefined {
  const ids = skill?.comboActorIds;
  return ids && ids.length >= 2 ? ids : undefined;
}

/** 연계 판정에 쓰는 전투 참가 배우 한 명. ready 는 게이지 만충(strict 는 이번 라운드 미행동)이다. */
export interface BattleComboParticipant {
  readonly recordId: string;
  readonly hp: number;
  readonly mp: number;
  readonly maxMp: number;
  readonly stateIds: readonly string[];
  readonly ready: boolean;
}

/**
 * 스킬 사용 가능 여부의 배우용 단일 권위. 일반 기술은 battleSkillUseFailure 와 같고,
 * 연계기는 시전자가 연계 멤버이면 배우지 않아도 되며 동료 전원의 생존·준비·MP 를 본다.
 * 런타임(명령 적법성)과 전투 메뉴가 같은 함수를 써야 메뉴에 보인 기술이 실행에서 거부되지 않는다.
 */
export function battleActorSkillFailure(
  project: Project,
  user: BattleSkillUser & { readonly recordId: string },
  skillId: SkillId,
  party: readonly BattleComboParticipant[],
): BattleSkillUseFailure | undefined {
  const skill = project.database.skills.find((record) => record.id === skillId);
  const combo = comboActorIdsOf(skill);
  if (!skill || !combo) return battleSkillUseFailure(project, user, skillId);
  if (!combo.includes(user.recordId as ActorId)) return "notLearned";
  const own = battleSkillUseFailure(project, user, skillId, { requireLearned: false });
  if (own) return own;
  const members = combo.map((actorId) => party.find((entry) => entry.recordId === actorId));
  if (members.some((member) => !member || member.hp <= 0)) return "comboPartnerAbsent";
  for (const member of members) {
    if (!member || member.recordId === user.recordId) continue;
    if (!member.ready || !canBattlerAct(project, member) || stateBlocksSkillUse(project, member)) return "comboPartnerNotReady";
    if (member.mp < battleSkillMpCost(skill, member.maxMp)) return "comboPartnerMp";
  }
  return undefined;
}

/**
 * 이 배우가 시전할 수 있는 연계기 — 연계 멤버이고 동료 전원이 참전 중인 것만(동료가 전투에 없으면 목록에서 숨긴다).
 * 이미 배운 목록(known)에 있는 id 는 뺀다.
 */
export function comboSkillIdsFor(project: Project, actorRecordId: string, partyRecordIds: readonly string[], known: readonly SkillId[] = []): SkillId[] {
  return project.database.skills
    .filter((skill) => {
      const combo = comboActorIdsOf(skill);
      return combo !== undefined && combo.includes(actorRecordId as ActorId) && combo.every((id) => partyRecordIds.includes(id)) && !known.includes(skill.id);
    })
    .map((skill) => skill.id);
}

/** 스냅샷의 참전 배우를 연계 참가자로. 게이지는 strict 에서도 미행동 배우만 100 이다. */
export function comboParticipantsFromSnapshot(snapshot: Pick<BattleSnapshot, "actors">): BattleComboParticipant[] {
  return snapshot.actors.map((actor) => ({
    recordId: actor.recordId, hp: actor.hp, mp: actor.mp, maxMp: actor.maxMp, stateIds: actor.stateIds, ready: actor.gauge >= 100,
  }));
}

/** Includes the casting round; end-of-round decrement leaves N subsequent blocked rounds. */
export function startBattleSkillCooldown(user: Pick<MutableBattler, "skillCooldowns">, skill: SkillRecord): void {
  if ((skill.cooldownTurns ?? 0) > 0) (user.skillCooldowns ??= {})[skill.id] = skill.cooldownTurns! + 1;
}
export function advanceBattleSkillCooldowns(battlers: readonly Pick<MutableBattler, "skillCooldowns">[]): void {
  for (const battler of battlers) for (const id of Object.keys(battler.skillCooldowns ?? {})) {
    const remaining = battler.skillCooldowns![id] - 1;
    if (remaining > 0) battler.skillCooldowns![id] = remaining;
    else delete battler.skillCooldowns![id];
  }
}
