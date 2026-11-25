// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAiBackgroundOpacity, clampAiBackgroundOpacity, loadAiBackgroundOpacity, saveAiBackgroundOpacity } from "@/editor/panels/aiPanelLayout";
import { closeAiSettingsModal, openAiSettingsModal, renderAiSettingsForm } from "@/editor/panels/aiSettingsModal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { AI_CONFIG_STORAGE_KEY, defaultAiConfig, loadAiConfig, saveAiConfig } from "@/ai/llmClient";
import { generateAiImage } from "@/ai/imageGenerationClient";
import { isolateTimers } from "./mergedTeardown";

vi.mock("@/editor/panels/aiRoleMatrixSettings", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/editor/panels/aiRoleMatrixSettings")>()), fetchConnectedRoutes: () => new Promise<never>(() => undefined), }));
vi.mock("@/editor/panels/aiToolUsagePanel", () => ({ renderAiToolUsagePanel: () => document.createElement("div"), }));
vi.mock("@/ai/chatgptOAuthClient", async (importOriginal) => ({ ...await importOriginal<typeof import("@/ai/chatgptOAuthClient")>(), fetchChatGptAuthStatus: vi.fn().mockResolvedValue({ connected: false }), }));

describe("aiBackgroundOpacity", () => {
  isolateTimers();
  const KEY = "oprn:ai-background-opacity";
  let restore: () => void;
  let storage: Map<string, string>;
  beforeEach(() => {
    restore = installFakeDom();
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, String(value)),
      removeItem: (key: string) => storage.delete(key),
    });
  });
  afterEach(() => { closeAiSettingsModal(); restore(); vi.unstubAllGlobals(); });
  describe("assistant background opacity preference", () => {
    it("defaults without writing storage", () => {
      expect(loadAiBackgroundOpacity()).toBe(82);
      expect(storage.has(KEY)).toBe(false);
    });
    it.each([[0, 78], [77, 78], [78, 78], [82.6, 83], [100, 100], [101, 100], [NaN, 82], [Infinity, 82]])("clamps %s to %s", (value, expected) => {
      expect(clampAiBackgroundOpacity(value)).toBe(expected);
      saveAiBackgroundOpacity(value);
      expect(loadAiBackgroundOpacity()).toBe(expected);
      expect(storage.get(KEY)).toBe(String(expected));
    });
    it.each(["", " ", "oops", "NaN", "Infinity", "82%", "{}", "null"])('defaults malformed storage "%s"', (raw) => {
      storage.set(KEY, raw);
      expect(loadAiBackgroundOpacity()).toBe(82);
    });
    it.each([["12", 78], ["150", 100], ["91", 91]])("normalizes stored %s", (raw, expected) => {
      storage.set(KEY, raw);
      expect(loadAiBackgroundOpacity()).toBe(expected);
    });
    it("supports environments without storage", () => {
      vi.stubGlobal("localStorage", undefined);
      expect(loadAiBackgroundOpacity()).toBe(82);
      expect(() => saveAiBackgroundOpacity(90)).not.toThrow();
    });
    it("applies background token only", () => {
      const panel = document.createElement("aside");
      applyAiBackgroundOpacity(panel, 90);
      expect(panel.style.getPropertyValue("--ai-background-opacity")).toBe("90%");
      expect(panel.style.opacity || "").toBe("");
    });
  });
  describe("settings background control", () => {
    it.each(["input", "change"])("%s applies through topbar entry, persists and reopens", (eventType) => {
      const panel = document.createElement("aside");
      panel.className = "ai-chat-panel";
      document.body.append(panel);
      const modal = openAiSettingsModal() as unknown as FakeElement;
      const display = findByTestId(modal, "ai-settings-section-display")!;
      expect(findByTestId(display, "ai-font-size")).not.toBeNull();
      const slider = findByTestId(display, "ai-background-opacity")!;
      expect(slider).not.toBeNull();
      expect(slider.getAttribute("type")).toBe("range");
      expect(slider.getAttribute("min")).toBe("78");
      expect(slider.getAttribute("max")).toBe("100");
      expect(slider.getAttribute("step")).toBe("1");
      expect(slider.getAttribute("id")).toBeTruthy();
      expect(modal.querySelectorAll("label").some((label) => label.getAttribute("for") === slider.getAttribute("id"))).toBe(true);
      expect(slider.value).toBe("82");
      slider.value = "93";
      slider.dispatchEvent(new Event(eventType));
      expect(panel.style.getPropertyValue("--ai-background-opacity")).toBe("93%");
      expect(findByTestId(display, "ai-background-opacity-value")?.textContent).toBe("93%");
      expect(storage.get(KEY)).toBe("93");
      closeAiSettingsModal();
      const reopened = openAiSettingsModal() as unknown as FakeElement;
      expect(findByTestId(reopened, "ai-background-opacity")?.value).toBe("93");
    });
    it("also updates an explicitly supplied detached panel", () => {
      const panel = document.createElement("aside");
      const modal = openAiSettingsModal({ fontRoot: panel }) as unknown as FakeElement;
      const slider = findByTestId(modal, "ai-background-opacity")!;
      expect(slider).not.toBeNull();
      slider.value = "100";
      slider.dispatchEvent(new Event("input"));
      expect(panel.style.getPropertyValue("--ai-background-opacity")).toBe("100%");
    });
  });
});

