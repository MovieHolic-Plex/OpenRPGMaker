/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEventPagePreview } from "@/editor/panels/eventEditor/eventScriptModernViews";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { clearCommandInspector, setCommandInspectorHost } from "@/editor/panels/eventEditor/commandInspector";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage } from "@/project/types";

const FACE_A = "easyrpg-faceset-people1-03";
const FACE_B = "easyrpg-faceset-actor1-00";

function faceCommand(resourceId: string): Extract<Command, { kind: "changeFace" }> {
  return { kind: "changeFace", resourceId, position: "left", flipHorizontally: false };
}

function page(id: string, commands: Command[]): EventPage {
  return {
    id, name: id, conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  };
}

function render(authored: EventPage, advances = 0): HTMLElement {
  const panel = renderEventPagePreview({
    mapId: store.getCurrent().startMapId, eventId: "ev_preview_state", page: authored,
  });
  document.body.append(panel);
  for (let i = 0; i < advances; i += 1) {
    const next = panel.querySelector<HTMLButtonElement>('[data-testid="event-script-live-next"]');
    if (!next) throw new Error("Preview Next control is missing");
    next.click();
  }
  return panel;
}

function faceId(panel: HTMLElement): string | null {
  return panel.querySelector('[data-testid="event-command-face-crop-shell"]')?.getAttribute("data-resource-id") ?? null;
}

describe("event preview uses the current command state", () => {
  beforeEach(() => {
    const project = createBlankProject();
    project.variables = [{ id: "var_0001", name: "Score" }];
    store.replace(project);
  });
  afterEach(() => {
    clearCommandInspector();
    setCommandInspectorHost(undefined);
    document.body.replaceChildren();
  });

  it("refreshes a remembered dialogue step when its preceding face is edited", () => {
    const first = render(page("edited-face", [
      faceCommand(FACE_A), { kind: "text", body: "대사" },
    ]), 1);
    expect(faceId(first)).toBe(FACE_A);
    first.remove();

    const refreshed = render(page("edited-face", [
      faceCommand(FACE_B), { kind: "text", body: "대사" },
    ]));

    expect(refreshed.querySelector(".event-script-live-position")?.textContent).toBe("2/2");
    expect(faceId(refreshed)).toBe(FACE_B);
  });

  it("honors a face-clear command instead of finding an older portrait", () => {
    const panel = render(page("cleared-face", [
      faceCommand(FACE_A),
      faceCommand(""),
      { kind: "text", body: "얼굴 없는 대사" },
    ]), 2);

    expect(faceId(panel)).toBeNull();
    expect(panel.querySelector(".ecp-message-window")?.classList.contains("with-face")).toBe(false);
  });

  it("carries the authored face side and flip into the dialogue stage", () => {
    const panel = render(page("face-layout", [
      { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
      { kind: "text", body: "오른쪽 얼굴" },
    ]), 1);

    const face = panel.querySelector('[data-testid="event-command-face-crop-shell"]');
    expect(face?.getAttribute("data-position")).toBe("right");
    expect(face?.classList.contains("flipped")).toBe(true);
    expect(panel.querySelector(".ecp-message-window")?.classList.contains("face-right")).toBe(true);
  });

  it("does not borrow a face from a skipped conditional branch", () => {
    const panel = render(page("skipped-face", [
      faceCommand(FACE_A),
      {
        kind: "fork", condition: { kind: "switch", switchId: "sw_preview", value: true },
        then: [faceCommand(FACE_B)], else: [],
      },
      { kind: "text", body: "실행되는 대사" },
    ]), 3);

    expect(faceId(panel)).toBe(FACE_A);
  });

  it.each([4, 5])("keeps choice-local faces out of sibling/outer dialogue at step %i", (step) => {
    const panel = render(page(`choice-face-${step}`, [
      faceCommand(FACE_A),
      {
        kind: "choices", prompt: "선택", options: [
          { text: "첫 분기", branch: [
            faceCommand(FACE_B), { kind: "text", body: "첫 분기 대사" },
          ] },
          { text: "다음 분기", branch: [{ kind: "text", body: "다음 분기 대사" }] },
        ],
      },
      { kind: "text", body: "분기 밖 대사" },
    ]), step);

    expect(faceId(panel)).toBe(FACE_A);
  });

  it("interpolates the variable value at the current simulated step", () => {
    const panel = render(page("variable-dialogue", [
      { kind: "setVariable", variableId: "var_0001", op: "=", value: 37 },
      { kind: "text", body: "점수: \\V[1]" },
    ]), 1);

    expect(panel.querySelector(".ecp-message-body")?.textContent).toBe("점수: 37");
  });

  it("passes authored face side and flip from the list into the text inspector", () => {
    const list = document.createElement("div");
    const inspector = document.createElement("div");
    document.body.append(list, inspector);
    setCommandInspectorHost(inspector);
    renderCommandList(list, [
      { kind: "changeFace", resourceId: FACE_A, position: "right", flipHorizontally: true },
      { kind: "text", body: "인스펙터 대사" },
    ], [], {
      addCommand() {}, insertCommand() {}, replaceCommand() {},
      deleteCommand() {}, moveCommand() {}, moveCommandTo() {},
    });
    const row = list.querySelector<HTMLElement>('[data-testid="event-command-text"] .cmd-head');
    if (!row) throw new Error("Text command row is missing");

    row.click();

    const face = inspector.querySelector('[data-testid="event-command-face-crop-shell"]');
    expect(face?.getAttribute("data-position")).toBe("right");
    expect(face?.classList.contains("flipped")).toBe(true);
  });
});
