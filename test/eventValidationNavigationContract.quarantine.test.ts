/** @vitest-environment happy-dom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerAiBootIntentTarget } from "@/editor/aiBootIntent";
import { editorState } from "@/editor/editorState";
import { validateEventDraft } from "@/editor/eventDraftValidator";
import { clearCommandInspector, selectedCommandPath } from "@/editor/panels/eventEditor/commandInspector";
import { openEventEditorModal } from "@/editor/panels/eventEditor/modal";
import { refreshEventValidationBell } from "@/editor/panels/eventEditor/validationBell";
import { modalStackEntryCountForTest, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EventPage } from "@/project/types";

let mapId: string;
function element(selector: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error(`Missing ${selector}`);
  return node;
}
function control(id: string): HTMLElement { return element(`[data-testid="${id}"]`); }
function bell(): HTMLDetailsElement {
  const node = control("event-draft-validation");
  if (!(node instanceof HTMLDetailsElement)) throw new Error("Expected details");
  return node;
}
function openBell(): void {
  bell().open = true;
  bell().dispatchEvent(new Event("toggle"));
}
function clickIssue(code: string, ordinal = 0): void {
  const validation = validateEventDraft(store.getCurrent(), mapId, "validation");
  const matches = validation.issues.map((issue, index) => ({ issue, index }))
    .filter(({ issue }) => issue.pageId === "p2" && issue.code === code);
  const match = matches[ordinal];
  if (!match) throw new Error(`Missing issue ${code} ${ordinal}`);
  openBell();
  control(`event-draft-validation-issue-${match.index}`).click();
}

beforeEach(() => {
  resetModalStackForTest();
  clearCommandInspector();
  const project = createBlankProject();
  mapId = project.startMapId;
  const map = project.maps[mapId];
  if (!map) throw new Error("Expected map");
  const base: EventPage = { id: "p1", name: "origin", conditions: [], graphic: {}, trigger: { kind: "action" },
    priority: "below", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "origin" }] };
  map.events = [{ id: "validation", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [base, {
    ...structuredClone(base), id: "p2", name: "issues", conditions: [
      { kind: "switch", switchId: "missing-first", value: false },
      { kind: "switch", switchId: "missing-second", value: true },
      { kind: "variable", variableId: "missing-variable", op: ">=", value: 1 },
      { kind: "item", itemId: "missing-item", present: true },
      { kind: "actor", actorId: "missing-actor", present: true },
      { kind: "any", conditions: [
        { kind: "switch", switchId: "missing-nested", value: true },
        { kind: "not", condition: { kind: "item", itemId: "missing-deep", present: true } },
      ] },
      { kind: "switch", switchId: "missing-third", value: true },
    ], commands: [{ kind: "loop", body: [{ kind: "gotoLabel", name: "missing-label" }] }],
  }] }];
  store.replaceProject(project);
  editorState.set({ currentMapId: mapId, selectedEventId: "validation", selectedEventPageId: "p1" });
  openEventEditorModal(mapId, "validation");
});
afterEach(() => {
  document.querySelector('[data-testid="event-editor-modal"]')?.dispatchEvent(new CustomEvent("oprn:event-editor-close"));
  document.body.replaceChildren();
  clearCommandInspector();
  resetModalStackForTest();
  vi.restoreAllMocks();
});

describe("validation navigation at the rendered modal seam", () => {
  it("targets nested condition siblings rather than the first repeated field", () => {
    // Given: two repeated switch fields in a fork's nested conditions.
    store.update(project => {
      const page = project.maps[mapId]?.events.find(event => event.id === "validation")?.pages?.[1];
      if (!page) throw new Error("Missing page");
      page.conditions = [];
      page.commands = [{ kind: "fork", condition: { kind: "all", conditions: [
        { kind: "switch", switchId: "missing-first", value: true },
        { kind: "not", condition: { kind: "switch", switchId: "missing-second", value: false } },
      ] }, then: [] }];
    });
    // When: the deeper sibling's diagnostic is selected.
    clickIssue("reference.switch.missing", 1);
    // Then: the exact condition form owns the focused picker.
    expect(document.activeElement?.closest("[data-condition-path]")?.getAttribute("data-condition-path")).toBe("[1,0]");
    expect(document.activeElement?.classList.contains("event-record-picker-trigger")).toBe(true);
  });

  it("prepares an editable unsent handoff and retains the event editor draft", () => {
    // Given: an existing composer draft behind the event editor.
    const input = document.createElement("textarea");
    input.value = "Existing instructions";
    document.body.append(input);
    const send = vi.fn();
    registerAiBootIntentTarget({ open: () => {}, getDraft: () => input.value,
      prefill: text => { input.value = text; input.focus(); }, send });
    // When: the user explicitly asks the local assistant from the bell.
    openBell();
    control("event-validation-ask-assistant").click();
    // Then: the editor is retained, the user's bytes survive, and no turn starts.
    expect(control("event-editor-modal").hidden).toBe(true);
    expect(document.activeElement).toBe(input);
    expect(input.value.startsWith("Existing instructions\n\n")).toBe(true);
    expect(input.value).toContain('"status": "UNSENT"');
    expect(send).not.toHaveBeenCalled();
    registerAiBootIntentTarget(null);
  });

  it("focuses the exact command field after navigation instead of stopping on the row", () => {
    // Given: two invalid fields in a nested command, on a different page.
    store.update(project => {
      const page = project.maps[mapId]?.events.find(event => event.id === "validation")?.pages?.[1];
      if (!page) throw new Error("Missing page");
      page.commands = [{ kind: "loop", body: [{ kind: "changeFactionStance", a: "missing-a", b: "missing-b", op: "=", value: 0 }] }];
    });
    // When: selecting the second field's diagnostic.
    clickIssue("reference.faction.missing", 1);
    // Then: the inspector and exact editable field agree.
    expect(selectedCommandPath()).toEqual([0, -5, 0]);
    expect(document.activeElement?.getAttribute("data-custom-select-for")
      ?? document.activeElement?.getAttribute("data-testid")).toBe("event-command-faction-b");
  });

  it.each([
    ["reference.switch.missing", 0, "event-page-switch-condition-input", "event-page-switch-condition-picker-open"],
    ["reference.switch.missing", 1, "event-page-switch2-condition-input", "event-page-switch2-condition-picker-open"],
    ["reference.variable.missing", 0, "event-page-variable-condition-input", "event-page-variable-picker-open"],
    ["reference.item.missing", 0, "event-page-item-condition-input", "event-page-item-condition-picker-open"],
    ["reference.actor.missing", 0, "event-page-actor-condition-input", "event-page-actor-condition-picker-open"],
    ["reference.switch.missing", 2, "event-page-advanced-condition-switch-0-0", "event-page-advanced-condition-switch-picker-0-0"],
    ["reference.item.missing", 1, "event-page-advanced-condition-item-0-1-0", "event-page-advanced-condition-item-0-1-0-picker-open"],
    ["reference.switch.missing", 3, "event-page-advanced-condition-switch-1", "event-page-advanced-condition-switch-picker-1"],
  ])("focuses exact editable field for %s occurrence %i", (code, ordinal, inputId, triggerId) => {
    // Given: another selected page and closed condition rail.
    const validation = validateEventDraft(store.getCurrent(), mapId, "validation");
    const issue = validation.issues.filter(entry => entry.pageId === "p2" && entry.code === code)[ordinal];
    // When: the user selects the validation result.
    clickIssue(code, ordinal);
    // Then: the locator exists and focus lands on its visible picker, never its hidden select.
    expect(issue?.field?.testId).toBe(inputId);
    expect(editorState.get().selectedEventPageId).toBe("p2");
    expect(document.activeElement).toBe(control(triggerId));
    expect(control(triggerId).closest(".event-editor-settings-accordion-group")?.classList.contains("is-open")).toBe(true);
    expect(control(triggerId).closest("details:not([open])")).toBeNull();
    expect(bell().open).toBe(false);
    expect(validation.canCommit).toBe(false);
    expect(validation.errorCount).toBe(9);
  });

  it.each(["list", "storyboard", "preview", "flow"])("reveals cross-page nested command from %s with filter and inspector synchronized", mode => {
    // Given: an origin view whose query hides the invalid command.
    control(`event-view-toggle-${mode}`).click();
    const search = control("event-command-search");
    if (!(search instanceof HTMLInputElement)) throw new Error("Expected search input");
    search.value = "no-matching-command";
    search.dispatchEvent(new Event("input", { bubbles: true }));
    // When: navigating through the real bell row.
    clickIssue("label.target-missing");
    // Then: exact authored list selection, not a CSS-only or hidden match.
    expect(editorState.get().selectedEventPageId).toBe("p2");
    expect(element(".cmd-list").hidden).toBe(false);
    expect(selectedCommandPath()).toEqual([0, -5, 0]);
    expect(control("event-editor-inspector").dataset.commandPath).toBe("[0,-5,0]");
    expect(document.activeElement).toBe(control("event-command-goto-label-name"));
    const currentSearch = control("event-command-search");
    expect(currentSearch instanceof HTMLInputElement && currentSearch.value).toBe("");
  });

  it("dismisses only the bell on first Escape and restores summary focus", () => {
    // Given: the bell is layered over its mounted editor.
    const depth = modalStackEntryCountForTest();
    openBell();
    control("event-draft-validation-issue-0").focus();
    // When: Escape is dispatched through the document capture layer.
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    // Then: the parent survives and the popup releases its layer.
    expect(document.querySelector('[data-testid="event-editor-modal"]')).not.toBeNull();
    expect(bell().open).toBe(false);
    expect(document.activeElement).toBe(control("event-draft-validation-summary"));
    expect(modalStackEntryCountForTest()).toBe(depth);
  });

  it("registers once across refresh and unregisters synchronously on issue navigation", () => {
    const depth = modalStackEntryCountForTest();
    openBell();
    expect(modalStackEntryCountForTest()).toBe(depth + 1);
    refreshEventValidationBell(document.body, validateEventDraft(store.getCurrent(), mapId, "validation"));
    expect(bell().open).toBe(true);
    expect(modalStackEntryCountForTest()).toBe(depth + 1);
    clickIssue("label.target-missing");
    expect(modalStackEntryCountForTest()).toBe(depth);
  });

  it("releases its layer when refresh removes the final issue", () => {
    const depth = modalStackEntryCountForTest();
    openBell();
    refreshEventValidationBell(document.body, { issues: [], errorCount: 0, warningCount: 0, infoCount: 0, canCommit: true });
    expect(bell().open).toBe(false);
    expect(bell().hidden).toBe(true);
    expect(modalStackEntryCountForTest()).toBe(depth);
  });

  it("releases outside-dismiss resources before reopening through the summary", () => {
    const depth = modalStackEntryCountForTest();
    control("event-draft-validation-summary").click();
    expect(modalStackEntryCountForTest()).toBe(depth + 1);
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(bell().open).toBe(false);
    expect(modalStackEntryCountForTest()).toBe(depth);
    control("event-draft-validation-summary").click();
    expect(bell().open).toBe(true);
    expect(modalStackEntryCountForTest()).toBe(depth + 1);
  });

  it("cleans detached bell resources on the exact removal notification", async () => {
    openBell();
    const popup = bell();
    const depth = modalStackEntryCountForTest();
    const remove = vi.spyOn(document, "removeEventListener");
    // Subscribe before removal; no timing delay or polling.
    const removed = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => { observer.disconnect(); reject(new Error("Missing removal notification")); }, 2000);
      const observer = new MutationObserver(() => {
        if (popup.isConnected) return;
        observer.disconnect(); clearTimeout(timeout); resolve();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    });
    popup.remove();
    await removed;
    expect(modalStackEntryCountForTest()).toBe(depth - 1);
    expect(remove.mock.calls.some(([type]) => type === "pointerdown")).toBe(true);
  });

  it("removes its document listener and layer immediately when the parent closes", () => {
    openBell();
    const remove = vi.spyOn(document, "removeEventListener");
    control("event-editor-cancel").click();
    expect(modalStackEntryCountForTest()).toBe(0);
    expect(remove.mock.calls.some(([type]) => type === "pointerdown")).toBe(true);
  });
});
