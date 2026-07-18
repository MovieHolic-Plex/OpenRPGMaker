import { editorState } from "@/editor/editorState";
import { KIND_LABELS, createInitialSearchState, searchProject, type ResultEntry, type SearchKind, type SearchRange } from "@/editor/panels/mapEventSearchModel";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

type SearchContext = {
  readonly resultsPane: HTMLElement;
  readonly project: Project;
  readonly selectedMapId: string;
};

const state = createInitialSearchState();

export function openMapEventSearchModal(): void {
  document.querySelector("[data-testid='map-event-search-modal']")?.remove();
  resetSearchState();

  const project = store.getCurrent();
  const selectedMapId = editorState.get().currentMapId ?? project.startMapId;
  const resultsPane = el("div", {
    class: "map-event-search-results-pane empty",
    dataset: { testid: "map-event-search-results" },
    text: "검색어를 입력하거나 조건을 선택한 뒤 검색하세요.",
  });
  const context = { resultsPane, project, selectedMapId } satisfies SearchContext;
  const keywordControls = renderKeywordControls(context);
  const rangeControls = renderRangeControls(context);
  const tabs = renderResultTabs(context);
  const closeButton = el("button", {
    class: "map-event-search-close",
    text: "닫기",
    attrs: { type: "button" },
    dataset: { testid: "map-event-search-close" },
  });

  const backdrop = el("div", {
    class: "map-event-search-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "map-event-search-modal" },
    children: [
      el("section", {
        class: "map-event-search-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "맵/이벤트 검색" },
        children: [
          el("header", {
            class: "map-event-search-titlebar",
            children: [
              el("h2", { text: "검색" }),
              el("button", {
                class: "map-event-search-title-close",
                text: "×",
                attrs: { type: "button", title: "닫기", "aria-label": "닫기" },
                on: { click: () => close(backdrop, onKeyDown) },
              }),
            ],
          }),
          el("div", {
            class: "map-event-search-body",
            children: [
              el("div", {
                class: "map-event-search-left",
                children: [
                  keywordControls,
                  rangeControls,
                  el("button", {
                    class: "map-event-search-button",
                    text: "검색",
                    attrs: { type: "button" },
                    dataset: { testid: "map-event-search-submit" },
                    on: { click: () => applySearch(context) },
                  }),
                ],
              }),
              el("fieldset", {
                class: "map-event-search-results",
                children: [el("legend", { text: "검색 결과" }), tabs, resultsPane],
              }),
            ],
          }),
          el("footer", { class: "map-event-search-footer", children: [closeButton] }),
        ],
      }),
    ],
  });

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close(backdrop, onKeyDown);
  };

  closeButton.addEventListener("click", () => close(backdrop, onKeyDown));
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close(backdrop, onKeyDown);
  });
  document.addEventListener("keydown", onKeyDown);
  document.body.append(backdrop);
  keywordControls.querySelector<HTMLInputElement>("[data-search-kind='variable']")?.focus();
}

function close(backdrop: HTMLElement, onKeyDown: (event: KeyboardEvent) => void): void {
  backdrop.remove();
  document.removeEventListener("keydown", onKeyDown);
}

function renderKeywordControls(context: SearchContext): HTMLElement {
  const variableInput = searchInput("0001", "map-event-search-variable-input", "variable");
  const switchInput = searchInput("", "map-event-search-switch-input", "switch");
  const eventNameInput = searchInput("", "map-event-search-event-name-input", "eventName");
  return el("fieldset", {
    class: "map-event-search-group keyword",
    dataset: { testid: "map-event-search-keyword" },
    children: [
      el("legend", { text: "검색 키워드" }),
      searchRow({ kind: "variable", label: "변수", checked: true }, variableInput, context),
      searchRow({ kind: "switch", label: "스위치", checked: false }, switchInput, context),
      searchRow({ kind: "eventName", label: "이벤트 이름", checked: false }, eventNameInput, context),
    ],
  });
}

function renderRangeControls(context: SearchContext): HTMLElement {
  return el("fieldset", {
    class: "map-event-search-group range",
    dataset: { testid: "map-event-search-range" },
    children: [
      el("legend", { text: "검색 범위" }),
      rangeRow({ value: "selectedMap", label: "선택한 맵", checked: true }, context),
      rangeRow({ value: "commonEvents", label: "공통 이벤트", checked: false }, context),
      rangeRow({ value: "all", label: "전체 맵 + 공통 이벤트", checked: false }, context),
    ],
  });
}

