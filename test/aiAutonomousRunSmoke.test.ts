// test/aiAutonomousRunSmoke.test.ts
// todo 7 — 자율 런 통합 스모크.
//
// 작은 목표("빈 맵에 집 하나 지어줘")를 실제 세션 루프 + 실제 툴 실행기 + 가짜 LLM
// (scriptedChat 패턴, test/aiAssistantSession.test.ts 와 동일)으로 한 번에 돌려
// plan → build → verify → apply → save-audit 전체 생명주기가 발화함을 증명한다.
// 라이브 LLM/API 키는 사용하지 않는다(결정적, CI-safe, 타이밍 대기 없음).
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import type { SessionEvent } from "@/ai/assistantSession";

const SMOKE_TEST_ENV = {
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  VITE_SUPABASE_PROJECT_ID: "rpg-zzu-test-project",
  VITE_SUPABASE_URL: "http://dbserver:8100",
} as const;

function stubSupabaseEnv(): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", SMOKE_TEST_ENV.VITE_SUPABASE_ANON_KEY);
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", SMOKE_TEST_ENV.VITE_SUPABASE_PROJECT_ID);
  vi.stubEnv("VITE_SUPABASE_URL", SMOKE_TEST_ENV.VITE_SUPABASE_URL);
}

/** 헤르메틱 env: 실제 Supabase fetch 금지 + remote persistence OFF + 빈 스토어. */
function installHermeticEnv(project: Project): void {
  stubSupabaseEnv();
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
  return {
    AssistantSession: assistantSession.AssistantSession,
    createBlankProject: defaults.createBlankProject,
  };
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

/** 스크립트 소진 시 영구 오류 — 일시 오류 재시도(백오프)로 늘어지지 않게 즉시 실패. */
function exhausted(): never {
  throw new (class extends Error {
    readonly status = 401;
    constructor() {
      super("scripted chat exhausted");
      this.name = "LlmError";
    }
  })();
}

const ORCH_CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "supervisor-model",
  liteModel: "executor-model",
  apiKey: "sk",
  maxToolCalls: 8,
  maxTokens: 512,
};

// 주의: "빈 맵에 집 하나 지어줘"(무표지)는 의도 확인 게이트(intentClarify house-vs-interior)가
// LLM 호출 전에 되묻는다 — 드라이버는 질문에 자동 송신하지 않는다(todo 2 사용자 우선 계약).
// 스모크의 생명주기 증명은 "야외" 표지로 경로가 확정된 변형을 쓴다(아래 pause 테스트가
// 무표지 게이트 동작을 별도로 고정한다).
// 추가로 author_house 는 공간 빌드 스펙 게이트(SPATIAL_BUILD_TOOLS) 대상이다 — 실제 패널이
// 사용자 맵 선택 영역을 [컨텍스트] 푸터로 붙여 보내는 것과 동일하게 선택 영역 푸터를 넣어
// 암묵적 명세(implicitSpecFromContext)를 만든다.
const HOUSE_GOAL_AMBIGUOUS = "빈 맵에 집 하나 지어줘";
const selectionFooter = (mapId: string, mapName: string): string =>
  `[컨텍스트] 현재 맵: ${mapName} (${mapId}) · 사용자 선택 영역: (0,0) 20×15`;
const houseGoal = (mapId: string, mapName: string): string =>
  `빈 맵에 야외 집 하나 지어줘\n\n${selectionFooter(mapId, mapName)}`;
const HOUSE_TITLE = "내 집 마을";
const HOUSE_KIT = "blue-stone";

/**
 * 2레이어 계획: L1 "집 짓기"(map/world → run_lint + evaluate_game_quality),
 * L2 "마무리"(final → run_lint). L1 이 final 이 아니어야 map 검증 툴이 발화한다
 * (classifyLayer: isFinal 우선 — 단일 레이어 계획이면 전부 final 로 분류됨).
 */
function housePlan(mapId: string): Record<string, unknown> {
  return {
    goal: `빈 맵에 야외 집 하나 지어줘`,
    layers: [
      {
        title: "집 짓기",
        items: [{ title: "집 시공", instruction: `author_house {mapId:'${mapId}'}`, successTools: ["author_house"] }],
      },
      {
        title: "마무리",
        items: [{ title: "타이틀 확정", instruction: `set_title_screen {title:'${HOUSE_TITLE}'}`, successTools: ["set_title_screen"] }],
      },
    ],
  };
}

function houseSteps(plan: Record<string, unknown>, mapId: string): ChatResult[] {
  return [
    finalResult(JSON.stringify({ action: "new_plan", ...plan })),
    toolCallResult("set_work_plan", plan, "c_plan"),
    toolCallResult(
      "author_house",
      {
        kind: "single",
        mapId,
        kitId: HOUSE_KIT,
        wings: [{ x: 2, y: 1, w: 5, h: 6 }],
        interior: "exterior-only",
        door: true,
      },
      "c_house",
    ),
    toolCallResult("set_title_screen", { title: HOUSE_TITLE }, "c_title"),
    finalResult("모든 레이어를 완료했습니다."),
  ];
}

const statusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
  session.getAuditEntries().filter((e) => e.kind === "status").map((e) => String(e.text));

describe("자율 런 통합 스모크 (todo 7)", () => {
  it("무표지 집 요청은 의도 확인 게이트에서 일시정지한다 — LLM 호출 없음, 자동 송신 없음", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      throw new Error("LLM은 호출되면 안 된다 — 의도 확인 게이트가 먼저 막는다");
    };
    const session = new AssistantSession(project, { config: ORCH_CONFIG, chat });

    const result = await session.sendUserMessage(HOUSE_GOAL_AMBIGUOUS, () => {}, undefined, { autonomous: true });

    expect(calls).toBe(0);
    expect(result.stoppedReason).toBe("final");
    expect(result.assistantText).toContain("야외 집(외장)으로");
    const audits = statusTexts(session);
    expect(audits.some((t) => t.includes("의도 확인"))).toBe(true);
    // 드라이버는 질문 턴에 자동 계속하지 않는다(사용자 우선).
    expect(audits.some((t) => t.includes("agent_run:auto-continue"))).toBe(false);
  }, 30000);

  it("작은 목표 — plan→build→verify→apply→save-audit 전체 생명주기 (remote OFF → agent_run_local_only)", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const mapId = project.startMapId;
    const plan = housePlan(mapId);
    const steps = houseSteps(plan, mapId);
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: ORCH_CONFIG, chat });
    const events: SessionEvent[] = [];
    const goal = houseGoal(mapId, project.maps[mapId]!.name);

    const result = await session.sendUserMessage(goal, (event) => { events.push(event); }, undefined, { autonomous: true });

    // 1) 플래너: new_plan → 계획 등록(emitWorkPlan 이벤트 + set_work_plan 실행).
    expect(events.some((e) => e.type === "work_plan")).toBe(true);
    const toolCalls = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    // set_work_plan → author_house → [L1 map 검증: run_lint, evaluate_game_quality]
    //   → set_title_screen → [L2 final 검증: run_lint]
    expect(toolCalls.map((e) => e.name)).toEqual([
      "set_work_plan",
      "author_house",
      "run_lint",
      "evaluate_game_quality",
      "set_title_screen",
      "run_lint",
    ]);

    // 2) 쓰기 툴(집 시공)이 실제로 성공했다.
    const houseCall = toolCalls.find((e) => e.name === "author_house")!;
    expect(houseCall.result.ok).toBe(true);

    // 3) 레이어 검증 게이트: 2개 레이어 모두 pass.
    const audits = statusTexts(session);
    expect(audits.filter((t) => t.includes("agent_run:verification-pass")).length).toBe(2);
    expect(audits.some((t) => t.includes("agent_run:verification_failed"))).toBe(false);

    // 4) 마일스톤 자동 적용: 항목 완료마다 applyProposedProject 경로가 발화한다.
    const milestones = events.filter((e) => e.type === "milestone_applied");
    expect(milestones.map((m) => m.title)).toEqual(["집 시공", "타이틀 확정"]);
    expect(milestones.every((m) => m.toolCount === 1)).toBe(true);
    expect(audits.filter((t) => t.includes("agent_run:milestone-applied")).length).toBe(2);

    // 5) run-end 저장 감사: remote 비활성 → agent_run_local_only(오류 없음).
    expect(audits.some((t) => t.includes("agent_run_local_only"))).toBe(true);
    expect(audits.some((t) => t.includes("agent_run_saved"))).toBe(false);
    expect(audits.some((t) => t.includes("agent_run:save-failed"))).toBe(false);

    // 6) 최종 결과 + 스토어 반영: 타이틀 변경 + 집 타일이 실제로 적용됐다.
    expect(result.stoppedReason).toBe("final");
    expect(store.getCurrent().meta?.title).toBe(HOUSE_TITLE);
    const beforeTiles = project.maps[mapId]!.lowerTiles.join(",");
    const afterTiles = store.getCurrent().maps[mapId]!.lowerTiles.join(",");
    expect(afterTiles).not.toBe(beforeTiles);
    // 결정성: 스크립트가 정확히 소진됐다(자동 계속/추가 호출 없음).
    expect(index).toBe(steps.length);
  }, 60000);

  it("remote enabled(mocked) → run-end 저장 증명 agent_run_saved(projectId+sha256), flush/reload 1회씩", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const mapId = project.startMapId;
    const plan = housePlan(mapId);
    const steps = houseSteps(plan, mapId);
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const flushSpy = vi.spyOn(store, "flush").mockResolvedValue({ kind: "saved", sha256: "sha-smoke-123" });
    const reloadSpy = vi.spyOn(store, "reloadFromRemote").mockResolvedValue({
      kind: "reloaded",
      projectId: SMOKE_TEST_ENV.VITE_SUPABASE_PROJECT_ID,
      title: HOUSE_TITLE,
    });
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(true);
    const session = new AssistantSession(project, { config: ORCH_CONFIG, chat });
    const goal = houseGoal(mapId, project.maps[mapId]!.name);

    const result = await session.sendUserMessage(goal, () => {}, undefined, { autonomous: true });

    expect(result.stoppedReason).toBe("final");
    // run-end 게이트: flush → reloadFromRemote 순서로 정확히 1회씩.
    expect(flushSpy).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    const audits = statusTexts(session);
    const saved = audits.find((t) => t.includes("agent_run_saved"));
    expect(saved).toBeTruthy();
    expect(saved!).toContain(`projectId=${SMOKE_TEST_ENV.VITE_SUPABASE_PROJECT_ID}`);
    expect(saved!).toContain("sha256=sha-smoke-123");
    // commitId 증거 경로: list_project_commits 는 브라우저 전용 툴 — node 에선 우아하게 기록된다.
    expect(audits.some((t) => t.includes("agent_run:commit-evidence-unavailable"))).toBe(true);
    // 전체 생명주기도 동일하게 발화했다(remote 모드에서도).
    const statuses = statusTexts(session);
    expect(statuses.filter((t) => t.includes("agent_run:verification-pass")).length).toBe(2);
    expect(statuses.filter((t) => t.includes("agent_run:milestone-applied")).length).toBe(2);
    expect(index).toBe(steps.length);
  }, 60000);
});

