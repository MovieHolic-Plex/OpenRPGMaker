// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it } from "vitest";
import { renderAiChatPanel, teardownAiChatPanel, whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { editorState } from "@/editor/editorState";

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
  store.replace(createBlankProject());
  editorState.set({ currentMapId: store.getCurrent().startMapId, selection: null });
});

afterEach(async () => {
  teardownAiChatPanel();
  await whenAiChatPanelSettled();
  document.body.replaceChildren();
  localStorage.clear();
});

it("F9 shows feedback when an empty conversation is exported from the visible menu", () => {
  const panel = renderAiChatPanel();
  document.body.append(panel);
  const delegate = panel.querySelector<HTMLButtonElement>("[data-testid='ai-export']");
  const action = panel.querySelector<HTMLButtonElement>("[data-testid='ai-command-menu-export']");
  if (!delegate || !action) throw new Error("export controls missing");
  expect(delegate.disabled).toBe(true);
  expect(document.querySelector(".toast")).toBeNull();

  action.click();

  expect(document.querySelector(".toast")).not.toBeNull();
});
