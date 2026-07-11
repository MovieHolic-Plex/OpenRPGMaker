/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

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

describe("event editor UI density", () => {
  let host: HTMLElement;

  beforeEach(() => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    project.maps[mapId]!.events = [baseEvent()];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    host.remove();
  });

  it("uses Korean name label and hides disabled page actions", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const nameField = host.querySelector('[data-testid="event-classic-name"]');
    expect(nameField?.textContent).toContain("이름");
    expect(nameField?.textContent).not.toContain("Name");

    expect(host.querySelector('[data-testid="event-page-add"]')).toBeTruthy();
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

  it("keeps conditions expanded and groups command toolbar in contents header", () => {
    renderEventEditorDynamic(host, store.getCurrent().startMapId, "ev_herbalist");
    const conditions = host.querySelector<HTMLDetailsElement>('[data-testid="event-classic-conditions"]');
    expect(conditions?.open).toBe(true);
    expect(conditions?.textContent).toContain("항상");
    // 이동/애니메이션/속도는 RM 계약상 항상 노출
    expect(host.querySelector('[data-testid="event-classic-movement-type"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-classic-animation-type"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-classic-movement-speed"]')).toBeTruthy();

    const contents = host.querySelector('[data-testid="event-classic-contents"]');
    expect(contents?.querySelector(".event-editor-command-toolbar")).toBeTruthy();
    expect(host.querySelector(".event-editor-command-tool-group")).toBeTruthy();
    expect(host.querySelector('[data-testid="event-command-toolbar-add"]')?.classList.contains("primary")).toBe(true);
    expect(host.querySelector('[data-testid="event-editor-aux-tools"]')).toBeTruthy();
  });

  it("shows active condition count meta", () => {
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
    expect(conditions?.open).toBe(true);
    expect(conditions?.textContent).toContain("1개 활성");
  });
});
