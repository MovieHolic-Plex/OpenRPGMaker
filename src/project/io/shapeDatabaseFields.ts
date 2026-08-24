import { isGenrePackId } from "@/project/genrePackId";
import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";

export function validateDatabase(value: unknown): void {
  const database = requireRecord("database", value);
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
  if (database.elements !== undefined) requireArray("database.elements", database.elements);
  if (database.terrains !== undefined) requireArray("database.terrains", database.terrains);
  if (database.battleCommands !== undefined) requireArray("database.battleCommands", database.battleCommands);
  if (database.monsterSpecies !== undefined) requireArray("database.monsterSpecies", database.monsterSpecies);
  if (database.crops !== undefined) requireArray("database.crops", database.crops);
  // 가드가 없으면 normalizeDatabaseRecords 의 .map 이 TypeError 로 터져 프로젝트 전체가 열리지 않는다
  // (손상·수작업 편집된 JSON 에서 실제로 재현됨). 다른 옵셔널 컬렉션과 동일 계약으로 맞춘다.
  if (database.lifeSkills !== undefined) requireArray("database.lifeSkills", database.lifeSkills);
}

export function validateSystem(value: unknown): void {
  const system = requireRecord("system", value);
  requireArray("system.startActorIds", system.startActorIds);
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
  if (system.energy !== undefined) validateEnergySystem(system.energy);
  if (system.shipping !== undefined) validateShippingSystem(system.shipping);
  if (system.worldUnlocks !== undefined) validateWorldUnlocks(system.worldUnlocks);
  if (system.bundles !== undefined) validateBundles(system.bundles);
  if (system.makers !== undefined) validateMakers(system.makers);
  if (system.craftRecipes !== undefined) validateCraftRecipes(system.craftRecipes);
  if (system.itemUpgrades !== undefined) validateItemUpgrades(system.itemUpgrades);
  if (system.sellPrices !== undefined) validateSellPrices(system.sellPrices);
  if (system.typeChart !== undefined) {
    const chart = requireRecord("system.typeChart", system.typeChart);
    requireArray("system.typeChart.types", chart.types);
    requireRecord("system.typeChart.multipliers", chart.multipliers);
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
      assertPositiveNumber(`${label}.capability.areaWidth`, capability.areaWidth);
      assertPositiveNumber(`${label}.capability.areaHeight`, capability.areaHeight);
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
}
