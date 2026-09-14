import { resolveSurfaceAiConfig } from "@/ai/assistantEndpoint";
import { configForLegacySupervisor } from "@/ai/ultrabrainConfig";
import { describe, expect, it } from "vitest";
import { defaultAiConfig, configForLiteModel } from "@/ai/llmClient";
import { configForRole, modelForRole, parseRoleModels } from "@/ai/modelRoles";

describe("independent specialist selections", () => {
  it("migrates old writer/executor selections without changing explicit model ids", () => {
    const config = { ...defaultAiConfig(), model: "custom-writer", liteModel: "custom-deep" };
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
    expect(resolveSurfaceAiConfig("structure-kit", config)).toMatchObject({ model: "gemini-3.8-flash", providerId: "google-antigravity" });
    expect(resolveSurfaceAiConfig("region", config)).toMatchObject({ model: "deep-selected", reasoningEffort: "high" });
    expect(configForLiteModel(config)).toMatchObject({ providerId: "openai-codex", model: "deep-selected", reasoningEffort: "high" });
    expect(configForLegacySupervisor(config)).toMatchObject({ providerId: "google-antigravity", model: "gemini-3.8-flash", reasoningEffort: "high", maxTokens: config.maxTokens });
    expect(parseRoleModels({ deep: { model: "", provider: 4 }, writer: null })).toEqual({});
  });
});
