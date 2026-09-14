import { describe, expect, it } from "vitest";
import { plantCompactVillageTrees, dressCompactVillageGround } from "@/editor/tools/village/compactVegetation";
import { protectedHouseCells } from "@/editor/tools/houseProtection";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { canMove } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { TILE } from "@/project/defaults/constants";
import { SAND_TILE } from "@/project/defaults/chipsetMapping";
import { DEFAULT_TALL_GRASS_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { autotileVariantForCell } from "@/project/defaults/autotileEngine";
import { validateClusterRules } from "@/project/lint/clusterRuleValidators";
import { validateLayoutPlacement } from "@/project/lint/layoutPlacementValidate";
import type { GameMap, MapLayoutRegion } from "@/project/types";

function village(size = 96) {
  const project = createBlankProject(), map = project.maps.map_blank_start;
  Object.assign(map, { width: size, height: size, lowerTiles: Array(size * size).fill(TILE.GRASS),
    upperTiles: Array(size * size).fill(TILE.EMPTY), events: [] });
  project.startPos = { x: 5, y: 5 };
  const regions: MapLayoutRegion[] = [];
  const stepX = Math.floor((size - 20) / 6), stepY = Math.floor((size - 22) / 4);
  for (let y = 0; y < size; y += 1) map.lowerTiles[y * size + 5] = SAND_TILE.BODY;
  for (let row = 0; row < 4; row += 1) {
    const y = 11 + row * stepY;
    for (let x = 5; x < size - 5; x += 1) map.lowerTiles[(y + 8) * size + x] = SAND_TILE.BODY;
    for (let column = 0; column < 6; column += 1) {
      const x = 10 + column * stepX, doorAt = { x: x + 3, y: y + 5 }, front = { x: x + 3, y: y + 6 };
      regions.push({ id: `house-${row}-${column}`, role: "house", label: "test house", x, y, w: 8, h: 6, doorAt, front });
      for (let dy = 0; dy < 6; dy += 1) for (let dx = 0; dx < 8; dx += 1) map.lowerTiles[(y + dy) * size + x + dx] = 76;
      map.lowerTiles[doorAt.y * size + doorAt.x] = 146;
      map.lowerTiles[(doorAt.y - 1) * size + doorAt.x] = 116;
      for (let dy = 6; dy <= 8; dy += 1) map.lowerTiles[(y + dy) * size + x + 3] = SAND_TILE.BODY;
    }
  }
  // Exact object provenance access can extend beyond the conventional yard.
  const access = [{ x: 38, y: 5 }, { x: 38, y: 6 }, { x: 38, y: 7 }];
  Object.assign(regions[0]!, { objectExterior: { objectId: "saved-house", revision: 3, doorApproaches: [access[0]], privateAccess: access } });
  map.layoutPlan = { version: 1, kind: "houses", regions };
  map.upperTileStacks = { [7 * size + 52]: [409] };
  const water = new Set<number>();
  for (let y = 1; y < 8; y += 1) for (let x = size - 19; x < size - 3; x += 1) water.add(y * size + x);
  const area = { x: 0, y: 0, w: size, h: size };
  return { project, map, area, water, access };
}

function reachable(project: ReturnType<typeof createBlankProject>, map: GameMap): Set<number> {
  const start = project.startPos.y * map.width + project.startPos.x, seen = new Set([start]), queue = [start];
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const index = queue[cursor]!, x = index % map.width, y = Math.floor(index / map.width);
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nextX = x + dx!, nextY = y + dy!, next = nextY * map.width + nextX;
      if (seen.has(next) || !canMove(project, map, x, y, nextX, nextY)) continue;
      seen.add(next); queue.push(next);
    }
  }
  return seen;
}