describe("파괴적 마일스톤 pause 계약 (todo 8 실측 회귀)", () => {
  it("reset_project(파괴적) 마일스톤은 pause 되고 이후 마일스톤 적용은 감사 로그와 함께 중단된다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const mapId = project.startMapId;
    // L1: reset_project(파괴적) → 승인 필요. L2: 이후 항목은 pause 해제 전까지 적용 금지.
    const plan = {
      goal: "프로젝트 초기화 후 집 짓기",
      layers: [
        {
          title: "초기화",
          items: [{ title: "프로젝트 초기화", instruction: "reset_project {prompt:'새 시작', title:'새 세계'}", successTools: ["reset_project"] }],
        },
        {
          title: "집 짓기",
          items: [{ title: "집 시공", instruction: `author_house {mapId:'${mapId}'}`, successTools: ["author_house"] }],
        },
      ],
    };
    const steps = [
      finalResult(JSON.stringify({ action: "new_plan", ...plan })),
      toolCallResult("set_work_plan", plan, "c_plan"),
      toolCallResult("reset_project", { prompt: "새 시작", title: "새 세계" }, "c_reset"),
      // pause 후에도 모델이 다음 항목을 시도하지만 — 적용은 되지 않아야 한다.
      toolCallResult(
        "author_house",
        {
          kind: "single",
          mapId,
          kitId: HOUSE_KIT,
          wings: [{ x: 2, y: 1, w: 5, h: 6 }],
          interior: "exterior-only",
          door: true,
        },
        "c_house",
      ),
      finalResult("완료했습니다."),
    ];
    let index = 0;
    const chat = async (): Promise<ChatResult> => {
      if (index >= steps.length) exhausted();
      return steps[index++]!;
    };
    const session = new AssistantSession(project, { config: ORCH_CONFIG, chat });
    const events: SessionEvent[] = [];

    await session.sendUserMessage(
      "프로젝트를 초기화하고 야외 집을 지어줘\n\n" + selectionFooter(mapId, project.maps[mapId]!.name),
      (event) => { events.push(event); },
      undefined,
      { autonomous: true },
    );

    const audits = statusTexts(session);
    // 1) reset_project 마일스톤이 pause 되고 카드 이벤트가 났다.
    expect(events.some((e) => e.type === "proposal_paused")).toBe(true);
    expect(audits.some((t) => t.includes("agent_run:milestone-paused"))).toBe(true);
    // 2) pause 후 진행된 항목은 적용되지 않았고, 그 사실이 감사 로그에 남는다(조용한 누락 금지).
    expect(audits.some((t) => t.includes("agent_run:milestone-skipped-paused"))).toBe(true);
    expect(events.some((e) => e.type === "milestone_applied")).toBe(false);
    // 3) 드라이버는 pause 상태에서 자동 계속하지 않는다.
    expect(audits.some((t) => t.includes("agent_run:paused-approval"))).toBe(true);
    // 4) 스토어에는 파괴적 마일스톤이 적용되지 않았다(타이틀 유지 — reset_project 미적용).
    expect(store.getCurrent().meta?.title).toBe(project.meta?.title ?? "RPG Zzu");
  }, 60000);
});
