import { newCommand, newM2Command } from "@/editor/eventActions";
import {
  isM2CatalogEntrySelectableInMap,
  M2_COMMAND_CATALOG,
  m2CommandById,
  m2CatalogEntryRuntimeSupport,
  type CommandRuntimeSupport,
  type M2CommandCatalogEntry,
  type M2CommandPickerGroup,
  type M2CommandPickerPage,
  type M2RuntimeContext,
} from "@/project/eventCommands/m2Catalog";
import { M2_COMMAND_PICKER_GROUP_ORDER } from "@/project/eventCommands/m2PickerLayout";
import type { Command } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { commandKindLabel } from "./options";
import { groupVisual, pickerPageGlyph } from "./commandCategoryIcons";
import { renderRuntimeSupportBadge } from "./commandRuntimeBadge";
import { nativeCommandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import {
  readEventCommandPickerPreferences,
  recordRecentEventCommand,
  toggleEventCommandFavorite,
} from "./commandPickerPreferences";
import {
  COMMAND_PRESENTATION_DESCRIPTORS,
  commandPresentationDescriptor,
  commandPresentationGroupLabel,
  type CommandPresentationDescriptor,
} from "@/editor/eventCommands/commandPresentation";
import { openEventSubdialog } from "./subdialog";

type CommandKind = Command["kind"];

type RuntimeOwner = CommandPresentationDescriptor["executionOwner"];

const PICKER_PAGE_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: "빠른 저작",
  2: "동료 · 전투",
  3: "지도 · 화면 효과",
  4: "시스템 · 도구",
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
  readonly runtimeOwner: RuntimeOwner;
  readonly alternateRoute?: string;
  readonly page: M2CommandPickerPage;
};

type CommandPage = {
  readonly page: M2CommandPickerPage;
  readonly entries: readonly CommandEntry[];
};

// 리스트 ↔ 아이콘 그리드 표시 모드. 기본은 리스트.
type PickerViewMode = "list" | "grid";
const PICKER_VIEW_MODE_KEY = "oprn:eventCommandPicker.viewMode";

const PICKER_PAGES: readonly M2CommandPickerPage[] = [1, 2, 3, 4];

function runtimeSupportFor(descriptor: CommandPresentationDescriptor): CommandRuntimeSupport {
  if (descriptor.support === "full") return "runtime-full";
  if (descriptor.support === "partial") return "runtime-partial";
  return "editor-only";
}

function nativeCommandEntry(
  kind: Exclude<CommandKind, "m2Command">,
  index: number
): CommandEntry {
  const descriptor = commandPresentationDescriptor(kind);
  return {
    label: descriptor.label,
    kind,
    commandId: kind,
    group: commandPresentationGroupLabel(descriptor.group),
    index,
    testId: `command-picker-add-${kind}`,
    selectable: descriptor.selectable,
    runtimeSupport: runtimeSupportFor(descriptor),
    runtimeOwner: descriptor.executionOwner,
    page: descriptor.page,
    alternateRoute: descriptor.alternateRoute,
  };
}

// These commands are absent from the RM2k3 catalog. Their explicit picker data only
// preserves ordering; presentation and runtime behavior come from the descriptor.
const NATIVE_ONLY_LAYOUT = [
  ["setLighting", 110],
  ["addLight", 111],
  ["removeLight", 112],
  ["setWeather", 113],
  ["showAnimation", 114],
  ["ending", 109],
  ["craftRecipe", 211],
  ["applyItemUpgrade", 212],
  ["equipTool", 213],
  ["openChest", 214],
] as const satisfies readonly (readonly [Exclude<CommandKind, "m2Command">, number])[];

const NATIVE_ONLY_ENTRIES: readonly CommandEntry[] = NATIVE_ONLY_LAYOUT.map(([kind, index]) =>
  nativeCommandEntry(kind, index)
);

export const EVENT_COMMAND_PICKER_NATIVE_ONLY_PLACEMENTS = NATIVE_ONLY_ENTRIES.map((entry) => ({
  kind: entry.kind as Exclude<CommandKind, "m2Command">,
  group: entry.group,
  page: entry.page,
}));

