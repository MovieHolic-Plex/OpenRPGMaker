import { describe, expect, it } from "vitest";
import { createHouseInteriorMap, type HouseExteriorHint } from "@/editor/houseInteriors";
import { isCeilingTile } from "@/editor/interiorHouseWallGrammar";
import { floorMaskFromPlan, VR, type InteriorRoomPlan } from "@/editor/interiorRoomPipeline";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";

const STAIRS_UP = 444;
const STAIRS_DOWN = 474;
const FLOOR_TILES = new Set([72, 73, 12, 13, 42, 43, 102, 103, 139]);

type Floor = { readonly map: GameMap; readonly level: number };

function houses(): Floor[] {
  const context: ToolContext = { project: createEmptyToolProject("probe") };
  runTool(context, "create_map", { id: "m", name: "m", width: 20, height: 20 });
  const exteriors: HouseExteriorHint[] = [
    { stories: 2, templateId: "rect-2f", program: "dwelling" },
    { stories: 2, templateId: "rect-2f", program: "inn" },
    { stories: 2, templateId: "rect-2f", program: "shop" },
    { stories: 2, templateId: "rect-2f", program: "study" },
    { stories: 2, templateId: "rect-2f", program: "manor", footprintArea: 80 },
    { stories: 3, templateId: "rect-3f", program: "dwelling" },
    { stories: 1, templateId: "rect", program: "workshop" },
    { stories: 1, templateId: "rect", program: "shop" },
  ];
  const floors: Floor[] = [];
  for (const [i, exterior] of exteriors.entries()) for (const seed of [11, 12, 13]) {
    const id = `map_h${i}_${seed}`;
    const result = createHouseInteriorMap({ project: context.project, id, name: id, returnMapId: "m", returnX: 1, returnY: 1, exitEventId: `ev_${id}`, seed, exterior });
    for (const floor of result.floors) floors.push({ map: floor.map, level: floor.floor });
  }
  return floors;
}

const plan = (map: GameMap) => map.roomHarnessPlan!.plan as InteriorRoomPlan;
const cells = (map: GameMap, layer: "lowerTiles" | "upperTiles", tile: number) =>
  map[layer].flatMap((value, index) => (value === tile ? [{ x: index % map.width, y: Math.floor(index / map.width) }] : []));

describe("house interiors — stairs, ladders and windows", () => {
  const floors = houses();

  it("backs every up-staircase onto a wall and leaves its east side open as the landing", () => {
    let stairs = 0;
    for (const { map } of floors) {
      const floor = floorMaskFromPlan(plan(map));
      for (const { x, y } of cells(map, "upperTiles", STAIRS_UP)) {
        stairs += 1;
        expect(floor[(y - 1) * map.width + x], `${map.id} (${x},${y}) north must be wall`).toBe(false);
        expect(floor[y * map.width + x + 1], `${map.id} (${x},${y}) east must be floor`).toBe(true);
        expect(map.upperTiles[y * map.width + x + 1], `${map.id} (${x},${y}) east landing`).toBe(-1);
      }
    }
    expect(stairs).toBeGreaterThan(10);
  });

  it("keeps the shell closed: no floor punched into a wall, and upper floors have no exterior doorway", () => {
    for (const { map, level } of floors) {
      const room = plan(map);
      const floor = floorMaskFromPlan(room);
      const outside = map.lowerTiles.flatMap((tile, index) => (FLOOR_TILES.has(tile) && !floor[index] ? [index] : []));
      const doorway = room.door.y + 1 < map.height ? [(room.door.y + 1) * map.width + room.door.x] : [];
      expect(outside, `${map.id} (floor ${level})`).toEqual(level === 1 ? doorway : []);
    }
  });

  it("puts a descending staircase on every upper floor", () => {
    for (const { map, level } of floors) {
      if (level > 1) expect(cells(map, "upperTiles", STAIRS_DOWN).length, map.id).toBe(1);
    }
  });

  it("hangs no ladder alone on a wall and no window on an interior partition", () => {
    const context: ToolContext = { project: createEmptyToolProject("probe") };
    const result = runTool(context, "author_village", {
      target: { kind: "new", mapId: "v", name: "v", width: 64, height: 40 },
      houseCount: 8, seed: 2, morphology: "street", countPolicy: "exact", forestDensity: "normal", theme: "항구", npcCount: 0,
    });
    expect(result.ok, result.summary).toBe(true);
    const all = [...floors.map((f) => f.map), ...Object.values(context.project.maps).filter((m) => m.id.startsWith("map_house_interior"))];
    let windows = 0;
    for (const map of all) {
      expect(cells(map, "upperTiles", VR.LADDER), map.id).toEqual([]);
      const floor = floorMaskFromPlan(plan(map));
      for (const { x, y } of cells(map, "upperTiles", VR.WINDOW)) {
        windows += 1;
        // Behind an exterior wall there is only ceiling up to the map edge; a room or a partition means indoors.
        const behind = Array.from({ length: y }, (_, row) => row * map.width + x)
          .some((i) => floor[i] || !isCeilingTile(map.lowerTiles[i]!));
        expect(behind, `${map.id} window (${x},${y}) faces another room`).toBe(false);
      }
    }
    expect(windows).toBeGreaterThan(0);
  }, 60_000);
});