describe("aiImageSettings", () => {
  isolateTimers();
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
    return { get };
  }
  describe("ChatGPT image settings", () => {
    it.each([
      ["google-antigravity", "gemini-3.1-flash-image"],
      ["openai-codex", "gpt-image-1"],
      ["unknown-provider", "unknown-image"],
      [undefined, undefined],
    ])("옛 그림 설정(%s / %s)을 읽을 때 ChatGPT 로 맞춘다", (imageProviderId, imageModel) => {
      const before = { ...defaultAiConfig(), providerId: "google-antigravity", model: "gemini-4-argon", imageProviderId, imageModel };
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(before));
      const migrated = loadAiConfig();
      expect(migrated).toMatchObject({
        providerId: before.providerId, model: before.model,
        imageProviderId: "openai-codex", imageModel: "codex-image-default",
      });
      expect(loadAiConfig()).toEqual(migrated);
      saveAiConfig(migrated);
      expect(JSON.parse(localStorage.getItem(AI_CONFIG_STORAGE_KEY)!)).toMatchObject({
        imageProviderId: "openai-codex", imageModel: "codex-image-default",
      });
      expect(loadAiConfig()).toMatchObject({
        providerId: before.providerId, model: before.model,
        imageProviderId: "openai-codex", imageModel: "codex-image-default",
      });
    });

    it("제공자와 모델 선택에 ChatGPT 한 항목만 보인다", () => {
      localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...defaultAiConfig(), imageProviderId: "google-antigravity", imageModel: "gemini-3.1-flash-image" }));
      const view = form();
      expect(view.get("ai-settings-model-image-provider").textContent).toContain("ChatGPT");
      expect(view.get("ai-settings-model-image").textContent).toContain("ChatGPT");
      expect(view.get("ai-config-image-provider").getAttribute("disabled")).not.toBeNull();
      expect(view.get("ai-config-image-provider").options.map((option) => option.value)).toEqual(["openai-codex"]);
      expect(view.get("ai-config-image-model").options.map((option) => option.value)).toEqual(["codex-image-default"]);
      expect(view.get("ai-config-image-model").value).toBe("codex-image-default");
      expect(view.get("ai-config-image-status").textContent).toContain("그림은 ChatGPT 로만 그려요");
    });

    it("ChatGPT 요청에 참조 그림과 취소를 전달하고 실제 응답 모델을 기록한다", async () => {
      const controller = new AbortController();
      const referenceImages = [{ data: "AAAA", mimeType: "image/png" as const }];
      const fetch = vi.fn(async (_url: unknown, _init?: RequestInit) =>
        new Response(JSON.stringify({ image: { dataUrl: "data:image/png;base64,AAAA", model: "gpt-image-2-codex" } })));
      const result = await generateAiImage({ prompt: "test", referenceImages, signal: controller.signal }, { fetch });
      const init = fetch.mock.calls[0]![1]!;
      expect(new Headers(init.headers).get("X-Oprn-Provider")).toBe("openai-codex");
      expect(JSON.parse(String(init.body))).toMatchObject({ model: "codex-image-default", referenceImages });
      expect(result).toMatchObject({ provider: "openai-codex", model: "gpt-image-2-codex" });
      controller.abort();
      expect(init.signal?.aborted).toBe(true);
    });
  });
});
