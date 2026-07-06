import { describe, expect, it } from "vitest";
import { lineCells, type Point } from "@/editor/tools/mapHelpers";
import {
  clusterScatter,
  jitterPlacement,
  poissonScatter,
  wobblePath,
  type ScatterBounds,
} from "@/editor/tools/naturalScatter";
import { mulberry32 } from "@/util/rng";

describe("naturalScatter wobblePath", () => {
  it("replays the same seeded wobble snapshot", () => {
    const points = [{ x: 2, y: 2 }, { x: 18, y: 7 }, { x: 23, y: 18 }];
    const first = wobblePath(points, 0.78, mulberry32(12345));
    const second = wobblePath(points, 0.78, mulberry32(12345));

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.path.length).toBeGreaterThan(points.length);
    expect(first.widthCells.length).toBeGreaterThan(0);
  });

  it("changes naturalized paths when the seed changes", () => {
    const points = [{ x: 3, y: 3 }, { x: 25, y: 12 }, { x: 30, y: 4 }];

    expect(wobblePath(points, 0.9, mulberry32(1)).path).not.toEqual(wobblePath(points, 0.9, mulberry32(2)).path);
  });

  it("matches lineCells exactly at naturalness 0 for horizontal lines", () => {
    const from = { x: 1, y: 4 };
    const to = { x: 9, y: 4 };

    expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
  });

  it("matches lineCells exactly at naturalness 0 for vertical lines", () => {
    const from = { x: 6, y: 2 };
    const to = { x: 6, y: 11 };

    expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
  });

  it("matches lineCells exactly at naturalness 0 for diagonal lines", () => {
    const from = { x: 2, y: 2 };
    const to = { x: 9, y: 6 };

    expect(wobblePath([from, to], 0, mulberry32(1)).path).toEqual(lineCells(from, to));
  });

  it("treats negative naturalness as the lineCells-compatible zero case", () => {
    const from = { x: 9, y: 8 };
    const to = { x: 1, y: 3 };

    expect(wobblePath([from, to], -0.4, mulberry32(999)).path).toEqual(lineCells(from, to));
  });

  it("returns a 4-connected naturalized path with fixed endpoints", () => {
    const result = wobblePath([{ x: 1, y: 1 }, { x: 14, y: 9 }], 0.7, mulberry32(77));

    expect(result.path[0]).toEqual({ x: 1, y: 1 });
    expect(result.path[result.path.length - 1]).toEqual({ x: 14, y: 9 });
    expectFourConnected(result.path);
  });

  it("removes duplicate path cells and keeps width cells separate", () => {
    const result = wobblePath([{ x: 2, y: 2 }, { x: 20, y: 8 }, { x: 5, y: 14 }], 0.95, mulberry32(2026));
    const pathKeys = new Set(keys(result.path));

    expect(pathKeys.size).toBe(result.path.length);
    expect(result.widthCells.length).toBeGreaterThan(0);
    expect(result.widthCells.every((cell) => !pathKeys.has(key(cell)))).toBe(true);
  });

  it("clamps naturalized wobble output to the non-negative waypoint envelope", () => {
    const result = wobblePath([{ x: 0, y: 0 }, { x: 9, y: 0 }], 1, mulberry32(42));

    expect([...result.path, ...result.widthCells].every((cell) => cell.x >= 0 && cell.y >= 0)).toBe(true);
  });
});

describe("naturalScatter poissonScatter", () => {
  it("keeps every accepted point at least minGap cells apart", () => {
    const result = poissonScatter({ x: 0, y: 0, width: 12, height: 12 }, 20, 2, mulberry32(7));

    expect(result.missing).toBe(0);
    expect(result.points).toHaveLength(20);
    expectUnique(result.points);
    expectMinGap(result.points, 2);
  });

  it("returns the possible amount and missing count when the request is impossible", () => {
    const result = poissonScatter({ x: 0, y: 0, width: 2, height: 2 }, 4, 3, mulberry32(8));

    expect(result.points).toHaveLength(1);
    expect(result.missing).toBe(3);
  });

  it("returns no points and no missing count for count 0", () => {
    expect(poissonScatter({ x: 0, y: 0, width: 5, height: 5 }, 0, 2, mulberry32(1))).toEqual({ points: [], missing: 0 });
  });

  it("is deterministic for the same seed", () => {
    const bounds = { x: 3, y: 4, width: 8, height: 7 };

    expect(poissonScatter(bounds, 12, 1.5, mulberry32(444))).toEqual(poissonScatter(bounds, 12, 1.5, mulberry32(444)));
  });
});

