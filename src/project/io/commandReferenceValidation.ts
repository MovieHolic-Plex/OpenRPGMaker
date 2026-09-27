import { BUILTIN_EQUIPMENT_SLOTS } from "@/project/equipmentSlots";
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
  appearanceIds?: ReadonlySet<string>;
  actorIds: ReadonlySet<string>;
  classIds: ReadonlySet<string>;
  enemyIds: ReadonlySet<string>;
  enemySlotIds?: ReadonlySet<string>;
  itemIds: ReadonlySet<string>;
  equipmentIds: ReadonlySet<string>;
  equipmentSlotIds?: ReadonlySet<string>;
  skillIds: ReadonlySet<string>;
  animationIds: ReadonlySet<string>;
  switchIds: ReadonlySet<string>;
  variableIds: ReadonlySet<string>;
  commonEventIds: ReadonlySet<string>;
  endingIds: ReadonlySet<string>;
  gameOverIds?: ReadonlySet<string>;
  mapIds: ReadonlySet<string>;
  troopIds: ReadonlySet<string>;
  speciesIds: ReadonlySet<string>;
  resourceIds: ReadonlySet<string>;
  /** 생략하면 기존 호출자처럼 진영 명령을 참조 없는 명령으로 취급한다. */
  factionIds?: ReadonlySet<string>;

};

