import { combatReferenceIssues } from "@/project/combatReferences";
import { equipmentSlots, hasEquipmentSlot } from "@/project/equipmentSlots";
import { characterAppearanceReferenceIssues } from "./characterAppearanceValidation";
import { resolveAnimalHome } from "../animalHousing";
import { placementRecord } from "../spatialPlacements";
import { growthIssues } from "@/project/growth/validation";
import type { Command, GameEvent, GameMap, NpcScheduleEntry, Project } from "../types";
import { assert } from "./guards";
import { structurePlacementBeforeIsWellFormed, structureRectFitsMap } from "../structurePlacements";
import {
  collectCommandItemReferenceIds,
  collectConditionItemReferenceIds,
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
import { DEFAULT_ENEMY_FACTION_ID, PLAYER_FACTION_ID } from "../factions";
import { ensureItemSwitchDefs } from "../itemSwitchDefs";
import { monsterEvolutionCycleSpeciesIds } from "../monsterCollection";
import { inBounds, isPassable } from "../collision";
import { footprintCells, isSpatialFootprint, isSpatialOrientation } from "../spatialPlacements";

export function validateProjectReferences(project: Project): void {
  const issues = collectProjectReferenceIssues(project);
  assert(issues.length === 0, issues.join("\n"));
}

/**
 * 프로젝트 검증기가 하드 참조로 취급하는 아이템 id와 시작 인벤토리 키를 모은다.
 * 이벤트 명령·페이지 조건 순회는 commandReferenceValidation의 검증 구조를 공유한다.
 */
export function collectProjectItemReferenceIds(project: Project): ReadonlySet<string> {
  const ids = new Set<string>(Object.keys(project.session.inventory));
  for (const widget of project.system.fieldHud?.widgets ?? []) for (const id of widget.itemIds ?? []) ids.add(id);
  for (const preset of project.testPresets ?? []) {
    for (const itemId of Object.keys(preset.inventory ?? {})) ids.add(itemId);
  }

  for (const skill of project.database.skills) {
    const itemCostId = skill.actionSkill?.itemCost?.itemId;
    if (itemCostId) ids.add(itemCostId);
  }
  for (const actorClass of project.database.classes) {
    for (const promotion of actorClass.promotions ?? []) if (promotion.requires.itemId) ids.add(promotion.requires.itemId);
  }
  for (const enemy of project.database.enemies) {
    if (enemy.rewards.dropItemId) ids.add(enemy.rewards.dropItemId);
    for (const drop of enemy.rewards.drops ?? []) ids.add(drop.itemId);
  }
  for (const species of project.database.monsterSpecies ?? []) {
    for (const evolution of species.evolutions ?? []) if (evolution.requires.itemId) ids.add(evolution.requires.itemId);
  }
  for (const crop of project.database.crops ?? []) {
    ids.add(crop.seedItemId);
    ids.add(crop.harvestItemId);
  }
  for (const fish of project.database.fishSpecies ?? []) ids.add(fish.itemId);
  for (const animal of project.database.farmAnimalSpecies ?? []) {
    ids.add(animal.feedItemId);
    ids.add(animal.productItemId);
  }
  for (const building of project.database.farmBuildingTypes ?? []) {
    for (const level of building.levels) for (const cost of level.cost?.items ?? []) ids.add(cost.itemId);
  }
  for (const decoration of project.database.homeDecorationTypes ?? []) ids.add(decoration.placementItemId);

  for (const recipe of project.system.craftRecipes ?? []) {
    ids.add(recipe.outputItemId);
    for (const ingredient of recipe.ingredients) ids.add(ingredient.itemId);
  }
  for (const upgrade of project.system.itemUpgrades ?? []) {
    ids.add(upgrade.fromItemId);
    ids.add(upgrade.toItemId);
    for (const ingredient of upgrade.ingredients ?? []) ids.add(ingredient.itemId);
  }
  for (const price of project.system.sellPrices ?? []) ids.add(price.itemId);
  for (const action of project.system.toolActions ?? []) if (action.itemId) ids.add(action.itemId);
  for (const itemId of project.system.shipping?.allowedItemIds ?? []) ids.add(itemId);
  for (const bundle of project.system.bundles ?? []) {
    for (const requirement of bundle.requirements) ids.add(requirement.itemId);
    for (const reward of bundle.reward?.itemRewards ?? []) ids.add(reward.itemId);
  }
  for (const maker of project.system.makers ?? []) {
    for (const input of maker.inputs) ids.add(input.itemId);
    for (const output of maker.outputs) ids.add(output.itemId);
  }
  for (const area of project.system.seasonalForage?.areas ?? []) {
    for (const entry of area.entries) {
      if (entry.itemId) ids.add(entry.itemId);
      for (const itemId of Object.values(entry.seasonalDrops ?? {})) if (itemId) ids.add(itemId);
    }
  }
  for (const itemId of project.system.collections?.trackedItemIds ?? []) ids.add(itemId);
  for (const itemId of project.system.museum?.eligibleItemIds ?? []) ids.add(itemId);
  for (const reward of project.system.museum?.rewards ?? []) {
    for (const itemId of reward.requiredItemIds ?? []) ids.add(itemId);
    for (const item of reward.reward?.itemRewards ?? []) ids.add(item.itemId);
  }
  for (const placeable of Object.values(project.session.placeables ?? {})) {
    if (placeable.itemId) ids.add(placeable.itemId);
    for (const itemId of Object.values(placeable.seasonalDrops ?? {})) if (itemId) ids.add(itemId);
  }

  for (const commonEvent of project.commonEvents) collectCommandItemReferenceIds(commonEvent.commands, ids);
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      collectCommandItemReferenceIds(event.commands, ids);
      if (event.condition) collectConditionItemReferenceIds(event.condition, ids);
      for (const itemId of [...(event.giftPrefs?.loved ?? []), ...(event.giftPrefs?.liked ?? []), ...(event.giftPrefs?.disliked ?? [])]) ids.add(itemId);
      for (const page of event.pages ?? []) {
        for (const condition of page.conditions) collectConditionItemReferenceIds(condition, ids);
        collectCommandItemReferenceIds(page.commands, ids);
      }
    }
  }
  for (const profile of Object.values(project.characters ?? {})) {
    for (const itemId of [...(profile.giftPrefs?.loved ?? []), ...(profile.giftPrefs?.liked ?? []), ...(profile.giftPrefs?.disliked ?? [])]) ids.add(itemId);
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) {
      for (const condition of page.conditions) collectConditionItemReferenceIds(condition, ids);
      collectCommandItemReferenceIds(page.commands, ids);
    }
  }
  return ids;
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
  // 이 함수의 계약은 «이슈 수집» 이다 — 개별 검증기가 던진 예외도 이슈 문자열로 남기고
  // 호출자(에디터 부팅의 refreshAuthoringJourney)를 죽이지 않는다. 정규화를 거치지 않은
  // 프로젝트(옛 JSON·e2e 시드)에서 검증기가 undefined 필드를 만나 던지면 화면이 통째로
  // 뜨지 않았다. 파일 아래쪽 검증기들은 이미 check() 를 쓰고 있었다 — 계약을 전부로 넓힌다.
  check(() => issues.push(...growthIssues(project), ...characterAppearanceReferenceIssues(project), ...combatReferenceIssues(project)));
  const switchIds = new Set(project.switches.map((record) => record.id));
  const variableIds = new Set(project.variables.map((record) => record.id));
  const actorIds = new Set(project.database.actors.map((record) => record.id));
  const classIds = new Set(project.database.classes.map((record) => record.id));
  const skillIds = new Set(project.database.skills.map((record) => record.id));
  const itemIds = new Set(project.database.items.map((record) => record.id));
  const enemyIds = new Set(project.database.enemies.map((record) => record.id));
  const equipmentIds = new Set(project.database.equipment.map((record) => record.id));
  const equipmentSlotIds = new Set(equipmentSlots(project).map((slot) => slot.id));
  const troopIds = new Set(project.database.troops.map((record) => record.id));
  const speciesIds = new Set((project.database.monsterSpecies ?? []).map((record) => record.id));
  const animationIds = new Set(project.database.battleAnimations.map((record) => record.id));
  const commonEventIds = new Set(project.commonEvents.map((record) => record.id));
  const endingIds = new Set((project.endings ?? []).map((record) => record.id));
  const mapIds = new Set(Object.keys(project.maps));
  const resourceIds = collectResourceIds(project);
  check(() => {
    for (const widget of project.system.fieldHud?.widgets ?? []) {
      const path = `system.fieldHud.${widget.id}`;
      if (widget.actorId) assert(actorIds.has(widget.actorId), `${path}: unknown actorId ${widget.actorId}`);
      if (widget.variableId) assert(variableIds.has(widget.variableId), `${path}: unknown variableId ${widget.variableId}`);
      if (widget.maxVariableId) assert(variableIds.has(widget.maxVariableId), `${path}: unknown maxVariableId ${widget.maxVariableId}`);
      if (widget.switchId) assert(switchIds.has(widget.switchId), `${path}: unknown switchId ${widget.switchId}`);
      for (const id of widget.itemIds ?? []) assert(itemIds.has(id), `${path}: unknown itemId ${id}`);
    }
  });
  const context: ReferenceContext = {
    appearanceIds: new Set(project.database.characterAppearances?.map((record) => record.id)),
    actorIds,
    classIds,
    enemyIds,
    itemIds,
    equipmentIds,
    equipmentSlotIds,
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
    factionIds: new Set([
      PLAYER_FACTION_ID,
      DEFAULT_ENEMY_FACTION_ID,
      ...(project.factions?.defs ?? []).map((record) => record.id),
    ]),
  };

  check(() => validateActorRecords(project, classIds, animationIds, context, issues));
  check(() => validateClassRecords(project, classIds, actorIds, skillIds, equipmentIds, animationIds, issues));
  check(() => validateSkillRecords(project, skillIds, animationIds, context, issues));
  check(() => validateItemRecords(project, actorIds, classIds, skillIds, animationIds, resourceIds, switchIds, issues));
  check(() => validateEquipmentRecords(project, actorIds, classIds, skillIds, resourceIds, issues));
  check(() => validateEnemyRecords(project, itemIds, skillIds, resourceIds, context.switchIds, speciesIds, issues));
  check(() => validateElementRates(project, issues));
  check(() => validateMonsterSpeciesRecords(project, skillIds, resourceIds, issues));
  check(() => validateCropRecords(project, itemIds, resourceIds, issues));
  check(() => validateLifeAuthoringRecords(project, itemIds, issues));
  check(() => validateFarmAnimalReferences(project, itemIds, issues));
  check(() => validateSpatialReferences(project, itemIds, resourceIds, issues));
  check(() => validateTroopRecords(project, enemyIds, context, issues));
  for (const animation of project.database.battleAnimations) check(() => validateAnimationResource(animation, resourceIds));
  for (const terrain of project.database.terrains ?? []) {
    check(() => validateOptionalResource(`terrain ${terrain.id}: battleBackgroundResourceId`, terrain.battleBackgroundResourceId, resourceIds));
    check(() => validateOptionalResource(`terrain ${terrain.id}: footstepSoundResourceId`, terrain.footstepSoundResourceId, resourceIds));
  }

  check(() => collectExistingIdIssues("system.startActorIds", project.system.startActorIds, actorIds, issues));
  if (project.system.initialTroopId && !troopIds.has(project.system.initialTroopId)) issues.push("system.initialTroopId does not exist.");
  if (project.system.timeSystem?.enabled && project.system.timeSystem.onDayEnd && !commonEventIds.has(project.system.timeSystem.onDayEnd)) issues.push("system.timeSystem.onDayEnd does not exist.");
  check(() => validateP0SystemReferences(project, itemIds, switchIds, issues));
  check(() => validateP2SystemReferences(project, itemIds, switchIds, mapIds, issues));
  check(() => validateSystemResources(project.system, resourceIds));
  check(() => collectExistingIdIssues("session.partyActorIds", project.session.partyActorIds, actorIds, issues));
  check(() => validateEndings(project, switchIds, variableIds, issues));
  check(() => validateMapConnections(project, mapIds, issues));
  check(() => validateCommonEvents(project, switchIds, context, issues));
  check(() => validateMapRecords(project, switchIds, variableIds, resourceIds, context, issues));
  check(() => validateScheduledEventIds(project, issues));
  return issues;
}

