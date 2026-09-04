// test/aiWorkItemStall.test.ts
// 진행이 멈춘 항목을 사람에게 넘기는 계약 (2026-09-03).
//
// 왜 있는가(실측): 빈 맵에서 `fill_region` 이 스펙 게이트에 막히자 Ralph 가 같은 항목을 **173/256** 번
// 재주입했다. 사용자에게는 「Ralph 연속 실행 (173/256)」 한 줄만 보였고 런은 끝나지 않았다.
// 이 파일이 지키는 것:
//   (a) 같은 항목에서 연속 3번 헛되이 나가려 하면 항목을 blocked 로 표시하고 턴을 끝낸다.
//   (b) 자율 드라이버는 막힌 항목에서 자동 계속하지 않는다.
//   (c) 사용자의 다음 메시지가 막힌 항목을 되살린다(드라이버의 합성 「계속」은 되살리지 않는다).
//   (d) 쓰기가 성공하면 그 항목의 시도 수가 0으로 돌아간다 — 여러 턴에 걸친 정상 진행은 막히지 않는다.
//   (e) 이름이 어긋난 successTools 로 교착되지 않게, 명시 complete_work_item 은 성공한 쓰기를 근거로 인정한다.
//
// 실제 세션 루프 + 실제 툴 실행기 + 가짜 LLM(scriptedChat, aiAutonomousRunSmoke 와 같은 패턴).
// 라이브 LLM/API 키 없음, 타이밍 대기 없음.
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { MAX_RALPH_ATTEMPTS_PER_ITEM } from "@/ai/workPlan";
import { fixedDeclarer } from "./intentFixture";

type ChatResult = import("@/ai/llmClient").ChatResult;

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

const CONFIG = {
  authMode: "apiKey" as const,
  agentMode: "auto" as const,
  baseUrl: "x",
  model: "supervisor-model",
  liteModel: "executor-model",
  apiKey: "sk",
  maxToolCalls: 12,
  maxTokens: 4096,
};

