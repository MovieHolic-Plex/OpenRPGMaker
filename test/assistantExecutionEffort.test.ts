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
      config: { ...defaultAiConfig(), model: "supervisor", liteModel: "executor", autonomyLevel, reasoningEffort },
    });
    // When constructing the actual executor transport configuration.
    const execution = session["phaseConfig"]("execute");
    // Then changing models must not silently turn the user's requested reasoning off.
    expect(execution.reasoningEffort).toBe(reasoningEffort);
    expect(execution.model).toBe("executor");
  });

  it("keeps the balanced preset's existing fast executor policy", () => {
    // Given the default balanced configuration, then its lower-cost execution policy remains.
    const session = new AssistantSession(createBlankProject(), { config: defaultAiConfig() });
    expect(session["phaseConfig"]("execute").reasoningEffort).toBe("off");
  });
});
