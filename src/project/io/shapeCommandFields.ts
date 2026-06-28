import { ProjectFormatError } from "./errors";
import { commandKinds, requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";

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
    case "moveEvent":
      validateMoveRoute(`${label}.route`, command.route);
      return;
    default:
      return;
  }
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
    behavior === "branch"
  ) return;
  throw new ProjectFormatError(`${label}가 잘못되었습니다.`);
}

export function validateConditionShape(label: string, value: unknown): void {
  const condition = requireRecord(label, value);
  const kind = requireString(`${label}.kind`, condition.kind);
  if (kind === "switch") {
    requireString(`${label}.switchId`, condition.switchId);
    requireBoolean(`${label}.value`, condition.value);
    return;
  }
  if (kind === "variable") {
    requireString(`${label}.variableId`, condition.variableId);
    requireString(`${label}.op`, condition.op);
    requireNumber(`${label}.value`, condition.value);
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
