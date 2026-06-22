import type { Project } from "../types";
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
  validateEnemyResources,
  validateEquipmentResources,
  validateItemResources,
  validateOptionalResource,
  validateSystemResources,
} from "./resourceReferenceValidation";

export function validateProjectReferences(project: Project): void {
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

  validateActorRecords(project, classIds, animationIds, context);
  validateClassRecords(project, classIds, actorIds, skillIds, equipmentIds);
  validateSkillRecords(project, animationIds);
  validateItemRecords(project, skillIds, animationIds, resourceIds);
  validateEquipmentRecords(project, actorIds, classIds, skillIds, resourceIds);
  validateEnemyRecords(project, itemIds, skillIds, resourceIds);
  validateTroopRecords(project, enemyIds, context);
  for (const animation of project.database.battleAnimations) validateAnimationResource(animation, resourceIds);

  requireExistingIds("system.startActorIds", project.system.startActorIds, actorIds);
  if (project.system.initialTroopId) assert(troopIds.has(project.system.initialTroopId), "system.initialTroopId does not exist.");
  validateSystemResources(project.system, resourceIds);
  requireExistingIds("session.partyActorIds", project.session.partyActorIds, actorIds);
  validateCommonEvents(project, switchIds, context);
  validateMapRecords(project, switchIds, variableIds, resourceIds, context);
}

function validateActorRecords(
  project: Project,
  classIds: ReadonlySet<string>,
  animationIds: ReadonlySet<string>,
  context: ReferenceContext
): void {
  for (const actor of project.database.actors) {
    assert(classIds.has(actor.classId), `actor ${actor.id}: classId does not exist.`);
    requireExistingIds(`actor ${actor.id}: skill`, actor.learnedSkills.map((entry) => entry.skillId), context.skillIds);
    validateActorEquipment(actor.id, actor.initialEquipment, context.equipmentIds);
    if (actor.unarmedAnimationId) assert(animationIds.has(actor.unarmedAnimationId), `actor ${actor.id}: unarmedAnimationId does not exist.`);
    validateActorResources(actor, context.resourceIds);
  }
}

function validateClassRecords(
  project: Project,
  classIds: ReadonlySet<string>,
  actorIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  equipmentIds: ReadonlySet<string>
): void {
  for (const klass of project.database.classes) {
    requireExistingIds(`class ${klass.id}: skill`, klass.learnedSkills.map((entry) => entry.skillId), skillIds);
    requireExistingIds(`class ${klass.id}: equipment`, klass.equipmentPermissions.equipmentIds, equipmentIds);
    requireExistingIds(`class ${klass.id}: equipment actor`, klass.equipmentPermissions.actorIds, actorIds);
    requireExistingIds(`class ${klass.id}: equipment class`, klass.equipmentPermissions.classIds, classIds);
  }
}

function validateSkillRecords(project: Project, animationIds: ReadonlySet<string>): void {
  for (const skill of project.database.skills) {
    if (skill.animationId) assert(animationIds.has(skill.animationId), `skill ${skill.id}: animationId does not exist.`);
  }
}

function validateItemRecords(
  project: Project,
  skillIds: ReadonlySet<string>,
  animationIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>
): void {
  for (const item of project.database.items) {
    if (item.skillId) assert(skillIds.has(item.skillId), `item ${item.id}: skillId does not exist.`);
    if (item.animationId) assert(animationIds.has(item.animationId), `item ${item.id}: animationId does not exist.`);
    validateItemResources(item, resourceIds);
    for (const effect of item.stateEffects) assert(stateIdExists(project, effect.stateId), `item ${item.id}: stateId does not exist.`);
  }
}

function validateEquipmentRecords(
  project: Project,
  actorIds: ReadonlySet<string>,
  classIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>
): void {
  for (const equipment of project.database.equipment) {
    if (equipment.skillId) assert(skillIds.has(equipment.skillId), `equipment ${equipment.id}: skillId does not exist.`);
    if (equipment.usableAsItemSkillId) {
      assert(skillIds.has(equipment.usableAsItemSkillId), `equipment ${equipment.id}: usableAsItemSkillId does not exist.`);
    }
    validateEquipmentResources(equipment, resourceIds);
    requireExistingIds(`equipment ${equipment.id}: actor`, equipment.equippableActorIds, actorIds);
    requireExistingIds(`equipment ${equipment.id}: class`, equipment.equippableClassIds, classIds);
    for (const stateId of equipment.stateInflictIds) assert(stateIdExists(project, stateId), `equipment ${equipment.id}: stateId does not exist.`);
  }
}

function validateEnemyRecords(
  project: Project,
  itemIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>
): void {
  for (const enemy of project.database.enemies) {
    requireExistingIds(`enemy ${enemy.id}: skill`, enemy.actions.map((entry) => entry.skillId), skillIds);
    if (enemy.rewards.dropItemId) assert(itemIds.has(enemy.rewards.dropItemId), `enemy ${enemy.id}: dropItemId does not exist.`);
    validateEnemyResources(enemy, resourceIds);
  }
}

function validateTroopRecords(project: Project, enemyIds: ReadonlySet<string>, context: ReferenceContext): void {
  for (const troop of project.database.troops) {
    requireExistingIds(`troop ${troop.id}: enemy`, troop.enemyIds, enemyIds);
    if (troop.members) validateTroopMembers(troop.id, troop.members, enemyIds);
    validateBattleEventPages(troop.battleEventPages, context);
  }
}

function validateCommonEvents(project: Project, switchIds: ReadonlySet<string>, context: ReferenceContext): void {
  for (const commonEvent of project.commonEvents) {
    if (commonEvent.conditionSwitchId) {
      assert(switchIds.has(commonEvent.conditionSwitchId), `commonEvent ${commonEvent.id}: conditionSwitchId does not exist.`);
    }
    validateCommands(commonEvent.commands, context);
  }
}

function validateMapRecords(
  project: Project,
  switchIds: ReadonlySet<string>,
  variableIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  context: ReferenceContext
): void {
  for (const map of Object.values(project.maps)) {
    assert(project.tilesets[map.tilesetId] !== undefined, `map ${map.id}: tilesetId does not exist.`);
    for (const event of map.events) {
      validateOptionalResource(`event ${event.id}: sprite`, event.sprite?.id, resourceIds);
      if (event.condition) validateCondition(event.condition, switchIds, variableIds);
      validateCommands(event.commands, context);
      validateEventPages(event.pages ?? [], context);
    }
  }
}

function validateTroopMembers(
  troopId: string,
  members: readonly { readonly enemyId: string }[],
  enemyIds: ReadonlySet<string>
): void {
  for (const member of members) assert(enemyIds.has(member.enemyId), `troop ${troopId}: member enemyId does not exist: ${member.enemyId}`);
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
  equipmentIds: ReadonlySet<string>
): void {
  for (const id of Object.values(equipment)) {
    if (id) assert(equipmentIds.has(id), `actor ${actorId}: initialEquipment does not exist: ${id}`);
  }
}

function stateIdExists(project: Project, stateId: string): boolean {
  return stateId === "state_death" || project.database.states.some((state) => state.id === stateId);
}

function requireExistingIds(label: string, ids: readonly string[], knownIds: ReadonlySet<string>): void {
  for (const id of ids) assert(knownIds.has(id), `${label} does not exist: ${id}`);
}
