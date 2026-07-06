import { assert, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { validateCommandArray, validateConditionShape, validateMoveRoute } from "./shapeCommandFields";
import { validateTrigger } from "./shapeReferenceFields";

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
    for (const [eventIndex, eventValue] of requireArray(`map ${id}.events`, map.events).entries()) {
      validateEventShape(`map ${id}.events[${eventIndex}]`, eventValue);
    }
  }
  return maps;
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
  if (event.pages !== undefined) {
    for (const [index, pageValue] of requireArray(`${label}.pages`, event.pages).entries()) {
      validatePageShape(`${label}.pages[${index}]`, pageValue);
    }
  }
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
      movementType === "living",
    `${label}.movement.type이 잘못되었습니다.`
  );
  requireNumber(`${label}.movement.speed`, movement.speed);
  requireNumber(`${label}.movement.frequency`, movement.frequency);
  if (movement.route !== undefined) validateMoveRoute(`${label}.movement.route`, movement.route);
  if (movement.living !== undefined) validateLivingMovement(`${label}.movement.living`, movement.living);
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
      const direction = requireString(`${label}.destinations[${index}].direction`, destination.direction);
      assert(
        direction === "left" || direction === "right" || direction === "up" || direction === "down",
        `${label}.destinations[${index}].direction이 잘못되었습니다.`
      );
    }
    if (destination.switchId !== undefined) requireString(`${label}.destinations[${index}].switchId`, destination.switchId);
  }
}

function validatePageConditionShape(label: string, value: unknown): void {
  // EventPageCondition = Condition 이므로 fork 조건과 같은 검증기를 그대로 쓴다.
  // (과거 별도 구현이 selfSwitch/gold kind를 누락해 저장/불러오기가 깨졌다.)
  validateConditionShape(label, value);
}
