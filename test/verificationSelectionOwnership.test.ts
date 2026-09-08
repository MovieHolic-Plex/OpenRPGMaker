import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import { runSceneTest, type SceneStep } from "@/testing/sceneTestRunner";
import { crossMapVerification, verificationEvent } from "./fixtures/verificationOwnership";
import { fixedDeclarer } from "./intentFixture";

const scene = "run_scene_test";
const selections = ["front", "underfoot", "farm-front", "farm-underfoot", "no-target"] as const;
type Selection = typeof selections[number];
const network = vi.fn(() => { throw new Error("Unexpected network call in offline selection proof"); });
beforeEach(() => { network.mockClear(); vi.stubGlobal("fetch", network); });
afterEach(() => { vi.unstubAllGlobals(); expect(network).not.toHaveBeenCalled(); });

function fixture(selection: Selection = "front") {
  const f = crossMapVerification();
  const breakTarget = (mapId: string) => {
    const map = f.project.maps[mapId]!;
    const npc = map.events[0]!;
    npc.id = "other_npc";
    npc.pages![0]!.commands = [{ kind: "changeGold", op: "+=", amount: 20 }];
    if (selection === "underfoot") npc.y = 2;
    if (selection.startsWith("farm") || selection === "no-target") map.events.shift();
    if (selection.startsWith("farm")) {
      map.farmableArea = [{ x: 2, y: selection === "farm-front" ? 3 : 2, w: 1, h: 1 }];
      const hoe = f.project.database.items[0]!;
      hoe.farmTool = "hoe";
      f.project.session.inventory[hoe.id] = 1;
    }
  };
  const route = (mapId: string) => {
    f.root.events[0]!.pages![0]!.commands = [{ kind: "transfer", mapId, x: 2, y: 2 }];
  };
  const repair = (mapId: string) => {
    const map = f.project.maps[mapId]!;
    map.events = map.events.filter(event => event.id !== "other_npc");
    map.events.unshift(verificationEvent("shared_npc", 2, 3, [{ kind: "changeGold", op: "+=", amount: 20 }]));
  };
  breakTarget("mapA");
  const args = { ...f.a };
  const probe = () => runTool({ project: f.project }, scene, args);
  return { ...f, args, breakTarget, route, repair, probe };
}

function intended(mapId: string, stepIndex = 2) { return { stepIndex, mapId, eventId: "shared_npc" }; }

