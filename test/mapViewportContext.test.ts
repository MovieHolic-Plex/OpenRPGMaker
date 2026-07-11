import { describe, expect, it } from "vitest";
import {
  computeMapViewport,
  formatViewportContextBlock,
  mapRegionForContext,
  mapRegionImagePayload,
} from "@/ai/mapViewportContext";
import { createBlankProject } from "@/project/defaults";
import { buildSystemPrompt } from "@/ai/contextBuilder";

describe("computeMapViewport", () => {
  const map = { id: "map_a", width: 40, height: 30 };

  it("centers on camera world mid and reports visible tile rect", () => {
    // tileSize 16, zoom 1: view 320×240 → 20×15 tiles starting at scroll (160,80) = tile (10,5)
    const snap = computeMapViewport(map, {
      scrollX: 160,
      scrollY: 80,
      zoom: 1,
      viewWidthPx: 320,
      viewHeightPx: 240,
      tileSize: 16,
    });
    expect(snap.mapId).toBe("map_a");
    // world center (320, 200) / 16 → tile (20, 12)
    expect(snap.centerX).toBe(20);
    expect(snap.centerY).toBe(12);
    // maxSpan 16: visible was 20×15 → clamped
    expect(snap.w).toBeLessThanOrEqual(16);
    expect(snap.h).toBeLessThanOrEqual(16);
    expect(snap.x).toBeGreaterThanOrEqual(0);
    expect(snap.x + snap.w).toBeLessThanOrEqual(40);
  });

  it("clamps to map bounds near origin", () => {
    const snap = computeMapViewport(map, {
      scrollX: 0,
      scrollY: 0,
      zoom: 1,
      viewWidthPx: 64,
      viewHeightPx: 64,
      tileSize: 16,
    });
    expect(snap.centerX).toBe(2);
    expect(snap.centerY).toBe(2);
    expect(snap.x).toBe(0);
    expect(snap.y).toBe(0);
    expect(snap.w).toBe(4);
    expect(snap.h).toBe(4);
  });
});

describe("mapRegionForContext / formatViewportContextBlock", () => {
  it("uses viewport clip when map matches", () => {
    const map = { id: "m", width: 50, height: 50 };
    const region = mapRegionForContext(map, {
      mapId: "m",
      centerX: 20,
      centerY: 10,
      x: 12,
      y: 4,
      w: 16,
      h: 12,
    });
    expect(region).toEqual({ x: 12, y: 4, w: 16, h: 12 });
  });

  it("falls back to top-left when no viewport", () => {
    const map = { id: "m", width: 50, height: 50 };
    expect(mapRegionForContext(map, null)).toEqual({ x: 0, y: 0, w: 20, h: 20 });
  });

  it("formats Korean viewport block with center coords", () => {
    const text = formatViewportContextBlock(
      { mapId: "map_market", centerX: 7, centerY: 4, x: 2, y: 1, w: 10, h: 8 },
      "장터",
    );
    expect(text).toContain("(7, 4)");
    expect(text).toContain("map_market");
    expect(text).toContain("장터");
  });
});

describe("buildSystemPrompt with viewport", () => {
  it("summarizes around viewport instead of always (0,0)", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    // paint a unique lower tile far from origin so grid summary differs
    const farX = 18;
    const farY = 18;
    map.lowerTiles[farY * map.width + farX] = 222;

    const without = buildSystemPrompt(project, { currentMapId: mapId, budgetChars: 50_000 });
    expect(without).toContain("좌상단");

    const withVp = buildSystemPrompt(project, {
      currentMapId: mapId,
      budgetChars: 50_000,
      viewport: {
        mapId,
        centerX: farX,
        centerY: farY,
        x: farX - 4,
        y: farY - 4,
        w: 8,
        h: 8,
      },
    });
    expect(withVp).toContain("뷰포트");
    expect(withVp).toContain(`(${farX}, ${farY})`);
    expect(withVp).not.toContain("좌상단 일부만 표시(뷰포트 없음)");
  });
});

describe("mapRegionImagePayload", () => {
  it("exports lower/upper grids for vision render", () => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const map = project.maps[mapId]!;
    map.lowerTiles[0] = 240;
    map.upperTiles[1] = 237;
    const payload = mapRegionImagePayload(project, mapId, { x: 0, y: 0, w: 2, h: 1 });
    expect(payload).not.toBeNull();
    expect(payload!.lower[0]![0]).toBe(240);
    expect(payload!.upper[0]![1]).toBe(237);
    expect(payload!.tilesetId).toBe(map.tilesetId);
  });
});

describe("AssistantSession viewport user turn", () => {
  it("prepends viewport block to the user message text", async () => {
    const { AssistantSession } = await import("@/ai/assistantSession");
    const project = createBlankProject();
    const mapId = project.startMapId;
    const session = new AssistantSession(project, {
      contextOptions: {
        currentMapId: mapId,
        viewport: {
          mapId,
          centerX: 5,
          centerY: 6,
          x: 1,
          y: 2,
          w: 8,
          h: 6,
        },
      },
      chat: async () => ({
        message: { role: "assistant", content: "ok" },
        finishReason: "stop",
      }),
    });
    await session.sendUserMessage("여기 나무 심어줘");
    const user = session.getMessages().find((m) => m.role === "user");
    expect(typeof user?.content).toBe("string");
    expect(String(user?.content)).toContain("화면 중앙 타일");
    expect(String(user?.content)).toContain("(5, 6)");
    expect(String(user?.content)).toContain("여기 나무 심어줘");
  });
});
