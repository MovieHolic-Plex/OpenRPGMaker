import { ProjectFormatError } from "./errors";
import { commandKinds, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";
import { validateLightSource } from "./shapeLightingFields";

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
      requireNumber(`${label}.faceIndex`, command.faceIndex);
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
      if (Number.isInteger(digits) && digits >= 1 && digits <= 6) return;
      throw new ProjectFormatError(`${label}.digits가 잘못되었습니다.`);
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
    case "setVariable":
      requireString(`${label}.variableId`, command.variableId);
      requireString(`${label}.op`, command.op);
      validateVariableOperand(`${label}.value`, command.value);
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
    case "changeLevel":
    case "changeActorHp":
    case "changeActorMp":
      requireString(`${label}.actorId`, command.actorId);
      requireActorAmountOp(`${label}.op`, command.op);
      requireNumber(`${label}.amount`, command.amount);
      return;
    case "changeEquipment":
      requireString(`${label}.actorId`, command.actorId);
      requireEquipmentSlot(`${label}.slot`, command.slot);
      requireString(`${label}.equipmentId`, command.equipmentId);
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

function requireCutsceneControlMode(label: string, value: unknown): void {
  const mode = requireString(label, value);
  if (mode === "begin" || mode === "end") return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

function requireEquipmentSlot(label: string, value: unknown): void {
  const slot = requireString(label, value);
  if (
    slot === "weapon" ||
    slot === "shield" ||
    slot === "armor" ||
    slot === "helmet" ||
    slot === "accessory"
  ) return;
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
  }
  throw new ProjectFormatError(`${label}: 알 수 없는 condition kind: ${kind}`);
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
