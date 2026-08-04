// 인라인 명령 인스펙터.
//
// 목업의 핵심: 명령을 고르면 편집 폼이 "그 자리에서" 우측에 열린다.
// 지금까지는 더블클릭 → commandEditDialog 모달 → 그 안에서 다시 recordPicker 모달로
// 최대 3겹이 쌓였다. 인스펙터는 그 첫 겹을 없앤다(전용 피커 모달은 그대로 남는다).
//
// 선택 상태는 DOM 클래스(.cmd-item.selected)로만 유지되는데, 폼에서 값을 바꾸면
// replaceCommand → 전체 재렌더가 일어나 선택이 날아간다. 그래서 선택된 경로를
// 이 모듈이 들고 있다가 재렌더 후 복원한다.

import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { commandSummary } from "./commandSummary";
import { renderCommandBody } from "./commandBody";
import type { CommandListActions } from "./types";

type InspectorTarget = {
  readonly command: Command;
  readonly path: number[];
  readonly actions: CommandListActions;
};

let host: HTMLElement | undefined;
let selectedPath: number[] | undefined;

/** content.ts 가 인스펙터 컬럼을 만들 때 호출한다. */
export function setCommandInspectorHost(next: HTMLElement | undefined): void {
  host = next;
}

/** 현재 선택된 명령 경로. 재렌더 후 선택 복원에 쓴다. */
export function selectedCommandPath(): readonly number[] | undefined {
  return selectedPath;
}

export function sameInspectorPath(a: readonly number[], b: readonly number[] | undefined): boolean {
  return !!b && a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 선택 자체를 버린다(다른 이벤트/페이지로 이동 등). */
export function clearCommandInspector(): void {
  selectedPath = undefined;
  if (host) renderEmpty(host);
}

/**
 * 재렌더 직전에 화면만 비운다. 선택 경로는 유지하므로, 곧 이어지는 리스트 렌더가
 * 같은 경로의 명령을 만나면 인스펙터를 복원한다.
 */
export function resetCommandInspectorView(): void {
  if (host) renderEmpty(host);
}

/** 명령을 선택하면 우측 인스펙터가 그 자리에서 바뀐다. 모달은 열리지 않는다. */
export function showCommandInspector(target: InspectorTarget): void {
  selectedPath = [...target.path];
  if (!host) return;
  host.replaceChildren(
    el("div", {
      class: "event-inspector-head",
      children: [
        el("div", { class: "event-inspector-kind", text: target.command.kind }),
        el("div", {
          class: "event-inspector-title",
          text: safeSummary(target.command),
          dataset: { testid: "event-inspector-title" },
        }),
      ],
    }),
    el("div", {
      class: "event-inspector-body",
      dataset: { testid: "event-inspector-body" },
      children: [
        renderCommandBody(
          {
            path: target.path,
            actions: target.actions,
            // 기존 명령 편집이므로 종류는 잠근다 — 종류 변경은 분기 자식을 잃는다.
            lockKind: true,
          },
          target.command
        ),
      ],
    })
  );
}

function renderEmpty(target: HTMLElement): void {
  target.replaceChildren(
    el("div", {
      class: "event-inspector-empty empty-hint",
      text: "명령을 클릭하면 여기서 바로 편집됩니다.",
      dataset: { testid: "event-inspector-empty" },
    })
  );
}

function safeSummary(command: Command): string {
  try {
    return commandSummary(command);
  } catch {
    return command.kind;
  }
}
