import { describe, expect, it } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { chatgptFixtureConfig } from "./helpers/chatgptFixtureConfig";

describe("explicit autonomous execution effort", () => {
  it.each([
    { autonomyLevel: "max", reasoningEffort: "high" },
    { autonomyLevel: "autonomous", reasoningEffort: "medium" },
    { autonomyLevel: "max", reasoningEffort: "low" },
  ] as const)("keeps configured $reasoningEffort effort in $autonomyLevel execution", ({ autonomyLevel, reasoningEffort }) => {
    // Given an explicitly selected autonomous preset and its saved effort.
    const session = new AssistantSession(createBlankProject(), {
      // 역할 칸을 비워(roleModels: {}) 역할 칸이 없을 때의 정책을 잰다 — 공장 기본은 Claude Sonnet 5.5 high 다(2026-11-23).
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
    // ChatGPT 로 저장된 설정으로 잰다(공장 기본은 Claude — 2026-11-23).
    const session = new AssistantSession(createBlankProject(), { config: { ...chatgptFixtureConfig(), roleModels: {} } });
    expect(session["phaseConfig"]("execute").reasoningEffort).toBe("medium");
  });

  it("uses the pinned execution role when the config has one (default Claude Sonnet 5.5 high, 2026-11-23)", () => {
    const session = new AssistantSession(createBlankProject(), { config: defaultAiConfig() });
    const execution = session["phaseConfig"]("execute");
    expect(execution.model).toBe("claude-sonnet-5-5");
    expect(execution.reasoningEffort).toBe("high");
  });

  it("uses the pinned execution role of a ChatGPT-saved config (GPT-6.2 Sol medium)", () => {
    const execution = new AssistantSession(createBlankProject(), { config: chatgptFixtureConfig() })["phaseConfig"]("execute");
    expect(execution.model).toBe("gpt-6.2-sol");
    expect(execution.reasoningEffort).toBe("medium");
  });
});
