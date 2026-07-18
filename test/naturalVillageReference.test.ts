import { describe, expect, it } from "vitest";
import { buildNaturalVillageReference } from "../scripts/natural-village/build";
import { FINAL_MAP_ID, STAGE_MAP_IDS } from "../scripts/natural-village/blueprint";

const ROAD_TILES = new Set([360, 361, 362, 390, 391, 392, 420, 421, 422, 450, 451, 452]);
const DOOR_TOP = 116;
const DOOR_BOTTOM = 146;
const WINDOWS = new Set([85, 87]);
const TREE_TOPS = new Set([260, 261, 262, 263]);
const PROP_TILES = new Set([
  202, 203, 234, 235, 236, 237, 259, 288, 289, 318, 319, 320, 327, 328, 348, 349, 350,
  351, 352, 358, 388, 411, 440, 441, 442, 443, 472, 473,
]);

describe("hand-authored natural village reference", () => {
  it("keeps every visual stage and satisfies the composition contract", () => {
    // Given: the explicit art-directed village blueprint.
    // When: the reference project is built without village generator tools.
    const project = buildNaturalVillageReference();
    const map = project.maps[FINAL_MAP_ID];

    // Then: every authored stage remains inspectable and the final map is structurally natural.
    expect(map).toBeDefined();
    if (!map) return;
    expect(STAGE_MAP_IDS.every((mapId) => project.maps[mapId] !== undefined)).toBe(true);
    expect(Object.keys(project.maps)).toHaveLength(STAGE_MAP_IDS.length);

    const houses = map.layoutPlan?.regions.filter((region) => region.role === "house") ?? [];
    expect(houses).toHaveLength(10);
    expect(new Set(houses.map((house) => house.shape)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(houses.map((house) => house.kitId)).size).toBe(4);
    expect(houses.filter((house) => house.tags?.some((tag) => tag === "stories:2" || tag === "stories:3"))).toHaveLength(2);

    let doorPairs = 0;
    let orphanDoorTiles = 0;
    let adjacentWindows = 0;
    let treeTopCells = 0;
    const propKinds = new Set<number>();
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const index = y * map.width + x;
        const lower = map.lowerTiles[index] ?? -1;
        const upper = map.upperTiles[index] ?? -1;
        if (lower === DOOR_BOTTOM) {
          if (y > 0 && map.lowerTiles[(y - 1) * map.width + x] === DOOR_TOP) doorPairs += 1;
          else orphanDoorTiles += 1;
        }
        if (lower === DOOR_TOP && (y + 1 >= map.height || map.lowerTiles[(y + 1) * map.width + x] !== DOOR_BOTTOM)) {
          orphanDoorTiles += 1;
        }
        if (WINDOWS.has(upper)) {
          if (WINDOWS.has(map.upperTiles[index + 1] ?? -1)) adjacentWindows += 1;
          if (y + 1 < map.height && WINDOWS.has(map.upperTiles[index + map.width] ?? -1)) adjacentWindows += 1;
        }
        if (TREE_TOPS.has(upper)) treeTopCells += 1;
        if (PROP_TILES.has(upper)) propKinds.add(upper);
      }
    }
    expect(doorPairs).toBe(houses.length);
    expect(orphanDoorTiles).toBe(0);
    expect(adjacentWindows).toBe(0);
    expect(treeTopCells).toBeGreaterThanOrEqual(34);
    expect(propKinds.size).toBeGreaterThanOrEqual(12);

    const roadAt = (x: number, y: number): boolean => ROAD_TILES.has(map.lowerTiles[y * map.width + x] ?? -1);
    expect(Array.from({ length: map.width }, (_, x) => roadAt(x, 0)).some(Boolean)).toBe(true);
    expect(Array.from({ length: map.width }, (_, x) => roadAt(x, map.height - 1)).some(Boolean)).toBe(true);
    expect(Array.from({ length: map.height }, (_, y) => roadAt(0, y)).some(Boolean)).toBe(true);
    expect(Array.from({ length: map.height }, (_, y) => roadAt(map.width - 1, y)).some(Boolean)).toBe(true);
    for (const house of houses) {
      for (let y = house.y; y < house.y + house.h; y += 1) {
        for (let x = house.x; x < house.x + house.w; x += 1) expect(roadAt(x, y)).toBe(false);
      }
    }

    const villagers = map.events.filter((event) => event.id.startsWith("ev_reference_villager_"));
    expect(villagers).toHaveLength(12);
    expect(villagers.filter((event) => (event.schedule?.length ?? 0) >= 2).length).toBeGreaterThanOrEqual(10);
    expect(new Set(villagers.flatMap((event) => event.schedule?.map((entry) => entry.activity) ?? []).filter(Boolean)).size).toBeGreaterThanOrEqual(6);
    expect(new Set(villagers.map((event) => event.pages?.[0]?.movement.type)).size).toBe(2);
  });
});
