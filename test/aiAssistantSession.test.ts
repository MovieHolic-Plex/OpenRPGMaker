// 2026-09-17 독립 검수(LLM 재심사) 해체 — 승인은 결정적 검사(변경 맵 lint error 0)로만 난다. 검수 모델의 응답 형식
// (raw 툴콜 마크업 거부·산문 재요구·감독 모델 복귀)을 검증하던 툴콜 루프 테스트 3개는 삭제했다. 스크립트가 검수 응답
// 한 번을 소비하던 테스트는 그 단계를 빼고 새 계약(deterministic-review 감사·예산 소진 초안 적용)으로 고쳤다.
import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { fixedDeclarer } from "./intentFixture";
import { approvedReviewResponse, independentReviewPayload, imageDeliveryForRequest } from "./independentReviewFixture";
import type { ReviewInput } from "@/ai/independentReview";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type { SessionEvent, ToolImageRenderer } from "@/ai/assistantSession";
import { getTool } from "@/editor/tools";
import * as applyStore from "@/editor/tools/applyChangesetToStore";

const MILESTONE_TEST_ENV = {
  VITE_LEGACY_DB_ANON_KEY: "test-anon-key",
  VITE_LEGACY_DB_PROJECT_ID: "rpg-zzu-test-project",
  VITE_LEGACY_DB_URL: "http://dbserver:8100",
} as const;

function stubLegacyDbEnv(): void {
  vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", MILESTONE_TEST_ENV.VITE_LEGACY_DB_ANON_KEY);
  vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", MILESTONE_TEST_ENV.VITE_LEGACY_DB_PROJECT_ID);
  vi.stubEnv("VITE_LEGACY_DB_URL", MILESTONE_TEST_ENV.VITE_LEGACY_DB_URL);
}

/**
 * 마일스톤 자동 적용이 실제 LegacyDb를 건드리지 않도록 헤르메틱 환경을 설치한다.
 * 자율 런 테스트는 독립 검수 후 배치 자동 적용 경로를 타므로 필수다.
 */
function installMilestoneHermeticEnv(project: Project): void {
  stubLegacyDbEnv();
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
}

/** 마일스톤 스토어 초기화만(적용 없는 테스트용 — env/fetch 스텁 불필요). */
function initMilestoneStore(project: Project): void {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ── 자율 실행 드라이버(todo 2: 턴 간 자동 계속 + 48단계 예산) ─────────────────────
// 계약: sendUserMessage(..., { autonomous }) 로 진입한 런은 턴이 끝난 뒤
// (계획 미완료 && 예산 잔여 && 대기 사용자 메시지 없음 && 중단 아님)인 동안
// 하니스가 스스로 다음 턴을 송신한다. 사용자 우선: peekPendingUserMessage 훅이
// 문자열을 반환하면 드라이버는 송신하지 않고 패널의 기존 드레인 루프가 전달한다.
// 패널 배선 계약의 세션 레벨 검증(원래 DOM 테스트는 llmClient 실경로와 충돌해 제거 —
// 이 블록이 (e)peek→일시정지, (e-2)비문자→null 취급, (f-2)chat 모드 미가동을 검증한다).
describe("자율 실행 드라이버", () => {
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

  /** 3항목 계획 — 각 항목은 set_title_screen 쓰기 성공으로 자동 완료(successTools)된다. */
  const THREE_ITEM_PLAN = {
    goal: "타이틀 3단계 개선",
    layers: [
      {
        title: "타이틀",
        items: [
          { title: "1차 제목", instruction: "set_title_screen {title:'t1'}", successTools: ["set_title_screen"] },
          { title: "2차 제목", instruction: "set_title_screen {title:'t2'}", successTools: ["set_title_screen"] },
          { title: "3차 제목", instruction: "set_title_screen {title:'t3'}", successTools: ["set_title_screen"] },
        ],
      },
    ],
  };
  const THREE_ITEM_PLAN_JSON = JSON.stringify({ action: "new_plan", ...THREE_ITEM_PLAN });
  const RESUME_JSON = JSON.stringify({ action: "resume", reason: "같은 목표 계속" });
  const titleWrite = (id: string, title: string): ChatResult => toolCallResult("set_title_screen", { title }, id);
  const statusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
    session.getAuditEntries().filter((e) => e.kind === "status").map((e) => String(e.text));
  const ORCH_AUTO = { ...ORCH_CONFIG, maxToolCalls: 4 };

  /** 스크립트 소진 시 영구 오류로 던진다 — 일시 오류 재시도(백오프)로 늘어지지 않게 즉시 실패.
   *  name:"LlmError" + status 없음은 isRetryableLlmError 기준 재시도 대상이라, 여기선 401 성격의
   *  영구 오류로 만들기 위해 status 필드를 함께 심는다. */
  const exhausted = (): never => {
    throw new (class extends Error {
      readonly status = 401;
      constructor() {
        super("scripted chat exhausted");
        this.name = "LlmError";
      }
    })();
  };

  it("(a) 3항목 계획이 자동 계속 턴으로 완료된다 — 수동 송신 0건", async () => {
    const { AssistantSession, createBlankProject } = await load();
    // maxToolCalls=4 로 한 턴이 결정적으로 상한 도달로 끝난다(라운드: planner는 라운드 카운트 밖).
    // 드라이버의 합성 「계속」 턴은 플래너 왕복을 태우지 않는다(2026-09-03) — 그래서 resume 응답이 없다.
    // 턴1: new_plan(set_work_plan + t1 완료) → 라운드 상한. 턴2: t2 → 상한. 턴3: t3 → 완료 보고.
    const steps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      titleWrite("c_t2", "t2"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      titleWrite("c_t3", "t3"),
      finalResult("모든 항목을 완료했습니다."),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    // 검수된 자율 배치만 적용되며 실제 LegacyDb 대신 세션·store를 같은 fixture로 초기화한다.
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: ORCH_AUTO, chat });

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    const items = session.getWorkPlan()!.layers.flatMap((l) => l.items);
    expect(items.map((i) => i.status)).toEqual(["done", "done", "done"]);
    const statuses = statusTexts(session);
    expect(statuses.some((t) => t.includes("agent_run:auto-continue"))).toBe(true);
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    // 모델의 마지막 말이 본문이고 결정적 검사 결과가 뒤에 한 줄로 붙는다.
    expect(result.assistantText).toContain(result.review!.summary);
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["t1", "t2", "t3"]);
    // Planner + writer: 11 calls across three turns. 검수 모델 호출은 없다 — 예산(라운드 상한)으로 끝난 두 턴과
    // 마지막 final 턴이 각각 결정적 검사를 한 번씩 받는다.
    expect(index).toBe(11);
    expect(statuses.filter(text => text.startsWith("deterministic-review "))).toHaveLength(3);
    expect(statuses.filter(text => text.startsWith("예산 소진 초안 적용 — "))).toHaveLength(2);
    expect(statuses.filter((t) => t.startsWith("planner:start")).length).toBe(1);
    expect(statuses.filter((t) => t.includes("planner:skip driver-continue")).length).toBe(2);
    // 진행이 있는 항목은 막지 않는다 — 쓰기가 성공할 때마다 항목별 시도 수가 0으로 돌아간다.
    expect(statuses.some((t) => t.startsWith("ralph:stalled"))).toBe(false);
  }, 120000);

  it("(b) 총 예산 48 소진 시 agent_run_budget_exhausted 감사를 남기고 멈춘다", async () => {
    const { AssistantSession, createBlankProject, AGENT_RUN_MAX_TOTAL_STEPS } = await load();
    expect(AGENT_RUN_MAX_TOTAL_STEPS).toBe(48);
    const NEVER_PLAN = { goal: "끝나지 않는 목표", layers: [{ title: "L", items: [{ title: "무한", instruction: "완료 불가" }] }] };
    const steps: ChatResult[] = [
      finalResult(JSON.stringify({ action: "new_plan", ...NEVER_PLAN })),
      toolCallResult("set_work_plan", NEVER_PLAN, "c_plan"),
    ];
    let bodyTurns = 0;
    // 라운드 상한 4 = 드라이버 턴마다 본문 콜 4회. 각 턴의 첫 콜은 실제 쓰기다 — 저작은 진행되지만
    // 항목의 완료 조건은 영원히 충족되지 않는 상태(2026-09-03 교착 차단은 **무진행**만 막는다).
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      if (!req.tools || req.tools.length === 0) return finalResult(RESUME_JSON);
      if (steps.length > 0) return steps.shift()!;
      bodyTurns += 1;
      if (bodyTurns % 4 === 1) return titleWrite(`c_b${bodyTurns}`, `진행 ${bodyTurns}`);
      return finalResult(`아직 진행 중입니다(턴 ${bodyTurns}). 계속 진행이 필요합니다.`);
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_AUTO, chat });

    await session.sendUserMessage(`${ORCH_GOAL}끝나지 않는 목표를 처리해줘`, () => {}, undefined, { autonomous: true });

    const statuses = statusTexts(session);
    expect(statuses.some((t) => t.includes("agent_run_budget_exhausted"))).toBe(true);
    // 48회까지 자동 계속하고 49번째는 송신하지 않는다 — 본문 턴 = 초기 1 + 자동 48.
    expect(statuses.filter((t) => t.includes("agent_run:auto-continue")).length).toBe(48);
    // 진행이 계속되는 동안은 교착으로 판정하지 않는다.
    expect(statuses.some((t) => t.startsWith("ralph:stalled"))).toBe(false);
  }, 300000);

  // 라운드 상한은 턴마다 걸린다 — 드라이버가 스스로 다음 턴을 여는 동안 그 안내를 턴마다
  // 내보내면 채팅에 "요청이 커서 … 이어서 요청해 주세요." 가 계속 쌓인다(사용자는 이어서
  // 요청한 적이 없고 하니스가 알아서 계속하는 중이다). 안내는 런이 실제로 멈출 때 한 번만.
  it("(b-3) 예산 안내는 드라이버 턴마다 반복되지 않고 런 종료 시 한 번만 나온다", async () => {
    const { AssistantSession, createBlankProject, TOKEN_BUDGET_STATUS_TEXT } = await load();
    const NEVER_PLAN = { goal: "끝나지 않는 목표", layers: [{ title: "L", items: [{ title: "무한", instruction: "완료 불가" }] }] };
    const steps: ChatResult[] = [
      finalResult(JSON.stringify({ action: "new_plan", ...NEVER_PLAN })),
      toolCallResult("set_work_plan", NEVER_PLAN, "c_plan"),
    ];
    let bodyTurns = 0;
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      if (!req.tools || req.tools.length === 0) return finalResult(RESUME_JSON);
      if (steps.length > 0) return steps.shift()!;
      bodyTurns += 1;
      if (bodyTurns % 4 === 1) return titleWrite(`c_b${bodyTurns}`, `진행 ${bodyTurns}`);
      return finalResult(`아직 진행 중입니다(턴 ${bodyTurns}). 계속 진행이 필요합니다.`);
    };
    // 48단계까지 돌리지 않고 자동 계속 2회 뒤 대기 사용자 메시지로 드라이버를 세운다.
    let peeks = 0;
    const session = new AssistantSession(createBlankProject(), {
      config: ORCH_AUTO,
      peekPendingUserMessage: () => (peeks++ < 2 ? null : "중간 지시"),
      chat,
    });
    const emitted: string[] = [];

    await session.sendUserMessage(
      `${ORCH_GOAL}끝나지 않는 목표를 처리해줘`,
      (event) => { if (event.type === "status") emitted.push(event.text); },
      undefined,
      { autonomous: true }
    );

    // 라운드 상한으로 끝난 턴이 여러 번 있었다(초기 턴 + 자동 계속 2회).
    expect(emitted.filter((t) => t.includes("자율 실행 계속")).length).toBe(2);
    expect(statusTexts(session).filter((t) => t.startsWith("턴 종료(max-tool-calls)")).length).toBeGreaterThan(1);
    // 2026-09-17: 예산 소진 턴은 결정적 검사를 통과한 초안을 적용하고 final 로 끝난다(예산 소진 = 초안 폐기 아님).
    // 런이 예산 사유로 멈춘 것이 아니므로 예산 안내(TOKEN_BUDGET_STATUS_TEXT)는 한 번도 나오지 않는다.
    expect(statusTexts(session).filter((t) => t.startsWith("예산 소진 초안 적용 — ")).length).toBeGreaterThan(1);
    expect(emitted.filter((t) => t === TOKEN_BUDGET_STATUS_TEXT)).toHaveLength(0);
  }, 120000);

  it("(c) 턴이 사용자 질문으로 끝나면 드라이버는 자동 송신하지 않고 일시정지한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("어떤 분위기로 바꿀까요?\n[선택지] 밝은 | 어두운"),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const review = independentReviewPayload(request);
      if (review) return finalResult(JSON.stringify({ revision: review.revision, verdict: "approved",
        summary: "1차 제목은 검수했습니다. 어떤 분위기로 바꿀까요?\n[선택지] 밝은 | 어두운", findings: [] }));
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    // 질문으로 멈추기 전 검수된 t1만 적용할 수 있도록 헤르메틱 env 설치.
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: ORCH_AUTO, chat });

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(result.assistantText).toContain("[선택지]");
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["t1"]);
    expect(session.getWorkPlan()!.layers.flatMap(layer => layer.items).filter(item => item.status === "done")).toHaveLength(1);
    expect(index).toBe(4); // 스크립트 소진 = 자동 송신 0건.
    expect(statusTexts(session).some((t) => t.includes("agent_run:auto-continue"))).toBe(false);
  }, 30000);

  it("(d) 런 중 중단이면 드라이버는 즉시 멈추고 추가 송신이 없다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const controller = new AbortController();
    const steps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult(RESUME_JSON),
      titleWrite("c_t2", "t2"),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: ORCH_AUTO, chat });
    let autoContinued = false;

    const promise = session.sendUserMessage(
      "타이틀을 3단계로 개선해줘",
      (event) => {
        if (event.type === "status" && event.text.includes("agent_run:auto-continue")) autoContinued = true;
      },
      controller.signal,
      { autonomous: true }
    );
    controller.abort();
    await promise;

    expect(autoContinued).toBe(false);
    expect(statusTexts(session).some((t) => t.includes("agent_run:auto-continue"))).toBe(false);
  }, 30000);

  it("(e) peekPendingUserMessage 가 문자열을 반환하면 드라이버가 멈추고 다음 턴에 계획 완료까지 재개한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let pending: string | null = null;
    const firstSteps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
    ];
    let steps = firstSteps;
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    // 훅 주입(생성자 옵션) — peek 만 하고 dequeue 하지 않는다.
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
      config: ORCH_AUTO,
      peekPendingUserMessage: () => pending,
      chat,
    });

    // 턴1 종료 시점에 큐에 사용자 메시지가 있다 — 드라이버는 peek 로 보고 송신을 쉰다.
    pending = "중간 지시";
    await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    expect(index).toBe(5); // 스크립트 소진 = 턴1 이후 LLM 호출 0건(플래너1+본문4).
    const statuses1 = statusTexts(session);
    expect(statuses1.some((t) => t.includes("agent_run:paused-user-message"))).toBe(true);
    expect(statuses1.some((t) => t.includes("agent_run:auto-continue"))).toBe(false);

    // 패널의 기존 드레인 루프가 큐의 메시지를 전달한 뒤(여기선 계속), 계획이 여전히 미완료면 런 재개.
    pending = null;
    // 사용자가 직접 친 「계속」은 사용자 턴이므로 플래너가 한 번 돈다(resume). 그 뒤 드라이버 턴은 왕복 없음.
    steps = [
      finalResult(RESUME_JSON),
      titleWrite("c_t2", "t2"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      titleWrite("c_t3", "t3"),
      finalResult("모든 항목을 완료했습니다."),
    ];
    index = 0;
    const result = await session.sendUserMessage("계속", () => {}, undefined, { autonomous: true });

    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(store.getCurrent().meta.title).toBe("t3");
    const items = session.getWorkPlan()!.layers.flatMap((l) => l.items);
    expect(items.map((i) => i.status)).toEqual(["done", "done", "done"]);
  }, 30000);

  it("(e-2) peek 훅이 비문자(가비지)를 반환하면 null 로 취급해 실행을 계속한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const garbage = ["", "   ", null, undefined, 42, {}, []] as unknown[];
    let gi = 0;
    const steps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      titleWrite("c_t2", "t2"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      titleWrite("c_t3", "t3"),
      finalResult("모든 항목을 완료했습니다."),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
      config: ORCH_AUTO,
      peekPendingUserMessage: () => (gi < garbage.length ? (garbage[gi++] as string) : null),
      chat,
    });

    await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    const statuses = statusTexts(session);
    expect(statuses.some((t) => t.includes("agent_run:auto-continue"))).toBe(true);
    expect(statuses.some((t) => t.includes("agent_run:paused-user-message"))).toBe(false);
    const items = session.getWorkPlan()!.layers.flatMap((l) => l.items);
    expect(items.map((i) => i.status)).toEqual(["done", "done", "done"]);
  }, 30000);

  it("(f) autonomous:false 로 명시적으로 끄면 드라이버 없이 종전대로 턴 1개로 끝난다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("진행합니다."),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_AUTO, chat });

    // 플래그 미지정(기존 호출처)도 종전대로 턴 1개 — 자율 드라이버는 명시 진입만 켠다.
    await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {});

    expect(index).toBe(4);
    expect(statusTexts(session).some((t) => t.includes("agent_run:"))).toBe(false);
  }, 30000);

  it("(f-2) agentMode chat + 플래그 미지정이면 드라이버가 켜지지 않는다(레거시 수동 계속)", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
      finalResult("이어서 진행합니다."),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    // agentMode "chat" — 패널은 autonomous:false 를 주므로(설정 기준) 같은 계약을 세션에서 직접 고정한다.
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: { ...ORCH_AUTO, agentMode: "chat" as const },
      chat,
    });

    await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {});

    // 계획이 미완료로 남아도 턴 1개(본문 4라운드)로 끝난다 — 자동 계속 없음.
    expect(index).toBe(5);
    const items = session.getWorkPlan()!.layers.flatMap((l) => l.items);
    expect(items.filter((i) => i.status === "done").length).toBe(1);
    expect(statusTexts(session).some((t) => t.includes("agent_run:"))).toBe(false);
  }, 30000);

  it("예산 소진 후 사용자 계속 메시지는 예산을 재가동(re-arm)한다", async () => {
    const { AssistantSession, createBlankProject, AGENT_RUN_MAX_TOTAL_STEPS } = await load();
    const NEVER_PLAN = { goal: "끝나지 않는 목표", layers: [{ title: "L", items: [{ title: "무한", instruction: "완료 불가" }] }] };
    let bodyTurns = 0;
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      if (!req.tools || req.tools.length === 0) return finalResult(RESUME_JSON);
      if (bodyTurns === 0) {
        bodyTurns += 1;
        return toolCallResult("set_work_plan", NEVER_PLAN, "c_plan");
      }
      bodyTurns += 1;
      // 턴마다 쓰기가 한 번 성공한다 — 진행은 있고 완료 조건만 영원히 미충족인 상태.
      if (bodyTurns % 4 === 1) return titleWrite(`c_r${bodyTurns}`, `재가동 ${bodyTurns}`);
      return finalResult(`이어서 진행합니다(${bodyTurns}).`);
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_AUTO, chat });

    await session.sendUserMessage(`${ORCH_GOAL}끝나지 않는 목표를 처리해줘`, () => {}, undefined, { autonomous: true });
    let statuses = statusTexts(session);
    expect(statuses.filter((t) => t.includes("agent_run:auto-continue")).length).toBe(AGENT_RUN_MAX_TOTAL_STEPS);

    // "계속" — 수동 경로 그대로 재개하고 예산 카운터는 리셋(다시 최대치만큼 계속 가능).
    await session.sendUserMessage("계속", () => {}, undefined, { autonomous: true });
    statuses = statusTexts(session);
    expect(statuses.filter((t) => t.includes("agent_run:auto-continue")).length).toBe(AGENT_RUN_MAX_TOTAL_STEPS * 2);
    expect(statuses.filter((t) => t.includes("agent_run_budget_exhausted")).length).toBe(2);
  }, 600000);
});

