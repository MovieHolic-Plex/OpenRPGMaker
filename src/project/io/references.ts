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
  validateEnemyResources,
  validateEquipmentResources,
  validateItemResources,
  validateOptionalResource,
  validateSystemResources,
} from "./resourceReferenceValidation";
import { monsterEvolutionCycleSpeciesIds } from "../monsterCollection";

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
  const speciesIds = new Set((project.database.monsterSpecies ?? []).map((record) => record.id));
  const animationIds = new Set(project.database.battleAnimations.map((record) => record.id));
  const commonEventIds = new Set(project.commonEvents.map((record) => record.id));
  const endingIds = new Set((project.endings ?? []).map((record) => record.id));
  const mapIds = new Set(Object.keys(project.maps));
  const resourceIds = collectResourceIds(project);
  const context: ReferenceContext = {
    actorIds,
    classIds,
    enemyIds,
    itemIds,
    equipmentIds,
    skillIds,
    animationIds,
    switchIds,
    variableIds,
    commonEventIds,
    endingIds,
    mapIds,
    troopIds,
    speciesIds,
    resourceIds,
  };

  validateActorRecords(project, classIds, animationIds, context, issues);
  validateClassRecords(project, classIds, actorIds, skillIds, equipmentIds, animationIds, issues);
  validateSkillRecords(project, skillIds, animationIds, context, issues);
  validateItemRecords(project, actorIds, classIds, skillIds, animationIds, resourceIds, issues);
  validateEquipmentRecords(project, actorIds, classIds, skillIds, resourceIds, issues);
  validateEnemyRecords(project, itemIds, skillIds, resourceIds, context.switchIds, speciesIds, issues);
  validateElementRates(project, issues);
  validateMonsterSpeciesRecords(project, skillIds, resourceIds, issues);
  validateCropRecords(project, itemIds, resourceIds, issues);
  validateLifeAuthoringRecords(project, itemIds, switchIds, issues);
  validateTroopRecords(project, enemyIds, context, issues);
  for (const animation of project.database.battleAnimations) check(() => validateAnimationResource(animation, resourceIds));
  for (const terrain of project.database.terrains ?? []) {
    check(() => validateOptionalResource(`terrain ${terrain.id}: battleBackgroundResourceId`, terrain.battleBackgroundResourceId, resourceIds));
    check(() => validateOptionalResource(`terrain ${terrain.id}: footstepSoundResourceId`, terrain.footstepSoundResourceId, resourceIds));
  }

  collectExistingIdIssues("system.startActorIds", project.system.startActorIds, actorIds, issues);
  if (project.system.initialTroopId && !troopIds.has(project.system.initialTroopId)) issues.push("system.initialTroopId does not exist.");
  if (project.system.timeSystem?.enabled && project.system.timeSystem.onDayEnd && !commonEventIds.has(project.system.timeSystem.onDayEnd)) issues.push("system.timeSystem.onDayEnd does not exist.");
  validateP0SystemReferences(project, itemIds, switchIds, issues);
  check(() => validateSystemResources(project.system, resourceIds));
  collectExistingIdIssues("session.partyActorIds", project.session.partyActorIds, actorIds, issues);
  validateEndings(project, switchIds, variableIds, issues);
  validateMapConnections(project, mapIds, issues);
  validateCommonEvents(project, switchIds, context, issues);
  validateMapRecords(project, switchIds, variableIds, resourceIds, context, issues);
  return issues;
}