describe("failed selection receipts through the registered scene runner", () => {
  it.each(selections)("%s retains failed intent separately and rejects a foreign exact-input pass", selection => {
    const f = fixture(selection);
    const evidence = new ToolVerificationEvidence();
    const failed = f.probe();
    if (selection === "no-target") expect(failed).toMatchObject({ data: { setupFailure: { kind: "no-interaction-target" } } });
    else expect(failed.data).not.toHaveProperty("setupFailure");
    if (selection.startsWith("farm")) {
      const state = runSceneTest(f.project, f.a).session;
      expect(state.farmPlots?.mapA?.[selection === "farm-front" ? "2,3" : "2,2"]?.tilled).toBe(true);
    }
    expect(failed).toMatchObject({ ok: true, data: { ok: false, failedStepIndex: 2,
      failedSelection: intended("mapA"), finalState: { mapId: "mapA" },
      interactions: [{ stepIndex: 0, mapId: f.root.id, eventId: "doorA" }] } });
    evidence.observe(scene, f.args, failed);
    const original = evidence.snapshot().findings[0]!;
    expect(evidence.snapshot().attempts[0]?.status).toBe("negative");
    f.route("mapB");
    const passed = f.probe();
    expect(passed).toMatchObject({ ok: true, data: { ok: true } });
    expect(passed.data).not.toHaveProperty("failedSelection");
    evidence.observe(scene, f.args, passed);
    expect(evidence.snapshot().findings).toEqual([original]);
    f.route("mapA");
    f.repair("mapA");
    const repaired = f.probe();
    expect(repaired).toMatchObject({ ok: true, data: { ok: true } });
    evidence.observe(scene, f.args, repaired);
    expect(evidence.snapshot().findings).toEqual([]);
  });

  it.each(selections)("%s deduplicates only the same map's negative and retains B after repairing A", selection => {
    const f = fixture(selection);
    const evidence = new ToolVerificationEvidence();
    const observe = () => evidence.observe(scene, f.args, f.probe());
    observe();
    observe();
    expect(evidence.snapshot().findings).toHaveLength(1);
    f.breakTarget("mapB");
    f.route("mapB");
    observe();
    observe();
    const both = evidence.snapshot().findings;
    expect(both).toHaveLength(2);
    expect(both[0]?.checkId).not.toBe(both[1]?.checkId);
    f.route("mapA");
    f.repair("mapA");
    observe();
    expect(evidence.snapshot().findings).toEqual([both[1]]);
    f.route("mapB");
    expect(f.probe()).toMatchObject({ ok: true, data: { ok: false } });
  });

  it.each(selections)("%s allows a same-map facing repair against the intended event", selection => {
    const f = fixture(selection);
    f.project.maps.mapA!.events.push(verificationEvent("shared_npc", 3, 2, [{ kind: "changeGold", op: "+=", amount: 20 }]));
    const evidence = new ToolVerificationEvidence();
    evidence.observe(scene, f.args, f.probe());
    const id = evidence.snapshot().findings[0]!.checkId;
    const args = { ...f.args, steps: f.args.steps.flatMap((step): SceneStep[] => step.kind === "interact"
      ? [{ kind: "face", dir: "right" }, step] : [step]) };
    expect(evidence.correction(id, args)).toEqual({ name: scene, args });
    const passed = runTool({ project: f.project }, scene, args);
    expect(passed).toMatchObject({ ok: true, data: { ok: true, interactions: expect.arrayContaining([intended("mapA", 3)]) } });
    expect(passed.data).not.toHaveProperty("failedSelection");
    evidence.observe(scene, args, passed, "explicit", undefined, id);
    expect(evidence.snapshot().findings).toEqual([]);
  });

  it.each(["game-over", "missing-map"])("%s distinguishes failed selection from the preceding event's failure", failure => {
    const f = crossMapVerification();
    f.project.maps.mapA!.events[0]!.pages![0]!.commands = failure === "game-over"
      ? [{ kind: "gameOver" }] : [{ kind: "transfer", mapId: "missing", x: 2, y: 2 }];
    const args = { ...f.a, steps: [...f.a.steps.slice(0, 3), { kind: "interact", eventId: "shared_npc" }] };
    const failed = runTool({ project: f.project }, scene, args);
    expect(failed).toMatchObject({ ok: true, data: { ok: false, failedStepIndex: failure === "game-over" ? 3 : 2,
      finalState: { mapId: failure === "game-over" ? "mapA" : "missing" },
      interactions: [{ stepIndex: 0, mapId: f.root.id, eventId: "doorA" }, intended("mapA")] } });
    if (failure === "game-over") expect(failed).toMatchObject({ data: { failedSelection: intended("mapA", 3) } });
    // A missing transfer map stops in runEventView's autorun boundary before
    // the next interact step. Do not invent an unexecuted selection receipt.
    else expect(failed.data).not.toHaveProperty("failedSelection");
  });

  it("selected-event execution failure is not a failed selection; unowned no-target stays a setup failure", () => {
    const f = crossMapVerification();
    f.project.maps.mapA!.events[0]!.pages![0]!.commands = [{ kind: "openLoadMenu" }];
    const executed = runSceneTest(f.project, f.a);
    expect(executed.ok).toBe(false);
    expect(executed.interactions).toContainEqual(intended("mapA"));
    expect(executed).not.toHaveProperty("failedSelection");
    const args = { mapId: f.root.id, start: { x: 8, y: 8 }, steps: [{ kind: "interact" }] };
    const empty = runTool({ project: f.project }, scene, args);
    expect(empty).toMatchObject({ ok: true, data: { ok: false, interactions: [], setupFailure: { kind: "no-interaction-target" } } });
    expect(empty.data).not.toHaveProperty("failedSelection");
    const evidence = new ToolVerificationEvidence();
    evidence.observe(scene, args, empty);
    expect(evidence.snapshot()).toMatchObject({ findings: [], attempts: [{ status: "setup-failure" }] });
  });
});

