import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyAiBackgroundOpacity, clampAiBackgroundOpacity, loadAiBackgroundOpacity, saveAiBackgroundOpacity } from "@/editor/panels/aiPanelLayout";
import { closeAiSettingsModal, openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/ai/chatgptOAuthClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/ai/chatgptOAuthClient")>(),
  fetchChatGptAuthStatus: vi.fn().mockResolvedValue({ connected: false }),
}));
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