function validateP0SystemReferences(
  project: Project,
  itemIds: ReadonlySet<string>,
  switchIds: ReadonlySet<string>,
  issues: string[],
): void {
  collectDuplicateDefinitionIssues("system.worldUnlocks", project.system.worldUnlocks ?? [], issues);
  collectDuplicateDefinitionIssues("system.bundles", project.system.bundles ?? [], issues);
  collectDuplicateDefinitionIssues("system.makers", project.system.makers ?? [], issues);
  const recipeIds = new Set((project.system.craftRecipes ?? []).map((recipe) => recipe.id));
  const worldUnlockIds = new Set((project.system.worldUnlocks ?? []).map((unlock) => unlock.id));
  collectExistingIdIssues("system.shipping.allowedItemIds", project.system.shipping?.allowedItemIds ?? [], itemIds, issues);
  for (const unlock of project.system.worldUnlocks ?? []) {
    if (unlock.switchId && !switchIds.has(unlock.switchId)) {
      issues.push(`system.worldUnlocks ${unlock.id}: switchId does not exist: ${unlock.switchId}`);
    }
  }
  for (const bundle of project.system.bundles ?? []) {
    collectExistingIdIssues(`system.bundles ${bundle.id}: requirement itemId`, bundle.requirements.map((entry) => entry.itemId), itemIds, issues);
    collectExistingIdIssues(`system.bundles ${bundle.id}: reward itemId`, bundle.reward?.itemRewards?.map((entry) => entry.itemId) ?? [], itemIds, issues);
    if (bundle.reward?.switchId && !switchIds.has(bundle.reward.switchId)) {
      issues.push(`system.bundles ${bundle.id}: reward switchId does not exist: ${bundle.reward.switchId}`);
    }
    collectExistingIdIssues(`system.bundles ${bundle.id}: reward worldUnlockId`, bundle.reward?.worldUnlockIds ?? [], worldUnlockIds, issues);
    collectExistingIdIssues(`system.bundles ${bundle.id}: reward recipeId`, bundle.reward?.recipeIds ?? [], recipeIds, issues);
  }
  for (const maker of project.system.makers ?? []) {
    collectExistingIdIssues(`system.makers ${maker.id}: input itemId`, maker.inputs.map((entry) => entry.itemId), itemIds, issues);
    collectExistingIdIssues(`system.makers ${maker.id}: output itemId`, maker.outputs.map((entry) => entry.itemId), itemIds, issues);
  }
  for (const skill of project.system.skillSystem?.enabled === true ? project.database.lifeSkills ?? [] : []) {
    for (const reward of skill.levelUpRewards) {
      if (reward.switchId && !switchIds.has(reward.switchId)) {
        issues.push(`lifeSkill ${skill.id}: reward switchId does not exist: ${reward.switchId}`);
      }
      if (reward.recipeId && !recipeIds.has(reward.recipeId)) {
        issues.push(`lifeSkill ${skill.id}: reward recipeId does not exist: ${reward.recipeId}`);
      }
    }
  }
}

function collectDuplicateDefinitionIssues(
  label: string,
  rows: readonly { readonly id: string }[],
  issues: string[],
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.id)) issues.push(`${label}: duplicate id: ${row.id}`);
    seen.add(row.id);
  }
}

function validateEndings(
  project: Project,
  switchIds: ReadonlySet<string>,
  variableIds: ReadonlySet<string>,
  issues: string[]
): void {
  const seen = new Set<string>();
  for (const ending of project.endings ?? []) {
    if (seen.has(ending.id)) issues.push(`ending ${ending.id}: duplicate id.`);
    seen.add(ending.id);
    for (const condition of ending.conditions) {
      capture(issues, () => validateCondition(condition, switchIds, variableIds));
    }
  }
}

