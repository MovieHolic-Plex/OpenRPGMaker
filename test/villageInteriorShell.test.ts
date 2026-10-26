import { describe, expect, it } from "vitest";
import { buildHouseInteriorPlan, type HouseInteriorProgram, type HouseInteriorScale } from "@/editor/houseInteriors";
import { reachableOpenCells, runInteriorRoomPipeline, VR, type InteriorRoomPlan, type RoomSpec } from "@/editor/interiorRoomPipeline";
import type { GameMap } from "@/project/types";

const SCALES: readonly HouseInteriorScale[] = ["cottage2", "cottage3", "cottage-l", "mansion"];
const PROGRAMS: readonly HouseInteriorProgram[] = ["dwelling", "shop", "inn", "workshop", "study", "manor"];
const FLOORS = ["ground", "upper"] as const;

interface StockHouse {
  readonly plan: InteriorRoomPlan;
  readonly floor: (typeof FLOORS)[number];
  readonly map: GameMap;
  readonly ok: boolean;
  readonly warnings: readonly string[];
}

// The outline is deliberately varied (generateHouseTopology keeps different graph/outline solutions; house-form rules #2416),
// so these tests check what a house interior must always be rather than one rectangle. Plans are built the way the live
// caller does (runDirectRoomDraft: no project binding) and then painted by the real interior pipeline.
function stockHouses(): StockHouse[] {
  const houses: StockHouse[] = [];
  for (const scale of SCALES) for (const program of PROGRAMS) for (const floor of FLOORS) for (const seed of [1, 2, 3]) {
    const plan = buildHouseInteriorPlan({ mapId: `m_${scale}_${program}_${floor}_${seed}` as never, name: "x", seed, scale, program, floor });
    const built = runInteriorRoomPipeline(plan);
    houses.push({ plan, floor, map: built.map, ok: built.ok, warnings: built.warnings });
  }
  return houses;
}

const HOUSES = stockHouses();
const roomsOf = (plan: InteriorRoomPlan): readonly RoomSpec[] => plan.rooms ?? [];
const inFootprint = (plan: InteriorRoomPlan, x: number, y: number): boolean =>
  roomsOf(plan).some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
const lowerAt = (map: GameMap, x: number, y: number): number =>
  x < 0 || y < 0 || x >= map.width || y >= map.height ? VR.VOID : map.lowerTiles[y * map.width + x]!;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

describe("stock house interiors — shell invariants (varied outlines allowed)", () => {
  it("sweeps all 144 stock plans and the pipeline accepts each one", () => {
    expect(HOUSES).toHaveLength(SCALES.length * PROGRAMS.length * FLOORS.length * 3);
    for (const house of HOUSES) expect(house.ok, `${house.plan.mapId}: ${house.warnings.join(" / ")}`).toBe(true);
  });

  it("(a) closes the shell — no floor cell touches the void except through the front door", () => {
    for (const { plan, map } of HOUSES) {
      for (const room of roomsOf(plan)) for (let y = room.y; y < room.y + room.h; y += 1) for (let x = room.x; x < room.x + room.w; x += 1) {
        for (const [dx, dy] of NEIGHBOURS) {
          if (x === plan.door.x && y === plan.door.y && dy === 1) continue;
          expect(lowerAt(map, x + dx, y + dy), `${plan.mapId}: (${x},${y}) opens to the void toward (${x + dx},${y + dy})`).not.toBe(VR.VOID);
        }
      }
    }
  });

  it("(b) connects the interior floor — every room is walkable from the door (furniture-sized nooks may be full)", () => {
    for (const { plan, map } of HOUSES) {
      // Floor connectivity, not furniture clearance: the pipeline's own reachability check also walks the floor layer only.
      const floorOnly: GameMap = { ...map, upperTiles: map.upperTiles.map(() => -1) };
      const reach = reachableOpenCells(floorOnly, new Array<boolean>(map.width * map.height).fill(true), plan.door);
      for (const room of roomsOf(plan)) {
        let reached = false;
        for (let y = room.y; y < room.y + room.h && !reached; y += 1) for (let x = room.x; x < room.x + room.w && !reached; x += 1) reached = reach.has(y * map.width + x);
        expect(reached, `${plan.mapId}: room ${room.id} is cut off from the door`).toBe(true);
      }
    }
  });

  it("(c) has exactly one entrance, on the outer wall (ground: south face; upper: the stair landing on the footprint edge)", () => {
    for (const { plan, floor } of HOUSES) {
      const { x, y } = plan.door;
      expect(inFootprint(plan, x, y), `${plan.mapId}: door (${x},${y}) is not on the floor`).toBe(true);
      const outward = floor === "ground" ? [[0, 1] as const] : NEIGHBOURS;
      expect(outward.some(([dx, dy]) => !inFootprint(plan, x + dx, y + dy)), `${plan.mapId}: door (${x},${y}) is not on an outer wall`).toBe(true);
      // Inner doors are partitions between rooms, never a second way out.
      for (const inner of plan.innerDoors ?? []) {
        expect(inner.x === x && inner.y === y, `${plan.mapId}: inner door duplicates the entrance`).toBe(false);
        expect(NEIGHBOURS.some(([dx, dy]) => inFootprint(plan, inner.x + dx, inner.y + dy)), `${plan.mapId}: inner door (${inner.x},${inner.y}) touches no room`).toBe(true);
      }
    }
  });

  it("(d) roofs the footprint — every north edge has a ceiling and a two-row wall face above it", () => {
    for (const { plan, map } of HOUSES) {
      for (const room of roomsOf(plan)) for (let x = room.x; x < room.x + room.w; x += 1) {
        for (let y = room.y; y < room.y + room.h; y += 1) {
          if (inFootprint(plan, x, y - 1)) continue;
          for (let k = 1; k <= 3; k += 1) {
            expect(lowerAt(map, x, y - k), `${plan.mapId}: no roof above (${x},${y}) at row ${y - k}`).not.toBe(VR.VOID);
          }
        }
      }
    }
  });
});

// Removed describe "village house interiors — partitions": author_village was removed from the tool registry on purpose.
