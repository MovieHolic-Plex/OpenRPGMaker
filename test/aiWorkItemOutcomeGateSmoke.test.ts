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
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

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
          mapTargets: [FIELD_MAP_ID],
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
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "new_plan", ...PAINT_PLAN })),
        toolCallResult("set_work_plan", PAINT_PLAN, "c_plan"),
        createMapCall("c_map"),
        toolCallResult(
          "set_build_spec",
          {
            mapId: FIELD_MAP_ID,
            title: "숲길 호수",
            assets: [
              { id: "lake", kind: "terrain", x: 4, y: 4, w: 10, h: 10 },
              // 밑그림에만 있고 끝까지 칠하지 않는 에셋 — 완성도 경고의 근거다.
              { id: "grove", kind: "decor", x: 16, y: 2, w: 4, h: 4 },
            ],
          },
          "c_spec",
        ),
        toolCallResult(
          "fill_region",
          { mapId: FIELD_MAP_ID, rect: { x: 4, y: 4, w: 10, h: 10 }, material: "물", shape: "circle" },
          "c_fill",
        ),
        // 밑그림 에셋 하나를 안 칠한 채로 명시 완료를 시도해 완성도 경고를 남긴다.
        toolCallResult("complete_work_item", { note: "숲은 다음 항목에서 정리" }, "c_done"),
        finalResult("완료했습니다."),
      ]),
    });

    await session.sendUserMessage("음 다른맵을 더 만들자", () => {}, undefined, { autonomous: true });

    const audits = statusTexts(session);
    // 자동 완료는 완성도 경고로 막히고,
    expect(audits.some((text) => text.includes("자동 완료 차단") && text.includes("완성도 경고"))).toBe(true);
    // 모델이 명시 완료를 부르면 산출물 게이트만 보므로 진행된다.
    const completed = session
      .getAuditEntries()
      .some((entry) => entry.kind === "tool" && String((entry as { summary?: string }).summary ?? "").startsWith("완료:"));
    expect(completed).toBe(true);
  }, 30000);
});