describe("compact village vegetation", () => {
  it.each([80, 96, 100])("makes visible exterior woods and interior groves around 24 houses on %i tiles", (size) => {
    const { project, map, area, water, access } = village(size), before = structuredClone(map);
    const tree = plantCompactVillageTrees(project, map, area, 3917, water);
    expect(tree.footprintCells / tree.eligibleCells).toBeGreaterThan(0.30);
    expect(tree.broadleafTrees).toBeGreaterThan(40);
    expect(tree.conifers).toBeGreaterThan(40);
    expect(tree.edgeCells).toBeGreaterThan(size * 8);
    expect(tree.innerCells).toBeGreaterThan(size * 2);
    expect(tree.groves).toBeGreaterThan(8);
    const actualOverlaps = map.lowerTiles.filter((tile, index) => [290, 292, 293].includes(tile)
      && [260, 262, 263].includes(map.upperTiles[index]!)).length;
    expect(actualOverlaps).toBeGreaterThan(size * 3);
    expect(tree.overlapCells).toBe(actualOverlaps);
    // Trees first: this stage has not scattered grass fragments or flower props.
    const treeOnly = structuredClone(map);
    const grass = dressCompactVillageGround(project, map, area, 3917, water);
    expect(grass.tallGrassCells).toBeGreaterThan(size * 6);
    expect(grass.tallGrassPatches).toBeGreaterThan(8);
    expect(grass.edgeGrassCells / grass.edgeEligibleCells).toBeGreaterThan(0.9);
    expect(grass.edgeGrassCells / grass.edgeEligibleCells)
      .toBeGreaterThan(grass.innerGrassCells / grass.innerEligibleCells + 0.3);
    expect(grass.flowerClusters).toBeGreaterThan(5);
    expect(grass.flowerCells).toBeGreaterThan(20);
    const protectedCells = new Set([...protectedHouseCells(map).map(({ x, y }) => y * size + x),
      ...water, ...access.map(({ x, y }) => y * size + x), 7 * size + 52]);
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      if (before.lowerTiles[index] === SAND_TILE.BODY) protectedCells.add(index);
      if ([290, 292, 293].includes(treeOnly.lowerTiles[index]!)) expect(map.lowerTiles[index]).toBe(treeOnly.lowerTiles[index]);
      if ([260, 262, 263].includes(treeOnly.upperTiles[index]!)) expect(map.upperTiles[index]).toBe(treeOnly.upperTiles[index]);
    }
    for (const index of protectedCells) {
      expect(map.lowerTiles[index]).toBe(before.lowerTiles[index]);
      expect(map.upperTiles[index]).toBe(before.upperTiles[index]);
    }
    expect(map.lowerTileStacks).toEqual(before.lowerTileStacks);
    expect(map.upperTileStacks).toEqual(before.upperTileStacks);
    expect(map.layoutPlan).toEqual(before.layoutPlan);
    const reached = reachable(project, map);
    for (const house of map.layoutPlan!.regions) expect(reached.has(house.front!.y * size + house.front!.x)).toBe(true);
    expect(validateClusterRules(project, map.id).filter(issue => issue.severity === "error")).toEqual([]);
    expect(validateLayoutPlacement(project, { mapId: map.id }).filter(issue => issue.severity === "error")).toEqual([]);
    const tileset = project.tilesets[map.tilesetId]!;
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      if (map.lowerTiles[index] !== before.lowerTiles[index]) expect(tileLayerHome(tileset, map.lowerTiles[index]!)).not.toBe("upper");
      if (map.upperTiles[index] !== before.upperTiles[index]) expect(tileLayerHome(tileset, map.upperTiles[index]!)).not.toBe("lower");
    }
  });

  it("uses actual tall-grass edge/body variants and has no one-cell dots", () => {
    const { project, map, area, water } = village();
    dressCompactVillageGround(project, map, area, 718, water);
    const group = DEFAULT_TALL_GRASS_AUTOTILE_GROUP, members = new Set(group.memberTileIds), histogram = new Set<number>();
    for (let index = 0; index < map.lowerTiles.length; index += 1) {
      const tile = map.lowerTiles[index]!;
      if (!members.has(tile)) continue;
      const x = index % map.width, y = Math.floor(index / map.width);
      expect(tile).toBe(autotileVariantForCell(map, group, x, y));
      expect(tile).not.toBe(243);
      histogram.add(tile);
    }
    expect(histogram.has(304)).toBe(true);
    expect(histogram.size).toBeGreaterThan(6);
  });

  it("retains an existing walkable route for an event standing between roads", () => {
    const { project, map, area, water } = village();
    map.events.push({ id: "field-event", name: "Field event", x: 27, y: 8, trigger: { kind: "action" }, commands: [] });
    expect(reachable(project, map).has(8 * map.width + 27)).toBe(true);
    plantCompactVillageTrees(project, map, area, 220, water);
    dressCompactVillageGround(project, map, area, 220, water);
    expect(reachable(project, map).has(8 * map.width + 27)).toBe(true);
  });

  it("is deterministic and leaves existing grass/stamps outside a bounded area exact", () => {
    const a = village(), b = village(), bounds = { x: 11, y: 11, w: 60, h: 60 };
    const old = 12 * a.map.width + 12;
    for (const fixture of [a, b]) fixture.map.lowerTiles[old] = 273;
    const before = structuredClone(a.map);
    const generate = (fixture: typeof a) => [plantCompactVillageTrees(fixture.project, fixture.map, bounds, 91, fixture.water),
      dressCompactVillageGround(fixture.project, fixture.map, bounds, 91, fixture.water)];
    expect(generate(a)).toEqual(generate(b)); expect(a.map).toEqual(b.map);
    expect(a.map.lowerTiles[old]).toBe(273);
    for (let index = 0; index < a.map.lowerTiles.length; index += 1) {
      const x = index % a.map.width, y = Math.floor(index / a.map.width);
      if (x >= 11 && x < 71 && y >= 11 && y < 71) continue;
      expect(a.map.lowerTiles[index]).toBe(before.lowerTiles[index]);
      expect(a.map.upperTiles[index]).toBe(before.upperTiles[index]);
    }
  });
});
