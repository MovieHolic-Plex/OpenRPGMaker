import type {
  BattleEventCondition,
  BattleEventPageRecord,
  Command,
  Condition,
  EventPage,
  EventPageCondition,
} from "../types";
import { assert } from "./guards";
import { validateOptionalResource } from "./resourceReferenceValidation";

export type ReferenceContext = {
  actorIds: ReadonlySet<string>;
  enemyIds: ReadonlySet<string>;
  itemIds: ReadonlySet<string>;
  equipmentIds: ReadonlySet<string>;
  skillIds: ReadonlySet<string>;
  switchIds: ReadonlySet<string>;
  variableIds: ReadonlySet<string>;
  commonEventIds: ReadonlySet<string>;
  mapIds: ReadonlySet<string>;
  troopIds: ReadonlySet<string>;
  resourceIds: ReadonlySet<string>;
};

export function validateEventPages(pages: readonly EventPage[], context: ReferenceContext): void {
  for (const page of pages) {
    validateOptionalResource(`page ${page.id}: graphic.sprite`, page.graphic.sprite?.id, context.resourceIds);
    for (const condition of page.conditions) validatePageCondition(condition, context);
    validateCommands(page.commands, context);
  }
}

export function validateBattleEventPages(pages: readonly BattleEventPageRecord[], context: ReferenceContext): void {
  for (const page of pages) {
    for (const condition of page.conditions) validateBattleEventCondition(condition, context);
    validateCommands(page.commands, context);
  }
}

export function validateCommands(commands: readonly Command[], context: ReferenceContext): void {
  for (const command of commands) validateCommandReferences(command, context);
}

function validateCommandReferences(command: Command, context: ReferenceContext): void {
  switch (command.kind) {
    case "text":
    case "wait":
    case "inputWait":
    case "label":
    case "gotoLabel":
    case "timer":
    case "moveEvent":
    case "setFlag":
    case "erasePicture":
    case "stopAudio":
    case "inn":
    case "gameOver":
    case "returnToTitle":
      return;
    case "choices":
      for (const option of command.options) validateCommands(option.branch, context);
      return;
    case "fork":
      validateCondition(command.condition, context.switchIds, context.variableIds);
      validateCommands(command.then, context);
      validateCommands(command.else ?? [], context);
      return;
    case "setSwitch":
      assert(context.switchIds.has(command.switchId), `setSwitch: switchId가 존재하지 않습니다: ${command.switchId}`);
      return;
    case "setVariable":
      assert(context.variableIds.has(command.variableId), `setVariable: variableId가 존재하지 않습니다: ${command.variableId}`);
      return;
    case "transfer":
      assert(context.mapIds.has(command.mapId), `transfer: mapId가 존재하지 않습니다: ${command.mapId}`);
      return;
    case "changeTile":
      assert(context.mapIds.has(command.mapId), `changeTile: mapId가 존재하지 않습니다: ${command.mapId}`);
      return;
    case "callCommonEvent":
      assert(context.commonEventIds.has(command.commonEventId), `callCommonEvent: commonEventId가 존재하지 않습니다: ${command.commonEventId}`);
      return;
    case "battleProcessing":
      assert(context.troopIds.has(command.troopId), `battleProcessing: troopId가 존재하지 않습니다: ${command.troopId}`);
      return;
    case "learnSkill":
      assert(context.actorIds.has(command.actorId), `learnSkill: actorId가 존재하지 않습니다: ${command.actorId}`);
      assert(context.skillIds.has(command.skillId), `learnSkill: skillId가 존재하지 않습니다: ${command.skillId}`);
      return;
    case "showPicture":
      assert(context.resourceIds.has(command.resourceId), `showPicture: resourceId가 존재하지 않습니다: ${command.resourceId}`);
      return;
    case "playAudio":
      assert(context.resourceIds.has(command.resourceId), `playAudio: resourceId가 존재하지 않습니다: ${command.resourceId}`);
      return;
    case "shop":
      requireExistingIds("shop: item", command.itemIds, context.itemIds);
      return;
  }
}

function validatePageCondition(condition: EventPageCondition, context: ReferenceContext): void {
  switch (condition.kind) {
    case "switch":
    case "variable":
      validateCondition(condition, context.switchIds, context.variableIds);
      return;
    case "actor":
      assert(context.actorIds.has(condition.actorId), `page condition: actorId가 존재하지 않습니다: ${condition.actorId}`);
      return;
    case "item":
      assert(context.itemIds.has(condition.itemId), `page condition: itemId가 존재하지 않습니다: ${condition.itemId}`);
      return;
  }
}

function validateBattleEventCondition(condition: BattleEventCondition, context: ReferenceContext): void {
  switch (condition.kind) {
    case "switch":
    case "variable":
      validateCondition(condition, context.switchIds, context.variableIds);
      return;
    case "enemyHp":
    case "enemyTurn":
      assert(context.enemyIds.has(condition.enemyId), `battle condition: enemyId가 존재하지 않습니다: ${condition.enemyId}`);
      return;
    case "actorHp":
    case "actorTurn":
    case "actorCommand":
      assert(context.actorIds.has(condition.actorId), `battle condition: actorId가 존재하지 않습니다: ${condition.actorId}`);
      return;
    case "turn":
      return;
  }
}

export function validateCondition(
  condition: Condition,
  switchIds: ReadonlySet<string>,
  variableIds: ReadonlySet<string>
): void {
  if (condition.kind === "switch") {
    assert(switchIds.has(condition.switchId), `condition: switchId가 존재하지 않습니다: ${condition.switchId}`);
    return;
  }
  assert(variableIds.has(condition.variableId), `condition: variableId가 존재하지 않습니다: ${condition.variableId}`);
}

function requireExistingIds(label: string, ids: readonly string[], knownIds: ReadonlySet<string>): void {
  for (const id of ids) assert(knownIds.has(id), `${label}가 존재하지 않습니다: ${id}`);
}
