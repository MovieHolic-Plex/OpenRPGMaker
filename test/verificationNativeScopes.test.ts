import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { parseToolVerdict } from "@/ai/agentVerification";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { parseVerificationChecks, type VerificationCheck } from "@/ai/toolVerificationEvidence";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { getTool, runTool } from "@/editor/tools";
import { fixedDeclarer } from "./intentFixture";
import { unboundCriterionCheck, verificationEvent } from "./fixtures/verificationOwnership";

type Call = { name: string; args: Record<string, unknown> };
const nonMapTools = ["run_lint", "evaluate_game_quality", "verify_quest", "simulate_battle", "play_walkthrough"];
const mapTools = ["check_reachability", "run_scene_test", "run_action_combat_test"];

function nativeCall(name: string, project: Project, mapId = project.startMapId): Call {
  switch (name) {
    case "verify_quest": {
      project.startPos = { x: 5, y: 4 };
      project.switches.push({ id: "sw_native_scope", name: "Native scope" });
      project.session.switches.sw_native_scope = false;
      project.maps[project.startMapId]!.events.push(verificationEvent("native_npc", 5, 5,
        [{ kind: "setSwitch", switchId: "sw_native_scope", value: true }]));
      const context = { project };
      const result = runTool(context, "define_quest", { id: "native-quest", title: "Native quest",
        nodes: [{ id: "talk", description: "Talk", completesWhen: { kind: "switch", switchId: "sw_native_scope", value: true } }], edges: [] });
      expect(result.ok).toBe(true);
      Object.assign(project, context.project);
      return { name, args: { questId: "native-quest" } };
    }
    case "simulate_battle": return { name, args: { troopId: project.database.troops[0]!.id, heroLevel: 1, n: 1, seed: 42 } };
    case "play_walkthrough": return { name, args: { scenario: [{ expect: "mapId", mapId }], seed: 42 } };
    case "check_reachability": return { name, args: { mapId, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }] } };
    case "run_scene_test": return { name, args: { mapId, start: { x: 10, y: 12 }, steps: [{ kind: "expect", mapId }] } };
    case "run_action_combat_test": return { name, args: { mapId } };
    default: return { name, args: {} };
  }
}

function declaration(call: Call, checkId?: string): VerificationCheck {
  return { tool: call.name, args: call.args, ...(checkId ? { checkId } : {}),
    ...(call.name === "run_scene_test" ? { interactionTargets: [] } : {}) };
}

function plan(project: Project, name: string, checks?: readonly VerificationCheck[], mapTargets: string[] = [project.startMapId]): Call {
  return { name: "set_work_plan", args: { goal: "Native verification",
    acceptance: [{ id: "preserve", title: "Preserve map", criteria: [{ kind: "preserve", target: { mapId: project.startMapId } }] }],
    layers: [{ title: "Inspection", items: [{ id: "same-scheduling-id", title: "Check", instruction: "Check",
      successTools: [name], mapTargets, ...(checks ? { verificationChecks: checks } : {}) }] }] } };
}

