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
let emptyRenderer: (() => HTMLElement) | undefined;

/** content.ts 가 빈(미선택) 상태 렌더러를 공급한다. undefined 면 기본 힌트로 복귀. */
export function setCommandInspectorEmptyRenderer(render: (() => HTMLElement) | undefined): void {
  emptyRenderer = render;
}


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
const INSPECTOR_DENSITY_KEY = "rpg-zzu:inspector-density";
export type InspectorDensity = "card" | "form";
export function loadInspectorDensity(): InspectorDensity { try { const v = localStorage.getItem(INSPECTOR_DENSITY_KEY); if (v === "form" || v === "card") return v; } catch { /* ignore */ } return "card"; }
export function saveInspectorDensity(d: InspectorDensity): void { try { localStorage.setItem(INSPECTOR_DENSITY_KEY, d); } catch { /* ignore */ } }

export function showCommandInspector(target: InspectorTarget): void {
  selectedPath = [...target.path];
  if (!host) return;
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
        },
        target.command
      ),
    ],
  });
  const isForm = density === "form";
  const summary = safeSummary(target.command);
  const toggleBtn = el("button", {
    class: "event-inspector-density-toggle",
    text: isForm ? "간단히 보기" : "자세히 편집",
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
      el("div", { class: "event-inspector-card-title", text: target.command.kind }),
      el("div", { class: "event-inspector-card-hint", text: summary }),
      toggleBtn,
    ],
  });
  const advanced = el("details", {
    class: "event-inspector-advanced",
    attrs: { open: isForm ? "true" : undefined as unknown as string },
    dataset: { testid: "event-inspector-advanced" },
    children: [
      el("summary", { class: "event-inspector-advanced-summary", text: "고급 편집" }),
      el("div", { class: "event-inspector-advanced-body", children: [formBody] }),
    ],
  });
  (advanced as HTMLDetailsElement).open = isForm;
  const syncDetails = () => {
    const wantForm = (advanced as HTMLDetailsElement).open;
    const cur = loadInspectorDensity();
    if ((wantForm && cur !== "form") || (!wantForm && cur !== "card")) {
      saveInspectorDensity(wantForm ? "form" : "card");
      toggleBtn.textContent = wantForm ? "간단히 보기" : "자세히 편집";
      toggleBtn.setAttribute("aria-pressed", wantForm ? "true" : "false");
    }
  };
  advanced.addEventListener("toggle", syncDetails);
  host.replaceChildren(
    el("div", {
      class: "event-inspector-head",
      children: [
        el("div", { class: "event-inspector-kind", text: target.command.kind }),
        el("div", { class: "event-inspector-title", text: summary, dataset: { testid: "event-inspector-title" } }),
      ],
    }),
    isForm ? formBody : card,
    isForm ? toggleBtn : advanced
  );
}

function renderEmpty(target: HTMLElement): void {
  if (emptyRenderer) {
    try {
      const node = emptyRenderer();
      if (node) {
        target.replaceChildren(node);
        return;
      }
    } catch {
      // 렌더러 실패가 에디터를 깨면 안 된다 — 기본 힌트로 폴백.
    }
  }
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
