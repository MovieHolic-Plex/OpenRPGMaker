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

  it("한글 IME 가 key 를 Process 로 바꿔도 물리 키로 도구를 고른다", () => {
    editorState.set({ tool: "select", layer: "lower" });
    expect(handleEditorKey({
      key: "Process",
      code: "KeyB",
      keyCode: 229,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      target: undefined,
      preventDefault: () => {},
    } as unknown as KeyboardEvent)).toBe(true);
    expect(editorState.get().tool).toBe("paint");
  });

  it("문자 단축키 V/B/E/G/N/I가 도구를 전환한다", () => {
    expect(handleEditorKey(keyEvent("v"))).toBe(true);
    expect(editorState.get().tool).toBe("select");
    expect(handleEditorKey(keyEvent("e"))).toBe(true);
    expect(editorState.get().tool).toBe("erase");
    expect(handleEditorKey(keyEvent("n"))).toBe(true);
    expect(editorState.get().tool).toBe("event");
    expect(editorState.get().layer).toBe("event");
    // 이벤트 레이어에서 타일 도구 문자키 → 하위 레이어로 복귀
    expect(handleEditorKey(keyEvent("b"))).toBe(true);
    expect(editorState.get().tool).toBe("paint");
    expect(editorState.get().layer).toBe("lower");
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
    const tileIndex = 1 * map.width + 1;
    map.lowerTiles[tileIndex] = 7;
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      layer: "event",
      selectedEventId: event.id,
      selectedEventPageId: null,
      tool: "event",
      selection: { mapId: project.startMapId, x: 1, y: 1, width: 1, height: 1 },
    });

    vi.stubGlobal("confirm", vi.fn(() => true));

    expect(handleEditorKey(keyEvent("Delete"))).toBe(true);

    expect(store.getCurrent().maps[project.startMapId]?.events).toEqual([]);
    expect(editorState.get().selectedEventId).toBeNull();
    expect(editorState.get().selectedEventPageId).toBeNull();
    // 같은 칸에 타일 선택이 있어도 이벤트 삭제가 우선이라 타일은 남는다.
    expect(store.getCurrent().maps[project.startMapId]?.lowerTiles[tileIndex]).toBe(7);
  });

  it("Delete on a tile layer clears the selected region and leaves the rest", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const index = 1 * map.width + 1;
    const neighbor = map.lowerTiles[0];
    map.lowerTiles[index] = 7;
    map.upperTiles[index] = 9;
    store.replace(project);
    editorState.set({
      currentMapId: project.startMapId,
      layer: "lower",
      tool: "select",
      selection: { mapId: project.startMapId, x: 1, y: 1, width: 1, height: 1 },
    });

    expect(handleEditorKey(keyEvent("Delete"))).toBe(true);

    const next = store.getCurrent().maps[project.startMapId]!;
    expect(next.lowerTiles[index]).toBe(-1);
    expect(next.upperTiles[index]).toBe(-1);
    expect(next.lowerTiles[0]).toBe(neighbor);
    expect(editorState.get().selection).toEqual({ mapId: project.startMapId, x: 1, y: 1, width: 1, height: 1 });
  });

  it("Delete does nothing when no region is selected and does not clear during paste preview", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const kept = map.lowerTiles[0];
    store.replace(project);
    editorState.set({ currentMapId: project.startMapId, layer: "lower", tool: "select", selection: null });
    expect(handleEditorKey(keyEvent("Delete"))).toBe(false);
    expect(store.getCurrent().maps[project.startMapId]?.lowerTiles[0]).toBe(kept);

    editorState.set({
      selection: { mapId: project.startMapId, x: 0, y: 0, width: 1, height: 1 },
      pastePreview: { x: 2, y: 2 },
    });
    expect(handleEditorKey(keyEvent("Delete"))).toBe(false);
    expect(store.getCurrent().maps[project.startMapId]?.lowerTiles[0]).toBe(kept);
  });
});
