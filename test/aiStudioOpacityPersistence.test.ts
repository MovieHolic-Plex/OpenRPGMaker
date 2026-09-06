// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearConversations } from "@/ai/conversationStore";
import { editorState } from "@/editor/editorState";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { AI_BACKGROUND_OPACITY_KEY } from "@/editor/panels/aiPanelLayout";
import { closeAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { renderTopbar } from "@/editor/panels/menu";
import { resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

vi.mock("@/ai/chatgptOAuthClient", async (original) => ({
  ...await original<typeof import("@/ai/chatgptOAuthClient")>(),
  fetchChatGptAuthStatus: vi.fn().mockResolvedValue({ connected: false }),
}));

function control<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.querySelector<T>(`[data-testid="${id}"]`);
  if (!node) throw new Error(`Missing control ${id}`);
  return node;
}

beforeEach(async () => {
  localStorage.clear();
  localStorage.setItem("oprn:ai-font-size", "large");
  localStorage.setItem("oprn:ai-panel-size", JSON.stringify({ width: 704, height: 620 }));
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
  await clearConversations();
});

afterEach(async () => {
  closeAiSettingsModal();
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  await clearConversations();
  document.body.replaceChildren();
  document.body.className = "";
  resetModalStackForTest();
});

async function boot(): Promise<HTMLElement> {
  const panel = renderAiChatPanel();
  const topbar = document.createElement("header");
  document.body.append(panel, topbar);
  renderTopbar(topbar);
  await whenAiChatPanelSettled();
  return panel;
}

function setDensity(value: number): void {
  control("topbar-ai-settings").click();
  const range = control<HTMLInputElement>("ai-background-opacity");
  expect(range.type).toBe("range");
  range.value = String(value);
  range.dispatchEvent(new Event("input", { bubbles: true }));
  control("ai-settings-close").click();
}

function expectDensity(panel: HTMLElement, value: number): void {
  expect(localStorage.getItem(AI_BACKGROUND_OPACITY_KEY)).toBe(String(value));
  expect(panel.style.getPropertyValue("--ai-background-opacity")).toBe(`${value}%`);
  control("topbar-ai-settings").click();
  expect(control<HTMLInputElement>("ai-background-opacity").value).toBe(String(value));
  control("ai-settings-close").click();
}

describe("studio background-density preference lifecycle", () => {
  // Happy DOM is intentional: FakeDom's style attribute does not reset its style object.
  it.each(["ai-studio-exit", "topbar-ai-studio", "ai-collapse"])("preserves current preferences through studio entry and %s", async (exitControl) => {
    // Given a real settings input on a mounted floating panel.
    const panel = await boot();
    setDensity(100);
    expectDensity(panel, 100);

    // When studio opens from the topbar and exits or collapses.
    control("topbar-ai-studio").click();
    expect(panel.classList.contains("is-studio")).toBe(true);
    expectDensity(panel, 100);
    expect(panel.style.getPropertyValue("--ai-font-scale")).toBe("1.2");
    control(exitControl).click();

    // Then preferences survive both paths, including the collapsed pill's inherited token.
    expect(panel.classList.contains("is-studio")).toBe(false);
    expectDensity(panel, 100);
    if (exitControl !== "ai-collapse") control("ai-collapse").click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(control("ai-collapsed-restore").parentElement).toBe(panel);
    expectDensity(panel, 100);
    expect(panel.style.getPropertyValue("--ai-font-scale")).toBe("1.2");
    control("ai-collapsed-restore").click();
    expectDensity(panel, 100);
  });

  it.each(["0", "1"])("restores preferences on studio-enabled boot with collapsed=%s", async (collapsed) => {
    // Given persisted studio, density, font and collapse preferences.
    localStorage.setItem("oprn:ai-studio", "1");
    localStorage.setItem("oprn:ai-panel-collapsed", collapsed);
    localStorage.setItem(AI_BACKGROUND_OPACITY_KEY, "100");

    // When the panel boots directly into studio.
    const panel = await boot();

    // Then studio wins over collapse without discarding appearance preferences.
    expect(panel.classList.contains("is-studio")).toBe(true);
    expect(panel.classList.contains("is-collapsed")).toBe(false);
    expectDensity(panel, 100);
    expect(panel.dataset.aiFontSize).toBe("large");
    expect(panel.style.getPropertyValue("--ai-font-scale")).toBe("1.2");
    control("ai-studio-exit").click();
    control("ai-collapse").click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(control("ai-collapsed-restore").parentElement).toBe(panel);
    expectDensity(panel, 100);
  });

  it("keeps settings changed during studio instead of restoring an entry snapshot", async () => {
    // Given studio entered with a different density.
    const panel = await boot();
    setDensity(100);
    control("topbar-ai-studio").click();

    // When the active studio's settings change, then exit and enter again.
    setDensity(78);
    expectDensity(panel, 78);
    control("ai-studio-exit").click();
    expectDensity(panel, 78);
    control("topbar-ai-studio").click();

    // Then the latest setting survives the next transition and collapse.
    expectDensity(panel, 78);
    control("ai-collapse").click();
    expect(panel.classList.contains("is-collapsed")).toBe(true);
    expect(control("ai-collapsed-restore").parentElement).toBe(panel);
    expectDensity(panel, 78);
  });

  it("clears only custom geometry in studio and restores floating width after exit and collapse", async () => {
    // Given saved float width and legacy inline dimensions.
    const panel = await boot();
    const deck = control("ai-deck");
    expect(panel.style.getPropertyValue("--ai-float-bar-width")).toBe("704px");
    expect(deck.style.getPropertyValue("--ai-float-bar-width")).toBe("704px");
    panel.style.width = "704px";
    panel.style.height = "620px";
    panel.style.maxWidth = "900px";
    panel.style.maxHeight = "800px";

    // When studio takes over geometry.
    control("topbar-ai-studio").click();

    // Then no float geometry sticks to either root; appearance remains independent.
    for (const property of ["width", "height", "maxWidth", "maxHeight"] as const) {
      expect(panel.style[property]).toBe("");
    }
    for (const root of [panel, deck]) expect(root.style.getPropertyValue("--ai-float-bar-width")).toBe("");
    expect(panel.style.getPropertyValue("--ai-font-scale")).toBe("1.2");
    control("ai-studio-exit").click();
    for (const root of [panel, deck]) expect(root.style.getPropertyValue("--ai-float-bar-width")).toBe("704px");
    control("ai-collapse").click();
    for (const root of [panel, deck]) expect(root.style.getPropertyValue("--ai-float-bar-width")).toBe("");
    control("ai-collapsed-restore").click();
    for (const root of [panel, deck]) expect(root.style.getPropertyValue("--ai-float-bar-width")).toBe("704px");
    expect(JSON.parse(localStorage.getItem("oprn:ai-panel-size") ?? "null")).toEqual({ width: 704, height: 620 });
  });
});
