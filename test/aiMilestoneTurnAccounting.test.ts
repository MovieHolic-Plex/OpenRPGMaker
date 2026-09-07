// test/aiMilestoneTurnAccounting.test.ts
//
// 마일스톤으로 쪼개진 턴의 **정산**이 그 턴의 쓰기를 계속 볼 수 있는지 고정한다.
//
// 실측 결함(2026-08-30, 100×100 마을 복합 요청): 항목 완료마다 도는 마일스톤 자동 적용이
// `turnProposals` 를 비우기 때문에, 턴 끝의 검수 단계는 `proposedCalls`(=0)만 보고
// "⚠ 미이행: 실제 변경이 없습니다(체인지셋 0건)" / "diff 요약: 변경 제안 없음" 을 검수 모델에
// 주입했다. 결과: (1) 실제 부족분 대신 유령 결함으로 재실행 기회 1회를 태우고,
// (2) 확정된 밑그림 이행 여부(집·상점·여관)를 아무도 검사하지 못하고,
// (3) 사용자는 마을이 지어진 화면 위에서 "변경 없음" 배너를 읽었다.
//
// 이 결함은 **여러 항목으로 쪼개지는 복합 요청에서만** 난다 — 단발 요청은 마일스톤 플러시를
// 거치지 않아 정산이 맞는다. 그래서 회귀 테스트도 마일스톤 경로로 재현한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { ChatRequest } from "@/ai/llmClient";
import type { ReviewInput } from "@/ai/independentReview";
import { createBlankProject } from "@/project/defaults";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { fixedDeclarer } from "./intentFixture";
import { HISTORICAL_PLACEMENT_CORRECTION } from "./fixtures/placementRequests";
import { approvedReviewResponse, independentReviewPayload } from "./independentReviewFixture";

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

const ORCH_CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "auto" as const,
  baseUrl: "x",
  model: "supervisor-model",
  liteModel: "executor-model",
  apiKey: "sk",
  maxToolCalls: 40,
  maxTokens: 16000,
};

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

/** Keep the historical nine-item batch; every write batch now requires independent review. */
const WRITE_COUNT = 9;
const GOAL = "아이템 9종을 등록하고 타이틀까지 확정해줘";

function plan(): Record<string, unknown> {
  return {
    goal: GOAL,
    layers: [
      {
        title: "등록",
        // successTools 를 마지막 쓰기 하나로 두면 그 앞의 쓰기 전부가 같은 마일스톤에 묶여
        // 한 번에 플러시된다 — 실측 결함과 같은 형태(적용 완료 + 제안 0건).
        items: [{ title: "아이템·타이틀 일괄 등록", instruction: "upsert_item ×9 → set_title_screen", successTools: ["set_title_screen"] }],
      },
    ],
  };
}

function steps(): ChatResult[] {
  const writes = Array.from({ length: WRITE_COUNT }, (_, i) =>
    toolCallResult("upsert_item", { item: { id: `item_ledger_${i}`, name: `원장 아이템 ${i}`, price: 10 + i } }, `c_item_${i}`),
  );
  return [
    finalResult(JSON.stringify({ action: "new_plan", ...plan() })),
    toolCallResult("set_work_plan", plan(), "c_plan"),
    ...writes,
    toolCallResult("set_title_screen", { title: "원장 검증" }, "c_title"),
    // The reviewer response is routed separately from the writer script.
    finalResult("등록을 마쳤습니다."),
  ];
}

