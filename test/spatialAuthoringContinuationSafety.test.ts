/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { assertNever, own } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import {
  bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft,
} from "../src/editor/panels/spatialAuthoringAccess";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers();
});

it.each(["maps", "bindings"] as const)("rejects forged %s when editing a compiled preview", field => {
  // Given a genuine generated preview followed by a manual attempt to change protected output.
  const f = authoringFixture();
  const before = structuredClone(store.getCurrent());
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: f.compile }));
  authoringValue(previewAuthoringDraft());
  authoringValue(editAuthoringDraft(project => {
    switch (field) {
      case "maps": own(project.maps, f.target.mapId).lowerTiles[0] = 42; return project;
      case "bindings": {
        const doc = fixtureDocument(project);
        const occurrence = own(doc.occurrences, f.occurrenceId);
        return { ...project, spatialAuthoring: { ...doc, occurrences: { ...doc.occurrences,
          [occurrence.id]: { ...occurrence, bindings: [] },
        } } };
      }
      default: return assertNever(field);
    }
  }));
  // When previewing the manually altered continuation.
  const result = previewAuthoringDraft();
  // Then continuation provenance does not authorize new raster or binding edits.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("rejects copied generated output when it is supplied through a fresh raw draft", () => {
  // Given valid generated output but no continuation authority on a fresh issued draft.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  const raw = authoringValue(f.controller.createDraft());
  Object.assign(raw.project, structuredClone(preview.project));
  const before = structuredClone(store.getCurrent());
  // When asking the original issuing controller to treat the copy as an authored edit.
  const result = f.controller.preview(raw, { operation: { kind: "edit" } });
  // Then exact copied compiler output is not a substitute for an issued continuation handle.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("rejects a continued proposal when live state changes after the displayed preview", () => {
  // Given a displayed preview and a direct live mutation that bypasses store notifications.
  authoringFixture();
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Draft title" } })));
  authoringValue(previewAuthoringDraft());
  store.getCurrent().meta.title = "Independent live mutation";
  const before = structuredClone(store.getCurrent());
  // When continuing the old proposal; either continuation or preview may reject stale authority.
  const edited = editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Continued title" } }));
  const result = (() => {
    switch (edited.kind) {
      case "ok": return previewAuthoringDraft();
      case "error": return edited;
      default: return assertNever(edited);
    }
  })();
  // Then no new baseline can launder the independent mutation into the old proposal.
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});
