import type { Command, Project } from "../types";
import { assert } from "./guards";
import {
  validateBattleEventPages,
  validateCommands,
  validateCondition,
  validateEventPages,
  type ReferenceContext,
} from "./commandReferenceValidation";
import {
  collectResourceIds,
  validateActorResources,
  validateAnimationResource,
  validateBattlerAnimationResources,
  validateEnemyResources,
  validateEquipmentResources,
  validateItemResources,
  validateOptionalResource,
  validateSystemResources,
} from "./resourceReferenceValidation";

export function validateProjectReferences(project: Project): void {
  const issues = collectProjectReferenceIssues(project);
  assert(issues.length === 0, issues.join("\n"));
}

export function collectProjectReferenceIssues(project: Project): string[] {
  const issues: string[] = [];
  const check = (fn: () => void): void => {
    try {
      fn();
    } catch (cause) {
      issues.push(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const switchIds = new Set(project.switches.map((record) => record.id));
  const variableIds = new Set(project.variables.map((record) => record.id));
  const actorIds = new Set(project.database.actors.map((record) => record.id));
  const classIds = new Set(project.database.classes.map((record) => record.id));
  const skillIds = new Set(project.database.skills.map((record) => record.id));
  const itemIds = new Set(project.database.items.map((record) => record.id));
  const enemyIds = new Set(project.database.enemies.map((record) => record.id));
  const equipmentIds = new Set(project.database.equipment.map((record) => record.id));
  const troopIds = new Set(project.database.troops.map((record) => record.id));
  const animationIds = new Set(project.database.battleAnimations.map((record) => record.id));
  const commonEventIds = new Set(project.commonEvents.map((record) => record.id));
  const mapIds = new Set(Object.keys(project.maps));
  const resourceIds = collectResourceIds(project);
  const context: ReferenceContext = {
    actorIds,
    enemyIds,
    itemIds,
    equipmentIds,
    skillIds,
    switchIds,
    variableIds,
    commonEventIds,
    mapIds,
    troopIds,
    resourceIds,
  };

  validateActorRecords(project, classIds, animationIds, context, issues);
  validateClassRecords(project, classIds, actorIds, skillIds, equipmentIds, animationIds, issues);
  validateSkillRecords(project, skillIds, animationIds, context, issues);
  validateItemRecords(project, actorIds, classIds, skillIds, animationIds, resourceIds, issues);
  validateEquipmentRecords(project, actorIds, classIds, skillIds, resourceIds, issues);
  validateEnemyRecords(project, itemIds, skillIds, resourceIds, context.switchIds, issues);
  validateTroopRecords(project, enemyIds, context, issues);
  for (const animation of project.database.battleAnimations) check(() => validateAnimationResource(animation, resourceIds));
  for (const animation of project.database.battlerAnimations ?? []) check(() => validateBattlerAnimationResources(animation, resourceIds));
  for (const terrain of project.database.terrains ?? []) {
    check(() => validateOptionalResource(`terrain ${terrain.id}: battleBackgroundResourceId`, terrain.battleBackgroundResourceId, resourceIds));
    check(() => validateOptionalResource(`terrain ${terrain.id}: footstepSoundResourceId`, terrain.footstepSoundResourceId, resourceIds));
  }

  collectExistingIdIssues("system.startActorIds", project.system.startActorIds, actorIds, issues);
  if (project.system.initialTroopId && !troopIds.has(project.system.initialTroopId)) issues.push("system.initialTroopId does not exist.");
  check(() => validateSystemResources(project.system, resourceIds));
  collectExistingIdIssues("session.partyActorIds", project.session.partyActorIds, actorIds, issues);
  validateMapConnections(project, mapIds, issues);
  validateCommonEvents(project, switchIds, context, issues);
  validateMapRecords(project, switchIds, variableIds, resourceIds, context, issues);
  return issues;
}

export function repairProjectReferences(project: Project): void {
  const mapIds = new Set(Object.keys(project.maps));
  const animationIds = new Set(project.database.battleAnimations.map((record) => record.id));
  const commonEventIds = new Set(project.commonEvents.map((record) => record.id));
  project.mapConnections = (project.mapConnections ?? []).filter((connection) => mapIds.has(connection.from.mapId) && mapIds.has(connection.to.mapId));
  for (const actor of project.database.actors) {
    if (actor.unarmedAnimationId && !animationIds.has(actor.unarmedAnimationId)) delete actor.unarmedAnimationId;
  }
  for (const klass of project.database.classes) {
    if (klass.animationId && !animationIds.has(klass.animationId)) delete klass.animationId;
  }
  // 삭제/미생성 맵을 가리키는 transfer·changeTile 과 생활 이동 목적지는 로드를 벽돌내는 대신
  // 여기서 정리한다 — AI가 만들다 만 맵 참조가 저장본에 남아 프로젝트 전체가 열리지 않던 사고의 재발 방지.
  const prune = new PruneStats();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      event.commands = pruneDanglingCommandRefs(event.commands, commonEventIds, mapIds, prune);
      for (const page of event.pages ?? []) {
        page.commands = pruneDanglingCommandRefs(page.commands, commonEventIds, mapIds, prune);
        repairLivingDestinations(page, mapIds, prune);
      }
    }
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) page.commands = pruneDanglingCommandRefs(page.commands, commonEventIds, mapIds, prune);
  }
  for (const commonEvent of project.commonEvents) {
    commonEvent.commands = pruneDanglingCommandRefs(commonEvent.commands, commonEventIds, mapIds, prune);
  }
  prune.warnIfAny();
}

