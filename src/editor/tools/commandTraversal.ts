import type { Command, Project } from "@/project/types";

export type CommandOwnerKind = "legacyEvent" | "eventPage" | "commonEvent" | "troopPage";
export type NestedBranchKind =
  | "choiceOption" | "choiceCancel" | "forkThen" | "forkElse" | "loopBody"
  | "shopTransaction" | "shopFailure" | "innNotEnough"
  | "promotionSuccess" | "promotionFailure" | "evolutionSuccess" | "evolutionFailure"
  | "battleVictory" | "battleDefeat" | "battleEscape";

export type ProjectCommandLocation =
  | {
      readonly kind: "legacyEvent";
      readonly mapId: string;
      readonly mapName: string;
      readonly eventId: string;
    }
  | {
      readonly kind: "eventPage";
      readonly mapId: string;
      readonly mapName: string;
      readonly eventId: string;
      readonly pageId: string;
      readonly pageName: string;
    }
  | {
      readonly kind: "commonEvent";
      readonly commonEventId: string;
      readonly commonEventName: string;
    }
  | {
      readonly kind: "troopPage";
      readonly troopId: string;
      readonly troopName: string;
      readonly pageId: string;
      readonly pageName: string;
    };

export interface ProjectCommandVisit {
  readonly command: Command;
  readonly owner: CommandOwnerKind;
  readonly location: ProjectCommandLocation;
  readonly branch?: NestedBranchKind;
}

export function visitProjectCommands(project: Project, visitor: (visit: ProjectCommandVisit) => void): void {
  const visitList = (
    commands: readonly Command[],
    location: ProjectCommandLocation,
    branch?: NestedBranchKind,
  ): void => {
    for (const command of commands) {
      visitor({ command, owner: location.kind, location, branch });
      for (const child of commandBranches(command)) visitList(child.commands, location, child.kind);
    }
  };
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      visitList(event.commands, {
        kind: "legacyEvent",
        mapId: map.id,
        mapName: map.name,
        eventId: event.id,
      });
      for (const page of event.pages ?? []) visitList(page.commands, {
        kind: "eventPage",
        mapId: map.id,
        mapName: map.name,
        eventId: event.id,
        pageId: page.id,
        pageName: page.name,
      });
    }
  }
  for (const commonEvent of project.commonEvents) visitList(commonEvent.commands, {
    kind: "commonEvent",
    commonEventId: commonEvent.id,
    commonEventName: commonEvent.name,
  });
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) visitList(page.commands, {
      kind: "troopPage",
      troopId: troop.id,
      troopName: troop.name,
      pageId: page.id,
      pageName: page.name,
    });
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
