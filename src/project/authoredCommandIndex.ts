import type { CommandKind } from "@/project/commandKindRegistry";
import type { CommandContext } from "@/project/commandGuaranteeRegistry";
import type { Command, GameEvent, Project } from "@/project/types";
import { presentItemBranchLists } from "@/project/eventCommands/presentItemBranches";

export type AuthoredCommandIndex = Readonly<Record<CommandContext, ReadonlySet<CommandKind>>>;

/**
 * Index only command trees that are committed into the canonical project model.
 * Editor drafts use their persisted original; new uncommitted events contribute nothing.
 */
export function indexAuthoredCommands(project: Project): AuthoredCommandIndex {
  const map = new Set<CommandKind>();
  const common = new Set<CommandKind>();
  const troop = new Set<CommandKind>();

  for (const gameMap of Object.values(project.maps)) {
    for (const event of gameMap.events) visitEvent(event, map);
  }
  for (const commonEvent of project.commonEvents) visitCommands(commonEvent.commands, common);
  for (const troopRecord of project.database.troops) {
    for (const page of troopRecord.battleEventPages) visitCommands(page.commands, troop);
  }

  return { map, common, troop };
}

function visitEvent(event: GameEvent, found: Set<CommandKind>): void {
  if (event.draft?.kind === "new") return;
  const committed = event.draft?.kind === "edit" && event.draft.original
    ? event.draft.original
    : event;
  visitCommands(committed.commands, found);
  for (const page of committed.pages ?? []) visitCommands(page.commands, found);
}

function visitCommands(commands: readonly Command[], found: Set<CommandKind>): void {
  for (const command of commands) {
    found.add(command.kind);
    for (const branch of nestedCommandLists(command)) visitCommands(branch, found);
  }
}

export function nestedCommandLists(command: Command): readonly (readonly Command[])[] {
  switch (command.kind) {
    case "choices":
      return [
        ...command.options.map((option) => option.branch),
        ...(command.cancelBranch ? [command.cancelBranch] : []),
      ];
    case "presentItem":
      return presentItemBranchLists(command);
    case "fork":
      return [command.then, ...(command.else ? [command.else] : [])];
    case "loop":
      return [command.body];
    case "battleProcessing":
      return [command.victoryBranch, command.defeatBranch, command.escapeBranch].filter(isCommandList);
    case "promoteActor":
    case "evolveMonster":
      return [command.successBranch, command.failureBranch].filter(isCommandList);
    case "shop":
      return [command.transactionBranch, command.failedTransactionBranch].filter(isCommandList);
    case "inn":
      return command.notEnoughBranch ? [command.notEnoughBranch] : [];
    default:
      return [];
  }
}

function isCommandList(value: Command[] | undefined): value is Command[] {
  return value !== undefined;
}