export function repairProjectReferences(project: Project): void {
  const mapIds = new Set(Object.keys(project.maps));
  const animationIds = new Set(project.database.battleAnimations.map((record) => record.id));
  const commonEventIds = new Set(project.commonEvents.map((record) => record.id));
  if (project.system.timeSystem?.onDayEnd && !commonEventIds.has(project.system.timeSystem.onDayEnd)) {
    const { onDayEnd: _removed, ...rest } = project.system.timeSystem;
    project.system.timeSystem = rest;
  }
  project.mapConnections = (project.mapConnections ?? []).filter((connection) => mapIds.has(connection.from.mapId) && mapIds.has(connection.to.mapId));
  for (const actor of project.database.actors) {
    if (actor.unarmedAnimationId && !animationIds.has(actor.unarmedAnimationId)) delete actor.unarmedAnimationId;
  }
  for (const klass of project.database.classes) {
    if (klass.animationId && !animationIds.has(klass.animationId)) delete klass.animationId;
  }
  // 존재하지 않는 속성을 가리키는 스킬 elementId는 로드 실패 대신 제거한다 — 타입 상성(9b) 검증
  // 추가로 기존 저장본(skill_leaf 등)이 열리지 않던 사고의 재발 방지.
  for (const skill of project.database.skills) {
    if (skill.elementId && !elementIdExists(project, skill.elementId)) delete skill.elementId;
  }
  // 삭제된 속성(database.elements) 을 가리키는 actor/enemy/class 의 elementRates 잔재 제거.
  // 요소 개수 축소로 잘린 id 가 잔존하다가, 같은 ordinal 로 재생성될 때 stale 등급이 소생하는
  // 위험(B4) 을 로드 시점에 원천 차단한다. skill.elementId 정리와 동일한 자동치유 정책.
  pruneDanglingElementRates(project);
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
  const switchIds = new Set(project.switches.map((record) => record.id));
  const variableIds = new Set(project.variables.map((record) => record.id));
  const itemIds = new Set(project.database.items.map((record) => record.id));
  for (const klass of project.database.classes) {
    if (klass.animationId && !animationIds.has(klass.animationId)) issues.push(`class ${klass.id}: animationId does not exist.`);
    collectExistingIdIssues(`class ${klass.id}: skill`, klass.learnedSkills.map((entry) => entry.skillId), skillIds, issues);
    collectExistingIdIssues(`class ${klass.id}: battle command skill`, klass.battleCommands.flatMap((command) => command.skillId ? [command.skillId] : []), skillIds, issues);
    collectExistingIdIssues(`class ${klass.id}: equipment`, klass.equipmentPermissions.equipmentIds, equipmentIds, issues);
    collectExistingIdIssues(`class ${klass.id}: equipment actor`, klass.equipmentPermissions.actorIds, actorIds, issues);
    collectExistingIdIssues(`class ${klass.id}: equipment class`, klass.equipmentPermissions.classIds, classIds, issues);
    for (const promotion of klass.promotions ?? []) {
      if (!classIds.has(promotion.toClassId)) issues.push(`class ${klass.id}: promotion toClassId does not exist: ${promotion.toClassId}`);
      if (promotion.requires.switchId && !switchIds.has(promotion.requires.switchId)) issues.push(`class ${klass.id}: promotion switchId does not exist: ${promotion.requires.switchId}`);
      if (promotion.requires.itemId && !itemIds.has(promotion.requires.itemId)) issues.push(`class ${klass.id}: promotion itemId does not exist: ${promotion.requires.itemId}`);
      if (promotion.requires.variableId && !variableIds.has(promotion.requires.variableId)) issues.push(`class ${klass.id}: promotion variableId does not exist: ${promotion.requires.variableId}`);
    }
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
    collectExistingIdIssues(`equipment ${equipment.id}: state`, [...equipment.stateInflictIds, ...equipment.stateDefenseIds], stateIds(project), issues);
    collectExistingIdIssues(`equipment ${equipment.id}: element`, [...equipment.attackElementIds, ...equipment.elementalDefenseIds], elementIds(project), issues);
  }
}

function validateEnemyRecords(
  project: Project,
  itemIds: ReadonlySet<string>,
  skillIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  switchIds: ReadonlySet<string>,
  speciesIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const enemy of project.database.enemies) {
    if (enemy.speciesId && !speciesIds.has(enemy.speciesId)) {
      issues.push(`enemy ${enemy.id}: speciesId does not exist: ${enemy.speciesId}. ${knownIdsHint(speciesIds)}`);
    }
    collectExistingIdIssues(
      `enemy ${enemy.id}: skill`,
      enemy.actions.map((entry) => entry.skillId).filter((skillId) => skillId.length > 0),
      skillIds,
      issues,
    );
    if (enemy.rewards.dropItemId && !itemIds.has(enemy.rewards.dropItemId)) issues.push(`enemy ${enemy.id}: dropItemId does not exist.`);
    for (const action of enemy.actions) {
      for (const effect of [action.switchOnAfterAction, action.switchOffAfterAction]) {
        if (effect.enabled && effect.switchId && !switchIds.has(effect.switchId)) issues.push(`enemy ${enemy.id}: action switchId does not exist.`);
      }
    }
    capture(issues, () => validateEnemyResources(enemy, resourceIds));
  }
}

