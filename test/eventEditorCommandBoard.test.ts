/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { resetEditorUiModeForTests } from "@/editor/editorUiMode";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

const EVENT_ID = "ev_command_board";

function seedProject(): string {
  const project = createBlankProject();
  const mapId = project.startMapId;
  project.maps[mapId]!.events = [
    {
      id: EVENT_ID,
      x: 4,
      y: 5,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "p1",
          name: "안내인",
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [
            { kind: "text", body: "어서 오세요." },
            { kind: "loop", body: [] },
          ],
        },
      ],
    },
  ];
  store.replace(project);
  editorState.set({ currentMapId: mapId, selectedEventId: EVENT_ID, selectedEventPageId: "p1" });
  return mapId;
}

describe("event editor command board", () => {
  let host: HTMLElement;

  beforeEach(() => {
    resetEditorUiModeForTests("standard");
    clearCommandInspector();
    host = document.createElement("div");
    document.body.append(host);
  });

  afterEach(() => {
    clearCommandInspector();
    host.remove();
  });

  it("promotes the command count and view toggle into the top page header", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const pagebar = host.querySelector<HTMLElement>(".event-editor-pagebar");
    const header = host.querySelector<HTMLElement>('[data-testid="event-command-header"]');
    const contents = host.querySelector<HTMLElement>('[data-testid="event-classic-contents"]');

    expect(pagebar?.contains(header)).toBe(true);
    expect(header?.textContent).toContain("실행 내용 · 2개");
    expect(header?.querySelector('[data-testid="event-view-toggle-list"]')).toBeTruthy();
    expect(header?.querySelector('[data-testid="event-view-toggle-storyboard"]')).toBeTruthy();
    expect(contents?.getAttribute("aria-label")).toBe("실행 내용");
    expect(contents?.querySelector(".event-contents-legend")).toBeNull();
    expect(contents?.querySelector(".event-view-toggle")).toBeNull();
  });

  it("adds readable category badges in addition to category color", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const dialogue = host.querySelector<HTMLElement>('[data-testid="event-command-text"]');
    const flow = host.querySelector<HTMLElement>('[data-testid="event-command-loop"]');
    const dialogueBadge = dialogue?.querySelector<HTMLElement>(".cmd-cat-icon");
    const flowBadge = flow?.querySelector<HTMLElement>(".cmd-cat-icon");

    expect(dialogue?.dataset.commandCategory).toBe("dialogue");
    expect(flow?.dataset.commandCategory).toBe("flow");
    expect(dialogueBadge?.dataset.label).toBe("대화");
    expect(flowBadge?.dataset.label).toBe("흐름");
    expect(dialogueBadge?.title).toBe("대화 명령");
    expect(flowBadge?.title).toBe("흐름 명령");
  });
});