function validateP2SystemReferences(
  project: Project,
  itemIds: ReadonlySet<string>,
  switchIds: ReadonlySet<string>,
  mapIds: ReadonlySet<string>,
  issues: string[],
): void {
  collectDuplicateDefinitionIssues("database.fishSpecies", project.database.fishSpecies ?? [], issues);
  collectDuplicateDefinitionIssues("system.fishing.spots", project.system.fishing?.spots ?? [], issues);
  collectDuplicateDefinitionIssues("system.seasonalForage.areas", project.system.seasonalForage?.areas ?? [], issues);
  collectDuplicateDefinitionIssues("system.museum.rewards", project.system.museum?.rewards ?? [], issues);
  const fishIds = new Set((project.database.fishSpecies ?? []).map((fish) => fish.id));
  const recipeIds = new Set((project.system.craftRecipes ?? []).map((recipe) => recipe.id));
  const worldUnlockIds = new Set((project.system.worldUnlocks ?? []).map((unlock) => unlock.id));
  for (const fish of project.database.fishSpecies ?? []) {
    if (!itemIds.has(fish.itemId)) issues.push(`database.fishSpecies ${fish.id}: itemId does not exist: ${fish.itemId}`);
  }
  for (const spot of project.system.fishing?.spots ?? []) {
    const map = project.maps[spot.mapId];
    if (!mapIds.has(spot.mapId)) issues.push(`system.fishing.spots ${spot.id}: mapId does not exist: ${spot.mapId}`);
    else if (map && !rectFitsMap(spot.area, map.width, map.height)) issues.push(`system.fishing.spots ${spot.id}: area is out of bounds for map ${spot.mapId}`);
    collectDuplicateChildIds(`system.fishing.spots ${spot.id}: catches`, spot.catches.map((rule) => rule.fishId), issues);
    for (const rule of spot.catches) if (!fishIds.has(rule.fishId)) {
      issues.push(`system.fishing.spots ${spot.id}: fishId does not exist: ${rule.fishId}`);
    }
  }
  for (const area of project.system.seasonalForage?.areas ?? []) {
    const map = project.maps[area.mapId];
    if (!mapIds.has(area.mapId)) issues.push(`system.seasonalForage.areas ${area.id}: mapId does not exist: ${area.mapId}`);
    else if (map && !rectFitsMap(area.area, map.width, map.height)) issues.push(`system.seasonalForage.areas ${area.id}: area is out of bounds for map ${area.mapId}`);
    collectDuplicateDefinitionIssues(`system.seasonalForage.areas ${area.id}: entries`, area.entries, issues);
    for (const entry of area.entries) {
      if (entry.itemId && !itemIds.has(entry.itemId)) issues.push(`system.seasonalForage.areas ${area.id}: itemId does not exist: ${entry.itemId}`);
      for (const itemId of Object.values(entry.seasonalDrops ?? {})) if (itemId && !itemIds.has(itemId)) {
        issues.push(`system.seasonalForage.areas ${area.id}: seasonal itemId does not exist: ${itemId}`);
      }
    }
  }
  collectExistingIdIssues("system.collections.trackedItemIds", project.system.collections?.trackedItemIds ?? [], itemIds, issues);
  collectExistingIdIssues("system.museum.eligibleItemIds", project.system.museum?.eligibleItemIds ?? [], itemIds, issues);
  for (const reward of project.system.museum?.rewards ?? []) {
    collectExistingIdIssues(`system.museum.rewards ${reward.id}: required itemId`, reward.requiredItemIds ?? [], itemIds, issues);
    collectExistingIdIssues(`system.museum.rewards ${reward.id}: reward itemId`, reward.reward?.itemRewards?.map((entry) => entry.itemId) ?? [], itemIds, issues);
    if (reward.reward?.switchId && !switchIds.has(reward.reward.switchId)) issues.push(`system.museum.rewards ${reward.id}: switchId does not exist: ${reward.reward.switchId}`);
    collectExistingIdIssues(`system.museum.rewards ${reward.id}: worldUnlockId`, reward.reward?.worldUnlockIds ?? [], worldUnlockIds, issues);
    collectExistingIdIssues(`system.museum.rewards ${reward.id}: recipeId`, reward.reward?.recipeIds ?? [], recipeIds, issues);
  }
}

