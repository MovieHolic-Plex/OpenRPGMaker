import { describe, expect, it } from "vitest";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";

function rewardScene() {
  const context = { project: createBlankProject() };
  const mapId = context.project.startMapId;
  const itemId = context.project.database.items[0]?.id;
  if (!itemId) throw new Error("Default item fixture missing");
  const placed = runTool(context, "place_npc", {
    mapId, id: "reward_npc", name: "Reward", x: 10, y: 7,
    graphic: { transparent: true },
    pages: [{ commands: [{ kind: "changeItem", itemId, op: "+=", amount: 5 }] }],
  });
  expect(placed.ok).toBe(true);
  const steps = [
    { kind: "snapshotRewards" },
    { kind: "interact", eventId: "reward_npc" },
    { kind: "expect", inventoryDelta: { [itemId]: 5 }, interactionComplete: true },
  ];
  return { context, args: { mapId, start: { x: 10, y: 8 }, steps }, itemId };
}

describe("corrected scene navigation retains the same verification obligation", () => {
  it.each([
    { setup: [], malformed: false },
    { setup: [{ kind: "face", text: "up" }], malformed: true },
    { setup: [{ kind: "move", text: "up" }], malformed: true },
    { setup: [{ kind: "set", x: 10, y: 8 }], malformed: false },
  ])("replaces a failed navigation attempt with the passing same-target assertions: $setup", ({ setup, malformed }) => {
    const { context, args } = rewardScene();
    const evidence = new ToolVerificationEvidence();
    const failedArgs = { ...args, steps: [...setup, ...args.steps] };
    const failed = runTool(context, "run_scene_test", failedArgs);
    if (malformed) {
      expect(failed.ok).toBe(false);
      expect(failed.issues).toContainEqual(expect.objectContaining({ code: "invalid-scene-test" }));
    } else {
      expect(failed.ok).toBe(true);
      expect(failed.data).toMatchObject({ ok: false });
    }
    evidence.observe("run_scene_test", failedArgs, failed);
    evidence.invalidateAfterWrite();
    const corrected = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
    const passed = runTool(context, "run_scene_test", corrected);
    expect(passed.data).toMatchObject({ ok: true });
    evidence.observe("run_scene_test", corrected, passed);
    expect(evidence.passed("run_scene_test")).toBe(true);
    expect(evidence.problems()).toEqual([]);
  });

  it("cannot erase a different assertion by weakening its expected reward", () => {
    const { context, args, itemId } = rewardScene();
    const evidence = new ToolVerificationEvidence();
    const impossible = {
      ...args,
      steps: [{ kind: "face", dir: "up" }, ...args.steps.slice(0, 2),
        { kind: "expect", inventoryDelta: { [itemId]: 6 }, interactionComplete: true }],
    };
    evidence.observe("run_scene_test", impossible, runTool(context, "run_scene_test", impossible));
    const otherAssertion = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
    evidence.observe("run_scene_test", otherAssertion, runTool(context, "run_scene_test", otherAssertion));
    expect(evidence.passed("run_scene_test")).toBe(false);
  });

  it("keeps distinct explicit NPC targets separate", () => {
    const { context, args } = rewardScene();
    const evidence = new ToolVerificationEvidence();
    const missingTarget = {
      ...args,
      steps: [{ kind: "face", dir: "up" }, args.steps[0],
        { kind: "interact", eventId: "missing_npc" }, args.steps[2]],
    };
    evidence.observe("run_scene_test", missingTarget, runTool(context, "run_scene_test", missingTarget));
    const correctTarget = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
    evidence.observe("run_scene_test", correctTarget, runTool(context, "run_scene_test", correctTarget));
    expect(evidence.passed("run_scene_test")).toBe(false);
  });
});
