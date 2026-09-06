import { isEquipmentSlotId } from "@/project/equipmentSlots";
import { isGenrePackId } from "@/project/genrePackId";
import { TOOL_CAPABILITY_AXIS_MAX, TOOL_CAPABILITY_TILE_MAX } from "@/project/upgrades";
import { ITEM_QUANTITY_MAX } from "@/project/itemQuantities";
import {
  FARM_ANIMAL_BUILDING_CAPACITY_MAX,
  FARM_ANIMAL_FRIENDSHIP_MAX,
  FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX,
  FARM_ANIMAL_RECORD_LIMIT,
  WEATHER_FORECAST_DAYS_MAX,
  WEATHER_RULES_PER_SEASON_LIMIT,
  WEATHER_WEIGHT_MAX,
  isWeatherKind,
} from "@/project/p1FoundationRecords";
import { P2_COUNT_MAX, P2_RECORD_LIMIT, P2_RULE_LIMIT, P2_WEIGHT_MAX } from "@/project/p2FoundationRecords";
import { isSeason, isTimePhase } from "@/project/gameTime";
import {
  SPATIAL_CAPACITY_MAX,
  SPATIAL_COST_ITEM_LIMIT,
  SPATIAL_DEFINITION_LIMIT,
  SPATIAL_FOOTPRINT_AXIS_MAX,
  SPATIAL_FOOTPRINT_TILE_MAX,
  SPATIAL_LEVEL_LIMIT,
  SPATIAL_PLACEMENT_LIMIT,
  isSpatialOrientation,
} from "@/project/spatialPlacements";
import { GOLD_MAX } from "@/project/economyValues";
import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { validateFootprintPair } from "./shapeEventFields";
import { validateCharacterAppearances } from "./characterAppearanceValidation";

export function validateDatabase(value: unknown): void {
  const database = requireRecord("database", value);
  if (database.characterAppearances !== undefined) validateCharacterAppearances(database.characterAppearances);
  for (const key of [
    "actors",
    "classes",
    "skills",
    "items",
    "equipment",
    "enemies",
    "troops",
    "states",
    "battleAnimations",
  ]) {
    requireArray(`database.${key}`, database[key]);
  }
  if (database.equipmentSlots !== undefined) {
    const slots = requireArray("database.equipmentSlots", database.equipmentSlots);
    const ids = new Set<string>();
    for (const raw of slots) {
      const slot = requireRecord("equipment slot", raw);
      const id = requireString("equipment slot.id", slot.id);
      assert(isEquipmentSlotId(id), `Invalid equipment slot id: ${id}`);
      assert(!ids.has(id), `Duplicate equipment slot id: ${id}`);
      ids.add(id);
      assert(requireString("equipment slot.label", slot.label).trim().length > 0, "Equipment slot label must not be blank");
    }
  }
  for (const raw of database.actors as unknown[]) {
    const actor = requireRecord("actor", raw);
    if (actor.appearanceId !== undefined) {
      assert(requireString("actor.appearanceId", actor.appearanceId).trim().length > 0, "actor.appearanceId is blank");
    }
    if (actor.initialEquipment === undefined) continue;
    for (const [slot, id] of Object.entries(requireRecord("actor.initialEquipment", actor.initialEquipment))) {
      assert(isEquipmentSlotId(slot), `Invalid equipment slot id: ${slot}`);
      if (id !== undefined) requireString(`actor.initialEquipment.${slot}`, id);
    }
  }
  if (database.elements !== undefined) requireArray("database.elements", database.elements);
  if (database.terrains !== undefined) requireArray("database.terrains", database.terrains);
  if (database.battleCommands !== undefined) requireArray("database.battleCommands", database.battleCommands);
  if (database.monsterSpecies !== undefined) requireArray("database.monsterSpecies", database.monsterSpecies);
  if (database.crops !== undefined) requireArray("database.crops", database.crops);
  // 가드가 없으면 normalizeDatabaseRecords 의 .map 이 TypeError 로 터져 프로젝트 전체가 열리지 않는다
  // (손상·수작업 편집된 JSON 에서 실제로 재현됨). 다른 옵셔널 컬렉션과 동일 계약으로 맞춘다.
  if (database.lifeSkills !== undefined) requireArray("database.lifeSkills", database.lifeSkills);
  if (database.farmAnimalSpecies !== undefined) validateFarmAnimalSpecies(database.farmAnimalSpecies);
  if (database.fishSpecies !== undefined) validateFishSpecies(database.fishSpecies);
  if (database.farmBuildingTypes !== undefined) validateFarmBuildingTypes(database.farmBuildingTypes);
  if (database.homeDecorationTypes !== undefined) validateHomeDecorationTypes(database.homeDecorationTypes);
}

