// project/partySkills.ts
// 「지금 파티가 아는 스킬 전부」 — 필드 스킬 게이트(이벤트 조건 partyKnowsSkill, 장면 시험 useFieldSkill, 자동 플레이 도달성)의 단일 해석기.
//
// 아는 스킬 = 파티 배우마다 (배운 actorSkillIds + 배우·직업 레벨 습득 + 성장 트리 효과 + 장착 장비가 주는 스킬/명령 스킬)
//          + 몬스터 파티 인스턴스의 기술(monsterSkillIds: 명시 skillIds, 없으면 종 학습표의 최신 네 기술).
// 프로젝트가 있어야 직업·레벨·학습표가 풀리므로 순수 조건 평가기(conditionActorQueries)는 이 함수를 지연 호출 함수로 받는다.
import { effectiveActorEquipment } from "@/project/equipmentRules";
import { effectiveActorClassId } from "@/project/growth/lineage";
import { actorOwnedSkillIds, type GrowthSession } from "@/project/growth/runtime";
import { monsterSkillIds } from "@/project/monsterCollection";
import type { MonsterInstance } from "@/project/session";
import type { Project } from "@/project/types";

/** 파티 판정에 쓰는 세션 조각. PlaySession·PlaySessionLike 가 구조적으로 만족한다. */
export type PartySkillSession = GrowthSession & {
  readonly partyActorIds: readonly string[];
  readonly actorEquipment?: Readonly<Record<string, Readonly<Partial<Record<string, string>>>>>;
  readonly monsterParty?: readonly string[];
  readonly monsterInstances?: Readonly<Record<string, MonsterInstance>>;
};

/** 배우 한 명이 아는 스킬(장비 부여 포함). */
export function actorKnownSkillIds(project: Project, session: PartySkillSession, actorId: string): Set<string> {
  const ids = new Set(actorOwnedSkillIds(project, session, actorId));
  const record = project.database.actors.find((actor) => actor.id === actorId);
  if (!record) return ids;
  const equipment = effectiveActorEquipment(project, record, session.actorEquipment?.[actorId], effectiveActorClassId(project, session, actorId));
  for (const equipmentId of Object.values(equipment)) {
    if (!equipmentId) continue;
    const item = project.database.equipment.find((entry) => entry.id === equipmentId);
    if (!item) continue;
    for (const skillId of item.grantsSkillIds ?? []) ids.add(skillId);
    if (item.grantsCommand?.skillId) ids.add(item.grantsCommand.skillId);
  }
  return ids;
}

/** 파티 전체(배우 + 몬스터 파티)가 아는 스킬. */
export function partyKnownSkillIds(project: Project, session: PartySkillSession): Set<string> {
  const ids = new Set<string>();
  for (const actorId of session.partyActorIds) for (const skillId of actorKnownSkillIds(project, session, actorId)) ids.add(skillId);
  for (const instanceId of session.monsterParty ?? []) {
    for (const skillId of monsterSkillIds(project, session.monsterInstances?.[instanceId])) ids.add(skillId);
  }
  return ids;
}

/** 조건 평가 문맥에 끼울 지연 해석기 — 프로젝트의 database 가 없으면(부분 프로젝트) 세션에 적힌 스킬만 본다. */
export function partySkillContext(project: object | undefined, session: PartySkillSession): { readonly partySkillIds?: () => ReadonlySet<string> } {
  if (!project || !(project as { database?: unknown }).database) return {};
  return { partySkillIds: () => partyKnownSkillIds(project as Project, session) };
}

/** 이 스킬을 아는 파티 구성원(배우 id 또는 몬스터 인스턴스 id) — useFieldSkill 이 누가 쓸지 고를 때 쓴다. */
export function partyMembersKnowingSkill(project: Project, session: PartySkillSession, skillId: string): Array<{ readonly kind: "actor" | "monster"; readonly id: string }> {
  const out: Array<{ kind: "actor" | "monster"; id: string }> = [];
  for (const actorId of session.partyActorIds) if (actorKnownSkillIds(project, session, actorId).has(skillId)) out.push({ kind: "actor", id: actorId });
  for (const instanceId of session.monsterParty ?? []) if (monsterSkillIds(project, session.monsterInstances?.[instanceId]).includes(skillId)) out.push({ kind: "monster", id: instanceId });
  return out;
}
