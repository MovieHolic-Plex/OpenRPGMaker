import { afterEach, expect, it } from "vitest";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { bindSpatialAuthoringControllerFactory, hasAuthoringPreview } from "../src/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, resolveSpatialBuildSource, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { listSpatialGalleryCards } from "../src/editor/panels/spatialCatalog";
import { own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";

afterEach(() => bindSpatialAuthoringControllerFactory(null));

it("builds canonical place maps when the gallery carries explicit library identity", () => {
  // Given
  const fixture = placeCompilerFixture();
  const document = fixtureDocument(fixture);
  const source = own(document.occurrences, placeRoot).source;
  const project = { ...fixture, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
  installManualProject(project);
  patchSpatialSession({ tab: "places", mode: "design" });
  const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === source.id);
  const canonical = authoringValue(resolveSpatialBuildSource(card));
  if (canonical.kind !== "place") throw new TypeError("Expected place source");
  // When
  const preview = authoringValue(previewSpatialSourceBuild({ source: { kind: canonical.kind, id: canonical.id },
    rootId: spatialId("new-place-not-fixture-root"), seed: 19, destination: { kind: "new-maps" } }));
  // Then
  expect(card).toMatchObject({ canonicalSource: { kind: "place", id: source.id } });
  const built = fixtureDocument(preview.project);
  expect(built.rootOccurrenceIds).toEqual(["new-place-not-fixture-root"]);
  expect(Object.keys(preview.project.maps).length).toBeGreaterThan(Object.keys(project.maps).length);
  expect(Object.values(built.occurrences).every(occurrence => occurrence.seed === 19 && occurrence.parentSlot !== undefined)).toBe(true);
  expect(store.getCurrent()).toEqual(project);
});

it.each(["objects", "spaces"] as const)("carries true canonical identity for %s without deriving it from kit IDs", tab => {
  // Given
  manualBuildFixture();
  patchSpatialSession({ tab, mode: "design" });
  const id = tab === "objects" ? "hearth-design" : spaceDesign;
  const card = listSpatialGalleryCards(spatialSession()).find(card => card.localId === id);
  // When
  const source = authoringValue(resolveSpatialBuildSource(card));
  // Then
  expect(source).toEqual({ kind: tab === "objects" ? "object" : "space", id });
});

it("requires explicit conversion when a compatibility card has a coincident canonical localId", () => {
  // Given
  manualBuildFixture();
  const card = { id: "legacy-room", localId: spaceDesign, name: "Compiler room", source: "own", kind: "spaces",
    usage: 0, compatibility: "room-rule" } as const;
  // When
  const result = resolveSpatialBuildSource(card);
  // Then
  expect(result).toMatchObject({ kind: "error", error: { code: "unsupported", message: "canonical-copy-required" } });
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it.each(["selection", "entry", "map-mismatch", "fractional-seed"] as const)("rejects missing or invalid %s before a proposal is issued", fault => {
  // Given
  const { project, target } = manualBuildFixture();
  // When
  const result = previewSpatialSourceBuild({ source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("invalid-target"),
    seed: fault === "fractional-seed" ? 19.5 : 19, destination: { kind: "map", currentMapId: target.mapId,
      selection: fault === "selection" ? null : { ...target.rect, mapId: fault === "map-mismatch" ? "other-map" : target.mapId },
      entry: fault === "entry" ? null : target.entry } });
  // Then
  expect(result.kind).toBe("error");
  expect(hasAuthoringPreview()).toBe(false);
  expect(store.getCurrent()).toEqual(project);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

it("discloses the original frozen proposal when source and seed controls change", () => {
  // Given
  manualBuildFixture();
  const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("disclosed-root"), seed: 19,
    destination: { kind: "new-maps" } } as const;
  const preview = authoringValue(previewSpatialSourceBuild(input));
  patchSpatialSession({ designId: "another-visible-source" });
  // When
  const result = previewSpatialSourceBuild({ ...input, seed: 31 });
  // Then
  expect(result).toMatchObject({ kind: "error", error: { message: "build-proposal-pending" } });
  expect(spatialBuildProposal()).toEqual({ input, preview });
  expect(Object.isFrozen(spatialBuildProposal()?.input)).toBe(true);
});

it("drops transient build inputs when project identity changes", () => {
  // Given
  const { project } = manualBuildFixture();
  authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("project-one"), seed: 19,
    destination: { kind: "new-maps" } }));
  // When
  store.replaceProject(project);
  // Then
  expect(spatialBuildProposal()).toBeNull();
  expect(hasAuthoringPreview()).toBe(false);
});