type Call = { name: string; args: Record<string, unknown> };
function normalSession(f: ReturnType<typeof fixture>) {
  let calls: Call[] = [];
  let round = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(f.project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
      const batch = calls;
      calls = [];
      round++;
      return batch.length ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({
        id: `${round}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
    },
  });
  // A genuine independent requirement makes work-item completion observable;
  // the exploratory failed NPC must block it even when this check passes.
  const required: Call = { name: scene, args: { mapId: f.root.id, start: { x: 2, y: 2 }, steps: [{ kind: "expect", mapId: f.root.id }] } };
  const plan: Call = { name: "set_work_plan", args: { goal: "Selection ownership", acceptance: [{ id: "size", title: "Map", criteria: [
    { kind: "mapDimensions", target: { mapId: f.root.id }, width: f.root.width, height: f.root.height },
  ] }], layers: [{ title: "Inspect", items: [{ id: "qa", title: "Check", instruction: "Inspect", successTools: [scene],
    verificationChecks: [{ tool: scene, args: required.args, interactionTargets: [] }] }] }] } };
  return { session, events, plan, required, async send(batch: Call[]) {
    calls = batch;
    await session.sendUserMessage("Inspect selection ownership.", event => events.push(event));
  } };
}

describe.each(["ordinary", "correct_verification"])("normal session selection ownership via %s", mode => {
  it.each(["foreign-pass", "two-negatives", "no-target-control"])("%s stays blocked until each failed map is repaired", async scenario => {
    const f = fixture(scenario === "no-target-control" ? "no-target" : "front");
    const s = normalSession(f);
    const probe: Call = { name: scene, args: f.args };
    const rerun = (checkId: string): Call => mode === "ordinary" ? probe : { name: "correct_verification", args: { checkId, args: f.args } };
    await s.send([s.plan, probe, s.required]);
    const a = s.session.getVerificationSnapshot().findings[0]!;
    expect(a).toBeDefined();
    expect(s.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(s.session.getVerificationSnapshot().requirements[0]?.status).toBe("passed");
    if (scenario === "two-negatives") f.breakTarget("mapB");
    f.route("mapB");
    expect(s.session.syncBaselineFromStoreIfClean(f.project)).toBe(true);
    await s.send([scenario === "two-negatives" ? probe : rerun(a.checkId), s.required]);
    const both = s.session.getVerificationSnapshot().findings;
    // At the reviewed base the foreign pass incorrectly verifies acceptance.
    expect(s.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(both).toHaveLength(scenario === "two-negatives" ? 2 : 1);
    expect(both[0]).toEqual(a);
    expect(s.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("done");
    f.route("mapA");
    expect(f.probe()).toMatchObject({ ok: true, data: { ok: false } });
    f.repair("mapA");
    expect(s.session.syncBaselineFromStoreIfClean(f.project)).toBe(true);
    await s.send([rerun(a.checkId), s.required]);
    if (scenario === "two-negatives") {
      expect(s.session.getVerificationSnapshot().findings).toEqual([both[1]]);
      expect(s.session.getAcceptanceSnapshot()?.status).toBe("blocked");
      expect(s.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("done");
      f.route("mapB");
      expect(f.probe()).toMatchObject({ ok: true, data: { ok: false } });
      f.repair("mapB");
      expect(s.session.syncBaselineFromStoreIfClean(f.project)).toBe(true);
      await s.send([rerun(both[1]!.checkId), s.required]);
    }
    expect(s.session.getVerificationSnapshot().findings).toEqual([]);
    expect(s.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(s.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    const results = s.events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(event => event.result.ok)).toBe(true);
    if (mode === "correct_verification") expect(results.filter(event => event.name === mode).every(event =>
      (event.result.data as { tool: string }).tool === scene)).toBe(true);
  });
});
