import { nestedCommandLists } from "@/project/authoredCommandIndex";
import type { Command } from "@/project/types";
import { jsonEqual, structuralJson } from "@/util/structuralJson";

type TextCommand = Extract<Command, { kind: "text" }>;

function textFields({ body: _body, ...fields }: TextCommand): Omit<TextCommand, "body"> {
  return fields;
}

function textFieldsInOrder(before: readonly TextCommand[], after: readonly TextCommand[]): boolean {
  const [shorter, longer] = before.length <= after.length ? [before, after] : [after, before];
  const surviving = shorter.map(textFields);
  let index = 0;
  for (const line of longer) {
    if (index < surviving.length && jsonEqual(surviving[index], textFields(line))) index++;
  }
  return index === surviving.length;
}

/** Line identities are positional. Unchanged lines can separate an insertion from a deletion. */
function preservesTextFields(before: readonly TextCommand[], after: readonly TextCommand[]): boolean {
  const positions = new Map<string, number>();
  after.forEach((line, index) => {
    const key = structuralJson(line);
    positions.set(key, positions.has(key) ? -1 : index);
  });
  let fromBefore = 0;
  let fromAfter = 0;
  for (const [index, line] of before.entries()) {
    const match = positions.get(structuralJson(line));
    if (match === undefined || match < fromAfter) continue;
    if (!textFieldsInOrder(before.slice(fromBefore, index), after.slice(fromAfter, match))) return false;
    fromBefore = index + 1;
    fromAfter = match + 1;
  }
  return textFieldsInOrder(before.slice(fromBefore), after.slice(fromAfter));
}

/** All authored branch lists are direct fields of the command or an option. Keep their original slots. */
function commandWithoutDialogue(command: Command, branches: readonly (readonly Command[])[]): object {
  const shell = { ...command } as Record<string, unknown>;
  if (branches.length) {
    const lists = new Set<unknown>(branches);
    for (const key of Object.keys(shell)) if (lists.has(shell[key])) shell[key] = [];
    if (command.kind === "choices" || command.kind === "presentItem") {
      shell.options = command.options.map(option => ({ ...option, branch: [] }));
    }
  }
  if (command.kind === "choices") {
    shell.options = (shell.options as typeof command.options).map(option => ({ ...option, text: "" }));
  }
  return shell;
}

export function onlyDialogueChanged(before: readonly Command[], after: readonly Command[]): boolean {
  if (jsonEqual(before, after)) return true;
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < before.length || newIndex < after.length) {
    const oldLines: TextCommand[] = [];
    const newLines: TextCommand[] = [];
    while (before[oldIndex]?.kind === "text") oldLines.push(before[oldIndex++] as TextCommand);
    while (after[newIndex]?.kind === "text") newLines.push(after[newIndex++] as TextCommand);
    if (newLines.some(line => typeof line.body !== "string") || !preservesTextFields(oldLines, newLines)) return false;

    const oldCommand = before[oldIndex++];
    const newCommand = after[newIndex++];
    if (!oldCommand || !newCommand) return oldCommand === newCommand;
    if (oldCommand.kind !== newCommand.kind) return false;
    if (jsonEqual(oldCommand, newCommand)) continue;
    if (newCommand.kind === "choices" && newCommand.options.some(option => typeof option.text !== "string")) return false;
    const oldBranches = nestedCommandLists(oldCommand);
    const newBranches = nestedCommandLists(newCommand);
    if (oldBranches.length !== newBranches.length ||
      !jsonEqual(commandWithoutDialogue(oldCommand, oldBranches), commandWithoutDialogue(newCommand, newBranches))) return false;
    if (!oldBranches.every((branch, index) => onlyDialogueChanged(branch, newBranches[index]!))) return false;
  }
  return true;
}
