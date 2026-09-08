import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent, type SessionTurnOptions, type TurnResult } from "@/ai/assistantSession";
import { LlmError, type ChatResult } from "@/ai/llmClient";
import { clearTimeout, setTimeout } from "node:timers";
import { setImmediate } from "node:timers/promises";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";
import { runTool } from "@/editor/tools";
import { getTool } from "@/editor/tools/toolRegistry";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { fixedDeclarer } from "./intentFixture";

type Call = { name: string; args: Record<string, unknown> };
type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;
const call = (name: string, args: Record<string, unknown> = {}): Call => ({ name, args });
const title = call("set_title_screen", { title: "Batch complete" });
const complete = call("complete_work_item");
const plan = call("set_work_plan", {
  goal: "제목 설정",
  layers: [{ title: "설정", items: [{ title: "제목 설정", instruction: "set_title_screen", successTools: ["set_title_screen"] }] }],
});

const ownedRuns = new Set<{ controller: AbortController; pending: Promise<TurnResult> }>();
async function bounded<T>(pending: Promise<T>, controller?: AbortController): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller?.abort(); reject(new Error("Batch fixture completion deadline")); }, 10_000);
    })]);
  } finally { clearTimeout(timer); }
}

afterEach(async () => {
  for (const run of ownedRuns) run.controller.abort();
  await bounded(Promise.all([...ownedRuns].map(run => run.pending)));
  ownedRuns.clear();
  resetIntentDeclarationCache();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const titleRequest = 'Set title to "Batch complete"';
const mapClause = "Change the map region";
function harness(rounds: Call[][], source?: "title" | "title-and-map") {
  const context = { project: createBlankProject() };
  expect(runTool(context, "create_map", { id: "map_other", name: "Other", width: 20, height: 15 }).ok).toBe(true);
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "test-batch");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(context.project);
  resetMapEditHistory();
  let next = 0;
  const scriptedIds: string[] = [];
  const raw = source === "title-and-map" ? `${titleRequest}; ${mapClause}` : titleRequest;
  const requestRequirements = { entries: [{
    source: [{ start: 0, end: titleRequest.length, quote: titleRequest }],
    criteria: [{ kind: "valueEquals", subject: { kind: "project" }, path: ["meta", "title"], value: "Batch complete" }],
    bindings: [{ source: { start: titleRequest.indexOf('"'), end: titleRequest.length, quote: '"Batch complete"' },
      role: "value", criterionIndex: 0, fieldPath: ["value"] }],
  }, ...(source === "title-and-map" ? [{
    source: [{ start: titleRequest.length + 2, end: raw.length, quote: mapClause }],
    criteria: [{ kind: "targetChange", target: { mapId: context.project.startMapId }, region: { x: 2, y: 2, w: 2, h: 2 } }], bindings: [],
  }] : [])] };
  let resuming = false;
  let plannerCalls = 0;
  const session = new AssistantSession(context.project, {
    config: { authMode: "apiKey", agentMode: "chat", baseUrl: "x", model: "test", apiKey: "test", maxTokens: 8192, maxToolCalls: 12 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, ...(source ? { requestRequirements } : {}) }),
    yieldToUi: () => setImmediate(),
    chat: async (_config, request): Promise<ChatResult> => {
      if (resuming && !request.tools?.length) {
        plannerCalls += 1;
        return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
      }
      const batch = rounds[next++];
      if (batch) scriptedIds.push(...batch.map((_, index) => `batch-${next}-${index}`));
      if (!batch && source) throw new LlmError("Unexpected batch fixture transport exhaustion", 401);
      return batch
        ? { message: { role: "assistant", content: null, tool_calls: batch.map((entry, index) => ({
          id: `batch-${next}-${index}`, type: "function", function: { name: entry.name, arguments: JSON.stringify(entry.args) },
        })) }, finishReason: "tool_calls" }
        : { message: { role: "assistant", content: "검증 종료" }, finishReason: "stop" };
    },
  });
  const events: ToolEvent[] = [];
  const milestones: SessionEvent[] = [];
  const collect = (event: SessionEvent): void => {
    if (event.type === "tool_call") events.push(event);
    if (event.type === "milestone_applied") milestones.push(event);
  };
  async function send(text: string, options: SessionTurnOptions = {}, rejectAt?: (event: ToolEvent) => boolean) {
    resuming = options.goalAction === "resume";
    const controller = new AbortController();
    let boundary: { project: typeof context.project; draft: typeof context.project; milestones: number; writes: number } | undefined;
    const pending = session.sendUserMessage(source && !resuming ? raw : text, event => {
      collect(event);
      if (event.type === "tool_call" && rejectAt?.(event)) {
        boundary = { project: store.getCurrent(), draft: structuredClone(session.getProposedProject()), milestones: milestones.length,
          writes: events.filter(call => getTool(call.name)?.mode === "write").length };
        controller.abort();
      }
    }, controller.signal, options);
    const run = { controller, pending };
    ownedRuns.add(run);
    try {
      const result = await bounded(pending, controller);
      // Native layer-advisory tools emit events but are not model tool calls.
      // Every received model call, including rejected/deferred calls, gets exactly one response.
      expect(session.getHarnessSnapshot().messages.filter(message => message.role === "tool").map(message => message.tool_call_id)).toEqual(scriptedIds);
      if (rejectAt) {
        expect(boundary).toBeDefined();
        expect(result.runOutcome?.execution).toBe("cancelled");
        expect(store.getCurrent()).toBe(boundary?.project);
        expect(session.getProposedProject()).toEqual(boundary?.draft);
        expect(milestones).toHaveLength(boundary!.milestones);
        expect(events.filter(call => getTool(call.name)?.mode === "write")).toHaveLength(boundary!.writes);
      }
      return result;
    }
    finally { controller.abort(); await bounded(pending); ownedRuns.delete(run); }
  }
  return { session, events, collect, send, milestones, plannerCalls: () => plannerCalls, project: context.project };
}

