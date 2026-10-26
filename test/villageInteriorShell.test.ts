import { describe, expect, it } from "vitest";
import { buildHouseInteriorPlan, type HouseInteriorProgram, type HouseInteriorScale } from "@/editor/houseInteriors";
import type { InteriorRoomPlan, RoomSpec } from "@/editor/interiorRoomPipeline";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

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

// Removed describe "village house interiors — partitions": author_village was removed from the tool registry on purpose.
