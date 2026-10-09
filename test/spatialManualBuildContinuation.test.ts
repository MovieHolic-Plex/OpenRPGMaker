import { afterEach, expect, it } from "vitest";
import { getMapEditHistoryEntries, getMapEditHistoryState, undoMapEdit } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft } from "../src/editor/panels/spatialAuthoringAccess";
import { previewSpatialSourceBuild, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { own, spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";

afterEach(() => bindSpatialAuthoringControllerFactory(null));

it("builds the same allocated root when source correction follows a failed compile", () => {
  // Given
  manualBuildFixture();
  const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("corrected-build"), seed: 19,
    destination: { kind: "new-maps" } } as const;
  authoringValue(editAuthoringDraft(project => {
    const doc = fixtureDocument(project);
    const source = own(doc.library.spaces, spaceDesign);
    return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library,
      spaces: { ...doc.library.spaces, [spaceDesign]: { ...source, ports: [{ ...ownPort(source.ports), x: 255 }] } } } } };
  }));
  expect(previewSpatialSourceBuild(input).kind).toBe("error");
  authoringValue(editAuthoringDraft(project => {
    const doc = fixtureDocument(project);
    const source = own(doc.library.spaces, spaceDesign);
    return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library,
      spaces: { ...doc.library.spaces, [spaceDesign]: { ...source, ports: [{ ...ownPort(source.ports), x: 8 }] } } } } };
  }));
  // When
  const preview = authoringValue(previewSpatialSourceBuild(input));
  // Then
  expect(fixtureDocument(preview.project).rootOccurrenceIds).toEqual([input.rootId]);
  expect(own(fixtureDocument(preview.project).occurrences, input.rootId).bindings.length).toBeGreaterThan(0);
  expect(getMapEditHistoryEntries()).toHaveLength(0);
});

function ownPort<T>(ports: readonly T[]): T {
  const port = ports[0];
  if (!port) throw new TypeError("Missing fixture entry");
  return port;
}

it("freezes the issued request when a caller mutates its original entry input", () => {
  // Given
  const { target } = manualBuildFixture();
  const input = { source: { kind: "object", id: spatialId("hearth-design") }, rootId: spatialId("frozen-request"), seed: 19,
    destination: { kind: "map", currentMapId: target.mapId, selection: { mapId: target.mapId, ...target.rect }, entry: target.entry } } as const;
  const original = authoringValue(previewSpatialSourceBuild(input));
  target.entry.x = 999;
  // When
  const preview = authoringValue(previewAuthoringDraft());
  // Then
  expect(preview.project).toEqual(original.project);
  expect(spatialBuildProposal()?.input.destination).toMatchObject({ entry: { x: 1, y: 1 } });
});

it("clears redo when a new build is accepted after Undo", () => {
  // Given
  manualBuildFixture();
  const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("undo-build"), seed: 19,
    destination: { kind: "new-maps" } } as const;
  authoringValue(previewSpatialSourceBuild(input));
  authoringValue(applyAuthoringPreview());
  expect(undoMapEdit()).toBe(true);
  authoringValue(previewSpatialSourceBuild({ ...input, rootId: spatialId("after-undo-build") }));
  // When
  authoringValue(applyAuthoringPreview());
  // Then
  expect(getMapEditHistoryState()).toEqual({ canUndo: true, canRedo: false });
  expect(fixtureDocument(store.getCurrent()).rootOccurrenceIds).toEqual(["after-undo-build"]);
});

it("retains the first frozen occurrence when a second root is explicitly built after a source edit", () => {
  // Given
  manualBuildFixture();
  const input = { source: { kind: "space", id: spaceDesign }, rootId: spatialId("first-frozen"), seed: 19,
    destination: { kind: "new-maps" } } as const;
  authoringValue(previewSpatialSourceBuild(input));
  authoringValue(applyAuthoringPreview());
  const first = own(fixtureDocument(store.getCurrent()).occurrences, input.rootId);
  authoringValue(editAuthoringDraft(project => {
    const doc = fixtureDocument(project);
    const source = own(doc.library.spaces, spaceDesign);
    return { ...project, spatialAuthoring: { ...doc, library: { ...doc.library,
      spaces: { ...doc.library.spaces, [spaceDesign]: { ...source, revision: 2, width: 18 } } } } };
  }));
  authoringValue(previewAuthoringDraft());
  authoringValue(applyAuthoringPreview());
  // When
  const preview = authoringValue(previewSpatialSourceBuild({ ...input, rootId: spatialId("second-frozen") }));
  // Then
  const doc = fixtureDocument(preview.project);
  expect(own(doc.occurrences, input.rootId)).toEqual(first);
  expect(own(doc.occurrences, "second-frozen").source.revision).toBe(2);
  expect(own(doc.occurrences, "second-frozen").bindings[0]?.mapId).not.toBe(first.bindings[0]?.mapId);
});