const CATALOG_NATIVE_KINDS: ReadonlySet<CommandKind> = new Set(
  M2_COMMAND_CATALOG.flatMap((entry) => entry.existingKind ? [entry.existingKind] : [])
);
const NATIVE_ONLY_KINDS: ReadonlySet<CommandKind> = new Set(NATIVE_ONLY_LAYOUT.map(([kind]) => kind));
const DERIVED_COMMAND_ENTRIES: readonly CommandEntry[] = COMMAND_PRESENTATION_DESCRIPTORS
  .filter((descriptor) =>
    descriptor.kind !== "m2Command"
    && !CATALOG_NATIVE_KINDS.has(descriptor.kind)
    && !NATIVE_ONLY_KINDS.has(descriptor.kind)
  )
  .map((descriptor, index) => ({
    label: descriptor.label,
    kind: descriptor.kind,
    commandId: descriptor.kind,
    group: commandPresentationGroupLabel(descriptor.group),
    index: 1_000 + index,
    testId: `${descriptor.selectable ? "command-picker-add" : "command-picker-info"}-${descriptor.kind}`,
    selectable: descriptor.selectable,
    runtimeSupport: runtimeSupportFor(descriptor),
    runtimeOwner: descriptor.executionOwner,
    page: descriptor.page,
    alternateRoute: descriptor.alternateRoute,
  }));
const COMMAND_PAGES: readonly CommandPage[] = PICKER_PAGES.map((page) => ({
  page,
  entries: [
    ...M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === page && entry.pickerLabel !== "고급 대화").map(
      commandEntryFromCatalog
    ),
    ...NATIVE_ONLY_ENTRIES.filter((entry) => entry.page === page),
    ...DERIVED_COMMAND_ENTRIES.filter((entry) => entry.page === page),
  ],
}));
const ALL_COMMAND_ENTRIES = COMMAND_PAGES.flatMap((page) => page.entries);

export const EVENT_COMMAND_PICKER_NATIVE_KINDS: readonly CommandKind[] = [
  ...new Set(
    COMMAND_PAGES.flatMap((page) => page.entries)
      .filter((entry) => entry.selectable)
      .map((entry) => entry.kind)
      .filter((kind): kind is CommandKind => kind !== undefined)
  ),
  ...(COMMAND_PAGES.some((page) => page.entries.some((entry) => entry.selectable && entry.kind === undefined))
    ? (["m2Command"] satisfies readonly CommandKind[])
    : []),
];

function commandEntryFromCatalog(entry: M2CommandCatalogEntry): CommandEntry {
  if (entry.existingKind) {
    const descriptor = commandPresentationDescriptor(entry.existingKind);
    return {
      label: entry.pickerLabel,
      kind: entry.existingKind,
      commandId: entry.id,
      group: entry.pickerGroup,
      index: entry.index,
      testId: `command-picker-add-${entry.existingKind}`,
      selectable: descriptor.selectable,
      runtimeSupport: runtimeSupportFor(descriptor),
      runtimeOwner: descriptor.executionOwner,
      page: entry.pickerPage,
      alternateRoute: descriptor.alternateRoute,
    };
  }
  const selectable = isM2CatalogEntrySelectableInMap(entry);
  return {
    label: entry.pickerLabel,
    commandId: entry.id,
    group: entry.pickerGroup,
    index: entry.index,
    testId: entry.testId,
    selectable,
    runtimeSupport: entry.runtimeSupport,
    runtimeOwner: commandPresentationDescriptor("m2Command").executionOwner,
    page: entry.pickerPage,
    alternateRoute: selectable ? undefined : commandPresentationDescriptor("m2Command").alternateRoute,
  };
}

