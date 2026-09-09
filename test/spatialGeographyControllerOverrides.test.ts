/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { commitGeographyEdit, editGeography, geographyFromProject, withGeographyName } from "../src/editor/panels/spatialGeographyDraft";
import type { GeographyDraftTarget } from "../src/editor/panels/spatialGeographyDraft";
import { moveGeographyChild, setTerrainAreas } from "../src/editor/panels/spatialGeographyGeometry";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { assertNever, findOccurrenceChildId, own, spatialId } from "../src/project/spatial/domain";
import type { SpatialId } from "../src/project/spatial/types";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyControllerInput } from "./support/spatialGeographyControllerFixture";
import { geographyRoot, geographyWorld } from "./support/spatialGeographyFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

const previous = store.getCurrent();
const target: GeographyDraftTarget = {
  cardId: geographyRoot, localId: geographyWorld, name: "Contract world",
  source: "placed", kind: "world", occurrenceId: geographyRoot,
};
const request = { operation: { kind: "edit" }, compile: { occurrenceId: geographyRoot } } as const;
let baseline: string;
let compiledBaseline: string;
let selectedId: SpatialId;
let siblingId: SpatialId;

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  // Establish an independently edited occurrence through canonical IO and the real controller.
  store.replace(deserialize(serialize(geographyControllerInput("world"))));
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const document = fixtureDocument(draft.project);
  const selected = findOccurrenceChildId(document, geographyRoot, { slotId: spatialId("first"), index: 0 });
  const sibling = findOccurrenceChildId(document, geographyRoot, { slotId: spatialId("third"), index: 0 });
  if (!selected || !sibling) throw new TypeError("Missing associated world children");
  selectedId = selected;
  siblingId = sibling;
  const child = own(document.occurrences, sibling);
  draft.project.spatialAuthoring = { ...document, occurrences: { ...document.occurrences,
    [sibling]: { ...child, x: 53 } } };
  deserialize(serialize(draft.project));
  authoringValue(controller.apply(authoringValue(controller.preview(draft, { operation: { kind: "edit" } }))));
  baseline = serialize(deserialize(serialize(store.getCurrent())));
  const compilation = authoringValue(controller.preview(authoringValue(controller.createDraft()), request));
  authoringValue(controller.apply(compilation));
  compiledBaseline = serialize(deserialize(serialize(store.getCurrent())));
  const world = geographyFromProject(store.getCurrent(), target);
  if (!world || !("regions" in world)) throw new TypeError("Missing placed world");
  expect(world.regions.find(slot => slot.id === "third")?.x).toBe(46);
  expect(own(fixtureDocument(store.getCurrent()).occurrences, sibling).x).toBe(53);
  resetMapEditHistory();
  vi.clearAllTimers();
  vi.useRealTimers();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store.replace(deserialize(baseline));
  resetMapEditHistory();
});
afterEach(() => { store.replace(previous); resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it.each([
  { edit: "name", compiled: false, expectedSelectedX: 6 },
  { edit: "terrain", compiled: false, expectedSelectedX: 6 },
  { edit: "selected-move", compiled: false, expectedSelectedX: 8 },
  { edit: "selected-move", compiled: true, expectedSelectedX: 8 },
  { edit: "name", compiled: true, expectedSelectedX: 6 },
  { edit: "terrain", compiled: true, expectedSelectedX: 6 },
] as const)("preserves an actual sibling override when a placed parent receives a $edit edit (compiled=$compiled)", ({ edit, compiled, expectedSelectedX }) => {
  // Given a canonical reloaded world with same-source siblings and a distinct actual override.
  store.replace(deserialize(compiled ? compiledBaseline : baseline));
  const before = serialize(store.getCurrent());
  const original = fixtureDocument(store.getCurrent());
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  const world = geographyFromProject(draft.project, target);
  if (!world || !("regions" in world)) throw new TypeError("Missing placed world");
  // When the geography draft seam edits only the parent metadata or the selected sibling slot.
  switch (edit) {
    case "name": Object.assign(draft.project, editGeography(draft.project, target,
      design => withGeographyName(design, "Renamed occurrence"))); break;
    case "terrain": Object.assign(draft.project, commitGeographyEdit(draft.project, target,
      setTerrainAreas(world, [{ kind: "rect", x: 0, y: 0, width: 2, height: 2, material: "water" }]))); break;
    case "selected-move": Object.assign(draft.project, commitGeographyEdit(draft.project, target,
      moveGeographyChild(world, spatialId("first"), 8, 10))); break;
    default: assertNever(edit);
  }
  // Then unchanged slots preserve their actual values, even before compilation.
  expect(own(fixtureDocument(draft.project).occurrences, siblingId)).toMatchObject({ x: 53, y: 10, level: 0 });
  const preview = authoringValue(controller.preview(draft, request));
  // Compilation emits entries/events at actual occurrence coordinates.
  const document = fixtureDocument(preview.project);
  expect(own(document.occurrences, siblingId)).toMatchObject({ x: 53, y: 10, level: 0 });
  expect(own(document.occurrences, selectedId)).toMatchObject({ x: expectedSelectedX, y: 10, level: 0 });
  const binding = own(document.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
  if (!binding) throw new TypeError("Missing compiled overview ownership");
  const overview = own(preview.project.maps, binding.mapId);
  for (const [id, x] of [[selectedId, expectedSelectedX], [siblingId, 53]] as const) {
    const entry = binding.overviewEntries?.find(entry => entry.target.occurrenceId === id);
    if (!entry) throw new TypeError("Missing compiled overview entry");
    expect(entry).toMatchObject({ x, y: 10 });
    expect(overview.events.find(event => event.id === entry.eventId)).toMatchObject({ x, y: 10 });
    expect(preview.project.mapConnections?.find(link => link.id === entry.returnEventId)?.to)
      .toEqual({ mapId: binding.mapId, x, y: 10 });
  }
  expect(document.library).toEqual(original.library);
  expect(document.connections).toEqual(original.connections);
  expect(Object.keys(document.occurrences).sort()).toEqual(Object.keys(original.occurrences).sort());
  for (const occurrence of Object.values(document.occurrences)) {
    const prior = own(original.occurrences, occurrence.id);
    expect(occurrence.parentSlot).toEqual(prior.parentSlot);
    expect(occurrence.snapshot.ports).toEqual(prior.snapshot.ports);
    expect(occurrence.source).toEqual(prior.source);
  }
  expect(serialize(store.getCurrent())).toBe(before);
  expect(getMapEditHistoryEntries()).toEqual([]);
  expect(authoringValue(controller.apply(preview)).changed).toBe(true);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  const accepted = serialize(store.getCurrent());
  expect(accepted).toBe(serialize(preview.project));
  expect(controller.undo()).toBe(true);
  expect(serialize(store.getCurrent())).toBe(before);
  expect(controller.redo()).toBe(true);
  expect(serialize(store.getCurrent())).toBe(accepted);
});