class PruneStats {
  removedMapCommands = 0;
  removedLivingDestinations = 0;
  removedCommonEventCalls = 0;

  warnIfAny(): void {
    const total = this.removedMapCommands + this.removedLivingDestinations + this.removedCommonEventCalls;
    if (total === 0 || typeof console === "undefined") return;
    console.warn(
      `[project] 깨진 참조 ${total}건을 정리하고 로드했습니다 — ` +
        `존재하지 않는 맵으로의 이동/타일변경 ${this.removedMapCommands}건, ` +
        `생활 이동 목적지 ${this.removedLivingDestinations}건, ` +
        `공통 이벤트 호출 ${this.removedCommonEventCalls}건`
    );
  }
}

function repairLivingDestinations(
  page: { movement: { type: string; living?: { destinations: { mapId: string }[] } } },
  mapIds: ReadonlySet<string>,
  stats: PruneStats
): void {
  const living = page.movement.living;
  if (!living) return;
  const kept = living.destinations.filter((destination) => mapIds.has(destination.mapId));
  stats.removedLivingDestinations += living.destinations.length - kept.length;
  living.destinations = kept;
  // 목적지가 모두 사라진 생활 이동은 제자리로 강등(빈 목적지 순회 방지 — mapDeletion과 동일 정책).
  if (kept.length === 0 && page.movement.type === "living") {
    page.movement.type = "fixed";
    delete page.movement.living;
  }
}

function validateMapConnections(project: Project, mapIds: ReadonlySet<string>, issues: string[]): void {
  for (const connection of project.mapConnections ?? []) {
    if (!mapIds.has(connection.from.mapId)) issues.push(`mapConnection ${connection.id}: from.mapId does not exist.`);
    if (!mapIds.has(connection.to.mapId)) issues.push(`mapConnection ${connection.id}: to.mapId does not exist.`);
  }
}

function validateActorRecords(
  project: Project,
  classIds: ReadonlySet<string>,
  animationIds: ReadonlySet<string>,
  context: ReferenceContext,
  issues: string[]
): void {
  for (const actor of project.database.actors) {
    if (!classIds.has(actor.classId)) issues.push(`actor ${actor.id}: classId does not exist.`);
    collectExistingIdIssues(`actor ${actor.id}: skill`, actor.learnedSkills.map((entry) => entry.skillId), context.skillIds, issues);
    validateActorEquipment(actor.id, actor.initialEquipment, context.equipmentIds, issues);
    if (actor.unarmedAnimationId && !animationIds.has(actor.unarmedAnimationId)) issues.push(`actor ${actor.id}: unarmedAnimationId does not exist.`);
    capture(issues, () => validateActorResources(actor, context.resourceIds));
  }
}

function validateClassRecords(
  project: Project,
  classIds: ReadonlySet<string>,
  actorIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  equipmentIds: ReadonlySet<string>,
  animationIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const klass of project.database.classes) {
    if (klass.animationId && !animationIds.has(klass.animationId)) issues.push(`class ${klass.id}: animationId does not exist.`);
    collectExistingIdIssues(`class ${klass.id}: skill`, klass.learnedSkills.map((entry) => entry.skillId), skillIds, issues);
    collectExistingIdIssues(`class ${klass.id}: equipment`, klass.equipmentPermissions.equipmentIds, equipmentIds, issues);
    collectExistingIdIssues(`class ${klass.id}: equipment actor`, klass.equipmentPermissions.actorIds, actorIds, issues);
    collectExistingIdIssues(`class ${klass.id}: equipment class`, klass.equipmentPermissions.classIds, classIds, issues);
  }
}

