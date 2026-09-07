import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { parseAcceptance, type AcceptancePromise } from "@/ai/assistantAcceptance";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

type Call = { readonly name: string; readonly args: Record<string, unknown> };
const room = { mapId: "request-a-room" };
const start = { mapId: createBlankProject().startMapId };
const region = { x: 0, y: 0, w: 2, h: 2 };
const twoStepItems = [
  { id: "edit", title: "First", instruction: "Rename the room" },
  { id: "verify", title: "Second", instruction: "Check preservation" },
];
function plan(acceptance?: readonly AcceptancePromise[], items = [{ id: "edit", title: "Edit", instruction: "Edit the map" }]): Call {
  return { name: "set_work_plan", args: {
    goal: "Request baseline contract",
    layers: [{ title: "Edit", items }],
    ...(acceptance ? { acceptance } : {}),
  } };
}
const skip: Call = { name: "skip_work_item", args: {} };
const rename = (mapId: string, name: string): Call => ({ name: "set_map_properties", args: { mapId, name } });

async function afterRequestA() {
  // Keep native commit validation, store replacement and pending-to-applied accounting.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
  vi.stubEnv("VITE_SUPABASE_URL", "http://baseline-fixture.invalid");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "fixture");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  let rounds: readonly (readonly Call[])[] = [];
  let index = 0;
  const events: SessionEvent[] = [];
  const instruction = "Edit the requested map";
  const declareIntent = vi.fn(async (facts: Parameters<ReturnType<typeof fixedDeclarer>>[0]) => {
    const calls = rounds.flat();
    const targetMapId = calls.find(call => call.name === "set_map_properties")?.args.mapId;
    const criteria = parseAcceptance(calls.find(call => call.name === "set_work_plan")?.args.acceptance)?.flatMap(promise => promise.criteria ?? []) ?? [];
    return fixedDeclarer({ mode: "modify", targetMapId: typeof targetMapId === "string" ? targetMapId : start.mapId,
      requestRequirements: { entries: [{ source: [{ start: 0, end: instruction.length, quote: instruction }], criteria, bindings: [] }] },
    })(facts);
  });
  const config = { ...defaultAiConfig(), model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 };
  const project = createBlankProject(); store.replace(project);
  const session = new AssistantSession(project, {
    config: { ...config, agentMode: "chat" },
    declareIntent,
    chat: async (_config, request): Promise<ChatResult> => {
      // New user requests are adopted by the main planner, not by resetting IDs in a generator repair.
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "replan", ...rounds[0]?.find(call => call.name === "set_work_plan")?.args }) }, finishReason: "stop" };
      const batch = rounds[index++];
      return batch ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({
        id: `call-${index}-${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" }
        : { message: { role: "assistant", content: "SCRIPTED_SUCCESS" }, finishReason: "stop" };
    },
  });
  const run = async (batches: readonly (readonly Call[])[], autonomous = true, continuing = false) => {
    rounds = batches; index = 0; events.length = 0;
    const controller = new AbortController();
    return session.sendUserMessage(continuing ? "continue" : instruction, event => {
      events.push(event);
      if (autonomous && index > rounds.length && event.type === "run_state" && event.execution.state === "recovering") controller.abort();
    }, controller.signal, { autonomous, ...(continuing ? { goalAction: "resume" } : {}) });
  };
  await run([
    [plan([
      { id: "created", title: "Created room", criteria: [{ kind: "mapDimensions", target: { newMapName: "Request A room" }, width: 20, height: 15 }] },
      { id: "original-change", title: "Original change", criteria: [{ kind: "targetChange", target: start }] },
    ])],
    [{ name: "create_map", args: { id: room.mapId, name: "Request A room", width: 20, height: 15 } }, rename(start.mapId, "Request A start"), skip],
  ]);
  expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
  expect(session.baselineProject.maps[room.mapId]).toBeDefined();
  return { session, events, run, declareIntent, config };
}

function planSnapshot(session: AssistantSession) {
  const snapshot = session.getAcceptanceSnapshot();
  // Keep the whole canonical status; select planner rows only for their original row assertions.
  return snapshot ? { ...snapshot, items: snapshot.items.filter(item => !item.id.startsWith("request-")) } : null;
}

describe("per-request acceptance baselines", () => {
  it("preserves a map created in A while B changes another map", async () => {
    // Given A's applied map and retained promises.
    const { session, run } = await afterRequestA();
    // When B adopts new preservation/change promises and changes only its target.
    await run([[plan([
      { id: "keep-room", title: "Keep room", criteria: [{ kind: "preserve", target: room }] },
      { id: "change-again", title: "Change again", criteria: [{ kind: "targetChange", target: start }] },
    ]), rename(start.mapId, "Request B start"), skip]]);
    // Then old and new promises all verify against their own request snapshots.
    expect(planSnapshot(session)).toMatchObject({ status: "verified", items: [
      { id: "created", status: "verified" }, { id: "original-change", status: "verified" },
      { id: "keep-room", status: "verified" }, { id: "change-again", status: "verified" },
    ] });
  });

  it("does not credit A's change toward a newly accepted B change promise", async () => {
    // Given an already changed map at the start of B.
    const { session, run } = await afterRequestA();
    // When B promises another change but only skips its execution item.
    await run([[plan([{ id: "change-again", title: "Change again", criteria: [{ kind: "targetChange", target: start }] }]), skip]]);
    // Then the original change remains verified, but the new promise fails.
    expect(planSnapshot(session)).toMatchObject({ status: "blocked", items: [
      { id: "created", status: "verified" }, { id: "original-change", status: "verified" },
      { id: "change-again", evidence: [{ passed: false }] },
    ] });
  });

  it.each([false, true])("late adoption cannot baseline away B's earlier write (applied=%s)", async applied => {
    // Given B writes before declaring its new promises, possibly applying a milestone.
    const { session, run, events } = await afterRequestA();
    // When the late plan protects both the whole map and its untouched tile region.
    await run([
      [plan(), rename(room.mapId, "Changed before adoption"), ...(applied ? [{ name: "complete_work_item", args: {} }] : [])],
      [plan([
        { id: "keep-room", title: "Keep room", criteria: [{ kind: "preserve", target: room }] },
        { id: "keep-region", title: "Keep region", criteria: [{ kind: "preserve", target: room, region }] },
        { id: "changed-room", title: "Changed room", criteria: [{ kind: "targetChange", target: room }] },
      ]), skip],
    ]);
    // Then the baseline contains A's room, not the already-mutated B draft/applied map.
    expect(events.filter(event => event.type === "tool_call" && event.name === "set_map_properties")).toMatchObject([{ result: { ok: true } }]);
    if (applied) {
      const milestone = events.findIndex(event => event.type === "milestone_applied");
      const latePlan = events.map(event => event.type === "tool_call" && event.name === "set_work_plan").lastIndexOf(true);
      expect(milestone).toBeGreaterThan(-1);
      expect(milestone).toBeLessThan(latePlan);
    }
    expect(planSnapshot(session)?.items.slice(2)).toMatchObject([
      { id: "keep-room", evidence: [{ passed: false }] },
      { id: "keep-region", status: "verified" },
      { id: "changed-room", status: "verified" },
    ]);
  });

  it("retains B's pre-write baseline across budget-driven synthetic continuation", async () => {
    // Given B has two steps and only one tool fits each execution turn.
    const { session, run, events, config } = await afterRequestA();
    session.updateConfig({ ...config, agentMode: "chat", maxToolCalls: 1 });
    // When the first step applies a change and a synthetic continuation adopts new promises.
    await run([
      [plan(undefined, twoStepItems)],
      [rename(room.mapId, "Changed in first step")],
      [{ name: "complete_work_item", args: {} }],
      [plan([
        { id: "keep-room", title: "Keep room", criteria: [{ kind: "preserve", target: room }] },
        { id: "changed-room", title: "Changed room", criteria: [{ kind: "targetChange", target: room }] },
      ], twoStepItems)],
      [skip],
    ]);
    // Then the applied milestone and continuation cannot turn changed content into a baseline.
    expect(events.some(event => event.type === "milestone_applied")).toBe(true);
    expect(planSnapshot(session)?.items.slice(2)).toMatchObject([
      { id: "keep-room", evidence: [{ passed: false }] }, { id: "changed-room", status: "verified" },
    ]);
  });

  it("retains B's baseline when a manual continuation repairs and replans after application", async () => {
    // Given B's missing-criteria promise is adopted before a real write is applied.
    const { session, run, declareIntent } = await afterRequestA();
    await run([[plan([{ id: "repair", title: "Original repair", criteria: null }]), rename(room.mapId, "B changed room"), skip]]);
    declareIntent.mockImplementation(fixedDeclarer({ mode: "modify", targetMapId: room.mapId, source: "continuation" }));
    // When a continuation repairs the old promise and adds a new one without new writes.
    await run([
      [plan([
        { id: "repair", title: "Replacement", criteria: [{ kind: "eventCount", target: room, count: 0 }] },
        { id: "changed-room", title: "Changed room", criteria: [{ kind: "targetChange", target: room }] },
      ])],
      [{ name: "repair_acceptance", args: { itemId: "repair", criteria: [{ kind: "preserve", target: room }] } }, skip],
    ], true, true);
    // Then repair and duplicate IDs retain the old baseline; new continuation promises use B's too.
    expect(planSnapshot(session)?.items.slice(2)).toMatchObject([
      { id: "repair", title: "Original repair", evidence: [{ passed: false }] },
      { id: "changed-room", status: "verified" },
    ]);
  });
});
