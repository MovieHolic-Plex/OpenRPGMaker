import { describe, expect, it } from "vitest";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { Plaza, Point, Rect } from "@/editor/tools/village/constants";
import { boulevardCells, villageBoulevard, villageBoulevardPath } from "@/editor/tools/village/roads";
import type { ToolContext } from "@/editor/tools/types";

const AREA: Rect = { x: 0, y: 0, w: 80, h: 80 };
const PLAZA: Plaza = { rect: { x: 36, y: 37, w: 8, h: 6 }, centerRow: 40, centerX: 40 };

function manhattan(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function isFourConnected(cells: readonly Point[]): boolean {
  for (let i = 1; i < cells.length; i += 1) {
    const prev = cells[i - 1];
    const cur = cells[i];
    if (prev === undefined || cur === undefined) return false;
    if (manhattan(prev, cur) !== 1) return false;
  }
  return cells.length > 0;
}

describe("villageBoulevardPath", () => {
  it("returns no boulevard when the map is below 72", () => {
    // Given: a 71×80 village area
    const area: Rect = { x: 0, y: 0, w: 71, h: 80 };
    // When: the boulevard gate runs
    // Then: large-map spine stays off
    expect(villageBoulevard(area, PLAZA)).toBeNull();
  });

  it("returns the same path when the seed is unchanged", () => {
    // Given: an 80×80 area and a plaza
    // When: the spine is sampled twice with seed 7
    const first = villageBoulevardPath(AREA, PLAZA, 7);
    const second = villageBoulevardPath(AREA, PLAZA, 7);
    // Then: both axes match exactly
    expect(second).toEqual(first);
  });

  it("returns a different path when the seed changes", () => {
    // Given: an 80×80 area and a plaza
    // When: the spine is sampled with seed 7 and seed 8
    const first = villageBoulevardPath(AREA, PLAZA, 7);
    const second = villageBoulevardPath(AREA, PLAZA, 8);
    // Then: at least one axis differs
    expect(second).not.toEqual(first);
  });

  it("spans every EW column in order and stays 4-connected", () => {
    // Given: an 80×80 boulevard
    // When: the east-west spine is generated
    const { ew } = villageBoulevardPath(AREA, PLAZA, 7);
    const xs = ew.map((cell) => cell.x);
    // Then: every column appears in non-decreasing order and steps are 4-connected
    for (let x = AREA.x; x < AREA.x + AREA.w; x += 1) {
      expect(xs).toContain(x);
    }
    for (let i = 1; i < ew.length; i += 1) {
      const prev = ew[i - 1];
      const cur = ew[i];
      expect(prev).toBeDefined();
      expect(cur).toBeDefined();
      if (prev === undefined || cur === undefined) continue;
      expect(cur.x).toBeGreaterThanOrEqual(prev.x);
    }
    expect(isFourConnected(ew)).toBe(true);
  });

  it("swings EW laterally by at least 3 within 5 of ewRow", () => {
    // Given: the 80×80 boulevard row
    const boulevard = villageBoulevard(AREA, PLAZA);
    expect(boulevard).not.toBeNull();
    if (boulevard === null) return;
    // When: the east-west spine is generated
    const { ew } = villageBoulevardPath(AREA, PLAZA, 7);
    const ys = ew.map((cell) => cell.y);
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    // Then: the curve actually bends, but stays near the frontage row
    expect(hi - lo).toBeGreaterThanOrEqual(3);
    expect(lo).toBeGreaterThanOrEqual(boulevard.ewRow - 5);
    expect(hi).toBeLessThanOrEqual(boulevard.ewRow + 5);
  });

  it("mirrors the NS spine across every row", () => {
    // Given: the 80×80 boulevard column
    const boulevard = villageBoulevard(AREA, PLAZA);
    expect(boulevard).not.toBeNull();
    if (boulevard === null) return;
    // When: the north-south spine is generated
    const { ns } = villageBoulevardPath(AREA, PLAZA, 7);
    const ys = ns.map((cell) => cell.y);
    const xs = ns.map((cell) => cell.x);
    // Then: every row is covered in order, 4-connected, and bent near nsCol
    for (let y = AREA.y; y < AREA.y + AREA.h; y += 1) {
      expect(ys).toContain(y);
    }
    for (let i = 1; i < ns.length; i += 1) {
      const prev = ns[i - 1];
      const cur = ns[i];
      expect(prev).toBeDefined();
      expect(cur).toBeDefined();
      if (prev === undefined || cur === undefined) continue;
      expect(cur.y).toBeGreaterThanOrEqual(prev.y);
    }
    expect(isFourConnected(ns)).toBe(true);
    const lo = Math.min(...xs);
    const hi = Math.max(...xs);
    expect(hi - lo).toBeGreaterThanOrEqual(3);
    expect(lo).toBeGreaterThanOrEqual(boulevard.nsCol - 5);
    expect(hi).toBeLessThanOrEqual(boulevard.nsCol + 5);
  });

  it("covers the path band when boulevardCells receives a seed", () => {
    // Given: a boulevard and seed 7
    const boulevard = villageBoulevard(AREA, PLAZA);
    expect(boulevard).not.toBeNull();
    if (boulevard === null) return;
    const path = villageBoulevardPath(AREA, PLAZA, 7);
    // When: band cells are computed with that seed
    const keys = new Set(boulevardCells(AREA, boulevard, 7).map((cell) => `${cell.x},${cell.y}`));
    // Then: every path cell and its width-3 band is present
    for (const cell of path.ew) {
      for (let dy = -1; dy <= 1; dy += 1) {
        expect(keys.has(`${cell.x},${cell.y + dy}`)).toBe(true);
      }
    }
    for (const cell of path.ns) {
      for (let dx = -1; dx <= 1; dx += 1) {
        expect(keys.has(`${cell.x + dx},${cell.y}`)).toBe(true);
      }
    }
  });
});

describe("build_village curved boulevard", () => {
  it("keeps houses off the curved path band on an 80x80 village", () => {
    // Given: an 80×80 village with seed 7
    const context: ToolContext = { project: createEmptyToolProject("곡선 대로") };
    // When: build_village paints and reserves the spine
    const result = runTool(context, "build_village", {
      seed: 7,
      width: 80,
      height: 80,
      pathStyle: "dirt",
      interior: false,
      decor: false,
      fences: false,
    });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as {
      readonly mapId: string;
      readonly roadComponents: number;
      readonly bounds?: Rect;
    };
    const map = context.project.maps[data.mapId];
    expect(map).toBeDefined();
    if (map === undefined) return;
    const plazaRegion = map.layoutPlan?.regions.find((region) => region.role === "plaza");
    expect(plazaRegion).toBeDefined();
    if (plazaRegion === undefined) return;
    const plaza: Plaza = {
      rect: { x: plazaRegion.x, y: plazaRegion.y, w: plazaRegion.w, h: plazaRegion.h },
      centerRow: plazaRegion.y + Math.floor(plazaRegion.h / 2),
      centerX: plazaRegion.x + Math.floor(plazaRegion.w / 2),
    };
    const area = data.bounds ?? { x: 0, y: 0, w: map.width, h: map.height };
    const boulevard = villageBoulevard(area, plaza);
    expect(boulevard).not.toBeNull();
    if (boulevard === null) return;
    const band = new Set(boulevardCells(area, boulevard, 7).map((cell) => `${cell.x},${cell.y}`));
    const houses = (map.layoutPlan?.regions ?? []).filter((region) => region.role === "house");
    // Then: no house bbox overlaps the reserved curve, and the road is one component
    for (const region of houses) {
      for (let y = region.y; y < region.y + region.h; y += 1) {
        for (let x = region.x; x < region.x + region.w; x += 1) {
          expect(band.has(`${x},${y}`), `house ${region.id} overlaps boulevard at ${x},${y}`).toBe(false);
        }
      }
    }
    expect(data.roadComponents).toBe(1);
  }, 120_000);
});