type EventCommandPickerRequest = {
  readonly title: string;
  /**
   * 지금 편집 중인 이벤트의 실행 컨텍스트(map=맵 이벤트, common=공통 이벤트, troop=배틀 이벤트).
   * m2 카탈로그 행의 런타임 지원 배지는 컨텍스트에 따라 달라진다. 생략하면 세 컨텍스트 중
   * 최저 지원으로 보수 표시한다.
   */
  readonly context?: M2RuntimeContext;
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
        attrs: { type: "search", placeholder: "명령 검색 (전체 탭)", "aria-label": "명령 검색" },
        dataset: { testid: "event-command-picker-search" },
      }) as HTMLInputElement;
      const gridToggle = el("button", {
        class: "event-command-picker-view-toggle",
        attrs: { type: "button", title: "리스트/아이콘 그리드 전환", "aria-pressed": viewMode === "grid" ? "true" : "false" },
        dataset: { testid: "event-command-picker-view-toggle" },
        text: viewMode === "grid" ? "▤ 리스트" : "▦ 그리드",
      }) as HTMLButtonElement;
      const render = () => {
        const focusSnapshot = captureCommandPickerFocus(commandArea);
        clearChildren(commandArea);
        for (const button of tabs.querySelectorAll<HTMLButtonElement>("button")) {
          const selected = button.dataset.page === String(activePage);
          button.setAttribute("aria-selected", selected ? "true" : "false");
          button.setAttribute("tabindex", selected ? "0" : "-1");
        }
        gridToggle.textContent = viewMode === "grid" ? "▤ 리스트" : "▦ 그리드";
        gridToggle.setAttribute("aria-pressed", viewMode === "grid" ? "true" : "false");
        if (query.trim().length > 0) {
          commandArea.append(renderSearchResults(query, request.onSelect, close, viewMode, render, request.context));
          restoreCommandPickerFocus(commandArea, focusSnapshot);
          return;
        }
        const page = COMMAND_PAGES.find((candidate) => candidate.page === activePage) ?? COMMAND_PAGES[0];
        commandArea.append(renderPickerPage(page.entries, request.onSelect, close, viewMode, render, request.context));
        restoreCommandPickerFocus(commandArea, focusSnapshot);
      };
      search.addEventListener("input", () => {
        query = search.value;
        render();
        // 타이핑하면 첫 결과가 곧바로 후보가 된다 — Enter 한 번으로 삽입되게.
        highlightCommand(commandArea, 0);
      });
      // 검색창을 떠나지 않고 결과를 훑고 넣는다(목업 팔레트의 핵심 동작).
      search.addEventListener("keydown", (event) => {
        const buttons = commandButtonsOf(commandArea);
        if (buttons.length === 0) return;
        const current = buttons.findIndex((button) => button.classList.contains("keyboard-active"));
        if (event.key === "ArrowDown") {
          event.preventDefault();
          highlightCommand(commandArea, current < 0 ? 0 : (current + 1) % buttons.length);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          highlightCommand(commandArea, current <= 0 ? buttons.length - 1 : current - 1);
        } else if (event.key === "Enter") {
          const target = buttons[current < 0 ? 0 : current];
          if (!target) return;
          event.preventDefault();
          target.click();
        }
      });
      gridToggle.addEventListener("click", () => {
        viewMode = viewMode === "grid" ? "list" : "grid";
        persistViewMode(viewMode);
        render();
      });
      for (const page of COMMAND_PAGES) {
        // Persistent text labels keep the four categories understandable even
        // without relying on icon glyphs or hover-only title text.
        tabs.append(
          el("button", {
            class: "event-command-picker-tab",
            text: pickerPageTitle(page.page),
            attrs: {
              type: "button",
              role: "tab",
              title: pickerPageTitle(page.page),
              "aria-label": pickerPageTitle(page.page),
              "aria-selected": page.page === activePage ? "true" : "false",
              tabindex: page.page === activePage ? "0" : "-1",
            },
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
      tabs.addEventListener("keydown", (event) => {
        if (!(event.target instanceof HTMLButtonElement)) return;
        const buttons = Array.from(tabs.querySelectorAll<HTMLButtonElement>("button"))
          .filter((button) => button.dataset.page !== undefined);
        const currentIndex = buttons.indexOf(event.target);
        if (currentIndex < 0) return;
        let nextIndex = currentIndex;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        else if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % buttons.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = buttons.length - 1;
        else return;
        event.preventDefault();
        const next = buttons[nextIndex];
        if (!next) return;
        activePage = Number(next.dataset.page) as CommandPage["page"];
        next.focus();
        render();
      });
      body.append(
        tabs,
        el("div", { class: "event-command-picker-search-row", children: [search, gridToggle] }),
        commandArea,
        renderFooter(close)
      );
      render();
      search.focus({ preventScroll: true });
    },
  });
}

