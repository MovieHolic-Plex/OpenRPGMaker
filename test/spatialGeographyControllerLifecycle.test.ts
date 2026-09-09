/** @vitest-environment happy-dom */
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own } from "../src/project/spatial/domain";
import { inspectSpatialOccurrenceDeletion } from "../src/project/spatial/ownership";
import { store } from "../src/project/store";
import type { Project } from "../src/project/types";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { geographyRoot } from "./support/spatialGeographyFixture";
import { geographyControllerInput } from "./support/spatialGeographyControllerFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";

let compiledWorld: Project;
beforeAll(() => { compiledWorld = compileSpatialOccurrence(geographyControllerInput("world"), { occurrenceId: geographyRoot }); });
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(deserialize(serialize(compiledWorld)));
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it.each(["delete-occurrence", "refresh"] as const)("applies exact owned event impacts when %s targets a generated region with a shared world marker", kind => {
  // Given actual task10 output: world -> three regions -> places -> spaces, with two crossings sharing the middle marker.
  const before = structuredClone(store.getCurrent());
  const doc = fixtureDocument(before);
  const middle = Object.values(doc.occurrences).find(occurrence => occurrence.parentId === geographyRoot && occurrence.parentSlot?.slotId === "second");
  if (!middle) throw new TypeError("Missing middle region");
  const worldBinding = own(doc.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
  if (!worldBinding) throw new TypeError("Missing world owner");
  expect(doc.connections.filter(link => link.overviewRoute?.occurrenceId === geographyRoot &&
    [link.from, link.to].some(endpoint => endpoint.occurrenceId === middle.id))).toHaveLength(2);
  expect(worldBinding.overviewEntries?.filter(entry => entry.target.occurrenceId === middle.id)).toHaveLength(1);
  const deletion = inspectSpatialOccurrenceDeletion(doc, before, middle.id);
  const incoming = kind === "refresh" ? deletion.overviewEntries.filter(entry => entry.occurrenceId === geographyRoot) : deletion.overviewEntries;
  const pairs = incoming.flatMap(entry => [JSON.stringify([entry.mapId, entry.eventId]), JSON.stringify([entry.returnMapId, entry.returnEventId])]);
  const removedEvents = kind === "delete-occurrence" ? deletion.artifacts.flatMap(({ binding }) => binding.eventIds.map(eventId => JSON.stringify([binding.mapId, eventId]))) : [];
  const expectedEvents = [...new Set([...pairs, ...removedEvents])].sort();
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  if (kind === "refresh") {
    const current = fixtureDocument(draft.project);
    const region = own(current.library.regions, middle.source.id);
    draft.project.spatialAuthoring = { ...current, library: { ...current.library, regions: { ...current.library.regions,
      [region.id]: { ...region, revision: 2, terrain: { ...region.terrain, floor: "sand" } } } } };
  }
  const preview = authoringValue(controller.preview(draft, { operation: { kind, request: { occurrenceId: middle.id, externalConnections: "remove" } },
    ...(kind === "refresh" ? { compile: { occurrenceId: middle.id } } : {}) }));
  expect(serialize(store.getCurrent())).toBe(serialize(before));
  expect(preview.impact.events.map(event => JSON.stringify([event.mapId, event.eventId])).sort()).toEqual(expectedEvents);
  // When the fully previewed lifecycle operation is accepted.
  authoringValue(controller.apply(preview));
  // Then exact incoming pairs are removed, surviving terrain is unchanged, and everything is one undo/redo step.
  const after = store.getCurrent();
  const affectedMaps = new Set(deletion.artifacts.map(({ binding }) => binding.mapId));
  for (const map of Object.values(before.maps).filter(map => !affectedMaps.has(map.id))) {
    expect(own(after.maps, map.id).lowerTiles).toEqual(map.lowerTiles);
    expect(own(after.maps, map.id).upperTiles).toEqual(map.upperTiles);
  }
  for (const entry of incoming) {
    expect(own(after.maps, entry.mapId).events.some(event => event.id === entry.eventId)).toBe(false);
    expect(own(after.maps, entry.returnMapId).events.some(event => event.id === entry.returnEventId)).toBe(false);
    expect(after.mapConnections?.some(link => link.id === entry.eventId || link.id === entry.returnEventId)).toBe(false);
  }
  if (kind === "refresh") expect(own(fixtureDocument(after).occurrences, middle.id).source.revision).toBe(2);
  else expect(Object.hasOwn(fixtureDocument(after).occurrences, middle.id)).toBe(false);
  expect(getMapEditHistoryEntries()).toHaveLength(1);
  const accepted = serialize(after);
  expect(serialize(deserialize(accepted))).toBe(accepted);
  expect(controller.undo()).toBe(true);
  expect(serialize(store.getCurrent())).toBe(serialize(before));
  expect(controller.redo()).toBe(true);
  expect(serialize(store.getCurrent())).toBe(accepted);
});

it("rejects before mutation when a surviving task10-generated world owner has human raster edits", () => {
  // Given an edited world raster whose shared incoming marker points at the selected middle region.
  const doc = fixtureDocument(store.getCurrent());
  const middle = Object.values(doc.occurrences).find(occurrence => occurrence.parentId === geographyRoot && occurrence.parentSlot?.slotId === "second");
  const binding = own(doc.occurrences, geographyRoot).bindings.find(isOwnedSpatialBinding);
  if (!middle || !binding) throw new TypeError("Missing generated fixture ownership");
  store.updateMap(binding.mapId, map => { map.lowerTiles[0] = map.lowerTiles[0] === 0 ? 1 : 0; });
  const before = serialize(store.getCurrent());
  const controller = createSpatialAuthoringController();
  // When deleting the remote child would require exact incoming-event cleanup on that owner.
  const result = controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "delete-occurrence",
    request: { occurrenceId: middle.id, externalConnections: "remove" } } });
  // Then the current raster/history remain untouched rather than accepting a new digest.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(serialize(store.getCurrent())).toBe(before);
  expect(getMapEditHistoryEntries()).toEqual([]);
});
