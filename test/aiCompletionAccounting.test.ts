// 2026-09-17 조수 하네스 게이트 해체: 밑그림 스펙 게이트(자동 확장 spec-gate-auto-expand)·LLM 독립 검수(required-evidence
// finding)·예산 소진 = 초안 폐기 규칙을 검증하던 단언은 삭제했다. 승인 기준은 변경 맵의 run_lint error 0(결정적 검사) 하나이고,
// 예산 소진 시 검사를 통과한 초안은 final 로 적용된다. 수용(acceptance) 원장은 보고용으로 남지만 승인 조건이 아니다.
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

function scriptedChat(steps: (ChatResult | (() => ChatResult))[], fallback?: () => ChatResult) {
  let index = 0;
  return vi.fn(async (_config: AiConfig, request: ChatRequest): Promise<ChatResult> => {
    const review = approvedReviewResponse(request);
    if (review) return review;
    const step = steps[index++] ?? fallback;
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
    // 예산(maxToolCalls 1)이 바닥났지만 결정적 검사(lint error 0)를 통과했으니 초안은 폐기되지 않고 final 로 적용 대기한다.
    expect(result.stoppedReason).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(events.some(event => event.type === "assistant_message" && event.content.includes("예산이 소진되어 여기까지의 초안을 적용합니다"))).toBe(true);
    expect(session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.startsWith("예산 소진 초안 적용 — 결정적 검사 통과"))).toBe(true);
    expect(session.isDraftReviewApproved()).toBe(true);
    // Checklist progress is not canonical acceptance or delivery: these drafts are unapplied (the panel applies).
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(result.appliedCalls ?? []).toEqual([]);
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
        final(),
        // targetChange 는 적용 뒤에도 수용 목표가 미충족이라 자율 드라이버가 「계속」을 보낸다 — 쓰기 없는 최종 응답만 계속 준다.
      ], final),
    });
    const result = await session.sendUserMessage(plan.goal, event => events.push(event), undefined, { autonomous: true });
    // 수용 원장은 승인 조건이 아니다: 벽 유지 쓰기가 0칸을 바꿔 targetChange 가 미충족이어도 lint error 0 이면 승인·적용된다.
    expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(events.filter(event => event.type === "milestone_applied").map(event => event.toolCount)).toEqual([2]);
    expect(result.review).toMatchObject({ status: "approved", findings: [], summary: "결정적 검사 통과 — 변경 맵 1개, lint error 0건." });
    const writes = [...(result.appliedCalls ?? []), ...result.proposedCalls];
    expect(result.proposedCalls).toHaveLength(0);
    expect(result.appliedCalls ?? []).toHaveLength(2);
    expect(writes.map(call => call.result.diff?.tilesChanged)).toEqual([80, 0]);
    expect(proposalCompletenessWarnings({ buildSpecs: session.getCompletionSpecs(writes),
      calls: writes, project: session.getProposedProject() })).toEqual([]);
    expect(store.getCurrent().maps.map_basement.lowerTiles).toEqual(session.getProposedProject().maps.map_basement.lowerTiles);
    // 원장의 의미는 그대로다 — preserve 는 0칸 변경으로 충족, targetChange 는 0칸 변경으로 미충족. 미충족 목표는 승인을 막지
    // 않지만 자율 런의 완료는 막는다: 적용된 채로 「완료 검증이 아직 미완성입니다」 로 끝난다.
    if (kind === "preserve") {
      expect(result.stoppedReason, result.error).toBe("final");
      expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ id: "walls", evidence: [{ passed: true }] }] });
      expect(result.runOutcome).toMatchObject({ goal: "satisfied", delivery: "applied" });
    } else {
      expect(result.stoppedReason).toBe("error");
      expect(result.error).toContain("완료 검증이 아직 미완성입니다");
      expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "walls", evidence: [{ passed: false }] }] });
      expect(result.runOutcome).toMatchObject({ goal: "incomplete", delivery: "applied" });
    }
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
    // 2026-09-17: 자동 확장(spec-gate-auto-expand)·필수 증거(required-evidence) 검수 거부·거부 초안의 다음 턴 폐기 단언은
    // 해체된 게이트를 재던 것이라 삭제. 남긴 것: 실패한 쓰기는 초안에 남지 않고, 재시도는 밑그림과 무관하게 그대로 들어간다.
    it.each(["invalid-args", "out-of-bounds", "throwing-tool"] as const)("does not retain a %s write; a successful retry lands without a spec gate", async (failure) => {
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
      const steps = [
        ...(scope === "active" ? [toolCall("set_build_spec", SPEC, "spec")] : []),
        toolCall("fill_region", { mapId: "m1", rect, material: "모래", shape: failure === "invalid-args" ? "invalid-shape" : "rect" }, "failed"),
        toolCall("fill_region", { mapId: "m1", rect: retryRect, material: "모래", shape: "rect" }, "retry"),
        final("DRAFT_AWAITING_APPLICATION"),
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
      // 밑그림 밖 쓰기라도 게이트가 없다 — 차단도 자동 확장도 일어나지 않는다.
      expect(fills.flatMap((event) => event.result.issues ?? []).some((issue) => issue.code === "spec-gate" || issue.code === "spec-gate-auto-expand")).toBe(false);
      expect(result.stoppedReason, result.error).toBe("final");
      expect(result.review).toMatchObject({ status: "approved", findings: [] });
      expect(session.isDraftReviewApproved()).toBe(true);
      expect(chat).toHaveBeenCalledTimes(steps.length);
      // Chat mode: the approved draft waits for the panel; nothing is applied by the session.
      expect(result.appliedCalls ?? []).toEqual([]);
      expect(store.getCurrent()).toEqual(authored);
      expect(getMapEditHistoryEntries()).toEqual(history);
      expect(result.proposedCalls.map((call) => call.name)).toEqual(["fill_region"]);
      expect(session.getProposedProject().maps.m1.lowerTiles).not.toEqual(project.maps.m1.lowerTiles);
      expect(session.getActiveSpec()).toEqual(scope === "active" ? SPEC : null);
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
