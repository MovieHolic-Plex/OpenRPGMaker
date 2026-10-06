import { commandSummary } from "./commandSummary";
import { textBodyOf } from "@/project/io/rewriteLegacyDialogue";
import { editorState } from "@/editor/editorState";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import {
  buildEventBeginnerTemplate,
  type EventBeginnerTemplateId,
} from "@/editor/eventBeginnerTemplates";
import {
  eventDraftIssuesForPage,
  validateEventDraftBody,
} from "@/editor/eventDraftValidator";
import {
  addEventPageCommand,
  addEventPageCommandAt,
  deleteEventPageCommandAt,
  ensureEventPages,
  insertEventPageCommandAt,
  moveEventPageCommandAcross,
  moveEventPageCommandAt,
  moveEventPageCommandToIndex,
  normalizeEventPage,
  replaceEventPageCommands,
  replaceEventPageCommandAt,
} from "@/editor/eventPages";
import { eventDraftCharacterName } from "@/project/eventDraftAuthored";
import { store, type ProjectChangeDescriptor } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { renderEditorIcon, type EditorIconName } from "./editorIcons";
import { toast } from "@/util/toast";
import { renderEventAiAssist } from "./aiAssist";
import { auxCompositeKey, syncAuxHosts } from "./auxOpenController";
import { renderEventPageFlow, renderEventPagePreview } from "./eventScriptModernViews";
import { renderEventScheduleEditor } from "./eventScheduleEditor";
import { openEventCommandEditDialog, openNewEventCommandDialog } from "./commandEditDialog";
import { applyMemoryOpeningTemplate } from "./memoryOpeningTemplate";
import { applySceneTemplate } from "./sceneTemplate";
import { finishCommandListMount, renderCommandList, resumeCommandListMount } from "./commandList";
import { handleCommandShortcut, openCommandContextMenu } from "./commandListContextMenu";
import {
  beginEventViewSession,
  currentCommandQuery,
  currentStoryboardMode,
  renderStoryboard,
  renderViewToggle,
  setCommandQuery,
  setStoryboardMode,
  type StoryboardMode,
} from "./storyboardView";
import { newCommand } from "@/editor/eventActions";
import {
  resetCommandInspectorView,
  invalidateCommandSelectionRows,
  isCommandActionKey,
  beginCommandSelectionScope,
  isCommandSelected,
  notifyCommandSelectionChanged,
  setCommandSelectionSurface,
  selectedCommandPath,
  selectedCommandPaths,
  setCommandInspectorHost,
  setCommandSelectionListener,
  showCommandInspector,
} from "./commandInspector";
import { createCommandToolbarHistory, type CommandToolbarHistory } from "./commandToolbarHistory";
import { openEventCommandPicker } from "./commandPicker";
import { defaultInsertionPath, describeInsertionPath } from "./commandInspector";
import { scrollIntoNearestScroller } from "./scrollIntoNearestScroller";
import { applyStoredSettingsColumnWidth, attachColumnResize } from "./layoutResize";
import {
  appendEventRailGroup,
  renderClassicPageTabStrip,
  renderEventCharacterIdField,
  renderEventCharacterSocialExtras,
  renderEventPageProps,
  renderPageCommandCatalog,
  renderPageActions,
} from "./pageProps";
import type { CommandListActions } from "./types";
import { commandKindLabel } from "./options";
import { openFieldMonsterTemplateDialog } from "./fieldMonsterTemplateDialog";
import { renderFollowerPresetBar } from "./followerPresetPicker";
import { resolveCommandAtPath, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";

type CommandNavigation = {
  readonly key: string;
  readonly root: HTMLElement;
  readonly navigate: (path: readonly number[]) => boolean;
  readonly refreshMove: () => boolean;
};
let commandNavigation: CommandNavigation | undefined;

/** Validation/search callers use this instead of painting a positional CSS selection. */
export function navigateToEventCommand(
  mapId: MapId, eventId: string, pageId: string, commandPath: readonly number[],
): boolean {
  if (!resolveCommandAtPath(activePageCommands(mapId, eventId, pageId), commandPath)) return false;
  editorState.set({ selectedEventPageId: pageId });
  if (commandNavigation?.key !== `${mapId}:${eventId}:${pageId}` || !commandNavigation.root.isConnected) return false;
  return commandNavigation.navigate(commandPath);
}

/** Reuse the active List workbench for an array-only move. Other mutations/pages
 * still use the full staged render and its existing error recovery. */
export function refreshEventCommandMove(mapId: MapId, eventId: string, change: ProjectChangeDescriptor): boolean {
  if (change.scope !== "map" || change.mapId !== mapId || change.eventId !== eventId
    || !change.eventCommandMove) return false;
  if (!commandNavigation?.root.isConnected || commandNavigation.key !== `${mapId}:${eventId}:${change.eventCommandMove.pageId}`) return false;
  return commandNavigation.refreshMove();
}

export function clearEventCommandNavigation(): void { commandNavigation = undefined; }

export function renderEventEditorContent(container: HTMLElement, mapId: MapId, eventId: string): void {
  renderEventEditorDynamic(container, mapId, eventId);
}

export function renderEventEditorStable(container: HTMLElement, mapId: MapId, eventId: string): void {
  const section = el("div", { class: "panel-section event-editor-stable" });
  const stub: EventPage = {
    id: "",
    name: "",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
  const catalog = renderPageCommandCatalog(mapId, eventId, stub, () => activePageIdOf(mapId, eventId));
  catalog.querySelector("[data-testid='page-command-summary']")?.remove();
  section.append(catalog);
  container.append(section);
}

export function renderEventEditorDynamic(container: HTMLElement, mapId: MapId, eventId: string): void {
  const section = el("div", { class: "panel-section event-editor event-editor-command-focused", dataset: { testid: "event-editor-content" } });
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    section.append(el("div", { class: "empty-hint", text: "맵을 찾을 수 없습니다." }));
    container.append(section);
    return;
  }

  let ev = map.events.find((event) => event.id === eventId);
  if (!ev) {
    if (store.restoreEventDraftFromVault(mapId, eventId)) {
      ev = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId);
    }
  }
  if (!ev) {
    section.append(el("div", {
      class: "empty-hint",
      text: "이벤트를 찾을 수 없습니다. 편집 세션이 끊겼다면 맵에서 이벤트를 다시 열어 주세요.",
      dataset: { testid: "event-editor-missing" },
    }));
    container.append(section);
    return;
  }

  if (!ev.pages?.length) {
    ensureEventPages(mapId, ev.id);
    ev = store.getCurrent().maps[mapId]?.events.find((event) => event.id === eventId) ?? ev;
  }
  const pages = (ev.pages ?? []).map((page) => normalizeEventPage(page));
  const selectedPageId = editorState.get().selectedEventPageId;
  const activePage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  if (!activePage) {
    section.append(el("div", { class: "empty-hint", text: "이벤트 페이지가 없습니다." }));
    container.append(section);
    return;
  }

  const evForRender = { ...ev, pages };
  const validation = validateEventDraftBody(store.getCurrent(), mapId, evForRender);
  const activePageIssues = eventDraftIssuesForPage(validation, activePage.id);
  const selectionKey = `${mapId}:${ev.id}:${activePage.id}`;
  // Detached render must not notify the previous surface's selection listener.
  setCommandSelectionListener(undefined);
  beginCommandSelectionScope(selectionKey);
  const commandHistory = pageCommandHistory(mapId, ev.id, activePage.id);
  const actions = commandHistory.wrapActions(pageCommandActions(mapId, ev.id, activePage.id));
  const settingsColumn = el("div", { class: "event-editor-settings-column" });
  const commandsColumn = el("div", { class: "event-editor-commands-column" });
  const columnResizer = el("div", {
    class: "event-editor-column-resizer",
    attrs: {
      role: "separator",
      "aria-label": "설정과 이 페이지가 하는 일 사이즈 조절",
      "aria-orientation": "vertical",
      tabindex: "0",
      title: "드래그 또는 ←/→ 키로 폭 조절 · 더블클릭으로 초기화",
    },
    dataset: { testid: "event-editor-column-resizer" },
  });
  const inspectorColumn = el("div", {
    class: "event-editor-inspector-column",
    dataset: { testid: "event-editor-inspector" },
  });
  setCommandInspectorHost(inspectorColumn, () => renderEventPagePreview({ mapId, eventId, page: activePage }));
  resetCommandInspectorView();

  // 보기 방식·검색어는 이 이벤트를 편집하는 동안 살아 있어야 한다. 스토어가 바뀌면
  // modal.ts 가 본문을 통째로 다시 그리는데, 그때 localStorage 만 읽으면 미리보기가
  // 저장된 저작 보기로 튕겨 나간다.
  beginEventViewSession(`${mapId}:${ev.id}`);
  const storyboardMode = currentStoryboardMode();
  const cmdList = el("div", { class: "cmd-list" });
  let listRendered = false;
  let syncListMount: () => void = () => {};
  const ensureCommandList = (): void => {
    if (listRendered) return;
    listRendered = true;
    renderCommandList(cmdList, activePage.commands, [], actions, {
      selectionScope: selectionKey,
      deferMount: true,
      reuseImmutableRows: true,
      onMount: () => syncListMount(),
      issues: activePageIssues,
      pickerContext: "map",
      openCommandPicker: (containerPath) => openCommandPickerForActions(actions, containerPath),
    });
    if (activePage.commands.length === 0) cmdList.querySelector(".empty-hint")?.remove();
    cmdList.append(renderEmptyCommandLine(actions, activePage.commands.length === 0, mapId, eventId, activePage.id));
    // The list renderer registers itself; other views still share this selection scope.
    setCommandSelectionSurface(section);
  };
  cmdList.addEventListener("dblclick", (event) => {
    if (event.target === cmdList) {
      cmdList.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    }
  });
  const storyboardHost = el("div", { class: "event-storyboard-host", dataset: { testid: "event-storyboard-host" } });
  // AI 초안은 별도 모달에만 그린다. 적용 전에는 저작 명령 목록을 유지한다.
  const stagedHost = el("div", {
    class: "cmd-staged-host",
    dataset: { testid: "ai-event-staged-host" },
  });
  const flowHost = el("div", {
    class: "event-page-flow-host",
    dataset: { testid: "event-page-flow-host" },
  });
  let currentMode: StoryboardMode = storyboardMode === "preview" ? "list" : storyboardMode;
  // 스토리 보기의 선택도 목록과 **같은** 인스펙터를 채운다. 예전에는 카드 한 번 클릭이
  // 곧바로 편집 모달을 열어서, 기본 보기인 스토리에서는 오른쪽 「선택한 명령」 칼럼이
  // 영원히 비어 있고 툴바의 이동/복사가 대상을 찾지 못했다.
  const selectStoryboardCommand = (path: number[], preserveSelection = false): void => {
    const cmd = resolveCommandAtPath(activePage.commands, path);
    if (!cmd) return;
    showCommandInspector({ command: cmd, path, actions, preserveSelection });
  };
  const openStoryboardEditor = (path: number[]): void => {
    const cmd = resolveCommandAtPath(activePage.commands, path);
    if (!cmd) return;
    openEventCommandEditDialog({
      initial: cmd,
      lockKind: true,
      onApply: (edited) => actions.replaceCommand(path, edited),
    });
  };
  const storyboardRequest = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement) || target.closest("input, textarea, select, [contenteditable='true'], button")) return null;
    const item = target.closest<HTMLElement>("[data-cmd-path]");
    const path = parseCommandPath(item?.dataset.cmdPath);
    const command = path ? resolveCommandAtPath(activePage.commands, path) : null;
    if (!item || !path || !command) return null;
    if (!isCommandSelected(path)) selectStoryboardCommand(path);
    return { x: 0, y: 0, item, command, path, actions, commands: activePage.commands, pickerContext: "map" as const,
      openEditor: () => openStoryboardEditor(path) };
  };
  storyboardHost.addEventListener("keydown", event => {
    if (event.defaultPrevented || !isCommandActionKey(event)) return;
    const request = storyboardRequest(event.target);
    if (request) handleCommandShortcut(event, request);
  });
  storyboardHost.addEventListener("contextmenu", event => {
    const request = storyboardRequest(event.target);
    if (!request) return;
    event.preventDefault();
    openCommandContextMenu({ ...request, x: event.clientX, y: event.clientY });
  });
  const makeStoryboard = () =>
    renderStoryboard(activePage.commands, {
      onSelect: selectStoryboardCommand,
      onOpenEditor: openStoryboardEditor,
      onMove: (path, direction) => actions.moveCommand(path, direction),
      onDelete: (path) => actions.deleteCommand(path),
      onAddNext: () => openCommandPickerForActions(actions, undefined, activePage.commands),
      onAddToBranch: (containerPath) => openCommandPickerForActions(actions, containerPath),
      // 빈 이벤트 CTA: 말하기 / 장소 옮기기 / 상점 열기는 피커를 거치지 않고 바로 편집면으로.
      onQuickStart: (kind) => {
        openNewEventCommandDialog(newCommand(kind), (command) => actions.addCommand([], command));
      },
      selectedPath: selectedCommandPath(),
    });
  // Keep an inexpensive mount until Story is requested. The AI dock also calls
  // applyViewMode during setup, so repeated calls must not rebuild the same tree.
  let storyboardEl: HTMLElement = el("div");
  let storyboardRendered = false;
  const changeMode = (next: StoryboardMode): void => {
    currentMode = next;
    setStoryboardMode(next);
    applyViewMode();
  };
  let viewToggle = renderViewToggle(currentMode, changeMode, ["list", "storyboard", "flow"]);
  const commandCount = el("span", {
    class: "event-editor-column-count",
    dataset: { testid: "event-editor-command-count" },
  });
  const refreshCommandCount = (): void => {
    const count = totalCommandCount(activePage.commands);
    commandCount.textContent = `${count}개`;
    commandCount.setAttribute("aria-label", `작성한 명령 ${count}개, 분기 안 명령 포함`);
  };
  refreshCommandCount();
  // 툴바가 아직 없는 시점에도 applyViewMode 가 안전하게 호출되도록 기본값은 빈 함수다.
  let syncToolbarState: () => void = () => {};
  function applyViewMode(): void {
    const isStoryboard = currentMode === "storyboard";
    const isFlow = currentMode === "flow";
    refreshCommandCount();
    setCommandSelectionSurface(section);
    if (!isStoryboard && !isFlow) ensureCommandList();
    cmdList.hidden = isStoryboard || isFlow;
    if (!cmdList.hidden) resumeCommandListMount(cmdList);
    storyboardEl.hidden = !isStoryboard;
    flowHost.hidden = !isFlow;
    const nextToggle = renderViewToggle(currentMode, changeMode, ["list", "storyboard", "flow"]);
    const restoreTabFocus = viewToggle.contains(document.activeElement);
    viewToggle.replaceWith(nextToggle);
    viewToggle = nextToggle;
    if (restoreTabFocus) viewToggle.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    if (isStoryboard && !storyboardRendered) {
      const fresh = makeStoryboard();
      storyboardEl.replaceWith(fresh);
      storyboardEl = fresh;
      storyboardRendered = true;
      storyboardEl.hidden = false;
      // 재렌더/보기 전환 뒤에도 선택한 명령이 인스펙터에 남아 있어야 한다.
      const restored = selectedCommandPath();
      if (restored) selectStoryboardCommand([...restored], true);
    } else if (!isStoryboard && storyboardRendered) {
      storyboardEl.replaceChildren();
      storyboardRendered = false;
    }
    // 플로우는 미리보기가 마지막으로 보던 단계를 짚는다. 미리보기에서 넘어온 직후에
    // 다시 그려야 그 단계가 반영되므로 보기 전환마다 새로 만든다.
    if (isFlow && flowHost.childNodes.length === 0) {
      flowHost.replaceChildren(renderEventPageFlow({
        mapId,
        eventId,
        page: activePage,
        onSelect: selectStoryboardCommand,
      }));
      const restored = selectedCommandPath();
      if (restored) selectStoryboardCommand([...restored], true);
    } else if (!isFlow) {
      flowHost.replaceChildren();
    }
    invalidateCommandSelectionRows();
    notifyCommandSelectionChanged();
    syncToolbarState();
  }
  storyboardHost.append(storyboardEl);

  // NPC 연결 컨트롤은 삭제된 `display: none` identity 카드 안에 살았다 — 이제 그 주제가 속한
  // 「NPC와 일정」 그룹에서 사용자가 실제로 보고 누를 수 있다.
  const characterLink = renderEventCharacterIdField(mapId, evForRender);
  const socialExtras = renderEventCharacterSocialExtras(mapId, evForRender);
  const scheduleEditor = renderEventScheduleEditor(mapId, evForRender);
  const pageSettings = renderEventPageProps(mapId, evForRender.id, activePage, evForRender);
  const npcName = ev.characterId
    ? eventDraftCharacterName(store.getCurrent(), ev, ev.characterId).trim() || ev.characterId
    : "연결 안 됨";
  appendEventRailGroup(
    pageSettings,
    { slug: "npc", title: "NPC와 일정", summary: npcName, open: false, authored: Boolean(ev.characterId) },
    [characterLink, socialExtras, scheduleEditor].filter((node): node is HTMLElement => node !== null),
  );
  const settingsMain = el("div", {
    class: "event-editor-settings-main",
    children: [pageSettings],
  });

  settingsColumn.append(columnLabel("settings", "이 페이지 설정", "어떻게 보이고 언제 켜지는지"), settingsMain);
  settingsColumn.querySelectorAll("details").forEach((node) => {
    if (node.classList.contains("event-editor-settings-accordion-group")) return;
    if (
      node.dataset.testid === "event-schedule-editor"
      || node.dataset.testid === "event-schedule-section"
      || node.closest("[data-testid='event-schedule-editor'], [data-testid='event-schedule-section']")
    ) return;
    const replacement = el("div", {
      class: node.className,
      dataset: Object.fromEntries(
        Object.entries(node.dataset).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      ),
    });
    Array.from(node.childNodes).forEach((child) => replacement.append(child));
    node.replaceWith(replacement);
  });
  const aiAssist = renderEventAiAssist({
    mapId,
    eventId: ev.id,
    page: activePage,
    cmdList,
    selectionPath: selectedCommandPath,
    stagedHost,
    refreshListVisibility: () => applyViewMode(),
    replaceAll: (commands) => commandHistory.replaceAll(commands),
  });
  const commandToolbar = renderCommandToolbar({
    cmdList,
    actions,
    commandHistory,
    mapId,
    eventId: ev.id,
    page: activePage,
    viewToggle,
    aiDock: aiAssist,
    currentMode: () => currentMode,
    storyboardEl: () => storyboardEl,
  });
  // 툴바가 생긴 다음에야 검색·이동 버튼 상태를 맞출 수 있다. 첫 적용은 여기서 한 번.
  syncToolbarState = commandToolbar.sync;
  syncListMount = () => {
    searchSurfaces.delete(cmdList);
    if (currentMode === "list") commandToolbar.sync();
  };
  // 선택이 바뀌면(목록·스토리 어느 쪽이든) 편집 버튼 상태를 즉시 다시 계산한다.
  setCommandSelectionListener(commandToolbar.syncSelection);
  applyViewMode();
  commandsColumn.append(
    columnLabel(
      "commands",
      "명령",
      "위에서 아래로 차례대로 실행됩니다",
      commandCount,
    ),
    el("fieldset", {
      class: "event-oprn-fieldset event-contents-fieldset",
      attrs: { "aria-label": "이 페이지가 하는 일" },
      dataset: { testid: "event-script-canvas" },
      children: [
        commandToolbar.element,
        storyboardHost,
        flowHost,
        cmdList,
      ],
    }),
    // 열기 버튼은 툴바에 있고, 작성기와 초안은 별도 모달에서 표시한다.
    aiAssist,
  );

  const workbench = el("div", {
    class: `event-editor-workbench${inspectorColumn.hidden ? "" : " has-command-inspector"}`,
    children: [settingsColumn, columnResizer, commandsColumn, inspectorColumn],
  });
  applyStoredSettingsColumnWidth(workbench);
  attachColumnResize(columnResizer, workbench);

  section.append(
    el("div", {
      class: "event-editor-pagebar",
      children: [renderClassicPageTabStrip(mapId, evForRender, activePage), renderPageActions(mapId, evForRender, activePage)],
    }),
    workbench,
  );
  container.append(section);
  setCommandSelectionSurface(section);
  notifyCommandSelectionChanged();
  commandNavigation = {
    key: selectionKey,
    root: section,
    refreshMove: () => {
      if (currentMode !== "list" || !listRendered) return false;
      const event = store.getCurrent().maps[mapId]?.events.find(candidate => candidate.id === eventId);
      const page = event?.pages?.find(candidate => candidate.id === activePage.id);
      if (!event || !page || editorState.get().selectedEventPageId && editorState.get().selectedEventPageId !== page.id) return false;
      // activePage is a presentation copy; published store snapshots stay untouched.
      activePage.commands = page.commands;
      const issues = eventDraftIssuesForPage(validateEventDraftBody(store.getCurrent(), mapId, event), page.id);
      renderCommandList(cmdList, page.commands, [], actions, {
        selectionScope: selectionKey, issues, pickerContext: "map", reuseImmutableRows: true, onMount: () => syncListMount(),
        openCommandPicker: containerPath => openCommandPickerForActions(actions, containerPath),
      });
      cmdList.append(renderEmptyCommandLine(actions, page.commands.length === 0, mapId, eventId, page.id));
      searchSurfaces.delete(cmdList);
      setCommandSelectionSurface(section);
      invalidateCommandSelectionRows();
      notifyCommandSelectionChanged();
      commandToolbar.sync();
      return true;
    },
    navigate: path => {
      const command = resolveCommandAtPath(activePage.commands, path);
      if (!command) return false;
      currentMode = "list";
      setStoryboardMode("list");
      setCommandQuery("");
      const search = section.querySelector<HTMLInputElement>('[data-testid="event-command-search"]');
      if (search) search.value = "";
      applyViewMode();
      finishCommandListMount(cmdList);
      showCommandInspector({ command, path: [...path], actions });
      const row = Array.from(cmdList.querySelectorAll<HTMLElement>(".cmd-item"))
        .find(item => item.dataset.cmdPath === JSON.stringify(path));
      const target = row?.querySelector<HTMLElement>(".cmd-head");
      if (!target) return false;
      target.focus({ preventScroll: true });
      scrollIntoNearestScroller(target, "center");
      return true;
    },
  };
}

