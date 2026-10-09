import { afterEach, expect, it } from "vitest";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, hasAuthoringPreview, previewAuthoringDraft } from "../src/editor/panels/spatialAuthoringAccess";
import { previewSpatialSourceBuild } from "../src/editor/panels/spatialBuildActions";
import { spatialAuthoringCompileScope } from "../src/editor/spatial/authoringScope";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own, resolveOccurrencePortId, spatialId } from "../src/project/spatial/domain";
import { duplicateSpatialOccurrence } from "../src/project/spatial/duplicate";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { legacyOccurrence } from "./support/spatialOccurrenceIdentityFixture";
import { placeCompilerFixture, placeRoot, stairFloors } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceCompilerFixture, spaceDesign, spaceRoot } from "./support/spatialSpaceCompilerFixture";

afterEach(() => bindSpatialAuthoringControllerFactory(null));

it("rejects atlas mismatch when an explicit object build targets a different atlas", () => {
  // Given
  const { target } = manualBuildFixture();
  store.updateMap(target.mapId, map => { map.tilesetId = "easyrpg_chipset_combined_town"; });
  const before = structuredClone(store.getCurrent());
  // When
  const result = previewSpatialSourceBuild({ source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("atlas-reject"), seed: 19,
    destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry } });
  // Then
  expect(result).toMatchObject({ kind: "error", error: { detail: "atlas" } });
  expect(hasAuthoringPreview()).toBe(false);
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("rejects stale Apply when a separately accepted source edit changes the baseline", () => {
  // Given
  manualBuildFixture();
  authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("source-stale"), seed: 19,
    destination: { kind: "new-maps" } }));
  store.update(project => {
    const doc = fixtureDocument(project);
    project.spatialAuthoring = { ...doc, library: { ...doc.library, spaces: { ...doc.library.spaces,
      [spaceDesign]: { ...own(doc.library.spaces, spaceDesign), name: "Independent accepted source" } } } };
  });
  const before = structuredClone(store.getCurrent());
  const history = getMapEditHistoryEntries();
  // When
  const result = applyAuthoringPreview();
  // Then
  expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toEqual(history);
});

it("preserves manual raster rejection when a nested edit resolves to its root owner", () => {
  // Given
  const project = compileSpatialOccurrence(placeCompilerFixture(), { occurrenceId: placeRoot });
  installManualProject(project);
  const room = stairFloors(project)[0];
  if (!room) throw new TypeError("Missing floor");
  const binding = own(fixtureDocument(project).occurrences, room.roomId).bindings.find(isOwnedSpatialBinding);
  if (!binding) throw new TypeError("Missing owned raster");
  store.updateMap(binding.mapId, map => { map.lowerTiles[0] = 402; });
  const before = structuredClone(store.getCurrent());
  authoringValue(editAuthoringDraft(draft => draft, { operation: { kind: "edit" },
    compile: spatialAuthoringCompileScope(fixtureDocument(before), room.roomId) }));
  // When
  const result = previewAuthoringDraft();
  // Then
  expect(result).toMatchObject({ kind: "error", error: { code: "ownership" } });
  expect(store.getCurrent()).toEqual(before);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("retains external connection write-set rejection when a target is outside actual containment", () => {
  // Given: a valid cross-root connection; equal source IDs do not join the write sets.
  const project = spaceCompilerFixture();
  const original = fixtureDocument(project);
  const child = Object.values(original.occurrences).find(item => item.parentId === spaceRoot && item.snapshot.ports.length > 0);
  if (!child) throw new TypeError("Missing stair");
  const externalId = spatialId("unrelated-root");
  const doc = duplicateSpatialOccurrence(original, project, { occurrenceId: child.id, rootId: externalId, externalConnections: "omit" });
  const external = own(doc.occurrences, externalId);
  project.spatialAuthoring = { ...doc, connections: [{ id: spatialId("cross-root-link"), bidirectional: true,
    from: { occurrenceId: child.id, portId: resolveOccurrencePortId(child, spatialId("landing")) },
    to: { occurrenceId: externalId, portId: resolveOccurrencePortId(external, spatialId("landing")) } }] };
  installManualProject(project);
  authoringValue(editAuthoringDraft(draft => draft, { operation: { kind: "edit" },
    compile: spatialAuthoringCompileScope(fixtureDocument(project), child.id) }));
  // When
  const result = previewAuthoringDraft();
  // Then
  expect(result).toMatchObject({ kind: "error", error: { detail: "connection" } });
  expect(store.getCurrent()).toEqual(project);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("rejects association-incomplete historical data when resolving a compile scope", () => {
  // Given
  const { project } = manualBuildFixture();
  const preview = authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("legacy-root"), seed: 19,
    destination: { kind: "new-maps" } }));
  const doc = fixtureDocument(preview.project);
  const legacy = legacyOccurrence(doc, "legacy-root");
  // When / Then
  expect(() => spatialAuthoringCompileScope({ ...doc, occurrences: { ...doc.occurrences, [legacy.id]: legacy } }, legacy.id))
    .toThrow(/association-required/);
  expect(store.getCurrent()).toEqual(project);
});
