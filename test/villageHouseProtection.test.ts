import { describe, expect, it } from "vitest";
import { captureHouseProtection, protectedHouseCells } from "@/editor/tools/houseProtection";
import { buildVillageDomain, paintGroundThemeStrip } from "@/editor/tools/village/builder";
import { dressVillageLandscape } from "@/editor/tools/village/landscape";
import { paintRoadStrip } from "@/editor/tools/village/roads";
import { paintMarketDeck, paintFlowerField, paintPlazaFence, placeMarketDeckProps } from "@/editor/tools/village/plaza";
import { placeStoneToppings } from "@/editor/tools/village/decor";
import { createExistingProject } from "./authorVillageFacadeFixtures";
import { TILE } from "@/project/defaults/constants";
import { SAND_TILE, COBBLE_TILE } from "@/project/defaults/chipsetMapping";
import { DEFAULT_SNOW_AUTOTILE_GROUP } from "@/project/defaults/autotileGroups";
import { mulberry32 } from "@/util/rng";
import type { GameMap } from "@/project/types";

function own(map: GameMap, rect = { x: 3, y: 3, w: 4, h: 4 }): void {
  map.layoutPlan = { version: 1, kind: "existing", regions: [
    { id: "village_commons", role: "plaza", label: "Original commons", x: 0, y: 0, w: 1, h: 1 },
    { id: "village_house_1", role: "house", label: "Human edited", ...rect },
  ] };
  const cells = protectedHouseCells(map);
  map.lowerTileStacks = { [cells[0]!.y * map.width + cells[0]!.x]: [] };
  map.upperTileStacks = { [cells[1]!.y * map.width + cells[1]!.x]: [199, 200] };
}

function watch(map: GameMap): string[] {
  const owned = new Set(protectedHouseCells(map).map(c => c.y * map.width + c.x));
  const writes: string[] = [];
  for (const layer of ["lowerTiles", "upperTiles"] as const) map[layer] = new Proxy(map[layer], {
    set(target, key, value) {
      if (owned.has(Number(key))) writes.push(`${layer}[${String(key)}]`);
      return Reflect.set(target, key, value);
    },
  });
  return writes;
}

describe("village metadata exclusion", () => {
  it.each(["snow", "road", "deck", "flowers", "plaza-fence", "market-props", "stone-toppings"] as const)(
    "preflights direct %s cells, including empty protected cells and autotile neighbors", stage => {
      const project = createExistingProject();
      const map = project.maps.map_existing!;
      own(map);
      if (stage === "road") map.lowerTiles[4 * map.width + 6] = SAND_TILE.BODY;
      if (stage === "snow") map.lowerTiles[4 * map.width + 6] = DEFAULT_SNOW_AUTOTILE_GROUP.memberTileIds[0]!;
      if (stage === "stone-toppings") map.lowerTiles.fill(COBBLE_TILE.BODY);
      const before = captureHouseProtection(project);
      const writes = watch(map);
      const area = { x: 2, y: 2, w: 7, h: 7 };
      if (stage === "snow") paintGroundThemeStrip(map, area, "snow");
      else if (stage === "road") paintRoadStrip(map, "sand", [{ x: 7, y: 4 }, { x: 6, y: 4 }]);
      else if (stage === "deck") paintMarketDeck(map, area);
      else if (stage === "flowers") paintFlowerField(map, area, mulberry32(7));
      else if (stage === "plaza-fence") paintPlazaFence(map, { x: 3, y: 3, w: 6, h: 5 });
      else if (stage === "market-props") placeMarketDeckProps(map, area);
      else placeStoneToppings(map, { x: 3, y: 3, w: 4, h: 4 }, [], 7);
      expect(writes).toEqual([]);
      expect(captureHouseProtection(project)).toEqual(before);
      if (stage !== "stone-toppings") expect(map.lowerTiles.some((t, i) => t !== TILE.GRASS && !before[0]?.cells.some(c => c.y * map.width + c.x === i))
        || map.upperTiles.some(t => t !== TILE.EMPTY)).toBe(true);
    },
  );

  it("landscapes outside existing house and human placement geometry, not their empty cells", () => {
    const project = createExistingProject(100);
    const map = project.maps.map_existing!;
    own(map, { x: 1, y: 1, w: 30, h: 30 });
    map.structurePlacements = [{ id: "human", kitId: "removed", x: 70, y: 70, w: 20, h: 20,
      before: { lower: Array(400).fill(TILE.GRASS), upper: Array(400).fill(TILE.EMPTY) }, afterHash: "accepted" }];
    const before = captureHouseProtection(project);
    const writes = watch(map);
    const placed = dressVillageLandscape(map, { area: { x: 0, y: 0, w: 100, h: 100 }, houses: [],
      plaza: { rect: { x: 45, y: 45, w: 10, h: 8 }, centerX: 50, centerRow: 49 }, seed: 7, warnings: [] });
    expect(placed).toBeGreaterThan(0);
    expect(writes).toEqual([]);
    expect(captureHouseProtection(project)).toEqual(before);
  });

  it("skips a previously selected house candidate and preserves all old region IDs", () => {
    const control = createExistingProject();
    buildVillageDomain(control, { mapId: "map_existing", houses: 4, seed: 7, interior: false });
    const selected = control.maps.map_existing!.layoutPlan!.regions.find(r => r.role === "house")!;
    const project = createExistingProject();
    const map = project.maps.map_existing!;
    own(map, selected);
    const before = captureHouseProtection(project);
    const oldRegions = structuredClone(map.layoutPlan!.regions);
    const result = buildVillageDomain(project, { mapId: map.id, houses: 4, seed: 7, interior: false, groundTheme: "snow" });
    expect(result.data).toMatchObject({ housesBuilt: 4, doorsConnected: 4, roadComponents: 1 });
    expect(captureHouseProtection(project).filter(h => h.id === selected.id)).toEqual(before);
    expect(map.layoutPlan!.regions).toEqual(expect.arrayContaining(oldRegions));
    expect(new Set(map.layoutPlan!.regions.map(r => r.id)).size).toBe(map.layoutPlan!.regions.length);
  }, 90_000);
});