function columnLabel(
  slot: "settings" | "commands" | "inspector",
  title: string,
  hint: string,
  trailing?: HTMLElement,
): HTMLElement {
  return el("div", {
    class: `event-editor-column-label event-editor-column-label-${slot}`,
    dataset: { testid: `event-editor-column-label-${slot}` },
    children: [
      el("span", { class: "event-editor-column-title", text: title }),
      el("span", { class: "event-editor-column-hint", text: hint }),
      ...(trailing ? [trailing] : []),
    ],
  });
}

function activePageIdOf(mapId: MapId, eventId: string): string | null {
  const ev = store.getCurrent().maps[mapId]?.events.find((e) => e.id === eventId);
  if (!ev) return null;
  const pages = ev.pages ?? [];
  if (!pages.length) return null;
  const selectedPageId = editorState.get().selectedEventPageId;
  const active = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  return active.id;
}

type CommandToolbarOptions = {
  readonly cmdList: HTMLElement;
  readonly actions: CommandListActions;
  readonly commandHistory: CommandToolbarHistory;
  readonly mapId: MapId;
  readonly eventId: string;
  readonly page: EventPage;
  readonly viewToggle?: HTMLElement;
  readonly aiDock?: HTMLDetailsElement;
  readonly currentMode: () => StoryboardMode;
  readonly storyboardEl: () => HTMLElement;
};

