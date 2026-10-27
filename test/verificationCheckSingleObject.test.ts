import { describe, expect, it } from "vitest";
import { parseVerificationChecks } from "@/ai/toolVerificationEvidence";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision, workPlanFromSetToolArgs } from "@/ai/workPlan";

const lint = "run_lint";
const scene = "run_scene_test";
const oneStep = {
  mapId: "map_cellar",
  start: { x: 1, y: 2 },
  steps: [{ kind: "interact", eventId: "chest" }],
};
const twoSteps = {
  mapId: "map_cellar",
  start: { x: 1, y: 2 },
  steps: [
    { kind: "interact", eventId: "chest" },
    { kind: "interact", eventId: "chief" },
  ],
};

describe("verification checks accept a single object where the schema asks for an array", () => {
  it("stores one lint declaration sent as an object", () => {
    const check = { tool: lint, args: {} };
    expect(parseVerificationChecks(check)).toEqual([check]);
    const plan = workPlanFromSetToolArgs({
      goal: "Lint the cellar",
      layers: [{ title: "QA", items: [{ title: "Lint", instruction: "Lint", successTools: [lint], verificationChecks: check }] }],
    });
    expect(plan?.layers[0]?.items[0]?.verificationChecks).toEqual([check]);
  });

  it("stores one scene interaction target sent as an object", () => {
    const stored = [{
      tool: scene,
      args: oneStep,
      interactionTargets: [{ stepIndex: 0, mapId: "map_cellar", eventId: "chest" }],
    }];
    expect(parseVerificationChecks({
      tool: scene,
      args: oneStep,
      interactionTargets: { stepIndex: "0", mapId: "map_cellar", eventId: "chest" },
    })).toEqual(stored);

    const raw = JSON.stringify({
      action: "new_plan",
      goal: "Check the chest",
      layers: [{ title: "QA", items: [{
        title: "Scene",
        instruction: "Open the chest",
        successTools: [scene],
        verificationChecks: {
          tool: scene,
          args: oneStep,
          interactionTargets: { stepIndex: 0, mapId: "map_cellar", eventId: "chest" },
        },
      }] }],
    });
    const { decision } = parseOrchestratorDecision(raw);
    if (!decision || decision.action !== "new_plan") throw new Error("expected plan");
    expect(workPlanFromOrchestratorDecision(decision).layers[0]?.items[0]?.verificationChecks).toEqual(stored);
  });

  it("still drops a non-object, a bad check, and a one-target scene that skips an interact step", () => {
    expect(parseVerificationChecks("run_lint")).toBeUndefined();
    expect(parseVerificationChecks(null)).toBeUndefined();
    expect(parseVerificationChecks(1)).toBeUndefined();
    expect(parseVerificationChecks({ tool: "not_a_tool", args: {} })).toBeUndefined();
    expect(parseVerificationChecks({
      tool: scene,
      args: twoSteps,
      interactionTargets: { stepIndex: 0, mapId: "map_cellar", eventId: "chest" },
    })).toBeUndefined();
    expect(parseVerificationChecks([
      { tool: lint, args: {} },
      { tool: "not_a_tool", args: {} },
    ])).toBeUndefined();
  });
});
