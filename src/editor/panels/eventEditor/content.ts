import { editorState } from "@/editor/editorState";
import {
  buildEventBeginnerTemplate,
  type EventBeginnerTemplateId,
} from "@/editor/eventBeginnerTemplates";
import {
  eventDraftIssuesForPage,
  validateEventDraftBody,
  type EventDraftIssue,
  type EventDraftValidation,
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
import { renderEventAiAssist } from "./aiAssist";
import { auxCompositeKey, syncAuxHosts } from "./auxOpenController";
import { renderEventScriptModernViews } from "./eventScriptModernViews";
import { renderEventScheduleEditor } from "./eventScheduleEditor";
import { openEventCommandEditDialog, openNewEventCommandDialog } from "./commandEditDialog";
import { renderCommandList } from "./commandList";
import { loadStoryboardMode, renderStoryboard, renderViewToggle, type StoryboardMode } from "./storyboardView";
import { newCommand } from "@/editor/eventActions";
import { resetCommandInspectorView, setCommandInspectorHost } from "./commandInspector";
import { createCommandToolbarHistory, type CommandToolbarHistory } from "./commandToolbarHistory";
import { openEventCommandPicker } from "./commandPicker";
import { applyStoredSettingsColumnWidth, attachColumnResize } from "./layoutResize";
import {
  appendEventRailGroup,
  renderClassicPageTabStrip,
  renderEventCharacterSocialExtras,
  renderEventPageProps,
  renderPageCommandCatalog,
  renderPageTabs,
} from "./pageProps";
import type { CommandListActions } from "./types";
import { openFieldMonsterTemplateDialog } from "./fieldMonsterTemplateDialog";
import { renderFollowerPresetBar } from "./followerPresetPicker";
import { resolveCommandAtPath } from "@/editor/eventCommandPaths";

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

  const storyboardMode = loadStoryboardMode();
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
  let currentMode: StoryboardMode = storyboardMode;
  const makeStoryboard = () =>
    renderStoryboard(activePage.commands, {
      onSelect: (path) => {
        const cmd = resolveCommandAtPath(activePage.commands, path);
        if (!cmd) return;
        openEventCommandEditDialog({
          initial: cmd,
          lockKind: true,
          onApply: (edited) => actions.replaceCommand(path, edited),
        });
      },
      onAddNext: () => openCommandPickerForActions(actions),
      // 빈 이벤트 CTA: 말하기 / 장소 옮기기 / 상점 열기는 피커를 거치지 않고 바로 편집면으로.
      onQuickStart: (kind) => {
        openNewEventCommandDialog(newCommand(kind), (command) => actions.addCommand([], command));
      },
      onShowList: () => { currentMode = "list"; applyViewMode(); },
    });
  let storyboardEl = makeStoryboard();
  let viewToggle = renderViewToggle(currentMode, (next) => { currentMode = next; applyViewMode(); });
  function applyViewMode(): void {
    const isStoryboard = currentMode === "storyboard";
    cmdList.hidden = isStoryboard;
    storyboardEl.hidden = !isStoryboard;
    const nextToggle = renderViewToggle(currentMode, (n) => { currentMode = n; applyViewMode(); });
    viewToggle.replaceWith(nextToggle);
    viewToggle = nextToggle;
    if (isStoryboard) {
      const fresh = makeStoryboard();
      storyboardEl.replaceWith(fresh);
      storyboardEl = fresh;
      storyboardEl.hidden = false;
    } else {
      storyboardEl.replaceChildren();
    }
  }
  storyboardHost.append(storyboardEl);
  applyViewMode();
  const validationControl = renderEventValidationSummary(validation);

  const socialExtras = renderEventCharacterSocialExtras(mapId, ev);
  const scheduleEditor = renderEventScheduleEditor(mapId, ev);
  const pageSettings = renderEventPageProps(mapId, ev.id, activePage, ev);
  const npcName = ev.characterId
    ? store.getCurrent().characters?.[ev.characterId]?.displayName?.trim() || ev.characterId
    : "연결 안 됨";
  appendEventRailGroup(
    pageSettings,
    { slug: "npc", title: "NPC와 일정", summary: npcName, open: false },
    [socialExtras, scheduleEditor].filter((node): node is HTMLElement => node !== null),
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
  commandsColumn.append(
    columnLabel(
      "commands",
      "이 페이지가 하는 일",
      "위에서 아래로 차례대로 실행됩니다",      el("span", {
        class: "event-editor-column-count",
        text: `${activePage.commands.length}개`,
        dataset: { testid: "event-editor-command-count" },
      }),
    ),
    el("fieldset", {
      class: "event-oprn-fieldset event-contents-fieldset",
      attrs: { "aria-label": "이 페이지가 하는 일" },
      dataset: { testid: "event-script-canvas" },
      children: [
        renderCommandToolbar(cmdList, actions, commandHistory, mapId, ev.id, activePage, viewToggle),
        storyboardHost,
        cmdList,
      ],
    })
  );
  inspectorColumn.append(columnLabel("inspector", "선택한 명령", "명령을 고르면 여기에서 고칩니다"));

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
    ...(validationControl ? [validationControl] : [])
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

function renderCommandToolbar(
  cmdList: HTMLElement,
  actions: CommandListActions,
  commandHistory: CommandToolbarHistory,
  mapId: MapId,
  eventId: string,
  page: EventPage,
  viewToggle?: HTMLElement,
): HTMLElement {
  const selectedPath = (): number[] | null => {
    const selected = cmdList.querySelector<HTMLElement>(".selected, .is-selected");
    if (!selected?.dataset.cmdPath) return null;
    try {
      const path = JSON.parse(selected.dataset.cmdPath);
      return Array.isArray(path) && path.every((part) => Number.isInteger(part)) ? path : null;
    } catch {
      return null;
    }
  };
  const runForSelected = (run: (path: number[]) => void): void => {
    const path = selectedPath();
    if (path) run(path);
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
          toolGroup(
            toolbarButton("↑", "위로 이동", "event-command-toolbar-move-up", () => runForSelected((path) => actions.moveCommand(path, -1))),
            toolbarButton("↓", "아래로 이동", "event-command-toolbar-move-down", () => runForSelected((path) => actions.moveCommand(path, 1)))
          ),
          toolGroup(
            toolbarButton("▣", "복사", "event-command-toolbar-copy", () => runForSelected((path) => commandHistory.copySelected(path))),
            toolbarButton("✂", "잘라내기", "event-command-toolbar-cut", () => runForSelected((path) => commandHistory.cutSelected(path, actions)))
          ),
        ],
      }),
    ],
  });
  const toolsMenu = renderEventToolsMenu(cmdList, actions, mapId, eventId, page);
  const commandSearch = el("input", {
    class: "search event-editor-command-search",
    attrs: { type: "search", placeholder: "명령 검색", "aria-label": "명령 검색" },
    dataset: { testid: "event-command-search" },
  }) as HTMLInputElement;
  commandSearch.addEventListener("input", () => {
    const query = commandSearch.value.trim().toLocaleLowerCase("ko");
    const surface = cmdList.hidden ? cmdList.parentElement?.querySelector<HTMLElement>(".event-storyboard") : cmdList;
    surface?.querySelectorAll<HTMLElement>("[data-cmd-path]").forEach((node) => {
      node.hidden = query.length > 0 && !node.textContent?.toLocaleLowerCase("ko").includes(query);
    });
  });
  return el("div", {
    class: "toolbar event-editor-command-toolbar",
    attrs: { "aria-label": "이 페이지가 하는 일 도구" },
    children: [
      toolbarButton("+", "명령", "event-command-toolbar-add", () => {
        openCommandPickerForActions(actions);
      }, false, true),
      commandSearch,
      toolbarButton("↶", "되돌리기", "event-command-toolbar-undo", () => commandHistory.undo(), !commandHistory.canUndo()),
      toolbarButton("↷", "다시 실행", "event-command-toolbar-redo", () => commandHistory.redo(), !commandHistory.canRedo()),
      editTools,
      toolsMenu,
      ...(viewToggle ? [viewToggle] : []),
      renderCommandAuxGroup(),
    ],
  });
}

