import { newCommand, newM2Command } from "@/editor/eventActions";
import {
  isM2CatalogEntrySelectableInMap,
  M2_COMMAND_CATALOG,
  type CommandRuntimeSupport,
  type M2CommandCatalogEntry,
  type M2CommandPickerGroup,
  type M2CommandPickerPage,
} from "@/editor/eventCommands/m2Catalog";
import { M2_COMMAND_PICKER_GROUP_ORDER } from "@/editor/eventCommands/m2PickerLayout";
import type { Command } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { commandKindLabel } from "./options";
import { groupVisual, pickerPageGlyph } from "./commandCategoryIcons";
import { renderRuntimeSupportBadge } from "./commandRuntimeBadge";
import { openEventSubdialog } from "./subdialog";

type CommandKind = Command["kind"];

const PICKER_PAGE_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: "빠른 저작",
  2: "배우·전투",
  3: "맵·연출",
  4: "시스템·모던",
};

function pickerPageTitle(page: 1 | 2 | 3 | 4): string {
  return PICKER_PAGE_TITLES[page];
}


type CommandEntry = {
  readonly label: string;
  readonly kind?: CommandKind;
  readonly commandId: string;
  readonly group: M2CommandPickerGroup;
  readonly index: number;
  readonly testId: string;
  readonly selectable: boolean;
  readonly runtimeSupport: CommandRuntimeSupport;
  readonly page: M2CommandPickerPage;
};

type CommandPage = {
  readonly page: M2CommandPickerPage;
  readonly entries: readonly CommandEntry[];
};

// 리스트(RM2003 기본) ↔ 아이콘 그리드 표시 모드. 세션 간 유지하되 기본은 리스트.
type PickerViewMode = "list" | "grid";
const PICKER_VIEW_MODE_KEY = "rpgzzu.eventCommandPicker.viewMode";

const PICKER_PAGES: readonly M2CommandPickerPage[] = [1, 2, 3, 4];
const EXTRA_COMMAND_ENTRIES: readonly CommandEntry[] = [
  {
    label: "조명 설정",
    kind: "setLighting",
    commandId: "setLighting",
    group: "화면/연출",
    index: 110,
    testId: "command-picker-add-setLighting",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 3,
  },
  {
    label: "광원 추가",
    kind: "addLight",
    commandId: "addLight",
    group: "화면/연출",
    index: 111,
    testId: "command-picker-add-addLight",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 3,
  },
  {
    label: "광원 제거",
    kind: "removeLight",
    commandId: "removeLight",
    group: "화면/연출",
    index: 112,
    testId: "command-picker-add-removeLight",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 3,
  },
  {
    label: "날씨 설정",
    kind: "setWeather",
    commandId: "setWeather",
    group: "화면/연출",
    index: 113,
    testId: "command-picker-add-setWeather",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 3,
  },
  {
    label: "애니메이션 표시",
    kind: "showAnimation",
    commandId: "showAnimation",
    group: "화면/연출",
    index: 114,
    testId: "command-picker-add-showAnimation",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 3,
  },
  {
    label: "엔딩",
    kind: "ending",
    commandId: "ending",
    group: "시스템/고급",
    index: 109,
    testId: "command-picker-add-ending",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 4,
  },
  {
    label: "제작",
    kind: "craftRecipe",
    commandId: "craftRecipe",
    group: "모던 명령",
    index: 211,
    testId: "command-picker-add-craftRecipe",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 4,
  },
  {
    label: "업그레이드",
    kind: "applyItemUpgrade",
    commandId: "applyItemUpgrade",
    group: "모던 명령",
    index: 212,
    testId: "command-picker-add-applyItemUpgrade",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 4,
  },
  {
    label: "도구 장착",
    kind: "equipTool",
    commandId: "equipTool",
    group: "모던 명령",
    index: 213,
    testId: "command-picker-add-equipTool",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 4,
  },
  {
    label: "보관 상자",
    kind: "openChest",
    commandId: "openChest",
    group: "모던 명령",
    index: 214,
    testId: "command-picker-add-openChest",
    selectable: true,
    runtimeSupport: "runtime-full",
    page: 4,
  },
];
const COMMAND_PAGES: readonly CommandPage[] = PICKER_PAGES.map((page) => ({
  page,
  entries: [
    ...M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === page && isM2CatalogEntrySelectableInMap(entry)).map(
      commandEntryFromCatalog
    ),
    ...EXTRA_COMMAND_ENTRIES.filter((entry) => entry.page === page),
  ],
}));

export const EVENT_COMMAND_PICKER_NATIVE_KINDS: readonly CommandKind[] = [
  ...new Set(
    COMMAND_PAGES.flatMap((page) => page.entries)
      .map((entry) => entry.kind)
      .filter((kind): kind is CommandKind => kind !== undefined)
  ),
  ...(COMMAND_PAGES.some((page) => page.entries.some((entry) => entry.kind === undefined))
    ? (["m2Command"] satisfies readonly CommandKind[])
    : []),
];