describe("마일스톤 턴 정산", () => {
  it.each([
    [HISTORICAL_PLACEMENT_CORRECTION, "done"],
    ["기존 나무 10개는 보존하고 꽃 3개 추가해줘", "in_progress"],
    ["나무 10개 배치해줘", "in_progress"],
  ])("auto-completion distinguishes modification facts from missing placements: %s", async (requestText, expectedStatus) => {
    const project = createBlankProject();
    installHermeticEnv(project);
    let round = 0;
    const session = new AssistantSession(project, {
      config: { ...ORCH_CONFIG, agentMode: "chat", maxToolCalls: 2 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      chat: async (): Promise<ChatResult> => {
        if (round++ === 0) return toolCallResult("set_work_plan", {
          goal: requestText,
          layers: [{ title: "수정", items: [{ title: "수정", instruction: requestText, successTools: ["set_map_properties"] }] }],
        }, "plan_quantity");
        return toolCallResult("set_map_properties", { mapId: project.startMapId, name: "마을" }, "write_quantity");
      },
    });
    const result = await session.sendUserMessage(requestText);
    expect(result.proposedCalls.some((call) => call.name === "set_map_properties" && call.result.ok)).toBe(true);
    expect(session.getProposedProject().maps[project.startMapId]?.name).toBe("마을");
    expect(session.getHarnessSnapshot().workPlan?.layers[0]?.items[0]?.status).toBe(expectedStatus);
  }, 30000);

  it("한 항목이 실행 한도로 나뉘어도 앞선 성공과 미적용 제안을 이어서 완료한다", async () => {
    const project = createBlankProject();
    installHermeticEnv(project);
    const baseline = structuredClone(store.getCurrent());
    const reviews: ReviewInput[] = [];
    const storesAtReview: Project[] = [];
    const events: SessionEvent[] = [];
    // Read, author, and inspect the item in one budget; title + final + review in the next.
    const script = [
      toolCallResult("get_project_summary", {}, "split_summary"),
      toolCallResult("upsert_item", { item: { id: "item_split_budget", name: "연속 실행 약초", price: 20 } }, "split_item"),
      toolCallResult("get_database_records", { collection: "items", ids: ["item_split_budget"], include: "full" }, "split_inspect"),
      toolCallResult("set_title_screen", { title: "연속 실행 모험" }, "split_title"),
      finalResult("완료했습니다."),
    ];
    let index = 0;
    const session = new AssistantSession(project, {
      config: { ...ORCH_CONFIG, maxToolCalls: 3 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      chat: async (_config, request): Promise<ChatResult> => {
        const review = independentReviewPayload(request);
        const approval = approvedReviewResponse(request);
        if (review && approval) {
          reviews.push(review);
          storesAtReview.push(structuredClone(store.getCurrent()));
          return approval;
        }
        if (!request.tools?.length) return finalResult(JSON.stringify({
          action: "new_plan", goal: "아이템과 타이틀",
          layers: [{ title: "등록", items: [{
            title: "아이템과 타이틀", instruction: "upsert_item 후 set_title_screen",
            successTools: ["upsert_item", "set_title_screen"],
          }] }],
        }));
        return script[index++] ?? exhausted();
      },
    });
    const result = await session.sendUserMessage("아이템과 타이틀을 등록해줘", event => events.push(event), undefined, { autonomous: true });
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(reviews).toHaveLength(1);
    expect(storesAtReview).toEqual([baseline]);
    expect(reviews[0]?.originalRequest).toBe("아이템과 타이틀을 등록해줘");
    expect(reviews[0]?.changes).toContainEqual(expect.objectContaining({
      path: "/database/items/item_split_budget", before: null,
      after: expect.objectContaining({ name: "연속 실행 약초", price: 20 }),
    }));
    expect(events.filter(event => event.type === "result_review" || event.type === "milestone_applied")
      .map(event => event.type)).toEqual(["result_review", "milestone_applied"]);
    expect(result.proposedCalls).toEqual([]);
    expect(session.getHarnessSnapshot().workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(result.appliedCalls?.map((call) => call.name)).toEqual(["upsert_item", "set_title_screen"]);
    expect(store.getCurrent().database.items.find((item) => item.id === "item_split_budget")?.name).toBe("연속 실행 약초");
    expect(store.getCurrent().system.titleScreen?.title).toBe("연속 실행 모험");
    expect(session.getAuditEntries().filter(entry => entry.kind === "user").map(entry => entry.text))
      .toEqual(["아이템과 타이틀을 등록해줘", "계속"]);
  }, 30000);

  it.each([false, true])("마일스톤 쓰기는 자동 계속(%s) 후에도 정산에 남는다", async (continueOnce) => {
    const project = createBlankProject();
    installHermeticEnv(project);
    const baseline = structuredClone(store.getCurrent());
    const reviews: ReviewInput[] = [];
    const storesAtReview: Project[] = [];
    const events: SessionEvent[] = [];
    const script = steps();
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const review = independentReviewPayload(request);
      const approval = approvedReviewResponse(request);
      if (review && approval) {
        reviews.push(review);
        storesAtReview.push(structuredClone(store.getCurrent()));
        return approval;
      }
      return script[index++] ?? exhausted();
    };
    const session = new AssistantSession(project, {
      // Ten rounds leave the title unfinished, exercising the real continuation driver.
      config: { ...ORCH_CONFIG, maxToolCalls: continueOnce ? 10 : 40 }, chat,
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
    });
    const result = await session.sendUserMessage(GOAL, event => events.push(event), undefined, {
      autonomous: true, instruction: GOAL, composerMode: "do",
    });
    // The original explicit instruction must not turn synthetic continuation into a new create request.
    expect(session.getAuditEntries().filter(entry => entry.kind === "user").map(entry => entry.text)).toEqual(
      continueOnce ? [GOAL, "계속"] : [GOAL],
    );
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(events.filter(event => event.type === "result_review" || event.type === "milestone_applied")
      .map(event => event.type)).toEqual(["result_review", "milestone_applied"]);
    expect(result.proposedCalls).toHaveLength(0);

    // 1) 턴 결과가 "이 턴이 무엇을 지었는지" 를 계속 들고 있다.
    const applied = result.appliedCalls ?? [];
    expect(applied.map((call) => call.name)).toEqual([
      ...Array.from({ length: WRITE_COUNT }, () => "upsert_item"),
      "set_title_screen",
    ]);

    expect(reviews).toHaveLength(1);
    // Completed work stays detached until the reviewer receives all earlier writes.
    expect(storesAtReview).toEqual([baseline]);
    expect(reviews[0]?.originalRequest).toBe(GOAL);
    expect(reviews[0]?.requiredProblems).toEqual([]);
    for (let i = 0; i < WRITE_COUNT; i += 1) {
      expect(reviews[0]?.changes).toContainEqual({
        path: `/database/items/item_ledger_${i}`, before: null,
        after: expect.objectContaining({ id: `item_ledger_${i}`, name: `원장 아이템 ${i}`, price: 10 + i }),
      });
      expect(reviews[0]?.toolResults).toContainEqual(expect.objectContaining({
        name: "upsert_item", args: { item: { id: `item_ledger_${i}`, name: `원장 아이템 ${i}`, price: 10 + i } },
        result: expect.objectContaining({ ok: true }),
      }));
    }
    expect(reviews[0]?.changes).toContainEqual(expect.objectContaining({
      path: "/system", before: baseline.system,
      after: expect.objectContaining({ titleScreen: expect.objectContaining({ title: "원장 검증" }) }),
    }));

    const items = store.getCurrent().database.items;
    expect(items.filter((item) => item.id.startsWith("item_ledger_"))).toHaveLength(WRITE_COUNT);
    expect(store.getCurrent().system.titleScreen?.title).toBe("원장 검증");
  }, 30000);
});