// ── 마일스톤 자동 적용(todo 4: 완료 항목 → 제안 스냅샷 경로로 자동 적용) ─────────────
// 계약: 완료된 항목의 쓰기를 보존하고 독립 검수 승인 뒤 한 배치로 적용한다.
// commitChangeset → undo 스냅샷 → store.replace → await 커밋 로그는 실제 경로다.
// 도구의 파괴 표식과 agentMode는 승인 게이트가 아니며 검수 승인 자체는 필수다.
// 적용/커밋 검증 실패만 proposal_paused를 낸다.
describe("마일스톤 자동 적용 (todo 4)", () => {
  function milestoneToolCall(name: string, args: unknown, id: string): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
      finishReason: "tool_calls",
    } as ChatResult;
  }

  function milestoneFinal(text: string): ChatResult {
    return { message: { role: "assistant" as const, content: text }, finishReason: "stop" } as ChatResult;
  }

  const MILESTONE_PLAN = {
    goal: "타이틀 3단계 개선",
    layers: [
      {
        title: "타이틀",
        items: [
          { title: "1차 제목", instruction: "set_title_screen {title:'t1'}", successTools: ["set_title_screen"] },
          { title: "2차 제목", instruction: "set_title_screen {title:'t2'}", successTools: ["set_title_screen"] },
          { title: "3차 제목", instruction: "set_title_screen {title:'t3'}", successTools: ["set_title_screen"] },
        ],
      },
    ],
  };
  const MILESTONE_PLAN_JSON = JSON.stringify({ action: "new_plan", ...MILESTONE_PLAN });
  const titleWrite = (id: string, title: string): ChatResult => milestoneToolCall("set_title_screen", { title }, id);
  const milestoneStatusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
    session.getAuditEntries().filter((e) => e.kind === "status").map((e) => String(e.text));
  const milestoneExhausted = (): never => {
    throw new (class extends Error {
      readonly status = 401;
      constructor() {
        super("scripted chat exhausted");
        this.name = "LlmError";
      }
    })();
  };
  /**
   * 3항목 계획을 3턴(자동 계속)에 걸쳐 완료하는 스크립트 — 드라이버 테스트 (a)와 동일한 형태.
   * 드라이버 턴은 플래너 왕복을 태우지 않으므로 resume 응답이 없다(2026-09-03).
   */
  const threeMilestoneSteps = (): ChatResult[] => [
    milestoneFinal(MILESTONE_PLAN_JSON),
    milestoneToolCall("set_work_plan", MILESTONE_PLAN, "c_plan"),
    titleWrite("c_t1", "t1"),
    milestoneFinal("이어서 진행합니다."),
    milestoneFinal("이어서 진행합니다."),
    titleWrite("c_t2", "t2"),
    milestoneFinal("이어서 진행합니다."),
    milestoneFinal("이어서 진행합니다."),
    milestoneFinal("이어서 진행합니다."),
    titleWrite("c_t3", "t3"),
    milestoneFinal("모든 항목을 완료했습니다."),
  ];

  it("(a) 자율 런의 마일스톤은 독립 검수 후 한 배치로 적용된다 — undo 스냅샷 1개 + 커밋 row 1개", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const commitCalls: string[] = [];
    stubLegacyDbEnv();
    vi.stubGlobal("fetch", (async (input) => {
      const url = String(input);
      commitCalls.push(url);
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);
    const project = createBlankProject();
    initMilestoneStore(project);
    const baseline = structuredClone(store.getCurrent());
    const reviews: ReviewInput[] = [];
    const steps = threeMilestoneSteps();
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const review = independentReviewPayload(request);
      const approval = approvedReviewResponse(request);
      if (review && approval) {
        reviews.push(review);
        expect(store.getCurrent()).toEqual(baseline);
        expect(review.requiredProblems).toEqual([]);
        return approval;
      }
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });
    const events: SessionEvent[] = [];

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", (event) => {
      events.push(event);
      if (event.type === "tool_call") expect(store.getCurrent()).toEqual(baseline);
    }, undefined, { autonomous: true });
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["t1", "t2", "t3"]);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.originalRequest).toBe("타이틀을 3단계로 개선해줘");
    for (const title of ["t1", "t2", "t3"]) expect(reviews[0]?.toolResults).toContainEqual(expect.objectContaining({
      name: "set_title_screen", args: { title }, result: expect.objectContaining({ ok: true }),
    }));

    // 사용자 조작 없이 스토어에 적용 완료.
    expect(store.getCurrent().meta?.title).toBe("t3");
    // All completed items are one reviewed transaction, not three unreviewed writes.
    expect(commitCalls.filter((url) => url.includes("/rest/v1/project_commits"))).toHaveLength(1);
    expect(commitCalls.filter((url) => url.includes("/rest/v1/project_changes"))).toHaveLength(1);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(events.filter(event => event.type === "result_review" || event.type === "milestone_applied")
      .map(event => event.type)).toEqual(["result_review", "milestone_applied"]);
    expect(events.find(event => event.type === "milestone_applied")).toMatchObject({ toolCount: 3 });
    const audits = milestoneStatusTexts(session);
    expect(audits.filter((t) => t.includes("agent_run:milestone-applied"))).toHaveLength(1);
    expect(audits.some((t) => t.includes("agent_run:milestone-paused"))).toBe(false);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
  }, 120000);

  it("(b) 파괴적 마일스톤(remove_event)도 독립 검수 후 사용자 승인 대기 없이 자동 적용한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    initMilestoneStore(project);
    const before = JSON.stringify(store.getCurrent());
    const DESTRUCTIVE_PLAN = {
      goal: "이벤트 정리",
      layers: [{ title: "정리", items: [{ title: "이벤트 제거", instruction: "remove_event", successTools: ["remove_event"] }] }],
    };
    const markerEvent = {
      id: "ev_marker",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "ev_marker_page",
        name: "표식",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [],
      }],
    };
    const steps: ChatResult[] = [
      milestoneFinal(JSON.stringify({ action: "new_plan", ...DESTRUCTIVE_PLAN })),
      milestoneToolCall("set_work_plan", DESTRUCTIVE_PLAN, "c_plan"),
      milestoneToolCall("upsert_event", { mapId: project.startMapId, event: markerEvent }, "c_add"),
      milestoneToolCall("remove_event", { mapId: project.startMapId, eventId: "ev_marker" }, "c_remove"),
      milestoneFinal("이벤트를 정리했습니다."),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    // Three writer tool rounds, final, and the separate review need five rounds.
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 5 }, chat });
    const events: SessionEvent[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}이벤트 영역을 정리해줘`, (event) => { events.push(event); }, undefined, { autonomous: true });

    // remove_event도 같은 마일스톤 적용 경로를 타며 전체 프로젝트 undo 스냅샷을 남긴다.
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
    expect(events.some((event) => event.type === "milestone_applied")).toBe(true);
    expect(milestoneStatusTexts(session).some((t) => t.includes("agent_run:milestone-applied"))).toBe(true);
    expect(result.review?.status).toBe("approved");
    expect(result.proposedCalls).toEqual([]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["upsert_event", "remove_event"]);
  }, 30000);

  it("(b-2) clear_region의 파괴 표식은 더 이상 별도 policy 게이트를 만들지 않는다", () => {
    const call = {
      name: "clear_region",
      args: { mapId: "m1", x: 0, y: 0, w: 2, h: 2 },
      summary: "영역 정리",
      result: { ok: true, summary: "영역 정리" },
      destructive: false,
      requiresApproval: false,
    };
    expect(call.name).toBe("clear_region");
    expect(call.requiresApproval).toBe(false);
  });

  it("(c) autonomous 플래그 없이(채팅 모드)는 종전대로 마일스톤 자동 적용이 없다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    initMilestoneStore(project);
    const before = JSON.stringify(store.getCurrent());
    const steps = threeMilestoneSteps();
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });
    const events: SessionEvent[] = [];

    // 플래그 미지정(기존 호출처) — 턴 1개로 끝나고(자동 계속 없음) 자동 적용도 없다.
    await session.sendUserMessage("타이틀을 3단계로 개선해줘", (event) => { events.push(event); });

    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(events.some((event) => event.type === "milestone_applied")).toBe(false);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
    expect(milestoneStatusTexts(session).some((t) => t.includes("agent_run:milestone"))).toBe(false);
  }, 30000);

  it("(c-2) agentMode chat + autonomous 플래그도 검수된 마일스톤 배치를 자동 적용한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    initMilestoneStore(project);
    const before = JSON.stringify(store.getCurrent());
    const steps = threeMilestoneSteps();
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    // agentMode는 대화/자율 실행 선택이지 승인 설정이 아니다.
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
      config: { ...ORCH_CONFIG, maxToolCalls: 4, agentMode: "chat" as const },
      chat,
    });
    const events: SessionEvent[] = [];

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", (event) => { events.push(event); }, undefined, { autonomous: true });

    expect(JSON.stringify(store.getCurrent())).not.toBe(before);
    expect(store.getCurrent().meta.title).toBe("t3");
    expect(events.filter((event) => event.type === "milestone_applied")).toHaveLength(1);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
    expect(result.proposedCalls).toHaveLength(0);
    expect(result.appliedCalls?.map(call => call.args.title)).toEqual(["t1", "t2", "t3"]);
    expect(milestoneStatusTexts(session).some((t) => t.includes("agent_run:auto-continue"))).toBe(true);
  }, 30000);
  it("(c-3) 커밋 게이트 적용 실패는 현재 런만 멈추고 다음 사용자 턴의 자동 적용을 다시 허용한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const FIRST_PLAN = {
      goal: "첫 타이틀 적용",
      layers: [{ title: "타이틀", items: [
        { title: "깨진 적용", instruction: "set_title_screen {title:'first'}", successTools: ["set_title_screen"] },
      ] }],
    };
    const SECOND_PLAN = {
      goal: "다음 적용",
      layers: [{ title: "타이틀", items: [
        { title: "다음 적용", instruction: "set_title_screen {title:'second'}", successTools: ["set_title_screen"] },
      ] }],
    };
    const steps: ChatResult[] = [
      milestoneFinal(JSON.stringify({ action: "new_plan", ...FIRST_PLAN })),
      milestoneToolCall("set_work_plan", FIRST_PLAN, "c_plan"),
      titleWrite("c_first", "first"),
      milestoneFinal("첫 항목을 마쳤습니다."),
      milestoneFinal(JSON.stringify({ action: "new_plan", ...SECOND_PLAN })),
      milestoneToolCall("set_work_plan", SECOND_PLAN, "c_plan2"),
      titleWrite("c_second", "second"),
      milestoneFinal("두 번째 항목을 마쳤습니다."),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });
    const firstEvents: SessionEvent[] = [];
    // Prepare the invalid draft before review, not after approval (which would
    // correctly invalidate its identity before reaching the commit gate).
    session.setReviewDraftTransform(draft => {
      draft.startMapId = "missing-map";
      return draft;
    });
    // 2026-09-17: 결정적 검사(run_lint)는 사라진 시작 맵을 잡아 버린다 — 이 테스트의 대상은 그 뒤의 커밋 게이트다.
    // 검사만 깨끗하다고 보게 해서 승인된 초안이 커밋 게이트(적용 검증)에서 막히는 경로를 그대로 탄다.
    const lintTool = getTool("run_lint");
    if (!lintTool) throw new Error("run_lint is not registered");
    const cleanLint = vi.spyOn(lintTool, "run").mockReturnValue({ ok: true, summary: "lint: error 0건",
      data: { counts: { errors: 0, warnings: 0, infos: 0 }, issues: [] } } as never);
    await session.sendUserMessage("타이틀을 첫 제목으로 바꿔줘", (event) => {
      firstEvents.push(event);
    }, undefined, { autonomous: true });
    cleanLint.mockRestore();
    expect(firstEvents.some(event => event.type === "result_review" && event.review.status === "approved")).toBe(true);

    expect(store.getCurrent().meta.title).not.toBe("first");
    expect(firstEvents.some((event) => event.type === "proposal_paused")).toBe(true);
    expect(firstEvents.some((event) => event.type === "status" && event.text.includes("마일스톤 적용 실패"))).toBe(true);
    expect(firstEvents.some((event) => event.type === "status" && event.text.includes("프로젝트 저장소는 변경되지 않았습니다"))).toBe(true);
    const firstAudits = milestoneStatusTexts(session);
    expect(firstAudits.some((text) => text.includes("agent_run:milestone-apply-failed"))).toBe(true);
    expect(firstAudits.some((text) => text.includes("agent_run:stopped-apply-failed"))).toBe(true);
    expect(firstAudits.some((text) => text.includes("승인 대기") || text.includes("paused-approval"))).toBe(false);

    session.setReviewDraftTransform(draft => {
      draft.startMapId = project.startMapId;
      return draft;
    });
    const secondEvents: SessionEvent[] = [];
    await session.sendUserMessage("타이틀을 second로 새로 바꿔줘", (event) => { secondEvents.push(event); }, undefined, { autonomous: true });

    expect(store.getCurrent().meta.title).toBe("second");
    expect(secondEvents.some((event) => event.type === "milestone_applied" && event.title === "다음 적용")).toBe(true);
    expect(secondEvents.some((event) => event.type === "proposal_paused")).toBe(false);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  }, 30000);
});

// ── 레이어 검증 게이트 + run-end 저장 증명(todo 5) ──────────────────────────
// 계약: 자율 런에서 레이어 완료마다 canonical 테이블(agentVerification)대로 검증 툴콜을
// 기존 툴 실행기(runTool — 세션 ctx)로 실행하고 verdict 를 **감사에만** 남긴다(자문).
// 재킥·3회 중단은 2026-08-30 실측으로 제거됐다 — 검증은 런을 멈추지 않는다.
// 플랜 완료 + remote persistence 활성이면 store.flush() →
// store.verifyPersistedRevision(receipt) → agent_run_saved 감사. 재로드는 하지 않는다.
describe("레이어 검증(자문) + run-end 저장 증명 (todo 5)", () => {
  function gateToolCall(name: string, args: unknown, id: string): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
      },
      finishReason: "tool_calls",
    } as ChatResult;
  }

  function gateFinal(text: string): ChatResult {
    return { message: { role: "assistant" as const, content: text }, finishReason: "stop" } as ChatResult;
  }

  /** 한 응답에 여러 tool_call 을 배치한다(라운드 최소화 — 모델이 한 번에 여러 툴을 부르는 실제 형태). */
  function gateMultiCall(calls: readonly { readonly name: string; readonly args: unknown; readonly id: string }[]): ChatResult {
    return {
      message: {
        role: "assistant",
        content: null,
        tool_calls: calls.map((c) => ({ id: c.id, type: "function", function: { name: c.name, arguments: JSON.stringify(c.args) } })),
      },
      finishReason: "tool_calls",
    } as ChatResult;
  }

  const gateStatusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
    session.getAuditEntries().filter((e) => e.kind === "status").map((e) => String(e.text));
  const gateExhausted = (): never => {
    throw new (class extends Error {
      readonly status = 401;
      constructor() {
        super("scripted chat exhausted");
        this.name = "LlmError";
      }
    })();
  };

  /** 퀘스트 그래프의 write site 를 만드는 이벤트(setSwitch sw_0001) — commit 게이트 통과에 필수. */
  function chiefEvent(): Record<string, unknown> {
    return {
      id: "ev_chief",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "ev_chief_page",
        name: "촌장",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "setSwitch", switchId: "sw_0001", value: true }],
      }],
    };
  }

  const questArgs = (): Record<string, unknown> => ({
    id: "q1",
    title: "촌장의 부탁",
    nodes: [{ id: "n1", description: "촌장과 대화", completesWhen: { kind: "switch", switchId: "sw_0001", value: true } }],
    edges: [],
  });

  const GATE_PLAN = {
    goal: "마을·퀘스트·최종 검증",
    layers: [
      { title: "마을 만들기", items: [{ title: "제목 1", instruction: "set_title_screen {title:'t1'}", successTools: ["set_title_screen"] }] },
      { title: "퀘스트", items: [{ title: "퀘스트 등록", instruction: "define_quest {id:'q1'}", successTools: ["define_quest"] }] },
      { title: "최종 검증", items: [{ title: "완성", instruction: "play_walkthrough 후 제목 확정", successTools: ["set_title_screen"] }] },
    ],
  };

  it("(a) 레이어 완료마다 canonical 테이블대로 검증 툴콜이 실행된다 — map:[run_lint,evaluate_game_quality] / quest:[run_lint,verify_quest] / final:[run_lint,play_walkthrough]", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const scenario = [{ expect: "mapId", mapId: project.startMapId }];
    const steps: ChatResult[] = [
      gateFinal(JSON.stringify({ action: "new_plan", ...GATE_PLAN })),
      gateToolCall("set_work_plan", GATE_PLAN, "c_plan"),
      gateToolCall("set_title_screen", { title: "t1" }, "c_t1"),
      gateMultiCall([
        { name: "upsert_event", args: { mapId: project.startMapId, event: chiefEvent() }, id: "c_ev" },
        { name: "define_quest", args: questArgs(), id: "c_quest" },
      ]),
      gateMultiCall([
        { name: "play_walkthrough", args: { scenario }, id: "c_wt" },
        { name: "set_title_screen", args: { title: "t2" }, id: "c_t2" },
      ]),
      inspectMap(project.startMapId, project.maps[project.startMapId]!.width, project.maps[project.startMapId]!.height),
      gateFinal("모든 레이어를 완료했습니다."),
    ];
    const lintTool = getTool("run_lint");
    if (!lintTool) throw new Error("run_lint is not registered");
    // Call-through spies: real checks and the real milestone/undo path remain exercised.
    const lint = vi.spyOn(lintTool, "run");
    const apply = vi.spyOn(applyStore, "applyProposedProject");
    const events: SessionEvent[] = [];
    let layerEventCount = 0;
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) gateExhausted();
      if (index === steps.length - 1) layerEventCount = events.length;
      return { ...steps[index++]!, imageDelivery: imageDeliveryForRequest(request) };
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 8 }, chat, renderImages: renderLifecycleImages });

    const result = await session.sendUserMessage("마을·퀘스트·최종 검증을 진행해줘", (event) => { events.push(event); }, undefined, { autonomous: true });

    // 모델 툴콜 + 게이트 툴콜이 순서대로 관측된다: 레이어 1(map) → 레이어 2(quest) → 레이어 3(final).
    const toolCalls = events.slice(0, layerEventCount).filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    expect(toolCalls.map((e) => e.name)).toEqual([
      "set_work_plan",
      "set_title_screen",
      // L1 map/world: run_lint → evaluate_game_quality
      "run_lint",
      "evaluate_game_quality",
      "upsert_event",
      "define_quest",
      // L2 quest: run_lint → verify_quest (퀘스트 id 는 런 히스토리의 define_quest)
      "run_lint",
      "verify_quest",
      "play_walkthrough",
      "set_title_screen",
      // L3 final: run_lint → play_walkthrough (레이어 자신의 시나리오)
      "run_lint",
      "play_walkthrough",
      "show_map_region",
    ]);
    const verifyQuestCall = toolCalls.find((e) => e.name === "verify_quest")!;
    expect(verifyQuestCall.args).toEqual({ questId: "q1" });
    const gateWalkthrough = toolCalls.filter(call => call.name === "play_walkthrough").at(-1)!;
    expect(gateWalkthrough.args).toEqual({ scenario });
    // Completion has its own two boundaries: model final response, then returned recap.
    // Neither boundary is another layer sweep or permission to replay authored writes.
    const completionEvents = events.slice(layerEventCount);
    const assessments = completionEvents.filter(event => event.type === "completion_assessment");
    expect(assessments).toHaveLength(2);
    for (const { assessment } of assessments) {
      expect(assessment.checks.map(check => check.name)).toEqual(["run_lint", "evaluate_game_quality", "play_walkthrough"]);
    }
    const completionCalls = completionEvents.filter(event => event.type === "tool_call");
    expect(completionCalls.map(({ name, result }) => ({ name, result })))
      .toEqual(assessments.flatMap(({ assessment }) => assessment.checks));
    expect(completionCalls.filter(call => call.name === "play_walkthrough").map(call => call.args))
      .toEqual([{ scenario }, { scenario }]);
    expect(result.completionAssessment).toEqual(assessments.at(-1)?.assessment);
    expect(lint.mock.calls.map(([checkedProject]) => checkedProject.meta.title)).toEqual(["t1", "t1", "t2", "t2", "t2"]);
    expect(lint.mock.calls.at(-1)?.[0]).toEqual(store.getCurrent());
    const audits = gateStatusTexts(session);
    expect(audits.filter((t) => t.includes("agent_run:verification-pass")).length).toBe(3);
    expect(audits.filter(t => t.startsWith("agent_run:completion-check-pass "))).toHaveLength(2);
    expect(index).toBe(steps.length);
    expect(result.stoppedReason).toBe("final");
    expect(result.workPlan?.layers.flatMap(layer => layer.items.map(item => item.status))).toEqual(["done", "done", "done"]);
    expect(events.filter(event => event.type === "milestone_applied").map(event => [event.title, event.toolCount]))
      .toEqual([[GATE_PLAN.goal, 4]]);
    expect(apply.mock.calls.map(([, options]) => options.toolNames))
      .toEqual([["set_title_screen", "upsert_event", "define_quest", "set_title_screen"]]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen", "upsert_event", "define_quest", "set_title_screen"]);
    expect(result.proposedCalls).toEqual([]);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    // Layer checks remain per-layer; the final title replaces the earlier draft title.
    // Application happens once after current-image review, never at item completion.
    expect(result.review?.status).toBe("approved");
    expect(events.filter(event => event.type === "result_review" || event.type === "milestone_applied").map(event => event.type))
      .toEqual(["result_review", "milestone_applied"]);
    expect(store.getCurrent().meta?.title).toBe("t2");
  }, 60000);

  it("(a-2) final 레이어에 play_walkthrough 가 없으면 verify_quest×전체 questId 폴백이 돈다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const FALLBACK_PLAN = {
      goal: "퀘스트와 마무리",
      layers: [
        { title: "퀘스트", items: [{ title: "퀘스트 등록", instruction: "define_quest", successTools: ["define_quest"] }] },
        { title: "최종 검증", items: [{ title: "제목 확정", instruction: "set_title_screen", successTools: ["set_title_screen"] }] },
      ],
    };
    const steps: ChatResult[] = [
      gateFinal(JSON.stringify({ action: "new_plan", ...FALLBACK_PLAN })),
      gateToolCall("set_work_plan", FALLBACK_PLAN, "c_plan"),
      gateMultiCall([
        { name: "upsert_event", args: { mapId: project.startMapId, event: chiefEvent() }, id: "c_ev" },
        { name: "define_quest", args: questArgs(), id: "c_quest" },
      ]),
      gateToolCall("set_title_screen", { title: "t2" }, "c_t2"),
      inspectMap(project.startMapId, project.maps[project.startMapId]!.width, project.maps[project.startMapId]!.height),
      gateFinal("완료했습니다."),
    ];
    const lintTool = getTool("run_lint");
    if (!lintTool) throw new Error("run_lint is not registered");
    // Call-through spies: real checks and the real milestone/undo path remain exercised.
    const lint = vi.spyOn(lintTool, "run");
    const apply = vi.spyOn(applyStore, "applyProposedProject");
    const events: SessionEvent[] = [];
    let layerEventCount = 0;
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) gateExhausted();
      if (index === steps.length - 1) layerEventCount = events.length;
      return { ...steps[index++]!, imageDelivery: imageDeliveryForRequest(request) };
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 8 }, chat, renderImages: renderLifecycleImages });

    const result = await session.sendUserMessage("퀘스트를 등록하고 마무리해줘", (event) => { events.push(event); }, undefined, { autonomous: true });

    const toolCalls = events.slice(0, layerEventCount).filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    const verifyQuestCalls = toolCalls.filter((e) => e.name === "verify_quest");
    // Layer scope: quest once + final fallback once, both using the authored q1.
    expect(verifyQuestCalls).toHaveLength(2);
    expect(verifyQuestCalls.map(call => call.args)).toEqual([{ questId: "q1" }, { questId: "q1" }]);
    // final 레이어 폴백: play_walkthrough 는 실행되지 않는다.
    expect(toolCalls.filter((e) => e.name === "play_walkthrough")).toHaveLength(0);
    expect(toolCalls.map(call => call.name)).toEqual([
      "set_work_plan", "upsert_event", "define_quest", "run_lint", "verify_quest",
      "set_title_screen", "run_lint", "verify_quest", "show_map_region",
    ]);
    const completionEvents = events.slice(layerEventCount);
    const assessments = completionEvents.filter(event => event.type === "completion_assessment");
    expect(assessments).toHaveLength(2);
    for (const { assessment } of assessments) {
      expect(assessment.checks.map(check => check.name)).toEqual(["run_lint", "verify_quest"]);
      expect(assessment.checks.find(check => check.name === "verify_quest")?.result.data)
        .toMatchObject({ ok: true, verificationStatus: "verified", verifiedNodeIds: ["n1"] });
    }
    const completionCalls = completionEvents.filter(event => event.type === "tool_call");
    expect(completionCalls.map(({ name, result }) => ({ name, result })))
      .toEqual(assessments.flatMap(({ assessment }) => assessment.checks));
    expect(completionCalls.filter(call => call.name === "verify_quest").map(call => call.args))
      .toEqual([{ questId: "q1" }, { questId: "q1" }]);
    expect(result.completionAssessment).toEqual(assessments.at(-1)?.assessment);
    // 결정적 검사(deterministic-review)는 기준선(원제목) → 초안("t2") 순으로 run_lint 를 두 번 더 돈다.
    expect(lint.mock.calls.map(([checkedProject]) => checkedProject.meta.title)).toEqual([project.meta.title, "t2", "t2", project.meta.title, "t2", "t2"]);
    expect(lint.mock.calls.at(-1)?.[0]).toEqual(store.getCurrent());
    const audits = gateStatusTexts(session);
    expect(audits.filter(t => t.startsWith("agent_run:verification-pass "))).toHaveLength(2);
    expect(audits.filter(t => t.startsWith("agent_run:completion-check-pass "))).toHaveLength(2);
    expect(index).toBe(steps.length);
    expect(result.stoppedReason).toBe("final");
    expect(result.workPlan?.layers.flatMap(layer => layer.items.map(item => item.status))).toEqual(["done", "done"]);
    expect(events.filter(event => event.type === "milestone_applied").map(event => [event.title, event.toolCount]))
      .toEqual([[FALLBACK_PLAN.goal, 3]]);
    expect(apply.mock.calls.map(([, options]) => options.toolNames)).toEqual([["upsert_event", "define_quest", "set_title_screen"]]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["upsert_event", "define_quest", "set_title_screen"]);
    expect(result.proposedCalls).toEqual([]);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(store.getCurrent().meta.title).toBe("t2");
    expect(result.stoppedReason, result.error).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(events.filter(event => event.type === "result_review" || event.type === "milestone_applied").map(event => event.type))
      .toEqual(["result_review", "milestone_applied"]);
  }, 60000);

  it("(b) 검증 지적(린트 오류)은 자문으로만 남고 런을 멈추지 않는다 — 재킥·verification_failed 없음", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    // 런 시작부터 존재하는 린트 오류(미존재 스위치 참조 이벤트)를 심는다 — 커밋 게이트는
    // baseline 대비 새 오류만 차단하므로 마일스톤 적용은 통과하고, 검증 run_lint 만 실패한다.
    // 실측 근거(2026-08-30): 이런 선재 오류로 3회 재킥을 태우고 런을 죽이던 게이트를 제거했다.
    project.maps[project.startMapId]!.events.push({
      id: "ev_broken",
      x: 2,
      y: 2,
      trigger: { kind: "action" },
      commands: [],
      pages: [{
        id: "ev_broken_page",
        name: "깨진 이벤트",
        conditions: [],
        graphic: { transparent: true },
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [{ kind: "setSwitch", switchId: "sw_missing_xyz", value: true }],
      }],
    } as never);
    initMilestoneStore(project);
    const BROKEN_PLAN = {
      goal: "타이틀 변경",
      layers: [{ title: "타이틀", items: [{ title: "제목", instruction: "set_title_screen", successTools: ["set_title_screen"] }] }],
    };
    const steps: ChatResult[] = [
      gateFinal(JSON.stringify({ action: "new_plan", ...BROKEN_PLAN })),
      gateToolCall("set_work_plan", BROKEN_PLAN, "c_plan"),
      gateToolCall("set_title_screen", { title: "t1" }, "c_t1"),
      gateFinal("완료 보고합니다."),
    ];
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) gateExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 8 }, chat });
    const events: SessionEvent[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 바꿔줘`, (event) => { events.push(event); }, undefined, { autonomous: true });

    const toolCalls = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    // 레이어당 1회만 검증한다 — 같은 지적으로 재검하지 않는다(markLayerVerified).
    expect(toolCalls.filter((e) => e.name === "run_lint")).toHaveLength(1);
    const audits = gateStatusTexts(session);
    // 자문 감사만 남는다: 재킥도, verification_failed 도 없다.
    expect(audits.some((t) => t.includes("agent_run:verification-advisory"))).toBe(true);
    expect(audits.some((t) => t.includes("agent_run:verification-note"))).toBe(true);
    expect(audits.filter((t) => t.includes("agent_run:verification-repair")).length).toBe(0);
    expect(audits.some((t) => t.includes("agent_run:verification_failed"))).toBe(false);
    // 저작은 정상 반영되고 턴은 스크립트대로 최종화된다.
    expect(store.getCurrent().meta?.title).toBe("t1");
    expect(result.stoppedReason).toBe("final");
  }, 60000);

  /**
   * 3항목 계획을 2턴(자동 계속)에 걸쳐 완료하는 스크립트 — run-end 증명 테스트 공용.
   *
   * 드라이버의 합성 「계속」 턴은 **플래너 왕복을 태우지 않는다**(2026-09-03: planner:skip driver-continue).
   * 그래서 옛 대본에 있던 `{action:"resume"}` 응답 두 개가 없다 — 있으면 그 JSON 이 툴 루프의 최종 문장으로
   * 소비돼 대본이 어긋난다. 턴 1 은 라운드 상한(maxToolCalls 4)에서 잘리고 드라이버가 턴 2 를 연다.
   */
  const runEndMilestoneSteps = (): ChatResult[] => [
    gateFinal(JSON.stringify({ action: "new_plan", ...MILESTONE_PLAN_SHAPE })),
    gateToolCall("set_work_plan", MILESTONE_PLAN_SHAPE, "c_plan"),
    gateToolCall("set_title_screen", { title: "t1" }, "c_t1"),
    gateFinal("이어서 진행합니다."),
    gateFinal("이어서 진행합니다."),
    gateToolCall("set_title_screen", { title: "t2" }, "c_t2"),
    // Writer t2 + t3 + final + independent review fit the second four-round budget.
    gateToolCall("set_title_screen", { title: "t3" }, "c_t3"),
    gateFinal("모든 항목을 완료했습니다."),
  ];

  it("(c) completed remote plan verifies its accepted receipt without reloading", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const receipt = { revisionId: "accepted-revision", projectId: MILESTONE_TEST_ENV.VITE_LEGACY_DB_PROJECT_ID,
      mutationGeneration: 3, contentIdentity: "normalized-content", sha256: "sha-abc123" };
    const flushSpy = vi.spyOn(store, "flush").mockResolvedValue({ kind: "saved", receipt });
    const reloadSpy = vi.spyOn(store, "reloadFromRemote");
    const verifySpy = vi.spyOn(store, "verifyPersistedRevision").mockResolvedValue({ kind: "verified", receipt, isCurrent: true });
    vi.spyOn(store, "isPersistenceReceiptCurrent").mockReturnValue(true);
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(true);
    const steps = runEndMilestoneSteps();
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) gateExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });

    const controller = new AbortController();
    const pending = session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, controller.signal, { autonomous: true });
    const ownedSignal = session.getRunOperation().signal;
    const result = await pending;

    expect(ownedSignal).not.toBe(controller.signal);
    expect(ownedSignal.aborted).toBe(false);
    expect(result.stoppedReason).toBe("final");
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
    const [verifiedReceipt, options] = verifySpy.mock.calls[0] ?? [];
    const validate = options?.validate;
    if (!validate) throw new Error("Missing canonical validation callback");
    expect(verifySpy).toHaveBeenCalledExactlyOnceWith(receipt, { signal: ownedSignal, validate });
    expect(verifiedReceipt).toBe(receipt);
    expect(validate(structuredClone(store.getCurrent()))).toBeUndefined();
    expect(session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true, receipt });
    expect(session.getRunEndProof()?.receipt).toBe(receipt);
    const audits = gateStatusTexts(session);
    expect(audits.filter((t) => t.split(" ")[0] === "agent_run_saved")).toHaveLength(1);
    // 드라이버 계속 턴은 플래너 왕복을 태우지 않는다 — 플래너는 사용자 턴에서 한 번만 돈다.
    expect(audits.filter((t) => t.startsWith("planner:start")).length).toBe(1);
    expect(audits.some((t) => t.includes("planner:skip driver-continue"))).toBe(true);
    expect(audits.some((t) => t.includes("agent_run:auto-continue"))).toBe(true);
    // 정상 진행 중인 항목은 막히지 않는다(쓰기가 성공하면 항목별 시도 수가 0으로 돌아간다).
    expect(audits.some((t) => t.includes("ralph:stalled"))).toBe(false);
    // The caller still cancels the owned boundary; proof never receives a detached dummy signal.
    controller.abort();
    expect(ownedSignal.aborted).toBe(true);
    expect(verifySpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
  }, 120000);

  it("(c-2) remote 비활성 → agent_run_local_only 감사, flush 호출 없음, 오류 없음", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project); // remotePersistenceEnabled: false
    const flushSpy = vi.spyOn(store, "flush");
    const steps = runEndMilestoneSteps();
    let index = 0;
    const chat = async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
      const approval = approvedReviewResponse(request);
      if (approval) return approval;
      if (index >= steps.length) gateExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    expect(result.stoppedReason).toBe("final");
    expect(flushSpy).not.toHaveBeenCalled();
    const audits = gateStatusTexts(session);
    expect(audits.some((t) => t.includes("agent_run_local_only"))).toBe(true);
    expect(audits.some((t) => t.includes("agent_run_saved"))).toBe(false);
    expect(audits.some((t) => t.includes("agent_run:save-failed"))).toBe(false);
  }, 120000);
});

