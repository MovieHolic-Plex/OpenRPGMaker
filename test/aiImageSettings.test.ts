import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { generateAiImage, imageGenerationUsesOtherProvider } from "@/ai/imageGenerationClient";
import { renderAiSettingsForm } from "@/editor/panels/aiSettingsModal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/ai/chatgptOAuthClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/ai/chatgptOAuthClient")>(),
  fetchChatGptAuthStatus: vi.fn().mockResolvedValue({ connected: false }),
}));

let restoreDom: () => void;
let dispose: (() => void) | undefined;
beforeEach(() => {
  restoreDom = installFakeDom();
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});
afterEach(() => { dispose?.(); dispose = undefined; restoreDom(); vi.unstubAllGlobals(); });

function form() {
  const view = renderAiSettingsForm({});
  dispose = view.dispose;
  const get = (id: string) => {
    const control = findByTestId(view.element as unknown as FakeElement, id);
    if (!control) throw new Error(id);
    return control;
  };
  const change = (id: string, value: string) => {
    const control = get(id);
    control.value = value;
    control.dispatchEvent(new Event("change"));
  };
  return { get, change };
}

describe("independent image settings", () => {
  it("routes the stored Codex sentinel and preserves returned upstream metadata without changing chat", async () => {
    const before = defaultAiConfig();
    saveAiConfig(before);
    const view = form();
    view.change("ai-config-image-provider", "openai-codex");
    expect(loadAiConfig()).toMatchObject({
      providerId: before.providerId, model: before.model, liteModel: before.liteModel,
      imageProviderId: "openai-codex", imageModel: "codex-image-default",
    });
    expect(view.get("ai-config-image-status").dataset.availability).toBe("supported");
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("X-Rpgzzu-Provider")).toBe("openai-codex");
      expect(JSON.parse(String(init?.body)).model).toBe("codex-image-default");
      return new Response(JSON.stringify({ image: { dataUrl: "data:image/png;base64,AAAA", provider: "openai-codex", model: "gpt-image-2" } }));
    });
    const image = await generateAiImage({ prompt: "routing check" }, { fetch });
    expect(image).toMatchObject({ provider: "openai-codex", model: "gpt-image-2" });
    expect(loadAiConfig().imageModel).toBe("codex-image-default");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("preserves unknown saved image choices when the provider DOM emits change", () => {
    saveAiConfig({ ...defaultAiConfig(), imageProviderId: "unknown-image-provider", imageModel: "unknown-image-model" });
    const view = form();
    expect(() => view.change("ai-config-image-provider", "unknown-image-provider")).not.toThrow();
    view.change("ai-config-model", "gemini-3.7-flash");
    expect(loadAiConfig()).toMatchObject({ imageProviderId: "unknown-image-provider", imageModel: "unknown-image-model" });
    expect(view.get("ai-config-image-model").value).toBe("unknown-image-model");
    expect(view.get("ai-config-image-status").dataset.availability).toBe("unsupported");
  });

  it("backfills old chat-only settings with the actual image route", () => {
    localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ providerId: "openai-codex", model: "gpt-5.6-sol" }));
    expect(loadAiConfig()).toMatchObject({ imageProviderId: "google-antigravity", imageModel: "gemini-3.1-flash-image" });
  });

  it("preserves an unsupported saved image choice across chat changes and reopening", () => {
    saveAiConfig({ ...defaultAiConfig(), imageProviderId: "openai-codex", imageModel: "gpt-image-1" });
    const view = form();
    view.get("ai-auth-quick-openai-codex").click();
    view.change("ai-config-model", "gpt-5.6-sol");
    expect(loadAiConfig()).toMatchObject({ providerId: "openai-codex", imageProviderId: "openai-codex", imageModel: "gpt-image-1" });
    dispose?.();
    const reopened = form();
    expect(reopened.get("ai-config-image-provider").value).toBe("openai-codex");
    expect(reopened.get("ai-config-image-model").value).toBe("gpt-image-1");
    expect(reopened.get("ai-config-image-status").dataset.availability).toBe("unsupported");
  });

  it("changes image selection without changing either chat model or provider", () => {
    saveAiConfig({ ...defaultAiConfig(), providerId: "openai-codex", model: "gpt-5.6-sol", liteModel: "gpt-5.6-sol", imageProviderId: "openai-codex", imageModel: "gpt-image-1" });
    const before = loadAiConfig();
    const view = form();
    view.change("ai-config-image-provider", "google-antigravity");
    view.change("ai-config-image-model", "gemini-3.1-flash-image");
    expect(loadAiConfig()).toMatchObject({ providerId: before.providerId, model: before.model, liteModel: before.liteModel, imageProviderId: "google-antigravity", imageModel: "gemini-3.1-flash-image" });
  });

  it("routes stored selection through the real client and keeps request override, references and abort", async () => {
    saveAiConfig({ ...defaultAiConfig(), imageProviderId: "openai-codex", imageModel: "gpt-image-1" });
    const controller = new AbortController();
    const references = [{ data: "AAAA", mimeType: "image/png" as const }];
    const seen: RequestInit[] = [];
    const fetch = vi.fn(async (_url: unknown, init?: RequestInit) => {
      seen.push(init!);
      return new Response(JSON.stringify({ image: { dataUrl: "data:image/png;base64,AAAA" } }));
    });
    const result = await generateAiImage({ prompt: "test", referenceImages: references, signal: controller.signal }, { fetch });
    expect(new Headers(seen[0]!.headers).get("X-Rpgzzu-Provider")).toBe("openai-codex");
    expect(JSON.parse(String(seen[0]!.body))).toMatchObject({ model: "gpt-image-1", referenceImages: references });
    expect(result).toMatchObject({ provider: "openai-codex", model: "gpt-image-1" });
    controller.abort();
    expect(seen[0]!.signal?.aborted).toBe(true);
    await generateAiImage({ prompt: "test", model: "gemini-3-pro-image", providerId: "google-antigravity" }, { fetch });
    expect(new Headers(seen[1]!.headers).get("X-Rpgzzu-Provider")).toBe("google-antigravity");
    expect(JSON.parse(String(seen[1]!.body)).model).toBe("gemini-3-pro-image");
    expect(loadAiConfig().imageModel).toBe("gpt-image-1");
  });

  it("compares the selected image provider rather than a fixed provider", () => {
    expect(imageGenerationUsesOtherProvider({ ...defaultAiConfig(), providerId: "openai-codex", imageProviderId: "openai-codex" })).toBe(false);
  });
});
