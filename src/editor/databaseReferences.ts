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
    return "주인공이 이 리소스를 사용 중입니다.";
  }
  if (project.database.items.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)) {
    return "아이템이 이 리소스를 사용 중입니다.";
  }
  if (
    project.database.equipment.some((record) => record.imageResourceId === resourceId || record.iconResourceId === resourceId)
  ) {
    return "장비가 이 리소스를 사용 중입니다.";
  }
  if (project.database.enemies.some((record) => record.monsterResourceId === resourceId)) return "몬스터가 이 리소스를 사용 중입니다.";
  if (project.database.troops.some((record) => record.previewBackgroundResourceId === resourceId)) {
    return "적 그룹이 이 리소스를 사용 중입니다.";
  }
  if (project.database.battleAnimations.some((record) => record.resourceId === resourceId)) {
    return "전투 애니메이션이 이 리소스를 사용 중입니다.";
  }
  if (
    project.system.titleResourceId === resourceId ||
    project.system.systemResourceId === resourceId ||
    project.system.battleSystemResourceId === resourceId
  ) {
    return "시스템 설정이 이 리소스를 사용 중입니다.";
  }
  if (commandsResourceReference(project, resourceId)) return "이벤트 명령이 이 리소스를 사용 중입니다.";
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
      return (
        commandListReferences(command.then, collection, id) ||
        commandListReferences(command.else ?? [], collection, id)
      );
    case "loop":
      return commandListReferences(command.body, collection, id);
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

// 스위치/변수 삭제 시 참조 경고. DatabaseCollection(switches/variables 제외)과 별도.
// 이벤트 명령, fork 조건, 페이지 출현 조건, 배틀 이벤트 조건을 모두 순회한다.
export function switchVariableReferenceMessage(kind: "switch" | "variable", id: string): string | null {
  const project = store.getCurrent();
  const used = switchVariableReferencedInProject(project, kind, id);
  if (used) return kind === "switch" ? "이벤트/조건이 이 스위치를 사용 중입니다." : "이벤트/조건이 이 변수를 사용 중입니다.";
  return null;
}

function switchVariableReferencedInProject(project: Project, kind: "switch" | "variable", id: string): boolean {
  const commonEvents = project.commonEvents.some((event) => commandListReferencesSwitchVariable(event.commands, kind, id));
  const mapEvents = Object.values(project.maps).some((map) =>
    map.events.some((event) =>
      conditionReferencesSwitchVariable(event.condition, kind, id) ||
      commandListReferencesSwitchVariable(event.commands, kind, id) ||
      (event.pages ?? []).some(
        (page) =>
          page.conditions.some((condition) => conditionReferencesSwitchVariable(condition, kind, id)) ||
          commandListReferencesSwitchVariable(page.commands, kind, id)
      )
    )
  );
  const troopEvents = project.database.troops.some((troop) =>
    troop.battleEventPages.some(
      (page) =>
        page.conditions.some((condition) => conditionReferencesSwitchVariable(condition, kind, id)) ||
        commandListReferencesSwitchVariable(page.commands, kind, id)
    )
  );
  return commonEvents || mapEvents || troopEvents;
}

function commandListReferencesSwitchVariable(commands: readonly Command[], kind: "switch" | "variable", id: string): boolean {
  return commands.some((command) => commandReferencesSwitchVariable(command, kind, id));
}

function commandReferencesSwitchVariable(command: Command, kind: "switch" | "variable", id: string): boolean {
  switch (command.kind) {
    case "choices":
      return command.options.some((option) => commandListReferencesSwitchVariable(option.branch, kind, id));
    case "fork":
      return (
        conditionReferencesSwitchVariable(command.condition, kind, id) ||
        commandListReferencesSwitchVariable(command.then, kind, id) ||
        commandListReferencesSwitchVariable(command.else ?? [], kind, id)
      );
    case "loop":
      return commandListReferencesSwitchVariable(command.body, kind, id);
    case "setSwitch":
      return kind === "switch" && command.switchId === id;
    case "setVariable":
      return kind === "variable" && command.variableId === id;
    default:
      return false;
  }
}

// 조건이 스위치/변수 id를 참조하는지 검사. Condition/EventPageCondition/BattleEventCondition
// 모두 허용(구조적 kind 검사). switch/variable 외 조건은 false.
function conditionReferencesSwitchVariable(
  condition: { kind: string } | undefined,
  kind: "switch" | "variable",
  id: string
): boolean {
  if (!condition) return false;
  if (condition.kind === "switch") return kind === "switch" && (condition as unknown as { switchId: string }).switchId === id;
  if (condition.kind === "variable") return kind === "variable" && (condition as unknown as { variableId: string }).variableId === id;
  return false;
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
  return value === "none" || value === "ally" || value === "allAllies" || value === "enemy";
}
