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
import { M2_COMMAND_PICKER_GROUP_ORDER, mapScreenNativeSurfaceGroup } from "@/project/eventCommands/m2PickerLayout";
import type { Command } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { commandKindLabel } from "./options";
import { groupHeadingText, groupVisual, pickerPageGlyph, pickerPageIcon, renderCategoryIcon } from "./commandCategoryIcons";
import { renderEditorIcon } from "./editorIcons";
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
import { store } from "@/project/store";
import { renderCompanionRoster } from "./companionRoster";

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
  /**
   * 그룹 안 정렬 우선순위. 0 = 지금 권하는 구현(네이티띘·모던), 1 = 네이티띘 대체가
   * 있는 RM 카탈로그 복사본. 「날씨 효과 설정(m2-050)」이 「날씨 설정(setWeather)」 위에
   * 오는 것을 막는다 — 같은 일을 다를 이름으로 두 번 물어보지 않게.
   */
  readonly rank: number;
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
    group: pickerGroupForDescriptor(descriptor),
    index,
    testId: `command-picker-add-${kind}`,
    selectable: descriptor.selectable,
    runtimeSupport: runtimeSupportFor(descriptor),
    runtimeOwner: descriptor.executionOwner,
    page: descriptor.page,
    rank: 0,
    alternateRoute: descriptor.alternateRoute,
  };
}

/**
 * 저작면 헤딩. 탭 3 네이티띘 명령은 가족 라벨(`화면 연출`·`소리`)로는 거칩어서
 * 조명·날씨 / 그림 / 연출 헤딩을 kind 단위로 다심 직는다.
 */
function pickerGroupForDescriptor(descriptor: CommandPresentationDescriptor): M2CommandPickerGroup {
  const label = commandPresentationGroupLabel(descriptor.group);
  if (descriptor.page !== 3) return label;
  return mapScreenNativeSurfaceGroup(descriptor.kind) ?? label;
}

// These commands are absent from the RM2k3 catalog. Their explicit picker data only
// preserves ordering; presentation and runtime behavior come from the descriptor.
const NATIVE_ONLY_LAYOUT = [
  ["setLighting", 110],
  ["addLight", 111],
  ["removeLight", 112],
  ["setWeather", 113],
  ["showAnimation", 114],
  // 동영상은 연출 탭(3)의 어니매이션 바로 다음 자리를 잡는다. 런타임이 editorOnly 인 동안은
  // descriptor.selectable 이 false 라 그리드에 직접 노출되지 않고 검색 안내로만 보인다.
  ["playMovie", 115],
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
    group: pickerGroupForDescriptor(descriptor),
    index: 1_000 + index,
    testId: `${descriptor.selectable ? "command-picker-add" : "command-picker-info"}-${descriptor.kind}`,
    selectable: descriptor.selectable,
    runtimeSupport: runtimeSupportFor(descriptor),
    runtimeOwner: descriptor.executionOwner,
    page: descriptor.page,
    rank: 0,
    alternateRoute: descriptor.alternateRoute,
  }));
/**
 * 종류 이름을 testid 로 쓸 "대표" 카탈로그 항목. 같은 네이티브 종류로 접히는 항목이 둘
 * 이상이면 `command-picker-add-<kind>` 가 겹쳐 e2e 가 어느 버튼인지 지목할 수 없다
 * (실측 2026-08-28: m2-001-show-text 와 m2-209-advanced-dialogue 가 둘 다
 * command-picker-add-text 를 달아 Playwright strict mode 위반). 카탈로그 순서상 첫 항목만
 * 종류 이름을 갖고 나머지는 항목 id 로 구분한다 — 기존 스펙이 잡던 손잡이
 * (command-picker-add-text = 문장 표시)는 그대로 유지된다.
 *
 * 종전에는 픽커 목록에서 라벨 문자열("고급 대화")로 걸러 중복을 피하려 했는데, 라벨이
 * 바뀌면 조용히 뚫리고 실제로 뚫려 있었다. 구조로 막는다.
 *
 * 은퇴한 카탈로그 행(중복 등재·다른 명령으로 통합)은 라벨이 아니라 `entry.deprecated`
 * (= `DEPRECATED_M2_COMMAND_IDS`) 로 걸러낸다. 라벨 필터는 `pickerLabelFor` 가 붙이는
 * 말줄임("고급 대화...") 때문에 한 번도 맞지 않아, 문장 표시로 통합한 「고급 대화」가 탭 1
 * 「말하기」에 그대로 남아 있었다(실측 2026-08-28).
 */