function validateSkillRecords(project: Project, skillIds: ReadonlySet<string>, animationIds: ReadonlySet<string>, context: ReferenceContext, issues: string[]): void {
  for (const skill of project.database.skills) {
    if (skill.animationId && !animationIds.has(skill.animationId)) issues.push(`skill ${skill.id}: animationId does not exist.`);
    if (skill.elementId && !elementIdExists(project, skill.elementId)) issues.push(`skill ${skill.id}: elementId does not exist.`);
    for (const effect of skill.stateEffects ?? []) if (!stateIdExists(project, effect.stateId)) issues.push(`skill ${skill.id}: stateId does not exist.`);
    if (skill.effect.kind === "switch" && skill.effect.switchId && !context.switchIds.has(skill.effect.switchId)) issues.push(`skill ${skill.id}: switchId does not exist.`);
  }
  void skillIds;
}

function validateItemRecords(
  project: Project,
  actorIds: ReadonlySet<string>,
  classIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  animationIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const item of project.database.items) {
    if (item.skillId && !skillIds.has(item.skillId)) issues.push(`item ${item.id}: skillId does not exist.`);
    if (item.learnedSkillId && !skillIds.has(item.learnedSkillId)) issues.push(`item ${item.id}: learnedSkillId does not exist.`);
    if (item.activateSkillId && !skillIds.has(item.activateSkillId)) issues.push(`item ${item.id}: activateSkillId does not exist.`);
    if (item.animationId && !animationIds.has(item.animationId)) issues.push(`item ${item.id}: animationId does not exist.`);
    capture(issues, () => validateItemResources(item, resourceIds));
    for (const effect of item.stateEffects) if (!stateIdExists(project, effect.stateId)) issues.push(`item ${item.id}: stateId does not exist.`);
    collectExistingIdIssues(`item ${item.id}: healState`, item.healStateIds, stateIds(project), issues);
    collectExistingIdIssues(`item ${item.id}: usableActor`, item.usableActorIds, actorIds, issues);
    collectExistingIdIssues(`item ${item.id}: usableClass`, item.usableClassIds, classIds, issues);
    collectExistingIdIssues(`item ${item.id}: equipment class`, item.equipmentProfile.equippableClassIds, classIds, issues);
    collectExistingIdIssues(`item ${item.id}: equipment actor`, item.equipmentProfile.equippableActorIds, actorIds, issues);
    collectExistingIdIssues(`item ${item.id}: equipment state`, [...item.equipmentProfile.stateInflictIds, ...item.equipmentProfile.stateDefenseIds], stateIds(project), issues);
    collectExistingIdIssues(`item ${item.id}: equipment element`, [...item.equipmentProfile.attackElementIds, ...item.equipmentProfile.elementalDefenseIds], elementIds(project), issues);
  }
}

function validateEquipmentRecords(
  project: Project,
  actorIds: ReadonlySet<string>,
  classIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const equipment of project.database.equipment) {
    if (equipment.skillId && !skillIds.has(equipment.skillId)) issues.push(`equipment ${equipment.id}: skillId does not exist.`);
    if (equipment.usableAsItemSkillId && !skillIds.has(equipment.usableAsItemSkillId)) issues.push(`equipment ${equipment.id}: usableAsItemSkillId does not exist.`);
    capture(issues, () => validateEquipmentResources(equipment, resourceIds));
    collectExistingIdIssues(`equipment ${equipment.id}: actor`, equipment.equippableActorIds, actorIds, issues);
    collectExistingIdIssues(`equipment ${equipment.id}: class`, equipment.equippableClassIds, classIds, issues);
    collectExistingIdIssues(`equipment ${equipment.id}: state`, equipment.stateInflictIds, stateIds(project), issues);
  }
}

function validateEnemyRecords(
  project: Project,
  itemIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  switchIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const enemy of project.database.enemies) {
    collectExistingIdIssues(`enemy ${enemy.id}: skill`, enemy.actions.map((entry) => entry.skillId), skillIds, issues);
    if (enemy.rewards.dropItemId && !itemIds.has(enemy.rewards.dropItemId)) issues.push(`enemy ${enemy.id}: dropItemId does not exist.`);
    for (const action of enemy.actions) {
      for (const effect of [action.switchOnAfterAction, action.switchOffAfterAction]) {
        if (effect.enabled && effect.switchId && !switchIds.has(effect.switchId)) issues.push(`enemy ${enemy.id}: action switchId does not exist.`);
      }
    }
    capture(issues, () => validateEnemyResources(enemy, resourceIds));
  }
}

