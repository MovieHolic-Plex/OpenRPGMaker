/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { activeEventRailGroup, openEventConditions, openEventMovement } from "@/editor/panels/eventEditor/eventEditorOpenState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";

function basePage(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "p1",
    name: "약초꾼",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "same",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [
      {
        kind: "changeFace",
        resourceId: "easyrpg-faceset-people1-00",
        position: "left",
        flipHorizontally: false,
      },
      { kind: "text", body: "숲 가장자리에 약초가 나." },
    ],
    ...overrides,
  };
}

function baseEvent(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: "ev_herbalist",
    x: 12,
    y: 24,
    trigger: { kind: "action" },
    commands: [],
    pages: [basePage()],
    ...overrides,
  };
}

function selectGroup(host: HTMLElement, slug: string): HTMLElement {
  const group = host.querySelector<HTMLElement>(`[data-testid="evt-rail-group-${slug}"]`);
  const button = group?.querySelector<HTMLButtonElement>("button");
  if (!group || !button) throw new Error("missing settings group");
  button.click();
  expect(button.getAttribute("aria-expanded")).toBe("true");
  expect(group.classList.contains("is-open")).toBe(true);
  expect(host.querySelectorAll(".event-editor-settings-accordion-group.is-open")).toHaveLength(1);
  return group;
}

