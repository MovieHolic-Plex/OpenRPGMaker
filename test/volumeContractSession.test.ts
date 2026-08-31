// 볼륨 계약은 사용자 「계속」이 아니라 코드가 턴을 붙잡는다.
// planner:direct 거부 · 한 줄 NPC 종료 재주입을 세션 루프로 증명한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@/project/types";
import { store } from "@/project/store";
import { resetMapEditHistory } from "@/editor/mapEditHistory";

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
  maxToolCalls: 6,
  maxTokens: 512,
};

function statusTexts(session: { getAuditEntries(): readonly { kind: string; text?: string }[] }): string[] {
  return session.getAuditEntries().filter((entry) => entry.kind === "status").map((entry) => String(entry.text));
}

function installHermetic(project: Project): void {
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "rpg-zzu-test-project");
  vi.stubEnv("VITE_SUPABASE_URL", "http://dbserver:8100");
  vi.stubGlobal("fetch", (async () => new Response(null, { status: 201 })) satisfies typeof fetch);
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
}

describe("볼륨 계약 세션 — 코드가 오케스트레이션한다", () => {
  it("마을 요청에서 planner:direct 를 거부하고 WorkPlan 을 강제한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermetic(project);
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "direct", reason: "한 턴으로 충분" })),
        finalResult("마을을 만들었습니다."),
        finalResult("정말 끝났습니다."),
        finalResult("더 없습니다."),
      ]),
    });

    await session.sendUserMessage("빈 프로젝트에 강이 있는 마을을 하나 만들고 집 8채를 지어줘", () => {});

    const statuses = statusTexts(session);
    expect(statuses.some((text) => text.startsWith("planner:direct-rejected"))).toBe(true);
    expect(session.getWorkPlan()).toBeTruthy();
    expect(session.getWorkPlan()!.layers.flatMap((layer) => layer.items).length).toBeGreaterThanOrEqual(2);
    expect(statuses.some((text) => text.includes("ralph:continue") || text.includes("volume-contract:continue"))).toBe(true);
  }, 30000);

  it("한 줄 NPC 로 끝내면 사용자 「계속」 없이 볼륨 재주입한다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermetic(project);
    const session = new AssistantSession(project, {
      config: { ...CONFIG, maxToolCalls: 4 },
      chat: scriptedChat([
        toolCallResult(
          "place_npc",
          {
            mapId: "map_blank_start",
            x: 4,
            y: 4,
            name: "촌장",
            pages: [{ lines: ["마을에 온 걸 환영하네."] }],
          },
          "c_npc",
        ),
        finalResult("촌장을 배치했습니다."),
        finalResult("할 일이 없습니다."),
      ]),
    });

    await session.sendUserMessage("촌장 NPC 만들어줘", () => {});

    const statuses = statusTexts(session);
    expect(statuses.some((text) => text.startsWith("volume-contract:continue"))).toBe(true);
    expect(statuses.some((text) => text.includes("이어서 진행하려면 **「계속」**"))).toBe(false);
  }, 30000);

  it("볼륨과 무관한 한 줄 요청은 direct 를 존중하고 재주입하지 않는다", async () => {
    const { AssistantSession, createBlankProject } = await load();
    const project = createBlankProject();
    installHermetic(project);
    const session = new AssistantSession(project, {
      config: CONFIG,
      chat: scriptedChat([
        finalResult(JSON.stringify({ action: "direct", reason: "한 턴" })),
        finalResult("타이틀을 바꿨습니다."),
        finalResult("확인했습니다."),
      ]),
    });

    const recapEvents: string[] = [];
    const result = await session.sendUserMessage("이 작업을 단계로 진행해줘. 타이틀을 새 제목으로 바꿔줘", (event) => {
      if (event.type === "run_recap") recapEvents.push("run_recap");
    });

    const statuses = statusTexts(session);
    expect(statuses.some((text) => text.startsWith("planner:direct-rejected"))).toBe(false);
    expect(statuses.some((text) => text.startsWith("volume-contract:continue"))).toBe(false);
    expect(result.stoppedReason).toBe("final");
    expect(result.recap).toBeTruthy();
    expect(result.recap!.usage.calls).toBeGreaterThan(0);
    expect(statuses.some((text) => text.startsWith("run-recap "))).toBe(true);
    expect(recapEvents).toEqual(["run_recap"]);
  }, 30000);
});
