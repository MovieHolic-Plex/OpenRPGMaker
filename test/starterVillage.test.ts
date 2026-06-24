import { describe, expect, it } from "vitest";
import { createStarterMap, TILE } from "@/project/defaults";
import { dirtLikeTiles } from "@/project/defaults/chipsetMapping";

const STARTER_VILLAGE_SMALL_HOUSE_PATTERN = [
  [374, 375, 374, 375, 374],
  [404, 405, 404, 405, 404],
  [102, 103, 103, 103, 104],
  [132, 133, 329, 133, 134],
  [162, 163, 359, 163, 164],
] as const;

const STARTER_VILLAGE_HOUSE_DOOR_APPROACHES = [
  { x: 7, y: 10 },
  { x: 21, y: 10 },
  { x: 7, y: 22 },
] as const;
const STARTER_VILLAGE_FIRST_DOOR_APPROACH = STARTER_VILLAGE_HOUSE_DOOR_APPROACHES[0];

type PatternSubject = {
  readonly tiles: readonly number[];
  readonly mapWidth: number;
  readonly mapHeight: number;
};

describe("starter village map", () => {
  it("builds the default 마을 as a 30x30 village with exactly three small houses and connected roads", () => {
    // Given: the starter map factory creates the first user-visible map.
    // When: the default starter map is generated.
    const m = createStarterMap();

    // Then: the map has the requested compact village shape.
    expect(m.name).toBe("마을");
    expect(m.width).toBe(30);
    expect(m.height).toBe(30);
    expect(m.lowerTiles.length).toBe(30 * 30);
    expect(m.upperTiles.length).toBe(30 * 30);
    expect(countPatternOccurrences({ tiles: m.lowerTiles, mapWidth: m.width, mapHeight: m.height }, STARTER_VILLAGE_SMALL_HOUSE_PATTERN)).toBe(3);
    expect(roadComponentSize(m, STARTER_VILLAGE_FIRST_DOOR_APPROACH)).toBe(roadTileCount(m));
    for (const approach of STARTER_VILLAGE_HOUSE_DOOR_APPROACHES) {
      expect(isDirtRoadTile(m.lowerTiles[approach.y * m.width + approach.x] ?? TILE.EMPTY)).toBe(true);
      expect(roadComponentContains(m, STARTER_VILLAGE_FIRST_DOOR_APPROACH, approach)).toBe(true);
      expect(m.upperTiles[approach.y * m.width + approach.x]).toBe(TILE.EMPTY);
    }
  });

  it("keeps the compact village boundary walled", () => {
    const m = createStarterMap();
    for (let x = 0; x < m.width; x += 1) {
      expect(m.lowerTiles[0 * m.width + x]).toBe(TILE.WALL);
      expect(m.lowerTiles[(m.height - 1) * m.width + x]).toBe(TILE.WALL);
    }
    for (let y = 0; y < m.height; y += 1) {
      expect(m.lowerTiles[y * m.width + 0]).toBe(TILE.WALL);
      expect(m.lowerTiles[y * m.width + (m.width - 1)]).toBe(TILE.WALL);
    }
  });

  it("uses chipset-aligned dirt tiles for the connected village road", () => {
    const m = createStarterMap();
    const roadTiles = new Set<number>(dirtLikeTiles());
    const roadSamples = [
      { x: 4, y: 10 },
      { x: 14, y: 11 },
      { x: 23, y: 12 },
      { x: 7, y: 22 },
      { x: 15, y: 24 },
    ] as const;
    expect(roadTiles.has(TILE.PATH)).toBe(true);
    for (const point of roadSamples) {
      const tile = m.lowerTiles[point.y * m.width + point.x];
      expect(tile).toBeDefined();
      expect(roadTiles.has(tile ?? TILE.EMPTY)).toBe(true);
      expect(m.upperTiles[point.y * m.width + point.x]).toBe(TILE.EMPTY);
    }
  });
});

function countPatternOccurrences(
  subject: PatternSubject,
  pattern: readonly (readonly number[])[]
): number {
  let count = 0;
  const patternHeight = pattern.length;
  const patternWidth = pattern[0]?.length ?? 0;
  for (let y = 0; y <= subject.mapHeight - patternHeight; y += 1) {
    for (let x = 0; x <= subject.mapWidth - patternWidth; x += 1) {
      if (matchesPatternAt(subject, pattern, { x, y })) count += 1;
    }
  }
  return count;
}

function matchesPatternAt(
  subject: PatternSubject,
  pattern: readonly (readonly number[])[],
  origin: { readonly x: number; readonly y: number }
): boolean {
  for (let y = 0; y < pattern.length; y += 1) {
    const row = pattern[y];
    if (!row) return false;
    for (let x = 0; x < row.length; x += 1) {
      const tile = row[x];
      if (tile !== undefined && tile >= 0 && subject.tiles[(origin.y + y) * subject.mapWidth + origin.x + x] !== tile) return false;
    }
  }
  return true;
}

function roadTileCount(map: ReturnType<typeof createStarterMap>): number {
  return map.lowerTiles.filter(isDirtRoadTile).length;
}

function roadComponentSize(map: ReturnType<typeof createStarterMap>, start: { readonly x: number; readonly y: number }): number {
  return collectRoadComponent(map, start).size;
}

function roadComponentContains(
  map: ReturnType<typeof createStarterMap>,
  start: { readonly x: number; readonly y: number },
  target: { readonly x: number; readonly y: number }
): boolean {
  return collectRoadComponent(map, start).has(pointKey(target));
}

function collectRoadComponent(map: ReturnType<typeof createStarterMap>, start: { readonly x: number; readonly y: number }): Set<string> {
  const visited = new Set<string>();
  const queue = [start];
  while (queue.length > 0) {
    const point = queue.shift();
    if (!point) continue;
    const key = pointKey(point);
    if (visited.has(key)) continue;
    const tile = map.lowerTiles[point.y * map.width + point.x] ?? TILE.EMPTY;
    if (!isDirtRoadTile(tile)) continue;
    visited.add(key);
    queue.push(
      { x: point.x + 1, y: point.y },
      { x: point.x - 1, y: point.y },
      { x: point.x, y: point.y + 1 },
      { x: point.x, y: point.y - 1 }
    );
  }
  return visited;
}

function pointKey(point: { readonly x: number; readonly y: number }): string {
  return `${point.x},${point.y}`;
}

function isDirtRoadTile(tile: number): boolean {
  return dirtLikeTiles().includes(tile);
}
