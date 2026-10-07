import { describe, expect, it } from "vitest";
import {
  formatResolvedSpatialBlock,
  implicitSpecFromViewLocation,
  parseSpatialPhrase,
  resolveSpatialRect,
  resolveTurnViewLocation,
  viewportVisibleFrame,
} from "@/ai/viewRelativeLocation";
import { computeMapViewport } from "@/ai/mapViewportContext";

describe("parseSpatialPhrase", () => {
  it("reads 오른쪽 위 as the north-east corner of the view", () => {
    expect(parseSpatialPhrase("마을 깔고, 오른쪽 위에 숲을깔라")).toEqual({
      phrase: "오른쪽 위",
      horizontal: "right",
      vertical: "top",
    });
  });

  it("does not treat 위치 as 위", () => {
    expect(parseSpatialPhrase("이 위치에 집을 세워")).toBeNull();
  });

  it("reads a single side as a half of the view", () => {
    expect(parseSpatialPhrase("왼쪽에 강")).toEqual({
      phrase: "왼쪽",
      horizontal: "left",
      vertical: "center",
    });
  });
});

describe("resolveSpatialRect", () => {
  const frame = { x: 10, y: 4, w: 20, h: 12 };

  it("maps 오른쪽 위 onto the north-east quadrant of the given frame", () => {
    const parsed = parseSpatialPhrase("오른쪽 위");
    expect(parsed).not.toBeNull();
    expect(resolveSpatialRect(frame, parsed!)).toEqual({ x: 20, y: 4, w: 10, h: 6 });
  });

  it("maps 왼쪽 onto the left half", () => {
    const parsed = parseSpatialPhrase("왼쪽");
    expect(parsed).not.toBeNull();
    expect(resolveSpatialRect(frame, parsed!)).toEqual({ x: 10, y: 4, w: 10, h: 12 });
  });
});

describe("viewport visible frame vs clipped context", () => {
  it("keeps the unclipped camera rect so 오른쪽 위 is the screen, not the 16-tile clip", () => {
    const snap = computeMapViewport(
      { id: "map_a", width: 40, height: 30 },
      {
        worldLeftPx: 160,
        worldTopPx: 80,
        worldWidthPx: 320,
        worldHeightPx: 240,
        tileSize: 16,
      },
    );
    expect(snap.w).toBeLessThanOrEqual(16);
    const visible = viewportVisibleFrame(snap);
    expect(visible.w).toBe(20);
    expect(visible.h).toBe(15);
    const parsed = parseSpatialPhrase("오른쪽 위");
    expect(parsed).not.toBeNull();
    const rect = resolveSpatialRect(visible, parsed!);
    expect(rect.x).toBeGreaterThanOrEqual(visible.x + Math.floor(visible.w / 2));
    expect(rect.y).toBe(visible.y);
    expect(rect.x + rect.w).toBe(visible.x + visible.w);
  });
});

describe("prompt wiring", () => {
  it("resolves an explicit screen placement but leaves map placement to the map spec", () => {
    // Given the same directional instruction with two different frames of reference.
    const viewport = { mapId: "map_market", centerX: 7, centerY: 4, x: 2, y: 1, w: 10, h: 8 };
    // When resolving each instruction, then only the explicit viewport creates a screen box.
    expect(resolveTurnViewLocation("화면 오른쪽 위에 연못을 만들어", viewport)?.rect).toEqual({ x: 7, y: 1, w: 5, h: 4 });
    expect(resolveTurnViewLocation("맵 오른쪽 위에 연못을 만들어", viewport)).toBeNull();
  });

  it("prints the computed box so the model cannot guess coordinates", () => {
    const block = formatResolvedSpatialBlock({
      phrase: "오른쪽 위",
      frame: { x: 10, y: 4, w: 20, h: 12 },
      rect: { x: 20, y: 4, w: 10, h: 6 },
    });
    expect(block).toContain("(20,4)");
    expect(block).toContain("10×6");
    expect(block).toContain("추측 금지");
  });
});

describe("implicitSpecFromViewLocation", () => {
  it("turns a forest phrase into a prop asset on the computed box", () => {
    const spec = implicitSpecFromViewLocation({
      mapId: "map_12",
      requestText: "화면 오른쪽 위에 숲을깔라",
      rect: { x: 20, y: 4, w: 10, h: 6 },
    });
    expect(spec).toEqual({
      mapId: "map_12",
      title: "화면 기준 위치: 오른쪽 위",
      assets: [{ id: "위치 지시", kind: "prop", x: 20, y: 4, w: 10, h: 6 }],
    });
  });
});
