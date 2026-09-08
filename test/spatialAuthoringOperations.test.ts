/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { own, spatialId } from "../src/project/spatial/domain";
import { authoringFixture, authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("clones frozen occurrences without live source expansion when clone is requested", () => {
  // Given an independently frozen object occurrence.
  const f = authoringFixture(true);
  const before = structuredClone(store.getCurrent());
  // When duplication is previewed through the public operation.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "clone-occurrence",
    request: { occurrenceId: f.occurrenceId, rootId: "clone-root", externalConnections: "omit" } } }));
  // Then only a detached fresh root is added, with released bindings and equal frozen raster.
  const copy = own(fixtureDocument(preview.project).occurrences, "clone-root");
  expect(copy.bindings).toEqual([]);
  expect(copy.snapshot.kitCells).toEqual(own(fixtureDocument(before).occurrences, f.occurrenceId).snapshot.kitCells);
  expect(store.getCurrent()).toEqual(before);
});

it("retains raster when explicit detach releases binding ownership", () => {
  // Given compiled object pixels and an event.
  const f = authoringFixture(true);
  const before = structuredClone(store.getCurrent().maps);
  // When explicit detach is previewed.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "detach", occurrenceId: f.occurrenceId } }));
  // Then bookkeeping alone is released.
  expect(preview.project.maps).toEqual(before);
  expect(own(fixtureDocument(preview.project).occurrences, f.occurrenceId).bindings).toEqual([]);
});

it("removes only owned tiles and events when deleting a compiled occurrence", () => {
  // Given an owned stamp surrounded by human tiles and an unrelated event.
  const f = authoringFixture(true);
  const original = own(store.getCurrent().maps, f.target.mapId);
  const event = original.events[0];
  if (!event) throw new TypeError("Expected generated object event");
  store.updateMap(original.id, map => { map.events.push({ ...structuredClone(event), id: "human-event", x: 0, y: 0 }); });
  const draft = authoringValue(f.controller.createDraft());
  // When deletion is previewed.
  const preview = authoringValue(f.controller.preview(draft, { operation: { kind: "delete-occurrence",
    request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } } }));
  // Then owned content is removed, not unrelated pixels/events.
  const map = own(preview.project.maps, original.id);
  expect(map.lowerTiles[0]).toBe(original.lowerTiles[0]);
  expect(map.lowerTiles[3 * map.width + 3]).toBe(-1);
  expect(map.events.map(value => value.id)).toEqual(["human-event"]);
  expect(preview.impact.events).toEqual([{ mapId: original.id, eventId: event.id }]);
  expect(fixtureDocument(preview.project).occurrences[f.occurrenceId]).toBeUndefined();
});

it("refreshes only on explicit request when an object source revision changes", () => {
  // Given source changes in the detached draft, with the live occurrence still frozen at revision one.
  const f = authoringFixture(true);
  const doc = fixtureDocument(f.draft.project);
  const source = own(doc.library.objects, "hearth-design");
  f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, objects: { ...doc.library.objects,
    [source.id]: { ...source, revision: 2, chips: [] } } } };
  // When explicit refresh and compilation are previewed together.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "refresh",
    request: { occurrenceId: f.occurrenceId, externalConnections: "reject" } }, compile: f.compile }));
  // Then identity survives but the frozen source and emitted chip event change only in the proposal.
  const occurrence = own(fixtureDocument(preview.project).occurrences, f.occurrenceId);
  expect(occurrence.source.revision).toBe(2);
  expect(own(preview.project.maps, f.target.mapId).events).toEqual([]);
  expect(own(fixtureDocument(store.getCurrent()).occurrences, f.occurrenceId).source.revision).toBe(1);
});

it("keeps snapshots frozen when editing only the library source", () => {
  // Given an authored source edit without refresh.
  const f = authoringFixture(true);
  const doc = fixtureDocument(f.draft.project);
  const source = own(doc.library.objects, "hearth-design");
  f.draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, objects: { ...doc.library.objects,
    [source.id]: { ...source, revision: 2, chips: [] } } } };
  // When a plain edit preview is requested.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "edit" } }));
  // Then the existing instance remains at its original frozen revision.
  expect(own(fixtureDocument(preview.project).occurrences, f.occurrenceId).source.revision).toBe(1);
  expect(preview.project.maps).toEqual(store.getCurrent().maps);
});

it("clones a source under a fresh ID when a design clone is requested", () => {
  // Given a reusable source, without altering its historical instances.
  const f = authoringFixture();
  // When the controller clones the library record.
  const preview = authoringValue(f.controller.preview(f.draft, { operation: { kind: "clone-design",
    source: { kind: "object", id: spatialId("hearth-design") }, id: spatialId("cloned-design"), name: "Clone" } }));
  // Then the new source is independent, and occurrence identity is untouched.
  expect(own(fixtureDocument(preview.project).library.objects, "cloned-design").id).toBe("cloned-design");
  expect(fixtureDocument(preview.project).occurrences).toEqual(fixtureDocument(store.getCurrent()).occurrences);
});