type CommandToolbar = {
  readonly element: HTMLElement;
  /** 보기 전환·재렌더 뒤에 검색 필터와 편집 버튼 상태를 현재 화면에 맞춘다. */
  readonly sync: () => void;
  readonly syncSelection: () => void;
};

type CommandSearchEntry = { readonly key: string; readonly ancestors: readonly string[]; readonly text: string };

/** Page-version cache: search counts authored commands without constructing a hidden view. */
export function indexCommandSearch(commands: readonly Command[], container: readonly number[] = []): CommandSearchEntry[] {
  const result: CommandSearchEntry[] = [];
  commands.forEach((command, index) => {
    const path = [...container, index];
    let summary: string;
    try { summary = commandSummary(command); } catch { summary = String(command.kind); }
    const aliases: Record<string, string> = { text: "대사", changeFace: "표정", choices: "선택지", fork: "분기", transfer: "이동" };
    const text = `${commandKindLabel(command.kind)} ${aliases[command.kind] ?? ""} ${summary} ${command.kind === "text" ? textBodyOf(command).replace(/\s+/g, " ").trim() : ""}`.toLocaleLowerCase("ko");
    const ancestors: string[] = [];
    for (let length = 1; length < path.length; length += 2) ancestors.push(JSON.stringify(path.slice(0, length)));
    result.push({ key: JSON.stringify(path), ancestors, text });
    for (const branch of eventCommandBranches(command)) result.push(...indexCommandSearch(branch.commands, [...path, branch.branchIndex]));
  });
  return result;
}

