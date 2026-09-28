import { eventCommandBranches, type EventBranchKind } from "@/editor/eventCommandBranches";
import type { Command, Project } from "@/project/types";
import { TROOP_AFTER_BATTLE_LABELS, troopAfterBattleLists } from "@/project/troopAfterBattle";

export type CommandOwnerKind = "legacyEvent" | "eventPage" | "commonEvent" | "troopPage";
export type NestedBranchKind = EventBranchKind;

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
    for (const list of troopAfterBattleLists(troop)) visitList(list.commands, {
      kind: "troopPage",
      troopId: troop.id,
      troopName: troop.name,
      pageId: `afterBattle.${list.outcome}`,
      pageName: `전투 뒤 · ${TROOP_AFTER_BATTLE_LABELS[list.outcome]}`,
    });
  }
}

/**
 * 분기 열거는 `@/editor/eventCommandBranches` 가 정본이다. 여기는 `kind`+`commands` 만
 * 쓰는 얇은 어댑터라 목록을 따로 들지 않는다 — 예전에 다섯 벌이 갈라져 상점 실패 분기가
 * 세 곳에서 사라졌다.
 */
export function commandBranches(command: Command): readonly { readonly kind: NestedBranchKind; readonly commands: readonly Command[] }[] {
  return eventCommandBranches(command).map((branch) => ({ kind: branch.kind, commands: branch.commands }));
}
