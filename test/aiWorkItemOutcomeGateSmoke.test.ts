// test/aiWorkItemOutcomeGateSmoke.test.ts
//
// 2026-08-28 회귀 재현(project oprn-4f65d09fb1, 요청 "음 다른맵을 더 만들자").
// 플래너 항목은
//   instruction "create_map 후 지형 및 길 타일 페인팅"
//   doneWhen    "맵이 생성되고 기본 지형이 칠해짐"
//   successTools ["create_map"]
// 였고, advanceWorkPlanFromTools 가 doneWhen 을 읽지 않으므로 create_map 성공 3초 만에
// 항목이 done 으로 넘어갔다. 남은 결과물은 잔디 단색 맵(고유 타일 1종·이벤트 0)이었다.
//
// 여기서는 실제 세션 루프 + 실제 툴 실행기 + 가짜 LLM(scriptedChat)으로 그 순서를 그대로
// 재생해, 산출물 게이트가 자동 완료를 막는지 / 채우면 통과하는지를 증명한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { clearTimeout, setTimeout } from "node:timers";
import { setImmediate } from "node:timers/promises";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type { SessionEvent, TurnResult } from "@/ai/assistantSession";
import { parseToolVerdict } from "@/ai/agentVerification";
import { runTool } from "@/editor/tools";
import { fixedDeclarer } from "./intentFixture";

function installHermeticEnv(project: Project): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

type ChatResult = import("@/ai/llmClient").ChatResult;

async function bounded<T>(pending: Promise<T>, controller: AbortController): Promise<T> {
  let deadline: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([pending, new Promise<never>((_, reject) => {
      deadline = setTimeout(() => { controller.abort(); reject(new Error("Outcome gate fixture deadline")); }, 20_000);
    })]);
  } finally { clearTimeout(deadline); }
}

async function load() {
  const [assistantSession, defaults] = await Promise.all([
    import("@/ai/assistantSession"),
    import("@/project/defaults"),
  ]);
  return { AssistantSession: assistantSession.AssistantSession, createBlankProject: defaults.createBlankProject };
}

function toolCallResult(name: string, args: unknown, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function finalResult(text: string): ChatResult {
  return { message: { role: "assistant" as const, content: text }, finishReason: "stop" } as ChatResult;
}

function exhausted(): never {
  throw new (class extends Error {
    readonly status = 401;
    constructor() {
      super("scripted chat exhausted");
      this.name = "LlmError";
    }
  })();
}

const CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "auto" as const,
  baseUrl: "x",
  model: "supervisor-model",
  liteModel: "executor-model",
  apiKey: "sk",
  maxToolCalls: 8,
  maxTokens: 512,
};

const FIELD_MAP_ID = "map_field_forest";
const LAKE_REGION = { mapId: FIELD_MAP_ID, x: 4, y: 4, w: 10, h: 10 };
// Independent cell-center circle oracle: radius 5 in the original 10x10 rectangle.
const LAKE_GRID = ["...~~~~...", ".~~~~~~~~.", ".~~~~~~~~.", "~~~~~~~~~~", "~~~~~~~~~~",
  "~~~~~~~~~~", "~~~~~~~~~~", ".~~~~~~~~.", ".~~~~~~~~.", "...~~~~..."];

/** 실제로 관측된 계획 모양 — doneWhen 은 페인팅까지 요구하는데 successTools 는 create_map 하나. */
const PAINT_PLAN = {
  goal: "탐험 가능한 신규 야외 필드 맵 생성",
  layers: [
    {
      title: "신규 맵 생성 및 기본 지형 구성",
      items: [
        {
          title: "야외 필드(숲길/외곽) 맵 생성",
          instruction: "create_map으로 30x30 크기의 야외 필드 맵 생성 후 지형 및 길 타일 페인팅",
          doneWhen: "새로운 야외 필드 맵이 생성되고 기본 지형이 칠해짐",
          successTools: ["create_map"],
        },
      ],
    },
  ],
};

const createMapCall = (id: string) =>
  toolCallResult("create_map", { id: FIELD_MAP_ID, name: "초록바람 숲길", width: 30, height: 30 }, id);

const statusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
  session.getAuditEntries().filter((entry) => entry.kind === "status").map((entry) => String(entry.text));

function scriptedChat(steps: readonly ChatResult[]): () => Promise<ChatResult> {
  let index = 0;
  return async () => (index < steps.length ? steps[index++]! : exhausted());
}