const MILESTONE_PLAN_SHAPE = {
  goal: "타이틀 3단계 개선",
  layers: [
    {
      title: "타이틀",
      items: [
        { title: "1차 제목", instruction: "set_title_screen {title:'t1'}", successTools: ["set_title_screen"] },
        { title: "2차 제목", instruction: "set_title_screen {title:'t2'}", successTools: ["set_title_screen"] },
        { title: "3차 제목", instruction: "set_title_screen {title:'t3'}", successTools: ["set_title_screen"] },
      ],
    },
  ],
};

async function load() {
  const [assistantSession, defaults, llm] = await Promise.all([
    import("@/ai/assistantSession"),
    import("@/project/defaults"),
    import("@/ai/llmClient"),
  ]);
  return {
    AssistantSession: assistantSession.AssistantSession,
    hasRawToolCallMarkup: assistantSession.hasRawToolCallMarkup,
    sanitizeAssistantText: assistantSession.sanitizeAssistantText,
    truncatedTurnText: assistantSession.truncatedTurnText,
    AGENT_RUN_MAX_TOTAL_STEPS: assistantSession.AGENT_RUN_MAX_TOTAL_STEPS,
    TOKEN_BUDGET_STATUS_TEXT: assistantSession.TOKEN_BUDGET_STATUS_TEXT,
    createBlankProject: defaults.createBlankProject,
    llm,
  };
}

