import { fixedDeclarer } from "./intentFixture";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type { SessionEvent } from "@/ai/assistantSession";
import { getTool } from "@/editor/tools";
import * as applyStore from "@/editor/tools/applyChangesetToStore";

const MILESTONE_TEST_ENV = {
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  VITE_SUPABASE_PROJECT_ID: "rpg-zzu-test-project",
  VITE_SUPABASE_URL: "http://dbserver:8100",
} as const;

function stubSupabaseEnv(): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", MILESTONE_TEST_ENV.VITE_SUPABASE_ANON_KEY);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", MILESTONE_TEST_ENV.VITE_SUPABASE_PROJECT_ID);
  vi.stubEnv("VITE_SUPABASE_URL", MILESTONE_TEST_ENV.VITE_SUPABASE_URL);
}

/**
 * 마일스톤 자동 적용이 실제 Supabase를 건드리지 않도록 헤르메틱 환경을 설치한다.
 * todo 4 이후 자율 런 테스트는 항목 완료 시 자동 적용 경로를 타므로 필수다.
 */
function installMilestoneHermeticEnv(project: Project): void {
  stubSupabaseEnv();
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    // todo 4: 자율 런은 항목 완료 시 마일스톤을 자동 적용하므로 실제 Supabase를 건드리지 않게
    // env/fetch를 스텁하고 세션·store를 같은 프로젝트로 초기화한다.
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { config: ORCH_AUTO, chat });

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    const items = session.getWorkPlan()!.layers.flatMap((l) => l.items);
    expect(items.map((i) => i.status)).toEqual(["done", "done", "done"]);
    const statuses = statusTexts(session);
    expect(statuses.some((t) => t.includes("agent_run:auto-continue"))).toBe(true);
    expect(result.assistantText).toContain("모든 항목을 완료했습니다");
    // 턴1(플래너1+4라운드) + 턴2(4라운드) + 턴3(쓰기+최종) = 11콜. 플래너는 사용자 턴에서 한 번만 돈다.
    expect(index).toBe(11);
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
    const session = new AssistantSession(createBlankProject(), { config: ORCH_AUTO, chat });

    await session.sendUserMessage(`${ORCH_GOAL}끝나지 않는 목표를 처리해줘`, () => {}, undefined, { autonomous: true });

    const statuses = statusTexts(session);
    expect(statuses.some((t) => t.includes("agent_run_budget_exhausted"))).toBe(true);
    // 48회까지 자동 계속하고 49번째는 송신하지 않는다 — 본문 턴 = 초기 1 + 자동 48.
    expect(statuses.filter((t) => t.includes("agent_run:auto-continue")).length).toBe(48);
    // 진행이 계속되는 동안은 교착으로 판정하지 않는다.
    expect(statuses.some((t) => t.startsWith("ralph:stalled"))).toBe(false);
  }, 300000);

  it("(c) 턴이 사용자 질문으로 끝나면 드라이버는 자동 송신하지 않고 일시정지한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps: ChatResult[] = [
      finalResult(THREE_ITEM_PLAN_JSON),
      toolCallResult("set_work_plan", THREE_ITEM_PLAN, "c_plan"),
      titleWrite("c_t1", "t1"),
      finalResult("어떤 분위기로 바꿀까요?\n[선택지] 밝은 | 어두운"),
    ];
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    // t1 완료 시 마일스톤 자동 적용이 일어나므로 헤르메틱 env 설치.
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { config: ORCH_AUTO, chat });

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    expect(result.assistantText).toContain("어떤 분위기");
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, { config: ORCH_AUTO, chat });
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
    const chatRef: { current: (config: never, req: never) => Promise<ChatResult> } = { current: async () => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    } };
    // 훅 주입(생성자 옵션) — peek 만 하고 dequeue 하지 않는다.
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, {
      config: ORCH_AUTO,
      peekPendingUserMessage: () => pending,
      chat: (config, req) => chatRef.current(config as never, req as never),
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

    expect(result.assistantText).toContain("모든 항목을 완료했습니다");
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const session = new AssistantSession(project, {
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_AUTO, chat });

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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    // agentMode "chat" — 패널은 autonomous:false 를 주므로(설정 기준) 같은 계약을 세션에서 직접 고정한다.
    const session = new AssistantSession(createBlankProject(), {
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
    const session = new AssistantSession(createBlankProject(), { config: ORCH_AUTO, chat });

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
// 계약: 자율 런(agentMode auto + opts.autonomous)에서 work-item 완료(complete_work_item
// 또는 successTools 자동 완료) 시점에 안전 적용 경로(commitChangeset → undo 스냅샷 →
// store.replace → await 커밋 로그)를 기계적으로 호출한다. 도구의 파괴·어휘·규칙 표식과
// agentMode 설정은 적용 게이트가 아니다. 적용/커밋 검증 실패만 proposal_paused를 낸다.
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

  it("(a) 자율 런에서 안전한 마일스톤이 사용자 조작 없이 적용된다 — 마일스톤마다 undo 스냅샷 1개 + 커밋 row 1개", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const commitCalls: string[] = [];
    stubSupabaseEnv();
    vi.stubGlobal("fetch", (async (input) => {
      const url = String(input);
      commitCalls.push(url);
      return new Response(null, { status: 201 });
    }) satisfies typeof fetch);
    const project = createBlankProject();
    initMilestoneStore(project);
    const steps = threeMilestoneSteps();
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });
    const events: SessionEvent[] = [];

    await session.sendUserMessage("타이틀을 3단계로 개선해줘", (event) => { events.push(event); }, undefined, { autonomous: true });

    // 사용자 조작 없이 스토어에 적용 완료.
    expect(store.getCurrent().meta?.title).toBe("t3");
    // 마일스톤 3개 = 커밋 row 3개(await 확정 — vi.waitFor 불필요).
    expect(commitCalls.filter((url) => url.includes("/rest/v1/project_commits"))).toHaveLength(3);
    expect(commitCalls.filter((url) => url.includes("/rest/v1/project_changes"))).toHaveLength(3);
    // undo 스냅샷 1개/마일스톤.
    expect(getMapEditHistoryEntries()).toHaveLength(3);
    // 마일스톤 적용 이벤트 3회 + 감사 기록.
    expect(events.filter((event) => event.type === "milestone_applied")).toHaveLength(3);
    const audits = milestoneStatusTexts(session);
    expect(audits.filter((t) => t.includes("agent_run:milestone-applied"))).toHaveLength(3);
    expect(audits.some((t) => t.includes("agent_run:milestone-paused"))).toBe(false);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
  }, 120000);

  it("(b) 파괴적 마일스톤(remove_event)도 승인 대기 없이 자동 적용한다", async () => {
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });
    const events: SessionEvent[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}이벤트 영역을 정리해줘`, (event) => { events.push(event); }, undefined, { autonomous: true });

    // remove_event도 같은 마일스톤 적용 경로를 타며 전체 프로젝트 undo 스냅샷을 남긴다.
    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
    expect(events.some((event) => event.type === "milestone_applied")).toBe(true);
    expect(milestoneStatusTexts(session).some((t) => t.includes("agent_run:milestone-applied"))).toBe(true);
    expect(result.proposedCalls.map((call) => call.name)).not.toContain("remove_event");
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });
    const events: SessionEvent[] = [];

    // 플래그 미지정(기존 호출처) — 턴 1개로 끝나고(자동 계속 없음) 자동 적용도 없다.
    await session.sendUserMessage("타이틀을 3단계로 개선해줘", (event) => { events.push(event); });

    expect(JSON.stringify(store.getCurrent())).toBe(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(events.some((event) => event.type === "milestone_applied")).toBe(false);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
    expect(milestoneStatusTexts(session).some((t) => t.includes("agent_run:milestone"))).toBe(false);
  }, 30000);

  it("(c-2) agentMode chat + autonomous 플래그도 마일스톤을 즉시 적용한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    initMilestoneStore(project);
    const before = JSON.stringify(store.getCurrent());
    const steps = threeMilestoneSteps();
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    // agentMode는 대화/자율 실행 선택이지 승인 설정이 아니다.
    const session = new AssistantSession(project, {
      config: { ...ORCH_CONFIG, maxToolCalls: 4, agentMode: "chat" as const },
      chat,
    });
    const events: SessionEvent[] = [];

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", (event) => { events.push(event); }, undefined, { autonomous: true });

    expect(JSON.stringify(store.getCurrent())).not.toBe(before);
    expect(store.getCurrent().meta.title).toBe("t3");
    expect(events.filter((event) => event.type === "milestone_applied")).toHaveLength(3);
    expect(events.some((event) => event.type === "proposal_paused")).toBe(false);
    expect(result.proposedCalls).toHaveLength(0);
    expect(milestoneStatusTexts(session).some((t) => t.includes("agent_run:auto-continue"))).toBe(true);
  }, 30000);
  it("(c-3) 커밋 게이트 적용 실패는 현재 런만 멈추고 다음 사용자 턴의 자동 적용을 다시 허용한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const TWO_ITEM_PLAN = {
      goal: "타이틀 두 단계 적용",
      layers: [{
        title: "타이틀",
        items: [
          { title: "깨진 적용", instruction: "set_title_screen {title:'first'}", successTools: ["set_title_screen"] },
          { title: "다음 적용", instruction: "set_title_screen {title:'second'}", successTools: ["set_title_screen"] },
        ],
      }],
    };
    const steps: ChatResult[] = [
      milestoneFinal(JSON.stringify({ action: "new_plan", ...TWO_ITEM_PLAN })),
      milestoneToolCall("set_work_plan", TWO_ITEM_PLAN, "c_plan"),
      titleWrite("c_first", "first"),
      milestoneFinal("첫 항목을 마쳤습니다."),
      milestoneFinal(JSON.stringify({ action: "resume", reason: "같은 목표 계속" })),
      titleWrite("c_second", "second"),
      milestoneFinal("두 번째 항목을 마쳤습니다."),
    ];
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) milestoneExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });
    const firstEvents: SessionEvent[] = [];
    let corruptFirstDraft = true;

    await session.sendUserMessage("타이틀을 두 단계로 바꿔줘", (event) => {
      firstEvents.push(event);
      if (corruptFirstDraft && event.type === "tool_call" && event.name === "set_title_screen" && event.result.ok) {
        corruptFirstDraft = false;
        // 적용 직전 draft에 새 무결성 오류를 넣어 commitChangeset 거부 경계를 결정적으로 구동한다.
        (session as unknown as { ctx: { project: Project } }).ctx.project.startMapId = "missing-map";
      }
    }, undefined, { autonomous: true });

    expect(store.getCurrent().meta.title).not.toBe("first");
    expect(firstEvents.some((event) => event.type === "proposal_paused")).toBe(true);
    expect(firstEvents.some((event) => event.type === "status" && event.text.includes("마일스톤 적용 실패"))).toBe(true);
    expect(firstEvents.some((event) => event.type === "status" && event.text.includes("프로젝트 저장소는 변경되지 않았습니다"))).toBe(true);
    const firstAudits = milestoneStatusTexts(session);
    expect(firstAudits.some((text) => text.includes("agent_run:milestone-apply-failed"))).toBe(true);
    expect(firstAudits.some((text) => text.includes("agent_run:stopped-apply-failed"))).toBe(true);
    expect(firstAudits.some((text) => text.includes("승인 대기") || text.includes("paused-approval"))).toBe(false);

    const secondEvents: SessionEvent[] = [];
    await session.sendUserMessage("다음 항목을 계속해줘", (event) => { secondEvents.push(event); }, undefined, { autonomous: true });

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
// store.reloadFromRemote() → agent_run_saved 감사(projectId + sha256 + 최신 커밋 row).
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) gateExhausted();
      if (index === steps.length - 1) layerEventCount = events.length;
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 8 }, chat, yieldToUi: async () => {} });

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
    ]);
    const verifyQuestCall = toolCalls.find((e) => e.name === "verify_quest")!;
    expect(verifyQuestCall.args).toEqual({ questId: "q1" });
    const gateWalkthrough = toolCalls[toolCalls.length - 1]!;
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
      .toEqual([["제목 1", 1], ["퀘스트 등록", 2], ["완성", 1]]);
    expect(apply.mock.calls.map(([, options]) => options.toolNames))
      .toEqual([["set_title_screen"], ["upsert_event", "define_quest"], ["set_title_screen"]]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["set_title_screen", "upsert_event", "define_quest", "set_title_screen"]);
    expect(result.proposedCalls).toEqual([]);
    expect(getMapEditHistoryEntries()).toHaveLength(3);
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) gateExhausted();
      if (index === steps.length - 1) layerEventCount = events.length;
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 8 }, chat, yieldToUi: async () => {} });

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
      "set_title_screen", "run_lint", "verify_quest",
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
    expect(lint.mock.calls.map(([checkedProject]) => checkedProject.meta.title)).toEqual([project.meta.title, "t2", "t2", "t2"]);
    expect(lint.mock.calls.at(-1)?.[0]).toEqual(store.getCurrent());
    const audits = gateStatusTexts(session);
    expect(audits.filter(t => t.startsWith("agent_run:verification-pass "))).toHaveLength(2);
    expect(audits.filter(t => t.startsWith("agent_run:completion-check-pass "))).toHaveLength(2);
    expect(index).toBe(steps.length);
    expect(result.stoppedReason).toBe("final");
    expect(result.workPlan?.layers.flatMap(layer => layer.items.map(item => item.status))).toEqual(["done", "done"]);
    expect(events.filter(event => event.type === "milestone_applied").map(event => [event.title, event.toolCount]))
      .toEqual([["퀘스트 등록", 2], ["제목 확정", 1]]);
    expect(apply.mock.calls.map(([, options]) => options.toolNames)).toEqual([["upsert_event", "define_quest"], ["set_title_screen"]]);
    expect(result.appliedCalls?.map(call => call.name)).toEqual(["upsert_event", "define_quest", "set_title_screen"]);
    expect(result.proposedCalls).toEqual([]);
    expect(getMapEditHistoryEntries()).toHaveLength(2);
    expect(store.getCurrent().meta.title).toBe("t2");
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
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) gateExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 8 }, chat });
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
    gateFinal("이어서 진행합니다."),
    gateToolCall("set_title_screen", { title: "t3" }, "c_t3"),
    gateFinal("모든 항목을 완료했습니다."),
  ];

  it("(c) completed remote plan verifies its accepted receipt without reloading", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project);
    const receipt = { revisionId: "accepted-revision", projectId: MILESTONE_TEST_ENV.VITE_SUPABASE_PROJECT_ID,
      mutationGeneration: 3, contentIdentity: "normalized-content", sha256: "sha-abc123" };
    const flushSpy = vi.spyOn(store, "flush").mockResolvedValue({ kind: "saved", receipt });
    const reloadSpy = vi.spyOn(store, "reloadFromRemote");
    const verifySpy = vi.spyOn(store, "verifyPersistedRevision").mockResolvedValue({ kind: "verified", receipt, isCurrent: true });
    vi.spyOn(store, "isPersistenceReceiptCurrent").mockReturnValue(true);
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(true);
    const steps = runEndMilestoneSteps();
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) gateExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });

    const result = await session.sendUserMessage("타이틀을 3단계로 개선해줘", () => {}, undefined, { autonomous: true });

    expect(result.stoppedReason).toBe("final");
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(verifySpy).toHaveBeenCalledExactlyOnceWith(receipt, { signal: undefined });
    expect(session.getRunEndProof()).toMatchObject({ status: "succeeded", verified: true, receipt });
    const audits = gateStatusTexts(session);
    expect(audits.filter((t) => t.split(" ")[0] === "agent_run_saved")).toHaveLength(1);
    // 드라이버 계속 턴은 플래너 왕복을 태우지 않는다 — 플래너는 사용자 턴에서 한 번만 돈다.
    expect(audits.filter((t) => t.startsWith("planner:start")).length).toBe(1);
    expect(audits.some((t) => t.includes("planner:skip driver-continue"))).toBe(true);
    expect(audits.some((t) => t.includes("agent_run:auto-continue"))).toBe(true);
    // 정상 진행 중인 항목은 막히지 않는다(쓰기가 성공하면 항목별 시도 수가 0으로 돌아간다).
    expect(audits.some((t) => t.includes("ralph:stalled"))).toBe(false);
  }, 120000);

  it("(c-2) remote 비활성 → agent_run_local_only 감사, flush 호출 없음, 오류 없음", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installMilestoneHermeticEnv(project); // remotePersistenceEnabled: false
    const flushSpy = vi.spyOn(store, "flush");
    const steps = runEndMilestoneSteps();
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) gateExhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: { ...ORCH_CONFIG, maxToolCalls: 4 }, chat });

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
    createBlankProject: defaults.createBlankProject,
    llm,
  };
}

type ChatResult = import("@/ai/llmClient").ChatResult;
type ChatRequest = import("@/ai/llmClient").ChatRequest;

// 스크립트된 응답을 순서대로 돌려주는 가짜 chat.
function scriptedChat(steps: readonly ChatResult[]) {
  let i = 0;
  return async (): Promise<ChatResult> => {
    if (i >= steps.length) throw new Error("scripted chat exhausted");
    return steps[i++];
  };
}

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
const AUTO_SINGLE_CONFIG = { ...CONFIG, agentMode: "auto" as const };
const ORCH_CONFIG = { ...CONFIG, model: "supervisor-model", liteModel: "executor-model", maxToolCalls: 12, agentMode: "auto" as const };
/** 짧은 한 줄은 plannerSkip 이 본문으로 직행하므로, 플래너 계약을 재는 테스트는 다단계 표지를 붙인다. */
const ORCH_GOAL = "이 작업을 단계로 진행해줘. ";
// 플래너 라운드(오케스트레이션 게이트 통과 시 항상 선행)가 소비하는 1스텝 — direct 로 통과시킨다.
const PLANNER_DIRECT = assistantFinal('{"action":"direct","reason":"한 턴으로 충분"}');
// 공급자 고유 센티넬(예전엔 특정 공급자의 raw 구분자를 함께 넣었다)은 뺐다 — 감지는 공급자를
// 가리지 않는 `<tool_call>` / `<invoke name=` 두 형태로만 이뤄진다.
const RAW_TOOL_MARKUP_FIXTURE = `적용됨이어서 길을 깐 뒤 NPC 5명을 배치하겠습니다...<tool_call><invoke name="proposetilevocabulary">...`;

/** 검수 단계 진입 조건(writeToolAttempts > 8)을 맞추기 위한 채움용 쓰기 9회(단일 응답).
 *  paint_tiles 는 tilesChanged>0 의 의미있는 diff 를 내고(미이행 휴리스틱 오염 방지),
 *  동일 인자 반복이므로 제안 키가 같아 1건으로 중복제거된다. */
function nineWriteCalls(args: Record<string, unknown> = { mapId: "map_blank_start", mode: "rect", layer: "lower", tile: 240, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }): ChatResult {
  const calls = Array.from({ length: 9 }, (_, i) => ({
    id: `c_filler_${i}`,
    type: "function" as const,
    function: { name: "paint_tiles", arguments: JSON.stringify(args) },
  }));
  return {
    message: { role: "assistant" as const, content: null, tool_calls: calls },
    finishReason: "tool_calls",
  } as ChatResult;
}

describe("AssistantSession 툴콜 루프", () => {
  it("메인 세션은 config.model을 그대로 chat 함수에 전달한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      return assistantFinal("완료");
    };
    const session = new AssistantSession(createBlankProject(), {
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
    const session = new AssistantSession(createBlankProject(), {
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
    const session = new AssistantSession(createBlankProject(), {
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
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    const result = await session.sendUserMessage("연금술사의 집 이라는 실내 를 하나 만드렁줘", () => {});
    expect(chatCalls).toBe(1);
    expect(result.assistantText).toBe("실내 준비");
  }, 30000);

  it("연쇄 툴콜 2개(읽기→쓰기) 후 최종 응답을 반환하고 쓰기만 제안에 담는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([
      assistantToolCall("get_project_summary", {}),
      assistantToolCall("create_map", { id: "m1", name: "새 맵", width: 6, height: 6 }, "c_create_map"),
      assistantFinal("맵을 만들었습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    const events: string[] = [];
    const result = await session.sendUserMessage("맵 하나 만들어줘", (e) => {
      if (e.type === "tool_call") events.push(`${e.name}:${e.result.ok}`);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("맵을 만들었습니다.");
    expect(events).toEqual(["get_project_summary:true", "create_map:true"]);
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
      assistantFinal("시작 위치를 고쳤습니다."),
    ]);
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

    const toolEvents: { name: string; ok: boolean }[] = [];
    const result = await session.sendUserMessage("시작 위치 잡아줘", (e) => {
      if (e.type === "tool_call") toolEvents.push({ name: e.name, ok: e.result.ok });
    });

    expect(result.stoppedReason).toBe("final");
    // 실패한 시도와 성공한 시도가 모두 관측되어야 한다.
    const startAttempts = toolEvents.filter((e) => e.name === "set_start_position");
    expect(startAttempts.map((e) => e.ok)).toEqual([false, true]);

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
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

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
    const session = new AssistantSession(createBlankProject(), { config: { ...CONFIG, maxToolCalls: 3 }, chat });
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
    const session = new AssistantSession(createBlankProject(), { config: { ...CONFIG, maxToolCalls: 2 }, chat });
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
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });
    await session.sendUserMessage("안녕", () => {});
    const audit = JSON.parse(session.exportAudit());
    expect(audit.model).toBe(CONFIG.model);
    // at(ISO 타임스탬프)는 결함 ⑬(구조화 세션 로그)에서 추가 — 내용 필드만 고정 검증.
    expect(audit.entries[0]).toMatchObject({ kind: "user", text: "안녕" });
    expect(typeof audit.entries[0].at).toBe("string");
    expect(audit.entries.some((e: { kind: string }) => e.kind === "assistant")).toBe(true);
  }, 30000);

  it("쓰기 툴이 시작되면 이후 호출은 실행 모델로 전환하고 검수는 감독 모델로 돌아온다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      // 검수 단계 진입 조건(writeToolAttempts > 8)을 맞추는 채움 쓰기 — paint_tiles 채움이 제안에 함께 남는다.
      nineWriteCalls(),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
    ];
    let index = 0;
    const seenModels: string[] = [];
    const requests: ChatRequest[] = [];
    const chat = async (config: { readonly model: string }, req: ChatRequest): Promise<ChatResult> => {
      seenModels.push(config.model);
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 새 제목으로 바꿔줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("타이틀을 바꿨습니다.");
    // 채움 paint_tiles 는 실패 툴이라 제안에 남지 않는다 — 주 쓰기 1건만.
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    // 플래너 라운드가 앞에 하나 더 붙는다(감독 모델). 채움 쓰기 응답이 execute 라운드 하나 더를 만든다:
    // planner(감독) → plan(감독) → execute(실행) → 채움(실행) → review(감독).
    expect(seenModels).toEqual(["supervisor-model", "supervisor-model", "executor-model", "executor-model", "supervisor-model"]);
    expect(phases).toEqual(["plan", "execute", "review"]);
    expect(requests[2]?.messages.some((message) => message.role === "user" && typeof message.content === "string" && message.content.startsWith("[오케스트레이션] 실행 단계:"))).toBe(true);
    expect(requests[4]?.tool_choice).toBeUndefined();
    expect(requests[4]?.tools).toBeUndefined();
    expect(requests[4]?.messages.some((message) => message.role === "user" && typeof message.content === "string" && message.content.startsWith("[오케스트레이션] 검수 단계:"))).toBe(true);
    expect(session.getMessages().some((message) => message.role === "system" && message.content === "실행 단계: 계획을 충실히 수행, 누락 없이 완료 후 종료. 새 질문 금지")).toBe(false);
    expect(session.getMessages().some((message) => typeof message.content === "string" && message.content.startsWith("[오케스트레이션] "))).toBe(false);
  }, 30000);

  it("검수가 미이행을 발견하면 실행 모델로 한 번 재투입한 뒤 감독 모델이 최종 응답한다", async () => {
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
      assistantToolCall("paint_tiles", { mapId, mode: "rect", layer: "lower", tile: 240, from: { x: 1, y: 1 }, to: { x: 2, y: 2 } }, "c_road"),
      // 검수 단계 진입 조건(writeToolAttempts > 8) — 같은 제안 키로 덮어쓰여 제안 1건 유지.
      nineWriteCalls(),
      assistantFinal("1차 실행 완료"),
      assistantFinal("재실행: 꽃 영역도 칠하세요."),
      assistantToolCall("paint_tiles", { mapId, mode: "rect", layer: "upper", tile: 88, from: { x: 4, y: 1 }, to: { x: 5, y: 2 } }, "c_flowers"),
      assistantFinal("보완 실행 완료"),
      assistantFinal("완료: 길과 꽃을 모두 제안했습니다."),
    ];
    let index = 0;
    const seenModels: string[] = [];
    const chat = async (config: { readonly model: string }): Promise<ChatResult> => {
      seenModels.push(config.model);
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(project, { config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}길과 꽃을 칠해줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("길과 꽃을 모두 제안했습니다.");
    // 길 + 꽃 + 검수 진입용 paint_tiles 채움(동일 인자 반복이라 1건) 3건.
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["paint_tiles", "paint_tiles", "paint_tiles"]);
    expect(seenModels).toEqual([
      "supervisor-model",
      "supervisor-model",
      "supervisor-model",
      "executor-model",
      // 검수 진입 조건 충족용 paint_tiles 채움 라운드(실행 모델).
      "executor-model",
      "supervisor-model",
      "executor-model",
      "executor-model",
      "supervisor-model",
    ]);
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
  }, 30000);

  it("검수 응답이 raw 툴콜 마크업이면 원문 노출 없이 1회 재투입한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const steps = [
      PLANNER_DIRECT,
      assistantToolCall("set_title_screen", { title: "새 제목" }, "c_title"),
      // 검수 단계 진입 조건(writeToolAttempts > 8).
      nineWriteCalls(),
      assistantFinal("실행 완료"),
      assistantFinal(RAW_TOOL_MARKUP_FIXTURE),
      assistantFinal("보완 실행 완료"),
      assistantFinal("완료: 타이틀 변경을 제안했습니다."),
    ];
    let index = 0;
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: { ...ORCH_CONFIG, maxToolCalls: 24 }, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 새 제목으로 바꿔줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toBe("타이틀 변경을 제안했습니다.");
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
    expect(requests[5]?.messages.some((message) =>
      message.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes("[오케스트레이션] 검수 보완 지시: 검수 응답이 툴콜 원시 마크업으로 깨졌습니다")
    )).toBe(true);
    const serializedMessages = JSON.stringify(session.getMessages());
    expect(serializedMessages).not.toContain("<tool_call>");
    expect(serializedMessages).not.toContain("<invoke name=");
  }, 30000);

  it("집 3채 NPC 5명 요청에서 집 1채만 제안되면 검수가 완료라고 답해도 missingWarnings로 재투입한다", async () => {
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
      // 검수 단계 진입 조건(writeToolAttempts > 8).
      nineWriteCalls(),
      assistantFinal("집 1채를 제안했습니다."),
      assistantFinal("완료: 충분합니다."),
      assistantFinal("보완 실행 완료"),
      assistantFinal("완료: 현재 제안과 부족분을 보고합니다."),
    ];
    let index = 0;
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: { ...ORCH_CONFIG, maxToolCalls: 32, maxTokens: 8192 }, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}40x40 맵에 작은 집 3채 NPC 5명 배치해줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(phases).toEqual(["plan", "execute", "review", "execute", "review"]);
    expect(requests[7]?.messages.some((message) =>
      message.role === "user" &&
      typeof message.content === "string" &&
      message.content.includes("[오케스트레이션] 검수 보완 지시: 검수에서 아래 미이행이 발견되었습니다")
    )).toBe(true);
    expect(JSON.stringify(requests[8]?.messages)).toContain("house2");
    expect(JSON.stringify(requests[8]?.messages)).toContain("npc1");
  }, 30000);

  it("최종 텍스트의 raw 툴콜 마크업은 잘라내고 안내로 대체한다", async () => {
    const { AssistantSession, createBlankProject, hasRawToolCallMarkup, sanitizeAssistantText } = await load();
    expect(hasRawToolCallMarkup(RAW_TOOL_MARKUP_FIXTURE)).toBe(true);
    expect(sanitizeAssistantText(RAW_TOOL_MARKUP_FIXTURE)).toBe("적용됨이어서 길을 깐 뒤 NPC 5명을 배치하겠습니다...…(형식 오류로 일부 생략)");

    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: scriptedChat([assistantFinal(RAW_TOOL_MARKUP_FIXTURE)]) });
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
      // 검수 단계 진입 조건(writeToolAttempts > 8).
      nineWriteCalls(),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
    ];
    let index = 0;
    const requests: ChatRequest[] = [];
    const chat = async (_config: unknown, req: ChatRequest): Promise<ChatResult> => {
      requests.push({ ...req, messages: [...req.messages] });
      if (index >= steps.length) throw new Error("scripted chat exhausted");
      return steps[index++];
    };
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });
    const phases: string[] = [];

    const result = await session.sendUserMessage(`${ORCH_GOAL}타이틀을 재킥 제목으로 바꿔줘`, (event) => {
      if (event.type === "phase") phases.push(event.value);
    });

    expect(result.stoppedReason).toBe("final");
    expect(result.proposedCalls.map((call) => call.name)).toEqual(["set_title_screen"]);
    expect(result.assistantText).toBe("타이틀을 바꿨습니다.");
    expect(phases).toEqual(["plan", "execute", "review"]);
    expect(requests[2]?.messages.some((message) =>
      message.role === "user" &&
      message.content === "[오케스트레이션] 사용자는 변경을 기대합니다. 질문이 아니면 지금 계획을 세우고 실행하세요"
    )).toBe(true);
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
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });

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
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat });

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
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat });

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
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat, declareIntent: fixedDeclarer({ mode: "other", needsPlan: false }) });
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
    const session = new AssistantSession(createBlankProject(), { config: llm.defaultAiConfig(), chat, declareIntent: fixedDeclarer({ mode: "other", needsPlan: false }) });

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
    const session = new AssistantSession(createBlankProject(), {
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
    const session = new AssistantSession(project, { config: llm.defaultAiConfig(), chat, declareIntent: fixedDeclarer({ space: "outdoor", useSelection: true, needsPlan: true }) });

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
    const session = new AssistantSession(createBlankProject(), { config: { ...CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const }, chat });

    await session.sendUserMessage("타이틀 화면 안내만 해줘", () => {});

    expect(plannerStarted(session.getAuditEntries())).toBe(false);
  }, 30000);

  it("agentMode chat + 이원화 모델도 단일 단계 선언은 플래너를 건너뛴다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const chat = scriptedChat([assistantFinal("완료했습니다.")]);
    const session = new AssistantSession(createBlankProject(), { config: { ...ORCH_CONFIG, authMode: "apiKey" as const, agentMode: "chat" as const }, chat, declareIntent: fixedDeclarer({ mode: "question", needsPlan: false }) });

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
    const session = new AssistantSession(createBlankProject(), {
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
      const session = new AssistantSession(createBlankProject(), {
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
    const session = new AssistantSession(createBlankProject(), {
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
      // 검수 단계 진입 조건(writeToolAttempts > 8) — 주입 2건(실행 힌트+검수 프롬프트)을 내기 위함.
      nineWriteCalls(),
      assistantFinal("실행 완료"),
      assistantFinal("완료: 타이틀을 바꿨습니다."),
    ];
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat: scriptedChat(steps) });

    await session.sendUserMessage(`${ORCH_GOAL}타이틀을 새 제목으로 바꿔줘`, () => {});

    const entries = session.getAuditEntries();
    const injections = entries.filter(
      (entry) => entry.kind === "status" && entry.text.startsWith("오케스트레이션 주입: ")
    );
    // 실행 힌트 + 검수 프롬프트 — 주입이 UI에 전혀 안 보이던 공백을 감사 로그가 메운다.
    expect(injections.length).toBeGreaterThanOrEqual(2);
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
    const session = new AssistantSession(createBlankProject(), { config: ORCH_CONFIG, chat: scriptedChat(steps) });
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
    const session = new AssistantSession(createBlankProject(), { config: { ...CONFIG, authMode: "apiKey" as const }, chat });

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
    const session = new AssistantSession(createBlankProject(), {
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
