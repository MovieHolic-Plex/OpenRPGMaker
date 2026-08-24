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

  it("Antigravity 신규 선택은 Gemini 3.7 Flash를 우선하고 Pro도 선택지로 둔다", async () => {
    // Break caught: changing the provider default or dropping its curated model list
    // would send ordinary editor turns to the slower Pro path or hide the quality option.
    const { defaultModelForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    const groups = modelCatalogForAuthMode("chatgpt", "google-antigravity");
    const recommended = groups[0]?.models;

    expect(defaultModelForAuthMode("chatgpt", "google-antigravity")).toBe("gemini-3.7-flash");
    expect(recommended?.slice(0, 2)).toEqual(["gemini-3.7-flash", "gemini-3.1-pro"]);
    expect(groups.flatMap((group) => group.models)).not.toContain("gpt-5.6-sol");
  });

  it("codex 목록은 pi-catalog 와 일치하고, 조용히 강등되는 ID 는 거부한다", async () => {
    const { defaultModelForAuthMode, isModelValidForAuthMode, modelCatalogForAuthMode } = await loadCatalog();
    // pi-catalog 의 getBundledModels("openai-codex") 집합. 여기 없는 ID 는 Codex 경로에서
    // 오류 없이 제공자 기본 모델로 강등되므로(modelCatalog.ts 실측 주석) 무효로 본다.
    const codex = modelCatalogForAuthMode("chatgpt", "openai-codex").flatMap((group) => group.models);
    expect([...codex].sort()).toEqual([
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.5",
      "gpt-5.6-luna",
      "gpt-5.6-sol",
      "gpt-5.6-terra",
      "gpt-5.3-codex-spark",
      "gpt-daybreak-blue-latest",
    ].sort());
    expect(defaultModelForAuthMode("chatgpt", "openai-codex")).toBe("gpt-5.6-sol");
    expect(isModelValidForAuthMode("chatgpt", "gpt-5.6-sol", "openai-codex")).toBe(true);
    // 옛 판정은 "gpt- 로 시작하면 통과" 라서 이 둘을 그대로 통과시켰다.
    expect(isModelValidForAuthMode("chatgpt", "gpt-5.1-codex", "openai-codex")).toBe(false);
    expect(isModelValidForAuthMode("chatgpt", "cpen/gpt-5-6-luna", "openai-codex")).toBe(false);
    // 게이트웨이 경로는 좁히지 않는다.
    expect(isModelValidForAuthMode("apiKey", "gpt-5.1-codex", "openai")).toBe(true);
  });
});
