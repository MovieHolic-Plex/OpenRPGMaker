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

  it("keeps the command inspector hidden until a command is selected", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const workbench = host.querySelector<HTMLElement>(".event-editor-workbench");
    const inspector = host.querySelector<HTMLElement>('[data-testid="event-editor-inspector"]');
    const firstCommand = host.querySelector<HTMLElement>(".cmd-item .cmd-head");

    expect(workbench).toBeTruthy();
    expect(inspector?.hidden).toBe(true);
    expect(workbench?.classList.contains("has-command-inspector")).toBe(false);

    firstCommand?.click();

    expect(inspector?.hidden).toBe(false);
    expect(workbench?.classList.contains("has-command-inspector")).toBe(true);
    expect(inspector?.querySelector('[data-testid="event-inspector-body"]')).toBeTruthy();
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
    // expand-then-assert: condition grid controls become available
    expect(host.querySelector('[data-testid="event-page-switch-condition-input"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-condition-chip-variable"]')?.getAttribute("aria-pressed")).toBe("false");
    expect(host.querySelector('[data-testid="event-condition-row-변수"]')).toBeNull();
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

  it("shows a compact choices inspector title: prompt only, no options/cancel", () => {
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

    const title = host.querySelector('[data-testid="event-inspector-title"]');
    expect(title?.textContent).toBe("두 길목을 정리해 줄래?");
    expect(title?.textContent).not.toContain("1.맡는다");
    expect(title?.textContent).not.toContain("나중에");
    expect(title?.textContent).not.toContain("취소");
    // Default density is the directly editable form; the old duplicate card hint is absent.
    expect(host.querySelector(".event-inspector-card-hint")).toBeNull();
  });

  it("falls back to `선택지 N개` when the choices prompt is empty", () => {
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

    expect(host.querySelector('[data-testid="event-inspector-title"]')?.textContent).toBe("선택지 2개");
    expect(host.querySelector(".event-inspector-card-hint")).toBeNull();
  });

  it("offers inactive conditions as chips and creates an editable row when selected", () => {
    const mapId = store.getCurrent().startMapId;
    renderEventEditorDynamic(host, mapId, "ev_herbalist");
    selectGroup(host, "when");
    expect(host.querySelectorAll(".event-condition-row")).toHaveLength(0);
    const chip = host.querySelector<HTMLButtonElement>('[data-testid="event-condition-chip-variable"]');
    expect(chip?.getAttribute("aria-pressed")).toBe("false");
    chip?.click();
    expect(store.getCurrent().maps[mapId]?.events[0]?.pages?.[0]?.conditions).toContainEqual(expect.objectContaining({ kind: "variable" }));
    host.replaceChildren();
    renderEventEditorDynamic(host, mapId, "ev_herbalist");
    expect(host.querySelector('[data-testid="event-condition-chip-variable"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector('[data-testid="event-condition-row-변수"]')).not.toBeNull();
  });
});
