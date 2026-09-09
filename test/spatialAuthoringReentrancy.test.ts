/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SpatialAuthoringApplied, SpatialAuthoringResult } from "../src/editor/spatial/authoringTypes";
import { getMapEditHistoryEntries, getMapEditHistoryState, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { ProjectRoutingError } from "../src/project/spatial/saveRouting";
import { store } from "../src/project/store";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

it("rejects the same in-flight preview when a synchronous observer undoes its adoption", () => {
  // Given the exact AV11-02 observer undo/reentry witness on the real store/history.
  const f = authoringFixture();
  const before = structuredClone(store.getCurrent());
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  let observed = false;
  const undoResults: boolean[] = [];
  const reentry: SpatialAuthoringResult<SpatialAuthoringApplied>[] = [];
  const release = store.subscribe(() => {
    if (observed) return;
    observed = true;
    undoResults.push(f.controller.undo());
    reentry.push(f.controller.apply(preview));
  });
  try {
    // When the outer acceptance enters synchronous publication.
    const accepted = f.controller.apply(preview);
    // Then history was already available, reentry is rejected, and the observer's undo wins.
    expect(accepted).toMatchObject({ kind: "ok", value: { changed: true } });
    expect(undoResults).toEqual([true]);
    expect(reentry).toMatchObject([{ kind: "error", error: { code: "already-applied" } }]);
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
  } finally { release(); }
});

it("preserves distinct nested transactions when an observer accepts a different preview", () => {
  // Given a subscriber that authors a separate proposal from the adopted state.
  const f = authoringFixture();
  const before = structuredClone(store.getCurrent());
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  let observed = false;
  const nested: SpatialAuthoringResult<SpatialAuthoringApplied>[] = [];
  const release = store.subscribe(() => {
    if (observed) return;
    observed = true;
    const draft = authoringValue(f.controller.createDraft());
    draft.project.meta.title = "distinct observer transaction";
    nested.push(f.controller.apply(authoringValue(f.controller.preview(draft, { operation: { kind: "edit" } }))));
  });
  try {
    // When the outer preview and distinct nested preview are accepted.
    const accepted = f.controller.apply(preview);
    // Then both retain their own history entries, in exact undo/redo order.
    expect(accepted).toMatchObject({ kind: "ok", value: { changed: true } });
    expect(nested).toMatchObject([{ kind: "ok", value: { changed: true } }]);
  } finally { release(); }
  const final = structuredClone(store.getCurrent());
  expect(getMapEditHistoryEntries()).toHaveLength(2);
  expect(f.controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(preview.project);
  expect(f.controller.undo()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
  expect(f.controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(preview.project);
  expect(f.controller.redo()).toBe(true);
  expect(store.getCurrent()).toEqual(final);
});

it("allows retry of the same preview when the previous store write was rejected before adoption", () => {
  // Given a transient pre-adoption rejection at the narrow store boundary.
  const f = authoringFixture();
  const before = structuredClone(store.getCurrent());
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  vi.spyOn(store, "replace").mockImplementationOnce(() => { throw new ProjectRoutingError("canonical-replacement", "pre-adoption rejection"); });
  expect(f.controller.apply(preview)).toMatchObject({ kind: "error", error: { code: "invalid" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toEqual([]);
  // When the same handle retries against the unchanged real store.
  const retried = f.controller.apply(preview);
  // Then the rejected write did not spend its capability.
  expect(retried).toMatchObject({ kind: "ok", value: { changed: true } });
  expect(store.getCurrent()).toEqual(preview.project);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});

it("keeps an adopted preview consumed when publication is undone before a later error", () => {
  // Given an actual adoption and observer undo, followed by an injected post-publication failure.
  const f = authoringFixture();
  const before = structuredClone(store.getCurrent());
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  let observed = false;
  const release = store.subscribe(() => {
    if (observed) return;
    observed = true;
    f.controller.undo();
  });
  const replace = store.replace.bind(store);
  vi.spyOn(store, "replace").mockImplementationOnce((project, options) => {
    replace(project, options);
    throw new ProjectRoutingError("canonical-replacement", "post-publication failure");
  });
  try {
    expect(f.controller.apply(preview)).toMatchObject({ kind: "error", error: { code: "invalid" } });
  } finally { release(); }
  expect(store.getCurrent()).toEqual(before);
  // When the already adopted handle retries against its restored original baseline.
  const retried = f.controller.apply(preview);
  // Then a later failure cannot resurrect a consumed capability.
  expect(retried).toMatchObject({ kind: "error", error: { code: "already-applied" } });
  expect(getMapEditHistoryState()).toEqual({ canUndo: false, canRedo: true });
});
