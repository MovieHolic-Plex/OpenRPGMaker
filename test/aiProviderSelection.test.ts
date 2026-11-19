import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { configForProviderSelection, workProviderIds } from "@/ai/providerSelection";
import { configForRole } from "@/ai/modelRoles";

const codex = "openai-codex";
const google = "google-antigravity";
afterEach(() => vi.unstubAllGlobals());

describe("account selection and persisted work models", () => {
  it("a first ChatGPT selection routes work to gpt-6.2-sol medium for every work role", () => {
    const next = configForProviderSelection(defaultAiConfig(), codex);
    // 직접 고른 역할이 없으면 계획·시공·작문·실행·시각 모두 ChatGPT 로 간다.
    expect(workProviderIds(next)).toEqual([codex]);
    for (const role of ["vision", "deep", "build", "writer"] as const) {
      expect(configForRole(next, role).providerId).toBe(codex);
      expect(configForRole(next, role).model).toBe("gpt-6.2-sol");
      expect(configForRole(next, role).reasoningEffort).toBe("medium");
    }
    expect(next.ultrabrainProviderId).toBe(codex);
    expect(next.ultrabrainModel).toBe("gpt-6.2-sol");
    expect(next.ultrabrainReasoningEffort).toBe("medium");
    expect(next.imageProviderId).toBe(codex);
  });

  it("preserves direct mixed-account choices through save, reload, and account switching", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    });
    const config = defaultAiConfig();
    config.roleModels = { vision: { provider: google, model: "gemini-3-pro", thinkingLevel: "high" } };
    config.imageProviderId = google;
    config.modelSelectionOverrides = { vision: true, image: true };
    saveAiConfig(config);
    const next = configForProviderSelection(loadAiConfig(), codex);
    expect(next.roleModels?.vision).toEqual(config.roleModels.vision);
    expect(next.imageProviderId).toBe(codex);
    expect(new Set(workProviderIds(next))).toEqual(new Set([codex, google]));
    const aligned = configForProviderSelection(next, codex, true);
    expect(workProviderIds(aligned)).toEqual([codex]);
    expect(aligned.roleModels?.vision?.model).toBe("gpt-6.2-sol");
    expect(aligned.modelSelectionOverrides).toEqual({});
    expect(aligned.imageProviderId).toBe(codex);
    expect(aligned.imageModel).toBe("codex-image-default");
  });

  it("treats stored legacy choices as explicit until the user aligns them", () => {
    const legacy = { ...defaultAiConfig(), providerId: google, ultrabrainProviderId: google, ultrabrainModel: "gemini-4-argon",
      roleModels: { writer: { provider: google, model: "gemini-3-pro", thinkingLevel: "high" } } };
    delete legacy.modelSelectionOverrides;
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(legacy) });
    const next = configForProviderSelection(loadAiConfig(), codex);
    expect(next.roleModels?.writer?.provider).toBe(google);
    expect(next.ultrabrainProviderId).toBe(google);
  });
});