const CANONICAL_CATALOG_ID_BY_KIND: ReadonlyMap<CommandKind, string> = (() => {
  const canonical = new Map<CommandKind, string>();
  for (const entry of M2_COMMAND_CATALOG) {
    if (!entry.existingKind) continue;
    if (!canonical.has(entry.existingKind)) canonical.set(entry.existingKind, entry.id);
  }
  return canonical;
})();

function catalogEntryTestId(entry: M2CommandCatalogEntry, kind: CommandKind): string {
  return CANONICAL_CATALOG_ID_BY_KIND.get(kind) === entry.id
    ? `command-picker-add-${kind}`
    : `command-picker-add-${entry.id}`;
}

const COMMAND_PAGES: readonly CommandPage[] = PICKER_PAGES.map((page) => ({
  page,
  entries: [
    ...M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === page && !entry.deprecated).map(
      commandEntryFromCatalog
    ),
    ...NATIVE_ONLY_ENTRIES.filter((entry) => entry.page === page),
    ...DERIVED_COMMAND_ENTRIES.filter((entry) => entry.page === page),
  ],
}));
const ALL_COMMAND_ENTRIES = COMMAND_PAGES.flatMap((page) => page.entries);

/**
 * 탭 그리드에 실제로 그려지는 항목. 선택 불가 정보 행은 발견성을 속이므로 배제하고,
 * 검색 결과에서만 “다른 곳: …” 안내와 함금로 노출한다.
 */
export type EventCommandPickerEntryView = {
  readonly commandId: string;
  readonly label: string;
  readonly group: M2CommandPickerGroup;
  readonly page: M2CommandPickerPage;
  readonly selectable: boolean;
  readonly alternateRoute?: string;
  /** 버튼의 data-testid. e2e 가 잡는 손잡이라 항목마다 유일해야 한다. */
  readonly testId: string;
};

function tabGridEntries(entries: readonly CommandEntry[]): readonly CommandEntry[] {
  return entries.filter((entry) => entry.selectable);
}

export function eventCommandPickerTabEntries(page: M2CommandPickerPage): readonly EventCommandPickerEntryView[] {
  const found = COMMAND_PAGES.find((candidate) => candidate.page === page);
  // 그리드와 같은 순서로 돌려준다 — 테스트가 보는 순서가 작가가 보는 순서다.
  return [...tabGridEntries(found?.entries ?? [])].sort(compareCommandEntries);
}

export function eventCommandPickerSearchEntries(): readonly EventCommandPickerEntryView[] {
  return [...ALL_COMMAND_ENTRIES].sort(compareCommandEntries);
}

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
      testId: catalogEntryTestId(entry, entry.existingKind),
      selectable: descriptor.selectable,
      runtimeSupport: runtimeSupportFor(descriptor),
      runtimeOwner: descriptor.executionOwner,
      page: entry.pickerPage,
      rank: 0,
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
    // 탭 3 지도·화면 저작면에서만 RM 카탈로그 박물관 행을 네이티띘·모던 명령 밑으로 내린다.
    // 다른 탭은 기족 순서를 그대로 둔다(이 PR 은 탭 3 수리다).
    rank: entry.pickerPage === 3 && entry.index < 200 ? 1 : 0,
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
  /**
   * 한 레이어 계약: 명령을 골랐으면 피커는 **이미 닫힌 상태**로 이 콜백이 불린다.
   * 편집 다이얼로그를 피커 위에 쌓아 확인이 뒷창에 삼키는 RM식 모달 스택은 없다.
   */
  readonly onSelect: (command: Command) => void;
};

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
      const commandArea = el("div", {
        class: "event-command-picker-panel",
        attrs: {
          id: "event-command-picker-panel",
          role: "tabpanel",
          "aria-labelledby": "event-command-picker-tab-button-1",
        },
      });
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
        commandArea.setAttribute("aria-labelledby", `event-command-picker-tab-button-${activePage}`);
        gridToggle.textContent = viewMode === "grid" ? "▤ 리스트" : "▦ 그리드";
        gridToggle.setAttribute("aria-pressed", viewMode === "grid" ? "true" : "false");
        if (query.trim().length > 0) {
          commandArea.append(renderSearchResults(query, request.onSelect, close, viewMode, render, request.context));
          restoreCommandPickerFocus(commandArea, focusSnapshot);
          return;
        }
        const page = COMMAND_PAGES.find((candidate) => candidate.page === activePage) ?? COMMAND_PAGES[0];
        commandArea.append(renderPickerPage(page.page, page.entries, request.onSelect, close, viewMode, render, request.context));
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
            children: [renderEditorIcon(pickerPageIcon(page.page)), el("span", { text: pickerPageTitle(page.page) })],
            attrs: {
              type: "button",
              role: "tab",
              title: pickerPageTitle(page.page),
              "aria-label": pickerPageTitle(page.page),
              "aria-selected": page.page === activePage ? "true" : "false",
              "aria-controls": "event-command-picker-panel",
              id: `event-command-picker-tab-button-${page.page}`,
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
  return Array.from(area.querySelectorAll<HTMLButtonElement>(".event-command-picker-command"))
    .filter((button) => button.dataset.commandEntry !== undefined);
}

