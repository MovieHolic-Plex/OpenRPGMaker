import { editorState } from "@/editor/editorState";
import { selectEditorMap } from "@/editor/mapSelection";
import { openDatabaseModal } from "@/editor/panels/databaseModal";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import {
  SEARCH_KIND_LABELS,
  searchProject,
  type EventReference,
  type ReferenceResult,
  type SearchKind,
  type SearchResult,
  type SearchScope,
  type SearchTarget,
} from "@/editor/panels/mapEventSearchModel";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";
import { uiLabel } from "@/editor/uiCopy";
import { store } from "@/project/store";
import { el } from "@/util/dom";

const RESULT_KIND_ORDER: readonly SearchKind[] = ["map", "mapEvent", "commonEvent", "switch", "variable"];
const EMPTY_QUERY_COPY = "맵 이름, 이벤트 이름, 공통 이벤트, 스위치와 변수를 찾아보세요.";
const EMPTY_RESULT_COPY = "일치하는 항목이 없습니다. 맵·이벤트 이름이나 스위치·변수 이름과 ID를 확인해 보세요.";

let closeActiveModal: (() => void) | null = null;

export function openMapEventSearchModal(): void {
  closeActiveModal?.();
  const opener = document.activeElement;
  let scope: SearchScope = "selectedMap";
  let results: readonly SearchResult[] = [];
  let activeIndex = 0;
  const expandedRecords = new Set<string>();

  const input = el("input", {
    class: "map-event-search-input",
    attrs: {
      type: "search",
      placeholder: "맵, 이벤트, 스위치, 변수 이름 또는 ID",
      autocomplete: "off",
      "aria-label": uiLabel("mapEventSearch"),
      "aria-controls": "map-event-search-results-list",
    },
    dataset: { testid: "map-event-search-input" },
  }) as HTMLInputElement;
  const resultSummary = el("span", {
    class: "map-event-search-summary",
    text: "찾을 내용을 입력하세요",
    attrs: { "aria-live": "polite" },
  });
  const resultsPane = el("div", {
    class: "map-event-search-results-pane empty",
    attrs: { id: "map-event-search-results-list" },
    dataset: { testid: "map-event-search-results" },
  });
  const scopeControl = el("div", {
    class: "map-event-search-scope",
    attrs: { role: "group", "aria-label": "찾기 범위" },
  });
  const closeButton = el("button", {
    class: "map-event-search-title-close",
    text: "×",
    attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
    dataset: { testid: "map-event-search-close" },
  });
  const backdrop = el("div", {
    class: "map-event-search-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "map-event-search-modal" },
  });
  const dialog = el("section", {
    class: "map-event-search-window",
    attrs: {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": uiLabel("mapEventSearch"),
    },
    children: [
      el("header", {
        class: "map-event-search-titlebar",
        children: [
          el("div", {
            class: "map-event-search-heading",
            children: [
              el("span", { class: "map-event-search-kicker", text: "PROJECT NAVIGATOR" }),
              el("h2", { text: uiLabel("mapEventSearch") }),
            ],
          }),
          closeButton,
        ],
      }),
      el("div", {
        class: "map-event-search-body",
        children: [
          el("div", {
            class: "map-event-search-query-row",
            children: [
              el("label", {
                class: "map-event-search-input-shell",
                children: [
                  el("span", { class: "map-event-search-input-mark", text: "⌕", attrs: { "aria-hidden": "true" } }),
                  input,
                  el("kbd", { class: "map-event-search-enter-hint", text: "Enter" }),
                ],
              }),
              scopeControl,
            ],
          }),
          el("div", { class: "map-event-search-results-meta", children: [resultSummary] }),
          resultsPane,
        ],
      }),
      el("footer", {
        class: "map-event-search-footer",
        children: [
          el("span", { text: "↑↓ 이동 · Enter 열기 · Esc 닫기" }),
          el("span", { text: "입력하는 즉시 결과가 바뀝니다" }),
        ],
      }),
    ],
  });
  backdrop.append(dialog);

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    closeActiveModal = null;
    unregisterModal(backdrop);
    backdrop.remove();
    if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
  };
  closeActiveModal = close;
  registerModal(backdrop, close);

  const applySearch = (): void => {
    const project = store.getCurrent();
    const currentMapId = editorState.get().currentMapId;
    const selectedMapId = currentMapId && project.maps[currentMapId] ? currentMapId : project.startMapId;
    results = searchProject({ project, selectedMapId, query: input.value, scope });
    activeIndex = 0;
    expandedRecords.clear();
    renderResults();
  };

  const renderScope = (): void => {
    scopeControl.replaceChildren(
      scopeButton("selectedMap", "선택한 맵"),
      scopeButton("all", "전체"),
    );
  };

  const scopeButton = (value: SearchScope, label: string): HTMLButtonElement => el("button", {
    class: `map-event-search-scope-button${scope === value ? " active" : ""}`,
    text: label,
    attrs: { type: "button", "aria-pressed": String(scope === value) },
    dataset: { testid: `map-event-search-scope-${value}` },
    on: {
      click: () => {
        scope = value;
        renderScope();
        applySearch();
        input.focus();
      },
    },
  });

  const renderResults = (): void => {
    const query = input.value.trim();
    const grouped = groupResults(results);
    const groupNodes: HTMLElement[] = [];
    let rowIndex = 0;

    for (const kind of RESULT_KIND_ORDER) {
      const entries = grouped.get(kind) ?? [];
      if (entries.length === 0) continue;
      const rows: HTMLElement[] = [];
      for (const result of entries) {
        if (isReferenceResult(result)) {
          const recordKey = `${result.kind}:${result.detail}`;
          const expanded = expandedRecords.has(recordKey);
          rows.push(resultButton(result, rowIndex++, () => {
            if (expanded) expandedRecords.delete(recordKey);
            else expandedRecords.add(recordKey);
            renderResults();
          }, { expanded }));
          if (expanded) {
            for (const reference of result.references) {
              rows.push(referenceButton(result, reference, rowIndex++, () => navigate(reference.target)));
            }
          }
          continue;
        }
        rows.push(resultButton(result, rowIndex++, () => navigate(result.target)));
      }
      groupNodes.push(el("section", {
        class: "map-event-search-result-group",
        dataset: { testid: `map-event-search-group-${kind}` },
        children: [
          el("header", {
            class: "map-event-search-group-heading",
            children: [
              el("h3", { text: SEARCH_KIND_LABELS[kind] }),
              el("span", { class: "map-event-search-group-count", text: String(entries.length), attrs: { "aria-label": `${entries.length}개` } }),
            ],
          }),
          el("div", { class: "map-event-search-group-list", children: rows }),
        ],
      }));
    }

    resultsPane.classList.toggle("empty", groupNodes.length === 0);
    if (groupNodes.length === 0) {
      resultSummary.textContent = query ? "결과 없음" : "찾을 내용을 입력하세요";
      resultsPane.replaceChildren(emptyState(query ? EMPTY_RESULT_COPY : EMPTY_QUERY_COPY));
      input.removeAttribute("aria-activedescendant");
      return;
    }
    resultsPane.replaceChildren(...groupNodes);
    const buttons = resultButtons();
    activeIndex = Math.min(activeIndex, Math.max(0, buttons.length - 1));
    updateActiveRow(buttons, false);
    resultSummary.textContent = `${results.length}개 항목`;

    function resultButton(
      result: SearchResult,
      index: number,
      activate: () => void,
      options: { readonly expanded?: boolean } = {},
    ): HTMLButtonElement {
      const expandable = result.kind === "switch" || result.kind === "variable";
      const button = el("button", {
        class: "map-event-search-result-row",
        attrs: {
          type: "button",
          id: `map-event-search-result-row-${index}`,
          ...(expandable ? { "aria-expanded": String(options.expanded), "aria-label": `${result.name}, 참조 이벤트 ${result.references.length}개` } : {}),
        },
        dataset: { testid: `map-event-search-result-${index}`, resultIndex: String(index) },
        children: [
          el("span", { class: `map-event-search-kind-chip kind-${result.kind}`, text: SEARCH_KIND_LABELS[result.kind] }),
          el("span", {
            class: "map-event-search-result-copy",
            children: [
              el("strong", { class: "map-event-search-result-name", text: result.name }),
              el("span", { class: "map-event-search-result-location", text: result.location }),
            ],
          }),
          el("span", { class: "map-event-search-result-detail", text: result.detail }),
          el("span", {
            class: "map-event-search-result-action",
            text: expandable ? (options.expanded ? "접기" : "참조 보기") : "열기",
            attrs: { "aria-hidden": "true" },
          }),
        ],
        on: { click: activate },
      });
      return button;
    }

    function referenceButton(
      parent: ReferenceResult,
      reference: EventReference,
      index: number,
      activate: () => void,
    ): HTMLButtonElement {
      const button = el("button", {
        class: "map-event-search-result-row is-reference",
        attrs: { type: "button", id: `map-event-search-result-row-${index}` },
        dataset: { testid: `map-event-search-result-${index}`, resultIndex: String(index) },
        children: [
          el("span", { class: `map-event-search-kind-chip kind-${parent.kind}`, text: "참조" }),
          el("span", {
            class: "map-event-search-result-copy",
            children: [
              el("strong", { class: "map-event-search-result-name", text: reference.name }),
              el("span", { class: "map-event-search-result-location", text: reference.location }),
            ],
          }),
          el("span", { class: "map-event-search-result-detail", text: reference.eventId }),
          el("span", { class: "map-event-search-result-action", text: "이벤트 열기", attrs: { "aria-hidden": "true" } }),
        ],
        on: { click: activate },
      });
      return button;
    }
  };

  const navigate = (target: SearchTarget): void => {
    if (target.kind === "map") {
      if (selectEditorMap(target.mapId)) close();
      return;
    }
    if (target.kind === "event") {
      if (!selectEditorMap(target.mapId)) return;
      close();
      openEventEditorModal(target.mapId, target.eventId);
      return;
    }
    close();
    openDatabaseModal("commonEvents");
    Array.from(document.querySelectorAll<HTMLElement>("[data-record-id]"))
      .find((row) => row.dataset.recordId === target.commonEventId)
      ?.click();
  };

  const resultButtons = (): HTMLButtonElement[] =>
    Array.from(resultsPane.querySelectorAll<HTMLButtonElement>(".map-event-search-result-row"));

  const updateActiveRow = (buttons: readonly HTMLButtonElement[], moveFocus: boolean): void => {
    buttons.forEach((button, index) => {
      const active = index === activeIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const active = buttons[activeIndex];
    if (!active) {
      input.removeAttribute("aria-activedescendant");
      return;
    }
    input.setAttribute("aria-activedescendant", active.id);
    if (moveFocus) {
      active.focus({ preventScroll: true });
      active.scrollIntoView({ block: "nearest" });
    }
  };

  const moveActive = (delta: 1 | -1, focusRow: boolean): void => {
    const buttons = resultButtons();
    if (buttons.length === 0) return;
    activeIndex = (activeIndex + delta + buttons.length) % buttons.length;
    updateActiveRow(buttons, focusRow);
  };

  const handleNavigationKey = (event: KeyboardEvent): void => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(event.key === "ArrowDown" ? 1 : -1, event.currentTarget !== input);
      return;
    }
    if (event.key === "Enter") {
      const active = resultButtons()[activeIndex];
      if (!active) return;
      event.preventDefault();
      active.click();
    }
  };

  const trapFocus = (event: KeyboardEvent): void => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), [href], select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
    )).filter((node) => !node.hasAttribute("hidden"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  input.addEventListener("input", applySearch);
  input.addEventListener("keydown", handleNavigationKey);
  resultsPane.addEventListener("keydown", handleNavigationKey);
  dialog.addEventListener("keydown", trapFocus);
  closeButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.body.append(backdrop);
  renderScope();
  renderResults();
  input.focus();
}

function isReferenceResult(result: SearchResult): result is ReferenceResult {
  return result.kind === "switch" || result.kind === "variable";
}

function groupResults(results: readonly SearchResult[]): Map<SearchKind, SearchResult[]> {
  const grouped = new Map<SearchKind, SearchResult[]>();
  for (const result of results) {
    const entries = grouped.get(result.kind) ?? [];
    entries.push(result);
    grouped.set(result.kind, entries);
  }
  return grouped;
}

function emptyState(copy: string): HTMLElement {
  return el("div", {
    class: "map-event-search-empty-state",
    children: [
      el("span", { class: "map-event-search-empty-mark", text: "⌕", attrs: { "aria-hidden": "true" } }),
      el("strong", { text: "프로젝트에서 바로 찾아 이동하세요" }),
      el("p", { text: copy }),
    ],
  });
}