/** 결과 영역의 명령 버튼들(그룹 헤딩·토글 제외). */
function commandButtonsOf(area: HTMLElement): HTMLButtonElement[] {
  return Array.from(area.querySelectorAll<HTMLButtonElement>("button[data-command-entry]"));
}

/** 키보드 후보를 index 로 옮긴다. 시야 밖이면 스크롤해 들여온다. */
function highlightCommand(area: HTMLElement, index: number): void {
  const buttons = commandButtonsOf(area);
  buttons.forEach((button) => button.classList.remove("keyboard-active"));
  const target = buttons[index];
  if (!target) return;
  target.classList.add("keyboard-active");
  target.scrollIntoView({ block: "nearest" });
}

function renderPickerPage(
  entries: readonly CommandEntry[],
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  viewMode: PickerViewMode,
  onPreferencesChanged: () => void,
  context: M2RuntimeContext | undefined,
): HTMLElement {
  const preferences = readEventCommandPickerPreferences();
  const byId = new Map(ALL_COMMAND_ENTRIES.map((entry) => [entry.commandId, entry]));
  const favorites = preferences.favorites.flatMap((id) => byId.get(id) ?? []);
  const recents = preferences.recents
    .filter((id) => !preferences.favorites.includes(id))
    .flatMap((id) => byId.get(id) ?? []);
  const wrap = el("div", { class: "event-command-picker-page" });
  if (favorites.length > 0) {
    wrap.append(renderQuickCommandSection("즐겨찾기", "event-command-picker-favorites", favorites, onSelect, close, viewMode, onPreferencesChanged, context));
  }
  if (recents.length > 0) {
    wrap.append(renderQuickCommandSection("최근 명령", "event-command-picker-recents", recents, onSelect, close, viewMode, onPreferencesChanged, context));
  }
  wrap.append(renderCommandGrid(entries, onSelect, close, { showPageChip: false, viewMode, onPreferencesChanged, context }));
  return wrap;
}

function renderQuickCommandSection(
  title: string,
  testId: string,
  entries: readonly CommandEntry[],
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  viewMode: PickerViewMode,
  onPreferencesChanged: () => void,
  context: M2RuntimeContext | undefined,
): HTMLElement {
  return el("section", {
    class: "event-command-picker-quick-section",
    dataset: { testid: testId },
    children: [
      el("h3", { class: "event-command-picker-quick-title", text: title }),
      renderCommandGrid(entries, onSelect, close, {
        showPageChip: true,
        viewMode,
        onPreferencesChanged,
        showGroupHeadings: false,
        preserveOrder: true,
        context,
      }),
    ],
  });
}

// 전 탭 통합 검색. 라벨/그룹명 부분일치, 결과에는 탭 번호 칩을 붙인다.
function renderSearchResults(
  query: string,
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  viewMode: PickerViewMode,
  onPreferencesChanged: () => void,
  context: M2RuntimeContext | undefined,
): HTMLElement {
  const needle = query.trim().toLowerCase();
  const matches = COMMAND_PAGES.flatMap((page) => page.entries).filter(
    (entry) => entry.label.toLowerCase().includes(needle)
      || entry.group.toLowerCase().includes(needle)
      || entry.alternateRoute?.toLowerCase().includes(needle)
  );
  if (matches.length === 0) {
    return el("div", {
      class: "event-command-picker-no-result empty-hint",
      text: `"${query.trim()}" 와 일치하는 명령이 없습니다.`,
      dataset: { testid: "event-command-picker-no-result" },
    });
  }
  const countHead = el("div", {
    class: "event-command-picker-search-count",
    dataset: { testid: "event-command-picker-search-count" },
    text: `검색 결과 ${matches.length}개`,
  });
  const grid = renderCommandGrid(matches, onSelect, close, { showPageChip: true, viewMode, onPreferencesChanged, context });
  return el("div", {
    class: "event-command-picker-search-results",
    dataset: { testid: "event-command-picker-search-results" },
    children: [countHead, grid],
  });
}

