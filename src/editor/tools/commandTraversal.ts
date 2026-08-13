import type { Command, Project } from "@/project/types";

export type CommandOwnerKind = "legacyEvent" | "eventPage" | "commonEvent" | "troopPage";
export type NestedBranchKind =
  | "choiceOption" | "choiceCancel" | "forkThen" | "forkElse" | "loopBody"
  | "shopTransaction" | "shopFailure" | "innNotEnough"
  | "promotionSuccess" | "promotionFailure" | "evolutionSuccess" | "evolutionFailure"
  | "battleVictory" | "battleDefeat" | "battleEscape";

export interface ProjectCommandVisit {
  readonly command: Command;
  readonly owner: CommandOwnerKind;
  readonly branch?: NestedBranchKind;
}

export function visitProjectCommands(project: Project, visitor: (visit: ProjectCommandVisit) => void): void {
  const visitList = (commands: readonly Command[], owner: CommandOwnerKind, branch?: NestedBranchKind): void => {
    for (const command of commands) {
      visitor({ command, owner, branch });
      for (const child of commandBranches(command)) visitList(child.commands, owner, child.kind);
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      visitList(event.commands, "legacyEvent");
      for (const page of event.pages ?? []) visitList(page.commands, "eventPage");
    }
  }
  for (const commonEvent of project.commonEvents) visitList(commonEvent.commands, "commonEvent");
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) visitList(page.commands, "troopPage");
  }
}

export function commandBranches(command: Command): readonly { readonly kind: NestedBranchKind; readonly commands: readonly Command[] }[] {
  switch (command.kind) {
    case "choices":
      return [
        ...command.options.map((option) => ({ kind: "choiceOption" as const, commands: option.branch })),
        ...(command.cancelBranch ? [{ kind: "choiceCancel" as const, commands: command.cancelBranch }] : []),
      ];
    case "fork":
      return [
        { kind: "forkThen", commands: command.then },
        ...(command.else ? [{ kind: "forkElse" as const, commands: command.else }] : []),
      ];
    case "loop": return [{ kind: "loopBody", commands: command.body }];
    case "shop": {
      const withFailure = command as typeof command & { readonly failedTransactionBranch?: readonly Command[] };
      return [
        ...(command.transactionBranch ? [{ kind: "shopTransaction" as const, commands: command.transactionBranch }] : []),
        ...(withFailure.failedTransactionBranch ? [{ kind: "shopFailure" as const, commands: withFailure.failedTransactionBranch }] : []),
      ];
    }
    case "inn": return command.notEnoughBranch ? [{ kind: "innNotEnough", commands: command.notEnoughBranch }] : [];
    case "promoteActor": return [
      ...(command.successBranch ? [{ kind: "promotionSuccess" as const, commands: command.successBranch }] : []),
      ...(command.failureBranch ? [{ kind: "promotionFailure" as const, commands: command.failureBranch }] : []),
    ];
    case "evolveMonster": return [
      ...(command.successBranch ? [{ kind: "evolutionSuccess" as const, commands: command.successBranch }] : []),
      ...(command.failureBranch ? [{ kind: "evolutionFailure" as const, commands: command.failureBranch }] : []),
    ];
    case "battleProcessing": return [
      ...(command.victoryBranch ? [{ kind: "battleVictory" as const, commands: command.victoryBranch }] : []),
      ...(command.defeatBranch ? [{ kind: "battleDefeat" as const, commands: command.defeatBranch }] : []),
      ...(command.escapeBranch ? [{ kind: "battleEscape" as const, commands: command.escapeBranch }] : []),
    ];
    default: return [];
  }
}