export function validateSystem(value: unknown): void {
  const system = requireRecord("system", value);
  requireArray("system.startActorIds", system.startActorIds);
  if (system.battleCommandCss !== undefined) requireString("system.battleCommandCss", system.battleCommandCss);
  // 주인공 몸 크기는 이벤트 페이지와 **같은 경계**로 막는다(2차 §9). 한쪽만 검증하면
  // `playerFootprint: {width: -5}` 가 로드를 통과하고 런타임 정규화만이 마지막 방어선이 된다.
  validateFootprintPair("system.playerFootprint", system.playerFootprint, "system.playerPassRows", system.playerPassRows);
  if (system.playResolution !== undefined) {
    const playResolution = requireRecord("system.playResolution", system.playResolution);
    requireNumber("system.playResolution.width", playResolution.width);
    requireNumber("system.playResolution.height", playResolution.height);
  }
  if (system.genre !== undefined) {
    requireString("system.genre", system.genre);
    assert(isGenrePackId(system.genre), `system.genre is not a supported genre pack id: ${system.genre}`);
  }
  if (system.titleScreen !== undefined) {
    const titleScreen = requireRecord("system.titleScreen", system.titleScreen);
    // additive optional 배열 — 있으면 배열이기만 하면 된다. 요소 정합은 normalize 가 관대하게 거른다
    // (무효 레이어는 drop). 배열이 아니면 normalize 의 순회가 TypeError 로 터지므로 여기서 가드한다.
    if (titleScreen.backgroundLayers !== undefined) {
      requireArray("system.titleScreen.backgroundLayers", titleScreen.backgroundLayers);
    }
  }
  if (system.monsterCollection !== undefined) requireBoolean("system.monsterCollection", system.monsterCollection);
  if (system.monsterBattleParty !== undefined) requireBoolean("system.monsterBattleParty", system.monsterBattleParty);
  if (system.giftSystem !== undefined) requireBoolean("system.giftSystem", system.giftSystem);
  if (system.timeSystem !== undefined) validateTimeSystem(system.timeSystem);
  if (system.worldGen !== undefined) {
    const worldGen = requireRecord("system.worldGen", system.worldGen);
    if (worldGen.water !== undefined) requireRecord("system.worldGen.water", worldGen.water);
    if (worldGen.forest !== undefined) requireRecord("system.worldGen.forest", worldGen.forest);
    if (worldGen.road !== undefined) requireRecord("system.worldGen.road", worldGen.road);
    if (worldGen.useBuiltinKeywords !== undefined) requireBoolean("system.worldGen.useBuiltinKeywords", worldGen.useBuiltinKeywords);
    if (worldGen.presetId !== undefined) requireString("system.worldGen.presetId", worldGen.presetId);
    if (worldGen.keywords !== undefined) {
      const keywords = requireArray("system.worldGen.keywords", worldGen.keywords);
      for (const [index, raw] of keywords.entries()) {
        const rule = requireRecord(`system.worldGen.keywords[${index}]`, raw);
        requireString(`system.worldGen.keywords[${index}].id`, rule.id);
        requireString(`system.worldGen.keywords[${index}].label`, rule.label);
        requireArray(`system.worldGen.keywords[${index}].words`, rule.words);
        requireArray(`system.worldGen.keywords[${index}].landmarks`, rule.landmarks);
        if (rule.exceptWords !== undefined) requireArray(`system.worldGen.keywords[${index}].exceptWords`, rule.exceptWords);
        if (rule.enabled !== undefined) requireBoolean(`system.worldGen.keywords[${index}].enabled`, rule.enabled);
      }
    }
  }
  if (system.energy !== undefined) validateEnergySystem(system.energy);
  if (system.shipping !== undefined) validateShippingSystem(system.shipping);
  if (system.worldUnlocks !== undefined) validateWorldUnlocks(system.worldUnlocks);
  if (system.bundles !== undefined) validateBundles(system.bundles);
  if (system.makers !== undefined) validateMakers(system.makers);
  if (system.dailyWeather !== undefined) validateDailyWeather(system.dailyWeather);
  if (system.farmAnimalBuildings !== undefined) validateFarmAnimalBuildings(system.farmAnimalBuildings);
  if (system.fishing !== undefined) validateFishing(system.fishing);
  if (system.seasonalForage !== undefined) validateSeasonalForage(system.seasonalForage);
  if (system.collections !== undefined) validateCollections(system.collections);
  if (system.museum !== undefined) validateMuseum(system.museum);
  if (system.craftRecipes !== undefined) validateCraftRecipes(system.craftRecipes);
  if (system.itemUpgrades !== undefined) validateItemUpgrades(system.itemUpgrades);
  if (system.sellPrices !== undefined) validateSellPrices(system.sellPrices);
  if (system.typeChart !== undefined) {
    const chart = requireRecord("system.typeChart", system.typeChart);
    requireArray("system.typeChart.types", chart.types);
    requireRecord("system.typeChart.multipliers", chart.multipliers);
  }
}

