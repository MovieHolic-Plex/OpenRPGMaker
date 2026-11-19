import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { configForLegacySupervisor } from "@/ai/ultrabrainConfig";
import { describe, expect, it } from "vitest";
import { defaultAiConfig, configForLiteModel } from "@/ai/llmClient";
import { configForRole, modelForRole, parseRoleModels } from "@/ai/modelRoles";

describe("independent specialist selections", () => {
  it("migrates old writer/executor selections without changing explicit model ids", () => {
    // An old save has no per-role slots; the factory default seeds every role slot (gemini-4-argon since #2535, claude-opus-5-5 since 2026-11-16, gpt-6.2-sol since 2026-11-19).
    const { roleModels: _factoryRoleSlots, ...factory } = defaultAiConfig();
    const config = { ...factory, model: "custom-writer", liteModel: "custom-deep" };
    expect(modelForRole(config, "writer").model).toBe("custom-writer");
    expect(modelForRole(config, "deep").model).toBe("custom-deep");
    expect(modelForRole(config, "vision").model).toBe("custom-writer");
  });
  it("keeps role provider, model and effort independent of legacy settings and autonomy", () => {
    const roleModels = parseRoleModels({ vision: { provider: "openai-codex", model: "future-vision", thinkingLevel: "high" } });
    expect(configForRole({ ...defaultAiConfig(), providerId: "google-antigravity", reasoningEffort: "off", roleModels }, "vision"))
      .toMatchObject({ providerId: "openai-codex", model: "future-vision", reasoningEffort: "high", apiKey: "" });
    const config = { ...defaultAiConfig(), roleModels: { ...roleModels, deep: { provider: "openai-codex", model: "deep-selected", thinkingLevel: "high" as const } } };
    expect(resolveSurfaceAiConfig("tileset-analysis", config)).toMatchObject({ model: "future-vision", providerId: "openai-codex", reasoningEffort: "high" });
    // 고르지 않은 칸은 공장 기본(ChatGPT GPT-6.2 Sol · medium, 2026-11-19) 그대로다 — 고른 칸(vision·deep)의 모델을 따라가지 않는다.
    expect(resolveSurfaceAiConfig("structure-kit", config)).toMatchObject({ model: "gpt-6.2-sol", providerId: "openai-codex" });
    expect(resolveSurfaceAiConfig("region", config)).toMatchObject({ model: "deep-selected", reasoningEffort: "high" });
    expect(configForLiteModel(config)).toMatchObject({ providerId: "openai-codex", model: "deep-selected", reasoningEffort: "high" });
    expect(configForLegacySupervisor(config)).toMatchObject({ providerId: "openai-codex", model: "gpt-6.2-sol", reasoningEffort: "medium", maxTokens: config.maxTokens });
    expect(parseRoleModels({ deep: { model: "", provider: 4 }, writer: null })).toEqual({});
  });
});
