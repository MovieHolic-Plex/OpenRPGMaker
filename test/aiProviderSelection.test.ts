import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { configForProviderSelection, workProviderIds } from "@/ai/providerSelection";
import { configForRole } from "@/ai/modelRoles";

const codex = "openai-codex";
const google = "google-antigravity";
afterEach(() => vi.unstubAllGlobals());

describe("account selection and persisted work models", () => {
  it("a first ChatGPT selection routes every default work surface and image to that account", () => {
    const next = configForProviderSelection(defaultAiConfig(), codex);
    expect(workProviderIds(next)).toEqual([codex]);
    for (const role of ["vision", "writer", "deep"] as const) {
      expect(configForRole(next, role).providerId).toBe(codex);
      expect(configForRole(next, role).model).toBe("gpt-6-luna");
    }
    expect(next.ultrabrainProviderId).toBe(codex);
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
    config.modelSelectionOverrides = { vision: true, image: true };
    saveAiConfig(config);
    const next = configForProviderSelection(loadAiConfig(), codex);
    expect(next.roleModels?.vision).toEqual(config.roleModels.vision);
    expect(next.imageProviderId).toBe(google);
    expect(new Set(workProviderIds(next))).toEqual(new Set([codex, google]));
    const aligned = configForProviderSelection(next, codex, true);
    expect(workProviderIds(aligned)).toEqual([codex]);
    expect(aligned.roleModels?.vision?.model).toBe("gpt-6-astra");
    expect(aligned.modelSelectionOverrides).toEqual({ image: true });
    expect(aligned.imageProviderId).toBe(google);
  });

  it("treats stored legacy choices as explicit until the user aligns them", () => {
    const legacy = { ...defaultAiConfig(), roleModels: { writer: { provider: google, model: "gemini-3-pro", thinkingLevel: "high" } } };
    delete legacy.modelSelectionOverrides;
    vi.stubGlobal("localStorage", { getItem: () => JSON.stringify(legacy) });
    const next = configForProviderSelection(loadAiConfig(), codex);
    expect(next.roleModels?.writer?.provider).toBe(google);
    expect(next.ultrabrainProviderId).toBe(google);
  });
});
