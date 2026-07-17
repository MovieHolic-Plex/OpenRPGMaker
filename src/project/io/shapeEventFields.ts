import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { validateCommandArray, validateConditionShape, validateMoveRoute } from "./shapeCommandFields";
import { validateLightingState } from "./shapeLightingFields";
import { validateTrigger } from "./shapeReferenceFields";
import { isSeason, isTimePhase } from "@/project/gameTime";

export function validateCommonEvents(value: unknown): void {
  for (const [index, entry] of requireArray("commonEvents", value).entries()) {
    const record = requireRecord(`commonEvents[${index}]`, entry);
    requireString(`commonEvents[${index}].id`, record.id);
    requireString(`commonEvents[${index}].name`, record.name);
    requireString(`commonEvents[${index}].trigger`, record.trigger);
    validateCommandArray(`commonEvents[${index}].commands`, record.commands);
  }
}

export function validateMaps(value: unknown): Record<string, unknown> {
  const maps = requireRecord("maps", value);
  for (const [id, mapValue] of Object.entries(maps)) {
    const map = requireRecord(`map ${id}`, mapValue);
    requireString(`map ${id}.id`, map.id);
    requireString(`map ${id}.name`, map.name);
    const width = requireNumber(`map ${id}.width`, map.width);
    const height = requireNumber(`map ${id}.height`, map.height);
    requireString(`map ${id}.tilesetId`, map.tilesetId);
    requireNumber(`map ${id}.tileSize`, map.tileSize);
    const expected = width * height;
    assert(requireArray(`map ${id}.lowerTiles`, map.lowerTiles).length === expected, `map ${id}: lowerTiles 길이 불일치.`);
    assert(requireArray(`map ${id}.upperTiles`, map.upperTiles).length === expected, `map ${id}: upperTiles 길이 불일치.`);
    if (map.lowerTileStacks !== undefined) validateTileStacks(`map ${id}.lowerTileStacks`, map.lowerTileStacks, expected);
    if (map.upperTileStacks !== undefined) validateTileStacks(`map ${id}.upperTileStacks`, map.upperTileStacks, expected);
    if (map.encounterRate !== undefined) requireNumber(`map ${id}.encounterRate`, map.encounterRate);
    if (map.troopIds !== undefined) validateIdArray(`map ${id}.troopIds`, map.troopIds);
    if (map.encounterTable !== undefined) validateEncounterTable(`map ${id}.encounterTable`, map.encounterTable);
    if (map.fieldSpawns !== undefined) validateFieldSpawns(`map ${id}.fieldSpawns`, map.fieldSpawns);
    if (map.safeZones !== undefined) validateSafeZones(`map ${id}.safeZones`, map.safeZones);
    if (map.farmableArea !== undefined) validateRectArray(`map ${id}.farmableArea`, map.farmableArea);
    if (map.defaultLighting !== undefined) validateLightingState(`map ${id}.defaultLighting`, map.defaultLighting);
    for (const [eventIndex, eventValue] of requireArray(`map ${id}.events`, map.events).entries()) {
      validateEventShape(`map ${id}.events[${eventIndex}]`, eventValue);
    }
  }
  return maps;
}

function validateEncounterTable(label: string, value: unknown): void {
  for (const [index, entryValue] of requireArray(label, value).entries()) {
    const entry = requireRecord(`${label}[${index}]`, entryValue);
    requireString(`${label}[${index}].troopId`, entry.troopId);
    const weight = requireNumber(`${label}[${index}].weight`, entry.weight);
    assert(Number.isInteger(weight) && weight > 0, `${label}[${index}].weight는 1 이상의 정수여야 합니다.`);
    if (entry.conditions !== undefined) validateEncounterConditions(`${label}[${index}].conditions`, entry.conditions);
  }
}

function validateEncounterConditions(label: string, value: unknown): void {
  const conditions = requireRecord(label, value);
  if (conditions.switchId !== undefined) requireString(`${label}.switchId`, conditions.switchId);
  if (conditions.variableId !== undefined) {
    requireString(`${label}.variableId`, conditions.variableId);
    requireNumber(`${label}.atLeast`, conditions.atLeast);
  } else if (conditions.atLeast !== undefined) {
    requireNumber(`${label}.atLeast`, conditions.atLeast);
  }
  if (conditions.minPartyLevel !== undefined) requireNumber(`${label}.minPartyLevel`, conditions.minPartyLevel);
  if (conditions.maxPartyLevel !== undefined) requireNumber(`${label}.maxPartyLevel`, conditions.maxPartyLevel);
  if (conditions.region !== undefined) validateRect(`${label}.region`, conditions.region);
  if (conditions.timePhase !== undefined) {
    const phase = requireString(`${label}.timePhase`, conditions.timePhase);
    assert(isTimePhase(phase), `${label}.timePhase가 잘못되었습니다.`);
  }
  if (conditions.season !== undefined) {
    const season = requireString(`${label}.season`, conditions.season);
    assert(isSeason(season), `${label}.season이 잘못되었습니다.`);
  }
}

