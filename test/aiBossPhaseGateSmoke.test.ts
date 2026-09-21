// test/aiBossPhaseGateSmoke.test.ts
//
// 보스 페이즈 산출물 게이트의 세션 배선 스모크.
//
// 유닛 테스트(bossPhaseQuestOutcomeGate)는 게이트 함수만 본다. 여기서는 실제 세션 루프 +
// 실제 툴 실행기 + 가짜 LLM 으로, "페이즈를 깔았지만 시뮬을 안 돌렸다" 상태에서 항목이
// 자동 완료되지 않는지를 확인한다(추적 → 게이트 합성 배선까지 포함).
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import type { Project } from "@/project/types";

type ChatResult = import("@/ai/llmClient").ChatResult;

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

async function load() {
  const [assistantSession, ember] = await Promise.all([
    import("@/ai/assistantSession"),
    import("@/project/defaults/emberQuestGame"),
  ]);
  return { AssistantSession: assistantSession.AssistantSession, createEmberQuestProject: ember.createEmberQuestProject };
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

function scriptedChat(steps: readonly ChatResult[]): () => Promise<ChatResult> {
  let index = 0;
  return async () => (index < steps.length ? steps[index++]! : exhausted());
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

const TROOP = "troop_dragon";

/** 플래너 계약(workPlan 규칙 12)대로 시뮬을 완료 조건에 넣은 항목. */
const BOSS_PLAN = {
  goal: "드래곤 보스전에 페이즈 연출 추가",
  layers: [
    {
      title: "보스 페이즈",
      items: [
        {
          title: "드래곤 2단 페이즈 저작",
          instruction: "author_boss_phases로 HP 70%/30% 페이즈를 깔고 simulate_battle로 발동을 확인한다",
          doneWhen: "두 페이즈가 시뮬에서 실제로 발동함",
          successTools: ["author_boss_phases"],
        },
      ],
    },
  ],
};

const authorCall = (id: string) =>
  toolCallResult(
    "author_boss_phases",
    {
      troopId: TROOP,
      phases: [
        { atHpPercent: 70, name: "1차 각성", message: "제법이군…" },
        { atHpPercent: 30, name: "광폭화", message: "끝이다!" },
      ],
    },
    id,
  );

const statusTexts = (session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] =>
  session.getAuditEntries().filter((entry) => entry.kind === "status").map((entry) => String(entry.text));

describe("보스 페이즈 게이트 통합 스모크", () => {
  it("페이즈만 깔고 시뮬을 안 돌리면 항목이 자동 완료되지 않는다", async () => {
    const { AssistantSession, createEmberQuestProject } = await load();
    const project = createEmberQuestProject();
    installHermeticEnv(project);
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "new_plan", ...BOSS_PLAN })),
        toolCallResult("set_work_plan", BOSS_PLAN, "c_plan"),
        authorCall("c_phases"),
        finalResult("보스 페이즈를 깔았습니다."),
      ]),
    });

    await session.sendUserMessage("드래곤 보스에 페이즈 연출 넣어줘", () => {}, undefined, { autonomous: true });

    const blocked = statusTexts(session).filter((text) => text.includes("자동 완료 차단"));
    expect(blocked.length).toBeGreaterThan(0);
    expect(blocked.some((text) => text.includes("simulate_battle"))).toBe(true);
    // 페이지는 실제로 저장돼 있다 — 막힌 이유는 "발동 확인 없음" 뿐이다.
    const troop = session.getProposedProject().database.troops.find((entry) => entry.id === TROOP)!;
    expect((troop.battleEventPages ?? []).length).toBe(2);
  }, 30000);

  it("같은 항목에서 simulate_battle 을 돌리면 페이즈 게이트가 열린다", async () => {
    const { AssistantSession, createEmberQuestProject } = await load();
    const project = createEmberQuestProject();
    installHermeticEnv(project);
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "new_plan", ...BOSS_PLAN })),
        toolCallResult("set_work_plan", BOSS_PLAN, "c_plan"),
        authorCall("c_phases"),
        toolCallResult("simulate_battle", { troopId: TROOP, heroLevel: 3, n: 10, seed: 31337 }, "c_sim"),
        finalResult("페이즈 발동까지 확인했습니다."),
      ]),
    });

    await session.sendUserMessage("드래곤 보스에 페이즈 연출 넣어줘", () => {}, undefined, { autonomous: true });

    // 페이즈 사유로는 더 이상 막히지 않는다(완성도 경고 같은 다른 게이트는 이 테스트의 관심사가 아니다).
    const statuses = statusTexts(session);
    // 저작 직후에는 한 번 막히고(근거 없음), 시뮬을 돌린 라운드에서 열린다.
    const blockedAt = statuses.findIndex((text) => text.includes("자동 완료 차단") && text.includes("simulate_battle"));
    const completedAt = statuses.findIndex((text) => text.includes("WorkPlan 자동 완료: 드래곤 2단 페이즈 저작"));
    expect(blockedAt).toBeGreaterThanOrEqual(0);
    expect(completedAt).toBeGreaterThan(blockedAt);
    // 차단 사유가 모델에게도 다시 주입돼야 다음 라운드에 시뮬을 돌린다.
    expect(statuses.some((text) => text.startsWith("오케스트레이션 주입: HARNESS: 항목") && text.includes("simulate_battle"))).toBe(true);
  }, 30000);
});