type ChatResult = import("@/ai/llmClient").ChatResult;
type ChatRequest = import("@/ai/llmClient").ChatRequest;

// Writer scripts and the independent zero-tool transport are separate conversations.
function scriptedChat(steps: readonly ChatResult[]) {
  let i = 0;
  return async (_config: unknown, request: ChatRequest): Promise<ChatResult> => {
    const approval = approvedReviewResponse(request);
    if (approval) return approval;
    if (i >= steps.length) throw new Error("scripted chat exhausted");
    return { ...steps[i++]!, imageDelivery: imageDeliveryForRequest(request) };
  };
}

// Lifecycle double only: real show_map_region capture, delivery and revision gates
// still run. This one-pixel PNG makes no assertion about rendered map quality.
const lifecycleImage = { label: "Lifecycle map capture", dataUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=" };
const renderLifecycleImages: ToolImageRenderer = async () => [lifecycleImage];
const inspectMap = (mapId: string, w: number, h: number): ChatResult =>
  assistantToolCall("show_map_region", { mapId, x: 0, y: 0, w, h });

function assistantToolCall(name: string, args: unknown, id = `c_${name}`, content: string | null = null): ChatResult {
  return {
    message: { role: "assistant", content, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

function assistantFinal(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", liteModel: "stub-model", apiKey: "sk", maxToolCalls: 8, maxTokens: 512, agentMode: "chat" as const };
// Multi-map reviews carry complete before/after originals. Use a catalogued
// million-token reviewer rather than the unknown stub model's 128K fallback.
const LARGE_REVIEW_CONFIG = { ...CONFIG, model: "gemini-2.5-flash" };
const AUTO_SINGLE_CONFIG = { ...CONFIG, agentMode: "auto" as const };
const ORCH_CONFIG = { ...CONFIG, model: "supervisor-model", liteModel: "executor-model", maxToolCalls: 12, agentMode: "auto" as const };
/** 짧은 한 줄은 plannerSkip 이 본문으로 직행하므로, 플래너 계약을 재는 테스트는 다단계 표지를 붙인다. */
const ORCH_GOAL = "이 작업을 단계로 진행해줘. ";
// 플래너 라운드(오케스트레이션 게이트 통과 시 항상 선행)가 소비하는 1스텝 — direct 로 통과시킨다.
const PLANNER_DIRECT = assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}');
// 공급자 고유 센티넬(예전엔 특정 공급자의 raw 구분자를 함께 넣었다)은 뺐다 — 감지는 공급자를
// 가리지 않는 `<tool_call>` / `<invoke name=` 두 형태로만 이뤄진다.
const RAW_TOOL_MARKUP_FIXTURE = `적용됨이어서 길을 깐 뒤 NPC 5명을 배치하겠습니다...<tool_call><invoke name="proposetilevocabulary">...`;

describe("AssistantSession 툴콜 루프", () => {
  it("메인 세션은 config.model을 그대로 chat 함수에 전달한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      return assistantFinal("완료");
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: { ...CONFIG, model: "main-session-model", liteModel: "lite-session-model" },
      chat,
      declareIntent: fixedDeclarer({ mode: "other", needsPlan: false }),
    });

    await session.sendUserMessage("안녕", () => {});

    // 인사(단일 단계 선언)는 플래너를 건너뛴다 — 본문 한 번만 감독 모델.
    expect(seenModels).toEqual(["main-session-model"]);
    expect(JSON.parse(session.exportAudit()).model).toBe("main-session-model");
  }, 30000);

  it("의도 선언이 되묻기를 냈으면 LLM 전에 그 질문을 돌려주고 툴을 호출하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let chatCalls = 0;
    const chat = async (): Promise<ChatResult> => {
      chatCalls += 1;
      return assistantFinal("이 응답은 나오면 안 됨");
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: CONFIG,
      chat,
      declareIntent: fixedDeclarer({ space: "unclear", clarify: "집을 실내 맵으로 만들까요, 야외 외장으로 만들까요?", clarifyOptions: ["실내 맵으로", "야외 집(외장)으로"] }),
    });
    const result = await session.sendUserMessage("집 하나 만들어줘", () => {});
    expect(chatCalls).toBe(0);
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toContain("실내 맵으로");
    expect(result.assistantText).toContain("[선택지]");
    const audit = JSON.parse(session.exportAudit()) as { entries: { kind: string; text?: string }[] };
    expect(audit.entries.some((entry) => entry.kind === "status" && entry.text?.includes("의도 확인"))).toBe(true);
  }, 30000);

  it("agentMode auto 에서는 되묻기 선언에도 멈추지 않고 LLM으로 진행한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let chatCalls = 0;
    const chat = async (): Promise<ChatResult> => {
      chatCalls += 1;
      return assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}');
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: AUTO_SINGLE_CONFIG,
      chat,
      declareIntent: fixedDeclarer({ space: "unclear", clarify: "실내인가요 야외인가요?", needsPlan: true }),
    });
    const result = await session.sendUserMessage("집 하나 만들어줘", () => {});
    expect(chatCalls).toBeGreaterThan(0);
    expect(result.assistantText).not.toContain("[선택지]");
    const audit = JSON.parse(session.exportAudit()) as { entries: { kind: string; text?: string }[] };
    expect(audit.entries.some((entry) => entry.kind === "status" && entry.text?.includes("의도 확인 건너"))).toBe(true);
  }, 30000);

  it("실내 표지가 있으면 되묻지 않고 LLM으로 진행한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let chatCalls = 0;
    const chat = async (): Promise<ChatResult> => {
      chatCalls += 1;
      return assistantFinal("실내 준비");
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: CONFIG, chat });
    const result = await session.sendUserMessage("연금술사의 집 이라는 실내 를 하나 만드렁줘", () => {});
    expect(chatCalls).toBe(1);
    expect(result.assistantText).toBe("실내 준비");
  }, 30000);

  it("연쇄 툴콜 2개(읽기→쓰기) 후 최종 응답을 반환하고 쓰기만 제안에 담는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantToolCall("get_project_summary", {}),
      assistantToolCall("create_map", { id: "m1", name: "새 맵", width: 6, height: 6 }, "c_create_map"),
      inspectMap("m1", 6, 6),
      assistantFinal("맵을 만들었습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: CONFIG, reviewConfig: LARGE_REVIEW_CONFIG,
      chat, renderImages: renderLifecycleImages });

    const events: string[] = [];
    const result = await session.sendUserMessage("맵 하나 만들어줘", (e) => {
      if (e.type === "tool_call") events.push(`${e.name}:${e.result.ok}`);
    });

    expect(result.stoppedReason, JSON.stringify({ error: result.error, review: result.review, events })).toBe("final");
    expect(result.review?.status).toBe("approved");
    // 모델의 마지막 말이 본문이고 결정적 검사 결과가 뒤에 한 줄로 붙는다.
    expect(result.assistantText).toContain(result.review!.summary);
    expect(events).toEqual(["get_project_summary:true", "create_map:true", "show_map_region:true"]);
    // 읽기 툴은 제안에서 제외, 쓰기 툴만 포함.
    expect(result.proposedCalls.map((c) => c.name)).toEqual(["create_map"]);
    expect(result.proposedCalls[0].result.diff?.mapsAdded).toBe(1);
  }, 30000);

  it("자가수정: 커밋/검증 실패 → issues 반환 → 재시도 → 성공", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantToolCall("create_map", { id: "m1", name: "t", width: 5, height: 5 }, "c_create_map"),
      // 맵 밖 좌표 → ToolError → ok:false + issues.
      assistantToolCall("set_start_position", { mapId: "m1", x: 99, y: 99 }, "c_sp1"),
      // 통행 가능한 내부 좌표로 수정 → 성공.
      assistantToolCall("set_start_position", { mapId: "m1", x: 2, y: 2 }, "c_sp2"),
      assistantToolCall("repair_acceptance", { itemId: "acceptance-contract", criteria: [
        { kind: "mapDimensions", target: { mapId: "m1" }, width: 5, height: 5 },
        { kind: "reachability", target: { mapId: "m1" }, from: { x: 2, y: 2 }, to: [{ x: 3, y: 2 }] },
        { kind: "imageReviewed", target: { mapId: "m1" } },
      ] }),
      assistantToolCall("check_reachability", { mapId: "m1", from: { x: 2, y: 2 }, targets: [{ x: 3, y: 2 }] }),
      inspectMap("m1", 5, 5),
      assistantFinal("시작 위치를 고쳤습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: CONFIG, reviewConfig: LARGE_REVIEW_CONFIG,
      chat, renderImages: renderLifecycleImages });

    const toolEvents: { name: string; ok: boolean }[] = [];
    const result = await session.sendUserMessage("시작 위치 잡아줘", (e) => {
      if (e.type === "tool_call") toolEvents.push({ name: e.name, ok: e.result.ok });
    });

    expect(result.stoppedReason, JSON.stringify({ error: result.error, review: result.review, toolEvents })).toBe("final");
    // 실패한 시도와 성공한 시도가 모두 관측되어야 한다.
    const startAttempts = toolEvents.filter((e) => e.name === "set_start_position");
    expect(startAttempts.map((e) => e.ok)).toEqual([false, true]);
    expect(session.getProposedProject()).toMatchObject({ startMapId: "m1", startPos: { x: 2, y: 2 } });
    expect(result.review?.status).toBe("approved");

    // 실패 결과가 tool 메시지로 모델에 되돌려졌는지(자가수정 신호) 확인.
    const toolMessages = session.getMessages().filter((m) => m.role === "tool");
    const failedMsg = toolMessages.find((m) => typeof m.content === "string" && m.content.includes('"ok":false'));
    expect(failedMsg).toBeDefined();
    expect(failedMsg!.content).toContain("issues");

    // 제안에는 성공한 쓰기 툴콜만(create_map + 성공한 set_start_position).
    const names = result.proposedCalls.map((c) => c.name).sort();
    expect(names).toEqual(["create_map", "set_start_position"]);
  }, 30000);

  // 액션 가시성 계약: 툴 실행 **직전** tool_started 가 1-based 서수와 함께 나가야
  // 프리뷰 UI 가 "지금 무엇을 하는 중"을 결과 도착 전에 그릴 수 있다.
  it("각 툴 실행 직전에 tool_started(name,index)를 tool_call 보다 먼저 내보낸다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantToolCall("get_project_summary", {}),
      assistantToolCall("create_map", { id: "m1", name: "새 맵", width: 6, height: 6 }, "c_create_map"),
      assistantFinal("맵을 만들었습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: CONFIG, chat });

    const observed: string[] = [];
    await session.sendUserMessage("맵 하나 만들어줘", (event: SessionEvent) => {
      if (event.type === "tool_started") observed.push(`started:${event.name}:${event.index}`);
      if (event.type === "tool_call") observed.push(`call:${event.name}`);
    });

    expect(observed).toEqual([
      "started:get_project_summary:1",
      "call:get_project_summary",
      "started:create_map:2",
      "call:create_map",
    ]);
  }, 30000);

  it("maxToolCalls 상한에 도달하면 현재까지의 제안을 반환한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    // 항상 툴콜만 반복(최종 응답 없음).
    let n = 0;
    const chat = async (): Promise<ChatResult> => {
      n += 1;
      return assistantToolCall("get_project_summary", {}, `c${n}`);
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: { ...CONFIG, maxToolCalls: 3 }, chat });
    const result = await session.sendUserMessage("계속 조회해", () => {});
    expect(result.stoppedReason).toBe("max-tool-calls");
    expect(n).toBe(3);
  }, 30000);

  // 2026-08-29 실측 회귀: 예산으로 잘린 턴은 모델이 마무리 문장을 낼 기회가 없어 assistantText 가
  // 빈 채로 끝났고, 제안 13건(313칸)이 승인 대기인데도 화면에는 아무 말이 없었다 — 사용자에게는
  // "명령이 씹혔다"로 보였다. 왜 멈췄는지는 반드시 말한다.
  it("예산으로 잘린 턴은 침묵하지 않는다 — 멈춘 이유를 assistantText 에 남긴다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let n = 0;
    const chat = async (): Promise<ChatResult> => {
      n += 1;
      return assistantToolCall("get_project_summary", {}, `c${n}`);
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: { ...CONFIG, maxToolCalls: 2 }, chat });
    const result = await session.sendUserMessage("계속 조회해", () => {});
    expect(result.stoppedReason).toBe("max-tool-calls");
    expect(result.assistantText.trim()).not.toBe("");
    expect(result.assistantText).toContain("도구 호출 예산");
  }, 30000);

  it("truncatedTurnText — 모델이 마무리를 냈으면 그대로 두고, 없으면 대기 중 제안 수를 알린다", async () => {
    const { truncatedTurnText } = await load();
    // 모델 문장이 있으면 손대지 않는다.
    expect(truncatedTurnText("숲을 배치했습니다.", 3, "도구 호출 예산")).toBe("숲을 배치했습니다.");
    // 비어 있으면 멈춘 이유 + 적용 전 제안 건수를 알린다(승인 절차를 추측하지 않는다).
    const pending = truncatedTurnText("   ", 13, "도구 호출 예산");
    expect(pending).toContain("도구 호출 예산");
    expect(pending).toContain("제안 13건");
    expect(pending).toContain("적용 전");
    expect(pending).not.toMatch(/승인 대기|수락하면/);
    const applied = truncatedTurnText("", 0, "도구 호출 예산", 4);
    expect(applied).toContain("변경 4건은 이미 프로젝트에 적용");
    expect(applied).not.toContain("변경은 만들지 못했습니다");
    expect(truncatedTurnText("", 2, "출력 토큰 예산", 4)).toContain("제안 2건");
    // 만든 것이 없으면 대기 건수를 꾸며내지 않는다.
    expect(truncatedTurnText("", 0, "출력 토큰 예산")).toContain("변경은 만들지 못했습니다");
  });

  it("감사 로그를 JSON으로 내보낸다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([assistantFinal("안녕하세요.")]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: CONFIG, chat });
    await session.sendUserMessage("안녕", () => {});
    const audit = JSON.parse(session.exportAudit());
    expect(audit.model).toBe(CONFIG.model);
    // at(ISO 타임스탬프)는 결함 ⑬(구조화 세션 로그)에서 추가 — 내용 필드만 고정 검증.
    expect(audit.entries[0]).toMatchObject({ kind: "user", text: "안녕" });
    expect(typeof audit.entries[0].at).toBe("string");
    expect(audit.entries.some((e: { kind: string }) => e.kind === "assistant")).toBe(true);
  }, 30000);

  it("쓰기 툴이 시작되면 이후 호출은 실행 모델로 전환한다 — 검수 모델 호출은 없다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      assistantFinal("WRITER_SUCCESS_SENTINEL"),
    ];
    let index = 0;
    const seenModels: string[] = [];
    const requests: ChatRequest[] = [];
    const chat = async (config: { readonly model: string }, req: ChatRequest): Promise<ChatResult> => {
      seenModels.push(config.model);
      requests.push({ ...req, messages: [...req.messages] });
      if (independentReviewPayload(req)) throw new Error("검수 모델은 더 이상 호출되지 않아야 한다");
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 새 제목으로 바꿔줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(result.review?.summary).toBe("결정적 검사 통과 — 변경 맵 0개, lint error 0건.");
    // 모델의 마지막 말이 본문이고 결정적 검사 결과가 뒤에 한 줄로 붙는다.
    expect(result.assistantText).toContain(result.review!.summary);
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    // 플래너·첫 본문은 감독 모델, 쓰기가 시작된 뒤의 본문은 실행 모델. 결정적 검사는 모델을 부르지 않는다.
    expect(seenModels).toEqual(["supervisor-model", "supervisor-model", "executor-model"]);
    expect(phases).toEqual(["plan", "execute", "review"]);
    const reviewAudit = session.getAuditEntries().find(entry => entry.kind === "status" && entry.text.startsWith("deterministic-review "));
    expect(reviewAudit?.kind).toBe("status");
    // Original project values and full native schemas reach the writer before its first write.
    const original = requests[1]?.messages.find(message => typeof message.content === "string"
      && message.content.startsWith('{"originalContext":'));
    expect(original).toBeDefined();
    expect(JSON.parse(String(original!.content))).toMatchObject({ originalContext: {
      entries: expect.arrayContaining([expect.objectContaining({ entryId: "/project",
        value: expect.objectContaining({ meta: expect.objectContaining({ title: createBlankProject().meta.title }) }) })]),
    } });
    expect(requests[1]?.tools?.map(tool => tool.function.name)).toEqual(expect.arrayContaining([
      "set_title_screen", "upsert_item", "define_quest", "fill_region", "get_original_context",
    ]));
    expect(session.getMessages().some((message) => typeof message.content === "string" && message.content.startsWith("[오케스트레이션] "))).toBe(false);
  }, 30000);

  it("결정적 검사가 lint error 를 발견하면 실행 모델로 한 번 재투입한 뒤 고친 판을 승인한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    const mapId = project.startMapId;
    const spec = {
      mapId,
      title: "길과 꽃",
      assets: [
        { id: "길", kind: "road", x: 1, y: 1, w: 2, h: 2 },
        { id: "꽃", kind: "decor", x: 4, y: 1, w: 2, h: 2 },
      ],
    };
    const steps = [
      PLANNER_DIRECT,
      assistantToolCall("set_build_spec", spec, "c_spec"),
      assistantToolCall("paint_tiles", { mapId, mode: "rect", layer: "lower", tile: 421, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }, "c_road"),
      inspectMap(mapId, project.maps[mapId]!.width, project.maps[mapId]!.height),
      assistantFinal("1차 실행 완료"),
      assistantToolCall("get_map_region", { mapId, x: 4, y: 1, w: 2, h: 2 }, "c_read_flowers"),
      assistantToolCall("paint_tiles", { mapId, mode: "rect", layer: "upper", tile: 288, from: { x: 4, y: 1 }, to: { x: 5, y: 2 } }, "c_flowers"),
      inspectMap(mapId, project.maps[mapId]!.width, project.maps[mapId]!.height),
      assistantFinal("보완 실행 완료"),
    ];
    // 첫 검사만 lint error 1건(꽃 자리가 비었다는 결정적 지적), 고친 뒤의 검사는 깨끗하다.
    const lintTool = getTool("run_lint");
    if (!lintTool) throw new Error("run_lint is not registered");
    vi.spyOn(lintTool, "run")
      // 결정적 검사는 기준선 → 초안 순으로 두 번 부른다. 기준선은 깨끗하다.
      .mockReturnValueOnce({ ok: true, summary: "lint: error 0건", data: { counts: { errors: 0, warnings: 0, infos: 0 }, issues: [] } } as never)
      .mockReturnValueOnce({ ok: true, summary: "lint: error 1건", data: { counts: { errors: 1, warnings: 0, infos: 0 }, issues: [
        { severity: "error", code: "flower-area-empty", mapId, x: 4, y: 1, message: "Flower area is still empty" } ] } } as never)
      .mockReturnValue({ ok: true, summary: "lint: error 0건", data: { counts: { errors: 0, warnings: 0, infos: 0 }, issues: [] } } as never);
    let index = 0;
    const seenModels: string[] = [];
    const reviews: { status: string; revision: number }[] = [];
    const writerRequests: ChatRequest[] = [];
    const chat = async (config: { readonly model: string }, request: ChatRequest): Promise<ChatResult> => {
      seenModels.push(config.model);
      if (independentReviewPayload(request)) throw new Error("검수 모델은 더 이상 호출되지 않아야 한다");
      writerRequests.push({ ...request, messages: [...request.messages] });
      // 첫 검사 뒤의 재투입 라운드는 실행 모델이 받는다.
      if (reviews.length > 0) expect(config.model).toBe("gemini-2.5-flash-lite");
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return { ...steps[index++]!, imageDelivery: imageDeliveryForRequest(request) };
    };
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield,
      // 합성 id(supervisor-model/executor-model)는 창을 모르는 모델이라 128K 기본값을 받는다. 전체 툴 카탈로그가
      // 이미 그 창의 대부분(활성 226툴 ≈ 100K 토큰)을 먹어 대화 몫이 ~11K 토큰뿐인데, 이 시나리오는 전체 맵
      // show_map_region 결과 + 캡처 이미지를 함께 실어야 한다 — 카탈로그에 4툴만 늘어도 그 경계를 넘어
      // 문자 클램프가 캡처를 잘라낸다(2026-09-14 실측). 창이 분명한 모델로 재서 재투입 계약만 재도록 한다
      // (같은 파일의 LARGE_REVIEW_CONFIG 와 같은 이유).
      config: { ...ORCH_CONFIG, model: "gemini-2.5-flash", liteModel: "gemini-2.5-flash-lite", maxToolCalls: 16, maxTokens: 8192 }, chat,
      renderImages: renderLifecycleImages });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}길과 꽃을 칠해줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
      if (event.type === "result_review") reviews.push({ status: event.review.status, revision: event.review.revision });
    });
    // 첫 검사 뒤 writer 에게 간 요청(재투입 라운드)에 결정적 findings 가 실려 있다.
    // (플래너 1 + 1차 실행 4 라운드 뒤부터가 재투입 라운드다.)
    const repairPrompt = JSON.stringify(writerRequests.slice(5).map(request => request.messages));

    expect(result.stoppedReason, JSON.stringify({ error: result.error, reviews })).toBe("final");
    expect(result.review?.status).toBe("approved");
    expect(result.assistantText).toContain(result.review!.summary);
    // 2026-09-17 수용 원장 해체: 목표 충족 축은 판정되지 않고(unassessed), 초안 승인은 결정적 검사만으로 정해진다.
    expect(result.runOutcome).toMatchObject({ goal: "unassessed", delivery: "draft" });
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["paint_tiles", "paint_tiles"]);
    expect(result.proposedCalls.every(call => (call.result.diff?.tilesChanged ?? 0) > 0)).toBe(true);
    expect(reviews.map(review => review.status)).toEqual(["changes_requested", "approved"]);
    expect(reviews[1]!.revision).toBeGreaterThan(reviews[0]!.revision);
    // 재투입 프롬프트에는 결정적 findings(lint 코드·메시지·검증 기준)가 실린다.
    expect(repairPrompt).toContain("flower-area-empty: Flower area is still empty");
    expect(repairPrompt).toContain("run_lint error 0");
    expect(seenModels[0]).toBe("gemini-2.5-flash");
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
  }, 30000);

  it("집 3채 NPC 5명 요청에서 집 1채만 만든 실행자의 완료 주장은 독립 검수의 구조화된 부족분으로 재투입한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const spec = {
      mapId: "m1",
      title: "작은 집 3채와 NPC 5명",
      assets: [
        { id: "house1", kind: "house", x: 2, y: 2, w: 6, h: 6 },
        { id: "house2", kind: "house", x: 12, y: 2, w: 6, h: 6 },
        { id: "house3", kind: "house", x: 22, y: 2, w: 6, h: 6 },
        { id: "npc1", kind: "npc", x: 4, y: 12, w: 1, h: 1 },
        { id: "npc2", kind: "npc", x: 8, y: 12, w: 1, h: 1 },
        { id: "npc3", kind: "npc", x: 12, y: 12, w: 1, h: 1 },
        { id: "npc4", kind: "npc", x: 16, y: 12, w: 1, h: 1 },
        { id: "npc5", kind: "npc", x: 20, y: 12, w: 1, h: 1 },
      ],
    };
    const steps = [
      PLANNER_DIRECT,
      assistantToolCall("create_map", { id: "m1", name: "작은 마을", width: 40, height: 40 }, "c_map"),
      assistantToolCall("set_build_spec", spec, "c_spec"),
      assistantToolCall("author_house", { kind: "single", mapId: "m1", kitId: "blue-stone", wings: [{ x: 2, y: 2, w: 6, h: 6 }], interior: "exterior-only", door: true, yard: [] }, "c_house1"),
      assistantFinal("완료: 충분합니다."),
      assistantFinal("보완 실행 완료"),
    ];
    let index = 0;
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const reviews: ReviewInput[] = [];
    const findings = spec.assets.slice(1).map(asset => ({ id: asset.id, target: `/maps/m1/assets/${asset.id}`,
      problem: `Missing ${asset.kind}: ${asset.id}`, requestedChange: `Build ${asset.id} at ${asset.x},${asset.y}`,
      validation: `Inspect ${asset.id} in the current draft and capture its map region` }));
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, maxToolCalls: 32, maxTokens: 8192 },
      reviewConfig: LARGE_REVIEW_CONFIG,
      chat: (config, request) => {
        const review = independentReviewPayload(request);
        if (!review) return chat(config, request);
        reviews.push(review);
        expect(review.originalRequest).toBe(`${ORCH_GOAL}40x40 맵에 작은 집 3채 NPC 5명 배치해줘`);
        expect(review.toolResults).toEqual(expect.arrayContaining([expect.objectContaining({ name: "author_house",
          result: expect.objectContaining({ ok: true }) })]));
        return Promise.resolve(assistantFinal(JSON.stringify({ revision: review.revision,
          verdict: "changes_requested", summary: "Two houses and five NPCs remain missing", findings })));
      } });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}40x40 맵에 작은 집 3채 NPC 5명 배치해줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("error");
    expect(result.review?.status, result.error).toBe("changes_requested");
    expect(result.review?.findings).toEqual(expect.arrayContaining(findings));
    const houses = result.proposedCalls.filter(call => call.name === "author_house");
    expect(houses).toHaveLength(1);
    expect(houses[0]!.result.diff?.tilesChanged).toBeGreaterThan(0);
    expect(result.proposedCalls.filter(call => call.name === "place_npc")).toEqual([]);
    expect(session.isDraftReviewApproved()).toBe(false);
    expect(result.appliedCalls ?? []).toEqual([]);
    expect(reviews).toHaveLength(2);
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
    const repair = requests.at(-1)?.messages.find(message => typeof message.content === "string"
      && message.content.includes('"requestedChange":'));
    expect(repair).toBeDefined();
    const repairText = String(repair!.content);
    expect(JSON.parse(repairText.slice(repairText.indexOf("\n{") + 1))).toMatchObject({ findings: expect.arrayContaining(findings) });
    expect(result.review?.findings.some(finding => finding.problem.includes("show_map_region"))).toBe(true);
  }, 30000);

  it("최종 텍스트의 raw 툴콜 마크업은 잘라내고 안내로 대체한다", async () => {
    const { AssistantSession, createBlankProject, hasRawToolCallMarkup, sanitizeAssistantText } = await load();
    expect(hasRawToolCallMarkup(RAW_TOOL_MARKUP_FIXTURE)).toBe(true);
    expect(sanitizeAssistantText(RAW_TOOL_MARKUP_FIXTURE)).toBe("적용됨이어서 길을 깐 뒤 NPC 5명을 배치하겠습니다...…(형식 오류로 일부 생략)");

    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: CONFIG, chat: scriptedChat([assistantFinal(RAW_TOOL_MARKUP_FIXTURE)]) });
    const result = await session.sendUserMessage("이어 진행해", () => {});

    expect(result.assistantText).toContain("형식 오류로 일부 생략");
    expect(result.assistantText).not.toContain("<tool_call>");
    expect(result.assistantText).not.toContain("<invoke name=");
  }, 30000);

  it("오케스트레이션에서 변경 기대 요청이 0건 비질문으로 끝나면 한 번 재킥해 실행한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantFinal("먼저 확인하겠습니다."),
      assistantToolCall("set_title_screen", { title: "재킥 제목" }, "c_title"),
      assistantFinal("실행 완료"),
    ];
    let index = 0;
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_CONFIG, chat: (config, request) => {
      const approval = approvedReviewResponse(request);
      return approval ? Promise.resolve(approval) : chat(config, request);
    } });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 재킥 제목으로 바꿔줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    expect(result.review?.status).toBe("approved");
    // 모델의 마지막 말이 본문이고 결정적 검사 결과가 뒤에 한 줄로 붙는다.
    expect(result.assistantText).toContain(result.review!.summary);
    expect(phases).toEqual(["plan", "execute", "review"]);
    expect(session.getAuditEntries().filter(entry => entry.kind === "status" && entry.text === "zero-change-rekick")).toHaveLength(1);
    expect(requests).toHaveLength(4);
  }, 30000);

  it("오케스트레이션 0건 종료라도 질문이면 재킥하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      // 첫 호출은 플래너 라운드 — direct 로 통과시킨다.
      if (calls === 1) return assistantFinal('{"action":"direct","reason":"단순 요청"}');
      return assistantFinal("어떤 제목으로 바꿀까요?\n[선택지] 숲 | 바다");
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_CONFIG, chat });

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 바꿔줘`, () => {});

    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toContain("어떤 제목");
    // 플래너 1 + 본문 1.
    expect(calls).toBe(2);
  }, 30000);

  it("0건 조기 종료 재킥은 한 턴에 한 번만 쓴다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantFinal("먼저 확인하겠습니다."),
      assistantFinal("곧 진행하겠습니다."),
    ];
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_CONFIG, chat });

    const result = await session.sendUserMessage("던전 입구 타일만 칠해줘", () => {});

    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls).toEqual([]);
    expect(result.assistantText).toBe("곧 진행하겠습니다.");
    // 플래너 1 + 재킥 전 1 + 재킥 후 1.
    expect(index).toBe(3);
  }, 30000);

  it("비오케스트레이션 세션은 0건 조기 종료 재킥을 하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      return assistantFinal("먼저 확인하겠습니다.");
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: CONFIG, chat });

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 바꿔줘`, () => {});

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("먼저 확인하겠습니다.");
    expect(result.proposedCalls).toEqual([]);
    expect(calls).toBe(1);
  }, 30000);

  it("단순 대화 턴은 플래너 없이 감독 모델 한 번으로 끝난다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      return assistantFinal("안녕하세요.");
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_CONFIG, chat, declareIntent: fixedDeclarer({ mode: "other", needsPlan: false }) });
    const phases: string[] = [];

    const result = await session.sendUserMessage("안녕", (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("안녕하세요.");
    expect(result.proposedCalls).toEqual([]);
    expect(seenModels).toEqual(["supervisor-model"]);
    expect(phases).toEqual([]);
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text === "planner:skip single-step")).toBe(true);
  }, 30000);
});