describe("audit batch dependency and completion lifecycle", () => {
  it("defers same-map spec-free props after a rejected spec but allows another map", async () => {
    const startMapId = createBlankProject().startMapId;
    const props = (mapId: string) => call("place_props", {
      mapId, material: "침엽수", count: 1, area: { x: 2, y: 2, w: 4, h: 4 },
    });
    const h = harness([[
      call("set_build_spec", { mapId: startMapId, assets: [{ id: "invalid", kind: "terrain", x: 0, y: 0, w: 40, h: 15 }] }),
      props(startMapId), call("get_project_summary"), props("map_other"),
    ]]);
    await h.send("두 맵의 소품 배치 검증");
    expect(h.events[1]?.result).toMatchObject({
      ok: false, data: { code: "tool-deferred", executed: false, reason: "build-spec-dependency-failed" },
    });
    expect(h.events[2]?.result.ok).toBe(true);
    expect(h.events[3]?.result.ok).toBe(true);
    expect(h.session.getProposedProject().maps[startMapId]).toEqual(h.project.maps[startMapId]);
    expect(h.session.getProposedProject().maps.map_other).not.toEqual(h.project.maps.map_other);
  });

  it("defers premature completion, then accepts correction of the failed write in the same batch", async () => {
    const h = harness([[plan], [
      call("set_title_screen", { invalid: true }), complete,
      call("get_project_summary"), title, complete,
    ]], "title");
    const result = await h.send(titleRequest, { autonomous: true });
    const completions = h.events.filter((event) => event.name === "complete_work_item");
    expect(completions[0]?.result).toMatchObject({
      ok: false, data: { code: "tool-deferred", executed: false, reason: "work-dependency-failed" },
    });
    expect(completions[1]?.result.ok).toBe(true);
    expect(h.events.find((event) => event.name === "get_project_summary")?.result.ok).toBe(true);
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(result.appliedCalls?.map((entry) => entry.name)).toEqual(["set_title_screen"]);
    expect(result.runOutcome).toMatchObject({ execution: "response-final", goal: "satisfied" });
    expect(h.events).toHaveLength(7);
    expect(h.events.filter(event => event.name === "run_lint")).toHaveLength(1);
  });

  it("acknowledges an already completed plan without an item ID or another application", async () => {
    // Auto-completion and source closure end the title batch. Resume publicly to
    // deliver the original single acknowledgement, without adding another completion.
    const h = harness([[plan], [title], [complete]], "title");
    const first = await h.send(titleRequest, { autonomous: true });
    expect(first.runOutcome).toMatchObject({ execution: "response-final", goal: "satisfied" });
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    const result = await h.send("계속", { autonomous: true, goalAction: "resume" });
    const completions = h.events.filter(event => event.name === "complete_work_item");
    expect(completions).toHaveLength(1);
    expect(completions[0]?.result).toMatchObject({
      ok: true, data: { alreadyComplete: true },
    });
    expect(result.appliedCalls?.map((entry) => entry.name)).toEqual(["set_title_screen"]);
    expect(result.proposedCalls).toEqual([]);
    expect(h.events.map(event => event.name)).toEqual(["set_work_plan", "set_title_screen", "run_lint", "complete_work_item"]);
    expect(h.milestones).toHaveLength(1);
    expect(h.plannerCalls()).toBe(1);
    expect(h.session.getHarnessSnapshot().requests?.map(request => ({ id: request.requestId, raw: request.rawInstruction }))).toEqual([
      { id: "request-1", raw: titleRequest },
    ]);
    expect(result.runOutcome).toMatchObject({ execution: "response-final", goal: "satisfied" });
  });

  it("does not acknowledge a missing plan", async () => {
    const missing = harness([[complete]]);
    await missing.send("완료 요청 검증");
    expect(missing.events[0]?.result.ok).toBe(false);
  });

  it("does not acknowledge an explicitly unknown item", async () => {
    const unknown = harness([[plan], [title, call("complete_work_item", { itemId: "unknown" })]], "title");
    const result = await unknown.send(titleRequest, { autonomous: true }, event =>
      event.name === "complete_work_item" && event.args.itemId === "unknown" && !event.result.ok);
    expect(unknown.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
    expect(result.runOutcome?.execution).toBe("cancelled");
    expect(unknown.events.map(event => event.name)).toEqual(["set_work_plan", "set_title_screen", "complete_work_item", "run_lint"]);
  });

  it("does not acknowledge skipped work as already completed", async () => {
    const h = harness([[plan], [call("skip_work_item")], [complete]]);
    await h.send("제목 설정 검증");
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("skipped");
    expect(h.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
  });

  it("does not bypass open acceptance when every work item is done", async () => {
    const mapId = createBlankProject().startMapId;
    const promised = call("set_work_plan", {
      ...plan.args,
      acceptance: [{ id: "map-change", title: "Map change", criteria: [
        { kind: "targetChange", target: { mapId }, region: { x: 2, y: 2, w: 2, h: 2 } },
      ] }],
    });
    const h = harness([[promised], [title], [complete]], "title-and-map");
    const result = await h.send("제목과 지도 검증", { autonomous: true }, event =>
      event.name === "complete_work_item" && !event.result.ok);
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(h.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(h.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
    expect(result.runOutcome).toMatchObject({ execution: "cancelled", goal: "incomplete" });
    expect(h.session.getAcceptanceSnapshot()?.items.map(item => item.id)).toEqual([
      "request-1:source:0", "request-1:source:1", "map-change",
    ]);
  });

  it("does not acknowledge completion after a later explicit verification failure", async () => {
    const h = harness([[plan], [title, call("run_lint", { reachability: false }), complete]], "title");
    const result = await h.send(titleRequest, { autonomous: true }, event =>
      event.name === "complete_work_item" && !event.result.ok);
    expect(h.session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(h.events.find((event) => event.name === "run_lint" && event.args.reachability === false)?.result.ok).toBe(false);
    expect(h.events.find((event) => event.name === "complete_work_item")?.result.ok).toBe(false);
    expect(result.runOutcome?.execution).toBe("cancelled");
    expect(h.events.map(event => event.name)).toEqual(["set_work_plan", "set_title_screen", "run_lint", "complete_work_item", "run_lint"]);
  });
});
