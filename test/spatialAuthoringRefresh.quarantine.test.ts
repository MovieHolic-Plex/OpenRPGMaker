/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { own, spatialId } from "../src/project/spatial/domain";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { fixtureDocument, spaceCompilerFixture, spaceRoot, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("retains actual child identity when a space source refresh changes repetition count", () => {
  // Given a compiled room whose first child has an opaque persisted ID, unlike constructor spelling.
  const input = spaceCompilerFixture();
  const doc = fixtureDocument(input);
  const child = Object.values(doc.occurrences).find(value => value.parentSlot?.slotId === "beds" && value.parentSlot.index === 0);
  if (!child) throw new TypeError("Missing repeated child");
  const opaque = spatialId("__proto__");
  input.spatialAuthoring = { ...doc, occurrences: Object.fromEntries(Object.values(doc.occurrences).map(value =>
    value.id === child.id ? [opaque, { ...value, id: opaque }] : [value.id, value])) };
  store.replace(compileSpatialOccurrence(input, { occurrenceId: spaceRoot }));
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const document = fixtureDocument(draft.project);
  const source = own(document.library.spaces, spaceDesign);
  draft.project.spatialAuthoring = { ...document, library: { ...document.library, spaces: { ...document.library.spaces,
    [spaceDesign]: { ...source, revision: 2, objectSlots: source.objectSlots.map(slot => slot.id === "beds" ? { ...slot, quantity: 1 } : slot) } } } };
  // When explicitly refreshing the room against today's source.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "refresh",
    request: { occurrenceId: spaceRoot, externalConnections: "reject" } }, compile: { occurrenceId: spaceRoot } }));
  // Then association matching preserves the retained opaque identity and removes only the omitted repetition.
  const next = fixtureDocument(preview.project);
  expect(own(next.occurrences, opaque).parentSlot).toEqual({ slotId: "beds", index: 0 });
  expect(Object.values(next.occurrences).filter(value => value.parentSlot?.slotId === "beds")).toHaveLength(1);
  expect(own(next.occurrences, spaceRoot).source.revision).toBe(2);
});

it("recompiles a nested place when its source revision is explicitly refreshed", () => {
  // Given a real compiled three-floor place and a new detached source revision.
  store.replace(compileSpatialOccurrence(placeCompilerFixture(), { occurrenceId: placeRoot }));
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const doc = fixtureDocument(draft.project);
  const root = own(doc.occurrences, placeRoot);
  const source = own(doc.library.places, root.source.id);
  draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, places: { ...doc.library.places,
    [source.id]: { ...source, revision: 2 } } } };
  // When the explicit refresh is compiled.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "refresh",
    request: { occurrenceId: placeRoot, externalConnections: "reject" } }, compile: { occurrenceId: placeRoot } }));
  // Then all stored child/port identities survive and the root snapshot advances.
  expect(Object.keys(fixtureDocument(preview.project).occurrences).sort()).toEqual(Object.keys(doc.occurrences).sort());
  expect(own(fixtureDocument(preview.project).occurrences, placeRoot).source.revision).toBe(2);
});

it("removes incoming overview events atomically when a child place is explicitly refreshed", () => {
  // Given task34's complete overview with real task9 child maps and exact event owners.
  const witness = geographyOutputContract(109);
  store.replace(witness.complete);
  const target = witness.markers[0]?.endpoint.occurrenceId;
  if (!target) throw new TypeError("Missing overview child");
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const doc = fixtureDocument(draft.project);
  const child = own(doc.occurrences, target);
  const source = own(doc.library.places, child.source.id);
  draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, places: { ...doc.library.places,
    [source.id]: { ...source, revision: 2 } } } };
  const before = structuredClone(store.getCurrent());
  // When an explicit external-removal refresh is previewed and compiled.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "refresh",
    request: { occurrenceId: target, externalConnections: "remove" } }, compile: { occurrenceId: target } }));
  // Then exact incoming effects are disclosed while all live content remains untouched.
  expect(preview.impact.events.length).toBeGreaterThanOrEqual(2);
  expect(own(fixtureDocument(preview.project).occurrences, target).source.revision).toBe(2);
  expect(store.getCurrent()).toEqual(before);
});

it("removes obsolete bound ports when a compiled space source drops an entry", () => {
  // Given compiled ownership with an old concrete port, and an explicitly changed source port set.
  store.replace(compileSpatialOccurrence(spaceCompilerFixture(), { occurrenceId: spaceRoot }));
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const doc = fixtureDocument(draft.project);
  const source = own(doc.library.spaces, spaceDesign);
  draft.project.spatialAuthoring = { ...doc, library: { ...doc.library, spaces: { ...doc.library.spaces,
    [source.id]: { ...source, revision: 2, ports: [] } } } };
  // When the source is refreshed and recompiled explicitly.
  const preview = authoringValue(controller.preview(draft, { operation: { kind: "refresh",
    request: { occurrenceId: spaceRoot, externalConnections: "reject" } }, compile: { occurrenceId: spaceRoot } }));
  // Then stale binding metadata cannot block an otherwise valid source edit or survive it.
  const root = own(fixtureDocument(preview.project).occurrences, spaceRoot);
  expect(root.snapshot.ports).toEqual([]);
  expect(root.bindings.flatMap(binding => binding.ports)).toEqual([]);
});