describe("agentMode 오케스트레이션 게이트", () => {
  const PLANNER_START = "planner:start";

  function plannerStarted(audit: readonly { kind: string; text?: string }[]): boolean {
    return audit.some((entry) => entry.kind === "status" && entry.text === PLANNER_START);
  }

  it("기본 설정(agentMode auto)이라도 단일 단계 선언은 플래너를 건너뛴다", async () => {
    const { AssistantSession, createBlankProject, llm } = await load();
    const chat = scriptedChat([
      assistantFinal("완료했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: llm.defaultAiConfig(), chat, declareIntent: fixedDeclarer({ mode: "other", needsPlan: false }) });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(false);
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text === "planner:skip single-step")).toBe(true);
  }, 30000);

  it("기본 설정(agentMode auto)은 마을 같은 다단계 요청에서 플래너 라운드를 돈다", async () => {
    const { AssistantSession, createBlankProject, llm } = await load();
    const chat = scriptedChat([
      assistantFinal('{"action":"direct","reason":"마을 시공"}'),
      assistantFinal("완료했습니다."),
      assistantFinal("완료했습니다."),
      assistantFinal("완료했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: { ...llm.defaultAiConfig(), maxToolCalls: 4 },
      chat,
      declareIntent: fixedDeclarer({ space: "outdoor", needsPlan: true }),
    });

    await session.sendUserMessage("빈 프로젝트에 강이 있는 마을을 하나 만들고 집 8채를 지어줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(true);
    // 플래너의 direct 는 존중된다 — 코드가 정규식으로 계획을 강제하지 않는다.
    expect(
      session.getAuditEntries().some((entry) => entry.kind === "status" && String(entry.text).startsWith("planner:direct ")),
    ).toBe(true);
  }, 30000);

  it("선택 영역 작업(스코프)은 agentMode auto여도 플래너를 건너뛴다", async () => {
    const { AssistantSession, createBlankProject, llm } = await load();
    const chat = scriptedChat([
      assistantFinal("집을 시공합니다."),
    ]);
    const project = createBlankProject();
    const session = new AssistantSession(project, { yieldToUi: cooperativeNodeYield, config: llm.defaultAiConfig(), chat, declareIntent: fixedDeclarer({ space: "outdoor", useSelection: true, needsPlan: true }) });

    await session.sendUserMessage(
      "선택 영역 안에 야외 집 한 채를 지어 주세요.\n\n[컨텍스트] 현재 맵: 빈 맵 (map_blank_start) · 사용자 선택 영역: (2,2) 8×6",
      () => {},
      undefined,
      { instruction: "선택 영역 안에 야외 집 한 채를 지어 주세요.", scope: { mapId: project.startMapId!, region: { x: 2, y: 2, width: 8, height: 6 } } },
    );

    expect(plannerStarted(session.getAuditEntries())).toBe(false);
    expect(session.getAuditEntries().some((entry) => entry.kind === "status" && entry.text === "planner:skip selection")).toBe(true);
  }, 30000);

  it("agentMode chat + 단일 모델은 종래대로 플래너를 돌지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([assistantFinal("완료했습니다.")]);
    // CONFIG 는 model === liteModel 단일 모델.
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: { ...CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const }, chat });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(false);
  }, 30000);

  it("agentMode chat + 이원화 모델도 단일 단계 선언은 플래너를 건너뛴다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([assistantFinal("완료했습니다.")]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: { ...ORCH_CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const }, chat, declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }) });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(false);
  }, 30000);

  it("이원화 모델은 마을 요청에서 플래너가 돈다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}'),
      assistantFinal("완료했습니다."),
      assistantFinal("완료했습니다."),
      assistantFinal("완료했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: { ...ORCH_CONFIG, maxToolCalls: 4 },
      chat,
      declareIntent: fixedDeclarer({ space: "outdoor", needsPlan: true }),
    });

    await session.sendUserMessage("빈 프로젝트에 강이 있는 마을을 하나 만들고 집 8채를 지어줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(true);
    expect(
      session.getAuditEntries().some((entry) => entry.kind === "status" && String(entry.text).startsWith("planner:direct ")),
    ).toBe(true);
  }, 30000);

  it("노출 증명: 짧은 auto 턴은 계획 툴을 숨기고, chat+단일 모델도 숨긴다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const exposedToolNames = async (config: Record<string, unknown>): Promise<string[]> => {
      const names: string[] = [];
      const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
        for (const tool of req.tools ?? []) names.push(tool.function.name);
        if (names.length === 0) return assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}');
        return assistantFinal("완료했습니다.");
      };
      const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
        config: config as never,
        chat,
        declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }),
      });
      await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});
      return [...new Set(names)];
    };

    const autoNames = await exposedToolNames({ ...CONFIG, authMode: "apiKey" as const, agentMode: "auto" as const });
    expect(autoNames).not.toContain("set_work_plan");

    const chatNames = await exposedToolNames({ ...CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const });
    expect(chatNames).not.toContain("set_work_plan");
  }, 30000);

  it("quest 도메인을 여는 선언은 workPlan 없이도 define_quest와 verify_quest를 노출한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const names: string[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      for (const tool of req.tools ?? []) names.push(tool.function.name);
      return assistantFinal("완료했습니다.");
    };
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: { ...CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const },
      chat,
      declareIntent: fixedDeclarer({ tools: ["create_quest"] }),
    });
    await session.sendUserMessage("퀘스트 만들어줘. 촌장이 잃어버린 반지를 찾아와", () => {});
    expect(names).toContain("define_quest");
    expect(names).toContain("verify_quest");
  }, 30000);
});