function validateMonsterSpeciesRecords(
  project: Project,
  skillIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  issues: string[]
): void {
  const speciesIds = new Set((project.database.monsterSpecies ?? []).map((record) => record.id));
  const itemIds = new Set(project.database.items.map((record) => record.id));
  const cycleIds = monsterEvolutionCycleSpeciesIds(project.database.monsterSpecies ?? []);
  // 사이클은 레벨업마다 두 종족을 왕복시킨다 — 그래프 전체에 한 번만 보고한다.
  // 타입 멤버십은 여기서 보고하지 않는다: 이 파이프라인의 이슈는 로드를 막는 하드 에러이고,
  // 상성표에 없는 타입은 정상적인 작업 중간 상태다(경고는 projectLint 가 낸다).
  if (cycleIds.length > 0) issues.push(`종족 진화 그래프에 사이클이 있습니다: ${cycleIds.join(" → ")}`);
  for (const species of project.database.monsterSpecies ?? []) {
    collectExistingIdIssues(`monsterSpecies ${species.id}: skill`, (species.skillsByLevel ?? []).map((entry) => entry.skillId), skillIds, issues);
    for (const evolution of species.evolutions ?? []) {
      if (evolution.toSpeciesId === species.id) issues.push(`종족 ${species.id}: 자기 자신으로 진화할 수 없습니다`);
      if (!speciesIds.has(evolution.toSpeciesId)) issues.push(`monsterSpecies ${species.id}: evolution toSpeciesId does not exist: ${evolution.toSpeciesId}`);
      if (evolution.requires.itemId && !itemIds.has(evolution.requires.itemId)) issues.push(`monsterSpecies ${species.id}: evolution itemId does not exist: ${evolution.requires.itemId}`);
    }
    capture(issues, () => validateOptionalResource(`monsterSpecies ${species.id}: graphic.monsterResourceId`, species.graphic.monsterResourceId, resourceIds));
  }
}

function validateCropRecords(
  project: Project,
  itemIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  issues: string[]
): void {
  const seen = new Set<string>();
  for (const crop of project.database.crops ?? []) {
    if (seen.has(crop.id)) issues.push(`crop ${crop.id}: duplicate id.`);
    seen.add(crop.id);
    if (!itemIds.has(crop.seedItemId)) issues.push(`crop ${crop.id}: seedItemId does not exist: ${crop.seedItemId}`);
    if (!itemIds.has(crop.harvestItemId)) issues.push(`crop ${crop.id}: harvestItemId does not exist: ${crop.harvestItemId}`);
    for (const [index, graphic] of (crop.graphicStages ?? []).entries()) {
      capture(issues, () => validateOptionalResource(`crop ${crop.id}: graphicStages[${index}].resourceId`, graphic.resourceId, resourceIds));
    }
  }
}

