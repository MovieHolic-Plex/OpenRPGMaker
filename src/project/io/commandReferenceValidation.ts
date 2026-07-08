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
  classIds: ReadonlySet<string>;
  enemyIds: ReadonlySet<string>;
  itemIds: ReadonlySet<string>;
  equipmentIds: ReadonlySet<string>;
  skillIds: ReadonlySet<string>;
  animationIds: ReadonlySet<string>;
  switchIds: ReadonlySet<string>;
  variableIds: ReadonlySet<string>;
  commonEventIds: ReadonlySet<string>;
  endingIds: ReadonlySet<string>;
  mapIds: ReadonlySet<string>;
  troopIds: ReadonlySet<string>;
  speciesIds: ReadonlySet<string>;
  resourceIds: ReadonlySet<string>;
};

export function validateEventPages(pages: readonly EventPage[], context: ReferenceContext): void {
  for (const page of pages) {
    validateOptionalResource(`page ${page.id}: graphic.sprite`, page.graphic.sprite?.id, context.resourceIds);
    for (const condition of page.conditions) validatePageCondition(condition, context);
    validateLivingMovementReferences(page, context);
    validateCommands(page.commands, context);
  }
}

function validateLivingMovementReferences(page: EventPage, context: ReferenceContext): void {
  if (page.movement.type !== "living") return;
  for (const destination of page.movement.living?.destinations ?? []) {
    assert(context.mapIds.has(destination.mapId), `page ${page.id}: living destination mapId does not exist: ${destination.mapId}`);
    if (destination.switchId) {
      assert(context.switchIds.has(destination.switchId), `page ${page.id}: living destination switchId does not exist: ${destination.switchId}`);
    }
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
    case "advanceTime":
    case "setTime":
    case "sleepUntilMorning":
    case "moveEvent":
    case "setEventGraphicPattern":
    case "setFlag":
    case "erasePicture":
    case "stopAudio":
    case "cutsceneControl":
    case "inn":
    case "checkpointSave":
    case "killPlayer":
    case "removeFollower":
    case "setLighting":
    case "addLight":
    case "removeLight":
    case "setWeather":
    case "gameOver":
    case "ending":
    case "returnToTitle":
    case "displayTextSettings":
      return;
    case "triggerEnding":
      if (command.endingId) assert(context.endingIds.has(command.endingId), `triggerEnding: endingId가 존재하지 않습니다: ${command.endingId}`);
      return;
    case "addFollower":
      if ((command.actorId ?? "").trim().length > 0) assert(context.actorIds.has(command.actorId ?? ""), `addFollower: actorId가 존재하지 않습니다: ${command.actorId ?? ""}`);
      if (command.graphic?.sprite?.id) validateOptionalCommandResource("addFollower: graphic.sprite", command.graphic.sprite.id, context.resourceIds);
      return;
    case "changeFace":
      validateOptionalCommandResource("changeFace: resourceId", command.resourceId, context.resourceIds);
      return;
    case "choices":
      for (const option of command.options) validateCommands(option.branch, context);
      validateCommands(command.cancelBranch ?? [], context);
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
      if (typeof command.value !== "number") {
        assert(context.variableIds.has(command.value.id), `setVariable: operand variableId가 존재하지 않습니다: ${command.value.id}`);
      }
      return;
    case "inputNumber":
      assert(context.variableIds.has(command.variableId), `inputNumber: variableId가 존재하지 않습니다: ${command.variableId}`);
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
    case "changeExp":
      assert(context.actorIds.has(command.actorId), `changeExp: actorId가 존재하지 않습니다: ${command.actorId}`);
      return;
    case "changeLevel":
      assert(context.actorIds.has(command.actorId), `changeLevel: actorId가 존재하지 않습니다: ${command.actorId}`);
      return;
    case "promoteActor":
      assert(context.actorIds.has(command.actorId), `promoteActor: actorId가 존재하지 않습니다: ${command.actorId}`);
      if (command.toClassId && command.toClassId.trim().length > 0) {
        assert(context.classIds.has(command.toClassId), `promoteActor: toClassId가 존재하지 않습니다: ${command.toClassId}`);
      }
      validateCommands(command.successBranch ?? [], context);
      validateCommands(command.failureBranch ?? [], context);
      return;
    case "changeEquipment":
      assert(context.actorIds.has(command.actorId), `changeEquipment: actorId가 존재하지 않습니다: ${command.actorId}`);
      if (command.equipmentId.trim().length > 0) {
        assert(context.equipmentIds.has(command.equipmentId), `changeEquipment: equipmentId가 존재하지 않습니다: ${command.equipmentId}`);
      }
      return;
    case "changeActorHp":
      assert(context.actorIds.has(command.actorId), `changeActorHp: actorId가 존재하지 않습니다: ${command.actorId}`);
      return;
    case "changeActorMp":
      assert(context.actorIds.has(command.actorId), `changeActorMp: actorId가 존재하지 않습니다: ${command.actorId}`);
      return;
    case "recoverAll":
      if ((command.actorId ?? "").trim().length > 0) {
        assert(context.actorIds.has(command.actorId ?? ""), `recoverAll: actorId가 존재하지 않습니다: ${command.actorId ?? ""}`);
      }
      return;
    case "giveMonster":
      assert(context.speciesIds.has(command.speciesId), `giveMonster: speciesId가 존재하지 않습니다: ${command.speciesId}`);
      return;
    case "moveMonster":
      return;
    case "evolveMonster":
      if (command.toSpeciesId && command.toSpeciesId.trim().length > 0) {
        assert(context.speciesIds.has(command.toSpeciesId), `evolveMonster: toSpeciesId가 존재하지 않습니다: ${command.toSpeciesId}`);
      }
      validateCommands(command.successBranch ?? [], context);
      validateCommands(command.failureBranch ?? [], context);
      return;
    case "enterHeroName":
      if (command.actorId.trim().length > 0) {
        assert(context.actorIds.has(command.actorId), `enterHeroName: actorId가 존재하지 않습니다: ${command.actorId}`);
      }
      return;
    case "showPicture":
      assert(context.resourceIds.has(command.resourceId), `showPicture: resourceId가 존재하지 않습니다: ${command.resourceId}`);
      return;
    case "playAudio":
      assert(context.resourceIds.has(command.resourceId), `playAudio: resourceId가 존재하지 않습니다: ${command.resourceId}`);
      return;
    case "showAnimation":
      assert(context.animationIds.has(command.animationId), `showAnimation: animationId가 존재하지 않습니다: ${command.animationId}`);
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
    case "selfSwitch":
    case "gold":
    case "timer":
    case "timePhase":
    case "season":
      return;
  }
}