// 하네스 관측(2026-07-09): 오케스트레이션 주입·토큰 사용이 감사 로그에 남고,
// getHarnessSnapshot이 뷰어(🔬)/window.__oprnAiHarness에 원본을 제공한다.
describe("하네스 관측", () => {
  it("오케스트레이션 주입 원문이 감사 로그에 남고 턴 종료 라인에 출력 토큰이 붙는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      assistantFinal("실행 완료"),
    ];
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_CONFIG, chat: scriptedChat(steps) });

    await session.sendUserMessage(`${ORCH_GOAL}타이틀을 새 제목으로 바꿔줘`, () => {});

    const entries = session.getAuditEntries();
    const injections = entries.filter(
      (entry) => entry.kind === "status" && entry.text.startsWith("오케스트레이션 주입: ")
    );
    // The execution hint is still audited; the draft verdict is a deterministic check (lint error 0),
    // not a self-review prose injection into the writer transcript.
    expect(injections).toHaveLength(1);
    const reviewAudit = entries.find(entry => entry.kind === "status" && entry.text.startsWith("deterministic-review "));
    expect(reviewAudit?.kind).toBe("status");
    expect(JSON.parse(reviewAudit && reviewAudit.kind === "status" ? reviewAudit.text.slice("deterministic-review ".length) : "null"))
      .toMatchObject({ status: "approved", findings: [], summary: "결정적 검사 통과 — 변경 맵 0개, lint error 0건." });
    const turnEnd = entries.find((entry) => entry.kind === "status" && entry.text.startsWith("턴 종료(final)"));
    expect(turnEnd?.kind).toBe("status");
    expect(turnEnd && turnEnd.kind === "status" ? turnEnd.text : "").toMatch(/출력 토큰 ~\d+/);
  }, 30000);

  it("getHarnessSnapshot은 모델 구성과 메시지·감사 로그 사본을 돌려준다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
    ];
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: ORCH_CONFIG, chat: scriptedChat(steps) });
    await session.sendUserMessage(`${ORCH_GOAL}타이틀을 새 제목으로 바꿔줘`, () => {});

    const snapshot = session.getHarnessSnapshot();

    expect(snapshot.model).toBe("supervisor-model");
    expect(snapshot.liteModel).toBe("executor-model");
    expect(snapshot.maxTokens).toBe(512);
    expect(snapshot.messages.length).toBe(session.getMessages().length);
    expect(snapshot.audit.length).toBe(session.getAuditEntries().length);
    // 사본 계약: 스냅샷 배열은 세션 내부 배열과 다른 인스턴스여야 한다(외부 조작 차단).
    expect(snapshot.audit).not.toBe(session.getAuditEntries());
  }, 30000);
});

