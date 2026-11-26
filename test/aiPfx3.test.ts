import { describe, expect, it, afterEach, vi, beforeAll } from "vitest";
import { fixedDeclarer } from "./intentFixture";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { ChatRequest, ChatResult } from "@/ai/llmClient";
import { getTool } from "@/editor/tools";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { HISTORICAL_PLACEMENT_CORRECTION } from "./fixtures/placementRequests";
import { independentReviewPayload } from "./independentReviewFixture";
import { isolateTimers } from "./mergedTeardown";

// 컴포저 모드(지시/질문/계획)의 세션 계약. 모드는 프롬프트 문장이 아니라 하네스가 강제한다:
//   질문(ask)  — 쓰기 툴 스키마를 모델에 노출하지 않고, 불러도 거부한다. 프로젝트 초안은 불변.
//   계획(plan) — 플래너를 항상 돌려 계획만 세우고 그 턴은 실행 없이 끝난다. 「계속」이 실행이다.
//   지시(do)   — 종전 그대로.
// 이전 구현은 [컨텍스트] 꼬리에 "모드: 질문 — …" 한 줄만 실었고 세션은 모드를 몰랐다(2026-09-03 감사).
describe("aiComposerModeSession", () => {
  isolateTimers();
  const CONFIG = {
    authMode: "apiKey" as const,
    baseUrl: "x",
    model: "stub-model",
    liteModel: "stub-model",
    apiKey: "sk",
    maxToolCalls: 6,
    maxTokens: 512,
    agentMode: "chat" as const,
  };
  function finalResult(text: string): ChatResult {
    return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
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
  const PLAN = {
    goal: "타이틀 2단계 개선",
    layers: [
      {
        title: "타이틀",
        items: [
          { title: "1차 제목", instruction: "set_title_screen {title:'t1'}", successTools: ["set_title_screen"] },
          { title: "2차 제목", instruction: "set_title_screen {title:'t2'}", successTools: ["set_title_screen"] },
        ],
      },
    ],
  };
  const NEW_PLAN_JSON = JSON.stringify({ action: "new_plan", ...PLAN });
  const DIRECT_JSON = JSON.stringify({ action: "direct", reason: "한 턴으로 충분" });
  /** 스크립트를 순서대로 돌려주고, 각 호출의 요청(tools 포함)을 기록하는 chat. */
  function scriptedChat(steps: ChatResult[]) {
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push(req);
      const next = steps.shift();
      if (!next) {
        throw new (class extends Error {
          readonly status = 401;
          constructor() {
            super("scripted chat exhausted");
            this.name = "LlmError";
          }
        })();
      }
      return next;
    };
    return { chat, requests };
  }
  const toolNames = (req: ChatRequest | undefined): string[] => (req?.tools ?? []).map((tool) => tool.function.name);
  const writeToolNames = (req: ChatRequest | undefined): string[] =>
    toolNames(req).filter((name) => getTool(name)?.mode === "write" || name === "set_build_spec");
  describe("컴포저 모드 — 질문(ask)", () => {
    it("쓰기 툴 스키마를 모델에 노출하지 않는다 (읽기 툴은 남는다)", async () => {
      // Break: 노출 필터가 없으면 도메인 기본 세트의 write 툴(paint_tiles 등)이 그대로 실린다.
      const { chat, requests } = scriptedChat([finalResult("이 맵은 20×15 입니다.")]);
      const session = new AssistantSession(createBlankProject(), {
        config: CONFIG,
        chat,
        // 선언자가 「생성」이라고 읽어도 사용자가 고른 질문 모드가 이긴다.
        declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
      });

      const result = await session.sendUserMessage("이 맵 크기가 얼마야?", () => {}, undefined, { composerMode: "ask" });

      expect(requests).toHaveLength(1);
      expect(writeToolNames(requests[0])).toEqual([]);
      expect(toolNames(requests[0]).some((name) => getTool(name)?.mode === "read")).toBe(true);
      expect(result.proposedCalls).toEqual([]);
    });

    it("모델이 쓰기 툴을 불러도 거부하고 프로젝트 초안은 불변이다", async () => {
      // Break: 실행 게이트가 없으면 노출 안 된 write 툴콜도 runTool 로 실행된다(exposedNames 는 감사용).
      const { chat } = scriptedChat([
        toolCallResult("set_title_screen", { title: "몰래 바꾼 제목" }, "c_write"),
        finalResult("알겠습니다."),
      ]);
      const project = createBlankProject();
      const before = structuredClone(project);
      const events: SessionEvent[] = [];
      const session = new AssistantSession(project, {
        config: CONFIG,
        chat,
        declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      });

      const result = await session.sendUserMessage("타이틀이 뭐야?", (event) => events.push(event), undefined, { composerMode: "ask" });

      const toolEvents = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
      expect(toolEvents).toHaveLength(1);
      expect(toolEvents[0]?.result.ok).toBe(false);
      expect(toolEvents[0]?.result.issues?.some((issue) => issue.code === "composer-mode-ask")).toBe(true);
      expect(result.proposedCalls).toEqual([]);
      expect(session.getProposedProject()).toEqual(before);
    });
  });
  describe("컴포저 모드 — 계획(plan)", () => {
    it("플래너만 돌려 계획 카드를 내고 그 턴은 실행 없이 끝난다 (자율 진입도 자동 계속 0회)", async () => {
      // Break: 계획 생성 뒤 runTurnLoop 로 넘어가면 chat 이 2회 이상 불리고 tools 가 실린다.
      const { chat, requests } = scriptedChat([finalResult(NEW_PLAN_JSON)]);
      const events: SessionEvent[] = [];
      const session = new AssistantSession(createBlankProject(), {
        config: CONFIG,
        chat,
        // needsPlan:false — 지시 모드라면 플래너를 건너뛰는 선언. 계획 모드는 그래도 플래너를 돈다.
        declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
      });

      const result = await session.sendUserMessage(
        "타이틀을 두 단계로 다듬어줘",
        (event) => events.push(event),
        undefined,
        { composerMode: "plan", autonomous: true },
      );

      expect(requests).toHaveLength(1);
      expect(requests[0]?.tools ?? []).toEqual([]);
      expect(events.some((event) => event.type === "work_plan")).toBe(true);
      expect(result.workPlan?.layers[0]?.items).toHaveLength(2);
      expect(result.proposedCalls).toEqual([]);
      expect(result.assistantText).toContain("계속");
    });

    it("플래너가 direct 를 내도 1항목 계획을 세우고 멈춘다", async () => {
      const { chat, requests } = scriptedChat([finalResult(DIRECT_JSON)]);
      const session = new AssistantSession(createBlankProject(), {
        config: CONFIG,
        chat,
        declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
      });

      const result = await session.sendUserMessage("타이틀 제목을 바꿔줘", () => {}, undefined, { composerMode: "plan" });

      expect(requests).toHaveLength(1);
      expect(result.workPlan?.layers.flatMap((layer) => layer.items)).toHaveLength(1);
      expect(result.proposedCalls).toEqual([]);
    });

    it("계획 뒤 「계속」은 툴 루프를 돌려 실행한다", async () => {
      const { chat, requests } = scriptedChat([
        finalResult(NEW_PLAN_JSON),
        // 「계속」 턴: 이어가기 선언은 플래너를 부르지 않고(resume 은 활성 계획이 있으면 플래너가 판단)
        // 본문 루프가 tools 와 함께 돈다.
        JSON.parse(JSON.stringify(finalResult(JSON.stringify({ action: "resume", reason: "같은 목표 계속" })))) as ChatResult,
        toolCallResult("set_title_screen", { title: "t1" }, "c_t1"),
        finalResult("1차 제목을 적용했습니다."),
      ]);
      const session = new AssistantSession(createBlankProject(), {
        config: CONFIG,
        chat,
        declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
      });

      await session.sendUserMessage("타이틀을 두 단계로 다듬어줘", () => {}, undefined, { composerMode: "plan" });
      const planOnlyCalls = requests.length;
      const result = await session.sendUserMessage("계속", () => {}, undefined, { composerMode: "plan" });

      expect(planOnlyCalls).toBe(1);
      expect(requests.length).toBeGreaterThan(planOnlyCalls);
      expect(requests.slice(planOnlyCalls).some((req) => (req.tools ?? []).length > 0)).toBe(true);
      expect(result.proposedCalls.some((call) => call.name === "set_title_screen")).toBe(true);
    });
  });
  describe("컴포저 모드 — 지시(do)", () => {
    it("기본/지시 모드는 쓰기 툴을 그대로 노출한다", async () => {
      const { chat, requests } = scriptedChat([finalResult("바꿨습니다.")]);
      const session = new AssistantSession(createBlankProject(), {
        config: CONFIG,
        chat,
        declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      });

      await session.sendUserMessage("타이틀 제목을 바꿔줘", () => {}, undefined, { composerMode: "do" });

      expect(requests).toHaveLength(1);
      expect(writeToolNames(requests[0]).length).toBeGreaterThan(0);
    });
  });
});

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
//
// 2026-09-17 독립 검수(LLM 재심사) 해체: 검수 봉투(changes·toolResults·requiredProblems)에 대한 단언은
// 삭제했다. 승인은 결정적 검사(변경 맵 lint error 0)로 나고, 검수 모델은 호출되지 않는다(reviews 0).
// "적용은 검수 승인 뒤" 라는 순서 계약은 result_review 이벤트 시점의 store 로 그대로 고정한다.
describe("aiMilestoneTurnAccounting", () => {
  isolateTimers();
  beforeAll(() => {
    // Tests here build the ~63MB blank project (createBlankProject) and drive assistant sessions or editor
    // panels over it, fingerprinting/copying it per session. Under ci-full load (8 workers on 4-core runners)
    // single tests measured 10-50s, past vitest's 15s default, so the budget is raised for this file only.
    vi.setConfig({ testTimeout: 120_000 });
  });
  function installHermeticEnv(project: Project): void {
    vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "test-anon-key");
    vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "rpg-zzu-test-project");
    vi.stubEnv("VITE_LEGACY_DB_URL", "http://dbserver:8100");
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
    }, 120000);

    it("한 항목이 실행 한도로 나뉘어도 앞선 성공과 미적용 제안을 이어서 완료한다", async () => {
      const project = createBlankProject();
      installHermeticEnv(project);
      const baseline = structuredClone(store.getCurrent());
      let reviews = 0;
      const storesAtReview: Project[] = [];
      const events: SessionEvent[] = [];
      // Read, author, and inspect the item in one budget; title + final in the next.
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
          if (independentReviewPayload(request)) { reviews += 1; return exhausted(); }
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
      const result = await session.sendUserMessage("아이템과 타이틀을 등록해줘", event => {
        events.push(event);
        if (event.type === "result_review") storesAtReview.push(structuredClone(store.getCurrent()));
      }, undefined, { autonomous: true });
      expect(result.stoppedReason, result.error).toBe("final");
      expect(result.review?.status).toBe("approved");
      expect(result.review?.summary).toContain("lint error 0건");
      expect(reviews).toBe(0);
      // 첫 턴은 실행 한도(max-tool-calls)로 끝난다 — 예산 소진 초안은 결정적 검사를 거쳐 적용되고,
      // 항목이 아직 열려 있으니 드라이버가 「계속」 턴을 연다. 적용은 언제나 검사 뒤다(store 는 검사 시점에 기준선).
      expect(storesAtReview.length).toBeGreaterThanOrEqual(1);
      expect(storesAtReview[0]).toEqual(baseline);
      const reviewAndApply = events.filter(event => event.type === "result_review" || event.type === "milestone_applied").map(event => event.type);
      // 예산 소진 턴의 결정적 검사 1회 + 「계속」 턴 종료 검사 1회, 적용은 항목이 닫힌 뒤 한 배치.
      expect(reviewAndApply).toEqual(["result_review", "result_review", "milestone_applied"]);
      expect(result.proposedCalls).toEqual([]);
      expect(session.getHarnessSnapshot().workPlan?.layers[0]?.items[0]?.status).toBe("done");
      expect(store.getCurrent().database.items.find((item) => item.id === "item_split_budget")?.name).toBe("연속 실행 약초");
      expect(store.getCurrent().system.titleScreen?.title).toBe("연속 실행 모험");
      expect(session.getAuditEntries().filter(entry => entry.kind === "user").map(entry => entry.text))
        .toEqual(["아이템과 타이틀을 등록해줘", "계속"]);
    }, 120000);

    it.each([false, true])("마일스톤 쓰기는 자동 계속(%s) 후에도 정산에 남는다", async (continueOnce) => {
      const project = createBlankProject();
      installHermeticEnv(project);
      const baseline = structuredClone(store.getCurrent());
      let reviews = 0;
      const storesAtReview: Project[] = [];
      const events: SessionEvent[] = [];
      const script = steps();
      let index = 0;
      const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
        if (independentReviewPayload(request)) { reviews += 1; return exhausted(); }
        return script[index++] ?? exhausted();
      };
      const session = new AssistantSession(project, {
        // Ten rounds leave the title unfinished, exercising the real continuation driver.
        config: { ...ORCH_CONFIG, maxToolCalls: continueOnce ? 10 : 40 }, chat,
        declareIntent: fixedDeclarer({ mode: "modify", needsPlan: true }),
      });
      const result = await session.sendUserMessage(GOAL, event => {
        events.push(event);
        if (event.type === "result_review") storesAtReview.push(structuredClone(store.getCurrent()));
      }, undefined, {
        autonomous: true, instruction: GOAL, composerMode: "do",
      });
      // The original explicit instruction must not turn synthetic continuation into a new create request.
      expect(session.getAuditEntries().filter(entry => entry.kind === "user").map(entry => entry.text)).toEqual(
        continueOnce ? [GOAL, "계속"] : [GOAL],
      );
      expect(result.stoppedReason, result.error).toBe("final");
      expect(result.review?.status).toBe("approved");
      expect(reviews).toBe(0);
      const reviewAndApply = events.filter(event => event.type === "result_review" || event.type === "milestone_applied").map(event => event.type);
      // 결정적 검사가 먼저, 적용은 그 뒤다. 자동 계속 런은 예산 소진 턴에서도 검사→적용을 한 번 더 거친다.
      expect(reviewAndApply).toEqual(continueOnce
        ? ["result_review", "result_review", "milestone_applied"]
        : ["result_review", "milestone_applied"]);
      expect(result.proposedCalls).toHaveLength(0);

      // 1) 턴 결과가 "이 턴이 무엇을 지었는지" 를 계속 들고 있다.
      const applied = result.appliedCalls ?? [];
      expect(applied.map((call) => call.name)).toEqual([
        ...Array.from({ length: WRITE_COUNT }, () => "upsert_item"),
        "set_title_screen",
      ]);

      // Completed work stays detached until the deterministic check has passed.
      expect(storesAtReview[0]).toEqual(baseline);

      const items = store.getCurrent().database.items;
      expect(items.filter((item) => item.id.startsWith("item_ledger_"))).toHaveLength(WRITE_COUNT);
      expect(store.getCurrent().system.titleScreen?.title).toBe("원장 검증");
    }, 120000);
  });
});
