// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { listAudioResources } from "@/assets/audioResourceCatalog";
import { getAudioDescriptionOverride } from "@/project/audioDescriptions";
import { store } from "@/project/store";
import {
  getMapEditHistoryState, redoMapEdit, resetMapEditHistory, undoMapEdit,
} from "@/editor/mapEditHistory";
import { openResourceModal } from "@/editor/panels/resourceModal";
import { historyHotkeyOwnedByPanel } from "@/editor/hotkeys";
import {
  chooseKind, cleanupAudioManager, control, row, setupAudioManager, writeDraft,
} from "./helpers/audioDescriptionManager";

beforeEach(setupAudioManager);
afterEach(cleanupAudioManager);
const resource = { kind: "music", resourceId: "audio-a" } as const;

describe("audio description manager", () => {
  it("owns history shortcuts while the resource modal is open", () => {
    chooseKind("music");

    expect(historyHotkeyOwnedByPanel()).toBe(true);
  });

  it("releases history shortcut ownership when the resource modal closes", () => {
    chooseKind("music");

    control("resource-modal-close").click();

    expect(historyHotkeyOwnedByPanel()).toBe(false);
  });

  it("renders an editable description when the visible music category is selected", () => {
    // Given: the existing resource modal.
    // When:
    chooseKind("music");
    // Then: behavioral baseline RED, not a missing-module failure.
    expect(document.querySelectorAll('[data-testid="audio-description-input"]').length).toBe(1);
  });

  it.each(["music", "sound"] as const)("enumerates the complete %s catalog without mutations", kind => {
    // Given:
    const before = structuredClone(store.getCurrent());
    const expected = listAudioResources(kind, before).map(item => item.id).sort();
    // When:
    chooseKind(kind);
    // Then:
    const actual = [...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
      .map(node => node.dataset.resourceId).sort();
    expect(actual).toEqual(expected);
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
  });

  it("commits normalized input once when Save is activated", () => {
    // Given:
    chooseKind("music");
    row(resource.resourceId).click();
    writeDraft("  <b>author sentinel</b>\nsecond line  ");
    const changes: { readonly scope: string; readonly origin?: string; readonly label?: string }[] = [];
    const unsubscribe = store.subscribe((_project, change) => changes.push(change));
    // When:
    control("audio-description-save").click();
    unsubscribe();
    // Then:
    expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource))
      .toBe("<b>author sentinel</b>\nsecond line");
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ scope: "project", origin: "human" });
    expect(Boolean(changes[0]?.label)).toBe(true);
    expect(control("resource-modal").querySelector("b")).toBeNull();
    expect(control("audio-description-source").dataset.source).toBe("project");
  });

  it("retains a saved description when the manager is reopened", () => {
    // Given:
    chooseKind("music");
    row(resource.resourceId).click();
    writeDraft("reopen sentinel");
    control("audio-description-save").click();
    control("resource-modal-close").click();
    // When:
    openResourceModal();
    chooseKind("music");
    row(resource.resourceId).click();
    // Then:
    expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("reopen sentinel");
  });

  it("stores an explicit clear when an empty draft is saved", () => {
    // Given:
    chooseKind("music");
    const builtin = listAudioResources("music", store.getCurrent()).find(item => item.description.length > 0);
    if (!builtin) throw new Error("Expected a described bundled resource");
    row(builtin.id).click();
    writeDraft("");
    // When:
    control("audio-description-save").click();
    // Then:
    expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, {
      kind: "music", resourceId: builtin.id,
    })).toBe("");
    expect(control("audio-description-source").dataset.source).toBe("project");
  });

  it("removes only the selected override when Restore default is activated", () => {
    // Given:
    store.update(project => {
      project.audioDescriptions = { music: { "audio-a": "", "audio-b": "keep sibling" } };
    });
    chooseKind("music");
    row(resource.resourceId).click();
    resetMapEditHistory();
    // When:
    control("audio-description-reset").click();
    // Then:
    expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource)).toBeUndefined();
    expect(store.getCurrent().audioDescriptions?.music?.["audio-b"]).toBe("keep sibling");
    expect(control("audio-description-source").dataset.source).toBe("missing");
  });

  it("restores the prior override when project Undo runs", () => {
    // Given:
    chooseKind("music");
    row(resource.resourceId).click();
    writeDraft("undo sentinel");
    control("audio-description-save").click();
    // When:
    expect(undoMapEdit()).toBe(true);
    // Then:
    expect(getAudioDescriptionOverride(store.getCurrent().audioDescriptions, resource)).toBeUndefined();
    expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("");
  });

  it("restores the authored override when project Redo runs", () => {
    // Given:
    chooseKind("music");
    row(resource.resourceId).click();
    writeDraft("redo sentinel");
    control("audio-description-save").click();
    undoMapEdit();
    // When:
    expect(redoMapEdit()).toBe(true);
    // Then:
    expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("redo sentinel");
  });

  it("retains draft DOM, caret and focus during an unrelated store rerender", () => {
    // Given:
    chooseKind("music");
    row(resource.resourceId).click();
    const input = writeDraft("draft stays here");
    input.setSelectionRange(3, 8);
    // When:
    store.update(project => {
      project.audioDescriptions = { music: { "audio-b": "external update" } };
    }, { scope: "project", label: "fixture update" });
    // Then:
    expect(control("audio-description-input")).toBe(input);
    expect(input.value).toBe("draft stays here");
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
    expect(document.activeElement).toBe(input);
  });

  it("finds a resource by description without changing the project", () => {
    store.update(project => {
      project.audioDescriptions = { music: { "audio-a": "SEARCH_SENTINEL_20260906" } };
    });
    chooseKind("music");
    const before = structuredClone(store.getCurrent());
    const search = control<HTMLInputElement>("audio-description-search");

    search.value = "SEARCH_SENTINEL_20260906";
    search.dispatchEvent(new Event("input", { bubbles: true }));

    expect([...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
      .map(node => node.dataset.resourceId)).toEqual(["audio-a"]);
    expect(store.getCurrent()).toEqual(before);
  });

  it("filters effective empty descriptions without changing the current draft", () => {
    // Given:
    chooseKind("music");
    row(resource.resourceId).click();
    const input = writeDraft("unsaved");
    const before = structuredClone(store.getCurrent());
    const expected = listAudioResources("music", before)
      .filter(item => item.description.trim().length === 0).map(item => item.id).sort();
    // When:
    const filter = control<HTMLInputElement>("audio-description-missing-filter");
    filter.checked = true;
    filter.dispatchEvent(new Event("change", { bubbles: true }));
    // Then:
    expect([...document.querySelectorAll<HTMLElement>('[data-testid="audio-resource-row"]')]
      .map(node => node.dataset.resourceId).sort()).toEqual(expected);
    expect(control("audio-description-input")).toBe(input);
    expect(input.value).toBe("unsaved");
    expect(store.getCurrent()).toEqual(before);
  });

  it("rejects an over-limit programmatic draft without recording history", () => {
    // Given:
    chooseKind("music");
    row(resource.resourceId).click();
    writeDraft("x".repeat(4001));
    const before = structuredClone(store.getCurrent());
    // When:
    control("audio-description-save").click();
    // Then:
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryState().canUndo).toBe(false);
    expect(control<HTMLTextAreaElement>("audio-description-input").value).toHaveLength(4001);
  });
});
