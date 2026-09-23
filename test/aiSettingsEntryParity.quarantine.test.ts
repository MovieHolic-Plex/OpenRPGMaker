// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantSession } from "@/ai/assistantSession";
import { clearConversations } from "@/ai/conversationStore";
import { loadAiConfig } from "@/ai/llmClient";
import { resolveAutonomy } from "@/ai/autonomyLevels";
import { editorState } from "@/editor/editorState";
import { setEditorUiMode } from "@/editor/editorUiMode";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { closeAiSettingsModal, openAiSettingsModal } from "@/editor/panels/aiSettingsModal";
import { renderTopbar } from "@/editor/panels/menu";
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

function change(id: string, value: string): void {
  const field = control<HTMLSelectElement | HTMLInputElement>(id);
  field.value = value;
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

async function boot(): Promise<HTMLElement> {
  const panel = renderAiChatPanel();
  const topbar = document.createElement("header");
  document.body.append(panel, topbar);
  renderTopbar(topbar);
  await whenAiChatPanelSettled();
  return panel;
}

function open(entry: "topbar" | "panel"): void {
  if (entry === "panel") control("ai-command-menu-toggle").click();
  control(entry === "topbar" ? "topbar-ai-settings" : "ai-command-menu-settings").click();
}

beforeEach(async () => {
  localStorage.clear();
  setEditorUiMode("standard");
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
  vi.restoreAllMocks();
});

describe.each(["topbar", "panel"] as const)("%s settings entry", (entry) => {
  it("updates mounted font and opacity immediately when display preferences change", async () => {
    // Given the same mounted panel and either public settings entry.
    const panel = await boot();
    open(entry);
    // When the real form's change handlers save display settings.
    change("ai-font-size", "large");
    change("ai-background-opacity", "100");
    // Then storage and the mounted appearance agree without remounting.
    expect(localStorage.getItem("oprn:ai-font-size")).toBe("large");
    expect(panel.dataset.aiFontSize).toBe("large");
    expect(panel.style.getPropertyValue("--ai-background-opacity")).toBe("100%");
  });

  it("synchronizes the existing session and composer when config is saved", async () => {
    // Given a real session, with only the external model turn replaced.
    const send = vi.spyOn(AssistantSession.prototype, "sendUserMessage").mockResolvedValue({
      assistantText: "Done", proposedCalls: [], stoppedReason: "final",
    });
    const update = vi.spyOn(AssistantSession.prototype, "updateConfig");
    await boot();
    const input = control<HTMLTextAreaElement>("ai-input");
    input.value = "A short question";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    control("ai-send").click();
    await whenAiChatPanelSettled();
    expect(send).toHaveBeenCalledOnce();
    update.mockClear();
    open(entry);
    // When settings persist a new autonomy preset and model — 자동 저장이라 별도 저장 클릭은 없다.
    change("ai-config-autonomy", "max");
    change("ai-config-model", "gemini-2.5-pro");
    // Then the current session and visible chrome use the same saved config.
    expect(update).toHaveBeenLastCalledWith(loadAiConfig());
    expect(control<HTMLSelectElement>("ai-composer-autonomy").value).toBe("max");
    // 지시줄에 추론 셀렉트는 없다 — 레벨 프리셋이 저장 config 의 추론을 정한다.
    expect(document.querySelector("[data-testid='ai-composer-reasoning']")).toBeNull();
    expect(loadAiConfig().reasoningEffort).toBe(resolveAutonomy("max").reasoningEffort);
    expect(control("ai-composer-model").textContent).toContain("gemini-2.5-pro");
  });
});

it("preserves explicit callbacks, fontRoot and extra sections without a panel", () => {
  // Given an independent caller with its own settings section and appearance root.
  const root = document.createElement("div");
  const extra = document.createElement("button");
  const onSaved = vi.fn();
  const onFontSizeChange = vi.fn();
  document.body.append(root);
  openAiSettingsModal({ fontRoot: root, onSaved, onFontSizeChange,
    extraSections: [{ id: "caller", title: "Caller", description: "", content: extra }],
  });
  // When that caller saves preferences — 글자·배경은 전용 저장 경로를 타고, persist/onSaved 는
  // 어느 설정 변경이든 한 번 탄다(수동 저장 버튼은 없다).
  change("ai-font-size", "small");
  change("ai-background-opacity", "78");
  change("ai-config-maxtokens", "4096");
  // Then its supplied contract remains active.
  expect(onFontSizeChange).toHaveBeenCalledExactlyOnceWith("small");
  expect(onSaved).toHaveBeenCalledExactlyOnceWith(loadAiConfig());
  expect(root.dataset.aiFontSize).toBe("small");
  expect(root.style.getPropertyValue("--ai-background-opacity")).toBe("78%");
  expect(control("ai-settings-section-caller").contains(extra)).toBe(true);
});

it("returns keyboard focus to the visible menu toggle instead of a hidden settings item", async () => {
  // Given settings opened by keyboard from the panel menu, which closes before opening the modal.
  await boot();
  const toggle = control("ai-command-menu-toggle");
  toggle.click();
  const item = control("ai-command-menu-settings");
  item.focus();
  item.click();
  // When Escape closes settings, then the still-visible menu opener receives focus.
  control("ai-settings-close").dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  expect(document.activeElement).toBe(toggle);
});

it("does not retain panel settings sections after panel teardown", async () => {
  // Given a mounted panel that has been disposed.
  await boot();
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  // When the independent topbar settings entry opens.
  openAiSettingsModal();
  // Then no disposed panel-owned controls are attached.
  expect(document.querySelector('[data-testid="ai-settings-section-temperature"]')).toBeNull();
});
