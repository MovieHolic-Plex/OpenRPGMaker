import { afterEach, describe, expect, it } from "vitest";
import { getMapEditHistoryEntries, redoMapEdit, undoMapEdit } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, hasAuthoringPreview, previewAuthoringDraft, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";

afterEach(() => bindSpatialAuthoringControllerFactory(null));

describe("manual source build through the real controller", () => {
  it("displays exact raster without adoption when an explicit object target is built", () => {
    // Given
    const { project, target } = manualBuildFixture();
    const rootId = spatialId("manual-object-opaque-19");
    const input = { source: { kind: "object", id: spatialId("hearth-design") }, rootId, seed: 19,
      destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry } } as const;
    // When
    const preview = authoringValue(previewSpatialSourceBuild(input));
    // Then
    expect(store.getCurrent()).toEqual(project);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    expect(visibleAuthoringProject()).toBe(preview.project);
    expect(spatialBuildProposal()?.input).toEqual(input);
    const occurrence = own(fixtureDocument(preview.project).occurrences, rootId);
    expect(occurrence).toMatchObject({ seed: 19, parentId: null, parentSlot: null, source: input.source });
    const map = own(preview.project.maps, target.mapId);
    expect(map.lowerTiles.slice(3 * map.width + 3, 3 * map.width + 6)).toEqual([402, 403, 404]);
    expect(map.upperTiles.slice(4 * map.width + 3, 4 * map.width + 6)).toEqual([-1, 433, -1]);
    expect(map.upperTiles.slice(5 * map.width + 3, 5 * map.width + 6)).toEqual([462, 124, 464]);
    expect(map.events.length).toBeGreaterThan(0);
    expect(occurrence.bindings).toMatchObject([{ mapId: target.mapId, rect: target.rect }]);
    const before = own(project.maps, target.mapId);
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
      if (x >= 3 && x < 6 && y >= 3 && y < 6) continue;
      expect([map.lowerTiles[y * map.width + x], map.upperTiles[y * map.width + x]])
        .toEqual([before.lowerTiles[y * map.width + x], before.upperTiles[y * map.width + x]]);
    }
  });

  it("adopts one undo step and selects the exact root when Apply accepts a space build", () => {
    // Given
    const { project } = manualBuildFixture();
    const rootId = spatialId("manual-room-19");
    const preview = authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId, seed: 19,
      destination: { kind: "new-maps" } }));
    // When
    authoringValue(applyAuthoringPreview());
    // Then
    expect(store.getCurrent()).toEqual(preview.project);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
    expect(spatialSession()).toMatchObject({ tab: "spaces", mode: "instances", occurrenceId: rootId, designId: null });
    expect(undoMapEdit()).toBe(true);
    expect(store.getCurrent()).toEqual(project);
    expect(redoMapEdit()).toBe(true);
    expect(store.getCurrent()).toEqual(preview.project);
  });

  it("retains the allocated root when a displayed build is previewed again", () => {
    // Given
    manualBuildFixture();
    const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("stable-proposal"), seed: 19,
      destination: { kind: "new-maps" } } as const;
    const first = authoringValue(previewSpatialSourceBuild(input));
    // When
    const second = authoringValue(previewSpatialSourceBuild(input));
    // Then
    expect(second.project).toEqual(first.project);
    expect(fixtureDocument(second.project).rootOccurrenceIds).toEqual([input.rootId]);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("preserves continuation when a build is edited without replaying instantiate", () => {
    // Given
    manualBuildFixture();
    const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("continued-root"), seed: 19,
      destination: { kind: "new-maps" } } as const;
    authoringValue(previewSpatialSourceBuild(input));
    authoringValue(editAuthoringDraft(project => project, { operation: { kind: "edit" }, compile: { occurrenceId: input.rootId } }));
    // When
    const preview = authoringValue(previewSpatialSourceBuild(input));
    // Then
    expect(fixtureDocument(preview.project).rootOccurrenceIds).toEqual([input.rootId]);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });

  it("creates no occurrence when ordinary source-save Preview is used", () => {
    // Given
    manualBuildFixture();
    authoringValue(editAuthoringDraft(project => project));
    // When
    const preview = authoringValue(previewAuthoringDraft());
    // Then
    expect(fixtureDocument(preview.project).occurrences).toEqual({});
    expect(spatialBuildProposal()).toBeNull();
  });

  it("rejects stale Apply without adoption when a live target tile changes", () => {
    // Given
    const { target } = manualBuildFixture();
    authoringValue(previewSpatialSourceBuild({ source: { kind: "space", id: spaceDesign }, rootId: spatialId("stale-root"), seed: 19,
      destination: { kind: "new-maps" } }));
    store.updateMap(target.mapId, map => { map.lowerTiles[0] = 402; });
    const before = structuredClone(store.getCurrent());
    const history = getMapEditHistoryEntries();
    const selection = spatialSession();
    // When
    const result = applyAuthoringPreview();
    // Then
    expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toEqual(history);
    expect(spatialSession()).toEqual(selection);
  });

  it("keeps Apply unavailable when an occupied object target is rejected", () => {
    // Given
    const { target } = manualBuildFixture();
    store.updateMap(target.mapId, map => { map.upperTiles[3 * map.width + 3] = 402; });
    const before = structuredClone(store.getCurrent());
    // When
    const result = previewSpatialSourceBuild({ source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("blocked-root"), seed: 19,
      destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry } });
    // Then
    expect(result).toMatchObject({ kind: "error", error: { detail: "blocked" } });
    expect(hasAuthoringPreview()).toBe(false);
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
});
