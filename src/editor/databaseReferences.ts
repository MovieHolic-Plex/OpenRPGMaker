import { commandsReference, commandsResourceReference, switchVariableReferencedInProject } from "@/editor/databaseCommandReferences";
import type { DatabaseCollection } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { ItemRecord, SkillRecord } from "@/project/types";

export function databaseReferenceMessage(collection: DatabaseCollection, id: string): string | null {
  const project = store.getCurrent();
  switch (collection) {
    case "skills":
      if (project.database.actors.some((record) => record.learnedSkills.some((skill) => skill.skillId === id))) return "주인공이 이 스킬을 사용 중입니다.";
      if (project.database.classes.some((record) => record.learnedSkills.some((skill) => skill.skillId === id))) return "직업이 이 스킬을 사용 중입니다.";
      if (project.database.items.some((record) => record.skillId === id)) return "아이템이 이 스킬을 사용 중입니다.";
      if (project.database.equipment.some((record) => record.skillId === id || record.usableAsItemSkillId === id)) return "장비가 이 스킬을 사용 중입니다.";
      if (project.database.enemies.some((record) => record.actions.some((action) => action.skillId === id))) return "몬스터가 이 스킬을 사용 중입니다.";
      if (commandsReference(project, "skills", id)) return "이벤트 명령이 이 스킬을 사용 중입니다.";
      return null;
    case "enemies":
      if (project.database.troops.some((record) => record.enemyIds.includes(id) || record.members?.some((member) => member.enemyId === id))) return "적 그룹이 이 몬스터를 사용 중입니다.";
      if (commandsReference(project, "enemies", id)) return "이벤트/전투 조건이 이 몬스터를 사용 중입니다.";
      return null;
    case "actors":
      if (project.system.startActorIds.includes(id)) return "시스템 시작 파티가 이 주인공을 사용 중입니다.";
      if (project.session.partyActorIds.includes(id)) return "현재 파티가 이 주인공을 사용 중입니다.";
      if (commandsReference(project, "actors", id)) return "이벤트 명령/조건이 이 주인공을 사용 중입니다.";
      return null;
    case "classes":
      if (project.database.actors.some((record) => record.classId === id)) return "주인공이 이 직업을 사용 중입니다.";
      if (project.database.equipment.some((record) => record.equippableClassIds.includes(id))) return "장비가 이 직업을 사용 중입니다.";
      return null;
    case "equipment":
      if (project.database.actors.some((record) => Object.values(record.initialEquipment).includes(id))) return "주인공이 이 장비를 사용 중입니다.";
      if (project.database.classes.some((record) => record.equipmentPermissions.equipmentIds.includes(id))) return "직업이 이 장비를 사용 중입니다.";
      if (commandsReference(project, "equipment", id)) return "이벤트 명령이 이 장비를 사용 중입니다.";
      return null;
    case "battleAnimations":
      if (project.database.skills.some((record) => record.animationId === id)) return "스킬이 이 전투 애니메이션을 사용 중입니다.";
      if (project.database.items.some((record) => record.animationId === id)) return "아이템이 이 전투 애니메이션을 사용 중입니다.";
      return null;
    case "troops":
      if (project.system.initialTroopId === id) return "시스템 기본 전투가 이 적 그룹을 사용 중입니다.";
      if (commandsReference(project, "troops", id)) return "이벤트 명령이 이 적 그룹을 사용 중입니다.";
      return null;
    case "items":
      if (project.database.enemies.some((record) => record.rewards.dropItemId === id)) return "몬스터 보상이 이 아이템을 사용 중입니다.";
      if (commandsReference(project, "items", id)) return "이벤트 명령이 이 아이템을 사용 중입니다.";
      return null;
    case "states":
      if (project.database.items.some((record) => record.stateEffects.some((effect) => effect.stateId === id))) return "아이템이 이 상태를 사용 중입니다.";
      if (project.database.equipment.some((record) => record.stateInflictIds.includes(id))) return "장비가 이 상태를 사용 중입니다.";
      return null;
  }
}

export function resourceReferenceMessage(resourceId: string): string | null {
  const project = store.getCurrent();
  if (project.database.actors.some((record) => record.faceResourceId === resourceId || record.characterResourceId === resourceId || record.battleCharacterResourceId === resourceId)) return "주인공이 이 리소스를 사용 중입니다.";
  if (project.database.items.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)) return "아이템이 이 리소스를 사용 중입니다.";
  if (project.database.equipment.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)) return "장비가 이 리소스를 사용 중입니다.";
  if (project.database.enemies.some((record) => record.monsterResourceId === resourceId)) return "몬스터가 이 리소스를 사용 중입니다.";
  if (project.database.troops.some((record) => record.previewBackgroundResourceId === resourceId)) return "적 그룹이 이 리소스를 사용 중입니다.";
  if (project.database.battleAnimations.some((record) => record.resourceId === resourceId)) return "전투 애니메이션이 이 리소스를 사용 중입니다.";
  if (project.system.titleResourceId === resourceId || project.system.systemResourceId === resourceId || project.system.battleSystemResourceId === resourceId) return "시스템 설정이 이 리소스를 사용 중입니다.";
  if (commandsResourceReference(project, resourceId)) return "이벤트 명령이 이 리소스를 사용 중입니다.";
  return null;
}

export function switchVariableReferenceMessage(kind: "switch" | "variable", id: string): string | null {
  const project = store.getCurrent();
  if (!switchVariableReferencedInProject(project, kind, id)) return null;
  return kind === "switch" ? "이벤트/조건이 이 스위치를 사용 중입니다." : "이벤트/조건이 이 변수를 사용 중입니다.";
}

export function databaseRecordPrefix(collection: DatabaseCollection): string {
  switch (collection) {
    case "actors": return "actor";
    case "classes": return "class";
    case "skills": return "skill";
    case "items": return "item";
    case "equipment": return "equip";
    case "enemies": return "enemy";
    case "troops": return "troop";
    case "states": return "state";
    case "battleAnimations": return "anim";
  }
}

export function isSkillScope(value: unknown): value is SkillRecord["scope"] {
  return value === "self" || value === "ally" || value === "enemy" || value === "allEnemies";
}

export function isItemScope(value: unknown): value is ItemRecord["scope"] {
  return value === "none" || value === "ally" || value === "allAllies" || value === "enemy";
}
