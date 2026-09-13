/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { resetMapEditHistory, getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { store } from "../src/project/store";
import { deserialize } from "../src/project/io";
import { own } from "../src/project/spatial/domain";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { worldEntryOutput, overviewBinding, updateOverview, updateRoute } from "./support/spatialOverviewFixture";
import { fixtureDocument } from "./support/spatialSpaceCompilerFixture";
import { geographyOutputContract } from "./support/spatialGeographyOutputContract";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  resetMapEditHistory();
});
afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });

it("cleans only exact incoming pairs when explicit deletion removes a world-entry-only child", () => {
  // Given task34's validated real raster/transfer witness, with no logical world route.
  store.replace(deserialize(JSON.stringify(worldEntryOutput())));
  const before = structuredClone(store.getCurrent());
  const binding = overviewBinding(before);
  const entry = binding.overviewEntries?.[0];
  if (!entry) throw new TypeError("Missing world entry");
  const controller = createSpatialAuthoringController();
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: {
    kind: "delete-occurrence", request: { occurrenceId: entry.target.occurrenceId, externalConnections: "remove" },
  } }));
  // When the exact pair-removal proposal is accepted.
  authoringValue(controller.apply(preview));
  // Then the surviving world's terrain is untouched, both pair events/projections are gone, ownership remains valid.
  const after = store.getCurrent();
  const map = own(after.maps, binding.mapId);
  expect(map.lowerTiles).toEqual(own(before.maps, binding.mapId).lowerTiles);
  expect(map.upperTiles).toEqual(own(before.maps, binding.mapId).upperTiles);
  expect(map.events).toEqual([]);
  expect(after.mapConnections).toEqual([]);
  expect(preview.impact.events).toHaveLength(2);
  const retained = overviewBinding(after);
  expect(retained.eventIds).toEqual([]);
  expect(retained.overviewEntries).toBeUndefined();
  expect(retained.contentDigest).toBe(spatialRasterDigest(map, retained));
  expect(getMapEditHistoryEntries()).toHaveLength(1);
});

it("preserves all state when the actual incoming event owner has a human tile edit", () => {
  // Given a valid association document but changed source-owner raster after generation.
  const project = worldEntryOutput();
  const binding = overviewBinding(project);
  const entry = binding.overviewEntries?.[0];
  if (!entry) throw new TypeError("Missing world entry");
  own(project.maps, binding.mapId).lowerTiles[0] = 42;
  store.replace(project);
  const before = structuredClone(store.getCurrent());
  const controller = createSpatialAuthoringController();
  // When deleting the distant child, not the stale owner itself.
  const result = controller.preview(authoringValue(controller.createDraft()), { operation: {
    kind: "delete-occurrence", request: { occurrenceId: entry.target.occurrenceId, externalConnections: "remove" },
  } });
  // Then owner-digest preflight blocks both halves before publication/history mutation.
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it.each(["overviewEntries", "overviewRoute"] as const)("rejects metadata-only staleness when %s changes without raster digest changes", field => {
  // Given the accepted task34 region witness and a detached unchanged edit preview.
  store.replace(deserialize(JSON.stringify(geographyOutputContract(109).complete)));
  const controller = createSpatialAuthoringController();
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "edit" } }));
  const before = overviewBinding(store.getCurrent()).contentDigest;
  switch (field) {
    case "overviewEntries": store.replace(updateOverview(store.getCurrent(), binding => ({ ...binding,
      overviewEntries: [...binding.overviewEntries ?? []].reverse() }))); break;
    case "overviewRoute": store.replace(updateRoute(store.getCurrent(), link => {
      const { overviewRoute, ...ordinary } = link;
      return ordinary;
    })); break;
  }
  expect(overviewBinding(store.getCurrent()).contentDigest).toBe(before);
  const changed = structuredClone(store.getCurrent());
  // When accepting a preview with the earlier logical association baseline.
  const result = controller.apply(preview);
  // Then unchanged raster proof cannot authorize a stale logical write.
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(store.getCurrent()).toEqual(changed);
});

it("preserves navigation as unmanaged content when explicit detach releases overview ownership", () => {
  // Given a complete world marker and reverse transfer pair.
  store.replace(deserialize(JSON.stringify(worldEntryOutput())));
  const before = structuredClone(store.getCurrent());
  const owner = Object.values(fixtureDocument(before).occurrences).find(occurrence => occurrence.bindings.some(binding =>
    isOwnedSpatialBinding(binding) && binding.overviewEntries?.length));
  if (!owner) throw new TypeError("Missing overview owner");
  const controller = createSpatialAuthoringController();
  // When detach releases ownership rather than deleting content.
  const preview = authoringValue(controller.preview(authoringValue(controller.createDraft()), { operation: { kind: "detach", occurrenceId: owner.id } }));
  // Then every existing map/event/transfer is retained.
  expect(preview.project.maps).toEqual(before.maps);
  expect(preview.project.mapConnections).toEqual(before.mapConnections);
});
