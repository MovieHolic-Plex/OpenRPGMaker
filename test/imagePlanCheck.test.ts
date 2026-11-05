import { describe, expect, it } from "vitest";
import { PLAN_FOLLOW_BAR, parsePlanFollowCheck, planFollowFixRequest } from "@/ai/imagePlanCheck";
import { builtMapOf } from "@/editor/imagePlanFollowCheck";
import { createBlankProject } from "@/project/defaults";

const els = (marks: string[]) => marks.map((mark, i) => ({ element: `e${i}`, mark, where: `w${i}`, fix: `f${i}` }));

describe("imagePlanCheck", () => {
  it("scores present + half partial over the element count and drops malformed rows", () => {
    const check = parsePlanFollowCheck({ elements: [...els(["present", "partial", "missing", "present"]), { element: "", mark: "present" }, { element: "x", mark: "maybe" }], layout: "partly" })!;
    expect(check.elements).toHaveLength(4);
    expect(check.score).toBeCloseTo(2.5 / 4);
    expect(parsePlanFollowCheck({ elements: els(["present", "present"]) })).toBeNull();
  });

  it("asks to fix only non-present elements below the bar and nothing at or above it", () => {
    const low = parsePlanFollowCheck({ elements: els(["present", "missing", "partial"]), layout: "partly" })!;
    const fix = planFollowFixRequest(low)!;
    expect(fix).toContain("e1(없음, w1): f1");
    expect(fix).toContain("e2(부분, w2): f2");
    expect(fix).not.toContain("e0(");
    const high = parsePlanFollowCheck({ elements: els(["present", "present", "present", "present", "partial"]), layout: "yes" })!;
    expect(high.score).toBeGreaterThanOrEqual(PLAN_FOLLOW_BAR);
    expect(planFollowFixRequest(high)).toBeNull();
  });

  it("finds the map the turn built", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    expect(builtMapOf(before, after)).toBeNull();
    const id = after.startMapId!;
    after.maps[id]!.lowerTiles[0] = 7;
    expect(builtMapOf(before, after)?.id).toBe(id);
  });
});