function renderCommandAuxGroup(): HTMLElement {
  const commandsColumn = (): HTMLElement | null => document.querySelector(".event-editor-commands-column");
  const open = (selector: string): void => {
    const column = commandsColumn();
    const tools = column?.querySelector<HTMLDetailsElement>("[data-testid='event-editor-aux-tools']");
    const details = column?.querySelector<HTMLDetailsElement>(selector);
    if (!details) return;
    if (tools) tools.open = true;
    details.open = true;
    details.scrollIntoView({ block: "nearest" });
  };
  return el("div", {
    class: "event-editor-command-aux-group",
    attrs: { role: "group", "aria-label": "보조 도구" },
    children: [
      toolbarButton("✧", "AI 명령", "event-command-quick-ai", () => open("[data-testid='ai-event-assist']")),
      toolbarButton("</>", "스크립트 보기", "event-command-quick-preview", () => open("[data-testid='event-script-live-preview']")),
      toolbarButton("⌘", "플로우 보기", "event-command-quick-flow", () => open("[data-testid='event-script-flowchart']")),
    ],
  });
}

function renderEventToolsMenu(
  cmdList: HTMLElement,
  actions: CommandListActions,
  mapId: MapId,
  eventId: string,
  page: EventPage
): HTMLElement {
  const auxTools = el("div", {
    class: "event-editor-command-tools-popover event-editor-aux-tools",
    children: [
      renderEventAiAssist({ mapId, eventId, page, actions, cmdList }),
      renderEventScriptModernViews({ mapId, eventId, page }),
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
        attrs: { title: "AI, 미리보기, 플로우와 특수 템플릿" },
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

function renderEmptyCommandLine(
  actions: CommandListActions,
  showBeginnerTemplates: boolean,
  mapId: MapId,
  eventId: string,
): HTMLElement {
  const openPicker = () => openCommandPickerForActions(actions);
  const line = el("button", {
    class: "cmd-empty-line",
    text: "명령 추가 — 더블클릭 또는 위 [+ 명령]",
    attrs: { type: "button", title: "더블클릭해서 명령을 추가" },
    dataset: { testid: "event-command-empty-line" },
    on: {
      dblclick: (event) => {
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

function renderEventValidationSummary(validation: EventDraftValidation): HTMLDetailsElement | null {
  if (validation.issues.length === 0) return null;
  const parts: string[] = [];
  if (validation.errorCount > 0) parts.push(`오류 ${validation.errorCount}`);
  if (validation.warningCount > 0) parts.push(`경고 ${validation.warningCount}`);
  if (validation.infoCount > 0) parts.push(`안내 ${validation.infoCount}`);
  const label = parts.join(" · ");
  const details = el("details", {
    class: `event-draft-validation${validation.errorCount > 0 ? " has-errors" : validation.warningCount > 0 ? " has-warnings" : " has-info"}`,
    dataset: { testid: "event-draft-validation" },
  }) as HTMLDetailsElement;
  details.append(
    el("summary", {
      class: "event-draft-validation-summary",
      dataset: { testid: "event-draft-validation-summary" },
      text: label,
      attrs: { "aria-label": label },
    }),
    el("div", {
      class: "event-draft-validation-issues",
      children: validation.issues.map((issue, index) => el("button", {
        class: `event-draft-validation-issue ${issue.severity}`,
        attrs: { type: "button" },
        dataset: {
          testid: `event-draft-validation-issue-${index}`,
          issueCode: issue.code,
          severity: issue.severity,
        },
        children: [
          el("span", { class: "event-draft-validation-severity", text: validationSeverityLabel(issue.severity) }),
          el("span", { class: "event-draft-validation-message", text: issue.message }),
        ],
        on: { click: () => navigateToEventDraftIssue(issue) },
      })),
    })
  );
  return details;
}

export function navigateToEventDraftIssue(issue: EventDraftIssue): void {
  if (issue.pageId) editorState.set({ selectedEventPageId: issue.pageId });
  const focusIssue = (): void => {
    const modal = document.querySelector<HTMLElement>('[data-testid="event-editor-modal"]');
    const root = modal ?? document.body;
    let target: HTMLElement | null = null;
    if (issue.commandPath) {
      const encoded = JSON.stringify(issue.commandPath);
      target = Array.from(root.querySelectorAll<HTMLElement>(".cmd-item, .row, .leaf"))
        .find((candidate) => candidate.dataset.cmdPath === encoded) ?? null;
      if (target) {
        root.querySelectorAll(".cmd-item.selected, .row.selected, .leaf.selected").forEach((node) => node.classList.remove("selected", "is-selected"));
        target.classList.add("selected", "is-selected");
        target = target.querySelector<HTMLElement>(".cmd-head, .line") ?? target;
      }
    }
    if (!target && issue.field) {
      target = root.querySelector<HTMLElement>(`[data-testid="${issue.field.testId}"]`);
    }
    if (!target) return;
    for (let ancestor: HTMLElement | null = target; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === "DETAILS") (ancestor as HTMLDetailsElement).open = true;
    }
    if (target.getAttribute("tabindex") === null && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/u.test(target.tagName)) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: "center", inline: "nearest" });
  };
  focusIssue();
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(focusIssue);
  }
}

function validationSeverityLabel(severity: EventDraftIssue["severity"]): string {
  if (severity === "error") return "오류";
  if (severity === "warning") return "경고";
  return "안내";
}
