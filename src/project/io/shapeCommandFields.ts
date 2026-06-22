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
      return;
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
  requireArray(`${label}.moves`, route.moves);
  requireBoolean(`${label}.repeat`, route.repeat);
}