describe("event editor UI density", () => {
  let host: HTMLElement;

  beforeEach(() => {
    clearCommandInspector();
    openEventConditions.clear();
    openEventMovement.clear();
    activeEventRailGroup.clear();
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [baseEvent()];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    clearCommandInspector();
    host.remove();
    openEventConditions.clear();
    openEventMovement.clear();
  });

  it("keeps page actions in the pagebar; the body carries the page-name field (the header box is the event name)", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const nameField = host.querySelector('[data-testid="event-classic-name"]');
    expect(nameField?.textContent).toContain("페이지 이름");
    expect(host.querySelector(".event-editor-pagebar")).not.toBeNull();

    expect(host.querySelector('[data-testid="evt-page-add"]')).not.toBeNull();
    expect(host.querySelector('[data-testid="event-page-copy"]')).not.toBeNull();
    expect(host.querySelector<HTMLButtonElement>('[data-testid="event-page-delete"]')?.disabled).toBe(true);
    host.querySelector<HTMLButtonElement>('[data-testid="evt-page-add"]')?.click();
    expect(store.getCurrent().maps[store.getCurrent().startMapId]?.events[0]?.pages).toHaveLength(2);
  });

  it("does not mount NPC schedule on the classic RM event shell", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    expect(host.querySelector('[data-testid="event-schedule-section"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-schedule-json"]')).toBeNull();
  });

  it("defaults secondary settings and tools closed while keeping trigger and add command visible", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const conditions = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-conditions"]');
    expect(conditions?.tagName).toBe("DIV");
    expect(host.querySelector('[data-testid="evt-rail-group-when"]')?.classList.contains("is-open")).toBe(false);
    expect(host.querySelector('[data-testid="event-condition-summary-empty"]')?.textContent).toBe("항상");

    const movement = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-movement-section"]');
    expect(movement?.tagName).toBe("DIV");
    // Nested movement controls exist in DOM but are not always-visible chrome.
    expect(host.querySelector('[data-testid="event-classic-graphic"]')).toBeTruthy();

    // P0: trigger lives outside the closed movement section and is always visible.
    const triggerSelect = host.querySelector('[data-testid="event-page-trigger-select"]');
    const classicTrigger = host.querySelector('[data-testid="event-classic-trigger"]');
    expect(triggerSelect).toBeTruthy();
    expect(classicTrigger).toBeTruthy();
    expect(movement?.contains(triggerSelect)).toBe(false);
    expect(movement?.contains(classicTrigger)).toBe(false);
    expect(host.querySelector('[data-testid="event-page-trigger-priority-stack"]')).toBeTruthy();

    // NPC relationship status is always actionable; only technical fields stay hidden until linked.
    expect(host.querySelector('[data-testid="event-character-id-field"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-character-id-connect"]')?.textContent).toContain("연결 안 됨");
    expect(host.querySelector('[data-testid="event-character-id-input"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-friendship-requires-character-id"]')).toBeNull();

    const contents = host.querySelector('[data-testid="event-script-canvas"]');
    const toolbar = contents?.querySelector(".event-editor-command-toolbar");
    const toolsMenu = host.querySelector<HTMLDetailsElement>('[data-testid="event-editor-aux-tools"]');
    expect(toolbar).toBeTruthy();
    expect(toolbar?.contains(toolsMenu ?? null)).toBe(true);
    expect(host.querySelector(".event-editor-command-tool-group")).toBeTruthy();
    expect(host.querySelector('[data-testid="event-command-toolbar-add"]')?.classList.contains("primary")).toBe(true);
    expect(host.querySelector<HTMLDetailsElement>('[data-testid="event-command-edit-menu"]')?.open).toBe(false);
    expect(toolsMenu?.open).toBe(false);
    expect(host.querySelector('[data-testid="event-command-legend-details"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-command-legend"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-ai-next-steps"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-tabs"]')).not.toBeNull();
    // 검토 알림은 모달 헤더의 종이 소유한다 — 편집면 아래쪽에는 남지 않는다.
    expect(host.querySelector('[data-testid="event-draft-validation"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-editor-diff"]')).toBeNull();
  });

  it("keeps core controls direct and removes optional legend chrome", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");

    expect(host.querySelector('[data-testid="event-character-id-details"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-character-id-connect"]')?.textContent).toContain("연결 안 됨");
    expect(host.querySelector('[data-testid="event-command-legend-details"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-command-legend"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-ai-next-steps"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-trigger-select"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-command-toolbar-add"]')).toBeTruthy();
  });

  it("omits validation chrome when the draft has no issues", () => {
    const project = store.getCurrent();
    project.maps[project.startMapId]!.events = [baseEvent({
      x: 1,
      y: 1,
      pages: [basePage({ priority: "below" })],
    })];
    store.replace(project);

    renderEventEditorDynamic(host, project.startMapId, "ev_herbalist");

    expect(host.querySelector('[data-testid="event-draft-validation"]')).toBeNull();
  });

  it("keeps the editing surface free of validation chrome even when the draft has issues", () => {
    const project = store.getCurrent();
    project.maps[project.startMapId]!.events = [baseEvent({ x: 999, y: 999 })];
    store.replace(project);

    renderEventEditorDynamic(host, project.startMapId, "ev_herbalist");

    expect(host.querySelector('[data-testid="event-draft-validation"]')).toBeNull();
    expect(host.querySelector('[data-testid^="event-draft-validation-issue-"]')).toBeNull();
  });

  // 옛 계약: 명령을 고르기 전엔 인스펙터가 숨겨졌다. 지금은 인스펙터 칼럼이 항상 페이지 미리보기를
  // 빈 상태로 보여 준다(content.ts setCommandInspectorHost 의 emptyPreview, commandInspector.ts 가
  // emptyPreview 가 있으면 미리보기만 그리고 돌아온다). 숨김·본문 폼·제목은 더 이상 없다.
  it("keeps the command inspector column as a preview-first surface, before and after selecting a command", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const workbench = host.querySelector<HTMLElement>(".event-editor-workbench");
    const inspector = host.querySelector<HTMLElement>('[data-testid="event-editor-inspector"]');
    const firstCommand = host.querySelector<HTMLElement>(".cmd-item .cmd-head");

    expect(workbench).toBeTruthy();
    expect(inspector?.hidden).toBe(false);
    expect(inspector?.querySelector(".event-preview-heading")?.textContent).toBe("미리보기");
    expect(workbench?.classList.contains("has-command-inspector")).toBe(false);

    firstCommand?.click();

    expect(inspector?.hidden).toBe(false);
    expect(workbench?.classList.contains("has-command-inspector")).toBe(true);
    expect(inspector?.querySelector('[data-testid="event-inspector-preview"]')).toBeTruthy();
    expect(inspector?.querySelector('[data-testid="event-inspector-body"]')).toBeNull();
  });

  it("shows active switch conditions and opens their controls from the settings rail", () => {
    const project = store.getCurrent();
    project.maps[project.startMapId]!.events = [
      baseEvent({
        pages: [
          basePage({
            conditions: [{ kind: "switch", switchId: "sw_0001", value: true }],
          }),
        ],
      }),
    ];
    store.replace(project);

    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const conditions = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-conditions"]');
    expect(conditions?.tagName).toBe("DIV");
    expect(host.querySelector('[data-testid="event-condition-chip-switch1"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-testid="event-condition-summary-badges"]')).toBeTruthy();

    const badge = host.querySelector('[data-testid="event-condition-badge"]');
    expect(badge?.classList.contains("event-condition-badge-switch")).toBe(true);
    expect(host.querySelector<HTMLSelectElement>('[data-testid="event-page-switch-condition-value"]')?.value).toBe("on");

    selectGroup(host, "when");
    // 「언제 보이나요」 헤더는 레일 안에서 펼치지 않고 등장 조건 모달(문서에 붙음)을 연다 — 조건 컨트롤은 모달 안에 있다.
    expect(document.querySelector('[data-testid="event-condition-modal"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="event-page-switch-condition-input"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="event-condition-chip-variable"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(document.querySelector('[data-testid="event-condition-row-변수"]')).toBeNull();
    document.querySelector<HTMLElement>('[data-testid="event-condition-modal-done"]')?.click();
  });

  it("expands movement section for nested movement controls without burying trigger", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const movement = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-movement-section"]');
    expect(movement?.tagName).toBe("DIV");

    // Trigger is already outside movement before expand.
    expect(host.querySelector('[data-testid="event-page-trigger-select"]')).toBeTruthy();
    expect(movement?.querySelector('[data-testid="event-page-trigger-select"]')).toBeNull();
    expect(movement?.querySelector('[data-testid="event-classic-trigger"]')).toBeNull();

    selectGroup(host, "move");
    expect(host.querySelector('[data-testid="event-classic-movement-type"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-classic-animation-type"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-classic-movement-speed"]')).toBeTruthy();
    // Still outside the movement section after expand.
    expect(movement?.querySelector('[data-testid="event-classic-trigger"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-classic-trigger"]')).toBeTruthy();
  });

  // 옛 계약: 인스펙터 머리(event-inspector-title)가 선택지 질문만 짧게 보여 줬다. 인스펙터가 미리보기 전용이 되며
  // 머리·제목·카드 힌트가 사라졌다(commandInspector.ts emptyPreview 조기 반환) — 옛 제목 단언은 지금 상태 단언으로 바꿨다.
  it("renders a choices command in the preview-only inspector without a title or card hint", () => {
    const choicesCmd: Command = {
      kind: "choices",
      prompt: "두 길목을 정리해 줄래?",
      options: [
        { text: "맡는다", branch: [] },
        { text: "나중에", branch: [] },
      ],
      cancelBehavior: "choice2",
    };
    const project = store.getCurrent();
    project.maps[project.startMapId]!.events = [
      baseEvent({ pages: [basePage({ commands: [choicesCmd] })] }),
    ];
    store.replace(project);

    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    host.querySelector<HTMLElement>(".cmd-item .cmd-head")?.click();

    expect(host.querySelector('[data-testid="event-inspector-preview"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-inspector-title"]')).toBeNull();
    expect(host.querySelector(".event-inspector-card-hint")).toBeNull();
  });

  // 옛 계약: 빈 질문이면 인스펙터 제목이 `선택지 N개` 로 대체됐다. 제목 자체가 없어졌으므로(위 테스트 주석) 빈 질문 선택지도
  // 같은 미리보기 전용 상태임을 단언한다. 제목 대체 문구 자체는 이제 inspectorTitle 이 인스펙터에 그려지지 않는다.
  it("renders a choices command with an empty prompt in the preview-only inspector", () => {
    const choicesCmd: Command = {
      kind: "choices",
      prompt: "   ",
      options: [
        { text: "맡는다", branch: [] },
        { text: "나중에", branch: [] },
      ],
    };
    const project = store.getCurrent();
    project.maps[project.startMapId]!.events = [
      baseEvent({ pages: [basePage({ commands: [choicesCmd] })] }),
    ];
    store.replace(project);

    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    host.querySelector<HTMLElement>(".cmd-item .cmd-head")?.click();

    expect(host.querySelector('[data-testid="event-inspector-preview"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-inspector-title"]')).toBeNull();
    expect(host.querySelector(".event-inspector-card-hint")).toBeNull();
  });

  it("offers inactive conditions as chips and creates an editable row when selected", () => {
    const mapId = store.getCurrent().startMapId;
    renderEventEditorDynamic(host, mapId, "ev_herbalist");
    selectGroup(host, "when");
    // 조건 컨트롤은 「언제 보이나요」 모달(문서에 붙음)로 옮겨 가므로 document 에서 찾는다.
    expect(document.querySelectorAll(".event-condition-row")).toHaveLength(0);
    const chip = document.querySelector<HTMLButtonElement>('[data-testid="event-condition-chip-variable"]');
    expect(chip?.getAttribute("aria-pressed")).toBe("false");
    chip?.click();
    document.querySelector<HTMLElement>('[data-testid="event-condition-modal-done"]')?.click();
    expect(store.getCurrent().maps[mapId]?.events[0]?.pages?.[0]?.conditions).toContainEqual(expect.objectContaining({ kind: "variable" }));
    host.replaceChildren();
    renderEventEditorDynamic(host, mapId, "ev_herbalist");
    expect(host.querySelector('[data-testid="event-condition-chip-variable"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-testid="event-condition-row-변수"]')).not.toBeNull();
  });
});