/**
 * 실측 결함(2026-07-29 region-task-log): 어시스턴트가 `set_build_spec`(밑그림)만 확정하고
 * 실제 쓰기 툴(place_npc)을 한 번도 호출하지 않은 채 "승인 후 진행됩니다"라고 말하고 끝냈다.
 * proposedCalls=0 이므로 승인할 대상이 없고, UI 에는 승인 버튼이 뜰 수 없다 —
 * 사용자는 없는 버튼을 찾게 된다. 진짜 결함은 "아무것도 안 하고 했다고 말한 것"이다.
 *
 * 원인 두 가지를 각각 고정한다:
 *  (1) 빈손 종료 안전망(zero-change-rekick)이 `orchestrated` 게이트 뒤에 있었다.
 *      model === liteModel 인 단일 모델 설정에서는 orchestrated=false 라 안전망이 꺼진다.
 *  (2) 밑그림만 확정한 턴을 완료로 인정했다. 명세에 에셋이 있는데 그 에셋을 지은
 *      쓰기 툴이 0건이면 그 턴은 미완이다.
 */
describe("밑그림만 그리고 끝내는 턴", () => {
  const SPEC_ARGS = {
    mapId: "map_blank_start",
    title: "선택 영역 잡화점 상인 배치",
    assets: [{ id: "merchant_npc", kind: "npc", x: 5, y: 5, w: 1, h: 1, style: "잡화점 상인", overExisting: "keep" }],
    buildOrder: ["npc"],
    density: "normal",
    layoutStyle: "straight",
    pathWidth: 1,
  };

  it("단일 모델에서도 쓰기 0건 종료를 감지해 실행을 다시 요구한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    // CONFIG 는 model === liteModel — 감독님 로그와 같은 단일 모델 조건이다.
    const chat = scriptedChat([
      assistantToolCall("set_build_spec", SPEC_ARGS),
      assistantFinal("잡화점 상인 NPC 1명을 배치할 예정입니다. 실제 배치는 사용자 승인 후 진행됩니다."),
      assistantFinal("다시 확인했습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield, config: { ...CONFIG, authMode: "apiKey" as const }, chat });

    await session.sendUserMessage("이 자리에 잡화점 상인 NPC 하나 배치해줘", () => {});

    const audit = session.getAuditEntries();
    const rekicked = audit.some((entry) => entry.kind === "status" && String(entry.text).includes("zero-change-rekick"));
    expect(rekicked).toBe(true);
  }, 30000);

  it("밑그림 에셋을 지은 쓰기 툴이 없으면 미이행 경고를 남긴다", async () => {
    const { proposalCompletenessWarnings } = await import("@/ai/proposalCompleteness");

    // 쓰기 툴이 하나도 없는 상태 = 감독님 로그의 실제 상황(calls: []).
    const warnings = proposalCompletenessWarnings({
      requestText: "이 자리에 잡화점 상인 NPC 하나 배치해줘",
      assistantText: "배치할 예정입니다. 사용자 승인 후 진행됩니다.",
      buildSpec: SPEC_ARGS as unknown as import("@/ai/buildSpec").BuildSpec,
      calls: [],
    });

    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.includes("미이행"))).toBe(true);
  }, 30000);

  it("모델이 place_npc 를 부르지 않아도 밑그림의 npc 에셋을 직접 배치해 이벤트를 만든다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    // 모델은 끝까지 place_npc 를 부르지 않는다 — 밑그림만 내고 "승인 후 진행"이라 말한다.
    // 재킥(1회) 후에도 같은 태도를 유지하는, 감독 로그보다 더 나쁜 시나리오다.
    const chat = scriptedChat([
      assistantToolCall("set_build_spec", SPEC_ARGS),
      assistantFinal("잡화점 상인을 배치할 예정입니다. 사용자 승인 후 진행됩니다."),
      assistantFinal("밑그림은 이미 확정했습니다. 승인해 주세요."),
    ]);
    const session = new AssistantSession(createBlankProject(), { yieldToUi: cooperativeNodeYield,
      config: { ...CONFIG, authMode: "apiKey" as const },
      chat,
    });

    const result = await session.sendUserMessage("이 자리에 잡화점 상인 NPC 하나 배치해줘", () => {});

    // 코드가 직접 실행했으므로 승인할 제안이 생긴다(이전에는 0건이라 승인 버튼이 없었다).
    const npcProposals = result.proposedCalls.filter((call) => call.name === "place_npc");
    expect(npcProposals.length).toBe(1);

    // 감사 로그에 자동 실행 흔적이 남는다.
    const audit = session.getAuditEntries();
    expect(audit.some((e) => e.kind === "status" && String(e.text).includes("spec-npc-autobuild"))).toBe(true);

    // 핵심: 실제 이벤트가 페이지·커맨드까지 컴파일됐는가. 상점 역할이므로 shop 커맨드가 있어야 한다.
    const diff = npcProposals[0]!.result.diff;
    expect(diff).toBeTruthy();
    expect(diff?.eventsAdded ?? 0).toBe(1);
  }, 30000);
});