function validateFieldSpawns(label: string, value: unknown): void {
  for (const [index, entryValue] of requireArray(label, value).entries()) {
    const entry = requireRecord(`${label}[${index}]`, entryValue);
    requireString(`${label}[${index}].id`, entry.id);
    requireString(`${label}[${index}].troopId`, entry.troopId);
    validateRect(`${label}[${index}].area`, entry.area);
    if (entry.maxAlive !== undefined) {
      const maxAlive = requireNumber(`${label}[${index}].maxAlive`, entry.maxAlive);
      assert(Number.isInteger(maxAlive) && maxAlive > 0, `${label}[${index}].maxAlive는 1 이상의 정수여야 합니다.`);
    }
    if (entry.respawnSec !== undefined) {
      const respawnSec = requireNumber(`${label}[${index}].respawnSec`, entry.respawnSec);
      assert(respawnSec >= 0, `${label}[${index}].respawnSec는 0 이상이어야 합니다.`);
    }
    if (entry.chase !== undefined) requireBoolean(`${label}[${index}].chase`, entry.chase);
    if (entry.graphic !== undefined) validateEventGraphic(`${label}[${index}].graphic`, entry.graphic);
  }
}

function validateSafeZones(label: string, value: unknown): void {
  validateRectArray(label, value);
}

function validateRectArray(label: string, value: unknown): void {
  for (const [index, rectValue] of requireArray(label, value).entries()) {
    validateRect(`${label}[${index}]`, rectValue);
  }
}

function validateRect(label: string, value: unknown): void {
  const rect = requireRecord(label, value);
  requireNumber(`${label}.x`, rect.x);
  requireNumber(`${label}.y`, rect.y);
  requireNumber(`${label}.w`, rect.w);
  requireNumber(`${label}.h`, rect.h);
}

function validateEventGraphic(label: string, value: unknown): void {
  const graphic = requireRecord(label, value);
  if (graphic.sprite !== undefined) {
    const sprite = requireRecord(`${label}.sprite`, graphic.sprite);
    requireString(`${label}.sprite.type`, sprite.type);
    requireString(`${label}.sprite.id`, sprite.id);
  }
  if (graphic.direction !== undefined) {
    validateDir(`${label}.direction`, graphic.direction);
  }
  if (graphic.pattern !== undefined) requireNumber(`${label}.pattern`, graphic.pattern);
  if (graphic.transparent !== undefined) requireBoolean(`${label}.transparent`, graphic.transparent);
}

function validateDir(label: string, value: unknown): void {
  const direction = requireString(label, value);
  assert(direction === "left" || direction === "right" || direction === "up" || direction === "down", `${label}이 잘못되었습니다.`);
}

function validateIdArray(label: string, value: unknown): void {
  for (const [index, id] of requireArray(label, value).entries()) {
    requireString(`${label}[${index}]`, id);
  }
}

function validateTileStacks(label: string, value: unknown, cellCount: number): void {
  const stacks = requireRecord(label, value);
  for (const [cell, stackValue] of Object.entries(stacks)) {
    const index = Number(cell);
    assert(Number.isInteger(index) && index >= 0 && index < cellCount, `${label}[${cell}]: tile stack cell index out of range`);
    for (const [stackIndex, tile] of requireArray(`${label}[${cell}]`, stackValue).entries()) {
      requireNumber(`${label}[${cell}][${stackIndex}]`, tile);
    }
  }
}

function validateEventShape(label: string, value: unknown): void {
  const event = requireRecord(label, value);
  requireString(`${label}.id`, event.id);
  requireNumber(`${label}.x`, event.x);
  requireNumber(`${label}.y`, event.y);
  validateTrigger(`${label}.trigger`, event.trigger);
  if (event.condition !== undefined) validateConditionShape(`${label}.condition`, event.condition);
  if (event.moveRoute !== undefined) validateMoveRoute(`${label}.moveRoute`, event.moveRoute);
  validateCommandArray(`${label}.commands`, event.commands);
  if (event.schedule !== undefined) validateNpcSchedule(`${label}.schedule`, event.schedule);
  if (event.giftPrefs !== undefined) validateGiftPrefs(`${label}.giftPrefs`, event.giftPrefs);
  if (event.giftResponses !== undefined) validateGiftResponses(`${label}.giftResponses`, event.giftResponses);
  if (event.pages !== undefined) {
    for (const [index, pageValue] of requireArray(`${label}.pages`, event.pages).entries()) {
      validatePageShape(`${label}.pages[${index}]`, pageValue);
    }
  }
}

export function validateGiftPrefs(label: string, value: unknown): void {
  const prefs = requireRecord(label, value);
  if (prefs.loved !== undefined) validateIdArray(`${label}.loved`, prefs.loved);
  if (prefs.liked !== undefined) validateIdArray(`${label}.liked`, prefs.liked);
  if (prefs.disliked !== undefined) validateIdArray(`${label}.disliked`, prefs.disliked);
}

