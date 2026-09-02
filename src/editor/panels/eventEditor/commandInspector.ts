// 인라인 명령 인스펙터.
//
// Target contract: .omo/evidence/event-editor-hierarchy-20260826/after.html.
// Preview-first inspector without gold "현재 명령 편집" button.

import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { renderEditorIcon } from "./editorIcons";
import { commandKindLabel } from "./options";
import { inspectorTitle } from "./inspectorChoicesTitle";
import { renderCommandBody } from "./commandBody";
import { renderCommandPreview } from "./commandPreview";
import type { CommandListActions } from "./types";

type InspectorTarget = {
  readonly command: Command;
  readonly path: number[];
  readonly actions: CommandListActions;
  readonly previewFace?: { readonly resourceId: string };
};

/**
 * 폼 본문이 이미 자기 프리뷰(LIVE 카드/표시면)를 그리는 명령이 있다. 436px 인스펙터 컬럼에서
 * 인스펙터 프리뷰까지 붙이면 같은 연출이 두 번 나온다 — 본문을 렌더한 뒤 편집 모달에도 있는
 * 프리뷰 표식을 물어보고(commandBody.ts 는 그대로 둔다), 있으면 인스펙터 프리뷰를 접는다.
 */
const BODY_OWNED_PREVIEW_SELECTOR = [
  '[data-testid="event-command-text-live-preview"]', // 문장 표시: 게임 화면 미리보기 / LIVE
  ".page3-preview-stage", // 그림/날씨/암전/애니메이션/동영상 표시면
].join(",");

let host: HTMLElement | undefined;
let selectedPath: number[] | undefined;
let selectionListener: (() => void) | undefined;

/** content.ts 가 인스펙터 컬럼을 만들 때 호출한다. */
export function setCommandInspectorHost(next: HTMLElement | undefined): void {
  host = next;
}

/**
 * 선택이 바뀔 때 알림을 받는다. 툴바의 이동/복사 `disabled` 상태는 렌더 시점에 한 번
 * 구워지므로, 선택이 바뀌었는데 아무도 알려 주지 않으면 버튼이 계속 비활성으로 남아
 * 클릭 자체가 삼켜진다(측정된 결함 D3 의 두 번째 얼굴).
 */
export function setCommandSelectionListener(listener: (() => void) | undefined): void {
  selectionListener = listener;
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
  selectionListener?.();
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

  const kindText = inspectorKindText(target.command);
  // commandSummary 는 "문장 표시: …" 처럼 이름을 앞에 다시 붙인다. 머리에 이름이 이미 있으니
  // 요약에서는 떼고 대상만 남긴다 — 좁은 컬럼에서 같은 이름이 두 번 찍히지 않는다.
  const summary = stripKindPrefix(inspectorTitle(target.command), kindText);
  const closeButton = el("button", {
    class: "event-inspector-close",
    children: [renderEditorIcon("close")],
    attrs: { type: "button", title: "선택 명령 닫기", "aria-label": "선택 명령 닫기" },
    dataset: { testid: "event-inspector-close" },
    on: {
      pointerdown: (event) => event.preventDefault(),
      click: () => clearCommandInspector(),
    },
  });

  const renderBody = (): HTMLElement =>
    renderCommandBody(
      {
        path: target.path,
        actions: target.actions,
        lockKind: true,
        previewFace: target.previewFace,
      },
      target.command
    );

  const formBody = el("div", {
    class: "fields event-inspector-body",
    dataset: { testid: "event-inspector-body" },
    children: [renderBody()],
  });
  const bodyOwnsPreview = formBody.querySelector(BODY_OWNED_PREVIEW_SELECTOR) !== null;

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
  if (!bodyOwnsPreview) drawPreview();

  const previewActions = el("div", {
    class: "event-inspector-preview-actions",
    children: [
      el("button", {
        class: "btn event-inspector-preview-restart",
        children: [renderEditorIcon("refresh"), el("span", { text: "미리보기 새로고침" })],
        attrs: { type: "button", title: "현재 명령 데이터로 미리보기를 다시 그립니다." },
        dataset: { testid: "event-inspector-preview-restart" },
        // 폼까지 다시 그리면 입력 중이던 값·포커스가 날아간다 — 프리뷰만 교체한다.
        // 본문이 프리뷰를 소유한 명령은 화면에 있는 그 프리뷰(=본문)를 다시 그려야 버튼이 정직하다.
        on: { click: () => (bodyOwnsPreview ? formBody.replaceChildren(renderBody()) : drawPreview()) },
      }),
    ],
  });

  const head = el("div", {
    class: "ins-head event-inspector-head",
    children: [
      // 이름은 한 번만. 예전에는 kind 칩 + h2 + 요약이 같은 명령 이름을 세 번 찍었다.
      el("h2", { class: "event-inspector-kind", text: kindText }),
      el("span", {
        class: "event-inspector-title",
        text: summary,
        dataset: { testid: "event-inspector-title" },
      }),
      closeButton,
    ],
  });

  host.replaceChildren(head, ...(bodyOwnsPreview ? [] : [previewHost]), previewActions, formBody);
  selectionListener?.();
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

/** 요약이 명령 이름으로 시작하면 그 접두어를 뗀다. 뗀 뒤 남는 게 없으면 원문을 그대로 쓴다. */
function stripKindPrefix(summary: string, kindText: string): string {
  const prefix = `${kindText}:`;
  if (!summary.startsWith(prefix)) return summary;
  const rest = summary.slice(prefix.length).trim();
  return rest.length > 0 ? rest : summary;
}

function inspectorKindText(command: Command): string {
  if (command.kind === "m2Command") {
    const label = m2CommandById(command.commandId)?.label.trim();
    if (label) return label;
  }
  return commandKindLabel(command.kind);
}