function rig(project: Project) {
  let calls: Call[] = [];
  let round = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
      const batch = calls;
      calls = [];
      round++;
      if (!batch.length) return { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
      return { message: { role: "assistant", content: null, tool_calls: batch.map((call, index) => ({
        id: `${round}-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" };
    },
  });
  return { session, events, async send(batch: Call[]) {
    calls = batch;
    return session.sendUserMessage("Inspect the declared check.", event => events.push(event));
  } };
}

function results(events: SessionEvent[], name: string) {
  return events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call" && event.name === name)
    .map(event => event.result);
}

const complete: Call = { name: "complete_work_item", args: {} };

describe("native verification scopes through the real session and terminal acceptance", () => {
  it.each(nonMapTools)("%s adopts native arguments with retained mapTargets and completes only after a real pass", async name => {
    const project = createBlankProject();
    const call = nativeCall(name, project);
    const check = declaration(call);
    expect(getTool(name)!.parameters.properties?.mapId).toBeUndefined();
    expect(parseVerificationChecks([check])).toEqual([check]);
    const f = rig(project);
    await f.send([plan(project, name, [check])]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(results(f.events, "set_work_plan").map(result => result.ok)).toEqual([true]);
    expect(original).toMatchObject({ name, args: call.args, mapTargets: [project.startMapId], status: "unverified" });
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("done");
    await f.send([call, complete]);
    expect(results(f.events, name).length).toBeGreaterThan(0);
    expect(results(f.events, name).every(result => parseToolVerdict(name, result).pass)).toBe(true);
    expect(results(f.events, "complete_work_item").map(result => result.ok)).toEqual([true]);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([{ ...original, status: "passed" }]);
    expect(f.session.getVerificationSnapshot().findings).toEqual([]);
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("done");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(f.session.getProposedProject()).toEqual(project);
  });

  it.each(nonMapTools)("%s resolves a pending checkId without changing owner or targets or borrowing a prior pass", async name => {
    const project = createBlankProject();
    const call = nativeCall(name, project);
    const f = rig(project);
    await f.send([plan(project, name, [unboundCriterionCheck(name)]), call]);
    const pending = f.session.getVerificationSnapshot().requirements[0]!;
    expect(pending).toMatchObject({ args: null, mapTargets: [project.startMapId], status: "pending-specification" });
    expect(results(f.events, name).every(result => parseToolVerdict(name, result).pass)).toBe(true);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    const priorAttemptCount = f.session.getVerificationSnapshot().attempts.length;
    await f.send([plan(project, name, [declaration(call, pending.checkId)]), complete]);
    // The adoption response precedes terminal advisory checks. In particular, an earlier
    // quality call arms a real fresh quality execution at the end of every later turn.
    const expected = { checkId: pending.checkId, ownerId: pending.ownerId,
      args: call.args, mapTargets: pending.mapTargets, status: "unverified" };
    expect(results(f.events, "set_work_plan").at(-1)?.data).toMatchObject({
      verification: { requirements: [expected] }, acceptance: { status: "blocked" },
    });
    const specified = f.session.getVerificationSnapshot().requirements;
    expect(specified).toHaveLength(1);
    expect(results(f.events, "complete_work_item").map(result => result.ok)).toEqual([false]);
    if (name === "evaluate_game_quality") {
      const fresh = f.session.getVerificationSnapshot().attempts.slice(priorAttemptCount).filter(attempt => attempt.name === name);
      expect(fresh.length).toBeGreaterThan(0);
      for (const attempt of fresh) {
        expect(attempt).toMatchObject({ args: call.args, status: "passed" });
        expect(parseToolVerdict(name, attempt.result).pass).toBe(true);
      }
      expect(specified[0]).toMatchObject({ ...expected, status: "passed" });
    } else {
      expect(specified[0]).toMatchObject(expected);
      expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    }
    await f.send([call, complete]);
    expect(results(f.events, "complete_work_item").map(result => result.ok)).toEqual([false, true]);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([{ ...specified[0], status: "passed" }]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(mapTools)("%s rejects a foreign map declaration and resolves the pending ID only on its retained map", async name => {
    const project = createBlankProject();
    const foreignId = "foreign-map";
    project.maps[foreignId] = { ...structuredClone(project.maps[project.startMapId]!), id: foreignId };
    const foreign = nativeCall(name, project, foreignId);
    const own = nativeCall(name, project);
    expect(getTool(name)!.parameters.required).toContain("mapId");
    expect(parseVerificationChecks([declaration(foreign)])).toEqual([declaration(foreign)]);
    const f = rig(project);
    // Action combat is declaration-only here: executing it would launch the forbidden browser harness.
    await f.send([plan(project, name, [declaration(foreign)]), ...(name === "run_action_combat_test" ? [] : [foreign])]);
    const pending = f.session.getVerificationSnapshot().requirements[0]!;
    expect(pending).toMatchObject({ args: null, mapTargets: [project.startMapId], status: "pending-specification" });
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await f.send([plan(project, name, [declaration(own, pending.checkId)])]);
    expect(f.session.getVerificationSnapshot().requirements).toHaveLength(1);
    expect(f.session.getVerificationSnapshot().requirements[0]).toMatchObject({ checkId: pending.checkId,
      ownerId: pending.ownerId, args: own.args, mapTargets: pending.mapTargets, status: "unverified" });
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    if (name !== "run_action_combat_test") {
      await f.send([own, complete]);
      expect(results(f.events, name).every(result => parseToolVerdict(name, result).pass)).toBe(true);
      expect(f.session.getVerificationSnapshot().requirements[0]?.status).toBe("passed");
      expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    } else {
      expect(results(f.events, name)).toEqual([]);
    }
  });

  it("a project-scoped pending owner cannot shed retained mapTargets during resolution", async () => {
    const project = createBlankProject();
    const call = nativeCall("run_lint", project);
    const f = rig(project);
    await f.send([plan(project, call.name, [unboundCriterionCheck(call.name)])]);
    const pending = f.session.getVerificationSnapshot().requirements[0]!;
    await f.send([plan(project, call.name, [declaration(call, pending.checkId)], []), call]);
    expect(f.session.getVerificationSnapshot().requirements.find(check => check.checkId === pending.checkId)).toEqual(pending);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(f.session.getWorkPlan()?.layers[0]?.items[0]?.status).not.toBe("done");
  });

  it("native scope compatibility does not replace an already adopted project check's exact arguments", async () => {
    const project = createBlankProject();
    const call = nativeCall("run_lint", project);
    const changed = { name: call.name, args: { reachability: [nativeCall("check_reachability", project).args] } };
    const f = rig(project);
    await f.send([plan(project, call.name, [declaration(call)])]);
    const original = f.session.getVerificationSnapshot().requirements[0]!;
    expect(original.status).toBe("unverified");
    const before = { plan: f.session.getWorkPlan(), acceptance: f.session.getAcceptanceSnapshot(), verification: f.session.getVerificationSnapshot() };
    const candidate = plan(project, call.name, [declaration(changed, original.checkId)]);
    candidate.args.goal = "Rejected replacement";
    (candidate.args.acceptance as unknown[]).push({ id: "candidate-only", title: "New promise", criteria: null });
    await f.send([candidate]);
    const rejection = results(f.events, "set_work_plan").at(-1)!;
    expect(rejection.ok).toBe(false);
    expect(rejection.data).toMatchObject({ ...before, conflicts: [{ checkId: original.checkId, reason: expect.any(String) }] });
    expect(f.session.getAcceptanceSnapshot()?.items.some(item => item.id === "candidate-only")).toBe(false);
    expect(f.session.getWorkPlan()?.goal).toBe(before.plan?.goal);
    await f.send([changed]);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([original]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    await f.send([call, complete]);
    expect(f.session.getVerificationSnapshot().requirements).toEqual([{ ...original, status: "passed" }]);
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });
});
