// 인라인 명령 인스펙터.
//
// Target contract: .omo/evidence/event-editor-hierarchy-20260826/after.html.
// Preview-first inspector without gold "현재 명령 편집" button.

import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import type { Command } from "@/project/types";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";
import { el } from "@/util/dom";
import { renderEditorIcon } from "./editorIcons";
import { commandKindLabel } from "./options";
import { inspectorTitle } from "./inspectorChoicesTitle";
import { renderCommandBody } from "./commandBody";
import { renderCommandPreview } from "./commandPreview";
import type { CommandListActions } from "./types";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import type { ActiveFace } from "./previewSimulation";

type InspectorTarget = {
  readonly command: Command;
  readonly path: number[];
  readonly actions: CommandListActions;
  readonly previewFace?: ActiveFace;
  readonly preserveSelection?: boolean;
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
let emptyPreview: (() => HTMLElement) | undefined;
let selectedPath: number[] | undefined;
let selectedPaths: number[][] = [];
let selectedKeys = new Set<string>();
let paintedKeys = new Set<string>();
let selectionRows = new Map<string, HTMLElement[]>();
let selectionRowsDirty = true;
let selectionObserver: MutationObserver | undefined;
let selectionScope: string | HTMLElement | undefined;
let selectionSurface: HTMLElement | undefined;
let selectionListener: (() => void) | undefined;

export function beginCommandSelectionScope(scope: string | HTMLElement): void {
  if (selectionScope === scope) return;
  selectionListener = undefined;
  clearCommandInspector();
  selectionScope = scope;
}

export function setCommandSelectionSurface(surface: HTMLElement): void {
  if (selectionSurface === surface) return;
  selectionObserver?.disconnect();
  selectionSurface = surface;
  selectionRowsDirty = true;
  paintedKeys = new Set();
  selectionRows.clear();
  selectionObserver = typeof MutationObserver === "undefined" ? undefined : new MutationObserver(records => { selectionRowsDirty ||= mutationsChangeCommandRows(records); });
  selectionObserver?.observe(surface, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-cmd-path"] });
}

export function selectedCommandPaths(): readonly (readonly number[])[] {
  return selectedPaths;
}

export function isCommandSelected(path: readonly number[]): boolean {
  return selectedKeys.has(JSON.stringify(path));
}

export function authoredCommandPaths(commands: readonly Command[], container: readonly number[] = []): number[][] {
  return commands.flatMap((command, index) => {
    const path = [...container, index];
    return [path, ...eventCommandBranches(command).flatMap(branch =>
      authoredCommandPaths(branch.commands, [...path, branch.branchIndex]))];
  });
}

/** Parent selection subsumes descendants; input order follows the authored tree. */
export function selectedCommandRoots(paths: readonly (readonly number[])[]): number[][] {
  const keys = new Set(paths.map(path => JSON.stringify(path)));
  return paths.filter(path => {
    for (let length = 1; length < path.length; length += 2) {
      if (keys.has(JSON.stringify(path.slice(0, length)))) return false;
    }
    return true;
  }).map(path => [...path]);
}

export function selectAllAuthoredCommands(commands: readonly Command[]): void {
  selectedPaths = authoredCommandPaths(commands);
  selectedPath = selectedPaths.find(path => sameInspectorPath(path, selectedPath)) ?? selectedPaths[0];
  notifyCommandSelectionChanged();
}

function mutationsChangeCommandRows(records: readonly MutationRecord[]): boolean {
  return records.some(record => record.type === "attributes" || [...record.addedNodes, ...record.removedNodes].some(node => {
    const element = node as HTMLElement;
    return element.dataset?.cmdPath !== undefined || element.querySelector?.("[data-cmd-path]") != null;
  }));
}

/** Explicitly invalidate after synchronous mounting; MutationObserver is asynchronous. */
export function invalidateCommandSelectionRows(): void { selectionRowsDirty = true; }

export function notifyCommandSelectionChanged(): void {
  if (selectionObserver && mutationsChangeCommandRows(selectionObserver.takeRecords())) selectionRowsDirty = true;
  const rebuilt = selectionRowsDirty;
  if (selectionRowsDirty) {
    selectionRows.clear();
    selectionSurface?.querySelectorAll<HTMLElement>("[data-cmd-path]").forEach(row => {
      const key = row.dataset.cmdPath!;
      const rows = selectionRows.get(key) ?? [];
      rows.push(row);
      selectionRows.set(key, rows);
    });
    // New mounts may already contain selected classes supplied by their renderer.
    paintedKeys = new Set();
    for (const [key, rows] of selectionRows) {
      if (rows.some(row => row.classList.contains("selected") || row.classList.contains("sel") || row.classList.contains("is-selected"))) paintedKeys.add(key);
    }
    selectionRowsDirty = false;
  }
  selectedKeys = new Set(selectedPaths.map(path => JSON.stringify(path)));
  const changed = new Set<string>(rebuilt ? selectionRows.keys() : []);
  for (const key of paintedKeys) if (!selectedKeys.has(key)) changed.add(key);
  for (const key of selectedKeys) if (!paintedKeys.has(key)) changed.add(key);
  for (const key of changed) {
    const selected = selectedKeys.has(key);
    for (const row of selectionRows.get(key) ?? []) {
      row.classList.toggle("selected", selected);
      if (!row.classList.contains("cmd-item")) {
        row.classList.toggle("sel", selected);
        row.classList.toggle("is-selected", selected);
        if (selected) row.setAttribute("aria-current", "step");
        else row.removeAttribute("aria-current");
      }
    }
  }
  paintedKeys = selectedKeys;
  selectionListener?.();
}

/** Shared by List/Story: navigation and unhandled keys must not change selection. */
export function isCommandActionKey(event: KeyboardEvent): boolean {
  if ((event.ctrlKey || event.metaKey) && !event.altKey) return ["z", "y", "x", "c", "v", "a", "k", "/", "?"].includes(event.key.toLowerCase());
  return !event.ctrlKey && !event.metaKey && !event.altKey && ["Enter", " ", "Spacebar", "Delete", "Del", "Backspace"].includes(event.key);
}

/** content.ts 가 인스펙터 컬럼을 만들 때 호출한다. */
export function setCommandInspectorHost(next: HTMLElement | undefined, empty?: () => HTMLElement): void {
  host = next;
  emptyPreview = empty;
  if (!next) {
    selectionObserver?.disconnect();
    selectionObserver = undefined;
    selectionSurface = undefined;
    selectionRows.clear();
    selectionRowsDirty = true;
    paintedKeys = new Set();
  }
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

/** `path` 가 가리키는 행 **바로 아래, 같은 깊이** 의 자리. 분기를 가진 행이면 그 묶음 전체 뒤다. */
export function insertionPathAfter(path: readonly number[]): number[] {
  const index = path[path.length - 1] ?? 0;
  return [...path.slice(0, -1), index + 1];
}

/**
 * 「+ 명령」·피커·붙여넣기가 공유하는 삽입 자리 규칙 하나(2026-09-17 적대적 리뷰 P0-3).
 *
 * 선택한 행이 있으면 그 행 바로 아래 같은 깊이, 없으면 루트 끝. 예전엔 「+ 명령」이 선택을 무시하고
 * 최상위 끝에 넣었고 붙여넣기는 선택 행 **앞**에 넣어서, 분기 안 행을 고르고 명령을 추가하면
 * 분기 밖 3번으로 들어갔다 — 거절해도 회복약을 받는 논리 버그를 사용자가 알 수 없었다.
 *
 * 여러 행을 골랐으면 마지막(트리 순서) 뿌리 선택 아래에 넣는다.
 */
export function defaultInsertionPath(commands: readonly Command[]): number[] | undefined {
  const roots = selectedCommandRoots(selectedPaths);
  const anchor = roots.length > 0
    ? roots[roots.length - 1]
    : selectedPath;
  if (!anchor || anchor.length === 0) return undefined;
  if (!resolveCommandAtPath([...commands], anchor)) return undefined;
  return insertionPathAfter(anchor);
}

/** 삽입 자리를 사람 말로 — 피커 제목에 쓴다. */
export function describeInsertionPath(commands: readonly Command[], path: readonly number[] | undefined): string {
  if (!path) return "이 페이지의 마지막에";
  const anchorIndex = (path[path.length - 1] ?? 1) - 1;
  const anchorPath = [...path.slice(0, -1), anchorIndex];
  const anchor = resolveCommandAtPath([...commands], anchorPath);
  const depth = anchorPath.length > 1 ? " (분기 안)" : "";
  return anchor ? `선택한 ${commandKindLabel(anchor.kind)} 바로 아래에${depth}` : "선택한 행 바로 아래에";
}

export function sameInspectorPath(a: readonly number[], b: readonly number[] | undefined): boolean {
  return !!b && a.length === b.length && a.every((value, index) => value === b[index]);
}

/** 선택 자체를 버린다(다른 이벤트/페이지로 이동 등). */
export function clearCommandInspector(): void {
  selectedPath = undefined;
  selectedPaths = [];
  notifyCommandSelectionChanged();
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
  if (!target.preserveSelection) selectedPaths = [[...target.path]];
  notifyCommandSelectionChanged();
  if (!host) return;
  host.dataset.commandPath = JSON.stringify(target.path);
  showInspector(host);
  // The command workbench selects on click; editing is an explicit dialog action.
  if (emptyPreview) {
    host.replaceChildren(
      el("h3", { class: "event-preview-heading", text: "미리보기" }),
      el("div", {
        class: "event-inspector-preview",
        dataset: { testid: "event-inspector-preview" },
        children: [renderCommandPreview(target.command, target.previewFace ? { face: target.previewFace } : undefined)],
      }),
    );
    return;
  }

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
  target.hidden = !emptyPreview;
  if (emptyPreview) target.append(el("h3", { class: "event-preview-heading", text: "미리보기" }), emptyPreview());
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
