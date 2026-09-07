import { describe, expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { parseAcceptanceCriteria } from "@/ai/assistantAcceptance";
import { parseIntentDeclaration, type IntentFacts } from "@/ai/intentDeclaration";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { isWorkPlanComplete, skipWorkItemById, workPlanFromSetToolArgs } from "@/ai/workPlan";
import { createBlankProject } from "@/project/defaults";
import { runSceneTest } from "@/testing/sceneTestRunner";

function setup() {
  const project = createBlankProject();
  const target = { mapId: project.startMapId };
  const ledger = new AssistantAcceptanceLedger("goal", "Action arena", project);
  ledger.adopt([{ id: "spatial", title: "Map", criteria: [{ kind: "preserve", target }] }]);
  return { project, target, ledger };
}

describe("authoritative action acceptance", () => {
  it("represents action proof separately from static map criteria", () => {
    const { target } = setup();
    expect(parseAcceptanceCriteria([{ kind: "actionCombat", target }])).toEqual([{ kind: "actionCombat", target }]);
    expect(parseAcceptanceCriteria([{ kind: "actionCombat", target, pass: true }])).toBeNull();
  });

  it("retains structured action requirements outside replacement plans and repairs", () => {
    const { project, target, ledger } = setup();
    ledger.requireActionCombat([target]);
    ledger.adopt([{ id: "missing", title: "Repair", criteria: null }]);
    expect(ledger.repair("missing", [{ kind: "preserve", target }])).toBe(true);
    const replacement = workPlanFromSetToolArgs({
      goal: "Spatial-only replacement",
      acceptance: [{ id: "spatial", title: "No combat", criteria: [{ kind: "preserve", target }] }],
      layers: [{ title: "Check", items: [{ title: "Inspect", instruction: "Inspect" }] }],
    });
    ledger.adopt(replacement?.acceptance ?? []);
    ledger.resume();
    const snapshot = ledger.evaluate(project);
    expect(snapshot.status).not.toBe("verified");
    expect(snapshot.items.flatMap(item => item.evidence).filter(e => !e.passed)).toHaveLength(1);
  });

  it("does not accept a wait/spawn-only scene result or forged combat receipt", () => {
    const { project, target, ledger } = setup();
    ledger.requireActionCombat([target]);
    const scene = runSceneTest(project, { mapId: target.mapId, start: { x: 1, y: 1 },
      steps: [{ kind: "wait", ticks: 1 }, { kind: "expect", spawnedCount: 0 }] });
    expect(scene.ok).toBe(true);
    expect(ledger.captureActionProof(scene, project)).toBe(false);
    expect(ledger.captureActionProof({ ...scene, mapId: target.mapId, pass: true, status: "verified" }, project)).toBe(false);
    expect(ledger.evaluate(project).status).not.toBe("verified");
  });

  it.each(["failed", "stale"] as const)("cannot publish verified while a %s required check remains", kind => {
    const { project, ledger } = setup();
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_scene_test", { mapId: project.startMapId }, { ok: true, data: { ok: kind !== "failed" } });
    if (kind === "stale") evidence.invalidateAfterWrite();
    expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
  });

  it("skips scheduling without waiving a required check through a replan", () => {
    const { project, ledger } = setup();
    const evidence = new ToolVerificationEvidence();
    const plan = workPlanFromSetToolArgs({ goal: "Verify", layers: [{ title: "QA", items: [
      { id: "qa", title: "Scene", instruction: "Check", successTools: ["run_scene_test"] },
    ] }] });
    if (!plan) throw new Error("Fixture plan missing");
    evidence.requireTools(plan.layers.flatMap(layer => layer.items.flatMap(item => item.successTools ?? [])));
    skipWorkItemById(plan, "qa", "Unable to execute");
    expect(isWorkPlanComplete(plan)).toBe(true);
    evidence.requireTools([]);
    expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
    evidence.observe("run_scene_test", { mapId: project.startMapId }, { ok: true, data: { ok: true } });
    expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("verified");
  });

  it("reports advisory failures without making them required, until explicitly requested", () => {
    const { project, ledger } = setup();
    const evidence = new ToolVerificationEvidence();
    evidence.observe("run_scene_test", { mapId: project.startMapId }, { ok: true, data: { ok: false } }, "advisory");
    expect(evidence.problems().length).toBeGreaterThan(0);
    expect(evidence.problems("required")).toEqual([]);
    expect(ledger.evaluate(project, project, evidence, evidence.problems("required")).status).toBe("verified");
    evidence.requireTools(["run_scene_test"]);
    expect(ledger.evaluate(project, project, evidence, evidence.problems("required")).status).toBe("blocked");
  });

  it("keeps intent action and required checks open despite optionality or genuine withdrawal", () => {
    const { project, target, ledger } = setup();
    const evidence = new ToolVerificationEvidence();
    ledger.adopt([{ id: "optional", title: "Optional event", required: false,
      criteria: [{ kind: "eventCount", target, count: 1 }] },
    { id: "withdrawn", title: "Withdrawn event", criteria: [{ kind: "eventCount", target, count: 1 }] }]);
    expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "withdrawn", reason: "User scope reduction" })).toBe(true);
    expect(ledger.evaluate(project).status).toBe("verified");
    ledger.requireActionCombat([target]);
    evidence.requireTools(["run_action_combat_test"]);
    const snapshot = ledger.evaluate(project, project, evidence, evidence.problems());
    expect(snapshot.status).toBe("blocked");
    expect(snapshot.items.find(item => item.id === "optional")).toMatchObject({ required: false, evidence: [{ passed: false }] });
    expect(snapshot.items.find(item => item.id === "withdrawn")).toMatchObject({ source: { requestId: "goal" },
      withdrawal: { source: "user", reason: "User scope reduction" }, evidence: [{ passed: false }] });
    expect(snapshot.items.filter(item => item.id.startsWith("action-combat:"))).toHaveLength(1);
    expect(snapshot.items.find(item => item.id === "required-verification")?.status).toBe("blocked");
  });

  it("parses structured requirements without routing prose into action or stateful NPC scope", () => {
    const { target } = setup();
    const facts: IntentFacts = { userText: "Action RPG with a guide", currentMap: { id: target.mapId, name: "Arena" },
      maps: [{ id: target.mapId, name: "Arena" }], selection: null, facilityLabels: [], toolNames: [], hasActivePlan: false };
    const actionCombat = { targets: [target, { newMapName: "Arena two" }] };
    expect(parseIntentDeclaration(JSON.stringify({ mode: "create", actionCombat, statefulNpcs: true }), facts).intent)
      .toMatchObject({ actionCombat, statefulNpcs: true });
    const ordinary = parseIntentDeclaration(JSON.stringify({ mode: "create" }), facts).intent;
    expect(ordinary?.actionCombat).toBeUndefined();
    expect(ordinary?.statefulNpcs).toBeUndefined();
    const question = parseIntentDeclaration(JSON.stringify({ mode: "question", actionCombat, statefulNpcs: true }), facts).intent;
    expect(question?.actionCombat).toBeUndefined();
    expect(question?.statefulNpcs).toBeUndefined();
  });

  it("does not waive a skipped check using another item's earlier or later success", () => {
    const { project, ledger } = setup();
    const evidence = new ToolVerificationEvidence();
    const success = { ok: true, data: { ok: true } };
    evidence.observe("run_scene_test", { mapId: "other" }, success, "explicit", "other-item");
    evidence.recordSkippedTools("required-item", ["run_scene_test"]);
    evidence.requireTools([]);
    expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
    evidence.observe("run_scene_test", { mapId: "other" }, success, "explicit", "other-item");
    expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
    evidence.observe("run_scene_test", { mapId: project.startMapId }, success, "explicit", "required-item");
    expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("verified");
  });
});
