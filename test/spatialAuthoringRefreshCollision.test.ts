/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { deserialize } from "../src/project/io";
import { store } from "../src/project/store";
import { checkedDocument, own, spatialId } from "../src/project/spatial/domain";
import { deleteSpatialOccurrence } from "../src/project/spatial/ownership";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceCompilerFixture, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it.each([false, true])("restores both repetitions through preview/apply/IO when the surviving opaque ID collides: %s", collision => {
  // Given AV11-01's legal seed-7 sparse room, or its ordinary noncolliding control.
  const project = spaceCompilerFixture();
  const original = fixtureDocument(project);
  const deleted = Object.values(original.occurrences).find(value => value.parentSlot?.slotId === "beds" && value.parentSlot.index === 0);
  const retained = Object.values(original.occurrences).find(value => value.parentSlot?.slotId === "beds" && value.parentSlot.index === 1);
  if (!deleted || !retained) throw new TypeError("Missing repetitions");
  const retainedId = collision ? deleted.id : retained.id;
  const sparse = deleteSpatialOccurrence(original, project, { occurrenceId: deleted.id, externalConnections: "reject" });
  project.spatialAuthoring = checkedDocument({ ...sparse, occurrences: Object.fromEntries(Object.values(sparse.occurrences).map(value =>
    value.id === retained.id ? [retainedId, { ...value, id: retainedId }] : [value.id, value])) }, project);
  store.replace(deserialize(JSON.stringify(compileSpatialOccurrence(project, { occurrenceId: spaceRoot }))));
  const controller = createSpatialAuthoringController();
  const before = structuredClone(store.getCurrent());
  const draft = authoringValue(controller.createDraft());
  const request = { operation: { kind: "refresh", request: { occurrenceId: spaceRoot, externalConnections: "reject" } },
    compile: { occurrenceId: spaceRoot } } as const;
  // When explicit refresh resolves source quantity two and the user accepts the compiled preview.
  const preview = authoringValue(controller.preview(draft, request));
  // Then preview is deterministic and detached; no valid repetition is silently overwritten.
  const refreshed = fixtureDocument(preview.project);
  const beds = Object.values(refreshed.occurrences).filter(value => value.parentSlot?.slotId === "beds");
  expect(beds.map(value => value.parentSlot?.index).sort()).toEqual([0, 1]);
  expect(new Set(beds.map(value => value.id)).size).toBe(2);
  expect(own(refreshed.occurrences, retainedId).parentSlot).toEqual({ slotId: spatialId("beds"), index: 1 });
  expect(authoringValue(controller.preview(draft, request)).project).toEqual(preview.project);
  expect(store.getCurrent()).toEqual(before);
  expect(authoringValue(controller.apply(preview)).changed).toBe(true);
  expect(store.getCurrent()).toEqual(preview.project);
  const restored = deserialize(JSON.stringify(store.getCurrent()));
  expect(fixtureDocument(restored)).toEqual(refreshed);
  expect(Object.values(fixtureDocument(restored).occurrences).filter(value => value.parentSlot?.slotId === "beds")
    .map(value => value.parentSlot?.index).sort()).toEqual([0, 1]);
});

