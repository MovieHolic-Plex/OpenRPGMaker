// 프로젝트의 모든 명령을 자리(맵·이벤트·페이지·경로)와 함께 훑는다.
//
// 명령은 저장본 그대로(모델이 쓴 잘못된 필드 포함)를 본다 — 그래서 Command 타입이 아니라 레코드로 다룬다.
// 분기 키 목록은 `authoredCommandIndex.nestedCommandLists` 와 같은 집합에 presentItem 분기를 더한 것이다.

import type { Condition, EventPage, GameEvent, GameMap, Project, Trigger } from "@/project/types";
import type { CommandWhere } from "./types";

export type RawCommand = Record<string, unknown> & { kind?: unknown };

/** 명령이 놓인 분기 한 단계 — 자동 플레이가 «어느 선택지를 골라야 하는지» 를 여기서 읽는다. */
export type PathSegment =
  | { readonly kind: "option"; readonly command: RawCommand; readonly index: number }
  | { readonly kind: "fork"; readonly command: RawCommand; readonly branch: "then" | "else" }
  | { readonly kind: "battle"; readonly command: RawCommand; readonly result: "victory" | "defeat" | "escape" }
  | { readonly kind: "branch"; readonly command: RawCommand; readonly key: string };

export interface PageRef {
  readonly map?: GameMap;
  readonly event?: GameEvent;
  /** 페이지 없는 옛 이벤트·공통 이벤트는 undefined. */
  readonly page?: EventPage;
  readonly pageIndex: number;
  readonly trigger?: Trigger;
  readonly conditions: readonly Condition[];
  readonly commands: readonly RawCommand[];
  readonly commonEventId?: string;
}

export interface CommandVisit {
  readonly command: RawCommand;
  readonly where: CommandWhere;
  readonly page: PageRef;
  /** 바깥에서 안으로. 최상위 명령이면 빈 배열. */
  readonly segments: readonly PathSegment[];
  /** 최상위 명령 목록에서의 번호 경로(분기마다 한 칸). */
  readonly indexPath: readonly number[];
}

function isRecord(value: unknown): value is RawCommand {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function commandList(value: unknown): RawCommand[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** 명령 하나가 품은 분기 목록. 키와 자동 플레이용 의미를 함께 돌려준다. */
export function childLists(command: RawCommand): { key: string; segment: PathSegment; list: RawCommand[] }[] {
  const out: { key: string; segment: PathSegment; list: RawCommand[] }[] = [];
  const push = (key: string, segment: PathSegment, value: unknown): void => {
    if (Array.isArray(value)) out.push({ key, segment, list: commandList(value) });
  };
  switch (command.kind) {
    case "choices":
    case "presentItem": {
      const options = Array.isArray(command.options) ? command.options : [];
      options.forEach((option, index) => {
        if (isRecord(option)) push(`options[${index}].branch`, { kind: "option", command, index }, option.branch);
      });
      push("cancelBranch", { kind: "branch", command, key: "cancelBranch" }, command.cancelBranch);
      push("otherwiseBranch", { kind: "branch", command, key: "otherwiseBranch" }, command.otherwiseBranch);
      return out;
    }
    case "fork":
      push("then", { kind: "fork", command, branch: "then" }, command.then);
      push("else", { kind: "fork", command, branch: "else" }, command.else);
      return out;
    case "loop":
      push("body", { kind: "branch", command, key: "body" }, command.body);
      return out;
    case "battleProcessing":
      push("victoryBranch", { kind: "battle", command, result: "victory" }, command.victoryBranch);
      push("defeatBranch", { kind: "battle", command, result: "defeat" }, command.defeatBranch);
      push("escapeBranch", { kind: "battle", command, result: "escape" }, command.escapeBranch);
      return out;
    default:
      for (const key of ["successBranch", "failureBranch", "transactionBranch", "failedTransactionBranch", "notEnoughBranch"]) {
        push(key, { kind: "branch", command, key }, command[key]);
      }
      return out;
  }
}

/** 게임에 들어 있는 모든 명령 목록(맵 이벤트 페이지 + 공통 이벤트). */
export function allPages(project: Project): PageRef[] {
  const pages: PageRef[] = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      if (event.pages && event.pages.length > 0) {
        event.pages.forEach((page, pageIndex) => pages.push({
          map, event, page, pageIndex, trigger: page.trigger, conditions: page.conditions ?? [], commands: commandList(page.commands),
        }));
      } else {
        pages.push({
          map, event, pageIndex: -1, trigger: event.trigger,
          conditions: event.condition ? [event.condition] : [], commands: commandList(event.commands),
        });
      }
    }
  }
  for (const common of project.commonEvents ?? []) {
    pages.push({ pageIndex: -1, conditions: [], commands: commandList(common.commands), commonEventId: common.id });
  }
  return pages;
}

export function pageWhere(page: PageRef, path?: string): CommandWhere {
  return {
    ...(page.map ? { mapId: page.map.id, mapName: page.map.name } : {}),
    ...(page.event ? { eventId: page.event.id, ...(page.event.name ? { eventName: page.event.name } : {}), x: page.event.x, y: page.event.y } : {}),
    ...(page.commonEventId ? { commonEventId: page.commonEventId } : {}),
    pageIndex: page.pageIndex,
    ...(path ? { path } : {}),
  };
}

export function visitPageCommands(page: PageRef, visit: (entry: CommandVisit) => void): void {
  const walk = (list: readonly RawCommand[], path: string, segments: PathSegment[], indexPath: number[]): void => {
    list.forEach((command, index) => {
      const here = `${path}[${index}]`;
      visit({ command, where: pageWhere(page, here), page, segments, indexPath: [...indexPath, index] });
      for (const child of childLists(command)) {
        walk(child.list, `${here}.${child.key}`, [...segments, child.segment], [...indexPath, index]);
      }
    });
  };
  walk(page.commands, "commands", [], []);
}

export function visitAllCommands(project: Project, visit: (entry: CommandVisit) => void): void {
  for (const page of allPages(project)) visitPageCommands(page, visit);
}

/** 조건 트리의 잎을 모두 훑는다(all/any/not 포함). */
export function conditionLeaves(condition: unknown, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (!isRecord(condition)) return out;
  if (condition.kind === "all" || condition.kind === "any") {
    for (const child of Array.isArray(condition.conditions) ? condition.conditions : []) conditionLeaves(child, out);
  } else if (condition.kind === "not") conditionLeaves(condition.condition, out);
  else out.push(condition);
  return out;
}