/** 키보드 후보를 index 로 옮긴다. 시야 밖이면 스크롤해 들여온다. */
function highlightCommand(area: HTMLElement, index: number): void {
  const buttons = commandButtonsOf(area);
  buttons.forEach((button) => button.classList.remove("keyboard-active"));
  const target = buttons[index];
  if (!target) return;
  target.classList.add("keyboard-active");
  const targetId = target.getAttribute("id") ?? `event-command-picker-option-${target.dataset.commandEntry ?? index}`;
  target.setAttribute("id", targetId);
  const search = area.closest(".event-subdialog-body")
    ?.querySelector<HTMLInputElement>('[data-testid="event-command-picker-search"]');
  search?.setAttribute("aria-activedescendant", targetId);
  target.scrollIntoView({ block: "nearest" });
}

function renderPickerPage(
  page: M2CommandPickerPage,
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
  if (page === 2) {
    wrap.append(
      renderCompanionRoster(store.getCurrent(), {
        onSelect: (command) => {
          close();
          onSelect(command as unknown as Command);
        },
      }),
    );
  }
  if (favorites.length > 0) {
    wrap.append(renderQuickCommandSection("즐겨찾기", "event-command-picker-favorites", favorites, onSelect, close, viewMode, onPreferencesChanged, context));
  }
  if (recents.length > 0) {
    wrap.append(renderQuickCommandSection("최근 명령", "event-command-picker-recents", recents, onSelect, close, viewMode, onPreferencesChanged, context));
  }
  wrap.append(renderCommandGrid(tabGridEntries(entries), onSelect, close, { showPageChip: false, viewMode, onPreferencesChanged, context }));
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
      // 아이콘은 ::before(attr(data-glyph)) 로 — 헤딩 textContent 는 작업면 그룹명 그대로.
      // 리스트 행 배지 라벨(visual.label)과 달리, 피커 헤딩은 언제나 그룹 이름을 쓴다.
      grid.append(
        el("div", {
          class: "event-command-picker-group-heading",
          children: [renderCategoryIcon(visual), el("span", { text: groupHeadingText(entry.group) })],
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
      children: [renderCategoryIcon(visual)],
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
      const command = createCommandFromEntry(entry);
      // 한 레이어: 편집 표면을 여는 손짓은 피커를 닫고 넘긴다.
      close();
      onSelect(command);
    });
  }

  const favorite = readEventCommandPickerPreferences().favorites.includes(entry.commandId);
  const favoriteButton = el("button", {
    class: `event-command-picker-favorite${favorite ? " is-favorite" : ""}`,
    children: [renderEditorIcon(favorite ? "starFilled" : "star")],
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
  if (groupDelta !== 0) return groupDelta;
  const rankDelta = a.rank - b.rank;
  return rankDelta === 0 ? a.index - b.index : rankDelta;
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
          el("span", { class: "command-runtime-badge runtime-partial", attrs: { "aria-hidden": "true" }, children: [renderEditorIcon("warning")] }),
          el("span", { text: "일부만 실행" }),
          el("span", { class: "command-runtime-badge editor-only", attrs: { "aria-hidden": "true" }, children: [renderEditorIcon("info")] }),
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
