import { expect, it, afterEach, describe } from "vitest";
import { inspectRemovedAuthoringTransfers } from "../src/editor/spatial/authoringConnections";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { spatialRasterDigest } from "../src/editor/spatial/compilerValidation";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import { own, spatialId } from "../src/project/spatial/domain";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { fixtureDocument, spaceDesign, spaceCompilerFixture, spaceRoot } from "./support/spatialSpaceCompilerFixture";
import { placeCompilerFixture, placeRoot, withStairConnections, stairFloors } from "./support/spatialPlaceCompilerFixture";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, retainAuthoringPreview, spatialAuthoringController, visibleAuthoringProject, previewAuthoringDraft } from "../src/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { manualBuildFixture, installManualProject } from "./support/spatialManualBuildFixture";
import { spatialAuthoringCompileScope } from "../src/editor/spatial/authoringScope";
import { isolateTimers } from "./mergedTeardown";

describe("spatialAuthoringConnectionProof", () => {
  isolateTimers();
  it("rejects missing old event authority when one side of a compiled two-way edge is unmanaged", () => {
    // Given: the old pair exists, but only its reverse source still claims ownership.
    const project = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), { occurrenceId: placeRoot });
    const document = fixtureDocument(project);
    const link = document.connections[0];
    if (!link) throw new TypeError("Missing fixture link");
    const landing = spatialPortLanding(document, link.from);
    if (!landing) throw new TypeError("Missing fixture landing");
    const pair = project.mapConnections?.find(value => value.from.mapId === landing.mapId && value.from.x === landing.x && value.from.y === landing.y);
    if (!pair) throw new TypeError("Missing fixture transfer");
    const before = { ...document, occurrences: Object.fromEntries(Object.values(document.occurrences).map(occurrence => [occurrence.id, { ...occurrence,
      bindings: occurrence.bindings.map(binding => {
        if (!isOwnedSpatialBinding(binding) || !binding.eventIds.includes(pair.id)) return binding;
        const next = { ...binding, eventIds: binding.eventIds.filter(id => id !== pair.id), connectionIds: binding.connectionIds.filter(id => id !== link.id) };
        return { ...next, contentDigest: spatialRasterDigest(own(project.maps, binding.mapId), next) };
      }),
    }])) };
    const after = { ...before, connections: before.connections.filter(value => value.id !== link.id) };
    // When / Then: no owner is not evidence of an uncompiled connection; exact cleanup rejects.
    expect(() => inspectRemovedAuthoringTransfers(project, before, after)).toThrowError(expect.objectContaining({ code: "ownership" }));
  });
});

describe("spatialAuthoringPreviewHandoff", () => {
  isolateTimers();
  afterEach(() => bindSpatialAuthoringControllerFactory(null));
  it("retains exact controller authority when an external adapter returns an issued compiled preview", () => {
    // Given: the adapter uses the shared controller and an issued shared draft.
    const { project } = manualBuildFixture();
    const controller = spatialAuthoringController();
    if (!controller) throw new TypeError("Missing shared controller");
    const draft = authoringValue(editAuthoringDraft(project => project));
    const rootId = spatialId("external-adapter-root");
    const issued = authoringValue(controller.preview(draft, { operation: { kind: "instantiate", request: {
      source: { kind: "space", id: spaceDesign }, rootId, seed: 19, x: 0, y: 0, level: 0, generatorVersion: "handoff-test-v1",
    } }, compile: { occurrenceId: rootId } }));
    // When
    const retained = authoringValue(retainAuthoringPreview(issued));
    // Then
    expect(retained).toBe(issued);
    expect(visibleAuthoringProject()).toBe(issued.project);
    expect(store.getCurrent()).toEqual(project);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    authoringValue(applyAuthoringPreview());
    expect(store.getCurrent()).toEqual(issued.project);
    expect(getMapEditHistoryEntries()).toHaveLength(1);
  });
  it("rejects another controller's handle when a foreign preview is handed off", () => {
    // Given
    const { project } = manualBuildFixture();
    const foreign = createSpatialAuthoringController();
    const issued = authoringValue(foreign.preview(authoringValue(foreign.createDraft()), { operation: { kind: "edit" } }));
    // When
    const result = retainAuthoringPreview(issued);
    // Then
    expect(result).toMatchObject({ kind: "error", error: { code: "foreign-preview" } });
    expect(store.getCurrent()).toEqual(project);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
  it("rejects stale authority when the project changes before the external handoff", () => {
    // Given
    manualBuildFixture();
    const controller = spatialAuthoringController();
    if (!controller) throw new TypeError("Missing shared controller");
    const draft = authoringValue(editAuthoringDraft(project => project));
    const issued = authoringValue(controller.preview(draft, { operation: { kind: "edit" } }));
    store.update(project => { project.meta.title = "Independent project edit"; });
    const before = structuredClone(store.getCurrent());
    // When
    const result = retainAuthoringPreview(issued);
    // Then
    expect(result).toMatchObject({ kind: "error", error: { code: "stale" } });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
});

describe("spatialAuthoringScope", () => {
  isolateTimers();
  afterEach(() => bindSpatialAuthoringControllerFactory(null));
  it("compiles the connected containing root when a nested actual room is edited", () => {
    // Given
    const project = compileSpatialOccurrence(withStairConnections(placeCompilerFixture()), { occurrenceId: placeRoot });
    installManualProject(project);
    const floor = stairFloors(project)[1];
    if (!floor) throw new TypeError("Missing second floor");
    const compile = spatialAuthoringCompileScope(fixtureDocument(project), floor.roomId);
    authoringValue(editAuthoringDraft(draft => {
      const document = fixtureDocument(draft);
      const room = own(document.occurrences, floor.roomId);
      const source = own(room.snapshot.library.spaces, room.snapshot.root.id);
      return { ...draft, spatialAuthoring: { ...document, occurrences: { ...document.occurrences,
        [room.id]: { ...room, snapshot: { ...room.snapshot, library: { ...room.snapshot.library,
          spaces: { ...room.snapshot.library.spaces, [source.id]: { ...source, width: 18 } } } } } } } };
    }, { operation: { kind: "edit" }, compile }));
    // When
    const preview = authoringValue(previewAuthoringDraft());
    // Then
    expect(compile).toEqual({ occurrenceId: placeRoot });
    const binding = own(fixtureDocument(preview.project).occurrences, floor.roomId).bindings[0];
    if (!binding) throw new TypeError("Missing room binding");
    // The compiler's interior shell adds two tiles on each side of the 18-tile floor.
    expect(binding.rect.width).toBe(18 + 4);
    expect(fixtureDocument(preview.project).connections).toEqual(fixtureDocument(project).connections);
    expect(store.getCurrent()).toEqual(project);
  });
  it("uses actual containment when an object belongs to a standalone room", () => {
    // Given
    const project = spaceCompilerFixture();
    const document = fixtureDocument(project);
    const object = Object.values(document.occurrences).find(item => item.parentId === spaceRoot);
    if (!object) throw new TypeError("Missing object");
    installManualProject(project);
    const compile = spatialAuthoringCompileScope(document, object.id);
    authoringValue(editAuthoringDraft(draft => draft, { operation: { kind: "edit" }, compile }));
    // When
    const preview = authoringValue(previewAuthoringDraft());
    // Then
    expect(compile).toEqual({ occurrenceId: spaceRoot });
    expect(own(fixtureDocument(preview.project).occurrences, object.id).bindings[0]).toMatchObject({ kind: "projection" });
  });
});