function validateLifeAuthoringRecords(
  project: Project,
  itemIds: ReadonlySet<string>,
  switchIds: ReadonlySet<string>,
  issues: string[],
): void {
  const recipeIds = new Set((project.system.craftRecipes ?? []).map((record) => record.id));
  const seenSkills = new Set<string>();
  for (const skill of project.database.lifeSkills ?? []) {
    if (seenSkills.has(skill.id)) issues.push(`lifeSkill ${skill.id}: duplicate id.`);
    seenSkills.add(skill.id);
    for (const [index, reward] of skill.levelUpRewards.entries()) {
      if (reward.switchId && !switchIds.has(reward.switchId)) {
        issues.push(`lifeSkill ${skill.id}: levelUpRewards[${index}].switchId does not exist: ${reward.switchId}`);
      }
      if (reward.recipeId && !recipeIds.has(reward.recipeId)) {
        issues.push(`lifeSkill ${skill.id}: levelUpRewards[${index}].recipeId does not exist: ${reward.recipeId}`);
      }
    }
  }

  const seenRecipes = new Set<string>();
  for (const recipe of project.system.craftRecipes ?? []) {
    if (seenRecipes.has(recipe.id)) issues.push(`craftRecipe ${recipe.id}: duplicate id.`);
    seenRecipes.add(recipe.id);
    if (!itemIds.has(recipe.outputItemId)) issues.push(`craftRecipe ${recipe.id}: outputItemId does not exist: ${recipe.outputItemId}`);
    for (const [index, ingredient] of recipe.ingredients.entries()) {
      if (!itemIds.has(ingredient.itemId)) issues.push(`craftRecipe ${recipe.id}: ingredients[${index}].itemId does not exist: ${ingredient.itemId}`);
    }
  }

  const seenUpgrades = new Set<string>();
  for (const upgrade of project.system.itemUpgrades ?? []) {
    if (seenUpgrades.has(upgrade.id)) issues.push(`itemUpgrade ${upgrade.id}: duplicate id.`);
    seenUpgrades.add(upgrade.id);
    if (!itemIds.has(upgrade.fromItemId)) issues.push(`itemUpgrade ${upgrade.id}: fromItemId does not exist: ${upgrade.fromItemId}`);
    if (!itemIds.has(upgrade.toItemId)) issues.push(`itemUpgrade ${upgrade.id}: toItemId does not exist: ${upgrade.toItemId}`);
    for (const [index, ingredient] of (upgrade.ingredients ?? []).entries()) {
      if (!itemIds.has(ingredient.itemId)) issues.push(`itemUpgrade ${upgrade.id}: ingredients[${index}].itemId does not exist: ${ingredient.itemId}`);
    }
  }

  const seenSellItems = new Set<string>();
  for (const [index, entry] of (project.system.sellPrices ?? []).entries()) {
    if (seenSellItems.has(entry.itemId)) issues.push(`sellPrices: duplicate itemId: ${entry.itemId}`);
    seenSellItems.add(entry.itemId);
    if (!itemIds.has(entry.itemId)) issues.push(`sellPrices[${index}].itemId does not exist: ${entry.itemId}`);
  }
  const seenToolActions = new Set<string>();
  for (const action of project.system.toolActions ?? []) {
    if (seenToolActions.has(action.id)) issues.push(`toolAction ${action.id}: duplicate id.`);
    seenToolActions.add(action.id);
    if (action.itemId && !itemIds.has(action.itemId)) issues.push(`toolAction ${action.id}: itemId does not exist: ${action.itemId}`);
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
    collectExistingIdIssues(`map ${map.id}: troopIds`, map.troopIds ?? [], context.troopIds, issues);
    for (const [index, entry] of (map.encounterTable ?? []).entries()) {
      if (!context.troopIds.has(entry.troopId)) issues.push(`map ${map.id}: encounterTable[${index}].troopId does not exist: ${entry.troopId}`);
      if (entry.conditions?.switchId) collectExistingIdIssues(`map ${map.id}: encounterTable[${index}].conditions.switchId`, [entry.conditions.switchId], switchIds, issues);
      if (entry.conditions?.variableId) collectExistingIdIssues(`map ${map.id}: encounterTable[${index}].conditions.variableId`, [entry.conditions.variableId], variableIds, issues);
    }
    for (const [index, spawn] of (map.fieldSpawns ?? []).entries()) {
      if (!context.troopIds.has(spawn.troopId)) issues.push(`map ${map.id}: fieldSpawns[${index}].troopId does not exist: ${spawn.troopId}`);
      capture(issues, () => validateOptionalResource(`map ${map.id}: fieldSpawns[${index}].graphic.sprite`, spawn.graphic?.sprite?.id, resourceIds));
    }
    for (const event of map.events) {
      capture(issues, () => validateOptionalResource(`event ${event.id}: sprite`, event.sprite?.id, resourceIds));
      validateGiftPreferenceReferences(`event ${event.id}`, event.giftPrefs, context.itemIds, issues);
      const condition = event.condition;
      if (condition) capture(issues, () => validateCondition(condition, switchIds, variableIds));
      capture(issues, () => validateCommands(event.commands, context));
      capture(issues, () => validateEventPages(event.pages ?? [], context));
    }
  }
  validateCharacterGiftPreferenceReferences(project, context.itemIds, issues);
}

