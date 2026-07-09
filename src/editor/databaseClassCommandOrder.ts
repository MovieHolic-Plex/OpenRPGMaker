import type { ClassBattleCommand, ClassRecord } from "@/project/types";

const CHANGE_COMMAND_ID = "cmd_change";

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