function toolCall(name: string, args: unknown, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function final(text: string): ChatResult {
  return { message: { role: "assistant" as const, content: text }, finishReason: "stop" } as ChatResult;
}

/** 대본이 소진되면 영구 오류로 즉시 끝낸다(일시 오류 재시도 백오프로 늘어지지 않게). */
function exhausted(): never {
  throw new (class extends Error {
    readonly status = 401;
    constructor() {
      super("scripted chat exhausted");
      this.name = "LlmError";
    }
  })();
}

/** 대본을 순서대로 돌려주되, 소진 후 몇 번까지는 「끝났습니다」로 답하는 chat(Ralph 재주입 관측용). */
function scriptedChat(steps: readonly ChatResult[], padding: ChatResult | null = null) {
  const state = { calls: 0 };
  const chat = async (): Promise<ChatResult> => {
    const step = steps[state.calls];
    state.calls += 1;
    if (step) return step;
    if (padding) return padding;
    exhausted();
  };
  return { chat, state };
}

const statusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
  session.getAuditEntries().filter((e) => e.kind === "status").map((e) => String(e.text));

/** successTools 가 이 대본에서 절대 성공하지 않는 1항목 계획 — 교착을 결정적으로 만든다. */
const STUCK_PLAN = {
  goal: "연못 만들기",
  layers: [
    {
      title: "연못",
      items: [{ title: "연못 채우기", instruction: "fill_region 으로 광장에 연못", successTools: ["fill_region"] }],
    },
  ],
};

const planDeclarer = fixedDeclarer({ needsPlan: true, mode: "create" });

describe("진행이 멈춘 항목은 사람에게 넘긴다", () => {
  it("(a)(b) 같은 항목에서 연속 3번 헛되이 나가면 blocked 로 표시하고 턴을 끝낸다 — 드라이버도 멈춘다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    // 계획을 세운 뒤에는 계속 「끝났습니다」만 답한다 — Ralph 가 재주입하는 상황 그대로.
    const { chat, state } = scriptedChat(
      [final(JSON.stringify({ action: "new_plan", ...STUCK_PLAN })), toolCall("set_work_plan", STUCK_PLAN, "c_plan")],
      final("끝났습니다."),
    );
    const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: planDeclarer });

    const result = await session.sendUserMessage("광장에 연못 만들어줘", () => {}, undefined, { autonomous: true });

    const audits = statusTexts(session);
    const item = result.workPlan?.layers[0]?.items[0];
    expect(item?.status).toBe("blocked");
    expect(item?.note ?? "").toContain("fill_region");
    const stalled = audits.find((t) => t.startsWith("ralph:stalled"));
    expect(stalled).toBeTruthy();
    expect(stalled!).toContain(`attempts=${MAX_RALPH_ATTEMPTS_PER_ITEM}/${MAX_RALPH_ATTEMPTS_PER_ITEM}`);
    expect(result.assistantText).toContain("연못 채우기");
    expect(result.assistantText).toContain("건너뛰기");
    expect(result.stoppedReason).toBe("final");
    expect(audits.some((t) => t.includes("agent_run:auto-continue"))).toBe(false);
    // 그리고 이것이 요점이다 — 173번이 아니라 손에 꼽는 왕복에서 끝난다.
    expect(state.calls).toBeLessThan(12);
  }, 30000);

  it("(a-2) 같은 쓰기 툴이 같은 이유로 반복 실패하면 Ralph 신호 없이도 막힌다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const mapId = project.startMapId;
    // 모델이 나가려 하지 않고 같은 쓰기를 계속 시도한다 — 스펙 게이트가 매번 같은 이유로 거부한다.
    // 이 경로는 Ralph(모델의 종료 시도)를 한 번도 태우지 않으므로 별도 상한이 필요하다.
    const plan = {
      goal: "연못 만들기",
      layers: [{ title: "연못", items: [{ title: "연못 채우기", instruction: "fill_region", successTools: ["fill_region"] }] }],
    };
    const fill = toolCall(
      "fill_region",
      { mapId, rect: { x: 2, y: 2, w: 4, h: 4 }, material: "물", shape: "circle", layer: "lower", reason: "연못" },
      "c_fill",
    );
    const { chat, state } = scriptedChat(
      [final(JSON.stringify({ action: "new_plan", ...plan })), toolCall("set_work_plan", plan, "c_plan")],
      fill,
    );
    const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: planDeclarer });

    const result = await session.sendUserMessage("광장에 연못 만들어줘", () => {}, undefined, { autonomous: true });

    const audits = statusTexts(session);
    const stalled = audits.find((t) => t.startsWith("tool-failure:stalled"));
    expect(stalled).toBeTruthy();
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("blocked");
    expect(result.workPlan?.layers[0]?.items[0]?.note ?? "").toContain("스펙 게이트");
    expect(result.assistantText).toContain("막혔습니다");
    expect(result.stoppedReason).toBe("final");
    expect(audits.some((t) => t.includes("agent_run:auto-continue"))).toBe(false);
    // 라운드 상한(12)까지 태우지 않고 몇 번 만에 끝난다.
    expect(state.calls).toBeLessThan(10);
  }, 30000);

    it("(c) 사용자의 다음 메시지가 막힌 항목을 되살린다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const { chat } = scriptedChat(
      [final(JSON.stringify({ action: "new_plan", ...STUCK_PLAN })), toolCall("set_work_plan", STUCK_PLAN, "c_plan")],
      final("끝났습니다."),
    );
    const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: planDeclarer });

    const first = await session.sendUserMessage("광장에 연못 만들어줘", () => {}, undefined, { autonomous: true });
    expect(first.workPlan?.layers[0]?.items[0]?.status).toBe("blocked");

    const auditsBefore = statusTexts(session).length;
    const second = await session.sendUserMessage("연못 말고 그냥 풀밭으로 해줘", () => {}, undefined, { autonomous: true });

    const newAudits = statusTexts(session).slice(auditsBefore);
    expect(newAudits.some((t) => t.startsWith("work-item:reactivated"))).toBe(true);
    // 되살아난 항목은 다시 진행 대상이 되고, 다시 막히면 또 사람에게 넘어온다(무한 루프 없음).
    expect(second.workPlan?.layers[0]?.items[0]?.status).toBe("blocked");
    expect(statusTexts(session).filter((t) => t.startsWith("ralph:stalled")).length).toBe(2);
  }, 30000);

  it("(d) 쓰기가 성공하면 그 항목의 시도 수가 0으로 돌아간다 — 헛도는 사이 진행한 항목은 막히지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    const plan = {
      goal: "타이틀 다듬기",
      layers: [
        {
          title: "타이틀",
          items: [{ title: "제목 확정", instruction: "set_title_screen", successTools: ["set_title_screen"] }],
        },
      ],
    };
    // 헛된 종료 2회 → 쓰기 성공(시도 수 리셋) → 헛된 종료 2회 → 쓰기로 완료.
    const { chat } = scriptedChat([
      final(JSON.stringify({ action: "new_plan", ...plan })),
      toolCall("set_work_plan", plan, "c_plan"),
      final("끝났습니다."),
      final("끝났습니다."),
      toolCall("set_title_screen", { title: "중간" }, "c_mid"),
      final("모두 끝났습니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: planDeclarer });

    const result = await session.sendUserMessage("타이틀 좀 다듬어줘", () => {}, undefined, { autonomous: true });

    const audits = statusTexts(session);
    expect(audits.some((t) => t.startsWith("ralph:stalled"))).toBe(false);
    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
    expect(store.getCurrent().meta?.title).toBe("중간");
  }, 30000);

  it("(e) 이름이 어긋난 successTools 여도 명시 complete_work_item 은 성공한 쓰기를 근거로 통과한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermeticEnv(project);
    // 계획은 fill_region 을 요구하는데 모델은 set_title_screen 을 쓴다 — 옛 계약이면 영원히 완료 불가.
    const { chat } = scriptedChat([
      final(JSON.stringify({ action: "new_plan", ...STUCK_PLAN })),
      toolCall("set_work_plan", STUCK_PLAN, "c_plan"),
      toolCall("set_title_screen", { title: "연못 광장" }, "c_title"),
      toolCall("complete_work_item", { note: "다른 툴로 처리함" }, "c_done"),
      final("끝냈습니다."),
    ]);
    const session = new AssistantSession(project, { config: CONFIG, chat, declareIntent: planDeclarer });

    const result = await session.sendUserMessage("광장에 연못 만들어줘", () => {}, undefined, { autonomous: true });

    expect(result.workPlan?.layers[0]?.items[0]?.status).toBe("done");
    const audits = statusTexts(session);
    const evidence = audits.find((t) => t.startsWith("work-item:complete-by-write-evidence"));
    expect(evidence).toBeTruthy();
    expect(evidence!).toContain("fill_region");
    expect(audits.some((t) => t.startsWith("ralph:stalled"))).toBe(false);
  }, 30000);
});
