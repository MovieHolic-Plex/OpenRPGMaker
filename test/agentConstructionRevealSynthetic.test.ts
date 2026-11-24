import { describe, expect, it } from "vitest";
import { constructionRevealTimingLabel, discardConstructionLogs, offerConstructionLogs, planConstructionReveal } from "@/editor/agentConstructionReveal";
import { mergeConstructionLogs, type ConstructionLog } from "@/editor/tools/constructionLog";
import type { GameMap } from "@/project/types";

const map = { id: "map_town", width: 4, height: 3, tilesetId: "ts" } as unknown as GameMap;

function log(extra: Partial<ConstructionLog> = {}): ConstructionLog {
  return {
    mapId: "map_town", width: 4, height: 3, toolName: "author_beodeul_town", elapsedMs: 1400, planClasses: { 1: "road" },
    steps: [
      { kind: "plan", label: "큰길", cells: [0, 1], plan: [1, 1] },
      { kind: "paint", label: "길", cells: [0, 1], lower: [5, 5], upper: [-1, -1] },
      { kind: "stamp", label: "집 1/1", cells: [5], lower: [3], upper: [9], major: true, rect: { x: 1, y: 1, w: 1, h: 1 } },
    ],
    ...extra,
  } as ConstructionLog;
}

describe("construction reveal: real logs only (qa1124 mockup v4)", () => {
  it("never replays a synthetic (column-ordered) log — those tools get the changed-cell highlight", () => {
    discardConstructionLogs();
    offerConstructionLogs([log({ toolName: "author_dungeon", synthetic: true })]);
    expect(planConstructionReveal(undefined, map, undefined)).toBeNull();
  });

  it("still replays a real builder log and discloses real vs replay seconds", () => {
    discardConstructionLogs();
    offerConstructionLogs([log()]);
    const plan = planConstructionReveal(undefined, map, undefined);
    expect(plan).not.toBeNull();
    expect(plan!.frames.map((frame) => frame.step.kind)).toEqual(["plan", "paint", "stamp"]);
    expect(plan!.durationMs).toBeGreaterThan(plan!.log.elapsedMs);
    expect(constructionRevealTimingLabel(plan!)).toBe(`실제 1.4초 · 재생 ${(plan!.durationMs / 1000).toFixed(1)}초`);
  });

  it("drops synthetic logs when a real log covers the same map in one checkpoint", () => {
    const real = log();
    const synthetic = log({ toolName: "stamp_object", synthetic: true, steps: [{ kind: "stamp", label: "stamp_object · 물체", cells: [11], lower: [1], upper: [2] }] });
    const merged = mergeConstructionLogs([real, synthetic]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.synthetic).toBeUndefined();
    expect(merged[0]!.steps).toEqual(real.steps);
  });
});