function validateFishSpecies(value: unknown): void {
  const rows = requireArray("database.fishSpecies", value);
  assert(rows.length <= P2_RECORD_LIMIT, `database.fishSpecies must contain at most ${P2_RECORD_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const label = `database.fishSpecies[${index}]`;
    const row = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, row.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    requireNonBlankString(`${label}.name`, row.name);
    requireNonBlankString(`${label}.itemId`, row.itemId);
    if (row.skillXp !== undefined) assertSafeIntegerInRange(`${label}.skillXp`, row.skillXp, 0, P2_COUNT_MAX);
  }
}

function validateFishing(value: unknown): void {
  const config = requireRecord("system.fishing", value);
  requireBoolean("system.fishing.enabled", config.enabled);
  if (config.energyCost !== undefined) assertSafeIntegerInRange("system.fishing.energyCost", config.energyCost, 0, P2_COUNT_MAX);
  const spots = requireArray("system.fishing.spots", config.spots);
  assert(spots.length <= P2_RECORD_LIMIT, `system.fishing.spots must contain at most ${P2_RECORD_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of spots.entries()) {
    const label = `system.fishing.spots[${index}]`;
    const spot = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, spot.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    if (spot.name !== undefined) requireString(`${label}.name`, spot.name);
    requireNonBlankString(`${label}.mapId`, spot.mapId);
    validateRect(`${label}.area`, spot.area);
    const catches = requireArray(`${label}.catches`, spot.catches);
    assert(catches.length <= P2_RULE_LIMIT, `${label}.catches must contain at most ${P2_RULE_LIMIT} records.`);
    const seenFish = new Set<string>();
    for (const [catchIndex, catchRaw] of catches.entries()) {
      const catchLabel = `${label}.catches[${catchIndex}]`;
      const rule = requireRecord(catchLabel, catchRaw);
      const fishId = requireNonBlankString(`${catchLabel}.fishId`, rule.fishId);
      assert(!seenFish.has(fishId), `${catchLabel}.fishId is duplicated: ${fishId}`);
      seenFish.add(fishId);
      assertSafeIntegerInRange(`${catchLabel}.weight`, rule.weight, 1, P2_WEIGHT_MAX);
      if (rule.minSkillLevel !== undefined) assertSafeIntegerInRange(`${catchLabel}.minSkillLevel`, rule.minSkillLevel, 1, 99);
      if (rule.seasons !== undefined) validateEnumArray(`${catchLabel}.seasons`, rule.seasons, isSeason);
      if (rule.timePhases !== undefined) validateEnumArray(`${catchLabel}.timePhases`, rule.timePhases, isTimePhase);
      if (rule.weatherKinds !== undefined) validateEnumArray(`${catchLabel}.weatherKinds`, rule.weatherKinds, isWeatherKind);
    }
  }
}

function validateSeasonalForage(value: unknown): void {
  const config = requireRecord("system.seasonalForage", value);
  requireBoolean("system.seasonalForage.enabled", config.enabled);
  const areas = requireArray("system.seasonalForage.areas", config.areas);
  assert(areas.length <= P2_RECORD_LIMIT, `system.seasonalForage.areas must contain at most ${P2_RECORD_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of areas.entries()) {
    const label = `system.seasonalForage.areas[${index}]`;
    const area = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, area.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    if (area.name !== undefined) requireString(`${label}.name`, area.name);
    requireNonBlankString(`${label}.mapId`, area.mapId);
    validateRect(`${label}.area`, area.area);
    assertSafeIntegerInRange(`${label}.dailySpawnCount`, area.dailySpawnCount, 0, P2_COUNT_MAX);
    assertSafeIntegerInRange(`${label}.maxActive`, area.maxActive, 0, P2_COUNT_MAX);
    if (area.spawnEveryDays !== undefined) assertSafeIntegerInRange(`${label}.spawnEveryDays`, area.spawnEveryDays, 1, 3_650);
    assertSafeIntegerInRange(`${label}.despawnAfterDays`, area.despawnAfterDays, 1, 3_650);
    const entries = requireArray(`${label}.entries`, area.entries);
    assert(entries.length <= P2_RULE_LIMIT, `${label}.entries must contain at most ${P2_RULE_LIMIT} records.`);
    const entryIds = new Set<string>();
    for (const [entryIndex, entryRaw] of entries.entries()) {
      const entryLabel = `${label}.entries[${entryIndex}]`;
      const entry = requireRecord(entryLabel, entryRaw);
      const entryId = requireNonBlankString(`${entryLabel}.id`, entry.id);
      assert(!entryIds.has(entryId), `${entryLabel}.id is duplicated: ${entryId}`);
      entryIds.add(entryId);
      assertSafeIntegerInRange(`${entryLabel}.weight`, entry.weight, 1, P2_WEIGHT_MAX);
      if (entry.itemId !== undefined) requireNonBlankString(`${entryLabel}.itemId`, entry.itemId);
      if (entry.seasonalDrops !== undefined) {
        const drops = requireRecord(`${entryLabel}.seasonalDrops`, entry.seasonalDrops);
        for (const [season, itemId] of Object.entries(drops)) {
          assert(isSeason(season), `${entryLabel}.seasonalDrops contains an unknown season: ${season}`);
          requireNonBlankString(`${entryLabel}.seasonalDrops.${season}`, itemId);
        }
      }
      assert(entry.itemId !== undefined || entry.seasonalDrops !== undefined, `${entryLabel} must define itemId or seasonalDrops.`);
    }
  }
}

function validateCollections(value: unknown): void {
  const config = requireRecord("system.collections", value);
  requireBoolean("system.collections.enabled", config.enabled);
  if (config.trackedItemIds !== undefined) validateUniqueStringArray("system.collections.trackedItemIds", config.trackedItemIds, P2_RECORD_LIMIT);
}

function validateMuseum(value: unknown): void {
  const config = requireRecord("system.museum", value);
  requireBoolean("system.museum.enabled", config.enabled);
  validateUniqueStringArray("system.museum.eligibleItemIds", config.eligibleItemIds, P2_RECORD_LIMIT);
  const rewards = requireArray("system.museum.rewards", config.rewards);
  assert(rewards.length <= P2_RECORD_LIMIT, `system.museum.rewards must contain at most ${P2_RECORD_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rewards.entries()) {
    const label = `system.museum.rewards[${index}]`;
    const reward = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, reward.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    if (reward.name !== undefined) requireString(`${label}.name`, reward.name);
    if (reward.minDonations !== undefined) assertSafeIntegerInRange(`${label}.minDonations`, reward.minDonations, 1, P2_COUNT_MAX);
    if (reward.requiredItemIds !== undefined) validateUniqueStringArray(`${label}.requiredItemIds`, reward.requiredItemIds, P2_RECORD_LIMIT);
    assert(reward.minDonations !== undefined || reward.requiredItemIds !== undefined, `${label} needs minDonations or requiredItemIds.`);
    if (reward.reward !== undefined) validateBundleReward(`${label}.reward`, reward.reward);
  }
}

function validateBundleReward(label: string, value: unknown): void {
  const reward = requireRecord(label, value);
  if (reward.gold !== undefined) assertSafeIntegerInRange(`${label}.gold`, reward.gold, 0, P2_COUNT_MAX);
  if (reward.itemRewards !== undefined) validateItemAmounts(`${label}.itemRewards`, reward.itemRewards, false);
  if (reward.switchId !== undefined) requireNonBlankString(`${label}.switchId`, reward.switchId);
  if (reward.worldUnlockIds !== undefined) validateUniqueStringArray(`${label}.worldUnlockIds`, reward.worldUnlockIds, P2_RECORD_LIMIT);
  if (reward.recipeIds !== undefined) validateUniqueStringArray(`${label}.recipeIds`, reward.recipeIds, P2_RECORD_LIMIT);
}

function validateRect(label: string, value: unknown): void {
  const rect = requireRecord(label, value);
  assertSafeInteger(`${label}.x`, rect.x);
  assertSafeInteger(`${label}.y`, rect.y);
  assertSafeIntegerInRange(`${label}.w`, rect.w, 1, P2_COUNT_MAX);
  assertSafeIntegerInRange(`${label}.h`, rect.h, 1, P2_COUNT_MAX);
}

function validateEnumArray<T extends string>(label: string, value: unknown, guard: (entry: unknown) => entry is T): void {
  const seen = new Set<string>();
  for (const [index, entry] of requireArray(label, value).entries()) {
    assert(guard(entry), `${label}[${index}] is invalid: ${String(entry)}`);
    assert(!seen.has(entry), `${label}[${index}] is duplicated: ${entry}`);
    seen.add(entry);
  }
}

function validateCraftRecipes(value: unknown): void {
  const seen = new Set<string>();
  for (const [index, raw] of requireArray("system.craftRecipes", value).entries()) {
    const label = `system.craftRecipes[${index}]`;
    const recipe = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, recipe.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    if (recipe.name !== undefined) requireString(`${label}.name`, recipe.name);
    validateItemAmounts(`${label}.ingredients`, recipe.ingredients, false);
    requireNonBlankString(`${label}.outputItemId`, recipe.outputItemId);
    if (recipe.outputCount !== undefined) assertPositiveNumber(`${label}.outputCount`, recipe.outputCount);
    if (recipe.goldCost !== undefined) assertNonNegativeNumber(`${label}.goldCost`, recipe.goldCost);
    if (recipe.requiresUnlock !== undefined) requireBoolean(`${label}.requiresUnlock`, recipe.requiresUnlock);
  }
}

function validateItemUpgrades(value: unknown): void {
  const seen = new Set<string>();
  for (const [index, raw] of requireArray("system.itemUpgrades", value).entries()) {
    const label = `system.itemUpgrades[${index}]`;
    const upgrade = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, upgrade.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    requireNonBlankString(`${label}.fromItemId`, upgrade.fromItemId);
    requireNonBlankString(`${label}.toItemId`, upgrade.toItemId);
    if (upgrade.goldCost !== undefined) assertNonNegativeNumber(`${label}.goldCost`, upgrade.goldCost);
    if (upgrade.ingredients !== undefined) validateItemAmounts(`${label}.ingredients`, upgrade.ingredients, false);
    if (upgrade.capability !== undefined) {
      const capability = requireRecord(`${label}.capability`, upgrade.capability);
      const areaWidth = requireNumber(`${label}.capability.areaWidth`, capability.areaWidth);
      const areaHeight = requireNumber(`${label}.capability.areaHeight`, capability.areaHeight);
      assert(Number.isSafeInteger(areaWidth) && areaWidth > 0 && areaWidth <= TOOL_CAPABILITY_AXIS_MAX,
        `${label}.capability.areaWidth must be an integer from 1 to ${TOOL_CAPABILITY_AXIS_MAX}.`);
      assert(Number.isSafeInteger(areaHeight) && areaHeight > 0 && areaHeight <= TOOL_CAPABILITY_AXIS_MAX,
        `${label}.capability.areaHeight must be an integer from 1 to ${TOOL_CAPABILITY_AXIS_MAX}.`);
      assert(areaWidth * areaHeight <= TOOL_CAPABILITY_TILE_MAX,
        `${label}.capability area must contain at most ${TOOL_CAPABILITY_TILE_MAX} tiles.`);
      const multiplier = requireNumber(`${label}.capability.energyMultiplier`, capability.energyMultiplier);
      assert(multiplier > 0, `${label}.capability.energyMultiplier must be positive.`);
    }
  }
}

function validateSellPrices(value: unknown): void {
  const seen = new Set<string>();
  for (const [index, raw] of requireArray("system.sellPrices", value).entries()) {
    const label = `system.sellPrices[${index}]`;
    const row = requireRecord(label, raw);
    const itemId = requireNonBlankString(`${label}.itemId`, row.itemId);
    assert(!seen.has(itemId), `${label}.itemId is duplicated: ${itemId}`);
    seen.add(itemId);
    assertNonNegativeNumber(`${label}.price`, row.price);
  }
}

function validateEnergySystem(value: unknown): void {
  const energy = requireRecord("system.energy", value);
  assertPositiveNumber("system.energy.max", energy.max);
  if (energy.initial !== undefined) assertNonNegativeNumber("system.energy.initial", energy.initial);
  if (energy.restorePerDay !== undefined) assertNonNegativeNumber("system.energy.restorePerDay", energy.restorePerDay);
}

function validateShippingSystem(value: unknown): void {
  const shipping = requireRecord("system.shipping", value);
  requireBoolean("system.shipping.enabled", shipping.enabled);
  if (shipping.historyLimit !== undefined) assertPositiveNumber("system.shipping.historyLimit", shipping.historyLimit);
  if (shipping.allowedItemIds !== undefined) validateStringArray("system.shipping.allowedItemIds", shipping.allowedItemIds);
}

function validateWorldUnlocks(value: unknown): void {
  const seen = new Set<string>();
  for (const [index, raw] of requireArray("system.worldUnlocks", value).entries()) {
    const label = `system.worldUnlocks[${index}]`;
    const unlock = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, unlock.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    if (unlock.name !== undefined) requireString(`${label}.name`, unlock.name);
    if (unlock.switchId !== undefined) requireNonBlankString(`${label}.switchId`, unlock.switchId);
  }
}

function validateBundles(value: unknown): void {
  const seen = new Set<string>();
  for (const [index, raw] of requireArray("system.bundles", value).entries()) {
    const label = `system.bundles[${index}]`;
    const bundle = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, bundle.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    if (bundle.name !== undefined) requireString(`${label}.name`, bundle.name);
    validateItemAmounts(`${label}.requirements`, bundle.requirements, true);
    if (bundle.reward === undefined) continue;
    const reward = requireRecord(`${label}.reward`, bundle.reward);
    if (reward.gold !== undefined) assertNonNegativeNumber(`${label}.reward.gold`, reward.gold);
    if (reward.itemRewards !== undefined) validateItemAmounts(`${label}.reward.itemRewards`, reward.itemRewards, false);
    if (reward.switchId !== undefined) requireNonBlankString(`${label}.reward.switchId`, reward.switchId);
    if (reward.worldUnlockIds !== undefined) validateStringArray(`${label}.reward.worldUnlockIds`, reward.worldUnlockIds);
    if (reward.recipeIds !== undefined) validateStringArray(`${label}.reward.recipeIds`, reward.recipeIds);
  }
}

function validateMakers(value: unknown): void {
  const seen = new Set<string>();
  for (const [index, raw] of requireArray("system.makers", value).entries()) {
    const label = `system.makers[${index}]`;
    const maker = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, maker.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    if (maker.name !== undefined) requireString(`${label}.name`, maker.name);
    validateItemAmounts(`${label}.inputs`, maker.inputs, false);
    validateItemAmounts(`${label}.outputs`, maker.outputs, true);
    assertPositiveNumber(`${label}.durationMinutes`, maker.durationMinutes);
  }
}

function validateItemAmounts(label: string, value: unknown, requireNonEmpty: boolean): void {
  const values = requireArray(label, value);
  assert(!requireNonEmpty || values.length > 0, `${label} must not be empty.`);
  const seen = new Set<string>();
  for (const [index, raw] of values.entries()) {
    const entry = requireRecord(`${label}[${index}]`, raw);
    const itemId = requireNonBlankString(`${label}[${index}].itemId`, entry.itemId);
    assert(!seen.has(itemId), `${label}[${index}].itemId is duplicated: ${itemId}`);
    seen.add(itemId);
    assertPositiveNumber(`${label}[${index}].count`, entry.count);
  }
}

function validateStringArray(label: string, value: unknown): void {
  for (const [index, entry] of requireArray(label, value).entries()) {
    requireNonBlankString(`${label}[${index}]`, entry);
  }
}

function requireNonBlankString(label: string, value: unknown): string {
  const result = requireString(label, value);
  assert(result.trim().length > 0, `${label} must not be blank.`);
  return result.trim();
}

function assertPositiveNumber(label: string, value: unknown): void {
  const result = requireNumber(label, value);
  assert(Number.isInteger(result) && result > 0, `${label} must be a positive integer.`);
}

function assertNonNegativeNumber(label: string, value: unknown): void {
  const result = requireNumber(label, value);
  assert(Number.isInteger(result) && result >= 0, `${label} must be a non-negative integer.`);
}

function validateTimeSystem(value: unknown): void {
  const timeSystem = requireRecord("system.timeSystem", value);
  requireBoolean("system.timeSystem.enabled", timeSystem.enabled);
  if (timeSystem.minutesPerRealSecond !== undefined) requireNumber("system.timeSystem.minutesPerRealSecond", timeSystem.minutesPerRealSecond);
  if (timeSystem.dayStartHour !== undefined) requireNumber("system.timeSystem.dayStartHour", timeSystem.dayStartHour);
  if (timeSystem.dayEndHour !== undefined) requireNumber("system.timeSystem.dayEndHour", timeSystem.dayEndHour);
  if (timeSystem.daysPerSeason !== undefined) requireNumber("system.timeSystem.daysPerSeason", timeSystem.daysPerSeason);
  if (timeSystem.forceSleep !== undefined) requireBoolean("system.timeSystem.forceSleep", timeSystem.forceSleep);
  if (timeSystem.onDayEnd !== undefined) requireString("system.timeSystem.onDayEnd", timeSystem.onDayEnd);
}

export function validateSession(value: unknown): void {
  const session = requireRecord("session", value);
  requireRecord("session.switches", session.switches);
  requireRecord("session.variables", session.variables);
  requireRecord("session.inventory", session.inventory);
  requireArray("session.partyActorIds", session.partyActorIds);
  if (session.monsterInstances !== undefined) requireRecord("session.monsterInstances", session.monsterInstances);
  if (session.monsterParty !== undefined) requireArray("session.monsterParty", session.monsterParty);
  if (session.monsterBox !== undefined) requireArray("session.monsterBox", session.monsterBox);
  if (session.farmAnimals !== undefined) validateFarmAnimalStarts(session.farmAnimals);
  if (session.farmBuildingPlacements !== undefined) validateSpatialPlacements("session.farmBuildingPlacements", session.farmBuildingPlacements, true);
  if (session.homeDecorationPlacements !== undefined) validateSpatialPlacements("session.homeDecorationPlacements", session.homeDecorationPlacements, false);
}

function validateFarmBuildingTypes(value: unknown): void {
  const rows = requireArray("database.farmBuildingTypes", value);
  assert(rows.length <= SPATIAL_DEFINITION_LIMIT,
    `database.farmBuildingTypes must contain at most ${SPATIAL_DEFINITION_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const label = `database.farmBuildingTypes[${index}]`;
    const record = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, record.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    requireNonBlankString(`${label}.name`, record.name);
    if (record.allowedMapIds !== undefined) validateUniqueStringArray(`${label}.allowedMapIds`, record.allowedMapIds, SPATIAL_DEFINITION_LIMIT);
    const levels = requireArray(`${label}.levels`, record.levels);
    assert(levels.length > 0 && levels.length <= SPATIAL_LEVEL_LIMIT,
      `${label}.levels must contain 1 to ${SPATIAL_LEVEL_LIMIT} levels.`);
    let previousCapacity = 0;
    for (const [levelIndex, levelRaw] of levels.entries()) {
      const levelLabel = `${label}.levels[${levelIndex}]`;
      const level = requireRecord(levelLabel, levelRaw);
      assertSafeIntegerInRange(`${levelLabel}.level`, level.level, levelIndex + 1, levelIndex + 1);
      if (level.name !== undefined) requireString(`${levelLabel}.name`, level.name);
      validateSpatialFootprint(`${levelLabel}.footprint`, level.footprint);
      assertSafeIntegerInRange(`${levelLabel}.capacity`, level.capacity, 1, SPATIAL_CAPACITY_MAX);
      assert((level.capacity as number) >= previousCapacity, `${levelLabel}.capacity must not decrease.`);
      previousCapacity = level.capacity as number;
      if (level.cost !== undefined) validateSpatialCost(`${levelLabel}.cost`, level.cost);
      requireNonBlankString(`${levelLabel}.graphicResourceId`, level.graphicResourceId);
      if (level.orientationGraphicResourceIds !== undefined) {
        validateOrientationGraphicIds(`${levelLabel}.orientationGraphicResourceIds`, level.orientationGraphicResourceIds);
      }
    }
  }
}

function validateHomeDecorationTypes(value: unknown): void {
  const rows = requireArray("database.homeDecorationTypes", value);
  assert(rows.length <= SPATIAL_DEFINITION_LIMIT,
    `database.homeDecorationTypes must contain at most ${SPATIAL_DEFINITION_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const label = `database.homeDecorationTypes[${index}]`;
    const record = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, record.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    requireNonBlankString(`${label}.name`, record.name);
    requireNonBlankString(`${label}.placementItemId`, record.placementItemId);
    validateSpatialFootprint(`${label}.footprint`, record.footprint);
    requireBoolean(`${label}.blocksMovement`, record.blocksMovement);
    const orientations = requireArray(`${label}.allowedOrientations`, record.allowedOrientations);
    assert(orientations.length > 0 && orientations.length <= 4, `${label}.allowedOrientations must contain 1 to 4 directions.`);
    const seenOrientations = new Set<string>();
    for (const [orientationIndex, orientation] of orientations.entries()) {
      assert(isSpatialOrientation(orientation), `${label}.allowedOrientations[${orientationIndex}] is invalid.`);
      assert(!seenOrientations.has(orientation), `${label}.allowedOrientations[${orientationIndex}] is duplicated: ${orientation}`);
      seenOrientations.add(orientation);
    }
    requireNonBlankString(`${label}.graphicResourceId`, record.graphicResourceId);
    if (record.orientationGraphicResourceIds !== undefined) {
      validateOrientationGraphicIds(`${label}.orientationGraphicResourceIds`, record.orientationGraphicResourceIds);
    }
    if (record.allowedMapIds !== undefined) validateUniqueStringArray(`${label}.allowedMapIds`, record.allowedMapIds, SPATIAL_DEFINITION_LIMIT);
  }
}

function validateSpatialPlacements(label: string, value: unknown, building: boolean): void {
  const rows = requireArray(label, value);
  assert(rows.length <= SPATIAL_PLACEMENT_LIMIT, `${label} must contain at most ${SPATIAL_PLACEMENT_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const rowLabel = `${label}[${index}]`;
    const placement = requireRecord(rowLabel, raw);
    const instanceId = requireNonBlankString(`${rowLabel}.instanceId`, placement.instanceId);
    assert(!seen.has(instanceId), `${rowLabel}.instanceId is duplicated: ${instanceId}`);
    seen.add(instanceId);
    requireNonBlankString(`${rowLabel}.typeId`, placement.typeId);
    requireNonBlankString(`${rowLabel}.mapId`, placement.mapId);
    assertSafeInteger(`${rowLabel}.x`, placement.x);
    assertSafeInteger(`${rowLabel}.y`, placement.y);
    assert(isSpatialOrientation(placement.orientation), `${rowLabel}.orientation is invalid.`);
    if (building) assertSafeIntegerInRange(`${rowLabel}.level`, placement.level, 1, SPATIAL_LEVEL_LIMIT);
  }
}

function validateSpatialFootprint(label: string, value: unknown): void {
  const footprint = requireRecord(label, value);
  assertSafeIntegerInRange(`${label}.width`, footprint.width, 1, SPATIAL_FOOTPRINT_AXIS_MAX);
  assertSafeIntegerInRange(`${label}.height`, footprint.height, 1, SPATIAL_FOOTPRINT_AXIS_MAX);
  assert((footprint.width as number) * (footprint.height as number) <= SPATIAL_FOOTPRINT_TILE_MAX,
    `${label} must contain at most ${SPATIAL_FOOTPRINT_TILE_MAX} tiles.`);
}

function validateSpatialCost(label: string, value: unknown): void {
  const cost = requireRecord(label, value);
  if (cost.gold !== undefined) assertSafeIntegerInRange(`${label}.gold`, cost.gold, 0, GOLD_MAX);
  if (cost.items === undefined) return;
  const items = requireArray(`${label}.items`, cost.items);
  assert(items.length <= SPATIAL_COST_ITEM_LIMIT, `${label}.items must contain at most ${SPATIAL_COST_ITEM_LIMIT} rows.`);
  validateItemAmounts(`${label}.items`, items, false);
  for (const [index, raw] of items.entries()) {
    const item = requireRecord(`${label}.items[${index}]`, raw);
    assertSafeIntegerInRange(`${label}.items[${index}].count`, item.count, 1, ITEM_QUANTITY_MAX);
  }
}

function validateOrientationGraphicIds(label: string, value: unknown): void {
  const record = requireRecord(label, value);
  for (const [orientation, resourceId] of Object.entries(record)) {
    assert(isSpatialOrientation(orientation), `${label} contains an unknown orientation: ${orientation}`);
    requireNonBlankString(`${label}.${orientation}`, resourceId);
  }
}

function validateDailyWeather(value: unknown): void {
  const weather = requireRecord("system.dailyWeather", value);
  requireBoolean("system.dailyWeather.enabled", weather.enabled);
  if (weather.forecastDays !== undefined) {
    assertSafeIntegerInRange("system.dailyWeather.forecastDays", weather.forecastDays, 1, WEATHER_FORECAST_DAYS_MAX);
  }
  const seasons = requireRecord("system.dailyWeather.seasons", weather.seasons);
  for (const [season, rawRules] of Object.entries(seasons)) {
    assert(season === "spring" || season === "summer" || season === "fall" || season === "winter",
      `system.dailyWeather.seasons contains an unknown season: ${season}`);
    const label = `system.dailyWeather.seasons.${season}`;
    const rules = requireArray(label, rawRules);
    assert(rules.length <= WEATHER_RULES_PER_SEASON_LIMIT,
      `${label} must contain at most ${WEATHER_RULES_PER_SEASON_LIMIT} rules.`);
    for (const [index, raw] of rules.entries()) {
      const ruleLabel = `${label}[${index}]`;
      const rule = requireRecord(ruleLabel, raw);
      requireString(`${ruleLabel}.kind`, rule.kind);
      assert(isWeatherKind(rule.kind), `${ruleLabel}.kind is not a supported weather kind: ${String(rule.kind)}`);
      assertSafeIntegerInRange(`${ruleLabel}.weight`, rule.weight, 1, WEATHER_WEIGHT_MAX);
      if (rule.intensity !== undefined) assertFiniteNumberInRange(`${ruleLabel}.intensity`, rule.intensity, 0, 1);
    }
  }
}

function validateFarmAnimalSpecies(value: unknown): void {
  const rows = requireArray("database.farmAnimalSpecies", value);
  assert(rows.length <= FARM_ANIMAL_RECORD_LIMIT,
    `database.farmAnimalSpecies must contain at most ${FARM_ANIMAL_RECORD_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const label = `database.farmAnimalSpecies[${index}]`;
    const species = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, species.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    requireNonBlankString(`${label}.name`, species.name);
    if (species.graphic !== undefined) validateFarmAnimalGraphic(`${label}.graphic`, species.graphic);
    requireNonBlankString(`${label}.feedItemId`, species.feedItemId);
    requireNonBlankString(`${label}.productItemId`, species.productItemId);
    assertSafeIntegerInRange(`${label}.productCount`, species.productCount, 1, ITEM_QUANTITY_MAX);
    assertSafeIntegerInRange(`${label}.productEveryDays`, species.productEveryDays, 1, FARM_ANIMAL_PRODUCT_EVERY_DAYS_MAX);
    assertSafeIntegerInRange(`${label}.petFriendship`, species.petFriendship, 0, FARM_ANIMAL_FRIENDSHIP_MAX);
  }
}

function validateFarmAnimalBuildings(value: unknown): void {
  const rows = requireArray("system.farmAnimalBuildings", value);
  assert(rows.length <= FARM_ANIMAL_RECORD_LIMIT,
    `system.farmAnimalBuildings must contain at most ${FARM_ANIMAL_RECORD_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const label = `system.farmAnimalBuildings[${index}]`;
    const building = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.id`, building.id);
    assert(!seen.has(id), `${label}.id is duplicated: ${id}`);
    seen.add(id);
    requireNonBlankString(`${label}.name`, building.name);
    requireNonBlankString(`${label}.mapId`, building.mapId);
    assertSafeInteger(`${label}.x`, building.x);
    assertSafeInteger(`${label}.y`, building.y);
    assertSafeIntegerInRange(`${label}.capacity`, building.capacity, 1, FARM_ANIMAL_BUILDING_CAPACITY_MAX);
    validateUniqueStringArray(`${label}.allowedSpeciesIds`, building.allowedSpeciesIds, FARM_ANIMAL_RECORD_LIMIT);
  }
}

function validateFarmAnimalStarts(value: unknown): void {
  const rows = requireArray("session.farmAnimals", value);
  assert(rows.length <= FARM_ANIMAL_RECORD_LIMIT,
    `session.farmAnimals must contain at most ${FARM_ANIMAL_RECORD_LIMIT} records.`);
  const seen = new Set<string>();
  for (const [index, raw] of rows.entries()) {
    const label = `session.farmAnimals[${index}]`;
    const animal = requireRecord(label, raw);
    const id = requireNonBlankString(`${label}.instanceId`, animal.instanceId);
    assert(!seen.has(id), `${label}.instanceId is duplicated: ${id}`);
    seen.add(id);
    requireNonBlankString(`${label}.speciesId`, animal.speciesId);
    requireNonBlankString(`${label}.name`, animal.name);
    if (animal.eventId !== undefined) requireNonBlankString(`${label}.eventId`, animal.eventId);
    if (animal.buildingId !== undefined) requireNonBlankString(`${label}.buildingId`, animal.buildingId);
  }
}

function validateFarmAnimalGraphic(label: string, value: unknown): void {
  const graphic = requireRecord(label, value);
  if (graphic.sprite !== undefined) {
    const sprite = requireRecord(`${label}.sprite`, graphic.sprite);
    const type = requireString(`${label}.sprite.type`, sprite.type);
    assert(type === "bundled" || type === "uploaded", `${label}.sprite.type is invalid.`);
    requireNonBlankString(`${label}.sprite.id`, sprite.id);
  }
  if (graphic.direction !== undefined) {
    const direction = requireString(`${label}.direction`, graphic.direction);
    assert(direction === "left" || direction === "right" || direction === "up" || direction === "down",
      `${label}.direction is invalid.`);
  }
  if (graphic.pattern !== undefined) assertSafeInteger(`${label}.pattern`, graphic.pattern);
  if (graphic.transparent !== undefined) requireBoolean(`${label}.transparent`, graphic.transparent);
}

function validateUniqueStringArray(label: string, value: unknown, limit: number): void {
  const rows = requireArray(label, value);
  assert(rows.length <= limit, `${label} must contain at most ${limit} ids.`);
  const seen = new Set<string>();
  for (const [index, entry] of rows.entries()) {
    const id = requireNonBlankString(`${label}[${index}]`, entry);
    assert(!seen.has(id), `${label}[${index}] is duplicated: ${id}`);
    seen.add(id);
  }
}

function assertSafeInteger(label: string, value: unknown): asserts value is number {
  const result = requireNumber(label, value);
  assert(Number.isSafeInteger(result), `${label} must be a safe integer.`);
}

function assertSafeIntegerInRange(label: string, value: unknown, min: number, max: number): void {
  assertSafeInteger(label, value);
  assert(value >= min && value <= max, `${label} must be an integer from ${min} to ${max}.`);
}

function assertFiniteNumberInRange(label: string, value: unknown, min: number, max: number): void {
  const result = requireNumber(label, value);
  assert(result >= min && result <= max, `${label} must be between ${min} and ${max}.`);
}