type SearchSurface = {
  readonly rows: readonly HTMLElement[];
  readonly groups: ReadonlyMap<HTMLElement, readonly HTMLElement[]>;
  query?: string;
};
const searchSurfaces = new WeakMap<HTMLElement, SearchSurface>();

/** Cache row/group topology once. Only active views are filtered; write only changed visibility. */
function filterCommandSurface(surface: HTMLElement, query: string, keep: ReadonlySet<string>): void {
  let cached = searchSurfaces.get(surface);
  if (!cached) {
    const rows = Array.from(surface.querySelectorAll<HTMLElement>("[data-cmd-path]"));
    const groups = new Map<HTMLElement, HTMLElement[]>();
    for (const group of surface.querySelectorAll<HTMLElement>(".event-storyboard-branches")) groups.set(group, []);
    for (const row of rows) {
      for (let parent = row.parentElement; parent && parent !== surface; parent = parent.parentElement) groups.get(parent)?.push(row);
    }
    cached = { rows, groups };
    searchSurfaces.set(surface, cached);
  }
  if (cached.query === query) return;
  cached.query = query;
  for (const row of cached.rows) {
    const hidden = query.length > 0 && !keep.has(row.dataset.cmdPath!);
    if (row.hidden !== hidden) row.hidden = hidden;
  }
  for (const [group, rows] of cached.groups) {
    const hidden = query.length > 0 && rows.every(row => row.hidden);
    if (group.hidden !== hidden) group.hidden = hidden;
  }
}