function searchRow(
  spec: { readonly kind: SearchKind; readonly label: string; readonly checked: boolean },
  input: HTMLInputElement,
  context: SearchContext
): HTMLElement {
  const radio = radioInput({ name: "map-event-search-kind", value: spec.kind, checked: spec.checked });
  radio.addEventListener("change", () => {
    state.activeKind = spec.kind;
    syncKindTabs(spec.kind);
    applySearch(context);
  });
  return el("label", {
    class: "map-event-search-row",
    children: [
      radio,
      el("span", { class: "map-event-search-label", text: spec.label }),
      input,
      spec.kind === "eventName" ? el("span", { class: "map-event-search-spacer" }) : pickerButton(spec.kind, input, context),
    ],
  });
}

function rangeRow(spec: { readonly value: SearchRange; readonly label: string; readonly checked: boolean }, context: SearchContext): HTMLElement {
  const radio = radioInput({ name: "map-event-search-range-choice", value: spec.value, checked: spec.checked });
  radio.addEventListener("change", () => {
    state.activeRange = spec.value;
    applySearch(context);
  });
  return el("label", { class: "map-event-search-range-row", children: [radio, el("span", { text: spec.label })] });
}

function renderResultTabs(context: SearchContext): HTMLElement {
  const tabList = el("div", { class: "map-event-search-tabs", attrs: { role: "tablist" } });
  for (const kind of ["variable", "switch", "eventName"] as const) {
    const tab = el("button", {
      class: `map-event-search-tab${kind === state.activeKind ? " active" : ""}`,
      text: KIND_LABELS[kind],
      attrs: { type: "button", role: "tab", "aria-selected": String(kind === state.activeKind) },
      dataset: { testid: `map-event-search-tab-${kind}` },
      on: {
        click: () => {
          state.activeKind = kind;
          syncKindRadios(kind);
          syncKindTabs(kind);
          applySearch(context);
        },
      },
    });
    tabList.append(tab);
  }
  return tabList;
}

function searchInput(value: string, testId: string, kind: SearchKind): HTMLInputElement {
  return el("input", {
    class: "map-event-search-input",
    attrs: { type: "text" },
    value,
    dataset: { testid: testId, searchKind: kind },
  });
}

function pickerButton(kind: Exclude<SearchKind, "eventName">, input: HTMLInputElement, context: SearchContext): HTMLButtonElement {
  return el("button", {
    class: "map-event-search-picker",
    text: "...",
    attrs: { type: "button", title: "목록에서 선택" },
    dataset: { testid: `map-event-search-${kind}-picker` },
    on: {
      click: () => {
        input.value = kind === "variable" ? context.project.variables[0]?.id ?? "0001" : context.project.switches[0]?.id ?? "0001";
        state.activeKind = kind;
        syncKindRadios(kind);
        syncKindTabs(kind);
        applySearch(context);
      },
    },
  });
}

function resetSearchState(): void {
  const initial = createInitialSearchState();
  state.activeKind = initial.activeKind;
  state.activeRange = initial.activeRange;
}

function radioInput(spec: { readonly name: string; readonly value: string; readonly checked: boolean }): HTMLInputElement {
  const input = el("input", { attrs: { type: "radio", name: spec.name, value: spec.value } });
  input.checked = spec.checked;
  return input;
}

function syncKindRadios(kind: SearchKind): void {
  document.querySelectorAll<HTMLInputElement>("input[name='map-event-search-kind']").forEach((node) => {
    node.checked = node.value === kind;
  });
}

function syncKindTabs(kind: SearchKind): void {
  document.querySelectorAll<HTMLButtonElement>("[data-testid^='map-event-search-tab-']").forEach((node) => {
    const selected = node.dataset.testid === `map-event-search-tab-${kind}`;
    node.classList.toggle("active", selected);
    node.setAttribute("aria-selected", String(selected));
  });
}

function applySearch(context: SearchContext): void {
  const query = document.querySelector<HTMLInputElement>(`[data-search-kind='${state.activeKind}']`)?.value.trim() ?? "";
  const results = query
    ? searchProject({
        project: context.project,
        selectedMapId: context.selectedMapId,
        query,
        kind: state.activeKind,
        range: state.activeRange,
      })
    : [];
  const empty = results.length === 0;
  context.resultsPane.classList.toggle("empty", empty);
  if (empty) {
    context.resultsPane.replaceChildren();
    context.resultsPane.textContent = "검색어를 입력하거나 조건을 선택한 뒤 검색하세요.";
    return;
  }
  context.resultsPane.replaceChildren(...renderResults(results));
}

function renderResults(results: readonly ResultEntry[]): Node[] {
  if (results.length === 0) return [document.createTextNode("검색어를 입력하거나 조건을 선택한 뒤 검색하세요.")];
  return results.map((result) =>
    el("div", {
      class: "map-event-search-result-row",
      children: [
        el("span", { class: "map-event-search-result-place", text: result.place }),
        el("span", { class: "map-event-search-result-name", text: result.name }),
        el("span", { class: "map-event-search-result-detail", text: result.detail }),
      ],
    })
  );
}
