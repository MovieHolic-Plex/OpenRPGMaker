import assert from "node:assert/strict";
import { AssistantSession, type SessionEvent } from "../../../src/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "../../../src/ai/llmClient";
import { runTool } from "../../../src/editor/tools";
import { crossMapVerification } from "../../../test/fixtures/verificationOwnership";
import { fixedDeclarer } from "../../../test/intentFixture";

type Call = { name: string; args: Record<string, unknown> };
let networkCalls = 0;
globalThis.fetch = async () => { networkCalls++; throw new Error("Offline proof attempted network"); };
const records: unknown[] = [];
for (const mode of ["ordinary", "correct_verification"]) {
  for (const scenario of ["foreign-pass", "two-negatives", "no-target-control"]) {
    const f = crossMapVerification();
    const npcA = f.project.maps.mapA!.events[0]!;
    npcA.id = "other_npc";
    if (scenario === "no-target-control") f.project.maps.mapA!.events.shift();
    let calls: Call[] = [];
    let sequence = 0;
    const events: SessionEvent[] = [];
    const session = new AssistantSession(f.project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "offline-script", liteModel: "offline-script", apiKey: "unused", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
      chat: async (_config, request): Promise<ChatResult> => {
        if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
        const batch = calls;
        calls = [];
        return batch.length ? { message: { role: "assistant", content: null, tool_calls: batch.map(call => ({
          id: `offline-${++sequence}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
        })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
      },
    });
    const send = async (batch: Call[]) => {
      calls = batch;
      await session.sendUserMessage("Inspect selection ownership.", event => events.push(event));
    };
    const checkpoints: unknown[] = [];
    const capture = (label: string) => {
      const snapshot = session.getVerificationSnapshot();
      const state = { label, acceptance: session.getAcceptanceSnapshot()?.status,
        item: session.getWorkPlan()?.layers[0]?.items[0]?.status,
        requirements: snapshot.requirements.map(check => ({ id: check.checkId, status: check.status })),
        findings: snapshot.findings.map(finding => ({ id: finding.checkId, args: finding.args, result: finding.result })),
        attempts: snapshot.attempts.map(attempt => ({ status: attempt.status, checkId: attempt.checkId })) };
      checkpoints.push(state);
      return state;
    };
    const required: Call = { name: "run_scene_test", args: { mapId: f.root.id, start: { x: 2, y: 2 }, steps: [{ kind: "expect", mapId: f.root.id }] } };
    const probe: Call = { name: "run_scene_test", args: { ...f.a } };
    const rerun = (checkId: string): Call => mode === "ordinary" ? probe : { name: mode, args: { checkId, args: f.a } };
    const route = (mapId: string) => { f.root.events[0]!.pages![0]!.commands = [{ kind: "transfer", mapId, x: 2, y: 2 }]; };
    const sync = () => assert.equal(session.syncBaselineFromStoreIfClean(f.project), true);
    await send([{ name: "set_work_plan", args: { goal: "Selection ownership", acceptance: [{ id: "size", title: "Map", criteria: [
      { kind: "mapDimensions", target: { mapId: f.root.id }, width: f.root.width, height: f.root.height },
    ] }], layers: [{ title: "Inspect", items: [{ id: "qa", title: "Check", instruction: "Inspect", successTools: [probe.name],
      verificationChecks: [{ tool: required.name, args: required.args, interactionTargets: [] }] }] }] } }, probe, required]);
    const a = session.getVerificationSnapshot().findings[0]!;
    assert.equal(capture("A negative").acceptance, "blocked");
    if (scenario === "two-negatives") f.project.maps.mapB!.events[0]!.id = "other_npc";
    route("mapB"); sync();
    await send([scenario === "two-negatives" ? probe : rerun(a.checkId), required]);
    const both = session.getVerificationSnapshot().findings;
    const foreign = capture("B rerun");
    assert.equal(foreign.acceptance, "blocked");
    assert.notEqual(foreign.item, "done");
    assert.equal(both.length, scenario === "two-negatives" ? 2 : 1);
    route("mapA");
    assert.equal((runTool({ project: f.project }, probe.name, probe.args).data as { ok: boolean }).ok, false);
    npcA.id = "shared_npc";
    npcA.pages![0]!.commands = [{ kind: "changeGold", op: "+=", amount: 20 }];
    if (scenario === "no-target-control") f.project.maps.mapA!.events.unshift(npcA);
    sync(); await send([rerun(a.checkId), required]);
    const repairA = capture("A repaired");
    if (scenario === "two-negatives") {
      assert.equal(repairA.acceptance, "blocked");
      assert.notEqual(repairA.item, "done");
      assert.deepEqual(session.getVerificationSnapshot().findings, [both[1]]);
      route("mapB");
      assert.equal((runTool({ project: f.project }, probe.name, probe.args).data as { ok: boolean }).ok, false);
      f.project.maps.mapB!.events[0]!.id = "shared_npc";
      sync(); await send([rerun(both[1]!.checkId), required]);
    }
    const complete = capture("all failed maps repaired");
    assert.equal(complete.acceptance, "verified");
    assert.equal(complete.item, "done");
    assert.equal(complete.findings.length, 0);
    const results = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    assert(results.every(event => event.result.ok));
    records.push({ mode, scenario, checkpoints, toolCalls: results.map(event => ({ name: event.name, ok: event.result.ok })) });
  }
}
assert.equal(networkCalls, 0);
console.log(JSON.stringify({ base: "bb0ca961498e872276292ed0139d11b216c9b7aa", scope: "offline registered runner and normal session; scripted responses only", networkCalls, records }, null, 2));
