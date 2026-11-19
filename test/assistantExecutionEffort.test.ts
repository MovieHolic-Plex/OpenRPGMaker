import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

describe("explicit autonomous execution effort", () => {
  it.each([
    { autonomyLevel: "max", reasoningEffort: "high" },
    { autonomyLevel: "autonomous", reasoningEffort: "medium" },
    { autonomyLevel: "max", reasoningEffort: "low" },
  ] as const)("keeps configured $reasoningEffort effort in $autonomyLevel execution", ({ autonomyLevel, reasoningEffort }) => {
    // Given an explicitly selected autonomous preset and its saved effort.
    const session = new AssistantSession(createBlankProject(), {
      // defaultAiConfig() 는 실행(deep) 역할을 ChatGPT GPT-6.2 Sol medium 으로 고정한다(2026-11-19, 그 전 2026-11-16 은 Opus, #2535 는 Argon) — 역할 칸이 없을 때의 정책을 잰다.
      config: { ...defaultAiConfig(), roleModels: {}, model: "supervisor", liteModel: "executor", autonomyLevel, reasoningEffort },
    });
    // When constructing the actual executor transport configuration.
    const execution = session["phaseConfig"]("execute");
    // Then changing models must not silently turn the user's requested reasoning off.
    expect(execution.reasoningEffort).toBe(reasoningEffort);
    expect(execution.model).toBe("executor");
  });

  it("never drops a ChatGPT executor below medium, even without a pinned execution role", () => {
    // 오너 결정(2026-11-19): ChatGPT 로 게임을 만드는 역할은 최소 medium 이다 — 균형 프리셋의 「실행은 off」 정책도 ChatGPT 에는 적용하지 않는다.
    const session = new AssistantSession(createBlankProject(), { config: { ...defaultAiConfig(), roleModels: {} } });
    expect(session["phaseConfig"]("execute").reasoningEffort).toBe("medium");
  });

  it("uses the pinned execution role when the config has one (default ChatGPT GPT-6.2 Sol medium, 2026-11-19)", () => {
    const session = new AssistantSession(createBlankProject(), { config: defaultAiConfig() });
    const execution = session["phaseConfig"]("execute");
    expect(execution.model).toBe("gpt-6.2-sol");
    expect(execution.reasoningEffort).toBe("medium");
  });
});