function commandEntryFromCatalog(entry: M2CommandCatalogEntry): CommandEntry {
  return {
    label: entry.pickerLabel,
    kind: entry.existingKind,
    commandId: entry.id,
    group: entry.pickerGroup,
    index: entry.index,
    testId: entry.existingKind ? `command-picker-add-${entry.existingKind}` : entry.testId,
    selectable: isM2CatalogEntrySelectableInMap(entry),
    runtimeSupport: entry.runtimeSupport,
    page: entry.pickerPage,
  };
}

type EventCommandPickerRequest = {
  readonly title: string;
  readonly onSelect: (command: Command, closePicker: () => void) => EventCommandPickerSelectResult;
};

type EventCommandPickerSelectResult = { readonly closePicker: false } | void;

export function openEventCommandPicker(request: EventCommandPickerRequest): void {
  openEventSubdialog({
    title: request.title,
    testId: "event-command-picker",
    width: "narrow",
    render: (body, close) => {
      let activePage: CommandPage["page"] = 1;
      let query = "";
      let viewMode = storedViewMode();
      const tabs = el("div", { class: "event-command-picker-tabs", attrs: { role: "tablist" } });
      const commandArea = el("div", { class: "event-command-picker-panel" });
      const search = el("input", {
        class: "event-command-picker-search",
        attrs: { type: "search", placeholder: "명령 검색 (전체 탭)", "aria-label": "이벤트 명령 검색" },
        dataset: { testid: "event-command-picker-search" },
      }) as HTMLInputElement;
      const gridToggle = el("button", {
        class: "event-command-picker-view-toggle",
        attrs: { type: "button", title: "리스트/아이콘 그리드 전환", "aria-pressed": viewMode === "grid" ? "true" : "false" },
        dataset: { testid: "event-command-picker-view-toggle" },
        text: viewMode === "grid" ? "▤ 리스트" : "▦ 그리드",
      }) as HTMLButtonElement;
      const render = () => {
        clearChildren(commandArea);
        for (const button of tabs.querySelectorAll<HTMLButtonElement>("button")) {
          button.setAttribute("aria-selected", button.dataset.page === String(activePage) ? "true" : "false");
        }
        gridToggle.textContent = viewMode === "grid" ? "▤ 리스트" : "▦ 그리드";
        gridToggle.setAttribute("aria-pressed", viewMode === "grid" ? "true" : "false");
        if (query.trim().length > 0) {
          commandArea.append(renderSearchResults(query, request.onSelect, close, viewMode));
          return;
        }
        const page = COMMAND_PAGES.find((candidate) => candidate.page === activePage) ?? COMMAND_PAGES[0];
        commandArea.append(renderCommandGrid(page.entries, request.onSelect, close, { showPageChip: false, viewMode }));
      };
      search.addEventListener("input", () => {
        query = search.value;
        render();
      });
      gridToggle.addEventListener("click", () => {
        viewMode = viewMode === "grid" ? "list" : "grid";
        persistViewMode(viewMode);
        render();
      });
      for (const page of COMMAND_PAGES) {
        // 아이콘은 data-glyph + CSS ::before 로 그린다 — textContent("1"~"4")를 오염시키지 않아
        // 기존 텍스트 기반 e2e/단언과 호환된다.
        tabs.append(
          el("button", {
            class: "event-command-picker-tab",
            text: String(page.page),
            attrs: { type: "button", role: "tab", title: pickerPageTitle(page.page), "aria-label": `탭 ${page.page}: ${pickerPageTitle(page.page)}`, "aria-selected": page.page === activePage ? "true" : "false" },
            dataset: {
              testid: `event-command-picker-tab-${page.page}`,
              page: String(page.page),
              glyph: pickerPageGlyph(page.page),
            },
            on: {
              click: () => {
                activePage = page.page;
                render();
              },
            },
          })
        );
      }
      body.append(
        tabs,
        el("div", { class: "event-command-picker-search-row", children: [search, gridToggle] }),
        commandArea,
        renderFooter(close)
      );
      render();
    },
  });
}

// 전 탭 통합 검색. 라벨/그룹명 부분일치, 결과에는 탭 번호 칩을 붙인다.
function renderSearchResults(
  query: string,
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  viewMode: PickerViewMode
): HTMLElement {
  const needle = query.trim().toLowerCase();
  const matches = COMMAND_PAGES.flatMap((page) => page.entries).filter(
    (entry) => entry.label.toLowerCase().includes(needle) || entry.group.toLowerCase().includes(needle)
  );
  if (matches.length === 0) {
    return el("div", {
      class: "event-command-picker-no-result empty-hint",
      text: `"${query.trim()}" 와 일치하는 명령이 없습니다.`,
      dataset: { testid: "event-command-picker-no-result" },
    });
  }
  return renderCommandGrid(matches, onSelect, close, { showPageChip: true, viewMode });
}