function collectDuplicateChildIds(label: string, values: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) issues.push(`${label}: duplicate id: ${value}`);
    seen.add(value);
  }
}

function rectFitsMap(rect: { readonly x: number; readonly y: number; readonly w: number; readonly h: number }, width: number, height: number): boolean {
  return Number.isSafeInteger(rect.x) && Number.isSafeInteger(rect.y)
    && Number.isSafeInteger(rect.w) && Number.isSafeInteger(rect.h)
    && rect.x >= 0 && rect.y >= 0 && rect.w > 0 && rect.h > 0
    && rect.x + rect.w <= width && rect.y + rect.h <= height;
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
  for (const skill of project.database.lifeSkills ?? []) {
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
  const eventIds = new Set(Object.values(project.maps).flatMap((map) => map.events.map((event) => event.id)));
  const animationIds = new Set(project.database.battleAnimations.map((record) => record.id));
  const commonEventIds = new Set(project.commonEvents.map((record) => record.id));
  repairSpatialReferences(project);
  repairFarmAnimalReferences(project);
  repairStructurePlacements(project);
  repairP2References(project);
  // 아이템이 켜는 스위치는 정의를 자동 선언한다 — 기본 카탈로그 기동석 아이템이
  // 미선언 스위치를 가리키던 구형 저장본(dew-village fixture 포함)을 자동치유.
  ensureItemSwitchDefs(project);
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
      repairNpcScheduleReferences(event, project.maps, prune);
      event.commands = pruneDanglingCommandRefs(event.commands, commonEventIds, mapIds, eventIds, prune);
      for (const page of event.pages ?? []) {
        page.commands = pruneDanglingCommandRefs(page.commands, commonEventIds, mapIds, eventIds, prune);
        repairLivingDestinations(page, mapIds, prune);
      }
    }
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages) page.commands = pruneDanglingCommandRefs(page.commands, commonEventIds, mapIds, eventIds, prune);
  }
  for (const commonEvent of project.commonEvents) {
    commonEvent.commands = pruneDanglingCommandRefs(commonEvent.commands, commonEventIds, mapIds, eventIds, prune);
  }
  prune.warnIfAny();
}