function parseCommandPath(raw: string | undefined): number[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((part) => Number.isInteger(part))
      ? (parsed as number[])
      : null;
  } catch {
    return null;
  }
}

/** `<details>` 팝오버를 Escape 층에 올린다 — Escape 가 에디터 전체를 닫지 않게. */
/**
 * 툴바 팝오버(`<details>`)의 두 가지 탈출 경로.
 *  - Escape: 모달 스택에 한 층으로 등록해 팝오버만 닫힌다(에디터는 닫히지 않는다).
 *  - 바깥 pointerdown: 팝오버 밖을 누르면 닫힌다. 실측 2026-09-03 — 이 경로가 없어서 팝오버가
 *    열린 채 우클릭 메뉴와 겹쳤다(제안서 §4). 리스너는 열려 있는 동안만 document 에 산다.
 */
function makePopoverEscapable(details: HTMLDetailsElement): void {
  const onOutsidePointerDown = (event: Event): void => {
    const target = event.target;
    if (target instanceof Node && details.contains(target)) return;
    details.open = false;
  };
  details.addEventListener("toggle", () => {
    if (details.open) {
      registerModal(details, () => { details.open = false; });
      document.addEventListener("pointerdown", onOutsidePointerDown, true);
    } else {
      unregisterModal(details);
      document.removeEventListener("pointerdown", onOutsidePointerDown, true);
    }
  });
}

