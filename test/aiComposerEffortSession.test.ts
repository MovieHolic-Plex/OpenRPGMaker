// 지시줄 effort — 세션은 저장된 reasoningEffort 수동값을 그대로 쓴다(다이얼 덮어쓰기 없음).
//
// 과거에는 phaseConfig 가 autonomyLevel 의 effort 로 수동값을 덮어서, 컴포저·설정에서
// effort 를 골라도 레벨 effort 가 이겼다. 지금은 호출자(설정 모달·컴포저)가 다이얼 선택 시
// resolveAutonomy 프리셋을 저장에 함께 반영하므로 세션 덮개가 필요 없다 — agentMode·예산·
// planOnly 만 다이얼이 정한다. 기계가 소비하는 값(chat 에 실리는 config)만 단언한다.
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixedDeclarer } from "./intentFixture";
import { AssistantSession } from "@/ai/assistantSession";
import type { AiConfig, ChatResult } from "@/ai/llmClient";
import type { AutonomyLevel } from "@/ai/autonomyLevels";
import { createBlankProject } from "@/project/defaults";

afterEach(() => {
  vi.restoreAllMocks();
});

function finalResult(text: string): ChatResult {
  return { message: { role: "assistant", content: text, tool_calls: undefined }, finishReason: "stop" } as ChatResult;
}

const BASE: AiConfig = {
  authMode: "apiKey",
  baseUrl: "x",
  model: "stub-model",
  liteModel: "stub-model",
  apiKey: "sk",
  maxToolCalls: 2000,
  maxTokens: 512,
  agentMode: "chat",
};

async function runTurn(config: AiConfig, seen: AiConfig[]): Promise<void> {
  const chat = async (used: AiConfig): Promise<ChatResult> => {
    seen.push(used);
    return finalResult("ok");
  };
  const session = new AssistantSession(createBlankProject(), {
    config,
    chat,
    declareIntent: fixedDeclarer({ mode: "other", needsPlan: false }),
  });
  await session.sendUserMessage("짧은 질문", () => {});
}

describe("지시줄 effort — 세션 effort 우선순위", () => {
  it("수동 effort=high 는 다이얼 balanced(low) 아래에서도 high 그대로 실린다", async () => {
    // Break: phaseConfig 가 레벨 effort 로 덮어 low 가 실린다.
    const seen: AiConfig[] = [];
    await runTurn({ ...BASE, autonomyLevel: "balanced", reasoningEffort: "high" }, seen);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]?.reasoningEffort).toBe("high");
  });

  it("수동 effort=off 는 다이얼 max(high) 아래에서도 off 그대로 실린다", async () => {
    // Break: 레벨 effort(high)가 실린다.
    const seen: AiConfig[] = [];
    await runTurn({ ...BASE, autonomyLevel: "max", reasoningEffort: "off" }, seen);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]?.reasoningEffort).toBe("off");
  });

  it("다이얼 레벨은 그대로 agentMode·예산을 정한다(autonomy 하네스와 같은 범위)", async () => {
    // 다이얼 effort 덮개를 걷어내도 레벨의 다른 노브(agentMode·budgetCap·planOnly)는 살아 있다.
    // max 레벨 + chat 주입이면 orchestrationEnabled 가 레벨 agentMode(auto)로 켜진다 — 플래너
    // 콜(tools 없음)과 실행 콜(tools 있음)이 둘 다 보여야 한다.
    const seen: AiConfig[] = [];
    const toolFlags: (readonly unknown[] | undefined)[] = [];
    const chat = async (used: AiConfig, req: { tools?: readonly unknown[] }): Promise<ChatResult> => {
      seen.push(used);
      toolFlags.push(req.tools);
      if ((req.tools ?? []).length === 0) {
        return finalResult(JSON.stringify({ action: "direct", reason: "한 턴으로 충분" }));
      }
      return finalResult("ok");
    };
    const session = new AssistantSession(createBlankProject(), {
      config: { ...BASE, autonomyLevel: "max" as AutonomyLevel, agentMode: "chat" as const, reasoningEffort: "low" as const },
      chat,
      declareIntent: fixedDeclarer({ mode: "other", needsPlan: true }),
    });
    await session.sendUserMessage("마을을 만들어줘", () => {});
    // 플래너 콜이 있었다 = 레벨 agentMode(auto)가 orchestration 을 켰다(플래너 요청에는 tools 키가 없다).
    expect(toolFlags.some((tools) => tools === undefined)).toBe(true);
    // 턴루프 콜(tools 있음)에 수동값 low 가 그대로 실린다(레벨 high 로 덮이지 않는다).
    // seen[0]은 플래너 콜(this.config 직통)이라 phaseConfig 를 거치지 않는다 — 턴루프 콜로 본다.
    const loopCall = seen.find((_, index) => toolFlags[index] !== undefined);
    expect(loopCall?.reasoningEffort).toBe("low");
  });
});
