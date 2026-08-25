import { editorState } from "@/editor/editorState";
import { moveEvent } from "@/editor/eventActions";
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
import type { Command, EventPage, GameEvent, MapId } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";
import { renderEventGraphicIcon } from "./eventGraphicPreview";
import { renderEventAiAssist } from "./aiAssist";
import { auxCompositeKey, syncAuxHosts } from "./auxOpenController";
import { renderEventScriptModernViews } from "./eventScriptModernViews";
import { renderEventScheduleEditor } from "./eventScheduleEditor";
import { openNewEventCommandDialog } from "./commandEditDialog";
import { renderCommandList } from "./commandList";
import { loadStoryboardMode, renderStoryboard, renderViewToggle, type StoryboardMode } from "./storyboardView";
import { resetCommandInspectorView, setCommandInspectorHost, showCommandInspector } from "./commandInspector";
import { createCommandToolbarHistory, type CommandToolbarHistory } from "./commandToolbarHistory";
import { openEventCommandPicker } from "./commandPicker";
import { branchesOf } from "./previewSimulation";
import { applyStoredSettingsColumnWidth, attachColumnResize } from "./layoutResize";
import {
  renderClassicPageTabStrip,
  renderEventCharacterIdField,
  renderEventCharacterSocialExtras,
  renderEventNameControl,
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
    // Autosave/replace races must never blank the open editor — restore from vault once.
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
  // 목업의 우측 인스펙터. 명령을 클릭하면 편집 폼이 그 자리에서 열린다(모달 없음).
  // 리스트를 렌더하기 "전에" 호스트를 붙여야, 재렌더 시 선택된 명령의 인스펙터가 복원된다.
  const inspectorColumn = el("div", {
    class: "event-editor-inspector-column",
    dataset: { testid: "event-editor-inspector" },
  });
  setCommandInspectorHost(inspectorColumn);
  resetCommandInspectorView();

  const storyboardMode = loadStoryboardMode();
  const cmdList = el("div", { class: "cmd-list" });
  // 맵 이벤트 편집기 — 배지/삽입 피커 모두 맵 컨텍스트 판정을 쓴다.
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
        showCommandInspector({ command: cmd, path, actions });
      },
      // 장면 추가는 뷰를 갈아타지 않고 그 자리에서 명령 피커를 연다 (적대 평가 스펙).
      onAddNext: () => openCommandPickerForActions(actions),
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
    }
  }
  storyboardHost.append(storyboardEl);
  applyViewMode();
  const validationControl = renderEventValidationSummary(validation);
  const commandHeader = el("div", {
    class: "event-editor-command-header",
    dataset: { testid: "event-command-header" },
    children: [
      el("span", {
        class: "event-contents-legend",
        text: `이 페이지가 하는 일 · ${countAllCommands(activePage.commands)}개`,
      }),
      ...(validationControl ? [validationControl] : []),
    ],
  });
  // settings-column 그리드는 [페이지탭 54px | 본문 1fr] 2칸.
  // Tool-authored NPC schedules stay compact, but existing rows are editable so
  // aggregate validation can navigate to and repair their map/coordinate errors.
  const socialExtras = renderEventCharacterSocialExtras(mapId, ev);
  const scheduleEditor = renderEventScheduleEditor(mapId, ev);
  const settingsChildren = [
    socialExtras,
    scheduleEditor,
    renderEventPageProps(mapId, ev.id, activePage, ev),
  ].filter((node): node is HTMLElement => node !== null);
  const settingsMain = el("div", {
    class: "event-editor-settings-main",
    children: settingsChildren,
  });
  // 페이지 탭은 좌측 컬럼이 아니라 상단 전폭 스트립으로 나간다(아래 section.append).
  // 좁은 컬럼 안에서는 조건 요약을 읽을 폭이 나오지 않는다.
  const pageTabStrip = renderClassicPageTabStrip(mapId, ev, activePage, validation);

  // 목업의 이벤트 카드 — 레일 상단의 시선 진입점.
  // 스프라이트 실물 + 이름/캐릭터 ID + 좌표를 한 덩어리로 묶는다.
  // top-strip 을 카드 안에 넣는 이유: 이름·캐릭터 ID 가 top-strip 안에 있어야 한다는
  // 기존 계약(eventEditorSettingsLayout.test)을 유지하면서 배치만 목업에 맞추기 위함.
  const characterRelationship = renderEventCharacterIdField(mapId, ev);
  const eventCard = el("div", {
    class: "event-editor-card",
    dataset: { testid: "event-editor-card" },
    children: [
      el("div", {
        class: "event-editor-card-sprite",
        attrs: { "aria-hidden": "true" },
        children: [renderEventGraphicIcon(activePage.graphic, { scale: 2 })],
      }),
      el("div", {
        class: "event-editor-card-meta",
        children: [
          el("div", {
            class: "event-editor-top-strip",
            children: [renderEventNameControl(mapId, ev.id, activePage, ev, characterRelationship)],
          }),
          el("div", {
            class: "event-editor-id-row",
            dataset: { testid: "event-editor-id-row" },
            children: [
              renderEventPositionControls(mapId, ev),
            ],
          }),
        ],
      }),
    ],
  });
  settingsColumn.append(settingsMain);
  commandsColumn.append(
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

  const workbench = el("div", {
    class: `event-editor-workbench${inspectorColumn.hidden ? "" : " has-command-inspector"}`,
    children: [settingsColumn, columnResizer, commandsColumn, inspectorColumn],
  });
  applyStoredSettingsColumnWidth(workbench);
  attachColumnResize(columnResizer, workbench);

  section.append(
    eventCard,
    // 페이지 전환, 상태, 보기 전환은 한 줄에 두고 워크벤치가 남은 높이를 전부 갖는다.
    el("div", {
      class: "event-editor-pagebar",
      children: [pageTabStrip, renderPageTabs(mapId, ev, activePage), commandHeader],
    }),
    workbench
  );
  container.append(section);
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
    const selected = cmdList.querySelector<HTMLElement>(".selected");
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
            toolbarButton("↶", "되돌리기", "event-command-toolbar-undo", () => commandHistory.undo(), !commandHistory.canUndo()),
            toolbarButton("↷", "다시 실행", "event-command-toolbar-redo", () => commandHistory.redo(), !commandHistory.canRedo())
          ),
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
  return el("div", {
    class: "event-editor-command-toolbar",
    attrs: { "aria-label": "이 페이지가 하는 일 도구" },
    children: [
      toolbarButton(
        "+",
        "명령 추가",
        "event-command-toolbar-add",
        () => {
          if (openActiveEventCommandPicker(mapId, eventId)) return;
          cmdList
            .querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')
            ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
        },
        false,
        true
      ),
      editTools,
      toolsMenu,
      ...(viewToggle ? [viewToggle] : []),
    ],
  });
}

