/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { openEventConditions, openEventMovement } from "@/editor/panels/eventEditor/eventEditorOpenState";
import { EVENT_PRIORITY_OPTIONS, TRIGGER_OPTIONS } from "@/editor/panels/eventEditor/options";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage, GameEvent } from "@/project/types";

function page(overrides: Partial<EventPage> = {}): EventPage {
  return {
    id: "p1",
    name: "상자",
    conditions: [],
    graphic: {},
    trigger: { kind: "action" },
    priority: "below",
    overlapForbidden: true,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "text", body: "잡화가 들어 있다." }],
    ...overrides,
  };
}

function event(overrides: Partial<GameEvent> = {}): GameEvent {
  return {
    id: "ev_chest",
    x: 4,
    y: 7,
    trigger: { kind: "action" },
    commands: [],
    pages: [page()],
    ...overrides,
  };
}

function render(host: HTMLElement, ev: GameEvent = event()): void {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [ev];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
  renderEventEditorDynamic(host, mapId, ev.id);
}

describe("event editor chest-path UX", () => {
  let host: HTMLElement;

  beforeEach(() => {
    resetEditorUiModeForTests("expert");
    clearCommandInspector();
    openEventConditions.clear();
    openEventMovement.clear();
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    resetEditorUiModeForTests("standard");
    clearCommandInspector();
    host.remove();
    document.querySelector('[data-testid="event-command-picker"]')?.remove();
    openEventConditions.clear();
    openEventMovement.clear();
  });

  it("defaults to the command list and does not offer a fake graph tab", () => {
    render(host);
    const list = host.querySelector<HTMLElement>(".cmd-list");
    const board = host.querySelector<HTMLElement>(".event-storyboard");
    expect(list?.hidden).toBe(false);
    expect(board?.hidden).toBe(true);
    expect(host.querySelector('[data-testid="event-view-toggle-graph"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-graph-placeholder"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-view-toggle-list"]')?.textContent).toBe("목록");
    expect(host.querySelector('[data-testid="event-view-toggle-storyboard"]')?.textContent).toBe("스토리보드");
  });

  it("opens the command picker from a storyboard add card without switching views", () => {
    render(host);
    host.querySelector<HTMLButtonElement>('[data-testid="event-view-toggle-storyboard"]')?.click();
    expect(host.querySelector('[data-testid="event-view-toggle-storyboard"]')?.getAttribute("aria-pressed")).toBe("true");
    host.querySelector<HTMLButtonElement>('[data-testid="event-storyboard-add"]')?.click();
    expect(host.querySelector('[data-testid="event-view-toggle-storyboard"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector<HTMLElement>(".event-storyboard")?.hidden).toBe(false);
    expect(document.querySelector('[data-testid="event-command-picker"]')).toBeTruthy();
  });

  it("keeps page add on the tab strip and leaves overflow for copy/delete only", () => {
    render(host);
    expect(host.querySelector('[data-testid="event-page-tab-add"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-page-add"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-page-copy"]')?.textContent).toContain("페이지 복사");
    expect(host.querySelector('[data-testid="event-page-delete"]')).toBeNull();
  });

  it("hides the character-id field behind a connect action until a profile is linked", () => {
    render(host);
    const field = host.querySelector('[data-testid="event-character-id-field"]');
    expect(field).toBeTruthy();
    expect(host.querySelector('[data-testid="event-character-id-connect"]')?.textContent).toContain("연결 안 됨");
    expect(host.querySelector('[data-testid="event-character-id-details"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-character-id-input"]')).toBeNull();

    host.replaceChildren();
    render(host, event({ characterId: "npc_chest" }));
    expect(host.querySelector('[data-testid="event-character-id-picker-open"]')?.textContent).toContain("npc_chest");
    expect(host.querySelector('[data-testid="event-character-id-input"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-character-social-extras"]')).toBeTruthy();
    expect(host.querySelector('[data-testid="event-character-id-connect"]')).toBeNull();
  });

  it("keeps follower presets and the field-monster template out of the command canvas", () => {
    render(host);
    const contents = host.querySelector('[data-testid="event-classic-contents"]');
    expect(contents?.querySelector('[data-testid="follower-preset-bar"]')).toBeNull();
    expect(contents?.querySelector('[data-testid="event-command-toolbar-field-monster"]')).toBeNull();
    const aux = host.querySelector('[data-testid="event-editor-aux-tools"]');
    expect(aux?.querySelector('[data-testid="follower-preset-bar"]')).toBeTruthy();
    expect(aux?.querySelector('[data-testid="event-command-toolbar-field-monster"]')).toBeTruthy();
  });

  it("uses investigation and map-layer wording for trigger and priority", () => {
    expect(TRIGGER_OPTIONS.find((option) => option.value === "action")?.label).toBe("확인 키로 조사");
    expect(EVENT_PRIORITY_OPTIONS.find((option) => option.value === "below")?.label).toBe("맵 아래");
    expect(EVENT_PRIORITY_OPTIONS.find((option) => option.value === "same")?.label).toBe("같은 높이");
    expect(EVENT_PRIORITY_OPTIONS.find((option) => option.value === "above")?.label).toBe("맵 위");
    render(host);
    const trigger = host.querySelector<HTMLSelectElement>('[data-testid="event-page-trigger-select"]');
    expect(trigger?.selectedOptions[0]?.textContent).toBe("확인 키로 조사");
    const priority = host.querySelector<HTMLSelectElement>('[data-testid="event-page-priority-select"]');
    expect(priority?.selectedOptions[0]?.textContent).toBe("맵 아래");
  });

  it("does not advertise movement speed on a stationary event", () => {
    render(host);
    expect(host.querySelector('[data-testid="event-movement-summary-chips"]')?.textContent).toBe("정지");
  });
});
