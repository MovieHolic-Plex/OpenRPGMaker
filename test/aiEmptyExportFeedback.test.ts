// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";
import { localDiagnostics } from "@/editor/localDiagnostics";
import { modalStackDepthForTest, registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
import { clearAiUiEvents, listAiUiEvents } from "@/ai/uiEventLog";
import { AI_UI_ACTIONS } from "@/ai/uiEventTypes";

beforeEach(() => {
  localDiagnostics.clear(); resetModalStackForTest(); clearAiUiEvents();
  localStorage.clear();
  document.body.replaceChildren();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
});

afterEach(async () => {
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  localDiagnostics.clear(); resetModalStackForTest(); clearAiUiEvents();
  document.body.replaceChildren();
  localStorage.clear();
});

it("the empty-conversation menu opens consent without exporting, and Escape closes only its registered layer", () => {
  const panel = renderAiChatPanel();
  document.body.append(panel);
  const delegate = panel.querySelector<HTMLButtonElement>("[data-testid='ai-export']");
  const action = panel.querySelector<HTMLButtonElement>("[data-testid='ai-command-menu-export']");
  if (!delegate || !action) throw new Error("export controls missing");
  expect(delegate.disabled).toBe(false);
  const underlay = document.createElement("div");
  document.body.append(underlay);
  const closeUnderlay = registerModal(underlay, () => underlay.remove());
  const layers = modalStackDepthForTest();
  action.click();

  expect(document.querySelector('[data-testid="local-diagnostics-dialog"]')).not.toBeNull();
  expect(document.querySelector<HTMLButtonElement>('[data-testid="diagnostics-start"]')?.disabled).toBe(true);
  expect(localDiagnostics.snapshot()).toMatchObject({ active: false, sessionId: null, receipts: [] });
  expect(document.querySelector('[data-testid="diagnostics-preview-text"]')).toBeNull();
  expect(document.querySelector('a[download]')).toBeNull();
  expect(listAiUiEvents().some(event => event.action === AI_UI_ACTIONS.conversationExport)).toBe(false);
  expect(modalStackDepthForTest()).toBe(layers + 1);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  expect(document.querySelector('[data-testid="local-diagnostics-dialog"]')).toBeNull();
  expect(underlay.isConnected).toBe(true);
  expect(modalStackDepthForTest()).toBe(layers);
  closeUnderlay();
});
