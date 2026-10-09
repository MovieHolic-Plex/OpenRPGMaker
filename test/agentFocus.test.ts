import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorState } from "@/editor/editorState";
import { paintTile } from "@/editor/actions";
import { subscribeAgentFocusHighlight, type AgentFocusTarget } from "@/editor/agentFocus";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { createBlankMap, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import type { GameMap, Project } from "@/project/types";

let unsubscribeHighlight: (() => void) | null = null;
let highlights: AgentFocusTarget[] = [];

beforeEach(() => {
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  highlights = [];
  unsubscribeHighlight = subscribeAgentFocusHighlight((target) => highlights.push(target));
  editorState.set({
    currentMapId: null,
    selectedEventId: null,
    selectedEventPageId: null,
    selection: null,
    layer: "lower",
    tool: "paint",
  });
});

afterEach(() => {
  unsubscribeHighlight?.();
  unsubscribeHighlight = null;
  vi.restoreAllMocks();
});

describe("accepted agent changes preserve the editor view", () => {
  it("creates a map without leaving the map the user is editing", () => {
    const project = projectWithMap(blankMap("start_map", 8, 8));
    store.replace(project);
    editorState.set({ currentMapId: "start_map" });

    const results = applyToolSequenceToStore([
      { name: "create_map", args: { id: "ai_new_map", name: "AI New Map", width: 8, height: 6 } },
    ], { source: "agent", agentName: "unit-test-agent" });

    expect(results.every((result) => result.ok)).toBe(true);
    expect(store.getCurrent().maps.ai_new_map).toBeDefined();
    expect(editorState.get().currentMapId).toBe("start_map");
    expect(highlights).toEqual([]);
  });

  it("keeps the current map selected and highlights changed paint cells", () => {
    const project = projectWithMap(blankMap("paint_map", 8, 8));
    store.replace(project);
    editorState.set({ currentMapId: "paint_map" });

    const results = applyToolSequenceToStore([
      {
        name: "paint_tiles",
        args: {
          mapId: "paint_map",
          layer: "lower",
          mode: "cells",
          tile: TILE.WATER,
          cells: [{ x: 2, y: 3 }, { x: 4, y: 3 }],
        },
      },
    ], { source: "agent", agentName: "unit-test-agent" });

    expect(results.every((result) => result.ok)).toBe(true);
    expect(editorState.get().currentMapId).toBe("paint_map");
    expect(highlights).toHaveLength(1);
    expect(highlights[0]?.bounds).toEqual({ x: 2, y: 3, width: 3, height: 1 });
    expect(highlights[0]?.cells).toEqual([
      { x: 2, y: 3, layer: "lower" },
      { x: 4, y: 3, layer: "lower" },
    ]);
  });

  it("places an NPC on another map without switching the view", () => {
    const base = blankMap("start_map", 8, 8);
    const target = blankMap("target_map", 8, 8);
    const project = projectWithMap(base);
    project.maps[target.id] = target;
    project.mapTree.children.push({ mapId: target.id, children: [] });
    store.replace(project);
    editorState.set({ currentMapId: base.id });

    const results = applyToolSequenceToStore([
      {
        name: "place_npc",
        args: {
          mapId: target.id,
          id: "npc_lina",
          x: 2,
          y: 2,
          name: "Lina",
          pages: [{ lines: ["hello"] }],
        },
      },
    ], { source: "agent", agentName: "unit-test-agent" });

    expect(results.every((result) => result.ok)).toBe(true);
    expect(store.getCurrent().maps[target.id].events.some(event => event.id === "npc_lina")).toBe(true);
    expect(editorState.get().currentMapId).toBe(base.id);
    expect(highlights).toEqual([]);
  });

  it("does not emit agent highlights for direct manual paint actions", () => {
    const project = projectWithMap(blankMap("manual_map", 8, 8));
    store.replace(project);
    editorState.set({ currentMapId: "manual_map" });

    paintTile("manual_map", "lower", 1, 1, TILE.WATER);

    expect(editorState.get().currentMapId).toBe("manual_map");
    expect(highlights).toEqual([]);
  });
});

function blankMap(id: string, width: number, height: number): GameMap {
  const map = createBlankMap(id, width, height);
  map.id = id;
  map.name = id;
  return map;
}

function projectWithMap(map: GameMap): Project {
  const project = createEmptyToolProject();
  project.maps[map.id] = map;
  project.mapTree = { mapId: map.id, children: [] };
  project.startMapId = map.id;
  project.startPos = { x: 1, y: 1 };
  return project;
}
