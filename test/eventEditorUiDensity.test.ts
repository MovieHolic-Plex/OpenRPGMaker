/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { openEventConditions, openEventMovement } from "@/editor/panels/eventEditor/eventEditorOpenState";
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
        resourceId: "easyrpg-faceset-people1",
        faceIndex: 8,
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

function expandDetails(section: HTMLDetailsElement | null): void {
  if (!section) throw new Error("expected details section");
  const summary = section.querySelector("summary");
  if (!summary) throw new Error("expected summary");
  // happy-dom: toggling open + dispatching toggle keeps module open-state in sync.
  section.open = true;
  section.dispatchEvent(new Event("toggle"));
}

describe("event editor UI density", () => {
  let host: HTMLElement;

  beforeEach(() => {
    resetEditorUiModeForTests("standard");
    clearCommandInspector();
    openEventConditions.clear();
    openEventMovement.clear();
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [baseEvent()];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    resetEditorUiModeForTests("standard");
    clearCommandInspector();
    host.remove();
    openEventConditions.clear();
    openEventMovement.clear();
  });

  it("uses Korean name label and hides disabled page actions", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const nameField = host.querySelector('[data-testid="event-classic-name"]');
    expect(nameField?.textContent).toContain("이름");
    expect(nameField?.textContent).not.toContain("Name");

    expect(host.querySelector('[data-testid="event-page-tab-add"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-page-add"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-copy"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-page-paste"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-delete"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-tab-add"]')).toBeTruthy();
  });

  it("does not mount NPC schedule on the classic RM event shell", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    expect(host.querySelector('[data-testid="event-schedule-section"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-schedule-json"]')).toBeNull();
  });

  it("defaults secondary settings and tools closed while keeping trigger and add command visible", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const conditions = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-conditions"]');
    expect(conditions?.open).toBe(false);
    expect(conditions?.textContent).toContain("항상");
    expect(host.querySelector('[data-testid="event-condition-summary-empty"]')?.textContent).toBe("항상");

    const movement = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-movement-section"]');
    expect(movement?.open).toBe(false);
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
    // The integrated balanced shell deliberately keeps page actions available in the top strip.
    expect(host.querySelector<HTMLDetailsElement>('[data-testid="event-page-tabs"]')?.open).toBe(true);
    expect(host.querySelector('[data-testid="event-draft-validation"]')?.closest(".event-editor-command-header")).toBeTruthy();
    expect(host.querySelector('[data-testid="event-editor-diff"]')).toBeNull();
  });

  it.each(["beginner", "expert"] as const)("keeps core controls direct and removes optional legend chrome in %s mode", (mode) => {
    resetEditorUiModeForTests(mode);
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

  it("shows validation only when the draft has actionable issues", () => {
    const project = store.getCurrent();
    project.maps[project.startMapId]!.events = [baseEvent({ x: 999, y: 999 })];
    store.replace(project);

    renderEventEditorDynamic(host, project.startMapId, "ev_herbalist");

    const validation = host.querySelector<HTMLDetailsElement>('[data-testid="event-draft-validation"]');
    expect(validation).toBeTruthy();
    expect(validation?.open).toBe(false);
    expect(validation?.closest(".event-editor-command-header")).toBeTruthy();
    expect(validation?.querySelector('[data-testid^="event-draft-validation-issue-"]')).toBeTruthy();
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

  it("shows active condition badges with switch id/ON-OFF, expands conditions on demand", () => {
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
    expect(conditions?.open).toBe(false);
    expect(conditions?.textContent).not.toContain("1개 활성");
    expect(host.querySelector('[data-testid="event-condition-summary-badges"]')).toBeTruthy();

    const badgeText = host.querySelector('[data-testid="event-condition-badge"]')?.textContent ?? "";
    // Hostile UX: badge is not bare "스위치"; it carries id-ish token and ON/OFF.
    expect(badgeText).not.toBe("스위치");
    expect(badgeText).toMatch(/ON|OFF/);
    expect(badgeText.length).toBeGreaterThan("스위치".length);

    expandDetails(conditions);
    expect(conditions?.open).toBe(true);
    // expand-then-assert: condition grid controls become available
    expect(host.querySelector('[data-testid="event-page-switch-condition-input"]')).toBeTruthy();
    // 모든 핵심 조건 행이 항상 보인다 (체크 OFF 포함).
    expect(host.querySelector('[data-testid="event-condition-row-변수"]')).toBeTruthy();
  });

  it("expands movement section for nested movement controls without burying trigger", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const movement = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-movement-section"]');
    expect(movement?.open).toBe(false);

    // Trigger is already outside movement before expand.
    expect(host.querySelector('[data-testid="event-page-trigger-select"]')).toBeTruthy();
    expect(movement?.querySelector('[data-testid="event-page-trigger-select"]')).toBeNull();
    expect(movement?.querySelector('[data-testid="event-classic-trigger"]')).toBeNull();

    expandDetails(movement);
    expect(movement?.open).toBe(true);
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

  it("keeps inactive condition rows visible but faded (RM-style, no collapsing)", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const conditions = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-conditions"]');
    expandDetails(conditions);
    const inactive = conditions?.querySelectorAll('[data-condition-active="false"]') ?? [];
    expect(inactive.length).toBeGreaterThan(0);
    for (const row of Array.from(inactive)) {
      expect(row.classList.contains("disabled")).toBe(true);
      const children = Array.from(row.children) as HTMLElement[];
      expect(children.length).toBeGreaterThanOrEqual(3);
      for (const child of children) {
        expect(child.hidden || child.hasAttribute("hidden")).toBe(false);
      }
    }
  });
});
