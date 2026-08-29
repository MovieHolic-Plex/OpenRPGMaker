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

  // 옛 계약: 개수와 뷰 토글을 페이지바의 `event-command-header` 칩에 올렸다. a87ab4fc 가 크롬을
  // 접으면서 그 헤더를 없앴고(헤더에 짐을 얹으면 상단이 잘렸다), 7a7ce6ae 가 개수의 집을 명령
  // 칼럼 라벨로 확정했다. 페이지바는 이제 페이지 선택만 갖는다.
  it("keeps the command count in the commands column label and the view toggle in the canvas", () => {
    const mapId = seedProject();
    renderEventEditorDynamic(host, mapId, EVENT_ID);

    const pagebar = host.querySelector<HTMLElement>(".event-editor-pagebar");
    const commandsLabel = host.querySelector<HTMLElement>('[data-testid="event-editor-column-label-commands"]');
    const count = host.querySelector<HTMLElement>('[data-testid="event-editor-command-count"]');
    const contents = host.querySelector<HTMLElement>('[data-testid="event-script-canvas"]');

    expect(commandsLabel?.contains(count)).toBe(true);
    expect(count?.textContent).toBe("2개");
    expect(contents?.querySelector('[data-testid="event-view-toggle-list"]')).toBeTruthy();
    expect(contents?.querySelector('[data-testid="event-view-toggle-storyboard"]')).toBeTruthy();
    // 페이지바는 개수도 토글도 다시 가져가지 않는다 — 그게 상단 잘림의 원인이었다.
    expect(pagebar?.querySelector('[data-testid="event-editor-command-count"]')).toBeNull();
    expect(pagebar?.querySelector('[data-testid="event-view-toggle-list"]')).toBeNull();
    expect(contents?.getAttribute("aria-label")).toBe("이 페이지가 하는 일");
    expect(contents?.querySelector(".event-contents-legend")).toBeNull();
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