describe("naturalScatter clusterScatter", () => {
  it("clusters most points near the supplied anchor", () => {
    const bounds = { x: 0, y: 0, width: 30, height: 30 };
    const anchor = { x: 15, y: 15 };
    const points = clusterScatter(bounds, [anchor], 40, 2, mulberry32(12));
    const averageDistance = points.reduce((sum, point) => sum + distance(point, anchor), 0) / points.length;

    expect(points).toHaveLength(40);
    expectUnique(points);
    expectInBounds(points, bounds);
    expect(averageDistance).toBeLessThan(4);
  });

  it("creates deterministic seed anchors when none are supplied", () => {
    const bounds = { x: 4, y: 5, width: 10, height: 9 };
    const first = clusterScatter(bounds, [], 18, 1.5, mulberry32(313));
    const second = clusterScatter(bounds, [], 18, 1.5, mulberry32(313));

    expect(first).toEqual(second);
    expect(first).toHaveLength(18);
    expectUnique(first);
    expectInBounds(first, bounds);
  });

  it("caps dense clusters to available cells", () => {
    const points = clusterScatter({ x: 0, y: 0, width: 3, height: 2 }, [{ x: 1, y: 1 }], 20, 1, mulberry32(5));

    expect(points).toHaveLength(6);
    expectUnique(points);
  });
});

describe("naturalScatter jitterPlacement", () => {
  it("finds a valid jitter candidate by scanning rings", () => {
    const result = jitterPlacement({ x: 5, y: 5 }, 2, mulberry32(17), (candidate) => candidate.x === 6 && candidate.y === 5);

    expect(result).toEqual({ x: 6, y: 5 });
  });

  it("falls back to the original position when no jitter is valid", () => {
    const origin = { x: 5, y: 5 };

    expect(jitterPlacement(origin, 3, mulberry32(99), () => false)).toEqual(origin);
  });

  it("never returns a candidate outside maxOffset", () => {
    const origin = { x: 10, y: 10 };
    const result = jitterPlacement(origin, 2, mulberry32(21), (candidate) => candidate.x !== origin.x || candidate.y !== origin.y);

    expect(Math.max(Math.abs(result.x - origin.x), Math.abs(result.y - origin.y))).toBeLessThanOrEqual(2);
  });
});

function expectFourConnected(points: readonly Point[]): void {
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    expect(Math.abs(point.x - previous.x) + Math.abs(point.y - previous.y)).toBe(1);
  }
}

function expectUnique(points: readonly Point[]): void {
  expect(new Set(keys(points)).size).toBe(points.length);
}

function expectMinGap(points: readonly Point[], minGap: number): void {
  for (let a = 0; a < points.length; a += 1) {
    for (let b = a + 1; b < points.length; b += 1) expect(distance(points[a], points[b])).toBeGreaterThanOrEqual(minGap);
  }
}

function expectInBounds(points: readonly Point[], bounds: ScatterBounds): void {
  for (const point of points) {
    expect(point.x).toBeGreaterThanOrEqual(bounds.x);
    expect(point.y).toBeGreaterThanOrEqual(bounds.y);
    expect(point.x).toBeLessThan(bounds.x + bounds.width);
    expect(point.y).toBeLessThan(bounds.y + bounds.height);
  }
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function keys(points: readonly Point[]): string[] {
  return points.map(key);
}

function key(point: Point): string {
  return `${point.x},${point.y}`;
}
