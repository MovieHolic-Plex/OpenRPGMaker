import { describe, expect, it } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import type { Command } from "@/project/types";
import { crossMapVerification } from "./fixtures/verificationOwnership";
import { fixedDeclarer } from "./intentFixture";

const scene = "run_scene_test";
const requirementId = "accepted-route";

function fixture(adopted = false) {
  const f = crossMapVerification();
  f.project.session.gold = 37;
  f.project.maps.mapB!.events[0]!.pages![0]!.commands = [{ kind: "changeGold", op: "+=", amount: 18 }];
  const args = { ...f.a };
  const initialState = structuredClone(f.project.session);
  const evidence = new ToolVerificationEvidence();
  const acceptance = new AssistantAcceptanceLedger("cross-map", "Reward ownership", f.project);
  const criteria = [{ kind: "mapDimensions" as const, target: { mapId: f.root.id }, width: f.root.width, height: f.root.height }];
  acceptance.adopt([{ id: "size", title: "Map", criteria }]);
  if (adopted) evidence.adopt({ checkId: requirementId, ownerId: "owner", name: scene, args, initialState,
    interactionTargets: [{ stepIndex: 2, mapId: "mapA", eventId: "shared_npc" }] });
  const route = (mapId: string) => {
    f.root.events[0]!.pages![0]!.commands = [{ kind: "transfer", mapId, x: 2, y: 2 }];
    evidence.invalidateAfterWrite();
  };
  const repair = (mapId: string) => {
    f.project.maps[mapId]!.events[0]!.pages![0]!.commands = [{ kind: "changeGold", op: "+=", amount: 20 }];
    evidence.invalidateAfterWrite();
  };
  const observe = (checkId?: string, seed = initialState) => {
    const result = runTool({ project: f.project }, scene, args);
    evidence.observe(scene, args, result, "explicit", "owner", checkId, seed);
    return result;
  };
  const terminal = () => acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status;
  return { ...f, args, criteria, initialState, evidence, route, repair, observe, terminal };
}

