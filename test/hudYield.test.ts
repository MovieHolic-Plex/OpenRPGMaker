// 상시 창 비키기 — 주인공·마주 본 것을 덮은 창은 흐려지고, 잠깐 뜨는 알림과 겹친 창은 숨는다(자리는 그대로).
import { describe, expect, it } from "vitest";
import { hudYieldState } from "@/player/hudYield";
import { objectiveHome } from "@/player/objectivePlacement";

const panel = { x: 10, y: 10, width: 90, height: 138 };

describe("hudYieldState", () => {
  it("fades a panel while the hero's ring is under it and restores it afterwards", () => {
    const under = { x: 40, y: 100, width: 48, height: 48 };
    const away = { x: 200, y: 150, width: 48, height: 48 };
    expect(hudYieldState(panel, [under], [])).toBe("fade");
    expect(hudYieldState(panel, [away], [])).toBeNull();
  });

  it("hides a panel under a banner even when the hero is also under it", () => {
    const banner = { x: 80, y: 20, width: 160, height: 100 };
    expect(hudYieldState(panel, [{ x: 40, y: 100, width: 48, height: 48 }], [banner])).toBe("hide");
    expect(hudYieldState({ x: 250, y: 200, width: 60, height: 30 }, [], [banner])).toBeNull();
  });

  it("keeps a faded panel faded until the hero is clearly out (no flicker on the edge)", () => {
    const justOut = { x: 101, y: 50, width: 48, height: 48 }; // 판 오른쪽 끝(100)에서 1px 밖
    expect(hudYieldState(panel, [justOut], [])).toBeNull();
    expect(hudYieldState(panel, [justOut], [], "fade")).toBe("fade");
    expect(hudYieldState(panel, [{ ...justOut, x: 110 }], [], "fade")).toBeNull();
  });
});

describe("objectiveHome", () => {
  const stage = { width: 320, height: 240 };
  const box = { width: 120, height: 30 };

  it("is the top-right corner whatever stands under it", () => {
    expect(objectiveHome({ stage, box, margin: 4, hud: [] })).toEqual({ x: 196, y: 4, width: 120 });
    // 왼쪽 위의 동료 판은 목표 창 자리와 상관없다.
    expect(objectiveHome({ stage, box, margin: 4, hud: [panel] })).toEqual({ x: 196, y: 4, width: 120 });
  });

  it("stacks under fixed HUD boxes that already hold the top-right corner", () => {
    const clock = { x: 234, y: 10, width: 76, height: 44 };
    const gold = { x: 234, y: 58, width: 76, height: 23 };
    expect(objectiveHome({ stage, box, margin: 4, hud: [clock] })).toEqual({ x: 196, y: 58, width: 120 });
    expect(objectiveHome({ stage, box, margin: 4, hud: [gold, clock] })).toEqual({ x: 196, y: 85, width: 120 });
  });

  it("stays in the corner when the top is so full that it would land in the lower half", () => {
    const tall = { x: 200, y: 0, width: 120, height: 110 };
    expect(objectiveHome({ stage, box, margin: 4, hud: [tall] }).y).toBe(4);
  });
});
