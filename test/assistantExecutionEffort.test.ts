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
      // defaultAiConfig() 는 실행(deep) 역할을 Argon medium 으로 고정한다(#2535) — 역할 칸이 없을 때의 정책을 잰다.
      config: { ...defaultAiConfig(), roleModels: {}, model: "supervisor", liteModel: "executor", autonomyLevel, reasoningEffort },
    });
    // When constructing the actual executor transport configuration.
    const execution = session["phaseConfig"]("execute");
    // Then changing models must not silently turn the user's requested reasoning off.
    expect(execution.reasoningEffort).toBe(reasoningEffort);
    expect(execution.model).toBe("executor");
  });

  it("keeps the balanced preset's existing fast executor policy", () => {
    // Given a balanced configuration without a pinned execution role, then its lower-cost execution policy remains.
    const session = new AssistantSession(createBlankProject(), { config: { ...defaultAiConfig(), roleModels: {} } });
    expect(session["phaseConfig"]("execute").reasoningEffort).toBe("off");
  });

  it("uses the pinned execution role when the config has one (default Argon medium, #2535)", () => {
    const session = new AssistantSession(createBlankProject(), { config: defaultAiConfig() });
    const execution = session["phaseConfig"]("execute");
    expect(execution.model).toBe("gemini-4-argon");
    expect(execution.reasoningEffort).toBe("medium");
  });
});
