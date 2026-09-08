import { describe, expect, it } from "vitest";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { verificationJourney } from "./fixtures/verificationOwnership";

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
  it("wire180->181 and corrected171 discharge distinct real-runner findings at terminal acceptance", () => {
    const f = verificationJourney();
    const evidence = new ToolVerificationEvidence();
    const acceptance = new AssistantAcceptanceLedger("goal", "Journey", f.project);
    acceptance.adopt([{ id: "preserve", title: "Existing content", criteria: [{ kind: "preserve", target: { mapId: f.village.id } }] }]);
    for (const input of [f.wire171, f.wire180]) {
      const result = runTool({ project: f.project }, "run_scene_test", { ...input });
      expect(result).toMatchObject({ ok: true, data: { ok: false, setupFailure: { kind: "no-interaction-target", mapId: f.cellar.id } } });
      evidence.observe("run_scene_test", { ...input }, result);
    }
    const ids = evidence.snapshot().findings.map(finding => finding.checkId);
    expect(new Set(ids).size).toBe(2);
    const pass180 = runTool({ project: f.project }, "run_scene_test", { ...f.wire181 });
    expect(pass180).toMatchObject({ ok: true, data: { ok: true } });
    evidence.observe("run_scene_test", { ...f.wire181 }, pass180);
    expect(evidence.snapshot().findings.map(finding => finding.checkId)).toEqual([ids[0]]);
    expect(acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status).toBe("blocked");
    const correction = evidence.correction(ids[0], f.corrected171);
    expect(correction).not.toBeNull();
    const pass171 = runTool({ project: f.project }, correction!.name, correction!.args);
    expect(pass171).toMatchObject({ ok: true, data: { ok: true } });
    evidence.observe(correction!.name, correction!.args, pass171, "explicit", undefined, ids[0]);
    expect(evidence.snapshot().findings).toEqual([]);
    expect(acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status).toBe("verified");
  });

  it.each(["drop-repeat", "weaker", "target", "start", "snapshot", "choice", "state", "navigation"])("rejects %s as a correction without deleting the original", variant => {
    const f = verificationJourney();
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_scene_test", { ...f.wire180 }, runTool({ project: f.project }, "run_scene_test", { ...f.wire180 }));
    const checkId = evidence.snapshot().findings[0]!.checkId;
    const args = structuredClone({ ...f.wire181, steps: [...f.wire181.steps] });
    if (variant === "drop-repeat") args.steps.splice(-3);
    if (variant === "weaker") args.steps = args.steps.map(step => step.kind === "expect" && step.goldDelta === 20 ? { ...step, goldDelta: { atLeast: 1 } } : step);
    if (variant === "target") args.steps = args.steps.map(step => step.kind === "interact" ? { ...step, eventId: "other" } : step);
    if (variant === "start") args.start.x++;
    if (variant === "snapshot") args.steps = args.steps.filter(step => step.kind !== "snapshotRewards");
    if (variant === "choice") args.steps.push({ kind: "choose", index: 0 });
    if (variant === "state") args.steps.unshift({ kind: "set", gold: 100 });
    if (variant === "navigation") args.steps = args.steps.filter(step => step.kind !== "move");
    expect(evidence.correction(checkId, args)).toBeNull();
    expect(evidence.snapshot().findings.map(finding => finding.checkId)).toEqual([checkId]);
  });
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
    const corrected = { ...args, steps: [...(malformed ? [] : setup), { kind: "face", dir: "up" }, ...args.steps] };
    const passed = runTool(context, "run_scene_test", corrected);
    expect(passed.data).toMatchObject({ ok: true });
    evidence.observe("run_scene_test", corrected, passed);
    expect(evidence.passed("run_scene_test")).toBe(true);
    expect(evidence.problems()).toEqual([]);
  });

  it("keeps exact canonical proof separate from corrected navigation and advisory checks", () => {
    const { context, args } = rewardScene();
    const evidence = new ToolVerificationEvidence();
    const corrected = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
    evidence.adopt({ checkId: "canonical", ownerId: "goal", name: "run_scene_test", args: corrected,
      acceptedCriterion: { kind: "toolVerdict", tool: "run_scene_test", args: corrected } });
    evidence.observe("run_scene_test", args, runTool(context, "run_scene_test", args));
    evidence.observe("run_scene_test", corrected, runTool(context, "run_scene_test", corrected));
    expect(evidence.problems()).toEqual([]);
    expect(evidence.passedScope("run_scene_test", corrected)).toBe(true);
    expect(evidence.passedScope("run_scene_test", args)).toBe(false);

    // Same normalized NPC/assertion obligation, different exact navigation args.
    const otherNavigation = { ...args, steps: [{ kind: "set", x: 10, y: 8 }, ...corrected.steps] };
    const otherResult = runTool(context, "run_scene_test", otherNavigation);
    expect(otherResult.data).toMatchObject({ ok: true });
    evidence.observe("run_scene_test", otherNavigation, otherResult, "advisory");
    expect(evidence.passed("run_scene_test")).toBe(true);
    expect(evidence.passedScope("run_scene_test", otherNavigation)).toBe(false);
    evidence.observe("run_scene_test", corrected, runTool(context, "run_scene_test", corrected));
    evidence.invalidateAfterWrite();
    evidence.observe("run_scene_test", corrected, runTool(context, "run_scene_test", corrected), "advisory");
    expect(evidence.passedScope("run_scene_test", corrected)).toBe(false);
  });

  it("retains independently passing exact invocations of the same normalized scene", () => {
    const { context, args } = rewardScene();
    const evidence = new ToolVerificationEvidence();
    const first = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
    const second = { ...args, steps: [{ kind: "set", x: 10, y: 8 }, ...first.steps] };
    for (const [index, exact] of [first, second].entries()) {
      evidence.adopt({ checkId: `canonical-${index}`, ownerId: "goal", name: "run_scene_test", args: exact,
        acceptedCriterion: { kind: "toolVerdict", tool: "run_scene_test", args: exact } });
      const result = runTool(context, "run_scene_test", exact);
      expect(result.data).toMatchObject({ ok: true });
      evidence.observe("run_scene_test", exact, result);
    }
    expect(evidence.passedScope("run_scene_test", first)).toBe(true);
    expect(evidence.passedScope("run_scene_test", second)).toBe(true);
    evidence.invalidateAfterWrite();
    evidence.observe("run_scene_test", first, runTool(context, "run_scene_test", first), "advisory");
    expect(evidence.passedScope("run_scene_test", first)).toBe(false);
    expect(evidence.passedScope("run_scene_test", second)).toBe(false);
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
