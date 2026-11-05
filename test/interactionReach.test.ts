import { describe, expect, it } from "vitest";
import { ACTION_REACH_CELLS, canExamineFrom, pickNearbyActionTarget, withinActionReach } from "@/player/nearbyActionTarget";
import type { RuntimeEventView } from "@/project/runtimeEventState";

function view(id: string, left: number, top: number, right = left, bottom = top): RuntimeEventView {
  return {
    event: { id },
    trigger: { kind: "action" },
    page: { interaction: { kind: "inspect" } },
    bodyRect: { left, right, top, bottom },
  } as unknown as RuntimeEventView;
}

const W = 32;
const cell = (x: number, y: number) => y * W + x;
const body = (left: number, top: number, right: number, bottom: number): number[] => {
  const cells: number[] = [];
  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) cells.push(cell(x, y));
  return cells;
};

describe("interaction reach", () => {
  it("counts only the adjacent ring, not two tiles away", () => {
    expect(ACTION_REACH_CELLS).toBe(1);
    expect(withinActionReach(10, 10, 10, 9)).toBe(true);
    expect(withinActionReach(10, 10, 11, 9)).toBe(true);
    expect(withinActionReach(10, 10, 10, 8)).toBe(false);
    expect(withinActionReach(10, 10, 8, 10)).toBe(false);
    expect(withinActionReach(10, 10, 10, 10)).toBe(false);
  });

  it("does not open a single-cell prop from two tiles away", () => {
    const single = body(10, 8, 10, 8);
    expect(canExamineFrom(single, W, 10, 10, 10, 8)).toBe(false);
    expect(canExamineFrom(single, W, 10, 9, 10, 8)).toBe(true);
  });

  it("keeps a 3x3 prop usable from its edge even though the event sits in the middle", () => {
    const shelf = body(8, 8, 10, 10);
    expect(canExamineFrom(shelf, W, 10, 11, 9, 9)).toBe(true);
    expect(canExamineFrom(shelf, W, 7, 9, 9, 9)).toBe(true);
    expect(canExamineFrom(shelf, W, 10, 12, 9, 9)).toBe(false);
  });

  it("does not reach past a prop whose body stops short of the player", () => {
    const desk = body(10, 8, 10, 8);
    expect(canExamineFrom(desk, W, 10, 10, 10, 8)).toBe(false);
  });

  it("does not pick a prop whose body starts two tiles away", () => {
    expect(pickNearbyActionTarget([view("prop-far", 10, 8)], 10, 10)).toBeUndefined();
  });

  it("still picks a multi-cell prop by the cell the player is touching", () => {
    const big = view("prop-big", 8, 8, 10, 10);
    const picked = pickNearbyActionTarget([big], 10, 11);
    expect(picked?.view.event.id).toBe("prop-big");
    expect(picked?.face).toBe("up");
  });

  it("prefers the adjacent prop over a farther one in the same cluster", () => {
    const near = view("prop-near", 10, 9);
    const far = view("prop-far", 10, 8);
    expect(pickNearbyActionTarget([far, near], 10, 10)?.view.event.id).toBe("prop-near");
  });
});
