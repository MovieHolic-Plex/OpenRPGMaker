import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type AiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import * as tools from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { fixedDeclarer } from "./intentFixture";
import { FLOOR_PAINT_ARGS, WALL_PAINT_ARGS, PRESERVED_PAINT_SPEC, preservedPaintContext } from "./fixtures/preservedPaint";
import { proposalCompletenessWarnings } from "@/ai/proposalCompleteness";
import { approvedReviewResponse, imageDeliveryForRequest } from "./independentReviewFixture";

const CONFIG = { ...defaultAiConfig(), agentMode: "chat", apiKey: "sk", maxToolCalls: 12, maxTokens: 8192 } satisfies AiConfig;
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
  return vi.fn(async (_config: AiConfig, request: ChatRequest): Promise<ChatResult> => {
    const review = approvedReviewResponse(request);
    if (review) return review;
    const step = steps[index++];
    if (!step) throw new Error("scripted chat exhausted");
    return { ...(typeof step === "function" ? step() : step), imageDelivery: imageDeliveryForRequest(request) };
  });
}

function paint(x: number, y: number, id: string): ChatResult {
  return toolCall("paint_tiles", { mapId: "m1", from: { x, y }, to: { x: x + 2, y: y + 2 }, mode: "rect", layer: "lower", tile: 281 }, id);
}

type ToolEvent = Extract<SessionEvent, { type: "tool_call" }>;

