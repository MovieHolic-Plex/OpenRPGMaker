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
  replaceEventPageCommands,
  replaceEventPageCommandAt,
} from "@/editor/eventPages";
import { commandRuntimeSupport } from "@/project/eventCommands/runtimeSupport";
import { store } from "@/project/store";
import type { Command, EventPage, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { hasEventAiStagedDraft, renderEventAiAssist } from "./aiAssist";
import { auxCompositeKey, syncAuxHosts } from "./auxOpenController";
import { renderEventPagePreview, renderEventScriptFlowchart } from "./eventScriptModernViews";
import { renderEventScheduleEditor } from "./eventScheduleEditor";
import { openEventCommandEditDialog, openNewEventCommandDialog } from "./commandEditDialog";
import { renderCommandList } from "./commandList";
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
  selectedCommandPath,
  setCommandInspectorHost,
  setCommandSelectionListener,
  showCommandInspector,
} from "./commandInspector";
import { createCommandToolbarHistory, type CommandToolbarHistory } from "./commandToolbarHistory";
import { openEventCommandPicker } from "./commandPicker";
import { applyStoredSettingsColumnWidth, attachColumnResize } from "./layoutResize";
import {
  appendEventRailGroup,
  renderClassicPageTabStrip,
  renderEventCharacterIdField,
  renderEventCharacterSocialExtras,
  renderEventPageProps,
  renderPageCommandCatalog,
  renderPageTabs,
} from "./pageProps";
import type { CommandListActions } from "./types";
import { commandKindLabel } from "./options";
import { openFieldMonsterTemplateDialog } from "./fieldMonsterTemplateDialog";
import { renderFollowerPresetBar } from "./followerPresetPicker";
import { resolveCommandAtPath, resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { registerModal, unregisterModal } from "@/editor/ui/modalStack";

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
  const section = el("div", { class: "panel-section event-editor", dataset: { testid: "event-editor-content" } });
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
  }
  const pages = ev.pages ?? [];
  const selectedPageId = editorState.get().selectedEventPageId;
  const activePage = pages.find((page) => page.id === selectedPageId) ?? pages[0];
  if (!activePage) {
    section.append(el("div", { class: "empty-hint", text: "이벤트 페이지가 없습니다." }));
    container.append(section);
    return;
  }

  const validation = validateEventDraftBody(store.getCurrent(), mapId, ev);
  const activePageIssues = eventDraftIssuesForPage(validation, activePage.id);
  const commandHistory = createCommandToolbarHistory({
    key: `${mapId}:${ev.id}:${activePage.id}`,
    readCommands: () => activePageCommands(mapId, ev.id, activePage.id),
    replaceCommands: (commands) => replaceEventPageCommands(mapId, ev.id, activePage.id, commands),
  });
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
  setCommandInspectorHost(inspectorColumn);
  resetCommandInspectorView();
  // 자리표시자 머리글은 명령 렌더보다 **먼저** 붙인다. 나중에 붙이면 선택이 복원된
  // 인스펙터 본문 **아래로** 「선택한 명령」 머리글이 밀려 들어간다.
  inspectorColumn.append(columnLabel("inspector", "선택한 명령", "명령을 고르면 여기에서 고칩니다"));

  // 보기 방식·검색어는 이 이벤트를 편집하는 동안 살아 있어야 한다. 스토어가 바뀌면
  // modal.ts 가 본문을 통째로 다시 그리는데, 그때 localStorage 만 읽으면 미리보기가
  // 저장된 저작 보기로 튕겨 나간다.
  beginEventViewSession(`${mapId}:${ev.id}`);
  const storyboardMode = currentStoryboardMode();
  const cmdList = el("div", { class: "cmd-list" });
  renderCommandList(cmdList, activePage.commands, [], actions, {
    issues: activePageIssues,
    runtimeSupport: (command) => commandRuntimeSupport(command, "map"),
    pickerContext: "map",
  });
  cmdList.querySelector(".empty-hint")?.remove();
  cmdList.append(renderEmptyCommandLine(actions, activePage.commands.length === 0, mapId, ev.id));
  cmdList.addEventListener("dblclick", (event) => {
    if (event.target === cmdList) {
      cmdList.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')?.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    }
  });
  const storyboardHost = el("div", { class: "event-storyboard-host", dataset: { testid: "event-storyboard-host" } });
  // AI 초안은 목록을 덮는 오버레이도, 도크 안의 별도 카드도 아니다 — **목록이 있던 자리에**
  // 같은 카드 모양으로 그린다. 그래서 cmdList 바로 앞에 살고, 초안이 있는 동안만 목록과 자리를 바꾼다.
  const stagedHost = el("div", {
    class: "cmd-staged-host",
    dataset: { testid: "ai-event-staged-host" },
  });
  const previewHost = el("div", {
    class: "event-page-preview-host",
    dataset: { testid: "event-page-preview-host" },
  });
  let currentMode: StoryboardMode = storyboardMode;
  // 스토리 보기의 선택도 목록과 **같은** 인스펙터를 채운다. 예전에는 카드 한 번 클릭이
  // 곧바로 편집 모달을 열어서, 기본 보기인 스토리에서는 오른쪽 「선택한 명령」 칼럼이
  // 영원히 비어 있고 툴바의 이동/복사가 대상을 찾지 못했다.
  const selectStoryboardCommand = (path: number[]): void => {
    const cmd = resolveCommandAtPath(activePage.commands, path);
    if (!cmd) return;
    showCommandInspector({ command: cmd, path, actions });
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
  const makeStoryboard = () =>
    renderStoryboard(activePage.commands, {
      onSelect: selectStoryboardCommand,
      onOpenEditor: openStoryboardEditor,
      onMove: (path, direction) => actions.moveCommand(path, direction),
      onDelete: (path) => actions.deleteCommand(path),
      onAddNext: () => openCommandPickerForActions(actions),
      // 빈 이벤트 CTA: 말하기 / 장소 옮기기 / 상점 열기는 피커를 거치지 않고 바로 편집면으로.
      onQuickStart: (kind) => {
        openNewEventCommandDialog(newCommand(kind), (command) => actions.addCommand([], command));
      },
      selectedPath: selectedCommandPath(),
    });
  let storyboardEl = makeStoryboard();
  const changeMode = (next: StoryboardMode): void => {
    currentMode = next;
    setStoryboardMode(next);
    applyViewMode();
  };
  let viewToggle = renderViewToggle(currentMode, changeMode);
  // 툴바가 아직 없는 시점에도 applyViewMode 가 안전하게 호출되도록 기본값은 빈 함수다.
  let syncToolbarState: () => void = () => {};
  function applyViewMode(): void {
    const isPreview = currentMode === "preview";
    const isStoryboard = currentMode === "storyboard";
    // 적용 대기 중인 AI 초안이 있으면 목록 자리를 초안이 쓴다. 렌더 순서와 무관하게 같은 답이
    // 나와야 하므로 DOM 이 아니라 aiAssist 의 모듈 상태를 읽는다.
    const isStaged = hasEventAiStagedDraft(mapId, eventId, activePage.id);
    cmdList.hidden = isStoryboard || isPreview || isStaged;
    stagedHost.hidden = isStoryboard || isPreview || !isStaged;
    storyboardEl.hidden = !isStoryboard;
    previewHost.hidden = !isPreview;
    const nextToggle = renderViewToggle(currentMode, changeMode);
    viewToggle.replaceWith(nextToggle);
    viewToggle = nextToggle;
    if (isStoryboard) {
      const fresh = makeStoryboard();
      storyboardEl.replaceWith(fresh);
      storyboardEl = fresh;
      storyboardEl.hidden = false;
      // 재렌더/보기 전환 뒤에도 선택한 명령이 인스펙터에 남아 있어야 한다.
      const restored = selectedCommandPath();
      if (restored) selectStoryboardCommand([...restored]);
    } else {
      storyboardEl.replaceChildren();
    }
    if (isPreview) {
      previewHost.replaceChildren(renderEventPagePreview({ mapId, eventId, page: activePage }));
    } else {
      previewHost.replaceChildren();
    }
    syncToolbarState();
  }
  storyboardHost.append(storyboardEl);

  // NPC 연결 컨트롤은 삭제된 `display: none` identity 카드 안에 살았다 — 이제 그 주제가 속한
  // 「NPC와 일정」 그룹에서 사용자가 실제로 보고 누를 수 있다.
  const characterLink = renderEventCharacterIdField(mapId, ev);
  const socialExtras = renderEventCharacterSocialExtras(mapId, ev);
  const scheduleEditor = renderEventScheduleEditor(mapId, ev);
  const pageSettings = renderEventPageProps(mapId, ev.id, activePage, ev);
  const npcName = ev.characterId
    ? store.getCurrent().characters?.[ev.characterId]?.displayName?.trim() || ev.characterId
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
  // 선택이 바뀌면(목록·스토리 어느 쪽이든) 편집 버튼 상태를 즉시 다시 계산한다.
  setCommandSelectionListener(() => syncToolbarState());
  applyViewMode();
  commandsColumn.append(
    columnLabel(
      "commands",
      "이 페이지가 하는 일",
      "위에서 아래로 차례대로 실행됩니다",      el("span", {
        class: "event-editor-column-count",
        text: `${totalCommandCount(activePage.commands)}개`,
        dataset: { testid: "event-editor-command-count" },
      }),
    ),
    el("fieldset", {
      class: "event-oprn-fieldset event-contents-fieldset",
      attrs: { "aria-label": "이 페이지가 하는 일" },
      dataset: { testid: "event-script-canvas" },
      children: [
        commandToolbar.element,
        storyboardHost,
        previewHost,
        stagedHost,
        cmdList,
      ],
    }),
    // AI 작성기는 목록을 덮는 오버레이가 아니라 칼럼 맨 아래 도크다 — 삽입 위치가 계속 보인다.
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
      children: [renderClassicPageTabStrip(mapId, ev, activePage), renderPageTabs(mapId, ev, activePage)],
    }),
    workbench,
  );
  container.append(section);
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
};

