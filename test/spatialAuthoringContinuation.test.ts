/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { assertNever, own, spatialId } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import {
  bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft, applyAuthoringPreview,
  spatialAuthoringController,
} from "../src/editor/panels/spatialAuthoringAccess";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => {
  bindSpatialAuthoringControllerFactory(null);
  resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers();
});

// Permanent promotion of the two exact independent AV11-03 scenarios.
it.each(["compile", "delete"] as const)("permits a second draft preview when the user continues after a %s preview", operation => {
  // Given a displayed generated/deletion preview that has not been accepted.
  const f = authoringFixture(operation === "delete");
  const before = structuredClone(store.getCurrent());
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  switch (operation) {
    case "compile": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: f.compile })); break;
    case "delete": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "delete-occurrence",
      request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } } })); break;
    default: return assertNever(operation);
  }
  authoringValue(previewAuthoringDraft());
  authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "continued-ui-edit" } })));
  // When the real helper submits the continued draft through its public preview action.
  const result = previewAuthoringDraft();
  // Then generated private raster must not become a forged user edit or leak into live state.
  expect(store.getCurrent()).toEqual(before);
  expect(result).toMatchObject({ kind: "ok" });
});

it.each(["compile", "delete"] as const)("accepts the whole proposal with one undo when a %s preview is continued", operation => {
  // Given an earlier source edit and an unapplied operation followed by two ordinary edits.
  const f = authoringFixture(operation === "delete");
  const before = structuredClone(store.getCurrent());
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  authoringValue(editAuthoringDraft(project => {
    const doc = fixtureDocument(project);
    const source = own(doc.library.objects, "hearth-design");
    return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library, objects: {
      ...doc.library.objects, [source.id]: { ...source, name: "Earlier source edit" },
    } } } };
  }));
  switch (operation) {
    case "compile": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: f.compile })); break;
    case "delete": authoringValue(editAuthoringDraft(project => project, { operation: { kind: "delete-occurrence",
      request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } } })); break;
    default: return assertNever(operation);
  }
  const first = authoringValue(previewAuthoringDraft());
  authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Intermediate title" } })));
  authoringValue(previewAuthoringDraft());
  authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Final title" } })));
  const final = authoringValue(previewAuthoringDraft());
  const expected = { ...structuredClone(first.project), meta: { ...first.project.meta, title: "Final title" } };
  expect(final.project).toEqual(expected);
  expect(final.impact).toEqual(first.impact);
  expect(first.impact.mapIds).toContain(f.target.mapId);
  expect(first.impact.occurrenceIds).toContain(f.occurrenceId);
  expect(store.getCurrent()).toEqual(before);
  const controller = spatialAuthoringController();
  if (!controller) throw new TypeError("Expected bound controller");
  // When the complete continued proposal traverses one acceptance, undo and redo.
  const accepted = authoringValue(applyAuthoringPreview());
  const adopted = structuredClone(store.getCurrent());
  const entries = getMapEditHistoryEntries().length;
  const undone = controller.undo();
  const restored = structuredClone(store.getCurrent());
  const redone = controller.redo();
  const reapplied = controller.apply(final);
  const continuedAfterApply = controller.continueDraft(final);
  // Then all authored and generated changes share one exact reversible transaction.
  expect(accepted).toEqual({ changed: true, impact: first.impact });
  expect(adopted).toEqual(expected);
  expect(entries).toBe(1);
  expect(undone).toBe(true);
  expect(restored).toEqual(before);
  expect(redone).toBe(true);
  expect(reapplied).toMatchObject({ kind: "error", error: { code: "already-applied" } });
  expect(continuedAfterApply).toMatchObject({ kind: "error", error: { code: "already-applied" } });
  expect(store.getCurrent()).toEqual(expected);
});

it("preserves the clone and prior edits when a design-clone preview is edited repeatedly", () => {
  // Given a source clone preview carrying an earlier ordinary edit.
  authoringFixture();
  const before = structuredClone(store.getCurrent());
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "Before clone" } }), {
    operation: { kind: "clone-design", source: { kind: "object", id: spatialId("hearth-design") },
      id: spatialId("continued-clone"), name: "Initial clone" },
  }));
  const first = authoringValue(previewAuthoringDraft());
  authoringValue(editAuthoringDraft(project => {
    const doc = fixtureDocument(project);
    const clone = own(doc.library.objects, "continued-clone");
    return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library, objects: {
      ...doc.library.objects, [clone.id]: { ...clone, name: "Edited clone", revision: 2 },
    } } } };
  }));
  authoringValue(previewAuthoringDraft());
  authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "After clone" } })));
  authoringValue(previewAuthoringDraft());
  // When accepting the continued clone through the real helper.
  authoringValue(applyAuthoringPreview());
  // Then the operation is neither dropped nor replayed, and the source remains independent.
  const doc = fixtureDocument(store.getCurrent());
  expect(own(doc.library.objects, "continued-clone")).toEqual({
    ...own(fixtureDocument(first.project).library.objects, "continued-clone"), name: "Edited clone", revision: 2,
  });
  expect(own(doc.library.objects, "hearth-design")).toEqual(own(fixtureDocument(before).library.objects, "hearth-design"));
  expect(store.getCurrent().meta.title).toBe("After clone");
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});
