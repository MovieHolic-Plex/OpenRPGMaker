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
import { commandKindLabel } from "./options";
import { inspectorTitle } from "./inspectorChoicesTitle";
import { renderCommandBody } from "./commandBody";
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
    const modal = host.closest(".event-editor-modal");
    hideInspector(host);
    setTimeout(() => modal?.querySelector<HTMLElement>("[data-cmd-path].is-selected")?.focus(), 0);
  }
}

/**
 * 재렌더 직전에 화면만 비운다. 선택 경로는 유지하므로, 곧 이어지는 리스트 렌더가
 * 같은 경로의 명령을 만나면 인스펙터를 복원한다.
 */
export function resetCommandInspectorView(): void {
  if (host) hideInspector(host);
}

/** 명령을 선택하면 우측 인스펙터가 그 자리에서 바뀐다. 모달은 열리지 않는다. */
const INSPECTOR_DENSITY_KEY = "oprn:inspector-density";
export type InspectorDensity = "card" | "form";
// 기본은 form(바로 편집): 명령을 골랐다는 것은 편집 의도다. card→자세히 편집 2단 홉과
// 같은 원문을 헤더/카드에 중복 표시하던 구조를 제거했다(2026-08-18 적대 평가 H01/J01).
export function loadInspectorDensity(): InspectorDensity { try { const v = localStorage.getItem(INSPECTOR_DENSITY_KEY); if (v === "form" || v === "card") return v; } catch { /* ignore */ } return "form"; }
export function saveInspectorDensity(d: InspectorDensity): void { try { localStorage.setItem(INSPECTOR_DENSITY_KEY, d); } catch { /* ignore */ } }

export function showCommandInspector(target: InspectorTarget): void {
  selectedPath = [...target.path];
  if (!host) return;
  host.dataset.commandPath = JSON.stringify(target.path);
  showInspector(host);
  const density = loadInspectorDensity();
  const formBody = el("div", {
    class: "event-inspector-body",
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
  const isForm = density === "form";
  const summary = inspectorTitle(target.command);
  const toggleBtn = el("button", {
    class: "event-inspector-density-toggle",
    text: isForm ? "간단히" : "자세히 편집",
    attrs: { type: "button", "aria-pressed": isForm ? "true" : "false" },
    dataset: { testid: "event-inspector-density-toggle" },
    on: {
      click: () => {
        const next: InspectorDensity = loadInspectorDensity() === "form" ? "card" : "form";
        saveInspectorDensity(next);
        showCommandInspector(target);
      },
    },
  });
  const card = el("div", {
    class: "event-inspector-card",
    dataset: { testid: "event-inspector-card" },
    children: [
      el("div", { class: "event-inspector-card-hint", text: summary }),
      toggleBtn,
    ],
  });
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
  const previewActions = el("div", {
    class: "event-inspector-preview-actions",
    children: [
      el("button", {
        class: "btn event-inspector-preview-restart",
        text: "↻ 미리보기 새로고침",
        attrs: { type: "button", title: "현재 명령 데이터로 미리보기를 다시 그립니다." },
        dataset: { testid: "event-inspector-preview-restart" },
        on: { click: () => showCommandInspector(target) },
      }),
      el("button", {
        class: "btn primary event-inspector-preview-current",
        text: "▶ 현재 명령 편집",
        attrs: { type: "button" },
        dataset: { testid: "event-inspector-preview-current" },
        on: {
          click: () => {
            if (!isForm) {
              saveInspectorDensity("form");
              showCommandInspector(target);
              host?.querySelector<HTMLElement>("[data-testid='event-inspector-body'] textarea, [data-testid='event-inspector-body'] input:not([type='hidden']), [data-testid='event-inspector-body'] select, [data-testid='event-inspector-body'] button")?.focus();
              return;
            }
            formBody.querySelector<HTMLElement>("textarea, input:not([type='hidden']), select, button")?.focus();
          },
        },
      }),
    ],
  });
  // 헤더는 한글 명령 이름만 — 원문 요약은 (card 모드) 카드 본문 또는 (form 모드) 편집 폼이
  // 이미 보여주므로 반복하지 않는다.
  host.replaceChildren(
    el("div", {
      class: "event-inspector-head",
      children: [
        el("div", { class: "event-inspector-kind", text: commandKindLabel(target.command.kind) }),
        el("div", {
          class: "event-inspector-title",
          text: summary,
          dataset: { testid: "event-inspector-title" },
        }),
        ...(isForm ? [toggleBtn] : []),
        closeButton,
      ],
    }),
    previewActions,
    isForm ? formBody : card,
  );
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