function renderCommandGrid(
  entries: readonly CommandEntry[],
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  options: {
    readonly showPageChip: boolean;
    readonly viewMode: PickerViewMode;
    readonly onPreferencesChanged: () => void;
    readonly showGroupHeadings?: boolean;
    readonly preserveOrder?: boolean;
    readonly context?: M2RuntimeContext;
  }
): HTMLElement {
  const grid = el("div", {
    class: options.viewMode === "grid" ? "event-command-picker-grid icon-grid" : "event-command-picker-grid",
  });
  let currentGroup: M2CommandPickerGroup | undefined;
  const orderedEntries = options.preserveOrder ? entries : [...entries].sort(compareCommandEntries);
  for (const entry of orderedEntries) {
    if (options.showGroupHeadings !== false && entry.group !== currentGroup) {
      currentGroup = entry.group;
      const visual = groupVisual(entry.group);
      // 아이콘은 ::before(attr(data-glyph)) 로 — 헤딩 textContent 는 그룹명 그대로 유지(e2e toHaveText 호환).
      grid.append(
        el("div", {
          class: "event-command-picker-group-heading",
          text: visual.label,
          dataset: { category: visual.key, glyph: visual.glyph },
        })
      );
    }
    grid.append(renderCommandButton(entry, onSelect, close, options));
  }
  return grid;
}

/**
 * 배지에 쓸 컨텍스트 반영 런타임 지원. 네이티브 kind 항목은 카탈로그/디스크립터 판정을
 * 그대로 쓰고(컨텍스트 무관), 순수 m2 항목만 편집 컨텍스트로 재판정한다.
 */
// Native rows and aliases are context-sensitive through COMMAND_GUARANTEES; only pure M2 rows use M2 classification.
function entryRuntimeSupport(entry: CommandEntry, context: M2RuntimeContext | undefined): CommandRuntimeSupport {
  if (entry.kind !== undefined && entry.kind !== "m2Command") {
    return nativeCommandRuntimeSupport(entry.kind, context);
  }
  const catalogEntry = m2CommandById(entry.commandId);
  return catalogEntry ? m2CatalogEntryRuntimeSupport(catalogEntry, context) : entry.runtimeSupport;
}