it.each([false, true])("recreates an entire missing subtree when a retained floor aliases its constructor identity at port level: %s", atPort => {
  // Given a deleted floor and a surviving floor carrying its freed occurrence or port ID.
  const project = placeCompilerFixture();
  const inn = placeChild(project, placeRoot, "inn");
  const deletedId = placeChild(project, inn, "floor-1");
  const retainedId = placeChild(project, inn, "floor-2");
  const original = fixtureDocument(project);
  const deletedPort = own(original.occurrences, deletedId).snapshot.ports[0];
  if (!deletedPort) throw new TypeError("Missing entry port");
  const sparse = deleteSpatialOccurrence(original, project, { occurrenceId: deletedId, externalConnections: "reject" });
  const nextId = atPort ? retainedId : deletedId;
  project.spatialAuthoring = checkedDocument({ ...sparse, occurrences: Object.fromEntries(Object.values(sparse.occurrences).map(entry => {
    const id = entry.id === retainedId ? nextId : entry.id;
    const ports = atPort && entry.id === retainedId
      ? entry.snapshot.ports.map(port => port.localPortId === deletedPort.localPortId ? { ...port, id: deletedPort.id } : port)
      : entry.snapshot.ports;
    return [id, { ...entry, id, parentId: entry.parentId === retainedId ? nextId : entry.parentId,
      snapshot: { ...entry.snapshot, ports } }];
  })) }, project);
  store.replace(deserialize(JSON.stringify(compileSpatialOccurrence(project, { occurrenceId: placeRoot }))));
  const baseline = fixtureDocument(store.getCurrent());
  const controller = createSpatialAuthoringController();
  // When explicit owner refresh reconstructs the missing floor and all its descendants.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "refresh",
    request: { occurrenceId: placeRoot, externalConnections: "reject" } }, compile: { occurrenceId: placeRoot } }));
  // Then the full source tree returns without stealing any surviving descendant or local-port association.
  const next = fixtureDocument(preview.project);
  expect(Object.keys(next.occurrences)).toHaveLength(Object.keys(original.occurrences).length);
  expect(Object.values(next.occurrences).filter(entry => entry.parentId === inn).map(entry => entry.parentSlot?.slotId).sort())
    .toEqual(["floor-1", "floor-2", "floor-3"]);
  for (const previous of Object.values(baseline.occurrences)) {
    const entry = own(next.occurrences, previous.id);
    expect([entry.parentId, entry.parentSlot, entry.snapshot.ports]).toEqual([previous.parentId, previous.parentSlot, previous.snapshot.ports]);
  }
  expect(fixtureDocument(deserialize(JSON.stringify(preview.project)))).toEqual(next);
});

it("preserves transitive opaque identities and ports when a place refresh updates frozen object revisions", () => {
  // Given the independent review's nested-place control, with opaque IDs at every descendant level.
  const project = placeCompilerFixture();
  const doc = fixtureDocument(project);
  const remap = new Map(Object.values(doc.occurrences).map((entry, index) => [entry.id,
    entry.id === placeRoot ? placeRoot : spatialId(`opaque-independent-${index}`)]));
  project.spatialAuthoring = checkedDocument({ ...doc, occurrences: Object.fromEntries(Object.values(doc.occurrences).map(entry => {
    const id = remap.get(entry.id);
    if (!id) throw new TypeError("Missing mapped identity");
    return [id, { ...entry, id, parentId: entry.parentId === null ? null : remap.get(entry.parentId) }];
  })) }, project);
  store.replace(compileSpatialOccurrence(project, { occurrenceId: placeRoot }));
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const baseline = fixtureDocument(draft.project);
  const hearth = own(baseline.library.objects, "hearth-design");
  draft.project.spatialAuthoring = { ...baseline, library: { ...baseline.library, objects: { ...baseline.library.objects,
    [hearth.id]: { ...hearth, revision: 2 } } } };
  // When the containing place is explicitly refreshed through its owning compiler.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "refresh",
    request: { occurrenceId: placeRoot, externalConnections: "reject" } }, compile: { occurrenceId: placeRoot } }));
  // Then actual associations retain every ID and port, and each transitive frozen use advances.
  const next = fixtureDocument(preview.project);
  expect(Object.keys(next.occurrences).sort()).toEqual(Object.keys(baseline.occurrences).sort());
  for (const entry of Object.values(next.occurrences)) {
    const previous = own(baseline.occurrences, entry.id);
    expect([entry.parentId, entry.parentSlot, entry.snapshot.ports]).toEqual([previous.parentId, previous.parentSlot, previous.snapshot.ports]);
    if (Object.hasOwn(entry.snapshot.library.objects, hearth.id)) expect(own(entry.snapshot.library.objects, hearth.id).revision).toBe(2);
  }
});
