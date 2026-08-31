import { describe, expect, it } from "vitest";
import {
  formatResolvedSpatialBlock,
  implicitSpecFromViewLocation,
  parseSpatialPhrase,
  resolveSpatialRect,
  viewportVisibleFrame,
} from "@/ai/viewRelativeLocation";
import { computeMapViewport, formatViewportContextBlock } from "@/ai/mapViewportContext";
import { inferRequirementsFromQuery } from "@/editor/tools/villageRequirements";
import { buildTerrainConstraintMasks } from "@/editor/tools/villageTerrainPass";

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
        scrollX: 160,
        scrollY: 80,
        zoom: 1,
        viewWidthPx: 320,
        viewHeightPx: 240,
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
  it("tells the model 위/아래/왼쪽/오른쪽 are the visible screen, not the whole map", () => {
    const text = formatViewportContextBlock(
      { mapId: "map_market", centerX: 7, centerY: 4, x: 2, y: 1, w: 10, h: 8 },
      "장터",
    );
    expect(text).toContain("위");
    expect(text).toContain("오른쪽");
    expect(text).toContain("지금 보고 있는 화면");
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
      requestText: "오른쪽 위에 숲을깔라",
      rect: { x: 20, y: 4, w: 10, h: 6 },
    });
    expect(spec).toEqual({
      mapId: "map_12",
      title: "화면 기준 위치: 오른쪽 위",
      assets: [{ id: "위치 지시", kind: "prop", x: 20, y: 4, w: 10, h: 6 }],
    });
  });
});

describe("village forest follows the spoken corner", () => {
  it("does not default 오른쪽 위 forest to the river's opposite bank", () => {
    const req = inferRequirementsFromQuery("마을 깔고, 오른쪽 위에 숲을깔라");
    expect(req.landmarks).toContain("forest");
    expect(req.forestAnchor).toEqual({ horizontal: "right", vertical: "top" });
    expect(req.forestSide).toBe("east");
  });

  it("masks forest in the north-east of the build area, not a full east strip", () => {
    const req = inferRequirementsFromQuery("오른쪽 위에 숲 있는 마을");
    const masks = buildTerrainConstraintMasks({ width: 40, height: 24 }, req);
    expect(masks.forestRects).toHaveLength(1);
    const forest = masks.forestRects[0]!;
    expect(forest.x).toBeGreaterThanOrEqual(20);
    expect(forest.y).toBeLessThan(12);
    expect(forest.y + forest.h).toBeLessThanOrEqual(12);
  });
});