function validateBattleEventCondition(condition: BattleEventCondition, context: ReferenceContext): void {
  switch (condition.kind) {
    case "switch":
    case "variable":
      validateCondition(condition, context.switchIds, context.variableIds);
      return;
    case "actor":
      assert(context.actorIds.has(condition.actorId), `battle condition: actorId가 존재하지 않습니다: ${condition.actorId}`);
      return;
    case "item":
    case "selfSwitch":
    case "gold":
    case "timer":
    case "timePhase":
    case "season":
      return;
    case "enemyHp":
    case "enemyTurn":
      assert(context.enemyIds.has(condition.enemyId), `battle condition: enemyId가 존재하지 않습니다: ${condition.enemyId}`);
      return;
    case "enemyHpBelow":
      if (condition.enemyId) assert(context.enemyIds.has(condition.enemyId), `battle condition: enemyId가 존재하지 않습니다: ${condition.enemyId}`);
      return;
    case "actorHp":
    case "actorTurn":
    case "actorCommand":
      assert(context.actorIds.has(condition.actorId), `battle condition: actorId가 존재하지 않습니다: ${condition.actorId}`);
      return;
    case "turn":
    case "onRound":
    case "everyRound":
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
  if (condition.kind === "variable") {
    assert(variableIds.has(condition.variableId), `condition: variableId가 존재하지 않습니다: ${condition.variableId}`);
  }
  // selfSwitch/actor/item/gold/timer/timePhase/season 조건은 전역 스위치/변수 id를 참조하지 않으므로 검증 생략.
}

function requireExistingIds(label: string, ids: readonly string[], knownIds: ReadonlySet<string>): void {
  for (const id of ids) assert(knownIds.has(id), `${label}가 존재하지 않습니다: ${id}`);
}

function validateOptionalCommandResource(
  label: string,
  id: string,
  knownResourceIds: ReadonlySet<string>
): void {
  if (id.trim().length === 0) return;
  validateOptionalResource(label, id, knownResourceIds);
}
