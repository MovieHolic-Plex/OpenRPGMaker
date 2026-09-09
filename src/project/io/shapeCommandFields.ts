import { isEquipmentSlotId } from "@/project/equipmentSlots";
import { isEmoteKind } from "@/project/emotes";
import { SHOP_MESSAGE_TYPES } from "@/project/shopMessages";
import { ProjectFormatError } from "./errors";
import { commandKinds, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { validateLightSource } from "./shapeLightingFields";
import { isSeason, isTimePhase } from "@/project/gameTime";

import { isRelationshipState } from "@/project/relationshipState";
export function validateCommandArray(label: string, value: unknown): void {
  for (const [index, command] of requireArray(label, value).entries()) {
    validateCommandShape(`${label}[${index}]`, command);
  }
}

function validateCommandShape(label: string, value: unknown): void {
  const command = requireRecord(label, value);
  const kind = requireString(`${label}.kind`, command.kind);
  if (!commandKinds.has(kind)) throw new ProjectFormatError(`command ${label}: 알 수 없는 kind: ${kind}`);
  switch (kind) {
    case "choices":
      for (const [index, option] of requireArray(`${label}.options`, command.options).entries()) {
        const record = requireRecord(`${label}.options[${index}]`, option);
        requireString(`${label}.options[${index}].text`, record.text);
        validateCommandArray(`${label}.options[${index}].branch`, record.branch);
      }
      if (command.cancelBehavior !== undefined) requireChoiceCancelBehavior(`${label}.cancelBehavior`, command.cancelBehavior);
      if (command.cancelBranch !== undefined) validateCommandArray(`${label}.cancelBranch`, command.cancelBranch);
      return;
    case "changeFace":
      requireString(`${label}.resourceId`, command.resourceId);
      if (command.appearanceId !== undefined && !requireString(`${label}.appearanceId`, command.appearanceId).trim()) {
        throw new ProjectFormatError(`${label}.appearanceId is blank`);
      }
      if (command.presentation !== undefined && command.presentation !== "face" && command.presentation !== "bust") {
        throw new ProjectFormatError(`${label}.presentation must be face or bust`);
      }
      requireFacePosition(`${label}.position`, command.position);
      requireBoolean(`${label}.flipHorizontally`, command.flipHorizontally);
      return;
    case "displayTextSettings":
      requireMessageWindowFormat(`${label}.format`, command.format);
      requireMessageWindowPosition(`${label}.position`, command.position);
      requireBoolean(`${label}.preventObscuringPlayer`, command.preventObscuringPlayer);
      requireBoolean(`${label}.allowEventMovementDuringWait`, command.allowEventMovementDuringWait);
      return;
    case "inputNumber": {
      requireString(`${label}.variableId`, command.variableId);
      const digits = requireNumber(`${label}.digits`, command.digits);
      if (!(Number.isInteger(digits) && digits >= 1 && digits <= 6)) {
        throw new ProjectFormatError(`${label}.digits가 잘못되었습니다.`);
      }
      if (command.prompt !== undefined) requireString(`${label}.prompt`, command.prompt);
      if (command.showPad !== undefined) requireBoolean(`${label}.showPad`, command.showPad);
      return;
    }
    case "fork":
      validateConditionShape(`${label}.condition`, command.condition);
      validateCommandArray(`${label}.then`, command.then);
      if (command.else !== undefined) validateCommandArray(`${label}.else`, command.else);
      return;
    case "loop":
      validateCommandArray(`${label}.body`, command.body);
      return;
    case "setSelfSwitch":
      requireSelfSwitchKey(`${label}.key`, command.key);
      requireBoolean(`${label}.value`, command.value);
      return;
    case "setSwitch":
      requireString(`${label}.switchId`, command.switchId);
      validateSwitchValue(`${label}.value`, command.value);
      return;
    case "setVariable":
      requireString(`${label}.variableId`, command.variableId);
      requireString(`${label}.op`, command.op);
      validateVariableOperand(`${label}.value`, command.value);
      return;
    case "advanceTime":
      if (command.minutes !== undefined) requireNumber(`${label}.minutes`, command.minutes);
      if (command.hours !== undefined) requireNumber(`${label}.hours`, command.hours);
      if (command.days !== undefined) requireNumber(`${label}.days`, command.days);
      return;
    case "advanceCropGrowth":
      requireNumber(`${label}.days`, command.days);
      return;
    case "setRelationship": {
      if (command.npcKey !== undefined) requireString(`${label}.npcKey`, command.npcKey);
      const state = requireString(`${label}.state`, command.state);
      if (isRelationshipState(state)) return;
      throw new ProjectFormatError(`${label}.state 값이 올바르지 않습니다: ${state}`);
    }
    case "changeFriendship":
      if (command.npcKey !== undefined) requireString(`${label}.npcKey`, command.npcKey);
      requireNumber(`${label}.delta`, command.delta);
      return;
    case "changeFactionStance": {
      requireString(`${label}.a`, command.a);
      requireString(`${label}.b`, command.b);
      const op = requireString(`${label}.op`, command.op);
      if (op !== "=" && op !== "+=" && op !== "-=") throw new ProjectFormatError(`${label}.op가 잘못되었습니다.`);
      requireNumber(`${label}.value`, command.value);
      return;
    }
    case "getFriendship":
      if (command.npcKey !== undefined) requireString(`${label}.npcKey`, command.npcKey);
      requireString(`${label}.variableId`, command.variableId);
      return;
    case "craftRecipe":
      requireString(`${label}.recipeId`, command.recipeId);
      if (command.resultVariableId !== undefined) requireString(`${label}.resultVariableId`, command.resultVariableId);
      return;
    case "applyItemUpgrade":
      requireString(`${label}.upgradeId`, command.upgradeId);
      if (command.resultVariableId !== undefined) requireString(`${label}.resultVariableId`, command.resultVariableId);
      return;
    case "equipTool":
      if (command.itemId !== undefined) requireString(`${label}.itemId`, command.itemId);
      return;
    case "openChest":
      if (command.chestId !== undefined) requireString(`${label}.chestId`, command.chestId);
      return;
    case "setTime":
      requireNumber(`${label}.hour`, command.hour);
      if (command.minute !== undefined) requireNumber(`${label}.minute`, command.minute);
      return;
    case "sleepUntilMorning":
      return;
    case "transfer":
      if (command.direction !== undefined) requireTransferDirection(`${label}.direction`, command.direction);
      if (command.fade !== undefined) requireTransferFade(`${label}.fade`, command.fade);
      return;
    case "moveEvent":
      validateMoveRoute(`${label}.route`, command.route);
      return;
    case "setEventGraphicPattern":
      requireString(`${label}.eventId`, command.eventId);
      requireNumber(`${label}.pattern`, command.pattern);
      return;
    case "changeExp":
      requireString(`${label}.actorId`, command.actorId);
      requireActorAmountOp(`${label}.op`, command.op);
      validateVariableOperand(`${label}.amount`, command.amount);
      return;
    case "changeLevel":
      requireString(`${label}.actorId`, command.actorId);
      requireActorAmountOp(`${label}.op`, command.op);
      requireNumber(`${label}.amount`, command.amount);
      return;
    case "changeLifeSkillExp":
      requireString(`${label}.skillId`, command.skillId);
      if (command.op !== "=" && command.op !== "+=" && command.op !== "-=") throw new Error(`${label}.op must be =, +=, or -=`);
      validateVariableOperand(`${label}.amount`, command.amount);
      return;
    case "changeActorHp":
    case "changeActorMp":
      requireString(`${label}.actorId`, command.actorId);
      requireActorAmountOp(`${label}.op`, command.op);
      requireNumber(`${label}.amount`, command.amount);
      if (command.amountMode !== undefined && command.amountMode !== "flat" && command.amountMode !== "percent") {
        throw new ProjectFormatError(`${label}.amountMode가 잘못되었습니다.`);
      }
      return;
    case "changeGold":
      requireString(`${label}.op`, command.op);
      validateVariableOperand(`${label}.amount`, command.amount);
      return;
    case "changeItem":
      requireString(`${label}.itemId`, command.itemId);
      requireString(`${label}.op`, command.op);
      validateVariableOperand(`${label}.amount`, command.amount);
      return;
    case "learnSkill":
      requireString(`${label}.actorId`, command.actorId);
      requireString(`${label}.skillId`, command.skillId);
      if (command.action !== undefined) {
        const action = requireString(`${label}.action`, command.action);
        if (action !== "learn" && action !== "forget") {
          throw new ProjectFormatError(`${label}.action가 잘못되었습니다.`);
        }
      }
      return;
    case "battleProcessing":
      requireString(`${label}.troopId`, command.troopId);
      requireBoolean(`${label}.canEscape`, command.canEscape);
      requireBoolean(`${label}.canLose`, command.canLose);
      if (command.battleFlow !== undefined) {
        const flow = requireString(`${label}.battleFlow`, command.battleFlow);
        if (flow !== "gauge" && flow !== "strict") {
          throw new ProjectFormatError(`${label}.battleFlow가 잘못되었습니다.`);
        }
      }
      if (command.troopSource !== undefined) {
        const source = requireString(`${label}.troopSource`, command.troopSource);
        if (source !== "fixed" && source !== "variable") {
          throw new ProjectFormatError(`${label}.troopSource가 잘못되었습니다.`);
        }
      }
      if (command.troopVariableId !== undefined) requireString(`${label}.troopVariableId`, command.troopVariableId);
      if (command.branchOnResult !== undefined) requireBoolean(`${label}.branchOnResult`, command.branchOnResult);
      if (command.victoryBranch !== undefined) validateCommandArray(`${label}.victoryBranch`, command.victoryBranch);
      if (command.defeatBranch !== undefined) validateCommandArray(`${label}.defeatBranch`, command.defeatBranch);
      if (command.escapeBranch !== undefined) validateCommandArray(`${label}.escapeBranch`, command.escapeBranch);
      return;
    case "promoteActor":
      requireString(`${label}.actorId`, command.actorId);
      if (command.toClassId !== undefined) requireString(`${label}.toClassId`, command.toClassId);
      if (command.successBranch !== undefined) validateCommandArray(`${label}.successBranch`, command.successBranch);
      if (command.failureBranch !== undefined) validateCommandArray(`${label}.failureBranch`, command.failureBranch);
      return;
    case "changeEquipment":
      requireString(`${label}.actorId`, command.actorId);
      requireEquipmentSlot(`${label}.slot`, command.slot);
      requireString(`${label}.equipmentId`, command.equipmentId);
      return;
    case "giveMonster":
      requireString(`${label}.speciesId`, command.speciesId);
      requireNumber(`${label}.level`, command.level);
      if (command.nickname !== undefined) requireString(`${label}.nickname`, command.nickname);
      return;
    case "moveMonster":
      requireString(`${label}.instanceId`, command.instanceId);
      requireMonsterMoveTarget(`${label}.to`, command.to);
      return;
    case "evolveMonster":
      requireString(`${label}.instanceId`, command.instanceId);
      if (command.toSpeciesId !== undefined) requireString(`${label}.toSpeciesId`, command.toSpeciesId);
      if (command.successBranch !== undefined) validateCommandArray(`${label}.successBranch`, command.successBranch);
      if (command.failureBranch !== undefined) validateCommandArray(`${label}.failureBranch`, command.failureBranch);
      return;
    case "recoverAll":
      if (command.actorId !== undefined) requireString(`${label}.actorId`, command.actorId);
      return;
    case "cutsceneControl":
      requireCutsceneControlMode(`${label}.mode`, command.mode);
      if (command.skippable !== undefined) requireBoolean(`${label}.skippable`, command.skippable);
      return;
    case "checkpointSave":
      if (command.label !== undefined) requireString(`${label}.label`, command.label);
      return;
    case "openSaveMenu":
      return;
    case "spawnFieldEnemy": {
      const spawn = requireRecord(`${label}.spawn`, command.spawn) as { id?: unknown; troopId?: unknown; area?: unknown };
      requireString(`${label}.spawn.id`, spawn.id);
      requireString(`${label}.spawn.troopId`, spawn.troopId);
      requireRecord(`${label}.spawn.area`, spawn.area);
      return;
    }
    case "despawnFieldEnemy":
      requireString(`${label}.spawnId`, command.spawnId);
      return;
    case "runControl": {
      const action = requireString(`${label}.action`, command.action);
      if (action === "start") {
        if (command.seed !== undefined) requireNumber(`${label}.seed`, command.seed);
        if (command.runId !== undefined) requireString(`${label}.runId`, command.runId);
        if (command.startFloor !== undefined) requireNumber(`${label}.startFloor`, command.startFloor);
        return;
      }
      if (action === "advance") {
        if (command.amount !== undefined) {
          const amount = requireNumber(`${label}.amount`, command.amount);
          if (!Number.isInteger(amount) || amount < 1) {
            throw new ProjectFormatError(`${label}.amount는 1 이상의 정수여야 합니다.`);
          }
        }
        return;
      }
      if (action === "end") {
        requireRunResult(`${label}.result`, command.result);
        return;
      }
      if (action === "setFlag") {
        requireString(`${label}.flag`, command.flag);
        requireBoolean(`${label}.value`, command.value);
        return;
      }
      if (action === "resetRoom") {
        if (command.roomId !== undefined) requireString(`${label}.roomId`, command.roomId);
        return;
      }
      throw new ProjectFormatError(`${label}.action가 잘못되었습니다.`);
    }
    case "killPlayer":
      if (command.message !== undefined) requireString(`${label}.message`, command.message);
      return;
    case "triggerEnding":
      if (command.endingId !== undefined) requireString(`${label}.endingId`, command.endingId);
      return;
    case "addFollower":
      if (command.actorId !== undefined) requireString(`${label}.actorId`, command.actorId);
      if (command.name !== undefined) requireString(`${label}.name`, command.name);
      if (command.graphic !== undefined) requireRecord(`${label}.graphic`, command.graphic);
      return;
    case "removeFollower":
      if (command.name !== undefined) requireString(`${label}.name`, command.name);
      if (command.all !== undefined) requireBoolean(`${label}.all`, command.all);
      return;
    case "setLighting":
      requireNumber(`${label}.ambient`, command.ambient);
      if (command.color !== undefined) requireString(`${label}.color`, command.color);
      if (command.transitionMs !== undefined) requireNumber(`${label}.transitionMs`, command.transitionMs);
      return;
    case "addLight":
      validateLightSource(`${label}.source`, command.source);
      return;
    case "removeLight":
      if (command.id !== undefined) requireString(`${label}.id`, command.id);
      if (command.all !== undefined) requireBoolean(`${label}.all`, command.all);
      return;
    case "setWeather":
      requireWeatherKind(`${label}.weather`, command.weather);
      if (command.intensity !== undefined) {
        const intensity = requireNumber(`${label}.intensity`, command.intensity);
        if (intensity < 0 || intensity > 1) throw new ProjectFormatError(`${label}.intensity는 0~1이어야 합니다.`);
      }
      if (command.transitionMs !== undefined) requireNumber(`${label}.transitionMs`, command.transitionMs);
      return;
    case "showAnimation":
      validateShowAnimationTarget(`${label}.target`, command.target);
      requireString(`${label}.animationId`, command.animationId);
      if (command.wait !== undefined) requireBoolean(`${label}.wait`, command.wait);
      return;
    case "showEmote":
      validateEmoteTarget(`${label}.target`, command.target);
      requireEmoteKind(`${label}.emote`, command.emote);
      if (command.durationMs !== undefined) requireNumber(`${label}.durationMs`, command.durationMs);
      return;
    case "playMovie":
      requireString(`${label}.resourceId`, command.resourceId);
      if (command.wait !== undefined) requireBoolean(`${label}.wait`, command.wait);
      if (command.skippable !== undefined) requireBoolean(`${label}.skippable`, command.skippable);
      return;
    case "shop": {
      if ((command as Record<string, unknown>).shopServiceKind !== undefined) requireString(`${label}.shopServiceKind`, (command as Record<string, unknown>).shopServiceKind);
      if ((command as Record<string, unknown>).investmentLevel !== undefined) requireNumber(`${label}.investmentLevel`, (command as Record<string, unknown>).investmentLevel);
      for (const [index, itemId] of requireArray(`${label}.itemIds`, command.itemIds).entries()) {
        requireString(`${label}.itemIds[${index}]`, itemId);
      }
      if (command.allowSell !== undefined) requireBoolean(`${label}.allowSell`, command.allowSell);
      if (command.quantityMode !== undefined) {
        const qm = requireString(`${label}.quantityMode`, command.quantityMode);
        if (qm !== "single" && qm !== "select") throw new ProjectFormatError(`${label}.quantityMode가 잘못되었습니다.`);
      }
      if (command.shopType !== undefined) {
        const st = requireString(`${label}.shopType`, command.shopType);
        if (st !== "normal" && st !== "buyOnly" && st !== "sellOnly") throw new ProjectFormatError(`${label}.shopType가 잘못되었습니다.`);
      }
      if (command.messageType !== undefined) {
        const mt = requireString(`${label}.messageType`, command.messageType);
        if (!SHOP_MESSAGE_TYPES.some(messageType => messageType === mt)) throw new ProjectFormatError(`${label}.messageType가 잘못되었습니다.`);
      }
      if (command.merchantGold !== undefined) requireNumber(`${label}.merchantGold`, command.merchantGold);
      if (command.stock !== undefined) validateShopStock(`${label}.stock`, command.stock);
      // restockPolicy 는 유니언이다. 런타임은 이 값을 엄거하게 맞췐보고 그 밖은 shouldRestock 에서
      // false 로 떨어진다 — 오토를 그대로 통과시키면 오류도 경고도 없이 "재입고 안 함" 이 된다.
      // 조용한 오답보다 로드 시점 오류가 낫다.
      if (command.restockPolicy !== undefined) {
        const rp = requireString(`${label}.restockPolicy`, command.restockPolicy);
        if (rp !== "daily" && rp !== "weekly" && rp !== "onDemand") {
          throw new ProjectFormatError(`${label}.restockPolicy가 daily/weekly/onDemand 여야 합니다.`);
        }
      }
      if (command.economy !== undefined) validateShopEconomy(`${label}.economy`, command.economy);
      if (command.merchantGold !== undefined) {
        const mg = requireNumber(`${label}.merchantGold`, command.merchantGold);
        if (mg < 0 || mg > 999999) throw new ProjectFormatError(`${label}.merchantGold가 0~999999여야 합니다.`);
      }
      if (command.branchOnTransaction !== undefined) requireBoolean(`${label}.branchOnTransaction`, command.branchOnTransaction);
      if (command.transactionBranch !== undefined) validateCommandArray(`${label}.transactionBranch`, command.transactionBranch);
      if (command.branchOnFailedTransaction !== undefined) requireBoolean(`${label}.branchOnFailedTransaction`, command.branchOnFailedTransaction);
      if (command.failedTransactionBranch !== undefined) validateCommandArray(`${label}.failedTransactionBranch`, command.failedTransactionBranch);
      return;
    }
    case "inn": {
      if (typeof command.price === "number") {
        if (command.price < 0 || command.price > 999999) throw new ProjectFormatError(`${label}.price가 0~999999여야 합니다.`);
        requireNumber(`${label}.price`, command.price);
      } else {
        validateVariableOperand(`${label}.price`, command.price);
      }
      if (command.note !== undefined) requireString(`${label}.note`, command.note);
      if (command.question !== undefined) requireString(`${label}.question`, command.question);
      if (command.recoverMp !== undefined) requireBoolean(`${label}.recoverMp`, command.recoverMp);
      if (command.advanceToMorning !== undefined) requireBoolean(`${label}.advanceToMorning`, command.advanceToMorning);
      if (command.restDurationMs !== undefined) {
        const restMs = requireNumber(`${label}.restDurationMs`, command.restDurationMs);
        if (restMs < 0 || restMs > 10000) throw new ProjectFormatError(`${label}.restDurationMs가 0~10000이어야 합니다.`);
      }
      if (command.wakeDurationMs !== undefined) {
        const wakeMs = requireNumber(`${label}.wakeDurationMs`, command.wakeDurationMs);
        if (wakeMs < 0 || wakeMs > 10000) throw new ProjectFormatError(`${label}.wakeDurationMs가 0~10000이어야 합니다.`);
      }
      if (command.branchOnNotEnoughGold !== undefined) requireBoolean(`${label}.branchOnNotEnoughGold`, command.branchOnNotEnoughGold);
      if (command.notEnoughBranch !== undefined) validateCommandArray(`${label}.notEnoughBranch`, command.notEnoughBranch);
      return;
    }
    case "enterHeroName": {
      requireString(`${label}.actorId`, command.actorId);
      requireBoolean(`${label}.showInitialName`, command.showInitialName);
      const maxLength = requireNumber(`${label}.maxLength`, command.maxLength);
      if (Number.isInteger(maxLength) && maxLength >= 1 && maxLength <= 12) return;
      throw new ProjectFormatError(`${label}.maxLength가 잘못되었습니다.`);
    }
    default:
      return;
  }
}

function requireSelfSwitchKey(label: string, value: unknown): void {
  const key = requireString(label, value);
  if (key === "A" || key === "B" || key === "C" || key === "D") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireFacePosition(label: string, value: unknown): void {
  const position = requireString(label, value);
  if (position === "left" || position === "right") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireMessageWindowFormat(label: string, value: unknown): void {
  const format = requireString(label, value);
  if (format === "normal" || format === "transparent") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireMessageWindowPosition(label: string, value: unknown): void {
  const position = requireString(label, value);
  if (position === "top" || position === "center" || position === "bottom") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireChoiceCancelBehavior(label: string, value: unknown): void {
  const behavior = requireString(label, value);
  if (
    behavior === "disallow" ||
    behavior === "choice1" ||
    behavior === "choice2" ||
    behavior === "choice3" ||
    behavior === "choice4" ||
    behavior === "choice5" ||
    behavior === "branch"
  ) return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireActorAmountOp(label: string, value: unknown): void {
  const op = requireString(label, value);
  if (op === "=" || op === "+=" || op === "-=") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireTransferFade(label: string, value: unknown): void {
  const fade = requireString(label, value);
  if (fade === "black" || fade === "white" || fade === "none") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireWeatherKind(label: string, value: unknown): void {
  const kind = requireString(label, value);
  if (kind === "none" || kind === "rain" || kind === "storm" || kind === "snow" || kind === "fog") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function validateShowAnimationTarget(label: string, value: unknown): void {
  if (value === "player") return;
  const target = requireRecord(label, value);
  if (target.eventId !== undefined) {
    requireString(`${label}.eventId`, target.eventId);
    return;
  }
  requireNumber(`${label}.x`, target.x);
  requireNumber(`${label}.y`, target.y);
}

function validateEmoteTarget(label: string, value: unknown): void {
  if (value === "player") return;
  const target = requireRecord(label, value);
  requireString(`${label}.eventId`, target.eventId);
}

function requireEmoteKind(label: string, value: unknown): void {
  if (!isEmoteKind(requireString(label, value))) {
    throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
  }
}

function requireCutsceneControlMode(label: string, value: unknown): void {
  const mode = requireString(label, value);
  if (mode === "begin" || mode === "end") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireEquipmentSlot(label: string, value: unknown): void {
  const slot = requireString(label, value);
  if (isEquipmentSlotId(slot)) return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireMonsterMoveTarget(label: string, value: unknown): void {
  const target = requireString(label, value);
  if (target === "party" || target === "box") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireRunResult(label: string, value: unknown): void {
  const result = requireString(label, value);
  if (result === "completed" || result === "failed" || result === "abandoned") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

// Condition 유니온(fork/페이지 조건 공용)이 지원하는 모든 kind를 허용해야 한다.
// switch/variable만 검증하면 item/selfSwitch/gold 조건이 든 프로젝트의 저장/불러오기가 깨진다.
export function validateConditionShape(label: string, value: unknown): void {
  const condition = requireRecord(label, value);
  const kind = requireString(`${label}.kind`, condition.kind);
  switch (kind) {
    case "switch":
      requireString(`${label}.switchId`, condition.switchId);
      requireBoolean(`${label}.value`, condition.value);
      return;
    case "variable":
      requireString(`${label}.variableId`, condition.variableId);
      requireString(`${label}.op`, condition.op);
      requireNumber(`${label}.value`, condition.value);
      return;
    case "selfSwitch":
      requireString(`${label}.key`, condition.key);
      requireBoolean(`${label}.value`, condition.value);
      return;
    case "actor":
      requireString(`${label}.actorId`, condition.actorId);
      requireBoolean(`${label}.present`, condition.present);
      return;
    case "item":
      requireString(`${label}.itemId`, condition.itemId);
      requireBoolean(`${label}.present`, condition.present);
      return;
    case "gold":
      requireString(`${label}.op`, condition.op);
      requireNumber(`${label}.amount`, condition.amount);
      return;
    case "timer":
      requireString(`${label}.timerId`, condition.timerId);
      requireNumber(`${label}.seconds`, condition.seconds);
      return;
    case "timePhase": {
      const phase = requireString(`${label}.phase`, condition.phase);
      if (isTimePhase(phase)) return;
      break;
    }
    case "season": {
      const season = requireString(`${label}.season`, condition.season);
      if (isSeason(season)) return;
      break;
    }
    case "npcActivity":
      requireString(`${label}.activity`, condition.activity);
      return;
    case "friendshipAtLeast":
      if (condition.npcKey !== undefined) requireString(`${label}.npcKey`, condition.npcKey);
      requireNumber(`${label}.value`, condition.value);
      return;
    case "relationshipAtLeast": {
      if (condition.npcKey !== undefined) requireString(`${label}.npcKey`, condition.npcKey);
      const state = requireString(`${label}.state`, condition.state);
      if (isRelationshipState(state)) return;
      throw new ProjectFormatError(`${label}.state 값이 올바르지 않습니다: ${state}`);
    }
    case "battleResult": {
      const result = requireString(`${label}.result`, condition.result);
      if (result === "victory" || result === "defeat" || result === "escape") return;
      break;
    }
    case "run": {
      const query = requireString(`${label}.query`, condition.query);
      if (query === "active") {
        if (condition.value !== undefined) requireBoolean(`${label}.value`, condition.value);
        return;
      }
      if (query === "floor") {
        requireString(`${label}.op`, condition.op);
        requireNumber(`${label}.value`, condition.value);
        return;
      }
      if (query === "flag") {
        requireString(`${label}.flag`, condition.flag);
        requireBoolean(`${label}.value`, condition.value);
        return;
      }
      if (query === "result") {
        requireRunResult(`${label}.result`, condition.result);
        return;
      }
      throw new ProjectFormatError(`${label}.query가 잘못되었습니다.`);
    }
    case "all":
    case "any": {
      const children = requireArray(`${label}.conditions`, condition.conditions);
      for (const [index, child] of children.entries()) {
        validateConditionShape(`${label}.conditions[${index}]`, child);
      }
      return;
    }
    case "not":
      validateConditionShape(`${label}.condition`, condition.condition);
      return;
  }
  throw new ProjectFormatError(`${label}: 알 수 없는 condition kind: ${kind}`);
}

/**
 * 상점 경제 설정을 검사한다.
 *
 * 런타임은 이 값들을 `=== true` 로 엄거하게 맞췐보고 `normalizeHaggleConfig` 가 숫자를
 * 고정하밌으로 오토가 있어도 **통지 않는다.** 그게 더 나쁘다 — `haggleEnabled: "yes"` 는
 * 참 같은 문자열이지만 `=== true` 가 아니라 저자가 컸 기능이 오류도 경고도 없이 조용하
 * 꺼진다. 저작 실수를 로드 지점에서 드러내는 것이 이 검사의 목적이다.
 */
export function validateShopEconomy(label: string, value: unknown): void {
  const economy = requireRecord(label, value);
  for (const flag of [
    "dynamicPricing",
    "haggleEnabled",
    "closingSaleEnabled",
    "shopkeeperEnabled",
  ] as const) {
    if (economy[flag] !== undefined) requireBoolean(`${label}.${flag}`, economy[flag]);
  }
  for (const [key, min, max] of [
    ["inflationFactor", 0, 100],
    ["tradeRouteMarkup", 0, 100],
  ] as const) {
    if (economy[key] === undefined) continue;
    const n = requireNumber(`${label}.${key}`, economy[key]);
    if (!Number.isFinite(n) || n < min || n > max) {
      throw new ProjectFormatError(`${label}.${key}가 ${min}~${max} 사이 유한수여야 합니다.`);
    }
  }
  if (economy.haggle !== undefined) {
    const haggle = requireRecord(`${label}.haggle`, economy.haggle);
    // 상한은 런타임 고정 범위보다 넓게 둔다 — 여기서 막으려는 것은 1.79e308 같은
    // 무한대·송실로 저장된 값이지 집필한 수자가 아니다.
    for (const [key, min, max] of [
      ["patience", 0, 999],
      ["insultRatio", 0, 1],
      ["maxDiscount", 0, 1],
    ] as const) {
      if (haggle[key] === undefined) continue;
      const n = requireNumber(`${label}.haggle.${key}`, haggle[key]);
      if (!Number.isFinite(n) || n < min || n > max) {
        throw new ProjectFormatError(`${label}.haggle.${key}가 ${min}~${max} 사이 유한수여야 합니다.`);
      }
    }
    if (haggle.skillId !== undefined) requireString(`${label}.haggle.skillId`, haggle.skillId);
  }
}

export function validateShopStock(label: string, value: unknown): void {
  for (const [index, stockValue] of requireArray(label, value).entries()) {
    const entry = requireRecord(`${label}[${index}]`, stockValue);
    requireString(`${label}[${index}].itemId`, entry.itemId);
    if (entry.seasons !== undefined) {
      for (const [seasonIndex, seasonValue] of requireArray(`${label}[${index}].seasons`, entry.seasons).entries()) {
        const season = requireString(`${label}[${index}].seasons[${seasonIndex}]`, seasonValue);
        if (!isSeason(season)) throw new ProjectFormatError(`${label}[${index}].seasons[${seasonIndex}]가 잘못되었습니다.`);
      }
    }
    if (entry.priceOverride !== undefined) {
      const priceOverride = requireNumber(`${label}[${index}].priceOverride`, entry.priceOverride);
      if (priceOverride < 0 || priceOverride > 999999) throw new ProjectFormatError(`${label}[${index}].priceOverride가 0~999999여야 합니다.`);
    }
    if (entry.priceBySeason !== undefined) {
      const prices = requireRecord(`${label}[${index}].priceBySeason`, entry.priceBySeason);
      for (const [season, price] of Object.entries(prices)) {
        if (!isSeason(season)) throw new ProjectFormatError(`${label}[${index}].priceBySeason.${season} 계절이 잘못되었습니다.`);
        const seasonalPrice = requireNumber(`${label}[${index}].priceBySeason.${season}`, price);
        if (seasonalPrice < 0 || seasonalPrice > 999999) throw new ProjectFormatError(`${label}[${index}].priceBySeason.${season}가 0~999999여야 합니다.`);
      }
    }
  }
}

export function validateMoveRoute(label: string, value: unknown): void {
  const route = requireRecord(label, value);
  for (const [index, move] of requireArray(`${label}.moves`, route.moves).entries()) {
    validateMoveCommandShape(`${label}.moves[${index}]`, move);
  }
  requireBoolean(`${label}.repeat`, route.repeat);
}

function validateMoveCommandShape(label: string, value: unknown): void {
  const command = requireRecord(label, value);
  const kind = requireString(`${label}.kind`, command.kind);
  switch (kind) {
    case "move":
    case "turn":
      requireDir(`${label}.dir`, command.dir);
      return;
    case "moveDiagonal":
      requireHorizontalDir(`${label}.horizontal`, command.horizontal);
      requireVerticalDir(`${label}.vertical`, command.vertical);
      return;
    case "jump":
      requireNumber(`${label}.dx`, command.dx);
      requireNumber(`${label}.dy`, command.dy);
      validateHopFields(label, command);
      return;
    case "dropIn":
      validateHopFields(label, command);
      if (command.impact !== undefined) requireBoolean(`${label}.impact`, command.impact);
      return;
    case "turnRelative":
      requireRelativeTurn(`${label}.turn`, command.turn);
      return;
    case "setDirectionFix":
    case "setThrough":
    case "setAnimation":
      requireBoolean(`${label}.enabled`, command.enabled);
      return;
    case "changeOpacity":
    case "changeSpeed":
    case "changeFrequency":
      requireNumber(`${label}.delta`, command.delta);
      return;
    case "setSwitch":
      requireString(`${label}.switchId`, command.switchId);
      requireBoolean(`${label}.value`, command.value);
      return;
    case "changeGraphic":
      requireString(`${label}.spriteId`, command.spriteId);
      return;
    case "npcTransfer":
      requireString(`${label}.mapId`, command.mapId);
      requireNumber(`${label}.x`, command.x);
      requireNumber(`${label}.y`, command.y);
      if (command.direction !== undefined) requireDir(`${label}.direction`, command.direction);
      return;
    case "playSe":
      requireString(`${label}.resourceId`, command.resourceId);
      return;
    case "moveRandom":
    case "moveTowardPlayer":
    case "moveAwayFromPlayer":
    case "stepForward":
    case "land":
    case "turnRandom":
    case "turnTowardPlayer":
    case "turnAwayFromPlayer":
    case "wait":
      return;
    default:
      throw new ProjectFormatError(`${label}: 알 수 없는 move command kind: ${kind}`);
  }
}

/** jump·dropIn 이 공유하는 체공 옵션. 세 필드 모두 생략 가능하고, 값 범위는 런타임이 clamp 한다. */
function validateHopFields(label: string, command: Record<string, unknown>): void {
  if (command.heightPx !== undefined) requireNumber(`${label}.heightPx`, command.heightPx);
  if (command.durationMs !== undefined) requireNumber(`${label}.durationMs`, command.durationMs);
  if (command.se !== undefined) requireString(`${label}.se`, command.se);
}

function requireDir(label: string, value: unknown): void {
  const dir = requireString(label, value);
  if (dir === "left" || dir === "right" || dir === "up" || dir === "down") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireTransferDirection(label: string, value: unknown): void {
  const direction = requireString(label, value);
  if (direction === "retain" || direction === "left" || direction === "right" || direction === "up" || direction === "down") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function validateVariableOperand(label: string, value: unknown): void {
  if (typeof value === "number") return;
  const operand = requireRecord(label, value);
  if (requireString(`${label}.kind`, operand.kind) !== "var") {
    throw new ProjectFormatError(`${label}: 알 수 없는 변수 피연산자입니다.`);
  }
  requireString(`${label}.id`, operand.id);
}

function validateSwitchValue(label: string, value: unknown): void {
  if (typeof value === "boolean") return;
  if (value === "toggle") return;
  const operand = requireRecord(label, value);
  if (requireString(`${label}.kind`, operand.kind) !== "var") {
    throw new ProjectFormatError(`${label}: 알 수 없는 스위치 값입니다.`);
  }
  requireString(`${label}.id`, operand.id);
}

function requireHorizontalDir(label: string, value: unknown): void {
  const dir = requireString(label, value);
  if (dir === "left" || dir === "right") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireVerticalDir(label: string, value: unknown): void {
  const dir = requireString(label, value);
  if (dir === "up" || dir === "down") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireRelativeTurn(label: string, value: unknown): void {
  const turn = requireString(label, value);
  if (turn === "right90" || turn === "left90" || turn === "turn180" || turn === "leftOrRight90") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}