// 이 페이지가 하는 일 헤더의 전체 명령 수 — 분기 안까지 센다.
function countAllCommands(commands: readonly Command[]): number {
  let n = 0;
  const walk = (cmd: Command): void => {
    n += 1;
    for (const branch of branchesOf(cmd)) branch.commands.forEach(walk);
  };
  commands.forEach(walk);
  return n;
}

function renderEventToolsMenu(
  cmdList: HTMLElement,
  actions: CommandListActions,
  mapId: MapId,
  eventId: string,
  page: EventPage
): HTMLDetailsElement {
  const menu = el("details", {
    class: "event-editor-command-tools-menu",
    dataset: { testid: "event-editor-aux-tools" },
    children: [
      el("summary", {
        class: "event-editor-command-tools-summary",
        text: "도구",
        attrs: { title: "AI, 미리보기, 플로우와 특수 템플릿" },
      }),
      el("div", {
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
      }),
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

function toolbarButton(
  text: string,
  title: string,
  testId: string,
  onClick?: () => void,
  disabled = false,
  primary = false
): HTMLButtonElement {
  const label = title.split(" ")[0] ?? title;
  return el("button", {
    class: "event-editor-command-tool" + (primary ? " primary" : ""),
    text: `${text} ${label}`,
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
    text: "명령 추가 — 더블클릭 또는 아래 템플릿에서 시작",
    attrs: { type: "button", title: "더블클릭해서 이벤트 명령을 추가" },
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
    title: "이벤트 명령",
    context: "map",
    onSelect: (command, closePicker) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        actions.addCommand([], editedCommand);
        closePicker();
      });
      return { closePicker: false };
    },
  });
}

export function openActiveEventCommandPicker(mapId: MapId, eventId: string): boolean {
  const pageId = activePageIdOf(mapId, eventId);
  if (!pageId || document.querySelector('[data-testid="event-command-picker"]')) return false;
  openEventCommandPicker({
    title: "이벤트 명령",
    context: "map",
    onSelect: (command, closePicker) => {
      openNewEventCommandDialog(command, (editedCommand) => {
        addEventPageCommand(mapId, eventId, pageId, editedCommand);
        closePicker();
      });
      return { closePicker: false };
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
      target = Array.from(root.querySelectorAll<HTMLElement>(".cmd-item"))
        .find((candidate) => candidate.dataset.cmdPath === encoded) ?? null;
      if (target) {
        root.querySelectorAll(".cmd-item.selected").forEach((node) => node.classList.remove("selected"));
        target.classList.add("selected");
        target = target.querySelector<HTMLElement>(".cmd-head") ?? target;
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

function renderEventPositionControls(mapId: MapId, event: GameEvent): HTMLElement {
  const map = store.getCurrent().maps[mapId];
  const coordinateInput = (axis: "x" | "y", value: number): HTMLInputElement => el("input", {
    class: "event-position-input",
    attrs: {
      type: "number",
      value: String(value),
      step: "1",
      min: "0",
      max: String(Math.max(0, (axis === "x" ? map?.width : map?.height) ?? 1) - 1),
      "aria-label": `이벤트 ${axis.toUpperCase()} 좌표`,
    },
    dataset: { testid: `event-position-${axis}` },
  }) as HTMLInputElement;
  const x = coordinateInput("x", event.x);
  const y = coordinateInput("y", event.y);
  const clamp = (input: HTMLInputElement, raw: number, maxExclusive: number): number => {
    const bounded = Math.min(Math.max(Math.trunc(raw), 0), Math.max(0, maxExclusive - 1));
    if (bounded !== Math.trunc(raw)) {
      input.value = String(bounded);
      input.classList.add("is-clamped");
      input.title = `맵 범위(0~${Math.max(0, maxExclusive - 1)})로 조정됐어요`;
      window.setTimeout(() => input.classList.remove("is-clamped"), 1200);
    }
    return bounded;
  };
  const apply = (): void => {
    const nextX = Number(x.value);
    const nextY = Number(y.value);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) return;
    moveEvent(
      mapId,
      event.id,
      clamp(x, nextX, map?.width ?? 1),
      clamp(y, nextY, map?.height ?? 1)
    );
  };
  x.addEventListener("change", apply);
  y.addEventListener("change", apply);
  return el("span", {
    class: "event-position-controls",
    dataset: { testid: "event-position-controls" },
    children: [
      el("label", { children: [el("span", { text: "X" }), x] }),
      el("label", { children: [el("span", { text: "Y" }), y] }),
    ],
  });
}


