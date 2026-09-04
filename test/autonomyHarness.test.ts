// 자율성 다이얼 하네스 배선 계약.
//
// 다이얼(confirm|balanced|autonomous|max)은 설정의 정본이지만, **명시됐을 때만** 동작을
// 바꾼다 — autonomyLevel 없는 주입 config/구형 blob 은 종래 상한·플래너 그대로다.
// 문장(description)은 고정하지 않는다 — 기계가 소비하는 값(상한·모드·planOnly)만 단언한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fixedDeclarer } from "./intentFixture";

import {
  AI_CONFIG_STORAGE_KEY,
  defaultAiConfig,
  loadAiConfig,
  saveAiConfig,
  type ChatResult,
} from "@/ai/llmClient";
import { resolveAutonomy, type AutonomyLevel } from "@/ai/autonomyLevels";
import { AssistantSession } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";

let configStore: Map<string, string>;

beforeEach(() => {
  configStore = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => (configStore.has(k) ? configStore.get(k)! : null),
    setItem: (k: string, v: string) => void configStore.set(k, String(v)),
    removeItem: (k: string) => void configStore.delete(k),
    clear: () => configStore.clear(),
  };
});

afterEach(() => {
  delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
  vi.restoreAllMocks();
});

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

const BASE = {
  authMode: "apiKey" as const,
  baseUrl: "x",
  model: "stub-model",
  liteModel: "stub-model",
  apiKey: "sk",
  maxToolCalls: 2000,
  maxTokens: 512,
  agentMode: "chat" as const,
};

describe("자율성 다이얼 — 설정 round-trip", () => {
  it("기본값은 balanced 이다", () => {
    expect(defaultAiConfig().autonomyLevel).toBe("balanced");
  });

  it("save 후 load 가 레벨을 살린다", () => {
    saveAiConfig({ ...defaultAiConfig(), autonomyLevel: "max" });
    expect(loadAiConfig().autonomyLevel).toBe("max");
  });

  it("없는 옛 blob·이상한 값은 balanced 로 정규화한다", () => {
    configStore.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ model: "stub-model" }));
    expect(loadAiConfig().autonomyLevel).toBe("balanced");
    configStore.set(AI_CONFIG_STORAGE_KEY, JSON.stringify({ autonomyLevel: "turbo" }));
    expect(loadAiConfig().autonomyLevel).toBe("balanced");
  });
});

describe("자율성 다이얼 — 하네스 동작", () => {
  it("confirm 은 턴루프 상한을 6으로 깎는다", async () => {
    // Break: 레벨 상한이 없으면 maxToolCalls=2000 그대로 2000회가 아니라 chat 소진(401)으로 죽는다.
    // confirm 은 플래너를 먼저 돌리므로(planOnly) 대본 첫 응답은 플래너용 direct — 툴콜 6회만 센다.
    const DIRECT_JSON = JSON.stringify({ action: "direct", reason: "한 턴으로 충분" });
    let toolCalls = 0;
    let plannerCalls = 0;
    const chat = async (_config: unknown, req: { tools?: readonly unknown[] }): Promise<ChatResult> => {
      if ((req.tools ?? []).length === 0) {
        plannerCalls += 1;
        return finalResult(DIRECT_JSON);
      }
      toolCalls += 1;
      return toolCallResult("get_project_summary", {}, `c${toolCalls}`);
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...BASE, autonomyLevel: "confirm" as AutonomyLevel },
      chat,
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: true }),
    });
    const result = await session.sendUserMessage("계속 조회해", () => {});
    expect(result.stoppedReason).toBe("max-tool-calls");
    expect(plannerCalls).toBe(1);
    expect(toolCalls).toBe(resolveAutonomy("confirm").budgetCap);
  });

  it("max 는 같은 대본을 48회까지 돌린다", async () => {
    // 턴루프 48라운드 + 루프 밖 검수 1회 = chat 49회. 상한이 재는 것은 툴 라운드 48회다.
    let toolCalls = 0;
    const chat = async (_config: unknown, req: { tools?: readonly unknown[] }): Promise<ChatResult> => {
      if ((req.tools ?? []).length === 0) return finalResult("검수 완료.");
      toolCalls += 1;
      return toolCallResult("get_project_summary", {}, `c${toolCalls}`);
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...BASE, autonomyLevel: "max" as AutonomyLevel },
      chat,
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
    });
    const result = await session.sendUserMessage("계속 조회해", () => {});
    expect(result.stoppedReason).toBe("max-tool-calls");
    expect(toolCalls).toBe(resolveAutonomy("max").budgetCap);
  });

  it("autonomyLevel 없는 주입 config 는 종래 상한 그대로다", async () => {
    // Break: 가드 없이 min 을 씌우면 balanced-16 기본이 maxToolCalls=3 테스트를 바꾸지 않지만,
    // maxToolCalls=24 같은 기존 테스트(ORCH)를 16으로 깎아 회귀를 만든다. 필드 없으면 손대지 않는다.
    let n = 0;
    const chat = async (): Promise<ChatResult> => {
      n += 1;
      return toolCallResult("get_project_summary", {}, `c${n}`);
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...BASE, maxToolCalls: 24 },
      chat,
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
    });
    const result = await session.sendUserMessage("계속 조회해", () => {});
    expect(result.stoppedReason).toBe("max-tool-calls");
    expect(n).toBe(24);
  });

  it("confirm 은 플래너를 돌려 계획만 세우고 멈춘다 (「계속」 안내 포함)", async () => {
    const NEW_PLAN_JSON = JSON.stringify({
      action: "new_plan",
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
    });
    let calls = 0;
    const chat = async (): Promise<ChatResult> => {
      calls += 1;
      return finalResult(NEW_PLAN_JSON);
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...BASE, autonomyLevel: "confirm" as AutonomyLevel },
      chat,
      declareIntent: fixedDeclarer({ mode: "create", needsPlan: false }),
    });
    const result = await session.sendUserMessage("타이틀을 두 단계로 다듬어줘", () => {});
    expect(calls).toBe(1);
    expect(result.proposedCalls).toEqual([]);
    expect(result.workPlan?.layers[0]?.items).toHaveLength(2);
    expect(result.assistantText).toContain("계속");
  });
});