function repairP2References(project: Project): void {
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const mapIds = new Set(Object.keys(project.maps));
  const switchIds = new Set(project.switches.map((entry) => entry.id));
  const recipeIds = new Set((project.system.craftRecipes ?? []).map((entry) => entry.id));
  const unlockIds = new Set((project.system.worldUnlocks ?? []).map((entry) => entry.id));
  if (project.database.fishSpecies !== undefined) {
    project.database.fishSpecies = project.database.fishSpecies.filter((fish) => itemIds.has(fish.itemId));
  }
  const fishIds = new Set((project.database.fishSpecies ?? []).map((fish) => fish.id));
  if (project.system.fishing) {
    project.system.fishing = {
      ...project.system.fishing,
      spots: project.system.fishing.spots.flatMap((spot) => {
        const map = project.maps[spot.mapId];
        if (!mapIds.has(spot.mapId) || !map || !rectFitsMap(spot.area, map.width, map.height)) return [];
        const catches = spot.catches.filter((rule) => fishIds.has(rule.fishId));
        return catches.length ? [{ ...spot, catches }] : [];
      }),
    };
  }
  if (project.system.seasonalForage) {
    project.system.seasonalForage = {
      ...project.system.seasonalForage,
      areas: project.system.seasonalForage.areas.flatMap((area) => {
        const map = project.maps[area.mapId];
        if (!mapIds.has(area.mapId) || !map || !rectFitsMap(area.area, map.width, map.height)) return [];
        const entries = area.entries.filter((entry) => {
          if (entry.itemId && !itemIds.has(entry.itemId)) return false;
          return Object.values(entry.seasonalDrops ?? {}).every((itemId) => !itemId || itemIds.has(itemId));
        });
        return entries.length ? [{ ...area, entries }] : [];
      }),
    };
  }
  if (project.system.collections?.trackedItemIds) {
    project.system.collections = {
      ...project.system.collections,
      trackedItemIds: project.system.collections.trackedItemIds.filter((itemId) => itemIds.has(itemId)),
    };
  }
  if (project.system.museum) {
    project.system.museum = {
      ...project.system.museum,
      eligibleItemIds: project.system.museum.eligibleItemIds.filter((itemId) => itemIds.has(itemId)),
      rewards: project.system.museum.rewards.filter((reward) => {
        if ((reward.requiredItemIds ?? []).some((itemId) => !itemIds.has(itemId))) return false;
        if ((reward.reward?.itemRewards ?? []).some((entry) => !itemIds.has(entry.itemId))) return false;
        if (reward.reward?.switchId && !switchIds.has(reward.reward.switchId)) return false;
        if ((reward.reward?.worldUnlockIds ?? []).some((id) => !unlockIds.has(id))) return false;
        if ((reward.reward?.recipeIds ?? []).some((id) => !recipeIds.has(id))) return false;
        return true;
      }),
    };
  }
}

class PruneStats {
  removedMapCommands = 0;
  removedLivingDestinations = 0;
  removedCommonEventCalls = 0;
  removedScheduleDestinations = 0;
  repairedEmoteTargets = 0;