function validateCharacterGiftPreferenceReferences(
  project: Project,
  itemIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const [characterId, profile] of Object.entries(project.characters ?? {})) {
    validateGiftPreferenceReferences(`characters.${characterId}`, profile.giftPrefs, itemIds, issues);
  }
}

function validateGiftPreferenceReferences(
  label: string,
  giftPrefs: { readonly loved?: readonly string[]; readonly liked?: readonly string[]; readonly disliked?: readonly string[] } | undefined,
  itemIds: ReadonlySet<string>,
  issues: string[]
): void {
  if (!giftPrefs) return;
  collectExistingIdIssues(`${label}: giftPrefs.loved`, giftPrefs.loved ?? [], itemIds, issues);
  collectExistingIdIssues(`${label}: giftPrefs.liked`, giftPrefs.liked ?? [], itemIds, issues);
  collectExistingIdIssues(`${label}: giftPrefs.disliked`, giftPrefs.disliked ?? [], itemIds, issues);
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
  return new Set([
    ...(project.database.elements ?? []).map((element) => element.id),
    ...(project.system.typeChart?.types ?? []),
  ]);
}

function elementIdExists(project: Project, elementId: string): boolean {
  return elementIds(project).has(elementId);
}

// elementRates 키 공간은 database.elements[].id 만이다 — 에디터가 database.elements 순회로
// 행을 만들기 때문. typeChart.types 와는 별개 네임스페이스이므로 분리된 집합을 쓴다.
function databaseElementIds(project: Project): ReadonlySet<string> {
  return new Set((project.database.elements ?? []).map((element) => element.id));
}

// actor/enemy/class 의 elementRates 에서 존재하지 않는 속성 id 키를 제거한다.
// B4: 요소 축소/삭제 후 잔존하는 고아 등급을 치워, 같은 id 재생성 시 stale 등급 소생 방지.
export function pruneDanglingElementRates(project: Project): void {
  const ids = databaseElementIds(project);
  const scrub = (rates: Record<string, unknown> | undefined): void => {
    if (!rates) return;
    for (const id of Object.keys(rates)) {
      if (!ids.has(id)) delete rates[id];
    }
  };
  for (const actor of project.database.actors) scrub(actor.elementRates);
  for (const enemy of project.database.enemies) scrub(enemy.elementRates);
  for (const klass of project.database.classes) scrub(klass.elementRates);
}

// elementRates 의 dangling 키를 검증 이슈로 보고한다 — equipment element 보고(L271/L290) 와 대칭.
function validateElementRates(project: Project, issues: string[]): void {
  const ids = databaseElementIds(project);
  const report = (owner: string, rates: Record<string, unknown> | undefined): void => {
    if (!rates) return;
    for (const id of Object.keys(rates)) {
      // 유효한 id 를 알려주지 않으면 모델은 고칠 방법을 못 찾고 작업을 포기한다(2026-08-23 실측:
      // 발명한 element id 3개가 거부된 뒤 "속성 등록 기능이 없다"며 항목 3건을 건너뜀).
      if (!ids.has(id)) issues.push(`${owner}: elementRates key does not exist: ${id}. ${knownIdsHint(ids)}`);
    }
  };
  for (const actor of project.database.actors) report(`actor ${actor.id}`, actor.elementRates);
  for (const enemy of project.database.enemies) report(`enemy ${enemy.id}`, enemy.elementRates);
  for (const klass of project.database.classes) report(`class ${klass.id}`, klass.elementRates);
}

/** 유효 id 목록 힌트 — 길어지지 않게 앞쪽만 보여주고 총 개수를 함께 알린다. */
function knownIdsHint(ids: ReadonlySet<string>): string {
  if (ids.size === 0) return "이 프로젝트에는 등록된 id가 없습니다 — 먼저 해당 레코드를 만드세요.";
  const sample = [...ids].slice(0, 12).join(", ");
  return `사용 가능한 id(${ids.size}개): ${sample}${ids.size > 12 ? " …" : ""} (get_database_records로 전체 조회)`;
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
    if (command.kind === "inn" && command.notEnoughBranch) {
      pruned.push({ ...command, notEnoughBranch: recurse(command.notEnoughBranch) });
      continue;
    }
    pruned.push(command);
  }
  return pruned;
}
