import { describe, expect, it } from "vitest";
import { parseVerificationChecks } from "@/ai/toolVerificationEvidence";
import { workPlanFromSetToolArgs } from "@/ai/workPlan";

const reach = "check_reachability";
const scene = "run_scene_test";
const args = {
  mapId: "map_cellar",
  start: { x: 1, y: 2 },
  steps: [
    { kind: "interact", eventId: "chest" },
    { kind: "interact", eventId: "chief" },
  ],
};

describe("verification check indexes accept numeric strings", () => {
  it("stores criterionIndex strings as safe integers", () => {
    expect(parseVerificationChecks([
      { tool: reach, criterion: { promiseId: "route-0", criterionIndex: "0" } },
      { tool: reach, criterion: { promiseId: "route-1", criterionIndex: "1.0" } },
      { tool: reach, checkId: "route-2", criterion: { promiseId: "route-2", criterionIndex: " 2 " } },
    ])).toEqual([
      { tool: reach, criterion: { promiseId: "route-0", criterionIndex: 0 } },
      { tool: reach, criterion: { promiseId: "route-1", criterionIndex: 1 } },
      { tool: reach, checkId: "route-2", criterion: { promiseId: "route-2", criterionIndex: 2 } },
    ]);
  });

  it("keeps a scene declaration whose stepIndex values arrived as strings", () => {
    const checks = [{ tool: scene, args, interactionTargets: [
      { stepIndex: "0", mapId: "map_cellar", eventId: "chest" },
      { stepIndex: " 1 ", mapId: "map_cellar", eventId: "chief" },
    ] }];
    const stored = [{ tool: scene, args, interactionTargets: [
      { stepIndex: 0, mapId: "map_cellar", eventId: "chest" },
      { stepIndex: 1, mapId: "map_cellar", eventId: "chief" },
    ] }];
    expect(parseVerificationChecks(checks)).toEqual(stored);
    const plan = workPlanFromSetToolArgs({
      goal: "Check the cellar",
      layers: [{ title: "QA", items: [{ title: "Check", instruction: "Check", verificationChecks: checks }] }],
    });
    expect(plan?.layers[0]?.items[0]?.verificationChecks).toEqual(stored);
  });

  it("still drops a declaration when an index is not a non-negative integer", () => {
    for (const criterionIndex of ["-1", "1.5", "", "no", true]) {
      expect(parseVerificationChecks([{ tool: reach, criterion: { promiseId: "route-0", criterionIndex } }])).toBeUndefined();
    }
    expect(parseVerificationChecks([{ tool: scene, args, interactionTargets: [
      { stepIndex: "1.5", mapId: "map_cellar", eventId: "chest" },
    ] }])).toBeUndefined();
    expect(parseVerificationChecks([
      { tool: reach, criterion: { promiseId: "route-0", criterionIndex: 0 } },
      { tool: reach, criterion: { promiseId: "route-1", criterionIndex: "no" } },
    ])).toBeUndefined();
  });
});
