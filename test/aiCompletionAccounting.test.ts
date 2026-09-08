import { clearTimeout, setTimeout } from "node:timers";
import { setImmediate } from "node:timers/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { ChatResult } from "@/ai/llmClient";
import * as tools from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";

const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 };
const SPEC = { mapId: "m1", assets: [{ id: "terrain", kind: "terrain", x: 3, y: 3, w: 3, h: 3 }] };

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function projectWithMap() {
  const ctx = { project: createBlankProject() };
  expect(tools.runTool(ctx, "create_map", { id: "m1", name: "Accounting", width: 20, height: 20 }).ok).toBe(true);
  return ctx.project;
}

function toolCall(name: string, args: unknown, id: string): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  };
}

function final(text = "완료했습니다."): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" };
}

function scriptedChat(steps: (ChatResult | (() => ChatResult))[]) {
  let index = 0;
  return vi.fn(async (): Promise<ChatResult> => {
    const step = steps[index++];
    if (!step) throw new Error("scripted chat exhausted");
    return typeof step === "function" ? step() : step;
  });
}

function paint(x: number, y: number, id: string): ChatResult {
  return toolCall("paint_tiles", { mapId: "m1", from: { x, y }, to: { x: x + 2, y: y + 2 }, mode: "rect", layer: "lower", tile: 281 }, id);
}

type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;

async function bounded<T>(pending: Promise<T>, controller: AbortController): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => { controller.abort(); reject(new Error("Milestone fixture deadline")); }, 10_000);
    })]);
  } finally { clearTimeout(deadline); }
}

