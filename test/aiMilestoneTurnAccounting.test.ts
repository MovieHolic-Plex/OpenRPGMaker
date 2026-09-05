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
import { AssistantSession } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
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

const ORCH_CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "auto" as const,
  baseUrl: "x",
  model: "supervisor-model",
  liteModel: "executor-model",
  apiKey: "sk",
  maxToolCalls: 40,
  maxTokens: 1024,
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

/** 검수 단계는 쓰기 시도 9회 이상에서만 열린다(단순 요청은 왕복 절약을 위해 건너뜀). */
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
    // 쓰기 종료 → 검수 단계 진입 → 검수 응답.
    finalResult("등록을 마쳤습니다."),
    finalResult("완료: 아이템 9종과 타이틀을 등록했습니다."),
  ];
}

describe("마일스톤 턴 정산", () => {
  it("한 항목이 실행 한도로 나뉘어도 앞선 성공과 미적용 제안을 이어서 완료한다", async () => {
    const project = createBlankProject();
    installHermeticEnv(project);
    let rounds = 0;
    let planners = 0;
    const session = new AssistantSession(project, {
      config: { ...ORCH_CONFIG, maxToolCalls: 1 },
      declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      chat: async (_config, request): Promise<ChatResult> => {
        if (!request.tools?.length) return finalResult(JSON.stringify(planners++ === 0 ? {
          action: "new_plan", goal: "아이템과 타이틀",
          layers: [{ title: "등록", items: [{
            title: "아이템과 타이틀", instruction: "upsert_item 후 set_title_screen",
            successTools: ["upsert_item", "set_title_screen"],
          }] }],
        } : { action: "resume" }));
        if (rounds++ === 0) return toolCallResult("upsert_item", { item: { id: "item_split_budget", name: "연속 실행 약초", price: 20 } }, "split_item");
        if (rounds === 2) return toolCallResult("set_title_screen", { title: "연속 실행 모험" }, "split_title");
        return finalResult("완료했습니다.");
      },
    });
    const result = await session.sendUserMessage("아이템과 타이틀을 등록해줘", () => {}, undefined, { autonomous: true });
    expect(session.getHarnessSnapshot().workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(result.appliedCalls?.map((call) => call.name)).toEqual(["upsert_item", "set_title_screen"]);
    expect(store.getCurrent().database.items.find((item) => item.id === "item_split_budget")?.name).toBe("연속 실행 약초");
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text.includes("agent_run:auto-continue"))).toBe(true);
  }, 30000);

  it.each([false, true])("마일스톤 쓰기는 자동 계속(%s) 후에도 정산에 남는다", async (continueOnce) => {
    const project = createBlankProject();
    installHermeticEnv(project);
    const script = steps();
    if (continueOnce) script.push(finalResult("완료했습니다."));
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= script.length) exhausted();
      return script[index++]!;
    };
    const session = new AssistantSession(project, { config: ORCH_CONFIG, chat });

    if (continueOnce) {
      vi.spyOn(session as unknown as { shouldAutoContinue: () => boolean }, "shouldAutoContinue")
        .mockReturnValueOnce(true).mockReturnValue(false);
    }
    const intentInputs = vi.spyOn(session as unknown as {
      declareTurnIntent: (instruction: string, ...args: unknown[]) => Promise<unknown>;
    }, "declareTurnIntent");
    const result = await session.sendUserMessage(GOAL, () => {}, undefined, {
      autonomous: true, instruction: GOAL, composerMode: "do",
    });
    // The original explicit instruction must not turn synthetic continuation into a new create request.
    expect(intentInputs.mock.calls.map(([instruction]) => instruction)).toEqual(
      continueOnce ? [GOAL, "계속"] : [GOAL],
    );

    const statuses = session.getAuditEntries().filter((e) => e.kind === "status").map((e) => String(e.text ?? ""));
    // 전제: 마일스톤이 실제로 적용되어 제안이 비워졌다(이 결함의 발생 조건).
    expect(statuses.some((t) => t.includes("agent_run:milestone-applied"))).toBe(true);
    expect(result.proposedCalls).toHaveLength(0);

    // 1) 턴 결과가 "이 턴이 무엇을 지었는지" 를 계속 들고 있다.
    const applied = result.appliedCalls ?? [];
    expect(applied.map((call) => call.name)).toEqual([
      ...Array.from({ length: WRITE_COUNT }, () => "upsert_item"),
      "set_title_screen",
    ]);

    const reviewInjections = statuses.filter((t) => t.includes("완성도 린트 결과"));
    expect(reviewInjections.length).toBeGreaterThan(0);
    for (const injection of reviewInjections) {
      expect(injection).not.toContain("실제 변경이 없습니다");
      expect(injection).not.toContain("변경 제안 없음");
    }
    // diff 요약에 실제 툴 이름이 들어간다 — 검수 모델이 근거를 본다.
    // 감사 문자열은 600자에서 쟘리므로 마지막 항목이 아니라 첫 번톨 diff 줄로 판정한다.
    expect(reviewInjections.some((t) => /1\. upsert_item/.test(t))).toBe(true);

    const items = store.getCurrent().database.items;
    expect(items.filter((item) => item.id.startsWith("item_ledger_"))).toHaveLength(WRITE_COUNT);
    // 라우팅 선언은 "계속"을 읽어도 검수는 사용자의 원래 목표를 읽어야 한다.
    const review = (session as unknown as {
      buildReviewPrompt: (pending: [], repaired: boolean) => { prompt: string };
    }).buildReviewPrompt([], false);
    expect(review.prompt).toContain(`## 사용자 요청\n${GOAL}`);
    expect(review.prompt).not.toContain("## 사용자 요청\n계속\n");
  }, 30000);
});
