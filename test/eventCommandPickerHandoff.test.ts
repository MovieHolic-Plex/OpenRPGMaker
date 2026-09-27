/** @vitest-environment happy-dom */
// 명령 피커 → 편집 창 인수인계 계약: 편집 창이 열리기 전에 피커는 닫혀 있어야 한다.
// 피커가 뒤에 남으면 확인이 뒤 창에 먹혀 저작이 유실된다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderDatabaseCommandListEditor } from "@/editor/panels/databaseCommandListAdapter";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, GameEvent } from "@/project/types";

const PICKER = '[data-testid="event-command-picker"]';
const EDIT_DIALOG = '[data-testid="event-command-edit-dialog"]';

let host: HTMLElement;

function textCommandButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(`${PICKER} [data-testid="command-picker-add-text"]`);
  if (!button) throw new Error("expected the 문장 표시 picker entry");
  return button;
}

function emptyEvent(): GameEvent {
  return {
    id: "ev_handoff",
    x: 2,
    y: 3,
    trigger: { kind: "action" },
    commands: [],
    pages: [{
      id: "p1",
      name: "페이지 1",
      conditions: [],
      graphic: {},
      trigger: { kind: "action" },
      priority: "below",
      overlapForbidden: true,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [],
    }],
  };
}

beforeEach(() => {
  clearCommandInspector();
  host = document.createElement("div");
  document.body.append(host);
});

afterEach(() => {
  document.querySelector<HTMLButtonElement>('[data-testid="event-command-edit-cancel"]')?.click();
  document.querySelector<HTMLButtonElement>('[data-testid="event-command-picker-cancel"]')?.click();
  clearCommandInspector();
  document.body.replaceChildren();
});

describe("command picker hands off to the edit dialog", () => {
  it("closes the map event picker before the edit dialog opens", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const event = emptyEvent();
    project.maps[mapId]!.events = [event];
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    renderEventEditorDynamic(host, mapId, event.id);

    const append = host.querySelector<HTMLButtonElement>('[data-testid="event-command-empty-line"]');
    expect(append).not.toBeNull();
    append?.click();
    expect(document.querySelector(PICKER)).not.toBeNull();

    textCommandButton().click();

    expect(document.querySelector(EDIT_DIALOG)).not.toBeNull();
    expect(document.querySelector(PICKER)).toBeNull();
  });

  it("closes the common event picker before the edit dialog opens", () => {
    store.replace(createBlankProject());
    let commands: Command[] = [];
    renderDatabaseCommandListEditor(host, {
      commands,
      replaceCommands: (next) => {
        commands = next;
      },
      pickerContext: "common",
    });

    host.querySelector<HTMLElement>('[data-testid="event-command-empty-line"]')?.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
    );
    expect(document.querySelector(PICKER)).not.toBeNull();

    textCommandButton().click();

    expect(document.querySelector(EDIT_DIALOG)).not.toBeNull();
    expect(document.querySelector(PICKER)).toBeNull();
  });
});
