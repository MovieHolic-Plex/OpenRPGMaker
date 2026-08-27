// 인라인 명령 인스펙터.
//
// Target contract: .omo/evidence/event-editor-hierarchy-20260826/after.html.
// Preview-first inspector without gold "현재 명령 편집" button.

import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { commandKindLabel } from "./options";
import { inspectorTitle } from "./inspectorChoicesTitle";
import { renderCommandBody } from "./commandBody";
import { renderCommandPreview } from "./commandPreview";
import type { CommandListActions } from "./types";

type InspectorTarget = {
  readonly command: Command;
  readonly path: number[];
  readonly actions: CommandListActions;
  readonly previewFace?: { readonly resourceId: string; readonly faceIndex: number };
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
  if (host) {
    const fallback = host.ownerDocument?.querySelector<HTMLElement>("[data-cmd-path].is-selected");
    hideInspector(host);
    const restoreFocus = (): void => fallback?.focus();
    const requestFrame = host.ownerDocument?.defaultView?.requestAnimationFrame;
    if (requestFrame) requestFrame(restoreFocus);
    else restoreFocus();
  }
}

/**
 * 재렌더 직전에 화면만 비운다. 선택 경로는 유지하므로, 곧 이어지는 리스트 렌더가
 * 같은 경로의 명령을 만나면 인스펙터를 복원한다.
 */
export function resetCommandInspectorView(): void {
  if (host) hideInspector(host);
}

export function showCommandInspector(target: InspectorTarget): void {
  selectedPath = [...target.path];
  if (!host) return;
  host.dataset.commandPath = JSON.stringify(target.path);
  showInspector(host);

  const summary = inspectorTitle(target.command);
  const closeButton = el("button", {
    class: "event-inspector-close",
    text: "×",
    attrs: { type: "button", title: "선택 명령 닫기", "aria-label": "선택 명령 닫기" },
    dataset: { testid: "event-inspector-close" },
    on: {
      pointerdown: (event) => event.preventDefault(),
      click: () => clearCommandInspector(),
    },
  });

  const formBody = el("div", {
    class: "fields event-inspector-body",
    dataset: { testid: "event-inspector-body" },
    children: [
      renderCommandBody(
        {
          path: target.path,
          actions: target.actions,
          lockKind: true,
          previewFace: target.previewFace,
        },
        target.command
      ),
    ],
  });

  // 프리뷰가 없으면 `↻ 미리보기 새로고침` 은 빈 약속이다(적대적 QA 3라운드 D5).
  // 편집 모달과 같은 renderCommandPreview 를 인스펙터에도 붙여, 같은 스테이지·재생 컨트롤을 준다.
  const previewHost = el("div", {
    class: "event-inspector-preview",
    dataset: { testid: "event-inspector-preview" },
  });
  const drawPreview = (): void => {
    previewHost.replaceChildren(
      renderCommandPreview(target.command, target.previewFace ? { face: target.previewFace } : undefined)
    );
  };
  drawPreview();

  const previewActions = el("div", {
    class: "event-inspector-preview-actions",
    children: [
      el("button", {
        class: "btn event-inspector-preview-restart",
        text: "↻ 미리보기 새로고침",
        attrs: { type: "button", title: "현재 명령 데이터로 미리보기를 다시 그립니다." },
        dataset: { testid: "event-inspector-preview-restart" },
        // 폼까지 다시 그리면 입력 중이던 값·포커스가 날아간다 — 프리뷰만 교체한다.
        on: { click: () => drawPreview() },
      }),
    ],
  });

  const kindText = inspectorKindText(target.command);
  const head = el("div", {
    class: "ins-head event-inspector-head",
    children: [
      el("div", { class: "event-inspector-kind", text: kindText }),
      el("h2", { text: kindText }),
      el("span", {
        class: "event-inspector-title",
        text: summary,
        dataset: { testid: "event-inspector-title" },
      }),
      closeButton,
    ],
  });

  host.replaceChildren(head, previewHost, previewActions, formBody);
}

function hideInspector(target: HTMLElement): void {
  delete target.dataset.commandPath;
  target.replaceChildren();
  target.hidden = true;
  target.closest(".event-editor-workbench")?.classList.remove("has-command-inspector");
}

function showInspector(target: HTMLElement): void {
  target.hidden = false;
  target.closest(".event-editor-workbench")?.classList.add("has-command-inspector");
}

function inspectorKindText(command: Command): string {
  if (command.kind === "m2Command") {
    const label = m2CommandById(command.commandId)?.label.trim();
    if (label) return label;
  }
  return commandKindLabel(command.kind);
}
