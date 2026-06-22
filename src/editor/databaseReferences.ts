import { store } from "@/project/store";
import type { DatabaseCollection } from "@/editor/databaseActions";
import type { Command, ItemRecord, Project, SkillRecord } from "@/project/types";

export function databaseReferenceMessage(collection: DatabaseCollection, id: string): string | null {
  const project = store.getCurrent();
  switch (collection) {
    case "skills":
      if (project.database.actors.some((record) => record.learnedSkills.some((skill) => skill.skillId === id))) {
        return "주인공이 이 스킬을 사용 중입니다.";
      }
      if (project.database.classes.some((record) => record.learnedSkills.some((skill) => skill.skillId === id))) {
        return "직업이 이 스킬을 사용 중입니다.";
      }
      if (project.database.items.some((record) => record.skillId === id)) return "아이템이 이 스킬을 사용 중입니다.";
      if (project.database.equipment.some((record) => record.skillId === id || record.usableAsItemSkillId === id)) {
        return "장비가 이 스킬을 사용 중입니다.";
      }
      if (project.database.enemies.some((record) => record.actions.some((action) => action.skillId === id))) {
        return "몬스터가 이 스킬을 사용 중입니다.";
      }
      if (commandsReference(project, "skills", id)) return "이벤트 명령이 이 스킬을 사용 중입니다.";
      return null;
    case "enemies":
      if (project.database.troops.some((record) => record.enemyIds.includes(id) || record.members?.some((member) => member.enemyId === id))) {
        return "적 그룹이 이 몬스터를 사용 중입니다.";
      }
      return null;
    case "actors":
      if (project.system.startActorIds.includes(id)) return "시스템 시작 파티가 이 주인공을 사용 중입니다.";
      if (project.session.partyActorIds.includes(id)) return "현재 파티가 이 주인공을 사용 중입니다.";
      return null;
    case "classes":
      if (project.database.actors.some((record) => record.classId === id)) return "주인공이 이 직업을 사용 중입니다.";
      if (project.database.equipment.some((record) => record.equippableClassIds.includes(id))) return "장비가 이 직업을 사용 중입니다.";
      return null;
    case "equipment":
      if (project.database.actors.some((record) => Object.values(record.initialEquipment).includes(id))) {
        return "주인공이 이 장비를 사용 중입니다.";
      }
      if (project.database.classes.some((record) => record.equipmentPermissions.equipmentIds.includes(id))) {
        return "직업이 이 장비를 사용 중입니다.";
      }
      return null;
    case "battleAnimations":
      if (project.database.skills.some((record) => record.animationId === id)) return "스킬이 이 전투 애니메이션을 사용 중입니다.";
      if (project.database.items.some((record) => record.animationId === id)) return "아이템이 이 전투 애니메이션을 사용 중입니다.";
      return null;
    case "troops":
      if (project.system.initialTroopId === id) return "시스템 기본 전투가 이 적 그룹을 사용 중입니다.";
      return null;
    case "items":
      if (project.database.enemies.some((record) => record.rewards.dropItemId === id)) return "몬스터 보상이 이 아이템을 사용 중입니다.";
      if (commandsReference(project, "items", id)) return "이벤트 명령이 이 아이템을 사용 중입니다.";
      return null;
    case "states":
      if (project.database.items.some((record) => record.stateEffects.some((effect) => effect.stateId === id))) {
        return "아이템이 이 상태를 사용 중입니다.";
      }
      if (project.database.equipment.some((record) => record.stateInflictIds.includes(id))) return "장비가 이 상태를 사용 중입니다.";
      return null;
  }
}

