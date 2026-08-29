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
    case "advanceCropGrowth":
    case "changeFriendship":
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
    case "runControl":
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
      if (typeof command.value === "object" && command.value !== null && command.value.kind === "var") {
        assert(context.variableIds.has(command.value.id), `setSwitch: operand variableId가 존재하지 않습니다: ${command.value.id}`);
      }
      return;
    case "setVariable":
      assert(context.variableIds.has(command.variableId), `setVariable: variableId가 존재하지 않습니다: ${command.variableId}`);
      if (typeof command.value !== "number") {
        assert(context.variableIds.has(command.value.id), `setVariable: operand variableId가 존재하지 않습니다: ${command.value.id}`);
      }
      return;
    case "getFriendship":
      assert(context.variableIds.has(command.variableId), `getFriendship: variableId가 존재하지 않습니다: ${command.variableId}`);
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
      if (command.troopSource !== "variable") {
        assert(context.troopIds.has(command.troopId), `battleProcessing: troopId가 존재하지 않습니다: ${command.troopId}`);
      } else if (command.troopVariableId) {
        assert(context.variableIds.has(command.troopVariableId), `battleProcessing: troopVariableId가 존재하지 않습니다: ${command.troopVariableId}`);
      }
      validateCommands(command.victoryBranch ?? [], context);
      validateCommands(command.defeatBranch ?? [], context);
      validateCommands(command.escapeBranch ?? [], context);
      return;
    case "learnSkill":
      if ((command.actorId ?? "").trim().length > 0) {
        assert(context.actorIds.has(command.actorId), `learnSkill: actorId가 존재하지 않습니다: ${command.actorId}`);
      }
      assert(context.skillIds.has(command.skillId), `learnSkill: skillId가 존재하지 않습니다: ${command.skillId}`);
      return;
    case "changeExp":
      if ((command.actorId ?? "").trim().length > 0) {
        assert(context.actorIds.has(command.actorId), `changeExp: actorId가 존재하지 않습니다: ${command.actorId}`);
      }
      if (typeof command.amount !== "number") {
        assert(context.variableIds.has(command.amount.id), `changeExp: amount variableId가 존재하지 않습니다: ${command.amount.id}`);
      }
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
    case "changeGold":
      if (typeof command.amount !== "number") {
        assert(context.variableIds.has(command.amount.id), `changeGold: amount variableId가 존재하지 않습니다: ${command.amount.id}`);
      }
      return;
    case "changeItem":
      assert(context.itemIds.has(command.itemId), `changeItem: itemId가 존재하지 않습니다: ${command.itemId}`);
      if (typeof command.amount !== "number") {
        assert(context.variableIds.has(command.amount.id), `changeItem: amount variableId가 존재하지 않습니다: ${command.amount.id}`);
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
    case "shop": {
      // 상점은 아이템 탭과 장비 탭을 함께 진열한다 — 예전에는 items 만 대조해서
      // 무기점(장비 id)을 만들면 프로젝트가 참조 검증에서 걸려 아예 로드되지 않았다.
      const sellable = union(context.itemIds, context.equipmentIds);
      requireExistingIds("shop: item", command.itemIds, sellable);
      if (command.stock) requireExistingIds("shop stock: item", command.stock.map((entry) => entry.itemId), sellable);
      return;
    }
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
    case "npcActivity":
    case "friendshipAtLeast":
    case "battleResult":
    case "run":
      return;
    case "all":
    case "any":
      for (const child of condition.conditions) validatePageCondition(child, context);
      return;
    case "not":
      validatePageCondition(condition.condition, context);
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
    case "npcActivity":
    case "friendshipAtLeast":
    case "battleResult":
    case "run":
      return;
    case "all":
    case "any":
      for (const child of condition.conditions) validateBattleEventCondition(child as BattleEventCondition, context);
      return;
    case "not":
      validateBattleEventCondition(condition.condition as BattleEventCondition, context);
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
  // selfSwitch/actor/item/gold/timer/timePhase/season/npcActivity 조건은 전역 스위치/변수 id를 참조하지 않으므로 검증 생략.
}

function requireExistingIds(label: string, ids: readonly string[], knownIds: ReadonlySet<string>): void {
  for (const id of ids) assert(knownIds.has(id), `${label}가 존재하지 않습니다: ${id}`);
}

function union(left: ReadonlySet<string>, right: ReadonlySet<string>): ReadonlySet<string> {
  const merged = new Set(left);
  for (const id of right) merged.add(id);
  return merged;
}

function validateOptionalCommandResource(
  label: string,
  id: string,
  knownResourceIds: ReadonlySet<string>
): void {
  if (id.trim().length === 0) return;
  validateOptionalResource(label, id, knownResourceIds);
}
