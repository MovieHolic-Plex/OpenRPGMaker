/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, getMapEditHistoryState, recordProjectSnapshot, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { own } from "../src/project/spatial/domain";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { worldEntryOutput, overviewBinding } from "./support/spatialOverviewFixture";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("makes project and history visible together when synchronous store observers run", () => {
  // Given a valid compiled proposal and a subscribed real store observer.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  const counts: number[] = [];
  const unsubscribe = store.subscribe(() => { counts.push(getMapEditHistoryEntries().length); });
  try {
    // When acceptance publishes the project once.
    authoringValue(f.controller.apply(preview));
    // Then observers never see the new project with missing history.
    expect(counts).toEqual([1]);
  } finally { unsubscribe(); }
});

it("undoes the observer's later edit first when a subscriber records a nested edit", () => {
  // Given a subscriber that performs one subsequent editor operation.
  const f = authoringFixture();
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }));
  let observed = false;
  const unsubscribe = store.subscribe(() => {
    if (observed) return;
    observed = true;
    recordProjectSnapshot("Later edit");
    store.update(project => { project.meta.title = "observer edit"; });
  });
  try { authoringValue(f.controller.apply(preview)); } finally { unsubscribe(); }
  // When undoing one step.
  f.controller.undo();
  // Then only the later subscriber edit is reversed, not the compiled project.
  expect(store.getCurrent()).toEqual(preview.project);
});

it("clears redo when a fresh edit follows undo", () => {
  // Given an accepted compilation followed by undo and a fresh source draft.
  const f = authoringFixture();
  authoringValue(f.controller.apply(authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" }, compile: f.compile }))));
  f.controller.undo();
  const draft = authoringValue(f.controller.createDraft());
  const doc = fixtureDocument(draft.project);
  draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, objects: { ...doc.library.objects,
    "hearth-design": { ...own(doc.library.objects, "hearth-design"), revision: 2 } } } };
  const preview = authoringValue(f.controller.preview(draft, { operation: { kind: "edit" } }));
  // When accepting the new branch.
  authoringValue(f.controller.apply(preview));
  // Then the previous future is not recoverable by redo.
  expect(getMapEditHistoryState()).toEqual({ canUndo: true, canRedo: false });
});

it("restores exact project content when an accepted deletion is undone", () => {
  // Given a compiled stamp with frozen metadata, owned pixels and an event.
  const f = authoringFixture(true);
  const before = structuredClone(store.getCurrent());
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "delete-occurrence",
    request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } } }));
  authoringValue(f.controller.apply(preview));
  // When undo restores the transaction snapshot.
  f.controller.undo();
  // Then every field is restored, not merely the occurrence record.
  expect(store.getCurrent()).toEqual(before);
});

it.each(["undo", "redo"] as const)("restores exact overview state when %s traverses an incoming-pair deletion", operation => {
  // Given a fully accepted deletion of a child selected by a world-entry-only association.
  authoringFixture();
  store.replace(worldEntryOutput());
  const before = structuredClone(store.getCurrent());
  const entry = overviewBinding(before).overviewEntries?.[0];
  if (!entry) throw new TypeError("Missing world entry");
  const controller = createSpatialAuthoringController();
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "delete-occurrence",
    request: { occurrenceId: entry.target.occurrenceId, externalConnections: "remove" } } }));
  authoringValue(controller.apply(preview));
  const accepted = structuredClone(store.getCurrent());
  if (operation === "redo") controller.undo();
  // When one history transition traverses the atomic snapshot.
  const changed = controller[operation]();
  // Then maps, events, mapConnections and all logical metadata match that exact state.
  expect(changed).toBe(true);
  expect(store.getCurrent()).toEqual(operation === "undo" ? before : accepted);
});