describe("map-qualified unresolved finding ownership", () => {
  it.each([false, true])("retains both negatives with identical args and seed; repeated owner deduplicates (adopted=%s)", adopted => {
    const f = fixture(adopted);
    expect(f.observe()).toMatchObject({ ok: true, data: { ok: false, finalState: { mapId: f.root.id, gold: 56 } } });
    const a = f.evidence.snapshot().findings[0]!;
    if (adopted) expect(a.checkId).toBe(requirementId);
    f.observe();
    expect(f.evidence.snapshot().findings).toEqual([a]);
    f.route("mapB");
    expect(f.observe()).toMatchObject({ ok: true, data: { ok: false, finalState: { mapId: f.root.id, gold: 55 }, interactions: [
      { stepIndex: 0, mapId: f.root.id, eventId: "doorA" },
      { stepIndex: 2, mapId: "mapB", eventId: "shared_npc" },
      { stepIndex: 3, mapId: "mapB", eventId: "exit" },
    ] } });
    const both = f.evidence.snapshot().findings;
    expect(both).toHaveLength(2);
    expect(new Set(both.map(entry => entry.checkId)).size).toBe(2);
    expect(both[0]).toEqual(a);
    expect(both[1]).toMatchObject({ args: a.args, initialState: a.initialState, ownerId: a.ownerId });
    f.observe();
    expect(f.evidence.snapshot().findings).toEqual(both);
    expect(f.evidence.snapshot().attempts.map(attempt => attempt.status)).toEqual(["negative", "negative", "negative", "negative"]);
    expect(f.terminal()).toBe("blocked");
  });

  it.each([false, true])("an exact A repair cannot verify terminal acceptance while B still fails (adopted=%s)", adopted => {
    const f = fixture(adopted);
    f.observe();
    f.route("mapB");
    f.observe();
    f.route("mapA");
    f.repair("mapA");
    expect(f.observe()).toMatchObject({ ok: true, data: { ok: true } });
    // Assert the terminal boundary before inspecting the finding count: baseline
    // falsely reports verified here, even though a fresh B run remains negative.
    expect(f.terminal()).toBe("blocked");
    const b = f.evidence.snapshot().findings[0]!;
    expect(f.evidence.snapshot().findings).toHaveLength(1);
    expect(b.result).toMatchObject({ data: { interactions: expect.arrayContaining([
      { stepIndex: 2, mapId: "mapB", eventId: "shared_npc" },
    ]) } });
    if (adopted) expect(f.evidence.snapshot().requirements[0]?.status).toBe("passed");
    expect(f.evidence.correction("unknown", f.args)).toBeNull();
    expect(f.evidence.correction(b.checkId, { ...f.args, start: { x: 1, y: 1 } })).toBeNull();
    expect(f.evidence.correction(b.checkId, f.args)).toEqual({ name: scene, args: f.args });
    // A real pass dispatched for B's check is not a pass against B's receipt.
    expect(f.observe(b.checkId)).toMatchObject({ ok: true, data: { ok: true } });
    expect(f.evidence.snapshot().findings).toEqual([b]);
    f.route("mapB");
    expect(f.observe(b.checkId)).toMatchObject({ ok: true, data: { ok: false } });
    expect(f.evidence.snapshot().findings).toEqual([b]);
    f.repair("mapB");
    expect(f.observe(b.checkId)).toMatchObject({ ok: true, data: { ok: true } });
    expect(f.evidence.snapshot().findings).toEqual([]);
    f.route("mapA");
    expect(f.observe()).toMatchObject({ ok: true, data: { ok: true } });
    expect(f.terminal()).toBe("verified");
  });

  it("retains separate initial-state ownership for the same map and arguments", () => {
    const f = fixture();
    f.observe();
    const a = f.evidence.snapshot().findings[0]!;
    f.project.session.gold++;
    const otherSeed = structuredClone(f.project.session);
    f.evidence.invalidateAfterWrite();
    f.observe(undefined, otherSeed);
    expect(f.evidence.snapshot().findings).toHaveLength(2);
    f.repair("mapA");
    f.observe(undefined, otherSeed);
    expect(f.evidence.snapshot().findings).toEqual([a]);
    expect(f.terminal()).toBe("blocked");
    f.project.session = structuredClone(f.initialState);
    f.evidence.invalidateAfterWrite();
    f.observe();
    expect(f.terminal()).toBe("verified");
  });

  it("normal session writes and checkId corrections retain B at the terminal boundary", async () => {
    const f = fixture();
    type Call = { name: string; args: Record<string, unknown> };
    const events: SessionEvent[] = [];
    let session: AssistantSession;
    let originalId: string | undefined;
    let bId: string | undefined;
    let both: ReturnType<AssistantSession["getVerificationSnapshot"]> | undefined;
    const patch = (mapId: string, eventId: string, commands: Command[]): Call => {
      const event = f.project.maps[mapId]!.events.find(event => event.id === eventId)!;
      return { name: "upsert_event", args: { mapId, event: { id: eventId,
        pages: [{ ...structuredClone(event.pages![0]!), commands }] } } };
    };
    const route = (mapId: string) => patch(f.root.id, "doorA", [{ kind: "transfer", mapId, x: 2, y: 2 }]);
    const repair = (mapId: string) => patch(mapId, "shared_npc", [{ kind: "changeGold", op: "+=", amount: 20 }]);
    const correction = (checkId: string | undefined): Call => ({ name: "correct_verification", args: { checkId, args: f.args } });
    const probe: Call = { name: scene, args: f.args };
    const rounds: (() => Call[])[] = [
      () => [{ name: "set_work_plan", args: { goal: "Reward ownership", acceptance: [{ id: "size", title: "Map", criteria: f.criteria }],
        layers: [{ title: "Inspect", items: [{ title: "Reward", instruction: "Check reward", successTools: [scene],
          verificationChecks: [{ tool: scene, args: f.args, interactionTargets: [{ stepIndex: 2, mapId: "mapA", eventId: "shared_npc" }] }] }] }] } }, probe],
      () => {
        originalId = session.getVerificationSnapshot().findings[0]?.checkId;
        return [route("mapB"), probe, probe];
      },
      () => {
        both = session.getVerificationSnapshot();
        bId = both.findings.find(finding => finding.checkId !== originalId)?.checkId;
        return [correction("unknown"), route("mapA"), repair("mapA"), correction(bId), correction(originalId)];
      },
    ];
    let round = 0;
    session = new AssistantSession(f.project, {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 20 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
      chat: async (_config, request): Promise<ChatResult> => {
        if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
        const calls = rounds.shift()?.();
        round++;
        return calls ? { message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({
          id: `${round}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
        })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
      },
    });
    await session.sendUserMessage("Inspect reward ownership.", event => events.push(event));
    expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(both?.findings).toHaveLength(2);
    expect(both?.requirements).toHaveLength(1);
    expect(originalId).toBe(both?.requirements[0]?.checkId);
    expect(both?.findings[0]?.initialState).toEqual(both?.findings[1]?.initialState);
    expect(both?.findings[0]?.args).toEqual(both?.findings[1]?.args);
    expect(session.getVerificationSnapshot().findings.map(finding => finding.checkId)).toEqual([bId]);
    expect(session.getVerificationSnapshot().requirements[0]?.status).toBe("passed");
    const corrections = events.filter(event => event.type === "tool_call" && event.name === "correct_verification");
    expect(corrections.map(event => event.type === "tool_call" && event.result.ok)).toEqual([false, true, true]);
    expect(corrections[1]).toMatchObject({ result: { data: { ok: true, tool: scene, checkId: bId,
      verification: { findings: both?.findings } } } });
    const writes = events.filter(event => event.type === "tool_call" && event.name === "upsert_event");
    expect(writes.map(event => event.type === "tool_call" && event.result.ok)).toEqual([true, true, true]);
    expect(session.getVerificationSnapshot().attempts.map(attempt => attempt.status)).toEqual(["negative", "negative", "negative", "passed", "passed"]);
    rounds.push(() => [route("mapB"), repair("mapB"), correction(bId), route("mapA"), probe]);
    await session.sendUserMessage("Continue.", event => events.push(event));
    expect(session.getVerificationSnapshot().findings).toEqual([]);
    expect(session.getVerificationSnapshot().requirements).toHaveLength(1);
    expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
  });
});
