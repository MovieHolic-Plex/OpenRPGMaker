import { describe, expect, it } from "vitest";
import { buildHouseInteriorPlan, type HouseInteriorProgram, type HouseInteriorScale } from "@/editor/houseInteriors";
import { isCeilingTile } from "@/editor/interiorHouseWallGrammar";
import type { InteriorRoomPlan, RoomSpec } from "@/editor/interiorRoomPipeline";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap } from "@/project/types";

const SCALES: readonly HouseInteriorScale[] = ["cottage2", "cottage3", "cottage-l", "mansion"];
const PROGRAMS: readonly HouseInteriorProgram[] = ["dwelling", "shop", "inn", "workshop", "study", "manor"];

function stockPlans(): InteriorRoomPlan[] {
  // The village builder always passes its project (concept bundles decide the room vocabulary).
  const project = createEmptyToolProject("plans");
  const plans: InteriorRoomPlan[] = [];
  for (const scale of SCALES) for (const program of PROGRAMS) for (const floor of ["ground", "upper"] as const) for (const seed of [1, 2, 3]) {
    plans.push(buildHouseInteriorPlan({ mapId: `m_${scale}_${program}_${floor}_${seed}` as never, name: "x", seed, scale, program, floor, project }));
  }
  return plans;
}

function villageInteriors(seed: number): GameMap[] {
  const context: ToolContext = { project: createEmptyToolProject("probe") };
  const result = runTool(context, "author_village", {
    target: { kind: "new", mapId: "m", name: "m", width: 64, height: 40 },
    houseCount: 8, seed, morphology: "street", countPolicy: "exact", forestDensity: "normal",
    theme: "눈 덮인 항구 마을", npcCount: 0,
  });
  expect(result.ok, result.summary).toBe(true);
  return Object.values(context.project.maps).filter((map) => map.id.startsWith("map_house_interior"));
}

const rooms = (plan: InteriorRoomPlan): readonly RoomSpec[] => plan.rooms ?? [];
const sideBySide = (a: RoomSpec, b: RoomSpec): boolean =>
  a.y < b.y + b.h && b.y < a.y + a.h && (a.x + a.w + 1 >= b.x && b.x >= a.x + a.w || b.x + b.w + 1 >= a.x && a.x >= b.x + b.w);

describe("stock house interiors — one rectangular shell", () => {
  it("spans the full house width with both the north and the south wing (no darkness notches beside a narrower wing)", () => {
    for (const plan of stockPlans()) {
      const list = rooms(plan);
      const minX = Math.min(...list.map((r) => r.x));
      const maxX = Math.max(...list.map((r) => r.x + r.w - 1));
      const top = Math.min(...list.map((r) => r.y));
      const bottom = Math.max(...list.map((r) => r.y + r.h));
      for (const [wing, members] of [
        ["north", list.filter((r) => r.y === top)],
        ["south", list.filter((r) => r.y + r.h === bottom)],
      ] as const) {
        const row = [...members].sort((a, b) => a.x - b.x);
        expect(row[0]!.x, `${plan.mapId} ${wing} west`).toBe(minX);
        expect(row.at(-1)!.x + row.at(-1)!.w - 1, `${plan.mapId} ${wing} east`).toBe(maxX);
        for (let i = 1; i < row.length; i += 1) {
          // At most a one-column partition between neighbouring rooms of the wing.
          expect(row[i]!.x - (row[i - 1]!.x + row[i - 1]!.w), `${plan.mapId} ${wing} gap`).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("gives side-by-side rooms one north wall line, so the wall never steps without a side face", () => {
    for (const plan of stockPlans()) {
      const list = rooms(plan).filter((r) => r.theme !== "corridor");
      for (const a of list) for (const b of list) {
        if (a === b || !sideBySide(a, b)) continue;
        expect(a.y, `${plan.mapId}: ${a.id} vs ${b.id}`).toBe(b.y);
      }
    }
  });
});

describe("village house interiors — partitions", () => {
  it("runs the north wall face across a one-column partition instead of letting the ceiling cut down between rooms", () => {
    let partitions = 0;
    for (const seed of [1, 2]) {
      for (const map of villageInteriors(seed)) {
        const plan = map.roomHarnessPlan!.plan as InteriorRoomPlan;
        const list = rooms(plan);
        for (const a of list) for (const b of list) {
          if (b.x !== a.x + a.w + 1 || a.y !== b.y) continue;
          partitions += 1;
          const x = a.x + a.w;
          for (const y of [a.y - 1, a.y - 2]) {
            expect(isCeilingTile(map.lowerTiles[y * map.width + x]!), `${map.id} (${x},${y})`).toBe(false);
          }
        }
      }
    }
    expect(partitions).toBeGreaterThan(0);
  }, 60_000);
});