describe("completion accounting through real assistant sessions", () => {
  it("auto-completes a later spatial milestone using applied plus pending writes without reapplying the first", async () => {
    const project = projectWithMap();
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    resetMapEditHistory();
    const acceptance = [[3, 3], [12, 12]].map(([x, y], index) => ({
      id: `region-${index}`, title: `Paint region ${index}`,
      criteria: [{ kind: "targetChange", target: { mapId: "m1" }, region: { x, y, w: 3, h: 3 } }],
    }));
    const plan = { goal: "지형 두 구역 칠하기", acceptance, layers: [{ title: "지형", items: [
      { title: "첫 구역", instruction: "첫 구역 칠하기", successTools: ["paint_tiles"] },
      { title: "둘째 구역", instruction: "둘째 구역 칠하기", successTools: ["paint_tiles"] },
    ] }] };
    const events: SessionEvent[] = [];
    const chat = scriptedChat([
      final(JSON.stringify({ action: "new_plan", ...plan })),
      toolCall("set_work_plan", plan, "plan"),
      toolCall("set_build_spec", SPEC, "spec"),
      paint(3, 3, "first"),
      paint(12, 12, "second"),
    ]);
    const session = new AssistantSession(project, {
      config: { ...CONFIG, agentMode: "auto", liteModel: "executor-model" },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true, requestRequirements: { entries: [{
        source: [{ start: 0, end: plan.goal.length, quote: plan.goal }],
        criteria: acceptance.flatMap(item => item.criteria), bindings: [],
      }] } }),
      yieldToUi: () => setImmediate(),
      chat,
    });
    const controller = new AbortController();
    const pending = session.sendUserMessage(plan.goal, event => events.push(event), controller.signal, { autonomous: true });
    let result;
    try { result = await bounded(pending, controller); }
    finally { controller.abort(); await bounded(pending, controller); }

    expect(session.getWorkPlan()?.layers[0].items.map((item) => item.status)).toEqual(["done", "done"]);
    expect(result.stoppedReason, JSON.stringify({ error: result.error, acceptance: session.getAcceptanceSnapshot() })).toBe("final");
    expect(chat).toHaveBeenCalledTimes(5);
    const snapshot = session.getAcceptanceSnapshot();
    expect(snapshot?.status).toBe("verified");
    expect(snapshot?.items.map(item => item.id)).toEqual(["request-1:source:0", "region-0", "region-1"]);
    expect(snapshot?.items.filter(item => acceptance.some(({ id }) => id === item.id))).toMatchObject(acceptance.map(({ id }) => ({ id, status: "verified", evidence: [{ passed: true }] })));
    expect(session.getHarnessSnapshot().requests).toMatchObject([{ rawInstruction: plan.goal, units: [{
      id: "request-1:source:0", coverage: "declared", source: { start: 0, end: plan.goal.length, quote: plan.goal },
      criteria: acceptance.flatMap(item => item.criteria),
    }] }]);
    expect(events.filter((event) => event.type === "acceptance").some((event) => event.snapshot?.items.find(item => item.id === "region-0")?.status === "verified" && event.snapshot.items.find(item => item.id === "region-1")?.status === "working")).toBe(true);
    expect(events.filter((event) => event.type === "milestone_applied").map((event) => event.toolCount)).toEqual([1, 1]);
    expect(result.proposedCalls).toEqual([]);
    expect(result.appliedCalls?.map((call) => call.args.from)).toEqual([{ x: 3, y: 3 }, { x: 12, y: 12 }]);
    const map = store.getCurrent().maps.m1;
    // Applying a map normalizes autotile variants; accounting must preserve both changed regions.
    for (const [x, y] of [[3, 3], [12, 12]]) {
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
        const index = (y + dy) * map.width + x + dx;
        expect(map.lowerTiles[index]).not.toBe(project.maps.m1.lowerTiles[index]);
      }
    }
    expect(map.lowerTiles).toEqual(session.getProposedProject().maps.m1.lowerTiles);
  });

  describe.each(["active", "implicit"] as const)("%s spec expansion", (scope) => {
    it.each(["invalid-args", "out-of-bounds", "throwing-tool"] as const)("does not retain a %s write; a successful retry expands and keeps the correct lifetime", async (failure) => {
      const project = projectWithMap();
      const rect = failure === "out-of-bounds" ? { x: 12, y: 18, w: 3, h: 5 } : { x: 12, y: 12, w: 3, h: 3 };
      const retryRect = { ...rect, h: failure === "out-of-bounds" ? 1 : rect.h };
      if (failure === "throwing-tool") {
        // Throw inside the real runner: it must reject the draft and report failure to the session.
        const fillRegion = tools.getTool("fill_region");
        if (!fillRegion) throw new Error("fill_region must be registered");
        vi.spyOn(fillRegion, "run").mockImplementationOnce(() => { throw new Error("injected tool failure"); });
      }
      const criteria = [{ kind: "targetChange", target: { mapId: "m1" }, region: retryRect }];
      const raw = "지형 칠해줘";
      const planCall = toolCall("set_work_plan", { goal: raw,
        acceptance: [{ id: "acceptance-contract", title: "Paint the retry region", criteria: null }],
        layers: [{ title: "Terrain", items: [{ title: "Fill", instruction: raw, successTools: ["fill_region"] }] }],
      }, "plan");
      // These turns intentionally retain drafts. Supply the real spatial contract,
      // then answer the initial final request and all three bounded repair nudges.
      // No model response can turn an unapplied draft into verified acceptance.
      const pendingFinal = (status: "verifying" | "blocked", itemStatus = status) => () => {
        expect(session.getAcceptanceSnapshot()?.status).toBe(status);
        expect(session.getAcceptanceSnapshot()?.items.filter(item => item.id === "acceptance-contract")).toMatchObject([{
          id: "acceptance-contract", status: itemStatus, evidence: [{ expected: JSON.stringify(criteria[0]), passed: false }],
        }]);
        return final("DRAFT_AWAITING_APPLICATION");
      };
      const steps = [
        ...(scope === "active" ? [toolCall("set_build_spec", SPEC, "spec")] : []),
        toolCall("fill_region", { mapId: "m1", rect, material: "모래", shape: failure === "invalid-args" ? "invalid-shape" : "rect" }, "failed"),
        toolCall("fill_region", { mapId: "m1", rect: retryRect, material: "모래", shape: "rect" }, "retry"),
        toolCall("repair_acceptance", { itemId: "acceptance-contract", criteria }, "repair"),
        ...Array.from({ length: 4 }, () => pendingFinal("verifying")),
        toolCall("paint_tiles", { mapId: "m1", from: { x: rect.x, y: rect.y }, to: { x: rect.x, y: rect.y }, mode: "rect", layer: "lower", tile: 240 }, "next-turn"),
        // The real resume starts a fresh detached repair cycle, without discarding the first draft.
        ...Array.from({ length: 4 }, () => pendingFinal("blocked", "verifying")),
      ];
      // Register an actual ordinary missing-criteria promise, without adding a working round.
      const first = steps[0];
      if (typeof first === "function") throw new Error("First working response must be a tool batch");
      first.message.tool_calls!.unshift(...planCall.message.tool_calls!);
      const chat = scriptedChat(steps);
      let nextEntry = false;
      const planner = vi.fn(async () => final(JSON.stringify({ action: "resume" })));
      const session = new AssistantSession(project, { config: CONFIG,
        declareIntent: fixedDeclarer({ mode: "modify", requestRequirements: { entries: [{
          source: [{ start: 0, end: raw.length, quote: raw }], criteria, bindings: [],
        }] } }),
        chat: async (_config, request) => {
          if (nextEntry && !request.tools?.length) {
            expect(planner).not.toHaveBeenCalled();
            expect(JSON.stringify(request.messages)).toContain("다음 칸 칠해줘");
            return planner();
          }
          return chat();
        },
      });
      const events: ToolEvent[] = [];
      let specAfterFailure: unknown;
      let mapAfterFailure: unknown;
      let failedFills = 0;
      const result = await session.sendUserMessage(raw, (event) => {
        if (event.type !== "tool_call") return;
        events.push(event);
        if (event.name === "fill_region" && JSON.stringify(event.args.rect) === JSON.stringify(rect) && !event.result.ok) {
          failedFills++;
          specAfterFailure = structuredClone(session.getActiveSpec());
          mapAfterFailure = structuredClone(session.getProposedProject().maps.m1);
        }
      }, undefined, scope === "implicit" ? { scope: { mapId: "m1", region: { x: 3, y: 3, width: 3, height: 3 } } } : {});

      const fills = events.filter((event) => event.name === "fill_region");
      expect(fills.map((event) => event.result.ok)).toEqual([false, true]);
      expect(failedFills).toBe(1);
      expect(mapAfterFailure).toEqual(project.maps.m1);
      expect(specAfterFailure).toEqual(scope === "active" ? SPEC : null);
      expect(fills[0].result.issues?.some((issue) => issue.code === "spec-gate-auto-expand")).toBe(false);
      expect(fills[1].result.issues ?? []).toContainEqual(expect.objectContaining({ code: "spec-gate-auto-expand" }));
      expect(result.stoppedReason).toBe("final");
      expect(chat).toHaveBeenCalledTimes(scope === "active" ? 8 : 7);
      expect(events.find((event) => event.name === "repair_acceptance")?.result.ok).toBe(true);
      expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
      expect(session.getAcceptanceSnapshot()?.items.map(item => item.id)).toEqual(["request-1:source:0", "acceptance-contract"]);
      expect(session.getAcceptanceSnapshot()?.items.find(item => item.id === "acceptance-contract")).toMatchObject({ status: "blocked", evidence: [{ passed: false }] });
      expect(session.getHarnessSnapshot().requests).toMatchObject([{ rawInstruction: raw, units: [{ coverage: "declared", criteria }] }]);
      expect(result.appliedCalls ?? []).toEqual([]);
      expect(result.proposedCalls.map((call) => call.name)).toEqual(["fill_region"]);
      expect(session.getProposedProject().maps.m1.lowerTiles).not.toEqual(project.maps.m1.lowerTiles);
      if (scope === "active") {
        expect(session.getActiveSpec()?.assets).toEqual([SPEC.assets[0], expect.objectContaining(retryRect)]);
      } else {
        expect(session.getActiveSpec()).toBeNull();
      }

      const nextEvents: ToolEvent[] = [];
      nextEntry = true;
      const next = await session.sendUserMessage("다음 칸 칠해줘", (event) => { if (event.type === "tool_call") nextEvents.push(event); });
      expect(next.stoppedReason, JSON.stringify({ error: next.error, plannerCalls: planner.mock.calls.length,
        workingCalls: chat.mock.calls.length, events: nextEvents, acceptance: session.getAcceptanceSnapshot() })).toBe("final");
      expect(chat).toHaveBeenCalledTimes(steps.length);
      expect(planner).toHaveBeenCalledTimes(1);
      expect(session.getAcceptanceSnapshot()?.status).toBe("blocked");
      expect(session.getAcceptanceSnapshot()?.items.map(item => item.id)).toEqual(["request-1:source:0", "acceptance-contract", "request-2:source:0"]);
      expect(session.getAcceptanceSnapshot()?.items.find(item => item.id === "acceptance-contract")).toMatchObject({ evidence: [{ passed: false }] });
      expect(next.appliedCalls ?? []).toEqual([]);
      expect(next.proposedCalls.map((call) => call.name)).toEqual(scope === "active" ? ["fill_region", "paint_tiles"] : ["fill_region"]);
      const nextBatch = next.proposedCalls.filter(call => nextEvents.some(event => event.args === call.args));
      expect(nextBatch.map(call => call.name)).toEqual(scope === "active" ? ["paint_tiles"] : []);
      expect(nextEvents.map((event) => event.result.ok)).toEqual([scope === "active"]);
      expect(nextEvents[0].result.issues?.some((issue) => issue.code === "spec-gate-auto-expand") ?? false).toBe(false);
      if (scope === "implicit") expect(nextEvents[0].result.issues).toContainEqual(expect.objectContaining({ code: "spec-gate" }));
    });
  });

  it("does not commit expansion when the runner itself throws, and preserves the failed tool response", async () => {
    const project = projectWithMap();
    const run = tools.runTool;
    const failure = new Error("injected runner failure");
    vi.spyOn(tools, "runTool").mockImplementation((ctx, name, args, options) => {
      if (name === "fill_region") throw failure;
      return run(ctx, name, args, options);
    });
    const session = new AssistantSession(project, { config: CONFIG, chat: scriptedChat([
      toolCall("set_build_spec", SPEC, "spec"),
      toolCall("fill_region", { mapId: "m1", rect: { x: 12, y: 12, w: 3, h: 3 }, material: "모래", shape: "rect" }, "throw"),
    ]) });

    const result = await session.sendUserMessage("지형 칠해줘", () => {});
    expect(result).toMatchObject({ stoppedReason: "error", error: failure.message,
      runOutcome: { execution: "failed", goal: "incomplete", delivery: "no-change" } });
    expect(session.getActiveSpec()).toEqual(SPEC);
    expect(session.getProposedProject().maps.m1).toEqual(project.maps.m1);
    const response = session.getMessages().find((message) => message.role === "tool" && message.tool_call_id === "throw");
    expect(JSON.parse(String(response?.content))).toMatchObject({ ok: false, issues: [{ code: "tool-loop-exception" }] });
  });
});