/**
 * 명령 검색은 노드 **자기** 요약문만 본다. `textContent` 를 그대로 쓰면 분기를 품은
 * 부모가 자식 텍스트까지 삼켜서 "일치 개수" 가 부풀고, 어떤 줄이 진짜 맞았는지 알 수 없다.
 */
function ownRowText(node: HTMLElement): string {
  const chunks: string[] = [];
  for (const child of Array.from(node.children) as HTMLElement[]) {
    if (child.classList?.contains("cmd-head")) return child.textContent ?? "";
    if (child.classList?.contains("kind") || child.classList?.contains("line")) {
      chunks.push(child.textContent ?? "");
    }
  }
  return chunks.length > 0 ? chunks.join(" ") : (node.textContent ?? "");
}

/**
 * 한 표시면을 걸러내고 일치 개수를 돌려준다.
 * 부모를 숨기면 일치한 자식이 함께 사라지므로, 일치한 줄의 조상 줄은 항상 남긴다.
 */
function filterCommandSurface(surface: HTMLElement, query: string): number {
  const rows = Array.from(surface.querySelectorAll<HTMLElement>("[data-cmd-path]"));
  const branchGroups = Array.from(surface.querySelectorAll<HTMLElement>(".event-storyboard-branches"));
  if (query.length === 0) {
    for (const row of rows) row.hidden = false;
    for (const group of branchGroups) group.hidden = false;
    return rows.length;
  }
  // 경로로 조상을 찾는다. 스토리 보기는 분기 줄을 카드의 **형제**로 놓기 때문에
  // DOM 조상 추적만으로는 부모 카드를 못 찾고, 부모를 숨겨 일치한 자식이 고아가 된다.
  const byPath = new Map<string, HTMLElement>();
  for (const row of rows) {
    if (row.dataset.cmdPath) byPath.set(row.dataset.cmdPath, row);
  }
  const keep = new Set<HTMLElement>();
  let matches = 0;
  for (const row of rows) {
    if (!ownRowText(row).toLocaleLowerCase("ko").includes(query)) continue;
    matches += 1;
    keep.add(row);
    // 명령 경로는 [명령, 분기, 명령, 분기, …] 로 번갈아 놓인다 — 조상 명령은 홀수 길이 접두어다.
    const path = parseCommandPath(row.dataset.cmdPath);
    if (path) {
      for (let length = 1; length < path.length; length += 2) {
        const ancestor = byPath.get(JSON.stringify(path.slice(0, length)));
        if (ancestor) keep.add(ancestor);
      }
    }
    // 중첩이 DOM 으로 표현된 표시면(목록)도 함께 지지한다.
    let parent = row.parentElement;
    while (parent && parent !== surface) {
      if (parent.dataset?.cmdPath) keep.add(parent);
      parent = parent.parentElement;
    }
  }
  for (const row of rows) row.hidden = !keep.has(row);
  // 남은 줄이 하나도 없는 분기 묶음은 제목만 떠 있게 두지 않는다.
  for (const group of branchGroups) {
    group.hidden = Array.from(group.querySelectorAll<HTMLElement>("[data-cmd-path]"))
      .every((row) => row.hidden);
  }
  return matches;
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
function makePopoverEscapable(details: HTMLDetailsElement): void {
  details.addEventListener("toggle", () => {
    if (details.open) registerModal(details, () => { details.open = false; });
    else unregisterModal(details);
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
  const moveUp = toolbarButton("↑", "위로 이동", "event-command-toolbar-move-up", () => runForSelected((path) => actions.moveCommand(path, -1)));
  const moveDown = toolbarButton("↓", "아래로 이동", "event-command-toolbar-move-down", () => runForSelected((path) => actions.moveCommand(path, 1)));
  const copyButton = toolbarButton("▣", "복사", "event-command-toolbar-copy", () => runForSelected((path) => commandHistory.copySelected(path)));
  const cutButton = toolbarButton("✂", "잘라내기", "event-command-toolbar-cut", () => runForSelected((path) => commandHistory.cutSelected(path, actions)));
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
    editTarget.textContent = `${humanIndex}번째 ${command ? commandKindLabel(command.kind) : "명령"}에 적용됩니다.`;
    editTarget.dataset.state = "selected";
    setDisabled(moveUp, !bounds.canUp);
    setDisabled(moveDown, !bounds.canDown);
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
  const toolsMenu = renderEventToolsMenu(mapId, eventId, page);
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
    text: "×",
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

  /** 검색은 두 표시면(목록·스토리) 모두에 같은 조건으로 걸린다. */
  function applySearch(): void {
    const query = currentCommandQuery().trim().toLocaleLowerCase("ko");
    const isPreview = options.currentMode() === "preview";
    // 미리보기에는 걸러낼 줄이 없다 — 못 하는 일을 할 수 있는 척하지 않는다.
    commandSearch.disabled = isPreview;
    commandSearch.title = isPreview ? "미리보기에서는 검색할 수 없습니다. 목록이나 스토리로 바꾸세요." : "명령 검색";
    searchClear.hidden = query.length === 0;
    const listMatches = filterCommandSurface(cmdList, query);
    const storyMatches = filterCommandSurface(options.storyboardEl(), query);
    if (query.length === 0 || isPreview) {
      searchCount.textContent = "";
      delete searchCount.dataset.state;
      return;
    }
    const matches = options.currentMode() === "storyboard" ? storyMatches : listMatches;
    searchCount.textContent = matches > 0 ? `${matches}개 일치` : "일치 없음";
    searchCount.dataset.state = matches > 0 ? "hit" : "miss";
  }
  commandSearch.addEventListener("input", () => {
    setCommandQuery(commandSearch.value);
    applySearch();
  });

  const element = el("div", {
    class: "toolbar event-editor-command-toolbar",
    attrs: { "aria-label": "이 페이지가 하는 일 도구" },
    children: [
      toolbarButton("+", "명령", "event-command-toolbar-add", () => {
        openCommandPickerForActions(actions);
      }, false, true),
      el("div", {
        class: "event-editor-command-search-field",
        children: [commandSearch, searchClear, searchCount],
      }),
      toolbarButton("↶", "되돌리기", "event-command-toolbar-undo", () => commandHistory.undo(), !commandHistory.canUndo()),
      toolbarButton("↷", "다시 실행", "event-command-toolbar-redo", () => commandHistory.redo(), !commandHistory.canRedo()),
      editTools,
      toolsMenu,
      ...(viewToggle ? [viewToggle] : []),
      renderCommandAuxGroup(aiDock),
    ],
  });
  return {
    element,
    sync: () => {
      applySearch();
      syncEditTools();
    },
  };
}

function renderCommandAuxGroup(aiDock?: HTMLDetailsElement): HTMLElement {
  // 도크가 있으면 그 조상을 통해 칼럼을 집는다 — 에디터 본문이 동시에 다수 마운트되도 섞이지 않는다.
  const commandsColumn = (): HTMLElement | null =>
    aiDock?.closest(".event-editor-commands-column") ?? document.querySelector(".event-editor-commands-column");
  const open = (selector: string): void => {
    const column = commandsColumn();
    const tools = column?.querySelector<HTMLDetailsElement>("[data-testid='event-editor-aux-tools']");
    const details = column?.querySelector<HTMLDetailsElement>(selector);
    if (!details) return;
    if (tools) tools.open = true;
    details.open = true;
    details.scrollIntoView({ block: "nearest" });
  };
  // AI 도크는 팝오버 밖에 살므로 도구 메뉴를 열지 않고 자기만 토글한다.
  // aria-expanded 는 도크의 toggle 이 단일 진상이다 — Escape 나 재렌더 로 닫혀도 어긋나지 않는다.
  const aiButton = aiDock ? toolbarButton("✧", "AI 명령", "event-command-quick-ai") : null;
  if (aiDock && aiButton) {
    const syncAiExpanded = (): void => aiButton.setAttribute("aria-expanded", String(aiDock.open));
    syncAiExpanded();
    aiDock.addEventListener("toggle", syncAiExpanded);
    aiButton.addEventListener("click", () => {
      aiDock.open = !aiDock.open;
      if (aiDock.open) aiDock.scrollIntoView({ block: "nearest" });
    });
  }
  return el("div", {
    class: "event-editor-command-aux-group",
    attrs: { role: "group", "aria-label": "보조 도구" },
    // «▶ 미리보기» 버튼은 없다. 보기 방식 세그먼트(`event-view-toggle-preview`)와 같은
    // `changeMode("preview")` 로 들어가는 중복 컨트롤이었고, 같은 라벨로 나란히 서 있었다.
    // 미리보기는 세그먼트가 소유한다. 플로우는 팝오버를 여는 별개 동작이라 남는다.
    children: [
      ...(aiButton ? [aiButton] : []),
      toolbarButton("⌘", "플로우 보기", "event-command-quick-flow", () => open("[data-testid='event-script-flowchart']")),
    ],
  });
}

function renderEventToolsMenu(
  mapId: MapId,
  eventId: string,
  page: EventPage
): HTMLDetailsElement {
  const auxTools = el("div", {
    class: "event-editor-command-tools-popover event-editor-aux-tools",
    children: [
      renderEventScriptFlowchart({ mapId, eventId, page }),
      renderFollowerPresetBar({
        insertCommandsAt: (index, commands) => {
          for (let i = 0; i < commands.length; i += 1) {
            insertEventPageCommandAt(mapId, eventId, page.id, [index + i], commands[i]!);
          }
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
  icon: string,
  label: string,
  testId: string,
  onClick?: () => void,
  disabled = false,
  primary = false,
  title: string = label
): HTMLButtonElement {
  return el("button", {
    class: "event-editor-command-tool" + (primary ? " primary" : ""),
    text: `${icon} ${label}`,
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

function activePageCommands(mapId: MapId, eventId: string, pageId: string): Command[] {
  return store.getCurrent().maps[mapId]?.events
    .find((event) => event.id === eventId)
    ?.pages?.find((page) => page.id === pageId)
    ?.commands ?? [];
}

/**
 * 개수 배지는 목록에 실제로 보이는 명령 줄을 센다 — 분기 속 명령도 포함한다.
 * 상위 명령만 세면 8줄이 보이는 페이지에 `4개` 라고 적혀 배지가 화면과 어긋난다.
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
): HTMLElement {
  const openPicker = () => openCommandPickerForActions(actions);
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
  }[] = [
    { label: "대사하는 NPC", templateId: "talking-npc", testId: "event-template-talking-npc" },
    { label: "보물상자", templateId: "treasure-chest", testId: "event-template-treasure-chest" },
    { label: "문/맵 이동", templateId: "transfer", testId: "event-template-transfer" },
    { label: "상점", templateId: "shop", testId: "event-template-shop" },
    { label: "전투 시작", templateId: "battle", testId: "event-template-battle" },
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

function openCommandPickerForActions(actions: CommandListActions): void {
  if (document.querySelector('[data-testid="event-command-picker"]')) return;
  openEventCommandPicker({
    title: "명령 추가",
    context: "map",
    // 명령을 고르면 피커를 먼저 닫는다. 편집 창이 피커 위에 쌓이면 확인이 뒤 창에 먹힌다.
    onSelect: (command) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        actions.addCommand([], editedCommand);
      });
    },
  });
}

export function openActiveEventCommandPicker(mapId: MapId, eventId: string): boolean {
  const pageId = activePageIdOf(mapId, eventId);
  if (!pageId || document.querySelector('[data-testid="event-command-picker"]')) return false;
  openEventCommandPicker({
    title: "명령 추가",
    context: "map",
    onSelect: (command) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        addEventPageCommand(mapId, eventId, pageId, editedCommand);
      });
    },
  });
  return true;
}