describe("산출물 게이트 통합 스모크 — 만들고 안 채운 맵", () => {
  it("create_map 만 성공하면 successTools 를 채워도 항목이 완료되지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "new_plan", ...PAINT_PLAN })),
        toolCallResult("set_work_plan", PAINT_PLAN, "c_plan"),
        createMapCall("c_map"),
        finalResult("야외 필드 맵을 생성했습니다."),
      ]),
    });

    await session.sendUserMessage("음 다른맵을 더 만들자", () => {}, undefined, { autonomous: true });

    const audits = statusTexts(session);
    expect(audits.some((text) => text.includes("자동 완료 차단"))).toBe(true);
    expect(audits.some((text) => text.includes("WorkPlan 자동 완료:"))).toBe(false);

    // 실제로 잔디 단색 맵이 남았는지 — 게이트가 막아야 하는 그 상태다.
    const created = session.getProposedProject().maps[FIELD_MAP_ID];
    expect(created).toBeDefined();
    expect(new Set(created!.lowerTiles).size).toBe(1);
    expect(created!.events.length).toBe(0);
  }, 30000);

  it("같은 항목에서 지형을 칠하면 자동 완료된다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "new_plan", ...PAINT_PLAN })),
        toolCallResult("set_work_plan", PAINT_PLAN, "c_plan"),
        createMapCall("c_map"),
        // fill_region 은 공간 빌드 스펙 게이트 대상이라 밑그림을 먼저 낸다(실제 모델도 같은 순서).
        toolCallResult(
          "set_build_spec",
          {
            mapId: FIELD_MAP_ID,
            title: "숲길 호수",
            assets: [{ id: "lake", kind: "terrain", x: 4, y: 4, w: 10, h: 10 }],
          },
          "c_spec",
        ),
        toolCallResult(
          "fill_region",
          { mapId: FIELD_MAP_ID, rect: { x: 4, y: 4, w: 10, h: 10 }, material: "물", shape: "circle" },
          "c_fill",
        ),
        finalResult("야외 필드 맵을 만들고 호수를 칠했습니다."),
      ]),
    });

    await session.sendUserMessage("음 다른맵을 더 만들자", () => {}, undefined, { autonomous: true });

    const created = session.getProposedProject().maps[FIELD_MAP_ID];
    expect(created).toBeDefined();
    expect(new Set(created!.lowerTiles).size).toBeGreaterThan(1);
    expect(statusTexts(session).some((text) => text.includes("WorkPlan 자동 완료:"))).toBe(true);
  }, 30000);

  it("완성도 경고만 남았을 때 명시 complete_work_item 은 통과한다(교착 없음)", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const events: SessionEvent[] = [];
    const raw = "새 야외 필드 맵을 만들고 호수를 칠해줘";
    const build = toolCallResult("set_build_spec", {
      mapId: FIELD_MAP_ID, title: "숲길 호수", assets: [
        { id: "lake", kind: "terrain", x: 4, y: 4, w: 10, h: 10 },
        { id: "grove", kind: "decor", x: 16, y: 2, w: 4, h: 4 },
      ],
    }, "c_spec");
    build.message.tool_calls!.push(...toolCallResult("fill_region",
      { mapId: FIELD_MAP_ID, rect: { x: 4, y: 4, w: 10, h: 10 }, material: "물", shape: "circle" }, "c_fill").message.tool_calls!,
    ...toolCallResult("get_map_region", LAKE_REGION, "c_region").message.tool_calls!);
    const script = [finalResult(JSON.stringify({ action: "new_plan", ...PAINT_PLAN })),
      toolCallResult("set_work_plan", PAINT_PLAN, "c_plan"), createMapCall("c_map"), build,
      toolCallResult("evaluate_game_quality", {}, "c_quality"),
      finalResult(JSON.stringify({ action: "resume" })),
      toolCallResult("complete_work_item", { note: "숲은 다음 항목에서 정리" }, "c_done")];
    const requests: import("@/ai/llmClient").ChatRequest[] = [];
    let createdBaseline: Project["maps"][string] | undefined;
    let beforeResume: TurnResult | undefined;
    const session = new AssistantSession(project, {
      config: CONFIG,
      yieldToUi: () => setImmediate(),
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: true, requestRequirements: { entries: [{
        source: [{ start: 0, end: raw.length, quote: raw }], bindings: [], criteria: [
          { kind: "mapDimensions", target: { mapId: FIELD_MAP_ID }, width: 30, height: 30 },
          { kind: "toolVerdict", tool: "evaluate_game_quality", args: {} },
        ],
      }] } }),
      chat: async (_config, request) => {
        requests.push(request);
        const next = script.shift();
        if (!next) exhausted();
        if (next.message.tool_calls?.[0]?.id === "c_quality") {
          // A generic authored-map verdict is not the lake oracle. Require the delivered
          // native material/shape read, and check every painted cell before requesting QA.
          const region = request.messages.find(message => message.role === "tool" && message.tool_call_id === "c_region");
          expect(JSON.parse(String(region?.content))).toMatchObject({ ok: true, data: {
            mapId: FIELD_MAP_ID, grid: LAKE_GRID, water: { cellCount: 80, bounds: { x: 4, y: 4, w: 10, h: 10 } },
          } });
          expect(session.getAcceptanceSnapshot()?.items[0]?.evidence.map(evidence => evidence.passed)).toEqual([true, false]);
        }
        return next;
      },
    });

    const controller = new AbortController();
    const collect = (event: SessionEvent) => {
      events.push(event);
      if (event.type === "tool_call" && event.name === "create_map" && event.result.ok) {
        createdBaseline = structuredClone(session.getProposedProject().maps[FIELD_MAP_ID]);
      }
    };
    const pending = session.sendUserMessage(raw, collect, controller.signal, { autonomous: true });
    let result;
    try {
      beforeResume = await bounded(pending, controller);
      expect(beforeResume.stoppedReason, beforeResume.error).toBe("final");
      expect(beforeResume.runOutcome).toMatchObject({ goal: "satisfied", delivery: "applied" });
      // Verify native semantic water again on the accepted store, not only the detached tool result.
      expect(runTool({ project: store.getCurrent() }, "get_map_region", LAKE_REGION)).toMatchObject({ ok: true, data: {
        mapId: FIELD_MAP_ID, grid: LAKE_GRID, water: { cellCount: 80, bounds: { x: 4, y: 4, w: 10, h: 10 } },
      } });
      expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("in_progress");
      expect(events.filter(event => event.type === "tool_call" && event.name === "complete_work_item")).toEqual([]);
      const source = structuredClone(session.getHarnessSnapshot().requests);
      const planId = session.getWorkPlan()?.id;
      const stored = store.getCurrent();
      const milestones = events.filter(event => event.type === "milestone_applied");
      const resume = session.sendUserMessage("계속", collect, controller.signal, { goalAction: "resume", autonomous: true });
      try { result = await bounded(resume, controller); }
      finally { controller.abort(); await bounded(resume, controller); }
      expect(session.getHarnessSnapshot().requests).toEqual(source);
      expect(session.getWorkPlan()?.id).toBe(planId);
      expect(store.getCurrent()).toBe(stored);
      expect(events.filter(event => event.type === "milestone_applied")).toEqual(milestones);
    } finally { controller.abort(); await bounded(pending, controller); }

    const audits = statusTexts(session);
    // 자동 완료는 완성도 경고로 막히고,
    expect(audits.some((text) => text.includes("자동 완료 차단") && text.includes("완성도 경고")), JSON.stringify({
      result: { stoppedReason: result.stoppedReason, error: result.error },
      completed: events.find(event => event.type === "tool_call" && event.name === "complete_work_item"),
      toolOrder: events.filter(event => event.type === "tool_call").map(event => event.name),
      requests: session.getHarnessSnapshot().requests, acceptance: session.getAcceptanceSnapshot(),
      milestones: events.filter(event => event.type === "milestone_applied"),
      statuses: audits.filter(text => text.includes("완료") || text.startsWith("run_state ")),
    })).toBe(true);
    // 모델이 명시 완료를 부르면 산출물 게이트만 보므로 진행된다.
    const completed = events.find(event => event.type === "tool_call" && event.name === "complete_work_item");
    expect(completed, JSON.stringify({ result: { stoppedReason: result.stoppedReason, error: result.error },
      tools: events.filter(event => event.type === "tool_call").map(event => ({ name: event.name, args: event.args, result: event.result })),
      requests: session.getHarnessSnapshot().requests, acceptance: session.getAcceptanceSnapshot(), plan: session.getWorkPlan(),
    })).toMatchObject({ result: { ok: true, data: { completed: "L1-1" } } });
    expect(result.stoppedReason, JSON.stringify({ error: result.error, acceptance: session.getAcceptanceSnapshot(),
      requests: session.getHarnessSnapshot().requests, tools: events.filter(event => event.type === "tool_call").map(event => ({ name: event.name, args: event.args, ok: event.result.ok })),
    })).toBe("final");
    expect(session.getWorkPlan()?.layers[0].items[0].status).toBe("done");
    expect(result.proposedCalls).toEqual([]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["create_map", "fill_region"]);
    expect(beforeResume?.appliedCalls?.map(call => call.name)).toEqual(["create_map", "fill_region"]);
    expect(events.filter(event => event.type === "milestone_applied").map(event => event.toolCount)).toEqual([1, 1]);
    expect(events.filter(event => event.type === "tool_call").map(event => event.name)).toEqual([
      "set_work_plan", "create_map", "set_build_spec", "fill_region", "get_map_region", "evaluate_game_quality", "run_lint", "complete_work_item",
    ]);
    for (const id of ["c_plan", "c_map", "c_spec", "c_fill", "c_region", "c_quality", "c_done"]) {
      expect(session.getMessages().filter(message => message.role === "tool" && message.tool_call_id === id)).toHaveLength(1);
    }
    expect(requests).toHaveLength(7);
    expect(requests.filter(request => !request.tools?.length)).toHaveLength(2);
    expect(script).toEqual([]);
    const map = store.getCurrent().maps[FIELD_MAP_ID];
    const baseline = createdBaseline;
    if (!baseline) throw new Error("Original native create_map result missing");
    const changed = map.lowerTiles.flatMap((tile, index) => tile === baseline.lowerTiles[index] ? [] : [index]);
    const expected = LAKE_GRID.flatMap((row, y) => [...row].flatMap((cell, x) => cell === "~" ? [(y + 4) * 30 + x + 4] : []));
    expect(changed).toEqual(expected);
    expect(changed).toHaveLength(80);
    expect(map.upperTiles).toEqual(baseline.upperTiles);
    for (let y = 2; y < 6; y++) for (let x = 16; x < 20; x++) expect(map.lowerTiles[y * 30 + x]).toBe(baseline.lowerTiles[y * 30 + x]);
    expect(project.maps[FIELD_MAP_ID]).toBeUndefined();
  }, 30000);

  it.each(["unpainted", "rectangle"] as const)("native lake proof rejects a newly created map with %s content", async scenario => {
    const { createBlankProject } = await load();
    const ctx = { project: createBlankProject() };
    expect(runTool(ctx, "get_map_region", LAKE_REGION).ok).toBe(false);
    expect(runTool(ctx, "create_map", { id: FIELD_MAP_ID, name: "초록바람 숲길", width: 30, height: 30 }).ok).toBe(true);
    if (scenario === "rectangle") {
      expect(runTool(ctx, "fill_region", { mapId: FIELD_MAP_ID, rect: { x: 4, y: 4, w: 10, h: 10 }, material: "물", shape: "rect" })).toMatchObject({ ok: true, data: { filled: 100 } });
    }
    const region = runTool(ctx, "get_map_region", LAKE_REGION);
    expect(region).toMatchObject({ ok: true, data: { grid: Array(10).fill(scenario === "unpainted" ? ".........." : "~~~~~~~~~~"),
      water: { cellCount: scenario === "unpainted" ? 0 : 100, bounds: scenario === "unpainted" ? null : { x: 4, y: 4, w: 10, h: 10 } } } });
    expect(region.data).not.toMatchObject({ grid: LAKE_GRID, water: { cellCount: 80 } });
    const quality = runTool(ctx, "evaluate_game_quality", {});
    expect(quality.ok).toBe(true); // Transport success is not a passing authored-content verdict.
    // QA rejects empty maps but cannot replace the exact semantic grid proof above.
    expect(parseToolVerdict("evaluate_game_quality", quality).pass).toBe(scenario === "rectangle");
    if (scenario === "unpainted") expect(quality.issues).toContainEqual(expect.objectContaining({ code: "empty-map", severity: "error", mapId: FIELD_MAP_ID }));
    expect(ctx.project.maps[FIELD_MAP_ID]).toMatchObject({ width: 30, height: 30, events: [] });
    if (scenario === "unpainted") expect(new Set(ctx.project.maps[FIELD_MAP_ID].lowerTiles).size).toBe(1);
  }, 30000);
});