function renderCommandToolbar(options: CommandToolbarOptions): CommandToolbar {
  const { cmdList, actions, commandHistory, mapId, eventId, page, viewToggle, aiDock } = options;
  // 선택의 단일 진상은 인스펙터다. 예전에는 `cmdList` 의 `.selected` 를 DOM 에서 긁었는데,
  // 스토리 보기에서는 목록이 비어 있으니 무엇을 골라도 이동/복사가 조용히 아무 일도 안 했다.
  const selectedPath = (): number[] | null => {
    const path = selectedCommandPath();
    if (!path) return null;
    const copy = [...path];
    // 삭제·되돌리기로 사라진 경로면 선택 없음으로 본다.
    return resolveCommandAtPath(page.commands, copy) ? copy : null;
  };
  const moveBounds = (path: number[]): { readonly canUp: boolean; readonly canDown: boolean } => {
    const list = resolveCommandListAtPath(page.commands, path);
    const index = path[path.length - 1];
    if (!list || index === undefined) return { canUp: false, canDown: false };
    return { canUp: index > 0, canDown: index < list.length - 1 };
  };
  const runForSelected = (run: (path: number[]) => void): void => {
    const path = selectedPath();
    if (!path) {
      toast("먼저 명령을 하나 고르세요.", "error");
      return;
    }
    run(path);
  };
  const moveUp = toolbarButton("arrowUp", "위로 이동", "event-command-toolbar-move-up", () => runForSelected((path) => actions.moveCommand(path, -1)));
  const moveDown = toolbarButton("arrowDown", "아래로 이동", "event-command-toolbar-move-down", () => runForSelected((path) => actions.moveCommand(path, 1)));
  const copyButton = toolbarButton("copy", "복사", "event-command-toolbar-copy", () => runForSelected((path) => commandHistory.copySelected(path)));
  const cutButton = toolbarButton("cut", "잘라내기", "event-command-toolbar-cut", () => runForSelected((path) => commandHistory.cutSelected(path, actions)));
  // 무엇에 적용되는지 팝오버가 직접 말한다 — 눌러 보고 나서야 아무 일도 없음을 알게 되지 않도록.
  const editTarget = el("p", {
    class: "event-editor-command-edit-target",
    dataset: { testid: "event-command-edit-target" },
  });
  const setDisabled = (button: HTMLButtonElement, disabled: boolean): void => {
    button.disabled = disabled;
    if (disabled) button.setAttribute("aria-disabled", "true");
    else button.removeAttribute("aria-disabled");
  };
  const syncEditTools = (): void => {
    const path = selectedPath();
    if (!path) {
      editTarget.textContent = "고른 명령이 없습니다. 먼저 명령을 한 번 클릭하세요.";
      editTarget.dataset.state = "empty";
      for (const button of [moveUp, moveDown, copyButton, cutButton]) setDisabled(button, true);
      return;
    }
    const bounds = moveBounds(path);
    const command = resolveCommandAtPath(page.commands, path);
    const humanIndex = (path[path.length - 1] ?? 0) + 1;
    const multiple = selectedCommandPaths().length > 1;
    editTarget.textContent = multiple ? `고른 명령 ${selectedCommandPaths().length}개에 적용됩니다.`
      : `${humanIndex}번째 ${command ? commandKindLabel(command.kind) : "명령"}에 적용됩니다.`;
    editTarget.dataset.state = "selected";
    setDisabled(moveUp, multiple || !bounds.canUp);
    setDisabled(moveDown, multiple || !bounds.canDown);
    setDisabled(copyButton, false);
    setDisabled(cutButton, false);
  };
  const editTools = el("details", {
    class: "event-editor-command-edit-menu",
    dataset: { testid: "event-command-edit-menu" },
    children: [
      el("summary", {
        class: "event-editor-command-edit-summary",
        text: "편집",
        attrs: { title: "이동, 복사, 실행 취소와 템플릿" },
      }),
      el("div", {
        class: "event-editor-command-edit-popover",
        children: [
          editTarget,
          toolGroup(moveUp, moveDown),
          toolGroup(copyButton, cutButton),
        ],
      }),
    ],
  }) as HTMLDetailsElement;
  // 팝오버가 열릴 때마다 상태를 다시 계산한다 — 버튼이 보이는 순간이 곧 이 시점이다.
  editTools.addEventListener("toggle", () => { if (editTools.open) syncEditTools(); });
  makePopoverEscapable(editTools);
  const toolsMenu = renderEventToolsMenu(mapId, eventId, page, actions);
  makePopoverEscapable(toolsMenu);

  const searchCount = el("span", {
    class: "event-editor-command-search-count",
    dataset: { testid: "event-command-search-count" },
    attrs: { role: "status", "aria-live": "polite" },
  });
  const commandSearch = el("input", {
    class: "search event-editor-command-search",
    attrs: { type: "search", placeholder: "명령 검색", "aria-label": "명령 검색" },
    dataset: { testid: "event-command-search" },
  }) as HTMLInputElement;
  // 입력창은 매 렌더 새로 만들어진다 — 값은 편집 세션이 들고 있어야 살아남는다.
  commandSearch.value = currentCommandQuery();
  const searchClear = el("button", {
    class: "event-editor-command-search-clear",
    children: [renderEditorIcon("close")],
    attrs: { type: "button", title: "검색 지우기", "aria-label": "검색 지우기" },
    dataset: { testid: "event-command-search-clear" },
    on: {
      click: () => {
        setCommandQuery("");
        commandSearch.value = "";
        applySearch();
      },
    },
  }) as HTMLButtonElement;

  let indexedCommands: readonly Command[] | undefined;
  let searchIndex: readonly CommandSearchEntry[] = [];
  let lastQuery: string | undefined;
  let keep = new Set<string>();
  let matches = 0;
  function applySearch(): void {
    const query = currentCommandQuery().trim().toLocaleLowerCase("ko");
    const mode = options.currentMode();
    const isPreview = mode === "preview";
    commandSearch.disabled = isPreview;
    commandSearch.title = isPreview ? "미리보기에서는 검색할 수 없습니다. 목록이나 스토리로 바꾸세요." : "명령 검색";
    searchClear.hidden = query.length === 0;
    if (query.length > 0 && (indexedCommands !== page.commands || lastQuery !== query)) {
      if (indexedCommands !== page.commands) {
        indexedCommands = page.commands;
        searchIndex = indexCommandSearch(page.commands);
      }
      keep = new Set();
      matches = 0;
      for (const entry of searchIndex) {
        if (!entry.text.includes(query)) continue;
        matches += 1;
        keep.add(entry.key);
        for (const ancestor of entry.ancestors) keep.add(ancestor);
      }
    }
    lastQuery = query;
    if (mode === "list") filterCommandSurface(cmdList, query, keep);
    else if (mode === "storyboard") filterCommandSurface(options.storyboardEl(), query, keep);
    // Flow has no filterable rows. Count comes from the model, never a hidden List.
    searchCount.textContent = query.length === 0 || isPreview ? "" : matches > 0 ? `${matches}개 일치` : "일치 없음";
    if (query.length === 0 || isPreview) delete searchCount.dataset.state;
    else searchCount.dataset.state = matches > 0 ? "hit" : "miss";
  }
  commandSearch.addEventListener("input", () => {
    setCommandQuery(commandSearch.value);
    applySearch();
  });

  const element = el("div", {
    class: "toolbar event-editor-command-toolbar",
    attrs: { "aria-label": "이 페이지가 하는 일 도구" },
    children: [
      toolbarButton("plus", "명령", "event-command-toolbar-add", () => {
        // 선택한 행 바로 아래에 — 자리 규칙은 openCommandPickerForActions 주석.
        openCommandPickerForActions(actions, undefined, page.commands);
      }, false, true),
      el("div", {
        class: "event-editor-command-search-field",
        children: [commandSearch, searchClear, searchCount],
      }),
      toolbarButton("undo", "되돌리기", "event-command-toolbar-undo", () => commandHistory.undo(), !commandHistory.canUndo()),
      toolbarButton("redo", "다시 실행", "event-command-toolbar-redo", () => commandHistory.redo(), !commandHistory.canRedo()),
      editTools,
      toolsMenu,
      ...(viewToggle ? [viewToggle] : []),
      renderCommandAuxGroup(aiDock),
    ],
  });
  const syncHistoryButtons = (): void => {
    const undo = element.querySelector<HTMLButtonElement>('[data-testid="event-command-toolbar-undo"]');
    const redo = element.querySelector<HTMLButtonElement>('[data-testid="event-command-toolbar-redo"]');
    if (undo) setDisabled(undo, !commandHistory.canUndo());
    if (redo) setDisabled(redo, !commandHistory.canRedo());
  };
  return {
    element,
    syncSelection: () => { syncHistoryButtons(); syncEditTools(); },
    sync: () => { syncHistoryButtons(); applySearch(); syncEditTools(); },
  };
}

