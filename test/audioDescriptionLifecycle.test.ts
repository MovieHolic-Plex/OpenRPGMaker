// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { getMapEditHistoryState, resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { modalStackDepthForTest } from "@/editor/ui/modalStack";
import {
  chooseFile, chooseKind, cleanupAudioManager, control, readFileThroughManager,
  row, setupAudioManager, writeDraft,
} from "./helpers/audioDescriptionManager";

beforeEach(setupAudioManager);
afterEach(cleanupAudioManager);

it.each(["row", "kind", "close", "escape", "backdrop"] as const)(
  "preserves the draft when a dirty %s transition is canceled",
  attempt => {
    // Given:
    chooseKind("music");
    row("audio-a").click();
    const input = writeDraft("cancel sentinel");
    const before = structuredClone(store.getCurrent());
    // When:
    switch (attempt) {
      case "row": row("audio-b").click(); break;
      case "kind": chooseKind("sound"); break;
      case "close": control("resource-modal-close").click(); break;
      case "escape":
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        break;
      case "backdrop":
        control("resource-modal").dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        break;
      default: {
        const unreachable: never = attempt;
        throw new Error(String(unreachable));
      }
    }
    control("audio-description-dirty-cancel").click();
    // Then:
    expect(control("audio-description-input")).toBe(input);
    expect(input.value).toBe("cancel sentinel");
    expect(row("audio-a").getAttribute("aria-pressed")).toBe("true");
    expect(store.getCurrent()).toEqual(before);
    expect(modalStackDepthForTest()).toBe(1);
  },
);

it("offers dirty protection again after Escape cancellation", () => {
  // Given:
  chooseKind("music");
  row("audio-a").click();
  writeDraft("repeat escape");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  control("audio-description-dirty-cancel").click();
  // When:
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  // Then:
  expect(document.querySelectorAll('[data-testid="audio-description-dirty-dialog"]').length).toBe(1);
  expect(modalStackDepthForTest()).toBe(2);
});

it.each(["save", "discard"] as const)("honors %s before changing the selected row", decision => {
  // Given:
  chooseKind("music");
  row("audio-a").click();
  writeDraft("decision sentinel");
  // When:
  row("audio-b").click();
  control(`audio-description-dirty-${decision}`).click();
  // Then:
  expect(row("audio-b").getAttribute("aria-pressed")).toBe("true");
  expect(store.getCurrent().audioDescriptions?.music?.["audio-a"])
    .toBe(decision === "save" ? "decision sentinel" : undefined);
});

it("selects a newly imported audio row after the real file read completes", async () => {
  // Given:
  chooseKind("music");
  const before = new Set(Object.keys(store.getCurrent().assets.uploaded));
  // When:
  await readFileThroughManager(new File(["OggS"], "new-track.ogg", { type: "audio/ogg" }));
  // Then:
  const asset = Object.values(store.getCurrent().assets.uploaded).find(item => !before.has(item.id));
  if (!asset) throw new Error("Import produced no asset");
  expect(row(asset.id).getAttribute("aria-pressed")).toBe("true");
  expect(control<HTMLTextAreaElement>("audio-description-input").value).toBe("");
  expect(control("audio-description-source").dataset.source).toBe("missing");
  expect(store.getCurrent().audioDescriptions).toBeUndefined();
});

it("retains the project when a renamed non-audio file fails data validation", async () => {
  // Given:
  chooseKind("music");
  const before = structuredClone(store.getCurrent());
  // When:
  await readFileThroughManager(new File(["not audio"], "renamed.ogg", { type: "image/png" }));
  // Then:
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("retains the project when FileReader reports failure", () => {
  // Given: failure is mocked only at the browser I/O boundary.
  chooseKind("music");
  const before = structuredClone(store.getCurrent());
  vi.spyOn(FileReader.prototype, "readAsDataURL").mockImplementation(function (this: FileReader) {
    this.dispatchEvent(new Event("error"));
    this.dispatchEvent(new Event("loadend"));
  });
  // When:
  chooseFile(new File(["OggS"], "failed.ogg", { type: "audio/ogg" }));
  // Then:
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("deletes the uploaded audio and its override in one undoable mutation", () => {
  // Given:
  store.update(project => {
    project.audioDescriptions = { music: { "audio-a": "delete sentinel", "audio-b": "keep" } };
  });
  chooseKind("music");
  row("audio-a").click();
  resetMapEditHistory();
  // When:
  control("audio-description-delete").click();
  // Then:
  expect(store.getCurrent().assets.uploaded["audio-a"]).toBeUndefined();
  expect(store.getCurrent().audioDescriptions?.music).toEqual({ "audio-b": "keep" });
  expect(undoMapEdit()).toBe(true);
  expect(store.getCurrent().assets.uploaded["audio-a"]?.id).toBe("audio-a");
  expect(store.getCurrent().audioDescriptions?.music?.["audio-a"]).toBe("delete sentinel");
});

it.each(["map", "system"] as const)("retains an in-use upload and override referenced by %s", owner => {
  // Given:
  store.update(project => {
    project.audioDescriptions = { music: { "audio-a": "protected" } };
    if (owner === "system") project.system.defaultBgmResourceId = "audio-a";
    else {
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("Missing start map");
      map.bgm = { mode: "custom", resourceId: "audio-a" };
    }
  });
  chooseKind("music");
  row("audio-a").click();
  resetMapEditHistory();
  const before = structuredClone(store.getCurrent());
  // When:
  control("audio-description-delete").click();
  // Then:
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState().canUndo).toBe(false);
});

it("ends draft and pending-dialog ownership when another project replaces the current project", () => {
  // Given:
  chooseKind("music");
  row("audio-a").click();
  writeDraft("belongs only to A");
  control("resource-modal-close").click();
  const staleSave = control("audio-description-dirty-save");
  // When:
  store.replaceProject(createBlankProject());
  staleSave.click();
  // Then:
  expect(store.getCurrent().audioDescriptions).toBeUndefined();
  expect(document.querySelector('[data-testid="resource-modal"]')).toBeNull();
  expect(modalStackDepthForTest()).toBe(0);
});