  warnIfAny(): void {
    const total = this.removedMapCommands
      + this.removedLivingDestinations
      + this.removedCommonEventCalls
      + this.removedScheduleDestinations
      + this.repairedEmoteTargets;
    if (total === 0 || typeof console === "undefined") return;
    console.warn(
      `[project] 깨진 참조 ${total}건을 정리하고 로드했습니다 — ` +
        `존재하지 않는 맵으로의 이동/타일변경 ${this.removedMapCommands}건, ` +
        `생활 이동 목적지 ${this.removedLivingDestinations}건, ` +
        `공통 이벤트 호출 ${this.removedCommonEventCalls}건, ` +
        `NPC 일정 목적지 ${this.removedScheduleDestinations}건, ` +
        `없는 이모트 대상 이벤트를 현재 이벤트로 대체 ${this.repairedEmoteTargets}건`
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
    for (const slot of Object.keys(actor.initialEquipment)) {
      if (!hasEquipmentSlot(project, slot)) issues.push(`actor ${actor.id}: initialEquipment slot does not exist: ${slot}`);
    }
    if (actor.unarmedAnimationId && !animationIds.has(actor.unarmedAnimationId)) issues.push(`actor ${actor.id}: unarmedAnimationId does not exist.`);
    capture(issues, () => validateActorResources(actor, context.resourceIds));
    if (actor.appearanceId !== undefined && !context.appearanceIds?.has(actor.appearanceId)) issues.push(`actor ${actor.id}: appearanceId does not exist: ${actor.appearanceId}`);
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
  switchIds: ReadonlySet<string>,
  issues: string[]
): void {
  for (const item of project.database.items) {
    if (item.skillId && !skillIds.has(item.skillId)) issues.push(`item ${item.id}: skillId does not exist.`);
    if (item.learnedSkillId && !skillIds.has(item.learnedSkillId)) issues.push(`item ${item.id}: learnedSkillId does not exist.`);
    if (item.activateSkillId && !skillIds.has(item.activateSkillId)) issues.push(`item ${item.id}: activateSkillId does not exist.`);
    if (item.animationId && !animationIds.has(item.animationId)) issues.push(`item ${item.id}: animationId does not exist.`);
    if (item.switchId && !switchIds.has(item.switchId)) issues.push(`item ${item.id}: switchId does not exist.`);
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
    if (!hasEquipmentSlot(project, equipment.slot)) issues.push(`equipment ${equipment.id}: slot does not exist: ${equipment.slot}`);
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
    capture(issues, () => validateOptionalResource(`monsterSpecies ${species.id}: graphic.backResourceId`, species.graphic.backResourceId, resourceIds));
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
  issues: string[],
): void {
  const seenSkills = new Set<string>();
  for (const skill of project.database.lifeSkills ?? []) {
    if (seenSkills.has(skill.id)) issues.push(`lifeSkill ${skill.id}: duplicate id.`);
    seenSkills.add(skill.id);
  }

  const seenRecipes = new Set<string>();
  for (const recipe of project.system.craftRecipes ?? []) {
    if (seenRecipes.has(recipe.id)) issues.push(`craftRecipe ${recipe.id}: duplicate id.`);
    seenRecipes.add(recipe.id);
    if (!itemIds.has(recipe.outputItemId)) issues.push(`craftRecipe ${recipe.id}: outputItemId does not exist: ${recipe.outputItemId}`);
    for (const [index, ingredient] of (recipe.ingredients ?? []).entries()) {
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

function validateFarmAnimalReferences(
  project: Project,
  itemIds: ReadonlySet<string>,
  issues: string[],
): void {
  const authoredSpecies = project.database.farmAnimalSpecies ?? [];
  collectDuplicateValuePathIssues(
    "database.farmAnimalSpecies",
    "id",
    authoredSpecies.map((row) => row.id),
    issues,
  );
  const farmSpeciesIds = new Set(authoredSpecies.map((row) => row.id));
  for (const [index, species] of authoredSpecies.entries()) {
    if (!itemIds.has(species.feedItemId)) {
      issues.push(`database.farmAnimalSpecies[${index}].feedItemId does not exist: ${species.feedItemId}`);
    }
    if (!itemIds.has(species.productItemId)) {
      issues.push(`database.farmAnimalSpecies[${index}].productItemId does not exist: ${species.productItemId}`);
    }
  }

  const buildings = project.system.farmAnimalBuildings ?? [];
  collectDuplicateValuePathIssues(
    "system.farmAnimalBuildings",
    "id",
    buildings.map((row) => row.id),
    issues,
  );
  const firstBuildingById = new Map<string, { readonly index: number; readonly row: (typeof buildings)[number] }>();
  for (const [index, building] of buildings.entries()) {
    if (!firstBuildingById.has(building.id)) firstBuildingById.set(building.id, { index, row: building });
    const map = project.maps[building.mapId];
    if (!map) {
      issues.push(`system.farmAnimalBuildings[${index}].mapId does not exist: ${building.mapId}`);
    } else if (!isMapPositionInBounds(building.x, building.y, map.width, map.height)) {
      issues.push(
        `system.farmAnimalBuildings[${index}].position (${building.x}, ${building.y}) is out of bounds for map ${building.mapId}`,
      );
    }
    for (const [speciesIndex, speciesId] of building.allowedSpeciesIds.entries()) {
      if (!farmSpeciesIds.has(speciesId)) {
        issues.push(`system.farmAnimalBuildings[${index}].allowedSpeciesIds[${speciesIndex}] does not exist: ${speciesId}`);
      }
    }
  }

  const animals = project.session.farmAnimals ?? [];
  collectDuplicateValuePathIssues(
    "session.farmAnimals",
    "instanceId",
    animals.map((row) => row.instanceId),
    issues,
  );
  const eventIds = new Set(Object.values(project.maps).flatMap((map) => map.events.map((event) => event.id)));
  const occupancy = new Map<string, number>();
  const linkedOccupancy = new Map<string, number>();
  const housingState = { farmBuildingPlacements: placementRecord(project.session.farmBuildingPlacements) };
  for (const [index, animal] of animals.entries()) {
    const speciesExists = farmSpeciesIds.has(animal.speciesId);
    if (!speciesExists) {
      issues.push(`session.farmAnimals[${index}].speciesId does not exist: ${animal.speciesId}`);
    }
    if (animal.eventId && !eventIds.has(animal.eventId)) {
      issues.push(`session.farmAnimals[${index}].eventId does not exist: ${animal.eventId}`);
    }
    if (animal.housingPlacementId !== undefined) {
      const path = `session.farmAnimals[${index}].housingPlacementId`;
      if (animal.buildingId !== undefined) issues.push(`${path} conflicts with buildingId`);
      const home = resolveAnimalHome(project, housingState, animal);
      if (!home) issues.push(`${path} does not resolve enabled housing: ${animal.housingPlacementId}`);
      else if (!home.allowedSpeciesIds.includes(animal.speciesId)) issues.push(`${path} does not allow speciesId ${animal.speciesId}`);
      else {
        const count = (linkedOccupancy.get(home.id) ?? 0) + 1;
        linkedOccupancy.set(home.id, count);
        if (count > home.capacity) issues.push(`${path} exceeds animalCapacity: ${home.id} (${home.capacity})`);
      }
      continue;
    }
    if (!animal.buildingId) continue;
    const building = firstBuildingById.get(animal.buildingId);
    if (!building) {
      issues.push(`session.farmAnimals[${index}].buildingId does not exist: ${animal.buildingId}`);
      continue;
    }
    if (!speciesExists) continue;
    if (!building.row.allowedSpeciesIds.includes(animal.speciesId)) {
      issues.push(
        `session.farmAnimals[${index}].buildingId ${animal.buildingId} does not allow speciesId ${animal.speciesId}`,
      );
      continue;
    }
    const count = (occupancy.get(animal.buildingId) ?? 0) + 1;
    occupancy.set(animal.buildingId, count);
    if (count > building.row.capacity) {
      issues.push(
        `session.farmAnimals[${index}].buildingId exceeds system.farmAnimalBuildings[${building.index}].capacity: ${animal.buildingId} (${building.row.capacity})`,
      );
    }
  }
}

function repairFarmAnimalReferences(project: Project): void {
  const itemIds = new Set(project.database.items.map((item) => item.id));
  if (project.database.farmAnimalSpecies !== undefined) {
    project.database.farmAnimalSpecies = project.database.farmAnimalSpecies.filter(
      (species) => itemIds.has(species.feedItemId) && itemIds.has(species.productItemId),
    );
  }
  const speciesIds = new Set((project.database.farmAnimalSpecies ?? []).map((species) => species.id));
  if (project.system.farmAnimalBuildings !== undefined) {
    project.system.farmAnimalBuildings = project.system.farmAnimalBuildings
      .filter((building) => {
        const map = project.maps[building.mapId];
        return Boolean(map && isMapPositionInBounds(building.x, building.y, map.width, map.height));
      })
      .map((building) => ({
        ...building,
        allowedSpeciesIds: building.allowedSpeciesIds.filter((speciesId) => speciesIds.has(speciesId)),
      }));
  }
  if (project.session.farmAnimals === undefined) return;
  const buildingById = new Map(
    (project.system.farmAnimalBuildings ?? []).map((building) => [building.id, building] as const),
  );
  const occupancy = new Map<string, number>();
  project.session.farmAnimals = project.session.farmAnimals
    .filter((animal) => speciesIds.has(animal.speciesId))
    .map((animal) => {
      if (!animal.buildingId) return animal;
      const building = buildingById.get(animal.buildingId);
      if (!building || !building.allowedSpeciesIds.includes(animal.speciesId)) {
        return withoutFarmAnimalBuilding(animal);
      }
      const count = (occupancy.get(building.id) ?? 0) + 1;
      if (count > building.capacity) return withoutFarmAnimalBuilding(animal);
      occupancy.set(building.id, count);
      return animal;
    });
}

function withoutFarmAnimalBuilding<T extends { readonly buildingId?: string }>(animal: T): Omit<T, "buildingId"> {
  const { buildingId: _removed, ...rest } = animal;
  return rest;
}

function validateSpatialReferences(
  project: Project,
  itemIds: ReadonlySet<string>,
  resourceIds: ReadonlySet<string>,
  issues: string[],
): void {
  const mapIds = new Set(Object.keys(project.maps));
  const buildingTypes = project.database.farmBuildingTypes ?? [];
  collectDuplicateValuePathIssues("database.farmBuildingTypes", "id", buildingTypes.map((row) => row.id), issues);
  const buildingTypeById = new Map(buildingTypes.map((row) => [row.id, row] as const));
  for (const [typeIndex, type] of buildingTypes.entries()) {
    for (const [index, speciesId] of (type.animalHousing?.allowedSpeciesIds ?? []).entries()) {
      if (!project.database.farmAnimalSpecies?.some((species) => species.id === speciesId)) {
        issues.push(`database.farmBuildingTypes[${typeIndex}].animalHousing.allowedSpeciesIds[${index}] does not exist: ${speciesId}`);
      }
    }
    for (const [mapIndex, mapId] of (type.allowedMapIds ?? []).entries()) {
      if (!mapIds.has(mapId)) issues.push(`database.farmBuildingTypes[${typeIndex}].allowedMapIds[${mapIndex}] does not exist: ${mapId}`);
    }
    for (const [levelIndex, level] of type.levels.entries()) {
      collectSpatialResourceIssue(`database.farmBuildingTypes[${typeIndex}].levels[${levelIndex}].graphicResourceId`, level.graphicResourceId, resourceIds, issues);
      for (const [orientation, resourceId] of Object.entries(level.orientationGraphicResourceIds ?? {})) {
        collectSpatialResourceIssue(`database.farmBuildingTypes[${typeIndex}].levels[${levelIndex}].orientationGraphicResourceIds.${orientation}`, resourceId, resourceIds, issues);
      }
      for (const [itemIndex, item] of (level.cost?.items ?? []).entries()) {
        if (!itemIds.has(item.itemId)) {
          issues.push(`database.farmBuildingTypes[${typeIndex}].levels[${levelIndex}].cost.items[${itemIndex}].itemId does not exist: ${item.itemId}`);
        }
      }
    }
  }

  const decorationTypes = project.database.homeDecorationTypes ?? [];
  collectDuplicateValuePathIssues("database.homeDecorationTypes", "id", decorationTypes.map((row) => row.id), issues);
  const decorationTypeById = new Map(decorationTypes.map((row) => [row.id, row] as const));
  for (const [typeIndex, type] of decorationTypes.entries()) {
    if (!itemIds.has(type.placementItemId)) {
      issues.push(`database.homeDecorationTypes[${typeIndex}].placementItemId does not exist: ${type.placementItemId}`);
    }
    collectSpatialResourceIssue(`database.homeDecorationTypes[${typeIndex}].graphicResourceId`, type.graphicResourceId, resourceIds, issues);
    for (const [orientation, resourceId] of Object.entries(type.orientationGraphicResourceIds ?? {})) {
      collectSpatialResourceIssue(`database.homeDecorationTypes[${typeIndex}].orientationGraphicResourceIds.${orientation}`, resourceId, resourceIds, issues);
    }
    for (const [mapIndex, mapId] of (type.allowedMapIds ?? []).entries()) {
      if (!mapIds.has(mapId)) issues.push(`database.homeDecorationTypes[${typeIndex}].allowedMapIds[${mapIndex}] does not exist: ${mapId}`);
    }
  }

  const occupied = initialSpatialOccupiedCells(project);
  const buildings = project.session.farmBuildingPlacements ?? [];
  collectDuplicateValuePathIssues("session.farmBuildingPlacements", "instanceId", buildings.map((row) => row.instanceId), issues);
  for (const [index, placement] of buildings.entries()) {
    const path = `session.farmBuildingPlacements[${index}]`;
    const type = buildingTypeById.get(placement.typeId);
    if (!type) {
      issues.push(`${path}.typeId does not exist: ${placement.typeId}`);
      continue;
    }
    const level = type.levels.find((entry) => entry.level === placement.level);
    if (!level) {
      issues.push(`${path}.level does not exist on farmBuildingType ${placement.typeId}: ${placement.level}`);
      continue;
    }
    validateAndOccupySpatialPlacement(project, path, placement, level.footprint, type.allowedMapIds, occupied, issues);
  }

  const decorations = project.session.homeDecorationPlacements ?? [];
  collectDuplicateValuePathIssues("session.homeDecorationPlacements", "instanceId", decorations.map((row) => row.instanceId), issues);
  for (const [index, placement] of decorations.entries()) {
    const path = `session.homeDecorationPlacements[${index}]`;
    const type = decorationTypeById.get(placement.typeId);
    if (!type) {
      issues.push(`${path}.typeId does not exist: ${placement.typeId}`);
      continue;
    }
    if (!type.allowedOrientations.includes(placement.orientation)) {
      issues.push(`${path}.orientation is not allowed by homeDecorationType ${placement.typeId}: ${placement.orientation}`);
      continue;
    }
    validateAndOccupySpatialPlacement(project, path, placement, type.footprint, type.allowedMapIds, occupied, issues);
  }
}

function repairSpatialReferences(project: Project): void {
  const itemIds = new Set(project.database.items.map((item) => item.id));
  const resourceIds = collectResourceIds(project);
  const mapIds = new Set(Object.keys(project.maps));
  if (project.database.farmBuildingTypes !== undefined) {
    project.database.farmBuildingTypes = uniqueById(project.database.farmBuildingTypes)
      .filter((type) => type.levels.length > 0 && type.levels.every((level) => (
        isSpatialFootprint(level.footprint)
        && resourceIds.has(level.graphicResourceId)
        && Object.values(level.orientationGraphicResourceIds ?? {}).every((id) => resourceIds.has(id))
        && (level.cost?.items ?? []).every((entry) => itemIds.has(entry.itemId))
      )))
      .map((type) => ({ ...type, ...repairedAllowedMaps(type.allowedMapIds, mapIds) }));
  }
  if (project.database.homeDecorationTypes !== undefined) {
    project.database.homeDecorationTypes = uniqueById(project.database.homeDecorationTypes)
      .filter((type) => itemIds.has(type.placementItemId)
        && isSpatialFootprint(type.footprint)
        && resourceIds.has(type.graphicResourceId)
        && Object.values(type.orientationGraphicResourceIds ?? {}).every((id) => resourceIds.has(id)))
      .map((type) => ({ ...type, ...repairedAllowedMaps(type.allowedMapIds, mapIds) }));
  }

  const buildingTypeById = new Map((project.database.farmBuildingTypes ?? []).map((row) => [row.id, row] as const));
  const decorationTypeById = new Map((project.database.homeDecorationTypes ?? []).map((row) => [row.id, row] as const));
  const occupied = initialSpatialOccupiedCells(project);
  const repairedBuildings = [] as NonNullable<Project["session"]["farmBuildingPlacements"]>;
  const buildingIds = new Set<string>();
  for (const placement of project.session.farmBuildingPlacements ?? []) {
    if (buildingIds.has(placement.instanceId)) continue;
    const type = buildingTypeById.get(placement.typeId);
    const level = type?.levels.find((entry) => entry.level === placement.level);
    if (!type || !level || !canOccupyAuthoredPlacement(project, placement, level.footprint, type.allowedMapIds, occupied)) continue;
    buildingIds.add(placement.instanceId);
    repairedBuildings.push(placement);
  }
  if (project.session.farmBuildingPlacements !== undefined) project.session.farmBuildingPlacements = repairedBuildings;

  const repairedDecorations = [] as NonNullable<Project["session"]["homeDecorationPlacements"]>;
  const decorationIds = new Set<string>();
  for (const placement of project.session.homeDecorationPlacements ?? []) {
    if (decorationIds.has(placement.instanceId)) continue;
    const type = decorationTypeById.get(placement.typeId);
    if (!type
      || !type.allowedOrientations.includes(placement.orientation)
      || !canOccupyAuthoredPlacement(project, placement, type.footprint, type.allowedMapIds, occupied)) continue;
    decorationIds.add(placement.instanceId);
    repairedDecorations.push(placement);
  }
  if (project.session.homeDecorationPlacements !== undefined) project.session.homeDecorationPlacements = repairedDecorations;
}

function validateAndOccupySpatialPlacement(
  project: Project,
  path: string,
  placement: { readonly mapId: string; readonly x: number; readonly y: number; readonly orientation: import("../types").Dir },
  footprint: import("../types").SpatialFootprint,
  allowedMapIds: readonly string[] | undefined,
  occupied: Map<string, Set<string>>,
  issues: string[],
): void {
  const map = project.maps[placement.mapId];
  if (!map) {
    issues.push(`${path}.mapId does not exist: ${placement.mapId}`);
    return;
  }
  if (allowedMapIds && allowedMapIds.length > 0 && !allowedMapIds.includes(placement.mapId)) {
    issues.push(`${path}.mapId is not allowed by type: ${placement.mapId}`);
    return;
  }
  if (!isSpatialOrientation(placement.orientation) || !isSpatialFootprint(footprint)) {
    issues.push(`${path}.footprint is invalid`);
    return;
  }
  const cells = footprintCells(placement.x, placement.y, footprint, placement.orientation);
  if (cells.length === 0 || cells.some((cell) => !inBounds(map, cell.x, cell.y))) {
    issues.push(`${path}.footprint is out of bounds for map ${placement.mapId}`);
    return;
  }
  if (cells.some((cell) => !isPassable(project, map, cell.x, cell.y))) {
    issues.push(`${path}.footprint contains an impassable tile on map ${placement.mapId}`);
    return;
  }
  const mapOccupied = occupied.get(placement.mapId) ?? new Set<string>();
  if (cells.some((cell) => mapOccupied.has(`${cell.x},${cell.y}`))) {
    issues.push(`${path}.footprint overlaps another spatial placement`);
    return;
  }
  for (const cell of cells) mapOccupied.add(`${cell.x},${cell.y}`);
  occupied.set(placement.mapId, mapOccupied);
}

function canOccupyAuthoredPlacement(
  project: Project,
  placement: { readonly mapId: string; readonly x: number; readonly y: number; readonly orientation: import("../types").Dir },
  footprint: import("../types").SpatialFootprint,
  allowedMapIds: readonly string[] | undefined,
  occupied: Map<string, Set<string>>,
): boolean {
  const issues: string[] = [];
  validateAndOccupySpatialPlacement(project, "placement", placement, footprint, allowedMapIds, occupied, issues);
  return issues.length === 0;
}

function initialSpatialOccupiedCells(project: Project): Map<string, Set<string>> {
  const occupied = new Map<string, Set<string>>();
  for (const placeable of Object.values(project.session.placeables ?? {})) {
    const cells = occupied.get(placeable.mapId) ?? new Set<string>();
    cells.add(`${placeable.x},${placeable.y}`);
    occupied.set(placeable.mapId, cells);
  }
  return occupied;
}

function collectSpatialResourceIssue(path: string, resourceId: string, resourceIds: ReadonlySet<string>, issues: string[]): void {
  if (!resourceIds.has(resourceId)) issues.push(`${path} does not exist: ${resourceId}`);
}

function uniqueById<T extends { readonly id: string }>(rows: readonly T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

function repairedAllowedMaps(
  allowedMapIds: readonly string[] | undefined,
  mapIds: ReadonlySet<string>,
): { readonly allowedMapIds?: string[] } {
  if (!allowedMapIds) return {};
  const kept = allowedMapIds.filter((mapId) => mapIds.has(mapId));
  return kept.length > 0 ? { allowedMapIds: kept } : {};
}

function collectDuplicateValuePathIssues(
  collectionPath: string,
  field: string,
  values: readonly string[],
  issues: string[],
): void {
  const firstIndexByValue = new Map<string, number>();
  for (const [index, value] of values.entries()) {
    const firstIndex = firstIndexByValue.get(value);
    if (firstIndex !== undefined) {
      issues.push(`${collectionPath}[${index}].${field} duplicates ${collectionPath}[${firstIndex}].${field}: ${value}`);
      continue;
    }
    firstIndexByValue.set(value, index);
  }
}

function isMapPositionInBounds(x: number, y: number, width: number, height: number): boolean {
  return Number.isInteger(x)
    && Number.isInteger(y)
    && x >= 0
    && y >= 0
    && x < width
    && y < height;
}

function validateTroopRecords(project: Project, enemyIds: ReadonlySet<string>, context: ReferenceContext, issues: string[]): void {
  for (const troop of project.database.troops) {
    collectExistingIdIssues(`troop ${troop.id}: enemy`, troop.enemyIds, enemyIds, issues);
    if (troop.members) validateTroopMembers(troop.id, troop.members, enemyIds, issues);
    capture(issues, () => validateBattleEventPages(troop.battleEventPages, { ...context, enemySlotIds: new Set(troop.enemyIds.map((_, index) => `enemy-${index + 1}`)) }));
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
  for (const [hostMapId, map] of Object.entries(project.maps)) {
    if (project.tilesets[map.tilesetId] === undefined) issues.push(`map ${map.id}: tilesetId does not exist.`);
    collectExistingIdIssues(`map ${map.id}: troopIds`, map.troopIds ?? [], context.troopIds, issues);
    // 빈 imageId 는 「맵 배경 사용」 을 켜고 아직 안 고른 저작 상태다 — 참조가 아니다.
    const backgroundImageId = map.background?.imageId;
    if (backgroundImageId) {
      capture(issues, () => validateOptionalResource(`map ${map.id}: background.imageId`, backgroundImageId, resourceIds));
    }
    for (const [index, entry] of (map.encounterTable ?? []).entries()) {
      if (!context.troopIds.has(entry.troopId)) issues.push(`map ${map.id}: encounterTable[${index}].troopId does not exist: ${entry.troopId}`);
      if (entry.conditions?.switchId) collectExistingIdIssues(`map ${map.id}: encounterTable[${index}].conditions.switchId`, [entry.conditions.switchId], switchIds, issues);
      if (entry.conditions?.variableId) collectExistingIdIssues(`map ${map.id}: encounterTable[${index}].conditions.variableId`, [entry.conditions.variableId], variableIds, issues);
    }
    for (const [index, spawn] of (map.fieldSpawns ?? []).entries()) {
      if (!context.troopIds.has(spawn.troopId)) issues.push(`map ${map.id}: fieldSpawns[${index}].troopId does not exist: ${spawn.troopId}`);
      capture(issues, () => validateOptionalResource(`map ${map.id}: fieldSpawns[${index}].graphic.sprite`, spawn.graphic?.sprite?.id, resourceIds));
      // 구역 앵커가 끊겼는지. 런타임은 옛 area 로 폴백하므로 조용히 «옮긴 구역을 안 따라오는»
      // 상태가 된다 — 참조 검증이 그 사실을 올려야 한다(인카운터의 locationId 와 같은 규칙).
      if (spawn.locationId && !(map.locations ?? []).some((location) => location.id === spawn.locationId)) {
        issues.push(`map ${map.id}: fieldSpawns[${index}].locationId does not exist: ${spawn.locationId}`);
      }
    }
    const fieldSpawnIds = new Set((map.fieldSpawns ?? []).map((spawn) => spawn.id));
    for (const [slotIndex, slot] of (map.roguelikeRoom?.encounterSlots ?? []).entries()) {
      for (const [choiceIndex, choice] of slot.choices.entries()) {
        if (!fieldSpawnIds.has(choice.fieldSpawnId)) {
          issues.push(`map ${map.id}: roguelikeRoom.encounterSlots[${slotIndex}].choices[${choiceIndex}].fieldSpawnId does not exist: ${choice.fieldSpawnId}`);
        }
      }
    }
    validateStructurePlacements(map, issues);
    for (const [eventIndex, event] of map.events.entries()) {
      validateNpcScheduleReferences(project, hostMapId, event, eventIndex, issues);
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

/**
 * 구조물 배치(map.structurePlacements) 검증 — FarmBuildingPlacement 선례와 같은 규약으로
 * **repairStructurePlacements 가 떨어뜨리는 것만** 이슈로 본다(중복 id · 맵 밖 · 손상된 before).
 *
 * 킷이 삭제된 배치는 일부러 이슈가 아니다: 사용자가 데이터베이스에서 킷을 지우는 순간
 * 프로젝트가 열리지 않게 되기 때문이다. 고아 배치는 드롭하지 않고 UI 에서 고아로 표시하며
 * (지우기는 되고 재시공만 막힌다), 정합성 계층은 손대지 않는다.
 */
function validateStructurePlacements(map: GameMap, issues: string[]): void {
  const placements = map.structurePlacements ?? [];
  collectDuplicateValuePathIssues(`map ${map.id}: structurePlacements`, "id", placements.map((row) => row.id), issues);
  for (const [index, placement] of placements.entries()) {
    const path = `map ${map.id}: structurePlacements[${index}]`;
    if (!structureRectFitsMap(placement, map)) {
      issues.push(`${path} is out of bounds for map ${map.id}: (${placement.x},${placement.y}) ${placement.w}x${placement.h}`);
      continue;
    }
    if (!structurePlacementBeforeIsWellFormed(placement)) {
      issues.push(`${path}.before length does not match ${placement.w}x${placement.h}`);
    }
  }
}

/**
 * 맵 축소 등으로 범위를 벗어난 배치와 손상된 기록을 드롭한다. 킷 삭제로 생긴 고아는 **남긴다** —
 * 지우기로 찍기 전 타일을 되돌릴 수 있어야 하고, 그 정보는 배치 레코드에만 있다.
 */
function repairStructurePlacements(project: Project): void {
  for (const map of Object.values(project.maps)) {
    if (map.structurePlacements === undefined) continue;
    const seen = new Set<string>();
    map.structurePlacements = map.structurePlacements.filter((placement) => {
      if (seen.has(placement.id)) return false;
      if (!structureRectFitsMap(placement, map)) return false;
      if (!structurePlacementBeforeIsWellFormed(placement)) return false;
      seen.add(placement.id);
      return true;
    });
  }
}

function validateNpcScheduleReferences(
  project: Project,
  hostMapId: string,
  event: GameEvent,
  eventIndex: number,
  issues: string[],
): void {
  for (const [scheduleIndex, entry] of (event.schedule ?? []).entries()) {
    const label = `map ${hostMapId} event ${event.id} events[${eventIndex}] schedule[${scheduleIndex}]`;
    const mapId: unknown = entry.at.mapId;
    const target = typeof mapId === "string" ? project.maps[mapId] : undefined;
    if (typeof mapId !== "string" || !mapId.trim() || !target) {
      const displayId = typeof mapId !== "string" ? "<missing>" : mapId.trim() ? mapId : "<blank>";
      issues.push(`${label}.at.mapId does not exist: ${displayId}`);
      continue;
    }
    if (!isSchedulePositionInBounds(entry, target.width, target.height)) {
      issues.push(
        `${label}.at (${entry.at.x}, ${entry.at.y}) is out of bounds for map ${entry.at.mapId} (${target.width}x${target.height}).`,
      );
    }
  }
}

function validateScheduledEventIds(project: Project, issues: string[]): void {
  const hostsById = new Map<string, Array<{ hostMapId: string; eventIndex: number; scheduled: boolean }>>();
  for (const [hostMapId, map] of Object.entries(project.maps)) {
    for (const [eventIndex, event] of map.events.entries()) {
      const hosts = hostsById.get(event.id) ?? [];
      hosts.push({ hostMapId, eventIndex, scheduled: (event.schedule?.length ?? 0) > 0 });
      hostsById.set(event.id, hosts);
    }
  }
  for (const [eventId, hosts] of hostsById) {
    if (hosts.length < 2 || !hosts.some((host) => host.scheduled)) continue;
    issues.push(
      `scheduled event id must be unique across the project: ${eventId}; hosts: ${hosts
        .map((host) => `${host.hostMapId}.events[${host.eventIndex}]`)
        .join(", ")}`,
    );
  }
}

function repairNpcScheduleReferences(
  event: GameEvent,
  maps: Project["maps"],
  stats: PruneStats,
): void {
  if (event.schedule === undefined) return;
  const kept = event.schedule.filter((entry) => {
    const mapId: unknown = entry.at.mapId;
    const target = typeof mapId === "string" ? maps[mapId] : undefined;
    return Boolean(
      typeof mapId === "string"
      && mapId.trim()
      && target
      && isSchedulePositionInBounds(entry, target.width, target.height),
    );
  });
  stats.removedScheduleDestinations += event.schedule.length - kept.length;
  event.schedule = kept;
}

function isSchedulePositionInBounds(
  entry: NpcScheduleEntry,
  width: number,
  height: number,
): boolean {
  return Number.isInteger(entry.at.x)
    && Number.isInteger(entry.at.y)
    && entry.at.x >= 0
    && entry.at.y >= 0
    && entry.at.x < width
    && entry.at.y < height;
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
  for (const id of Object.values(equipment ?? {})) {
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
  eventIds: ReadonlySet<string>,
  stats: PruneStats
): Command[] {
  const recurse = (branch: Command[]): Command[] => pruneDanglingCommandRefs(branch, commonEventIds, mapIds, eventIds, stats);
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
    if (command.kind === "showEmote" && typeof command.target === "object"
      && command.target.eventId.trim().length > 0 && !eventIds.has(command.target.eventId)) {
      stats.repairedEmoteTargets += 1;
      pruned.push({ ...command, target: { eventId: "" } });
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