function renderCommandAuxGroup(aiDock?: HTMLDetailsElement): HTMLElement {
  // AI 도크는 팝오버 밖에 살므로 도구 메뉴를 열지 않고 자기만 토글한다.
  // aria-expanded 는 도크의 toggle 이 단일 진상이다 — Escape 나 재렌더 로 닫혀도 어긋나지 않는다.
  const aiButton = aiDock ? toolbarButton("spark", "AI로 명령 만들기", "event-command-quick-ai") : null;
  if (aiDock && aiButton) {
    const syncAiExpanded = (): void => aiButton.setAttribute("aria-expanded", String(aiDock.open));
    syncAiExpanded();
    aiDock.addEventListener("toggle", syncAiExpanded);
    aiButton.addEventListener("click", () => {
      aiDock.open = !aiDock.open;

    });
  }
  return el("div", {
    class: "event-editor-command-aux-group",
    attrs: { role: "group", "aria-label": "보조 도구" },
    // «▶ 미리보기»·«⌘ 플로우 보기» 버튼은 없다. 둘 다 보기 방식 세그먼트
    // (`event-view-toggle-preview` / `event-view-toggle-flow`)와 같은 화면으로 들어가는
    // 중복 컨트롤이었다. 플로우는 그 위에 팝오버로 떠서 미리보기의 재생 컨트롤을 덮기까지 했다.
    // 파생 보기의 입구는 세그먼트 하나다.
    children: aiButton ? [aiButton] : [],
  });
}

function renderEventToolsMenu(
  mapId: MapId,
  eventId: string,
  page: EventPage,
  actions: CommandListActions,
): HTMLDetailsElement {
  // 플로우차트는 여기 없다 — 보기 방식 세그먼트의 「플로우」가 칼럼 전체를 쓴다.
  const auxTools = el("div", {
    class: "event-editor-command-tools-popover event-editor-aux-tools",
    children: [
      renderFollowerPresetBar({
        insertCommandsAt: (index, commands) => {
          actions.insertCommands?.([index], commands);
        },
        commandCount: () => page.commands.length,
      }),
      el("button", {
        class: "btn event-editor-aux-tool-button",
        text: "☠ 필드 몬스터 템플릿",
        attrs: { type: "button", title: "필드 몬스터 템플릿 (전투→승리 소거)" },
        dataset: { testid: "event-command-toolbar-field-monster" },
        on: { click: () => openFieldMonsterTemplateDialog(mapId, eventId, page) },
      }),
    ],
  });
  const menu = el("details", {
    class: "event-editor-command-tools-menu",
    dataset: { testid: "event-editor-aux-tools" },
    children: [
      el("summary", {
        class: "event-editor-command-tools-summary",
        text: "도구",
        attrs: { title: "플로우와 특수 템플릿" },
      }),
      auxTools,
    ],
  }) as HTMLDetailsElement;
  syncAuxHosts(auxCompositeKey(mapId, eventId, page.id));
  return menu;
}

function toolGroup(...buttons: HTMLButtonElement[]): HTMLElement {
  return el("div", {
    class: "event-editor-command-tool-group",
    attrs: { role: "group" },
    children: buttons,
  });
}

/**
 * `label` 은 버튼에 그대로 보이는 온전한 한국어 낱말이다 — 공백으로 자르지 않는다.
 * 더 긴 설명이 필요하면 `title` 을 따로 넘긴다.
 */
function toolbarButton(
  icon: EditorIconName,
  label: string,
  testId: string,
  onClick?: () => void,
  disabled = false,
  primary = false,
  title: string = label
): HTMLButtonElement {
  return el("button", {
    class: "event-editor-command-tool" + (primary ? " primary" : ""),
    children: [renderEditorIcon(icon), el("span", { class: "event-editor-command-tool-label", text: label })],
    attrs: disabled ? { type: "button", title, disabled: "" } : { type: "button", title },
    dataset: { testid: testId },
    on: onClick ? { click: onClick } : undefined,
  }) as HTMLButtonElement;
}

function pageCommandActions(mapId: MapId, eventId: string, pageId: string): CommandListActions {
  return {
    addCommand: (containerPath, command) =>
      addEventPageCommandAt(mapId, eventId, pageId, containerPath, command),
    insertCommand: (path, command) => insertEventPageCommandAt(mapId, eventId, pageId, path, command),
    replaceCommand: (path, command) => replaceEventPageCommandAt(mapId, eventId, pageId, path, command),
    deleteCommand: (path) => deleteEventPageCommandAt(mapId, eventId, pageId, path),
    moveCommand: (path, dir) => moveEventPageCommandAt(mapId, eventId, pageId, path, dir),
    moveCommandTo: (sourcePath, toIndex) => moveEventPageCommandToIndex(mapId, eventId, pageId, sourcePath, toIndex),
    moveCommandAcross: (sourcePath, targetContainerPath, toIndex) =>
      moveEventPageCommandAcross(mapId, eventId, pageId, sourcePath, targetContainerPath, toIndex),
  };
}

function pageCommandHistory(mapId: MapId, eventId: string, pageId: string): CommandToolbarHistory {
  return createCommandToolbarHistory({
    key: `${mapId}:${eventId}:${pageId}`,
    immutableSnapshots: true,
    readCommands: () => activePageCommands(mapId, eventId, pageId),
    replaceCommands: commands => replaceEventPageCommands(mapId, eventId, pageId, commands),
  });
}

export function undoActiveEventCommands(mapId: MapId, eventId: string, redo = false): void {
  const pageId = activePageIdOf(mapId, eventId);
  if (!pageId) return;
  const history = pageCommandHistory(mapId, eventId, pageId);
  if (redo) history.redo();
  else history.undo();
}