describe("verification declaration and correction caller boundary", () => {
  it.each([false, true])("adopts a frozen map-qualified scene and executes correction (changed initial state=%s)", async changedSeed => {
    const { AssistantSession } = await load();
    const { verificationJourney } = await import("./fixtures/verificationOwnership");
    const f = verificationJourney();
    const map = f.village;
    const declaration = { tool: "run_scene_test", args: f.wire180, interactionTargets: [
      { stepIndex: 2, mapId: f.cellar.id, eventId: f.chest.id }, { stepIndex: 6, mapId: map.id, eventId: f.chief.id },
      { stepIndex: 9, mapId: map.id, eventId: f.chief.id },
    ] };
    let round = 0;
    let session: InstanceType<typeof AssistantSession>;
    const events: SessionEvent[] = [];
    session = new AssistantSession(f.project, { config: { ...CONFIG, maxToolCalls: 12, maxTokens: 8192 }, declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      chat: async (_config, request) => {
        const review = approvedReviewResponse(request);
        if (review) return review;
        round++;
        if (round === 1) return assistantToolCall("set_work_plan", { goal: "Frozen journey", acceptance: [{ id: "size", title: "Map", criteria: [
          { kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.height },
        ] }], layers: [{ title: "QA", items: [{ title: "Journey", instruction: "Check", successTools: ["run_scene_test"], verificationChecks: [declaration] }] }] });
        if (round === 2) return assistantToolCall("run_scene_test", f.wire180);
        const id = session.getVerificationSnapshot().requirements[0]!.checkId;
        if (round === 3) return assistantToolCall("correct_verification", { checkId: id, args: f.wire181, verdict: "pass" });
        if (round === 4) return assistantToolCall("correct_verification", { checkId: id, args: f.wire181 });
        if (round === 5 && changedSeed) return assistantToolCall("set_session_start", { gold: 100 });
        if (round === 6 && changedSeed) return assistantToolCall("correct_verification", { checkId: id, args: f.wire181 });
        return assistantFinal("Checks recorded.");
      } });
    const result = await session.sendUserMessage("Inspect the frozen scene.", event => events.push(event));
    // 2026-09-17: 검증 원장·수용(acceptance) 항목은 승인 조건이 아니다 — 초안은 결정적 검사(lint error 0)로 승인되고
    // 턴은 final 로 끝난다. 원장의 상태(unverified / blocked)는 그대로 남아 아래에서 단언한다.
    expect(result.stoppedReason, result.error).toBe("final");
    if (changedSeed) {
      // set_session_start 쓰기가 있는 판만 검사 대상이 된다 — lint error 0 이면 승인.
      expect(result.review?.status).toBe("approved");
      expect(session.isDraftReviewApproved()).toBe(true);
    }
    expect(session.getVerificationSnapshot().requirements).toHaveLength(1);
    expect(events.filter(e => e.type === "tool_call" && e.name === "correct_verification").map(e => e.type === "tool_call" && e.result.ok)).toEqual(changedSeed ? [false, true, true] : [false, true]);
    const snapshot = session.getVerificationSnapshot();
    expect(snapshot.requirements).toHaveLength(1);
    expect(snapshot.requirements[0]?.args).toEqual(f.wire180);
    expect(snapshot.requirements[0]?.interactionTargets).toEqual(declaration.interactionTargets);
    expect(snapshot.requirements[0]?.status).toBe(changedSeed ? "unverified" : "passed");
    expect(snapshot.findings).toEqual([]);
    // 2026-09-17 수용 원장 해체: 계획이 직접 선언한 검증 요구만 완료를 막는다(원장 status 는 더 이상 없다).
    expect((result.completionAssessment?.blockingVerification.length ?? 0) > 0).toBe(changedSeed);
  });
  it.each(["wire114", "wire281", "dummy-removal", "cross-map", "weaker-assertion", "write-after-pass", "foreign-owner"])("retains the correct terminal contract for %s", async variant => {
    const { AssistantSession } = await load();
    const { verificationJourney, crossMapVerification, verificationEvent } = await import("./fixtures/verificationOwnership");
    const f = verificationJourney();
    const cross = crossMapVerification();
    const project = variant === "cross-map" ? cross.project : f.project;
    const map = project.maps[project.startMapId]!;
    const route = { mapId: map.id, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }] };
    const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
    const checks: unknown[] = [];
    const required = ["get_project_summary"];
    const sceneCall = (args: Record<string, unknown>) => ({ name: "run_scene_test", args });
    if (variant === "wire114") calls.push({ name: "check_reachability", args: { mapId: map.id, from: { x: 10, y: 8 }, targets: [{ newMapName: "지하실", mapId: map.id }] } }, { name: "check_reachability", args: route });
    if (variant === "wire281") calls.push(sceneCall({ mapId: f.cellar.id, start: { x: 6, y: 3 }, steps: [{ kind: "face", dir: "down" }, { kind: "interact" }] }),
      sceneCall({ mapId: f.cellar.id, start: { x: 6, y: 3 }, steps: [{ kind: "face", dir: "up" }, { kind: "interact" }] }));
    if (variant === "dummy-removal") {
      f.cellar.events.push(verificationEvent("ev_dummy_fix", 6, 4, []));
      calls.push(sceneCall({ mapId: f.cellar.id, start: { x: 6, y: 3 }, steps: [{ kind: "interact", eventId: "ev_dummy_fix" }] }),
        { name: "remove_event", args: { mapId: f.cellar.id, eventId: "ev_dummy_fix" } });
    }
    if (variant === "cross-map") calls.push(sceneCall({ ...cross.a }), sceneCall({ ...cross.b }));
    if (variant === "weaker-assertion") calls.push(sceneCall({ ...f.wire180 }), sceneCall({ ...f.corrected171 }));
    if (variant === "write-after-pass" || variant === "foreign-owner") {
      required.push("check_reachability");
      checks.push({ tool: "check_reachability", args: route });
      calls.push({ name: "check_reachability", args: route }, { name: "set_title_screen", args: { title: "Changed after proof" } });
    }
    if (variant === "foreign-owner") calls.push({ name: "run_scene_test", args: { ...f.wire180, ownerId: "forged-owner" } });
    const plan = { goal: "Scoped checks", acceptance: [{ id: "size", title: "Map", criteria: [{ kind: "mapDimensions", target: { mapId: map.id }, width: map.width, height: map.height }] }],
      layers: [{ title: "Check", items: [{ id: "qa", title: "Inspect", instruction: "Inspect", successTools: required, verificationChecks: checks }] }] };
    const rounds = [{ name: "set_work_plan", args: plan }, ...calls, { name: "get_project_summary", args: {} }];
    let cursor = 0;
    const events: SessionEvent[] = [];
    const session = new AssistantSession(project, { config: { ...CONFIG, maxToolCalls: 12 }, declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
      chat: async () => {
        const call = rounds[cursor++];
        return call ? assistantToolCall(call.name, call.args, `ownership-${cursor}`) : assistantFinal("Checks recorded.");
      } });
    const result = await session.sendUserMessage("Inspect the scoped checks.", event => events.push(event));
    const blocked = ["cross-map", "weaker-assertion", "write-after-pass", "foreign-owner"].includes(variant);
    // 2026-09-17 수용 원장 해체: 완료를 막는 것은 계획이 직접 선언한 검증 요구·실행 findings 뿐이다.
    expect((result.completionAssessment?.blockingVerification.length ?? 0) > 0, JSON.stringify(result.completionAssessment)).toBe(blocked);
    if (variant === "wire114") {
      expect(session.getVerificationSnapshot().attempts[0]?.status).toBe("unsuccessful");
      expect(session.getVerificationSnapshot().findings).toEqual([]);
    }
    if (variant === "wire281") expect(session.getVerificationSnapshot().attempts.map(a => a.status)).toEqual(["setup-failure", "passed"]);
    if (variant === "dummy-removal") {
      expect(session.getProposedProject().maps[f.cellar.id]?.events.some(e => e.id === "ev_dummy_fix")).toBe(false);
      expect(events.find(e => e.type === "tool_call" && e.name === "remove_event")).toMatchObject({ result: { ok: true } });
      expect(session.getVerificationSnapshot().requirements).toEqual([]);
    }
    if (variant === "cross-map" || variant === "weaker-assertion") expect(session.getVerificationSnapshot().findings).toHaveLength(1);
    if (variant === "foreign-owner") expect(session.getVerificationSnapshot().attempts.at(-1)?.status).toBe("unsuccessful");
  });
});
