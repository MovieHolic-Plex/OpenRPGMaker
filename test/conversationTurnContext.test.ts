import { describe, expect, it } from "vitest";
import {
  buildConversationTurnContext,
  isConversationTurnContext,
  mapTransitionNote,
  type ConversationTurnContext,
} from "@/ai/conversationTurnContext";
import type { MapViewportSnapshot } from "@/ai/mapViewportContext";
import type { Project } from "@/project/types";

function projectWithMaps(): Pick<Project, "maps"> {
  return {
    maps: {
      map_a: { id: "map_a", name: "마을 광장", width: 20, height: 15 },
      map_b: { id: "map_b", name: "숲길", width: 30, height: 30 },
    },
  } as unknown as Pick<Project, "maps">;
}

const viewport = (mapId: string): MapViewportSnapshot => ({
  mapId,
  centerX: 8,
  centerY: 6,
  x: 2,
  y: 1,
  w: 10,
  h: 8,
});

describe("conversationTurnContext", () => {
  it("Given the current map When building Then it records map identity, size, viewport and selection", () => {
    const context = buildConversationTurnContext(projectWithMaps(), {
      mapId: "map_a",
      viewport: viewport("map_a"),
      selection: { mapId: "map_a", x: 3, y: 4, width: 5, height: 6 },
    });

    expect(context).toEqual({
      mapId: "map_a",
      mapName: "마을 광장",
      mapWidth: 20,
      mapHeight: 15,
      viewport: viewport("map_a"),
      selection: { mapId: "map_a", x: 3, y: 4, width: 5, height: 6 },
    });
  });

  it("Given a viewport or selection from another map When building Then they are dropped", () => {
    const context = buildConversationTurnContext(projectWithMaps(), {
      mapId: "map_b",
      viewport: viewport("map_a"),
      selection: { mapId: "map_a", x: 3, y: 4, width: 5, height: 6 },
    });

    expect(context.viewport).toBeUndefined();
    expect(context.selection).toBeUndefined();
    expect(context.mapId).toBe("map_b");
  });

  it("Given a selection extending past the map bounds When building Then it is dropped", () => {
    const context = buildConversationTurnContext(projectWithMaps(), {
      mapId: "map_a",
      selection: { mapId: "map_a", x: 18, y: 13, width: 3, height: 3 },
    });

    expect(context.selection).toBeUndefined();
  });

  it("Given no map id When building Then the viewport map is used and unknown maps stay nameless", () => {
    const fromViewport = buildConversationTurnContext(projectWithMaps(), { viewport: viewport("map_b") });
    expect(fromViewport.mapId).toBe("map_b");
    expect(fromViewport.mapName).toBe("숲길");

    const unknown = buildConversationTurnContext(projectWithMaps(), { mapId: "map_gone" });
    expect(unknown).toEqual({ mapId: "map_gone", mapName: null });

    const none = buildConversationTurnContext(projectWithMaps(), {});
    expect(none).toEqual({ mapId: null, mapName: null });
  });

  it("Given turn contexts When the map changes Then only real transitions produce a note", () => {
    const a = buildConversationTurnContext(projectWithMaps(), { mapId: "map_a" });
    const b = buildConversationTurnContext(projectWithMaps(), { mapId: "map_b" });

    expect(mapTransitionNote(null, a)).toBeNull();
    expect(mapTransitionNote(a, a)).toBeNull();
    expect(mapTransitionNote(a, b)).toBe("맵 이동: 마을 광장 → 숲길");
  });

  it("Given stored payloads When validated Then only well-formed contexts pass", () => {
    const valid: ConversationTurnContext = { mapId: "map_a", mapName: "마을 광장" };
    expect(isConversationTurnContext(valid)).toBe(true);
    expect(isConversationTurnContext({ mapId: null, mapName: null })).toBe(true);
    expect(isConversationTurnContext({ mapId: "map_a", mapName: "a", viewport: viewport("map_a") })).toBe(true);

    expect(isConversationTurnContext(null)).toBe(false);
    expect(isConversationTurnContext({ mapName: "a" })).toBe(false);
    expect(isConversationTurnContext({ mapId: 1, mapName: "a" })).toBe(false);
    expect(isConversationTurnContext({ mapId: "a", mapName: "a", viewport: { mapId: "a" } })).toBe(false);
    expect(isConversationTurnContext({ mapId: "a", mapName: "a", selection: { mapId: "a", x: 1 } })).toBe(false);
    expect(isConversationTurnContext({ mapId: "a", mapName: "a", mapWidth: Number.NaN })).toBe(false);
  });
});