describe("completion accounting through real assistant sessions", () => {
  it.each([false, true])("auto-completes verified maintenance without waiving a new quantity (quantity=%s)", async (quantity) => {
    const ctx = preservedPaintContext();
    const instruction = quantity ? "타일 160개 추가해줘" : "바닥을 칠하고 기존 벽은 유지해줘";
    const plan = { goal: instruction, acceptance: [{ id: "floor", title: "floor", criteria: [
      { kind: "targetChange", target: { mapId: "map_basement" }, region: { x: 1, y: 1, w: 10, h: 8 } },
      { kind: "preserve", target: { mapId: "map_basement" }, region: { x: 0, y: 0, w: 12, h: 1 } },
    ] }], layers: [{ title: "terrain", items: [{ title: "terrain", instruction, successTools: ["paint_tiles"], mapTargets: ["map_basement"] }] }] };
    const entries = [
      { name: "set_work_plan", args: plan }, { name: "set_build_spec", args: PRESERVED_PAINT_SPEC },
      { name: "paint_tiles", args: FLOOR_PAINT_ARGS }, { name: "paint_tiles", args: WALL_PAINT_ARGS },
    ];
    const events: SessionEvent[] = [];
    const session = new AssistantSession(ctx.project, {
      config: { ...CONFIG, maxToolCalls: 1 }, declareIntent: fixedDeclarer({ mode: "modify" }),
      chat: scriptedChat([{ message: { role: "assistant", content: null, tool_calls: entries.map((entry, index) => ({
        id: `p7-${index}`, type: "function", function: { name: entry.name, arguments: JSON.stringify(entry.args) },
      })) }, finishReason: "tool_calls" }]),
    });
    const result = await session.sendUserMessage(instruction, event => events.push(event));
    expect(events.filter((event): event is ToolEvent => event.type === "tool_call").map(event => event.result.ok)).toEqual([true, true, true, true]);
    expect(result.proposedCalls.map(call => call.result.diff?.tilesChanged)).toEqual([80, 0]);
    expect(session.getCompletionSpecs(result.proposedCalls)).toEqual([PRESERVED_PAINT_SPEC]);
    expect(session.getWorkPlan()?.layers[0].items[0].status).toBe(quantity ? "in_progress" : "done");
    expect(result.stoppedReason).toBe("max-tool-calls");
    // Checklist progress is not canonical acceptance or delivery: these drafts are unapplied.
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(result.runOutcome?.goal).toBe("incomplete");
  });

  it.each(["preserve", "targetChange"] as const)("applies maintenance once but retains canonical %s semantics", async (kind) => {
    const { project } = preservedPaintContext();
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
    vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
    vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    store.replace(project);
    resetMapEditHistory();
    const plan = { goal: "바닥 칠하기와 벽 유지", acceptance: [{ id: "walls", title: "walls", criteria: [
      { kind, target: { mapId: "map_basement" }, region: { x: 0, y: 0, w: 12, h: 1 } },
    ] }], layers: [{ title: "terrain", items: [{ title: "terrain", instruction: "바닥을 칠하고 벽은 유지해줘", successTools: ["paint_tiles"], mapTargets: ["map_basement"] }] }] };
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, {
      config: { ...CONFIG, agentMode: "auto", liteModel: "executor-model" },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      renderImages: async () => [{ label: "Current basement", dataUrl: "data:image/png;base64,AA==" }],
      chat: scriptedChat([
        final(JSON.stringify({ action: "new_plan", ...plan })), toolCall("set_work_plan", plan, "plan"),
        toolCall("set_build_spec", PRESERVED_PAINT_SPEC, "spec"), toolCall("paint_tiles", FLOOR_PAINT_ARGS, "floor"),
        () => {
          expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("in_progress");
          expect(events.filter(event => event.type === "milestone_applied")).toEqual([]);
          return toolCall("paint_tiles", WALL_PAINT_ARGS, "walls");
        },
        toolCall("show_map_region", { mapId: "map_basement", x: 0, y: 0, w: 12, h: 10 }, "image"),
        ...Array.from({ length: kind === "preserve" ? 1 : 4 }, () => final()),
      ]),
    });
    const result = await session.sendUserMessage(plan.goal, event => events.push(event), undefined, { autonomous: true });
    expect(result.stoppedReason, result.error).toBe(kind === "preserve" ? "final" : "error");
    expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(events.filter(event => event.type === "milestone_applied").map(event => event.toolCount)).toEqual(kind === "preserve" ? [2] : []);
    expect(result.review?.status).toBe(kind === "preserve" ? "approved" : "changes_requested");
    const writes = [...(result.appliedCalls ?? []), ...result.proposedCalls];
    expect(result.proposedCalls).toHaveLength(kind === "preserve" ? 0 : 2);
    expect(result.appliedCalls ?? []).toHaveLength(kind === "preserve" ? 2 : 0);
    expect(writes.map(call => call.result.diff?.tilesChanged)).toEqual([80, 0]);
    expect(proposalCompletenessWarnings({ buildSpecs: session.getCompletionSpecs(writes),
      calls: writes, project: session.getProposedProject() })).toEqual([]);
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: kind === "preserve" ? "verified" : "blocked", items: [
      { id: "walls", evidence: [{ passed: kind === "preserve" }] },
    ] });
    expect(result.runOutcome?.goal).toBe(kind === "preserve" ? "satisfied" : "incomplete");
    expect(store.getCurrent().maps.map_basement.lowerTiles).toEqual(kind === "preserve"
      ? session.getProposedProject().maps.map_basement.lowerTiles : project.maps.map_basement.lowerTiles);
  });

  it("accounts for both spatial milestones and applies each write once, only after independent review", async () => {
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
      { title: "첫 구역", instruction: "첫 구역 칠하기", successTools: ["paint_tiles"], mapTargets: ["m1"] },
      { title: "둘째 구역", instruction: "둘째 구역 칠하기", successTools: ["paint_tiles"], mapTargets: ["m1"] },
    ] }] };
    const events: SessionEvent[] = [];
    const authored = structuredClone(store.getCurrent());
    const history = getMapEditHistoryEntries();
    const session = new AssistantSession(project, {
      config: { ...CONFIG, agentMode: "auto" },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      renderImages: async () => [{ label: "Accounting map", dataUrl: "data:image/png;base64,AA==" }],
      chat: scriptedChat([
        final(JSON.stringify({ action: "new_plan", ...plan })),
        toolCall("set_work_plan", plan, "plan"),
        toolCall("set_build_spec", SPEC, "spec"),
        paint(3, 3, "first"),
        () => {
          expect(session.getWorkPlan()?.layers[0].items.map((item) => item.status)).toEqual(["done", "in_progress"]);
          expect(store.getCurrent()).toEqual(authored);
          expect(getMapEditHistoryEntries()).toEqual(history);
          return paint(12, 12, "second");
        },
        toolCall("show_map_region", { mapId: "m1", x: 0, y: 0, w: 20, h: 20 }, "image"),
        final(),
      ]),
    });
    const result = await session.sendUserMessage(plan.goal, (event) => {
      events.push(event);
      if (event.type === "result_review") {
        expect(event.review.status).toBe("approved");
        expect(store.getCurrent()).toEqual(authored);
        expect(getMapEditHistoryEntries()).toEqual(history);
      }
    }, undefined, { autonomous: true });

    expect(session.getWorkPlan()?.layers[0].items.map((item) => item.status)).toEqual(["done", "done"]);
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: acceptance.map(({ id }) => ({ id, status: "verified", evidence: [{ passed: true }] })) });
    // Both criteria address one changed, unapplied map, so neither is verified early.
    expect(events.filter((event) => event.type === "acceptance").map((event) => event.snapshot)).toContainEqual(expect.objectContaining({
      status: "verifying", items: acceptance.map(({ id }) => expect.objectContaining({ id, status: "verifying", evidence: [expect.objectContaining({ passed: false })] })),
    }));
    expect(events.filter((event) => event.type === "result_review" || event.type === "milestone_applied").map((event) => event.type)).toEqual(["result_review", "milestone_applied"]);
    expect(events.filter((event) => event.type === "milestone_applied").map((event) => event.toolCount)).toEqual([2]);
    expect(result.proposedCalls).toEqual([]);
    expect(result.appliedCalls?.map((call) => call.args.from)).toEqual([{ x: 3, y: 3 }, { x: 12, y: 12 }]);
    const map = store.getCurrent().maps.m1;
    // Applying a map normalizes autotile variants; accounting must preserve both changed regions.
    for (const [x, y] of [[3, 3], [12, 12]]) {
      expect(map.lowerTiles[y * map.width + x]).not.toBe(project.maps.m1.lowerTiles[y * map.width + x]);
    }
    expect(map.lowerTiles).toEqual(session.getProposedProject().maps.m1.lowerTiles);
  });

  describe.each(["active", "implicit"] as const)("%s spec expansion", (scope) => {
    it.each(["invalid-args", "out-of-bounds", "throwing-tool"] as const)("does not retain a %s write; a successful retry expands and keeps the correct lifetime", async (failure) => {
      const project = projectWithMap();
      store.replace(project);
      resetMapEditHistory();
      const authored = structuredClone(store.getCurrent());
      const history = getMapEditHistoryEntries();
      const rect = failure === "out-of-bounds" ? { x: 12, y: 18, w: 3, h: 5 } : { x: 12, y: 12, w: 3, h: 3 };
      const retryRect = { ...rect, h: failure === "out-of-bounds" ? 1 : rect.h };
      if (failure === "throwing-tool") {
        // Throw inside the real runner: it must reject the draft and report failure to the session.
        const fillRegion = tools.getTool("fill_region");
        if (!fillRegion) throw new Error("fill_region must be registered");
        vi.spyOn(fillRegion, "run").mockImplementationOnce(() => { throw new Error("injected tool failure"); });
      }
      const criteria = [{ kind: "targetChange", target: { mapId: "m1" }, region: retryRect }];
      // Deliberately omit rendered evidence: approval-shaped reviewer JSON must
      // still fail closed. An unrelated next request drops this rejected draft,
      // while an explicit spec (unlike a selection) keeps its expanded lifetime.
      const pendingFinal = (status: "verifying" | "blocked") => () => {
        expect(session.getAcceptanceSnapshot()).toMatchObject({ status, items: [{
          id: "acceptance-contract", status, evidence: [{ expected: JSON.stringify(criteria[0]), passed: false }],
        }] });
        return final("DRAFT_AWAITING_APPLICATION");
      };
      const steps = [
        ...(scope === "active" ? [toolCall("set_build_spec", SPEC, "spec")] : []),
        toolCall("fill_region", { mapId: "m1", rect, material: "모래", shape: failure === "invalid-args" ? "invalid-shape" : "rect" }, "failed"),
        toolCall("fill_region", { mapId: "m1", rect: retryRect, material: "모래", shape: "rect" }, "retry"),
        toolCall("repair_acceptance", { itemId: "acceptance-contract", criteria }, "repair"),
        ...Array.from({ length: 2 }, () => pendingFinal("verifying")),
        toolCall("paint_tiles", { mapId: "m1", from: { x: rect.x, y: rect.y }, to: { x: rect.x, y: rect.y }, mode: "rect", layer: "lower", tile: 281 }, "next-turn"),
        // Arbitrary new prose cannot resume a stopped canonical requirement.
        ...Array.from({ length: scope === "active" ? 2 : 4 }, () => pendingFinal("blocked")),
      ];
      const chat = scriptedChat(steps);
      const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: fixedDeclarer({ mode: "modify" }) });
      const events: ToolEvent[] = [];
      let specAfterFailure: unknown;
      let mapAfterFailure: unknown;
      const result = await session.sendUserMessage("지형 칠해줘", (event) => {
        if (event.type !== "tool_call") return;
        events.push(event);
        if (!event.result.ok) {
          specAfterFailure = structuredClone(session.getActiveSpec());
          mapAfterFailure = session.getProposedProject().maps.m1;
        }
      }, undefined, scope === "implicit" ? { scope: { mapId: "m1", region: { x: 3, y: 3, width: 3, height: 3 } } } : {});

      const fills = events.filter((event) => event.name === "fill_region");
      expect(fills.map((event) => event.result.ok)).toEqual([false, true]);
      expect(mapAfterFailure).toEqual(project.maps.m1);
      expect(specAfterFailure).toEqual(scope === "active" ? SPEC : null);
      expect(fills[0].result.issues?.some((issue) => issue.code === "spec-gate-auto-expand")).toBe(false);
      expect(fills[1].result.issues ?? []).toContainEqual(expect.objectContaining({ code: "spec-gate-auto-expand" }));
      expect(result.stoppedReason).toBe("error");
      expect(result.review?.status).toBe("changes_requested");
      expect(session.isDraftReviewApproved()).toBe(false);
      expect(result.review?.findings).toContainEqual(expect.objectContaining({ id: "required-0", target: "required-evidence" }));
      expect(chat).toHaveBeenCalledTimes(scope === "active" ? 8 : 7);
      expect(events.find((event) => event.name === "repair_acceptance")?.result.ok).toBe(true);
      expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "acceptance-contract", status: "blocked", evidence: [{ passed: false }] }] });
      expect(result.appliedCalls ?? []).toEqual([]);
      expect(store.getCurrent()).toEqual(authored);
      expect(getMapEditHistoryEntries()).toEqual(history);
      expect(result.proposedCalls.map((call) => call.name)).toEqual(["fill_region"]);
      expect(session.getProposedProject().maps.m1.lowerTiles).not.toEqual(project.maps.m1.lowerTiles);
      if (scope === "active") {
        expect(session.getActiveSpec()?.assets).toEqual([SPEC.assets[0], expect.objectContaining(retryRect)]);
      } else {
        expect(session.getActiveSpec()).toBeNull();
      }

      const nextEvents: ToolEvent[] = [];
      const next = await session.sendUserMessage("다음 칸 칠해줘", (event) => { if (event.type === "tool_call") nextEvents.push(event); });
      expect(next.stoppedReason).toBe("error");
      expect(session.isDraftReviewApproved()).toBe(false);
      expect(chat).toHaveBeenCalledTimes(steps.length + (scope === "active" ? 4 : 2));
      expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "acceptance-contract", evidence: [{ passed: false }] }] });
      expect(next.appliedCalls ?? []).toEqual([]);
      expect(store.getCurrent()).toEqual(authored);
      expect(getMapEditHistoryEntries()).toEqual(history);
      const expected = { project: structuredClone(project) };
      if (scope === "active") expect(tools.runTool(expected, "paint_tiles", {
        mapId: "m1", from: { x: rect.x, y: rect.y }, to: { x: rect.x, y: rect.y }, mode: "rect", layer: "lower", tile: 281,
      }).ok).toBe(true);
      expect(session.getProposedProject().maps.m1).toEqual(expected.project.maps.m1);
      expect(next.proposedCalls.map((call) => call.name)).toEqual(scope === "active" ? ["paint_tiles"] : []);
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
    const session = new AssistantSession(project, { config: CONFIG, declareIntent: fixedDeclarer({ mode: "modify" }), chat: scriptedChat([
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
