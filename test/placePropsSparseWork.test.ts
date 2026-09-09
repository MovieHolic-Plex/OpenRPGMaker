import { describe, expect, it, vi } from "vitest";
import { poissonScatter } from "@/editor/tools/naturalScatter";
import { placePropsOnDraft } from "@/editor/tools/placePropsDomain";
import { createBlankMap, createBlankProject, TILE } from "@/project/defaults";
import { mulberry32 } from "@/util/rng";

function everyPredicateVisits(run: () => void): number {
  const original = Array.prototype.every;
  let visits = 0;
  const observer = vi.spyOn(Array.prototype, "every").mockImplementation(function (this: unknown[], predicate, thisArg) {
    return original.call(this, (value, index, array) => {
      visits += 1;
      return predicate.call(thisArg, value, index, array);
    });
  });
  try { run(); } finally { observer.mockRestore(); }
  return visits;
}

function pointSomePredicateVisits(run: () => void): number {
  const original = Array.prototype.some;
  let visits = 0;
  const observer = vi.spyOn(Array.prototype, "some").mockImplementation(function (this: unknown[], predicate, thisArg) {
    return original.call(this, (value, index, array) => {
      if (typeof value === "object" && value !== null && "x" in value && "y" in value) visits += 1;
      return predicate.call(thisArg, value, index, array);
    });
  });
  try { run(); } finally { observer.mockRestore(); }
  return visits;
}

function fixture() {
  const project = createBlankProject();
  const map = createBlankMap("Sparse contract", 20, 20);
  map.id = "sparse-contract";
  project.maps[map.id] = map;
  return { project, map, area: { x: 2, y: 2, w: 16, h: 16 } };
}

describe("zero-gap candidate work", () => {
  it.each([0, -2])("gap %s keeps the seeded permutation without pairwise predicate visits", (gap) => {
    const bounds = { x: 2, y: 2, width: 16, height: 16 };
    let actual: ReturnType<typeof poissonScatter> | undefined;
    // Observe work while preserving every actual predicate and its result.
    const visits = everyPredicateVisits(() => { actual = poissonScatter(bounds, 256, gap, mulberry32(17)); });
    expect(visits).toBe(0);
    // Distinct integer cells are already >= 1 apart. This unchanged positive-gap
    // path supplies the same full seeded order, not a second shuffle implementation.
    let reference: ReturnType<typeof poissonScatter> | undefined;
    const controlVisits = everyPredicateVisits(() => { reference = poissonScatter(bounds, 256, 1, mulberry32(17)); });
    expect(controlVisits).toBe(256 * 255 / 2);
    expect(actual).toEqual(reference);
  });

  it.each([[0, 0, 0], [3.9, 3, 0], [300, 256, 44]])(
    "request %s preserves count normalization, uniqueness and missing count", (count, placed, missing) => {
      const result = poissonScatter({ x: 0, y: 0, width: 16, height: 16 }, count, 0, mulberry32(17));
      expect(result.points).toHaveLength(placed);
      expect(new Set(result.points.map(({ x, y }) => `${x},${y}`)).size).toBe(placed);
      expect(result.missing).toBe(missing);
    },
  );
});

describe("sparse prop acceptance", () => {
  it("does not add quadratic accepted-point scans when minGap is zero", () => {
    const { project, map, area } = fixture();
    let result: ReturnType<typeof placePropsOnDraft> | undefined;
    const visits = pointSomePredicateVisits(() => {
      result = placePropsOnDraft(project, { mapId: map.id, area, material: "나무 상자", count: 256, minGap: 0, seed: 17 });
    });
    expect(result?.data).toMatchObject({ placed: 256, requested: 256 });
    // Includes the real in-bounds candidate scan, but not an all-pairs loop.
    expect(visits).toBeLessThanOrEqual(area.w * area.h);
  });

  it("fills every requested available slot without consuming count on obstacles", () => {
    const { project, map, area } = fixture();
    const free = [[2, 2], [2, 5], [5, 2], [5, 5]] as const;
    const freeKeys = new Set(free.map(([x, y]) => `${x},${y}`));
    for (let y = 2; y < 18; y++) for (let x = 2; x < 18; x++) {
      map.upperTiles[y * map.width + x] = freeKeys.has(`${x},${y}`) ? TILE.EMPTY : TILE.FLOWERS;
    }
    const result = placePropsOnDraft(project, { mapId: map.id, area, material: "나무 상자", count: 4, minGap: 3, seed: 17 });
    expect(result.data).toMatchObject({ placed: 4, requested: 4, tileId: 237 });
    for (let y = 2; y < 18; y++) for (let x = 2; x < 18; x++) {
      expect(map.upperTiles[y * map.width + x]).toBe(freeKeys.has(`${x},${y}`) ? 237 : TILE.FLOWERS);
      expect(map.lowerTiles[y * map.width + x]).toBe(TILE.GRASS);
    }
  });

  it("preserves minGap between accepted props and deterministic replay", () => {
    const first = fixture();
    const second = fixture();
    for (const entry of [first, second]) {
      const result = placePropsOnDraft(entry.project, { mapId: entry.map.id, area: entry.area, material: "나무 상자", count: 12, minGap: 3, seed: 17 });
      expect(result.data).toMatchObject({ placed: 12, requested: 12 });
    }
    expect(first.map.upperTiles).toEqual(second.map.upperTiles);
    const points = first.map.upperTiles.flatMap((tile, index) => tile === 237 ? [{ x: index % first.map.width, y: Math.floor(index / first.map.width) }] : []);
    expect(points).toHaveLength(12);
    for (const [index, point] of points.entries()) for (const other of points.slice(index + 1)) {
      expect((point.x - other.x) ** 2 + (point.y - other.y) ** 2).toBeGreaterThanOrEqual(9);
    }
  });
});
