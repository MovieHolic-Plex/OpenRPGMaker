import type { ClassBattleCommand, ClassRecord } from "@/project/types";

const CHANGE_COMMAND_ID = "cmd_change";

export type ClassCommandPlacementResult =
  | { readonly ok: true; readonly commands: ClassBattleCommand[] }
  | { readonly ok: false; readonly reason: "missing-command" | "locked-command" | "duplicate-command" | "capacity" | "invalid-index" | "unchanged" };

/**
 * Pure catalog placement. Index is an insertion slot in 0..editable count.
 * Rejections carry no replacement list: callers must not snapshot or update.
 * Success copies rows and seals the existing fixed cmd_change footer contract.
 */
export function insertCatalogClassCommand(
  commands: readonly ClassBattleCommand[],
  catalogCommand: ClassBattleCommand | undefined,
  index: number,
): ClassCommandPlacementResult {
  if (!catalogCommand) return { ok: false, reason: "missing-command" };
  if (catalogCommand.id === CHANGE_COMMAND_ID) return { ok: false, reason: "locked-command" };
  if (commands.some((command) => command.id === catalogCommand.id)) return { ok: false, reason: "duplicate-command" };
  const editable = commands.filter((command) => command.id !== CHANGE_COMMAND_ID);
  if (editable.length >= 6) return { ok: false, reason: "capacity" };
  if (!Number.isInteger(index) || index < 0 || index > editable.length) return { ok: false, reason: "invalid-index" };
  editable.splice(index, 0, catalogCommand);
  return { ok: true, commands: finalizeCommands(editable) };
}

/** Move by stable row ID to a final editable index (0..count-1), not a drop gap. */
export function reorderEditableClassCommand(
  commands: readonly ClassBattleCommand[],
  commandId: string,
  index: number,
): ClassCommandPlacementResult {
  if (commandId === CHANGE_COMMAND_ID) return { ok: false, reason: "locked-command" };
  const editable = commands.filter((command) => command.id !== CHANGE_COMMAND_ID);
  const source = editable.findIndex((command) => command.id === commandId);
  const row = editable[source];
  if (!row) return { ok: false, reason: "missing-command" };
  if (editable.length > 6) return { ok: false, reason: "capacity" };
  if (!Number.isInteger(index) || index < 0 || index >= editable.length) return { ok: false, reason: "invalid-index" };
  if (source === index) return { ok: false, reason: "unchanged" };
  editable.splice(source, 1);
  editable.splice(index, 0, row);
  return { ok: true, commands: finalizeCommands(editable) };
}

/**
 * Move an editable battle command (not the fixed trailing 교체 row) by delta.
 * Returns the full command list including a trailing switch/change command.
 */
export function moveEditableClassCommand(
  commands: readonly ClassBattleCommand[],
  index: number,
  delta: -1 | 1,
): ClassBattleCommand[] {
  const editable = editableCommands(commands);
  const target = index + delta;
  if (index < 0 || index >= editable.length || target < 0 || target >= editable.length) {
    return finalizeCommands(editable);
  }
  const next = [...editable];
  const [row] = next.splice(index, 1);
  if (!row) return finalizeCommands(editable);
  next.splice(target, 0, row);
  return finalizeCommands(next);
}

/** Seal an editable command list with the fixed trailing 교체 command. */
export function finalizeClassBattleCommands(commands: readonly ClassBattleCommand[]): ClassBattleCommand[] {
  return finalizeCommands(editableCommands(commands));
}

export function editableClassCommands(commands: readonly ClassBattleCommand[]): ClassBattleCommand[] {
  return editableCommands(commands);
}

function editableCommands(commands: readonly ClassBattleCommand[]): ClassBattleCommand[] {
  return commands.filter((command) => command.id !== CHANGE_COMMAND_ID).slice(0, 6).map(cloneCommand);
}

function finalizeCommands(editable: readonly ClassBattleCommand[]): ClassBattleCommand[] {
  return [
    ...editable.map(cloneCommand),
    { id: CHANGE_COMMAND_ID, name: "교체", kind: "switch" },
  ];
}

function cloneCommand(command: ClassBattleCommand): ClassBattleCommand {
  return { ...command };
}

export type ClassCommandOrderSource = Pick<ClassRecord, "battleCommands">;