export function resourceReferenceMessage(resourceId: string): string | null {
  const project = store.getCurrent();
  if (
    project.database.actors.some(
      (record) =>
        record.faceResourceId === resourceId ||
        record.characterResourceId === resourceId ||
        record.battleCharacterResourceId === resourceId
    )
  ) {
    return "actor resource is in use.";
  }
  if (project.database.items.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)) {
    return "item resource is in use.";
  }
  if (
    project.database.equipment.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)
  ) {
    return "equipment resource is in use.";
  }
  if (project.database.enemies.some((record) => record.monsterResourceId === resourceId)) return "enemy resource is in use.";
  if (project.database.troops.some((record) => record.previewBackgroundResourceId === resourceId)) {
    return "troop resource is in use.";
  }
  if (project.database.battleAnimations.some((record) => record.resourceId === resourceId)) {
    return "battle animation resource is in use.";
  }
  if (
    project.system.titleResourceId === resourceId ||
    project.system.systemResourceId === resourceId ||
    project.system.battleSystemResourceId === resourceId
  ) {
    return "system resource is in use.";
  }
  if (commandsResourceReference(project, resourceId)) return "event command resource is in use.";
  return null;
}

function commandsReference(project: Project, collection: DatabaseCollection, id: string): boolean {
  const commonEventCommands = project.commonEvents.some((event) => commandListReferences(event.commands, collection, id));
  const mapEventCommands = Object.values(project.maps).some((map) =>
    map.events.some((event) =>
      commandListReferences(event.commands, collection, id) ||
      (event.pages ?? []).some((page) => commandListReferences(page.commands, collection, id))
    )
  );
  const troopCommands = project.database.troops.some((troop) =>
    troop.battleEventPages.some((page) => commandListReferences(page.commands, collection, id))
  );
  return commonEventCommands || mapEventCommands || troopCommands;
}

function commandsResourceReference(project: Project, resourceId: string): boolean {
  const commonEventCommands = project.commonEvents.some((event) => commandListResourceReferences(event.commands, resourceId));
  const mapEventCommands = Object.values(project.maps).some((map) =>
    map.events.some((event) =>
      event.sprite?.id === resourceId ||
      commandListResourceReferences(event.commands, resourceId) ||
      (event.pages ?? []).some(
        (page) => page.graphic.sprite?.id === resourceId || commandListResourceReferences(page.commands, resourceId)
      )
    )
  );
  const troopCommands = project.database.troops.some((troop) =>
    troop.battleEventPages.some((page) => commandListResourceReferences(page.commands, resourceId))
  );
  return commonEventCommands || mapEventCommands || troopCommands;
}

function commandListReferences(commands: readonly Command[], collection: DatabaseCollection, id: string): boolean {
  return commands.some((command) => commandReferences(command, collection, id));
}

function commandListResourceReferences(commands: readonly Command[], resourceId: string): boolean {
  return commands.some((command) => commandResourceReferences(command, resourceId));
}

function commandReferences(command: Command, collection: DatabaseCollection, id: string): boolean {
  switch (command.kind) {
    case "choices":
      return command.options.some((option) => commandListReferences(option.branch, collection, id));
    case "fork":
      return commandListReferences(command.then, collection, id) || commandListReferences(command.else ?? [], collection, id);
    case "shop":
      return collection === "items" && command.itemIds.includes(id);
    case "learnSkill":
      return collection === "skills" && command.skillId === id;
    case "battleProcessing":
      return collection === "troops" && command.troopId === id;
    default:
      return false;
  }
}

function commandResourceReferences(command: Command, resourceId: string): boolean {
  switch (command.kind) {
    case "choices":
      return command.options.some((option) => commandListResourceReferences(option.branch, resourceId));
    case "fork":
      return commandListResourceReferences(command.then, resourceId) || commandListResourceReferences(command.else ?? [], resourceId);
    case "showPicture":
    case "playAudio":
      return command.resourceId === resourceId;
    default:
      return false;
  }
}

export function databaseRecordPrefix(collection: DatabaseCollection): string {
  switch (collection) {
    case "actors":
      return "actor";
    case "classes":
      return "class";
    case "skills":
      return "skill";
    case "items":
      return "item";
    case "equipment":
      return "equip";
    case "enemies":
      return "enemy";
    case "troops":
      return "troop";
    case "states":
      return "state";
    case "battleAnimations":
      return "anim";
  }
}

export function isSkillScope(value: unknown): value is SkillRecord["scope"] {
  return value === "self" || value === "ally" || value === "enemy" || value === "allEnemies";
}

export function isItemScope(value: unknown): value is ItemRecord["scope"] {
  return value === "none" || value === "ally" || value === "enemy";
}