export function validateGiftResponses(label: string, value: unknown): void {
  const responses = requireRecord(label, value);
  for (const key of ["loved", "liked", "neutral", "disliked", "alreadyGifted", "noItems"]) {
    if (responses[key] !== undefined) requireString(`${label}.${key}`, responses[key]);
  }
}

function validateNpcSchedule(label: string, value: unknown): void {
  for (const [index, entryValue] of requireArray(label, value).entries()) {
    const entry = requireRecord(`${label}[${index}]`, entryValue);
    validateNpcScheduleWhen(`${label}[${index}].when`, entry.when);
    const at = requireRecord(`${label}[${index}].at`, entry.at);
    requireString(`${label}[${index}].at.mapId`, at.mapId);
    requireNumber(`${label}[${index}].at.x`, at.x);
    requireNumber(`${label}[${index}].at.y`, at.y);
    if (entry.facing !== undefined) validateDir(`${label}[${index}].facing`, entry.facing);
    if (entry.activity !== undefined) requireString(`${label}[${index}].activity`, entry.activity);
  }
}

function validateNpcScheduleWhen(label: string, value: unknown): void {
  const when = requireRecord(label, value);
  if (when.timePhase !== undefined) {
    const phase = requireString(`${label}.timePhase`, when.timePhase);
    assert(isTimePhase(phase), `${label}.timePhase가 잘못되었습니다.`);
  }
  if (when.hourRange !== undefined) validateNumberPair(`${label}.hourRange`, when.hourRange);
  if (when.season !== undefined) {
    const season = requireString(`${label}.season`, when.season);
    assert(isSeason(season), `${label}.season이 잘못되었습니다.`);
  }
  if (when.dayRange !== undefined) validateNumberPair(`${label}.dayRange`, when.dayRange);
}

function validateNumberPair(label: string, value: unknown): void {
  const pair = requireArray(label, value);
  assert(pair.length === 2, `${label}는 숫자 2개 배열이어야 합니다.`);
  requireNumber(`${label}[0]`, pair[0]);
  requireNumber(`${label}[1]`, pair[1]);
}

function validatePageShape(label: string, value: unknown): void {
  const page = requireRecord(label, value);
  requireString(`${label}.id`, page.id);
  requireString(`${label}.name`, page.name);
  for (const [index, condition] of requireArray(`${label}.conditions`, page.conditions).entries()) {
    validatePageConditionShape(`${label}.conditions[${index}]`, condition);
  }
  requireRecord(`${label}.graphic`, page.graphic);
  validateTrigger(`${label}.trigger`, page.trigger);
  requireString(`${label}.priority`, page.priority);
  const movement = requireRecord(`${label}.movement`, page.movement);
  const movementType = requireString(`${label}.movement.type`, movement.type);
  assert(
    movementType === "fixed" ||
      movementType === "random" ||
      movementType === "approach" ||
      movementType === "custom" ||
      movementType === "living" ||
      movementType === "chase",
    `${label}.movement.type이 잘못되었습니다.`
  );
  requireNumber(`${label}.movement.speed`, movement.speed);
  requireNumber(`${label}.movement.frequency`, movement.frequency);
  if (movement.route !== undefined) validateMoveRoute(`${label}.movement.route`, movement.route);
  if (movement.living !== undefined) validateLivingMovement(`${label}.movement.living`, movement.living);
  if (movement.sightRange !== undefined) requireNumber(`${label}.movement.sightRange`, movement.sightRange);
  if (movement.giveUpRange !== undefined) requireNumber(`${label}.movement.giveUpRange`, movement.giveUpRange);
  if (movement.pathfind !== undefined) requireBoolean(`${label}.movement.pathfind`, movement.pathfind);
  validateCommandArray(`${label}.commands`, page.commands);
}

function validateLivingMovement(label: string, value: unknown): void {
  const living = requireRecord(label, value);
  requireBoolean(`${label}.repeat`, living.repeat);
  for (const [index, destinationValue] of requireArray(`${label}.destinations`, living.destinations).entries()) {
    const destination = requireRecord(`${label}.destinations[${index}]`, destinationValue);
    requireString(`${label}.destinations[${index}].mapId`, destination.mapId);
    requireNumber(`${label}.destinations[${index}].x`, destination.x);
    requireNumber(`${label}.destinations[${index}].y`, destination.y);
    if (destination.direction !== undefined) {
      validateDir(`${label}.destinations[${index}].direction`, destination.direction);
    }
    if (destination.switchId !== undefined) requireString(`${label}.destinations[${index}].switchId`, destination.switchId);
  }
}

function validatePageConditionShape(label: string, value: unknown): void {
  // EventPageCondition = Condition 이므로 fork 조건과 같은 검증기를 그대로 쓴다.
  // (과거 별도 구현이 selfSwitch/gold kind를 누락해 저장/불러오기가 깨졌다.)
  validateConditionShape(label, value);
}