function renderCommandGrid(
  entries: readonly CommandEntry[],
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  options: { readonly showPageChip: boolean; readonly viewMode: PickerViewMode }
): HTMLElement {
  const grid = el("div", {
    class: options.viewMode === "grid" ? "event-command-picker-grid icon-grid" : "event-command-picker-grid",
  });
  let currentGroup: M2CommandPickerGroup | undefined;
  for (const entry of [...entries].sort(compareCommandEntries)) {
    if (entry.group !== currentGroup) {
      currentGroup = entry.group;
      const visual = groupVisual(entry.group);
      // 아이콘은 ::before(attr(data-glyph)) 로 — 헤딩 textContent 는 그룹명 그대로 유지(e2e toHaveText 호환).
      grid.append(
        el("div", {
          class: "event-command-picker-group-heading",
          text: entry.group,
          dataset: { category: visual.key, glyph: visual.glyph },
        })
      );
    }
    grid.append(renderCommandButton(entry, onSelect, close, options));
  }
  return grid;
}

function renderCommandButton(
  entry: CommandEntry,
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  options: { readonly showPageChip: boolean },
): HTMLButtonElement {
  const visual = groupVisual(entry.group);
  // 카테고리 아이콘: aria-hidden 스팬의 ::before(attr(data-glyph)) — 버튼 textContent 와
  // 접근성 이름(getByRole name, exact:true 포함)을 오염시키지 않는다.
  const children: HTMLElement[] = [
    el("span", {
      class: "event-command-picker-command-icon",
      attrs: { "aria-hidden": "true" },
      dataset: { glyph: visual.glyph },
    }),
    el("span", { class: "event-command-picker-command-label", text: entry.label }),
  ];
  if (options.showPageChip) {
    children.push(el("span", { class: "event-command-picker-page-chip", text: `탭${entry.page}`, attrs: { "aria-hidden": "true" } }));
  }
  const badge = renderRuntimeSupportBadge(entry.runtimeSupport, `command-runtime-badge-picker-${entry.commandId}`);
  if (badge) children.push(badge);
  const button = el("button", {
    class: entry.selectable ? "event-command-picker-command" : "event-command-picker-command disabled",
    attrs: { type: "button" },
    dataset: { category: visual.key },
    children,
  }) as HTMLButtonElement;
  button.dataset.testid = entry.testId;
  if (entry.selectable) {
    button.addEventListener("click", () => {
      const result = onSelect(createCommandFromEntry(entry), close);
      if (!result || result.closePicker !== false) close();
    });
  } else {
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
  }
  return button;
}

function compareCommandEntries(a: CommandEntry, b: CommandEntry): number {
  const groupDelta = groupOrder(a.group) - groupOrder(b.group);
  return groupDelta === 0 ? a.index - b.index : groupDelta;
}

function groupOrder(group: M2CommandPickerGroup): number {
  const index = M2_COMMAND_PICKER_GROUP_ORDER.indexOf(group);
  return index >= 0 ? index : M2_COMMAND_PICKER_GROUP_ORDER.length;
}

function createCommandFromEntry(entry: CommandEntry): Command {
  return entry.kind ? newCommand(entry.kind) : newM2Command(entry.commandId);
}

function renderFooter(close: () => void): HTMLElement {
  return el("div", {
    class: "event-command-picker-footer",
    children: [
      // [중간-5] 런타임 미지원 배지 범례 — 피커 어디에도 설명이 없던 주황 삼각형의 의미를 명시.
      el("span", {
        class: "event-command-picker-legend",
        dataset: { testid: "event-command-picker-legend" },
        children: [
          el("span", { class: "command-runtime-badge runtime-partial", text: "△", attrs: { "aria-hidden": "true" } }),
          el("span", { text: "부분 실행" }),
          el("span", { class: "command-runtime-badge editor-only", text: "!", attrs: { "aria-hidden": "true" } }),
          el("span", { text: "에디터 전용(런타임 미지원)" }),
        ],
      }),
      el("button", {
        class: "event-command-picker-cancel",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: "event-command-picker-cancel" },
        on: { click: close },
      }),
    ],
  });
}

function storedViewMode(): PickerViewMode {
  try {
    return window.localStorage?.getItem(PICKER_VIEW_MODE_KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function persistViewMode(mode: PickerViewMode): void {
  try {
    window.localStorage?.setItem(PICKER_VIEW_MODE_KEY, mode);
  } catch {
    /* storage 미지원 환경 무시 */
  }
}

export function commandLabel(kind: CommandKind): string {
  return M2_COMMAND_CATALOG.find((entry) => entry.existingKind === kind)?.label ?? commandKindLabel(kind);
}