function renderCommandButton(
  entry: CommandEntry,
  onSelect: EventCommandPickerRequest["onSelect"],
  close: () => void,
  options: { readonly showPageChip: boolean; readonly onPreferencesChanged: () => void; readonly context?: M2RuntimeContext },
): HTMLElement {
  const visual = groupVisual(entry.group);
  const runtimeSupport = entryRuntimeSupport(entry, options.context);
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
    children.push(el("span", { class: "event-command-picker-page-chip", text: pickerPageTitle(entry.page), attrs: { "aria-hidden": "true" } }));
  }
  const badge = renderRuntimeSupportBadge(runtimeSupport, `command-runtime-badge-picker-${entry.commandId}`);
  if (badge) children.push(badge);
  if (!entry.selectable) {
    const guidanceId = `command-picker-guidance-${entry.commandId}`;
    children.push(el("span", {
      class: "event-command-picker-alternate-route",
      text: entry.alternateRoute ? `다른 곳: ${entry.alternateRoute}` : "여기서는 고를 수 없습니다",
      attrs: { id: guidanceId },
      dataset: { testid: guidanceId },
    }));
  }
  const button = el("button", {
    class: entry.selectable ? "event-command-picker-command" : "event-command-picker-command is-informational",
    attrs: {
      type: "button",
      "aria-label": entry.label,
      ...(entry.selectable ? {} : {
        "aria-disabled": "true",
        "aria-describedby": `command-picker-guidance-${entry.commandId}`,
      }),
    },
    dataset: {
      category: visual.key,
      runtimeSupport,
      runtimeOwner: entry.runtimeOwner,
      // 검색창에서 ↑↓/Enter 로 훑을 대상 표식. 즐겨찾기 별 버튼과 구분된다.
      ...(entry.selectable ? { commandEntry: entry.commandId } : {}),
    },
    children,
  }) as HTMLButtonElement;
  button.dataset.testid = entry.testId;
  if (entry.selectable) {
    button.addEventListener("click", () => {
      recordRecentEventCommand(entry.commandId);
      options.onPreferencesChanged();
      const result = onSelect(createCommandFromEntry(entry), close);
      if (!result || result.closePicker !== false) close();
    });
  }

  const favorite = readEventCommandPickerPreferences().favorites.includes(entry.commandId);
  const favoriteButton = el("button", {
    class: `event-command-picker-favorite${favorite ? " is-favorite" : ""}`,
    text: favorite ? "★" : "☆",
    attrs: {
      type: "button",
      title: favorite ? `${entry.label} 즐겨찾기 해제` : `${entry.label} 즐겨찾기 추가`,
      "aria-label": favorite ? `${entry.label} 즐겨찾기 해제` : `${entry.label} 즐겨찾기 추가`,
      "aria-pressed": favorite ? "true" : "false",
    },
    dataset: { testid: `command-picker-favorite-${entry.commandId}` },
    on: {
      click: () => {
        toggleEventCommandFavorite(entry.commandId);
        options.onPreferencesChanged();
      },
    },
  }) as HTMLButtonElement;
  favoriteButton.disabled = !entry.selectable;
  return el("div", {
    class: "event-command-picker-command-wrap",
    dataset: { commandId: entry.commandId },
    children: [button, favoriteButton],
  });
}

type CommandPickerFocusSnapshot = {
  readonly commandId: string;
  readonly control: "command" | "favorite";
};

function captureCommandPickerFocus(commandArea: HTMLElement): CommandPickerFocusSnapshot | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !commandArea.contains(active)) return null;
  const wrap = active.closest<HTMLElement>(".event-command-picker-command-wrap");
  const commandId = wrap?.dataset.commandId;
  if (!commandId) return null;
  return {
    commandId,
    control: active.classList.contains("event-command-picker-favorite") ? "favorite" : "command",
  };
}

function restoreCommandPickerFocus(
  commandArea: HTMLElement,
  snapshot: CommandPickerFocusSnapshot | null,
): void {
  if (!snapshot) return;
  const wrap = Array.from(commandArea.querySelectorAll<HTMLElement>(".event-command-picker-command-wrap"))
    .find((candidate) => candidate.dataset.commandId === snapshot.commandId);
  const selector = snapshot.control === "favorite"
    ? ".event-command-picker-favorite"
    : ".event-command-picker-command";
  wrap?.querySelector<HTMLElement>(selector)?.focus({ preventScroll: true });
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
  if (entry.kind === "playAudio") {
    return {
      kind: "playAudio",
      resourceId: "",
      loop: m2CommandById(entry.commandId)?.title === "Play BGM",
    };
  }
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
          el("span", { text: "일부만 실행" }),
          el("span", { class: "command-runtime-badge editor-only", text: "!", attrs: { "aria-hidden": "true" } }),
          el("span", { text: "에디터에서만 미리 봅니다" }),
        ],
      }),
      el("button", {
        class: "event-command-picker-cancel",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: "event-command-picker-cancel" },
        on: {
          click: (event) => {
            event.preventDefault();
            event.stopPropagation();
            close();
          },
        },
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
  if (kind === "playAudio") return commandKindLabel(kind);
  return M2_COMMAND_CATALOG.find((entry) => entry.existingKind === kind)?.label ?? commandKindLabel(kind);
}
