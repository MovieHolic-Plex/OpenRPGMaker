/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { getMapEditHistoryEntries, getMapEditHistoryState, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { own } from "../src/project/spatial/domain";
import { ProjectRoutingError } from "../src/project/spatial/saveRouting";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

it.each(["tile", "source", "association"] as const)("rejects stale apply without changing history when a human edits %s after preview", change => {
  // Given a compiled preview and a later independent human edit.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  store.update(project => {
    const doc = fixtureDocument(project);
    switch (change) {
      case "tile": own(project.maps, f.target.mapId).lowerTiles[0] = 42; break;
      case "source": project.spatialAuthoring = { ...doc, library: { ...doc.library, objects: { ...doc.library.objects,
        "hearth-design": { ...own(doc.library.objects, "hearth-design"), revision: 2 } } } }; break;
      case "association": project.spatialAuthoring = { ...doc, rootOccurrenceIds: [...doc.rootOccurrenceIds].reverse() }; break;
    }
  });
  const before = structuredClone(store.getCurrent());
  // When accepting the now-stale proposal.
  const result = f.controller.apply(preview);
  // Then neither human content nor history is changed.
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("rejects preview when a detached draft rewrites manually owned raster", () => {
  // Given a detached working copy with a raw tile overwrite outside compiler ownership.
  const f = authoringFixture();
  own(f.draft.project.maps, f.target.mapId).lowerTiles[0] = 42;
  const before = structuredClone(store.getCurrent());
  // When requesting a source edit preview.
  const result = f.controller.preview(f.draft, { operation: { kind: "edit" } });
  // Then raw raster edits are rejected rather than smuggled through shared authoring.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
});

it("rejects ownership forgery when a draft erases existing binding proof", () => {
  // Given an owned compiled occurrence whose draft tries to release ownership directly.
  const f = authoringFixture(true);
  const doc = fixtureDocument(f.draft.project);
  const occurrence = own(doc.occurrences, f.occurrenceId);
  f.draft.project.spatialAuthoring = { ...doc, occurrences: { ...doc.occurrences, [occurrence.id]: { ...occurrence, bindings: [] } } };
  // When preview bypasses the explicit detach operation.
  const result = f.controller.preview(f.draft, { operation: { kind: "edit" } });
  // Then the shared boundary rejects the forged release.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
});

it("does not add a second history entry when an accepted preview is applied again", () => {
  // Given an already accepted proposal.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  authoringValue(f.controller.apply(preview));
  // When the same handle is accepted again.
  const result = f.controller.apply(preview);
  // Then it is consumed exactly once.
  expect(result).toMatchObject({ kind: "error", error: { code: "already-applied" } });
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});

it("preserves redo when store rejection prevents apply", () => {
  // Given an undo branch and a valid proposal whose real store boundary rejects authority.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  authoringValue(f.controller.apply(preview));
  f.controller.undo();
  const fresh = authoringValue(f.controller.preview(authoringValue(f.controller.createDraft()), { operation: { kind: "edit" }, compile: f.compile }));
  const before = structuredClone(store.getCurrent());
  const history = getMapEditHistoryState();
  vi.spyOn(store, "replace").mockImplementationOnce(() => { throw new ProjectRoutingError("canonical-replacement", "fixture rejection"); });
  // When the store refuses the commit before mutation.
  const result = f.controller.apply(fresh);
  // Then content and the existing redo branch survive exactly.
  expect(result.kind).toBe("error");
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryState()).toEqual(history);
});

it("rejects foreign handles when another controller issued the draft", () => {
  // Given a handle issued elsewhere.
  const f = authoringFixture();
  // When a second controller is asked to preview it.
  const result = createSpatialAuthoringController().preview(f.draft, { operation: { kind: "edit" } });
  // Then authority cannot be transferred by copying a structural object.
  expect(result).toMatchObject({ kind: "error", error: { code: "foreign-draft" } });
});