function validateTroopRecords(project: Project, enemyIds: ReadonlySet<string>, context: ReferenceContext, issues: string[]): void {
  for (const troop of project.database.troops) {
    collectExistingIdIssues(`troop ${troop.id}: enemy`, troop.enemyIds, enemyIds, issues);
    if (troop.members) validateTroopMembers(troop.id, troop.members, enemyIds, issues);
    capture(issues, () => validateBattleEventPages(troop.battleEventPages, context));
  }
}

function validateCommonEvents(project: Project, switchIds: ReadonlySet<string>, context: ReferenceContext, issues: string[]): void {
  for (const commonEvent of project.commonEvents) {
    if (commonEvent.conditionSwitchId) {
      if (!switchIds.has(commonEvent.conditionSwitchId)) issues.push(`commonEvent ${commonEvent.id}: conditionSwitchId does not exist.`);
    }
    capture(issues, () => validateCommands(commonEvent.commands, context));
  }
}

function validateMapRecords(
  project: Project,
  switchIds: ReadonlySet<string>,
  variableIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  context: ReferenceContext,
  issues: string[]
): void {
  for (const map of Object.values(project.maps)) {
    if (project.tilesets[map.tilesetId] === undefined) issues.push(`map ${map.id}: tilesetId does not exist.`);
    for (const event of map.events) {
      capture(issues, () => validateOptionalResource(`event ${event.id}: sprite`, event.sprite?.id, resourceIds));
      const condition = event.condition;
      if (condition) capture(issues, () => validateCondition(condition, switchIds, variableIds));
      capture(issues, () => validateCommands(event.commands, context));
      capture(issues, () => validateEventPages(event.pages ?? [], context));
    }
  }
}

function validateTroopMembers(
  troopId: string,
  members: readonly { readonly enemyId: string }[],
  enemyIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const member of members) if (!enemyIds.has(member.enemyId)) issues.push(`troop ${troopId}: member enemyId does not exist: ${member.enemyId}`);
}

function validateActorEquipment(
  actorId: string,
  equipment: {
    readonly weapon?: string;
    readonly shield?: string;
    readonly armor?: string;
    readonly helmet?: string;
    readonly accessory?: string;
  },
  equipmentIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const id of Object.values(equipment)) {
    if (id && !equipmentIds.has(id)) issues.push(`actor ${actorId}: initialEquipment does not exist: ${id}`);
  }
}

function stateIdExists(project: Project, stateId: string): boolean {
  return stateId === "state_death" || project.database.states.some((state) => state.id === stateId);
}

function collectExistingIdIssues(label: string, ids: readonly string[], knownIds: ReadonlySet<string>, issues: string[]): void {
  for (const id of ids) if (!knownIds.has(id)) issues.push(`${label} does not exist: ${id}`);
}

function capture(issues: string[], fn: () => void): void {
  try {
    fn();
  } catch (cause) {
    issues.push(cause instanceof Error ? cause.message : String(cause));
  }
}

function stateIds(project: Project): ReadonlySet<string> {
  return new Set(["state_death", ...project.database.states.map((state) => state.id)]);
}

function elementIds(project: Project): ReadonlySet<string> {
  return new Set((project.database.elements ?? []).map((element) => element.id));
}

function elementIdExists(project: Project, elementId: string): boolean {
  return elementIds(project).has(elementId);
}

function pruneDanglingCommandRefs(
  commands: Command[],
  commonEventIds: ReadonlySet<string>,
  mapIds: ReadonlySet<string>,
  stats: PruneStats
): Command[] {
  const recurse = (branch: Command[]): Command[] => pruneDanglingCommandRefs(branch, commonEventIds, mapIds, stats);
  const pruned: Command[] = [];
  for (const command of commands) {
    if (command.kind === "callCommonEvent" && !commonEventIds.has(command.commonEventId)) {
      stats.removedCommonEventCalls += 1;
      continue;
    }
    if ((command.kind === "transfer" || command.kind === "changeTile") && !mapIds.has(command.mapId)) {
      stats.removedMapCommands += 1;
      continue;
    }
    if (command.kind === "choices") {
      pruned.push({
        ...command,
        options: command.options.map((option) => ({ ...option, branch: recurse(option.branch) })),
        cancelBranch: command.cancelBranch ? recurse(command.cancelBranch) : undefined,
      });
      continue;
    }
    if (command.kind === "fork") {
      pruned.push({ ...command, then: recurse(command.then), else: command.else ? recurse(command.else) : undefined });
      continue;
    }
    if (command.kind === "loop") {
      pruned.push({ ...command, body: recurse(command.body) });
      continue;
    }
    if (command.kind === "shop" && command.transactionBranch) {
      pruned.push({ ...command, transactionBranch: recurse(command.transactionBranch) });
      continue;
    }
    pruned.push(command);
  }
  return pruned;
}
