import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyLayer, handleEditorKey } from "@/editor/hotkeys";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameEvent } from "@/project/types";

// RM2K3 스타일 단축키 매핑 검증. 순수 editorState 변경 로직만 검증한다.
// (shouldIgnoreEditorShortcut 의 DOM 가드는 jsdom 환경이 필요해 여기서는 제외.)
describe("editor keyboard shortcuts", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    store.replace(createBlankProject());
    editorState.set({ tool: "paint", layer: "lower", zoom: 2 });
  });

  function keyEvent(key: string, opts: { ctrl?: boolean } = {}): KeyboardEvent {
    return {
      key,
      code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
      ctrlKey: Boolean(opts.ctrl),
      metaKey: false,
      altKey: false,
      target: undefined,
      preventDefault: () => {},
    } as unknown as KeyboardEvent;
  }

  it("F5/F6/F7 switch to lower/upper/event layers", () => {
    expect(handleEditorKey(keyEvent("F5"))).toBe(true);
    expect(editorState.get().layer).toBe("lower");
    expect(handleEditorKey(keyEvent("F6"))).toBe(true);
    expect(editorState.get().layer).toBe("upper");
    expect(handleEditorKey(keyEvent("F7"))).toBe(true);
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().tool).toBe("event");
  });

  it("number keys 1..7 select tools", () => {
    expect(handleEditorKey(keyEvent("2"))).toBe(true);
    expect(editorState.get().tool).toBe("fill");
    expect(handleEditorKey(keyEvent("6"))).toBe(true);
    expect(editorState.get().tool).toBe("collision");
  });

  it("selecting a tile tool while on the event layer drops back to lower", () => {
    editorState.set({ layer: "event", tool: "event" });
    handleEditorKey(keyEvent("1"));
    expect(editorState.get().layer).toBe("lower");
    expect(editorState.get().tool).toBe("paint");
  });

  it("+/- step zoom within allowed integer levels", () => {
    editorState.set({ zoom: 2 });
    handleEditorKey(keyEvent("+"));
    expect(editorState.get().zoom).toBe(3);
    handleEditorKey(keyEvent("-"));
    expect(editorState.get().zoom).toBe(2);
  });

  it("applyLayer drops the event tool when leaving the event layer", () => {
    editorState.set({ layer: "event", tool: "event" });
    applyLayer("upper");
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().layer).toBe("upper");
  });

  it("returns false for modifier-only and unmapped keys", () => {
    expect(handleEditorKey(keyEvent("z", { ctrl: true }))).toBe(false);
    expect(handleEditorKey(keyEvent("q"))).toBe(false);
  });

  it("deletes the selected event on the event layer", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const event: GameEvent = {
      id: "event-delete-target",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
    };
    map.events = [event];
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      layer: "event",
      selectedEventId: event.id,
      selectedEventPageId: null,
      tool: "event",
    });

    vi.stubGlobal("confirm", vi.fn(() => true));

    expect(handleEditorKey(keyEvent("Delete"))).toBe(true);

    expect(store.getCurrent().maps[project.startMapId]?.events).toEqual([]);
    expect(editorState.get().selectedEventId).toBeNull();
    expect(editorState.get().selectedEventPageId).toBeNull();
  });
});
