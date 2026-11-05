import { describe, expect, it } from "vitest";
import { ACTION_REACH_CELLS, pickNearbyActionTarget, withinActionReach } from "@/player/nearbyActionTarget";
import type { RuntimeEventView } from "@/project/runtimeEventState";

function view(id: string, left: number, top: number, right = left, bottom = top): RuntimeEventView {
  return {
    event: { id },
    trigger: { kind: "action" },
    page: { interaction: { kind: "inspect" } },
    bodyRect: { left, right, top, bottom },
  } as unknown as RuntimeEventView;
}

describe("interaction reach", () => {
  it("counts only the adjacent ring, not two tiles away", () => {
    expect(ACTION_REACH_CELLS).toBe(1);
    expect(withinActionReach(10, 10, 10, 9)).toBe(true);
    expect(withinActionReach(10, 10, 11, 9)).toBe(true);
    expect(withinActionReach(10, 10, 10, 8)).toBe(false);
    expect(withinActionReach(10, 10, 8, 10)).toBe(false);
    expect(withinActionReach(10, 10, 10, 10)).toBe(false);
  });

  it("does not pick a prop whose body starts two tiles away", () => {
    const far = view("prop-far", 10, 8);
    expect(pickNearbyActionTarget([far], 10, 10)).toBeUndefined();
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
