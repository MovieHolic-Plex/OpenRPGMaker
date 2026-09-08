import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { crossMapVerification, verificationEvent } from "./fixtures/verificationOwnership";
import { offlineChatResponse } from "./fixtures/offlineChatResponse";
import { fixedDeclarer } from "./intentFixture";

type Call = { name: string; args: Record<string, unknown> };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function harness(project: Project) {
  const network = vi.fn(() => { throw new Error("Canonical contract regression must remain offline"); });
  vi.stubGlobal("fetch", network);
  let queued: Call[] = [];
  let sequence = 0;
  let turns = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 6 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) return offlineChatResponse({ message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" });
      const calls = queued;
      queued = [];
      return offlineChatResponse(calls.length ? { message: { role: "assistant", content: null, tool_calls: calls.map(call => ({
        id: `canonical-${++sequence}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: "CANONICAL_COMPLETE" }, finishReason: "stop" });
    },
  });
  const results = (name: string) => events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call" && event.name === name).map(event => event.result);
  return { session, results, async send(...calls: Call[]) {
    queued = calls;
    events.length = 0;
    const result = await session.sendUserMessage(turns++ === 0 ? "Verify the requested canonical contract." : "Continue.", event => events.push(event), undefined,
      turns === 1 ? {} : { goalAction: "resume" });
    expect(queued).toEqual([]);
    expect(network).not.toHaveBeenCalled();
    return result;
  } };
}

const complete: Call = { name: "complete_work_item", args: {} };
const scene = (args: Record<string, unknown>): Call => ({ name: "run_scene_test", args });
const declare = (criteria: unknown[], required = true): Call => ({ name: "set_work_plan", args: {
  goal: "Canonical acceptance", requirements: [{ id: "contract", title: "Canonical contract", required, criteria }],
  layers: [{ title: "Verification", items: [{ id: "verify", title: "Verify", instruction: "Verify the original contract", requirementIds: ["contract"] }] }],
} });
const repair = (criteria: unknown[]): Call => ({ name: "repair_acceptance", args: { itemId: "contract", criteria } });

function journey() {
  const f = crossMapVerification();
  f.project.session.gold = 37;
  f.project.maps.mapA!.events[0]!.pages![0]!.commands = [{ kind: "changeGold", op: "+=", amount: 20 }];
  const args = { ...f.a };
  const interactionTargets = [{ stepIndex: 2, mapId: "mapA", eventId: "shared_npc" }];
  return { ...f, args, interactionTargets, criterion: { kind: "toolVerdict", tool: "run_scene_test", args, interactionTargets } };
}

function sceneResult(h: ReturnType<typeof harness>, mapId: string, finalMapId: string) {
  const result = h.results("run_scene_test").at(-1)!;
  expect(result).toMatchObject({ ok: true, data: { ok: true, finalState: { mapId: finalMapId },
    interactions: expect.arrayContaining([{ stepIndex: 2, mapId, eventId: "shared_npc" }]) } });
}

describe("canonical scene authority uses the ordinary pre-execution contract", () => {
  it("cannot acquire missing ownership from the first successful scene; repair needs a fresh execution", async () => {
    const f = journey();
    const h = harness(f.project);
    await h.send(declare([{ kind: "toolVerdict", tool: "run_scene_test", args: f.args }]));
    const original = h.session.getAcceptanceSnapshot()!;
    const result = await h.send(scene(f.args), complete);
    sceneResult(h, "mapA", f.root.id);
    expect(result.runOutcome?.goal).toBe("incomplete");
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done"); // Scheduling is not goal satisfaction.
    expect(h.session.getVerificationSnapshot().requirements.some(requirement => requirement.status === "passed")).toBe(false);
    const pending = h.session.getVerificationSnapshot().requirements[0]!;
    await h.send(repair([{ ...f.criterion, args: { ...f.args, start: { x: 1, y: 1 } } }]));
    expect(h.results("repair_acceptance")).toMatchObject([{ ok: false, data: { code: "immutable-valid" } }]);
    expect(h.session.getVerificationSnapshot().requirements[0]).toEqual(pending);
    await h.send(repair([f.criterion]), complete);
    expect(h.results("repair_acceptance")).toMatchObject([{ ok: true }]);
    expect(h.session.getAcceptanceSnapshot()?.items[0]?.source).toEqual(original.items[0]?.source);
    expect(h.session.getVerificationSnapshot().requirements[0]).toMatchObject({ interactionTargets: f.interactionTargets, status: "unverified" });
    expect(h.results("complete_work_item")).toMatchObject([{ ok: false }]);
    const verified = await h.send(scene(f.args), complete);
    expect(verified.runOutcome?.goal).toBe("satisfied");
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });

  it("fills only missing interaction ownership while preserving already declared targets", async () => {
    const f = journey();
    f.root.events.push(verificationEvent("root_npc", 8, 9, []));
    const args = { ...f.args, steps: [...f.args.steps, { kind: "face", dir: "down" }, { kind: "interact", eventId: "root_npc" }] };
    const partial = { ...f.criterion, args };
    const full = { ...partial, interactionTargets: [...f.interactionTargets, { stepIndex: 6, mapId: f.root.id, eventId: "root_npc" }] };
    const h = harness(f.project);
    await h.send(declare([partial]), scene(args), complete);
    const pending = h.session.getVerificationSnapshot().requirements[0]!;
    expect(pending).toMatchObject({ args: null, interactionTargets: f.interactionTargets, status: "pending-specification", initialState: { session: { gold: 37 } } });
    await h.send(repair([{ ...full, interactionTargets: [{ ...f.interactionTargets[0]!, mapId: "mapB" }, full.interactionTargets[1]] }]));
    expect(h.results("repair_acceptance")).toMatchObject([{ ok: false, data: { code: "immutable-valid" } }]);
    expect(h.session.getVerificationSnapshot().requirements[0]).toEqual(pending);
    const protectedProject = h.session.getProposedProject();
    const substitute = structuredClone(protectedProject);
    substitute.session.gold = 99;
    expect(h.session.syncBaselineFromStoreIfClean(substitute)).toBe(true);
    await h.send(repair([full]), complete);
    expect(h.results("repair_acceptance")).toMatchObject([{ ok: true }]);
    expect(h.session.getVerificationSnapshot().requirements[0]).toMatchObject({ checkId: pending.checkId, ownerId: pending.ownerId,
      args, interactionTargets: full.interactionTargets, initialState: pending.initialState, status: "unverified" });
    expect(h.results("complete_work_item")).toMatchObject([{ ok: false }]);
    const substituted = await h.send(scene(args), complete);
    expect(h.results("run_scene_test")).toMatchObject([{ ok: true, data: { ok: true } }]);
    expect(substituted.runOutcome?.goal).toBe("incomplete");
    expect(h.session.getVerificationSnapshot().requirements[0]?.initialState).toEqual(pending.initialState);
    expect(h.session.syncBaselineFromStoreIfClean(protectedProject)).toBe(true);
    const result = await h.send(scene(args), complete);
    expect(result.runOutcome?.goal).toBe("satisfied");
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });

  it.each(["transfer", "initial-state"])("pass -> %s write -> identical foreign execution cannot discharge the original scope", async change => {
    const f = journey();
    const h = harness(f.project);
    await h.send(declare([f.criterion]));
    const original = h.session.getVerificationSnapshot().requirements[0]!;
    expect(original).toMatchObject({ args: f.args, interactionTargets: f.interactionTargets, status: "unverified",
      initialState: { session: { gold: 37 } } });
    const passed = await h.send(scene(f.args), complete);
    sceneResult(h, "mapA", f.root.id);
    expect(passed.runOutcome?.goal).toBe("satisfied");
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    const acceptedProject = h.session.getProposedProject();
    const changed = structuredClone(acceptedProject);
    if (change === "transfer") changed.maps[f.root.id]!.events[0]!.pages![0]!.commands = [{ kind: "transfer", mapId: "mapB", x: 2, y: 2 }];
    else changed.session.gold = 99;
    expect(h.session.syncBaselineFromStoreIfClean(changed)).toBe(true);
    expect(h.session.getVerificationSnapshot().requirements[0]?.status).toBe("stale");
    const foreign = await h.send(scene(f.args), complete);
    sceneResult(h, change === "transfer" ? "mapB" : "mapA", f.root.id);
    expect(h.session.getVerificationSnapshot().requirements[0]).toEqual({ ...original, status: "unverified" });
    expect(h.results("complete_work_item")).toMatchObject([{ ok: false }]);
    expect(foreign.runOutcome).toMatchObject({ execution: "blocked", goal: "incomplete" });
    expect(h.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(h.session.syncBaselineFromStoreIfClean(acceptedProject)).toBe(true);
    const restored = await h.send(scene(f.args), complete);
    expect(h.session.getVerificationSnapshot().requirements[0]).toEqual({ ...original, status: "passed" });
    expect(h.results("complete_work_item")).toMatchObject([{ ok: true }]);
    expect(restored.runOutcome?.goal).toBe("satisfied");
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
  });
});

describe("malformed canonical input remains repairable without rewriting authority", () => {
  it.each([true, false])("malformed scene required=%s blocks; repair retains owner/baseline and needs post-repair proof", async required => {
    const project = createBlankProject();
    const mapId = project.startMapId;
    const originalName = project.maps[mapId]!.name;
    const h = harness(project);
    const args = { mapId, start: { x: 10, y: 12 }, steps: [{ kind: "expect", mapId }] };
    const preserve = { kind: "preserve", target: { mapId } };
    await h.send(declare([{ kind: "toolVerdict", tool: "run_scene_test", args: {} }, preserve], required));
    const original = h.session.getAcceptanceSnapshot()!;
    expect(original.items[0]).toMatchObject({ required: true, status: "blocked" });
    const beforeRepair = await h.send(scene(args), complete);
    expect(h.results("run_scene_test")).toMatchObject([{ ok: true, data: { ok: true } }]);
    expect(beforeRepair.runOutcome?.goal).toBe("incomplete");
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    const changed = h.session.getProposedProject();
    changed.maps[mapId]!.name = "Changed after original adoption";
    expect(h.session.syncBaselineFromStoreIfClean(changed)).toBe(true);
    const valid = [{ kind: "toolVerdict", tool: "run_scene_test", args, interactionTargets: [] }, preserve];
    await h.send(repair(valid), complete);
    expect(h.results("repair_acceptance")).toMatchObject([{ ok: true, data: { code: "repaired" } }]);
    expect(h.session.getAcceptanceSnapshot()?.id).toBe(original.id);
    expect(h.session.getAcceptanceSnapshot()?.items[0]).toMatchObject({ id: original.items[0]!.id, source: original.items[0]!.source });
    const owned = h.session.getVerificationSnapshot().requirements[0]!;
    expect(owned).toMatchObject({ ownerId: `${original.id}:contract`, args, status: "unverified" });
    expect(h.results("complete_work_item")).toMatchObject([{ ok: false }]);
    const changedResult = await h.send(scene(args), complete);
    expect(h.session.getVerificationSnapshot().requirements[0]?.status).toBe("passed");
    expect(h.session.getAcceptanceSnapshot()?.items[0]?.evidence[1]?.passed).toBe(false);
    expect(changedResult.runOutcome?.goal).toBe("incomplete");
    const restored = h.session.getProposedProject();
    restored.maps[mapId]!.name = originalName;
    expect(h.session.syncBaselineFromStoreIfClean(restored)).toBe(true);
    const final = await h.send(scene(args), complete);
    expect(final.runOutcome?.goal).toBe("satisfied");
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    await h.send(repair([{ kind: "toolVerdict", tool: "run_lint", args: {} }]));
    expect(h.results("repair_acceptance")).toMatchObject([{ ok: false, data: { code: "immutable-valid" } }]);
    expect(h.session.getVerificationSnapshot().requirements[0]).toEqual({ ...owned, status: "passed" });
  });

  it("valid optional canonical criteria remain optional", async () => {
    const project = createBlankProject();
    const h = harness(project);
    const args = { mapId: project.startMapId, start: { x: 10, y: 12 }, steps: [{ kind: "expect", goldDelta: 1 }] };
    const result = await h.send(declare([{ kind: "toolVerdict", tool: "run_scene_test", args, interactionTargets: [] }], false), complete);
    expect(result.runOutcome?.goal).toBe("satisfied");
    expect(h.session.getAcceptanceSnapshot()?.items[0]).toMatchObject({ required: false, evidence: [{ passed: false }] });
    expect(h.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    expect(h.session.getVerificationSnapshot().attempts).toEqual([]);
  });
});
