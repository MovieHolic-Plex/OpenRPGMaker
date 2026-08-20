import { describe, expect, it } from "vitest";

async function loadCatalog() {
  return await import("@/ai/modelCatalog");
}

describe("modelCatalog", () => {
  it("glm-5.2-ultrafast is selectable in apiKey mode", async () => {
    const { modelCatalogForAuthMode } = await loadCatalog();
    const groups = modelCatalogForAuthMode("apiKey");
    const all = groups.flatMap((g) => g.models);
    expect(all).toContain("glm-5.2-ultrafast");
  });

  it("glm-5.2-ultrafast lives in the GJC registry group", async () => {
    const { modelCatalogForAuthMode } = await loadCatalog();
    const groups = modelCatalogForAuthMode("apiKey");
    const gjc = groups.find((g) => g.label.includes("GJC"));
    expect(gjc?.models).toContain("glm-5.2-ultrafast");
    expect(gjc?.models).toContain("glm-5.2");
  });

  it("chatgpt mode does not expose gateway-only glm models", async () => {
    const { modelCatalogForAuthMode } = await loadCatalog();
    const groups = modelCatalogForAuthMode("chatgpt");
    const all = groups.flatMap((g) => g.models);
    expect(all).not.toContain("glm-5.2-ultrafast");
  });

  it("oh-my-pi 제공자를 고르면 그 기본 모델이 목록 앞에 온다", async () => {
    const { defaultModelForAuthMode, isModelValidForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    expect(defaultModelForAuthMode("chatgpt", "anthropic")).toBe("claude-opus-4-8");
    expect(isModelValidForAuthMode("chatgpt", "claude-opus-4-8", "anthropic")).toBe(true);
    expect(isModelValidForAuthMode("chatgpt", "claude-opus-4-8", "openai-codex")).toBe(false);
    expect(modelCatalogForAuthMode("chatgpt", "groq")[0]?.models[0]).toBe("openai/gpt-oss-120b");
  });
});