export function validateEventPages(pages: readonly EventPage[], context: ReferenceContext): void {
  for (const page of pages) {
    if (page.graphic.appearanceId !== undefined) assert(context.appearanceIds?.has(page.graphic.appearanceId) === true, `page ${page.id}: appearanceId does not exist: ${page.graphic.appearanceId}`);
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

/** 이벤트 명령 트리에서 아이템 참조를 모은다. 검증과 같은 중첩 분기 구조를 순회한다. */
export function collectCommandItemReferenceIds(commands: readonly Command[], ids: Set<string>): void {
  for (const command of commands) collectCommandItemReferences(command, ids);
}

function collectCommandItemReferences(command: Command, ids: Set<string>): void {
  switch (command.kind) {
    case "changeItem":
      ids.add(command.itemId);
      return;
    case "equipTool":
      if (command.itemId) ids.add(command.itemId);
      return;
    case "shop":
      for (const itemId of command.itemIds) ids.add(itemId);
      for (const stock of command.stock ?? []) ids.add(stock.itemId);
      for (const entry of command.buyback ?? []) ids.add(entry.itemId);
      for (const line of command.cartLines ?? []) ids.add(line.itemId);
      for (const consignment of command.consignments ?? []) ids.add(consignment.itemId);
      for (const ticket of command.pawnTickets ?? []) ids.add(ticket.itemId);
      for (const itemId of command.appraisalUnidentifiedPool ?? []) ids.add(itemId);
      collectCommandItemReferenceIds(command.transactionBranch ?? [], ids);
      collectCommandItemReferenceIds(command.failedTransactionBranch ?? [], ids);
      return;
    case "choices":
      for (const option of command.options) collectCommandItemReferenceIds(option.branch, ids);
      collectCommandItemReferenceIds(command.cancelBranch ?? [], ids);
      return;
    case "presentItem":
      for (const itemId of command.itemIds ?? []) ids.add(itemId);
      for (const option of command.options) {
        ids.add(option.itemId);
        collectCommandItemReferenceIds(option.branch, ids);
      }
      collectCommandItemReferenceIds(command.otherwiseBranch ?? [], ids);
      collectCommandItemReferenceIds(command.cancelBranch ?? [], ids);
      return;
    case "fork":
      collectConditionItemReferenceIds(command.condition, ids);
      collectCommandItemReferenceIds(command.then, ids);
      collectCommandItemReferenceIds(command.else ?? [], ids);
      return;
    case "loop":
      collectCommandItemReferenceIds(command.body, ids);
      return;
    case "battleProcessing":
      collectCommandItemReferenceIds(command.victoryBranch ?? [], ids);
      collectCommandItemReferenceIds(command.defeatBranch ?? [], ids);
      collectCommandItemReferenceIds(command.escapeBranch ?? [], ids);
      return;
    case "promoteActor":
    case "evolveMonster":
      collectCommandItemReferenceIds(command.successBranch ?? [], ids);
      collectCommandItemReferenceIds(command.failureBranch ?? [], ids);
      return;
    case "inn":
      collectCommandItemReferenceIds(command.notEnoughBranch ?? [], ids);
      return;
    default:
      return;
  }
}

export function collectConditionItemReferenceIds(condition: Condition | BattleEventCondition, ids: Set<string>): void {
  switch (condition.kind) {
    case "item":
      ids.add(condition.itemId);
      return;
    case "all":
    case "any":
      for (const child of condition.conditions) collectConditionItemReferenceIds(child, ids);
      return;
    case "not":
      collectConditionItemReferenceIds(condition.condition, ids);
      return;
    default:
      return;
  }
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
    case "checkpointSave":
    case "runControl":
    case "removeFollower":
    case "setLighting":
    case "addLight":
    case "removeLight":
    case "setWeather":
    case "returnToTitle":
    case "displayTextSettings":
      return;
    case "changeFactionStance":
      if (!context.factionIds) return;
      assert(context.factionIds.has(command.a), `changeFactionStance: faction A가 존재하지 않습니다: ${command.a}`);
      assert(context.factionIds.has(command.b), `changeFactionStance: faction B가 존재하지 않습니다: ${command.b}`);
      return;
    case "gameOver":
    case "killPlayer":
      // factionIds 와 같은 규약: 목록을 넘기지 않은 호출자(조수 명령 보조 등)는 참조 검사를 생략한다.
      // 예전엔 undefined 가 assert 를 실패시켜 정의된 게임 오버까지 「missing definition」 으로 거부했다.
      if (command.gameOverId && context.gameOverIds) assert(context.gameOverIds.has(command.gameOverId), `gameOver: missing definition ${command.gameOverId}`);
      return;
    case "ending":
      validateOptionalCommandResource("ending.presentation.musicResourceId", command.presentation?.musicResourceId ?? "", context.resourceIds);
      validateOptionalCommandResource("ending.presentation.backgroundResourceId", command.presentation?.backgroundResourceId ?? "", context.resourceIds);
      return;
    case "triggerEnding":
      if (command.endingId) assert(context.endingIds.has(command.endingId), `triggerEnding: endingId가 존재하지 않습니다: ${command.endingId}`);
      return;
    case "addFollower":
      if ((command.actorId ?? "").trim().length > 0) assert(context.actorIds.has(command.actorId ?? ""), `addFollower: actorId가 존재하지 않습니다: ${command.actorId ?? ""}`);
      if (command.graphic?.sprite?.id) validateOptionalCommandResource("addFollower: graphic.sprite", command.graphic.sprite.id, context.resourceIds);
      return;
    case "changeFace":
      if (command.appearanceId !== undefined) assert(context.appearanceIds?.has(command.appearanceId) === true, `changeFace: appearanceId does not exist: ${command.appearanceId}`);
      validateOptionalCommandResource("changeFace: resourceId", command.resourceId, context.resourceIds);
      return;
    case "choices":
      for (const option of command.options) validateCommands(option.branch, context);
      validateCommands(command.cancelBranch ?? [], context);
      return;
    case "presentItem":
      requireExistingIds("presentItem: itemIds", command.itemIds ?? [], context.itemIds);
      requireExistingIds("presentItem: option itemId", command.options.map((option) => option.itemId), context.itemIds);
      for (const option of command.options) validateCommands(option.branch, context);
      validateCommands(command.otherwiseBranch ?? [], context);
      validateCommands(command.cancelBranch ?? [], context);
      return;
    case "loop":
      validateCommands(command.body, context);
      return;
    case "fork":
      validateCondition(command.condition, context.switchIds, context.variableIds);
      validateMonsterSpeciesReferences(command.condition, context);
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
    case "inn":
      validateCommands(command.notEnoughBranch ?? [], context);
      return;
    case "craftRecipe":
    case "applyItemUpgrade":
      if (command.resultVariableId !== undefined) {
        assert(context.variableIds.has(command.resultVariableId), `${command.kind}: resultVariableId does not exist: ${command.resultVariableId}`);
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
      assert((context.equipmentSlotIds ?? new Set(BUILTIN_EQUIPMENT_SLOTS.map((slot) => slot.id))).has(command.slot), `changeEquipment: slot does not exist: ${command.slot}`);
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
      // 장비도 소지품(session.inventory[equipmentId])으로 들어간다 — 상점 구매·장착 메뉴와 같은 저장소.
      assert(context.itemIds.has(command.itemId) || context.equipmentIds.has(command.itemId), `changeItem: itemId가 아이템·장비 어디에도 없습니다: ${command.itemId}`);
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
    case "showEmote":
      return;
    case "shop": {
      // 상점은 아이템 탭과 장비 탭을 함께 진열한다 — 예전에는 items 만 대조해서
      // 무기점(장비 id)을 만들면 프로젝트가 참조 검증에서 걸려 아예 로드되지 않았다.
      const sellable = union(context.itemIds, context.equipmentIds);
      requireExistingIds("shop: item", command.itemIds, sellable);
      if (command.stock) requireExistingIds("shop stock: item", command.stock.map((entry) => entry.itemId), sellable);
      validateCommands(command.transactionBranch ?? [], context);
      validateCommands(command.failedTransactionBranch ?? [], context);
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
    case "monsterSpecies":
      assert(context.speciesIds.has(condition.speciesId), `condition: speciesId가 존재하지 않습니다: ${condition.speciesId}`);
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
    case "actorStat":
    case "actorState":
    case "partyLeader":
    case "partySize":
    case "facing":
    case "relativeFacing":
    case "hiding":
    case "pursuitActive":
    case "clearCount":
    case "endingSeen":
    case "newGamePlus":
    case "weekday":
    case "stringVariable":
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
    case "monsterSpecies":
      assert(context.speciesIds.has(condition.speciesId), `condition: speciesId가 존재하지 않습니다: ${condition.speciesId}`);
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
      assert(context.enemyIds.has(condition.enemyId) || (context.enemySlotIds?.has(condition.enemyId) ?? false), `battle condition: enemyId가 존재하지 않습니다: ${condition.enemyId}`);
      return;
    case "enemyTurn":
      assert(context.enemyIds.has(condition.enemyId), `battle condition: enemyId가 존재하지 않습니다: ${condition.enemyId}`);
      return;
    case "enemyHpBelow":
      if (condition.enemyId) assert(context.enemyIds.has(condition.enemyId) || (context.enemySlotIds?.has(condition.enemyId) ?? false), `battle condition: enemyId가 존재하지 않습니다: ${condition.enemyId}`);
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

export function validateOptionalCommandResource(
  label: string,
  id: string,
  knownResourceIds: ReadonlySet<string>
): void {
  if (id.trim().length === 0) return;
  validateOptionalResource(label, id, knownResourceIds);
}


export function validateMonsterSpeciesReferences(condition: Condition, context: Pick<ReferenceContext, "speciesIds">): void {
  if (condition.kind === "monsterSpecies") {
    assert(context.speciesIds.has(condition.speciesId), `condition: speciesId가 존재하지 않습니다: ${condition.speciesId}`);
  } else if (condition.kind === "all" || condition.kind === "any") {
    for (const child of condition.conditions) validateMonsterSpeciesReferences(child, context);
  } else if (condition.kind === "not") {
    validateMonsterSpeciesReferences(condition.condition, context);
  }
}