function activePageCommands(mapId: MapId, eventId: string, pageId: string): Command[] {
  return store.getCurrent().maps[mapId]?.events
    .find((event) => event.id === eventId)
    ?.pages?.find((page) => page.id === pageId)
    ?.commands ?? [];
}

/**
 * 개수 배지는 저작한 `Command` 객체를 센다 — 분기 안에 중첩된 명령도 재귀로 포함한다.
 * 분기 머리글·빈 분기·묶음 끝 마커는 실행 명령이 아니므로 세지 않는다.
 */
function totalCommandCount(commands: readonly Command[]): number {
  return commands.reduce(
    (sum, command) =>
      sum + 1 + eventCommandBranches(command).reduce((inner, branch) => inner + totalCommandCount(branch.commands), 0),
    0,
  );
}

function renderEmptyCommandLine(
  actions: CommandListActions,
  showBeginnerTemplates: boolean,
  mapId: MapId,
  eventId: string,
  pageId: string,
): HTMLElement {
  const openPicker = () => openCommandPickerForActions(actions, []);
  const line = el("button", {
    class: "cmd-empty-line",
    text: "+ 여기에 명령 추가",
    attrs: { type: "button", title: "이 페이지의 마지막에 명령을 하나 넣어줍니다" },
    dataset: { testid: "event-command-empty-line" },
    on: {
      click: (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPicker();
      },
      keydown: (event) => {
        if (event instanceof KeyboardEvent && event.key === "Enter") {
          event.preventDefault();
          openPicker();
        }
      },
    },
  });
  if (!showBeginnerTemplates) return line;

  const templates: readonly {
    readonly label: string;
    readonly templateId?: EventBeginnerTemplateId;
    readonly testId: string;
    readonly memoryOpening?: boolean;
    readonly scene?: boolean;
  }[] = [
    { label: "대사하는 NPC", templateId: "talking-npc", testId: "event-template-talking-npc" },
    { label: "보물상자", templateId: "treasure-chest", testId: "event-template-treasure-chest" },
    { label: "문/맵 이동", templateId: "transfer", testId: "event-template-transfer" },
    { label: "상점", templateId: "shop", testId: "event-template-shop" },
    { label: "전투 시작", templateId: "battle", testId: "event-template-battle" },
    { label: "장면", testId: "event-template-scene", scene: true },
    { label: "회상 오프닝", testId: "event-template-memory-opening", memoryOpening: true },
    { label: "빈 이벤트 / 명령 검색", testId: "event-template-empty-search" },
  ];
  return el("div", {
    class: "event-command-empty-experience",
    dataset: { testid: "event-command-empty-experience" },
    children: [
      el("div", {
        class: "event-command-empty-copy",
        children: [
          el("strong", { text: "이 이벤트는 아직 비어 있습니다." }),
          el("span", { text: "시작 유형을 고르거나 명령 검색으로 직접 구성하세요." }),
        ],
      }),
      el("div", {
        class: "event-command-template-actions",
        children: templates.map((template) => el("button", {
          class: "event-command-template-button",
          text: template.label,
          attrs: { type: "button" },
          dataset: { testid: template.testId },
          on: {
            click: () => {
              if (template.memoryOpening) {
                applyMemoryOpeningTemplate(mapId, eventId, pageCommandHistory(mapId, eventId, pageId).replaceAll);
                return;
              }
              if (template.scene) {
                applySceneTemplate(pageCommandHistory(mapId, eventId, pageId).replaceAll);
                return;
              }
              if (!template.templateId) {
                openPicker();
                return;
              }
              const result = buildEventBeginnerTemplate(store.getCurrent(), mapId, eventId, template.templateId);
              if (!result.command) {
                toast(result.unavailableReason, "error");
                return;
              }
              openNewEventCommandDialog(result.command, (command) => actions.addCommand([], command));
            },
          },
        })),
      }),
      line,
    ],
  });
}

/**
 * 명령 피커를 연다. 자리 규칙은 하나다(commandInspector.defaultInsertionPath):
 *  - `containerPath` 를 준 호출(빈 분기 슬롯·분기 추가 줄·페이지 끝 줄)은 그 컨테이너 끝에,
 *  - 아니면 **선택한 행 바로 아래 같은 깊이**, 선택이 없으면 루트 끝에.
 * 피커 제목이 어디에 들어가는지 말한다 — 예전엔 표시가 없어 분기 안 행을 고르고 추가한 명령이
 * 분기 밖으로 들어갔는지 알 수 없었다(2026-09-17 적대적 리뷰 P0-3).
 */
function openCommandPickerForActions(
  actions: CommandListActions,
  containerPath?: readonly number[],
  rootCommands: readonly Command[] = [],
): void {
  if (document.querySelector('[data-testid="event-command-picker"]')) return;
  const insertPath = containerPath ? undefined : defaultInsertionPath(rootCommands);
  const where = containerPath
    ? (containerPath.length === 0 ? "이 페이지의 마지막에" : "이 분기의 마지막에")
    : describeInsertionPath(rootCommands, insertPath);
  openEventCommandPicker({
    title: `명령 추가 — ${where}`,
    context: "map",
    // 명령을 고르면 피커를 먼저 닫는다. 편집 창이 피커 위에 쌓이면 확인이 뒤 창에 먹힌다.
    onSelect: (command) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        if (insertPath) actions.insertCommand(insertPath, editedCommand);
        else actions.addCommand(containerPath ?? [], editedCommand);
      });
    },
  });
}

export function openActiveEventCommandPicker(mapId: MapId, eventId: string): boolean {
  const pageId = activePageIdOf(mapId, eventId);
  if (!pageId || document.querySelector('[data-testid="event-command-picker"]')) return false;
  const commands = activePageCommands(mapId, eventId, pageId);
  const insertPath = defaultInsertionPath(commands);
  openEventCommandPicker({
    title: `명령 추가 — ${describeInsertionPath(commands, insertPath)}`,
    context: "map",
    onSelect: (command) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        if (insertPath) insertEventPageCommandAt(mapId, eventId, pageId, insertPath, editedCommand);
        else addEventPageCommand(mapId, eventId, pageId, editedCommand);
      });
    },
  });
  return true;
}
