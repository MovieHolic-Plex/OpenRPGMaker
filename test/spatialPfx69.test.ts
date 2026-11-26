// @vitest-environment happy-dom

import { expect, it, afterEach, beforeEach, vi, describe, beforeAll } from "vitest";
import { getMapEditHistoryEntries, resetMapEditHistory } from "../src/editor/mapEditHistory";
import { editAuthoringDraft, previewAuthoringDraft, retainAuthoringPreview, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { spatialAuthoringCompileScope } from "../src/editor/spatial/authoringScope";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { previewPlacedPlaceEdit } from "../src/editor/spatial/placedPlaceEdits";
import { previewPlacedSpaceEdit } from "../src/editor/spatial/placedSpaceEdits";
import { own, requireOccurrenceAssociations, spatialId, assertNever, resolveOccurrencePortId } from "../src/project/spatial/domain";
import { occurrenceSubtree } from "../src/project/spatial/ownership";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { store } from "../src/project/store";
import { expectAcceptedTransaction, setupCombinedAuthoring, sharedController } from "./support/combinedAuthoringFixture";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { renameEvents, sharedFixture, parallelFixture } from "./support/spatialConnectionIdentityFixture";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";
import assert from "node:assert/strict";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import type { SpatialConnectionEdit } from "../src/editor/spatial/authoringTypes";
import { deserialize, serialize } from "../src/project/io";
import { isOwnedSpatialBinding } from "../src/project/spatial/bindings";
import type { SpatialConnection } from "../src/project/spatial/types";
import type { Project } from "../src/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("spatialCombinedAuthoring", () => {
  isolateTimers();
  beforeAll(() => {
    setupCombinedAuthoring();
  });
  // Heavy under CI load (15s default is too tight): clones and edits a full project in happy-dom.
  it("accepts one nested transaction when shared space and place adapters move delete and add actual members", { timeout: 120_000 }, () => {
    // Given: a compiled village -> inn -> rooms -> objects, with the actual root known independently.
    installManualProject(compileSpatialOccurrence(placeCompilerFixture(19), { occurrenceId: placeRoot }));
    const before = structuredClone(store.getCurrent());
    const inn = placeChild(before, placeRoot, "inn");
    const room = placeChild(before, inn, "floor-1");
    const hearth = placeChild(before, room, "hearth");
    const deletedRoom = placeChild(before, inn, "floor-2");
    const removed = occurrenceSubtree(fixtureDocument(before), deletedRoom);
    const peer = placeChild(before, inn, "floor-3");
    const addedRoom = spatialId("combined/opaque-new-room");
    const controller = sharedController();
    // When: the real adapter chain passes each exact issued handle back through shared access.
    const first = authoringValue(editAuthoringDraft(project => project));
    const compile = spatialAuthoringCompileScope(fixtureDocument(first.project), hearth);
    expect(compile).toEqual({ occurrenceId: placeRoot });
    authoringValue(retainAuthoringPreview(authoringValue(previewPlacedSpaceEdit(controller, first, { occurrenceId: room, compile,
      edit: { kind: "move", member: { slotId: spatialId("hearth"), index: 0 }, position: { x: 2, y: 4 } } }))));
    authoringValue(retainAuthoringPreview(authoringValue(previewPlacedPlaceEdit(controller,
      authoringValue(editAuthoringDraft(project => project)), { compile, edit: { kind: "move", parentId: inn,
        slot: { slotId: spatialId("floor-1"), index: 0 }, position: { x: 7, y: 9, level: 1 } } }))));
    authoringValue(retainAuthoringPreview(authoringValue(previewPlacedPlaceEdit(controller,
      authoringValue(editAuthoringDraft(project => project)), { compile, edit: { kind: "delete", parentId: inn,
        slot: { slotId: spatialId("floor-2"), index: 0 }, externalConnections: "reject" } }))));
    const final = authoringValue(previewPlacedPlaceEdit(controller, authoringValue(editAuthoringDraft(project => project)), {
      compile, edit: { kind: "add", parentId: inn, rootId: addedRoom, seed: 29, generatorVersion: "combined-v1",
        slot: { id: spatialId("combined-room-slot"), source: { kind: "space", id: spaceDesign }, x: 3, y: 5, level: 2 } },
    }));
    authoringValue(retainAuthoringPreview(final));
    // Then: actual edits survive containing compilation without resurrecting gaps or rewriting peers/sources.
    const document = fixtureDocument(final.project);
    expect(own(document.occurrences, hearth)).toMatchObject({ x: 2, y: 4 });
    expect(own(document.occurrences, room)).toMatchObject({ x: 7, y: 9, level: 1 });
    for (const id of removed) expect(document.occurrences[id]).toBeUndefined();
    expect(own(document.occurrences, addedRoom)).toMatchObject({ parentId: inn, parentSlot: { slotId: "combined-room-slot", index: 0 } });
    expect(own(document.occurrences, addedRoom).bindings.length).toBeGreaterThan(0);
    expect(own(document.occurrences, peer)).toEqual(own(fixtureDocument(before).occurrences, peer));
    expect(document.library).toEqual(fixtureDocument(before).library);
    expect(visibleAuthoringProject()).toBe(final.project);
    expectAcceptedTransaction(before, final);
  });
  // Heavy under CI load (15s default is too tight): clones and edits a full project in happy-dom.
  it("preserves the continuing build when an obsolete member adapter hands off after a newer shared edit", { timeout: 120_000 }, () => {
    // Given: a pending real build, then an unretained member deletion preview on that shared generation.
    manualBuildFixture();
    const before = structuredClone(store.getCurrent());
    const rootId = spatialId("combined/pending-build");
    const input = { source: { kind: "space", id: spaceDesign }, rootId, seed: 19, destination: { kind: "new-maps" } } as const;
    const built = authoringValue(previewSpatialSourceBuild(input));
    const oldHearth = placeChild(built.project, rootId, "hearth");
    const draft = authoringValue(editAuthoringDraft(project => project));
    const compile = spatialAuthoringCompileScope(fixtureDocument(draft.project), oldHearth);
    expect(compile).toEqual({ occurrenceId: rootId });
    const obsolete = authoringValue(previewPlacedSpaceEdit(sharedController(), draft, { occurrenceId: rootId, compile,
      edit: { kind: "remove", member: { slotId: spatialId("hearth"), index: 0 } } }));
    const current = authoringValue(editAuthoringDraft(project => ({ ...project, meta: { ...project.meta, title: "newer shared edit" } })));
    const disclosure = spatialBuildProposal();
    const selection = spatialSession();
    // When: an old real adapter result arrives, then the current generation continues its own remove/add edit.
    const rejected = retainAuthoringPreview(obsolete);
    // Then: rejection preserves the exact active state, not merely its live baseline.
    expect(rejected).toMatchObject({ kind: "error", error: { code: "stale", detail: "authoring-session-lineage" } });
    expect(visibleAuthoringProject()).toBe(current.project);
    expect(spatialBuildProposal()).toEqual(disclosure);
    expect(spatialSession()).toEqual(selection);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
    authoringValue(retainAuthoringPreview(authoringValue(previewPlacedSpaceEdit(sharedController(), current, { occurrenceId: rootId, compile,
      edit: { kind: "remove", member: { slotId: spatialId("hearth"), index: 0 } } }))));
    const final = authoringValue(previewPlacedSpaceEdit(sharedController(), authoringValue(editAuthoringDraft(project => project)), {
      occurrenceId: rootId, compile, edit: { kind: "add", slot: { id: spatialId("combined-new-hearth"), objectDesignId: spatialId("hearth-design"),
        quantity: 1, required: true, placement: { mode: "fixed", x: 1, y: 4 } } },
    }));
    authoringValue(retainAuthoringPreview(final));
    expect(fixtureDocument(final.project).occurrences[oldHearth]).toBeUndefined();
    expect(placeChild(final.project, rootId, "combined-new-hearth")).not.toBe(oldHearth);
    expect(final.project.meta.title).toBe("newer shared edit");
    expect(spatialBuildProposal()?.input).toEqual(input);
    expect(authoringValue(previewAuthoringDraft()).project).toEqual(final.project);
    expectAcceptedTransaction(before, final);
    expect(spatialSession()).toMatchObject({ tab: "spaces", mode: "instances", occurrenceId: rootId });
  });
  // Same heavy full-project clone as the two tests above; it was the only one left on the 15s default and crossed it
  // under CI load (9.5s → 10.4s → 14.1s → 18.1s over ci-full 44994739875→45149079696 while its siblings went 15s → 30s).
  it("retains opaque transfer identities when an ordinary shared containing edit moves their actual destination", { timeout: 120_000 }, () => {
    // Given: valid persisted opaque transfers between two actual spaces sharing one outdoor map.
    const scene = sharedFixture();
    installManualProject(renameEvents(scene.project, scene.project.mapConnections?.map(pair => pair.id) ?? []));
    const before = structuredClone(store.getCurrent());
    const endpoint = requireOccurrenceAssociations(own(fixtureDocument(before).occurrences, scene.parallel.to.occurrenceId));
    if (!endpoint.parentSlot) throw new TypeError("Expected an actual child endpoint");
    const oldLanding = spatialPortLanding(fixtureDocument(before), scene.parallel.to);
    if (!oldLanding) throw new TypeError("Expected compiled endpoint landing");
    const draft = authoringValue(editAuthoringDraft(project => project));
    const compile = spatialAuthoringCompileScope(fixtureDocument(draft.project), endpoint.id);
    expect(compile).toEqual({ occurrenceId: placeRoot });
    // When: the normal placed-parent adapter recompiles and hands off, not an explicit connection rewrite.
    const preview = authoringValue(previewPlacedPlaceEdit(sharedController(), draft, { compile, edit: {
      kind: "move", parentId: placeRoot, slot: endpoint.parentSlot, position: { x: endpoint.x + 3, y: endpoint.y, level: endpoint.level },
    } }));
    authoringValue(retainAuthoringPreview(preview));
    // Then: old opaque pair IDs survive and actual interpreter traversal follows the new port coordinates.
    expect(preview.project.mapConnections?.map(pair => pair.id)).toEqual(before.mapConnections?.map(pair => pair.id));
    expect(fixtureDocument(preview.project).connections).toEqual(fixtureDocument(before).connections);
    const landing = spatialPortLanding(fixtureDocument(preview.project), scene.parallel.to);
    expect(landing).toEqual({ ...oldLanding, x: oldLanding.x + 3 });
    const traversal = inspectNestedTraversal(preview.project);
    expect(traversal.routes).toHaveLength(4);
    expect(traversal.routes.some(route => JSON.stringify(route.to) === JSON.stringify(landing))).toBe(true);
    expect(traversal.routes.some(route => JSON.stringify(route.to) === JSON.stringify(oldLanding))).toBe(false);
    expectAcceptedTransaction(before, preview);
  });
});

describe("spatialConnectionIdentity", () => {
  isolateTimers();
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
    resetMapEditHistory();
  });
  afterEach(() => { resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers(); });
  function begin(project: Project) {
    store.replace(deserialize(serialize(project)));
    resetMapEditHistory();
    const controller = createSpatialAuthoringController();
    return { controller, draft: authoringValue(controller.createDraft()), before: structuredClone(store.getCurrent()) };
  }
  function pairsFor(project: Project, link: SpatialConnection) {
    const document = fixtureDocument(project);
    const from = spatialPortLanding(document, link.from);
    const to = spatialPortLanding(document, link.to);
    assert.ok(from && to);
    return (project.mapConnections ?? []).filter(pair =>
      JSON.stringify([pair.from, pair.to]) === JSON.stringify([from, to]) ||
      JSON.stringify([pair.from, pair.to]) === JSON.stringify([to, from]));
  }
  it.each(["create", "replace", "remove"] as const)("preserves parallel same-map artifacts when explicit edit is %s", kind => {
    // Given: two distinct non-overlapping owned rectangles on one map, with two parallel opaque logical IDs.
    const { project, selected, parallel } = sharedFixture(kind !== "create");
    const original = fixtureDocument(project);
    const from = spatialPortLanding(original, selected.from);
    const to = spatialPortLanding(original, selected.to);
    assert.ok(from && to);
    expect(from.mapId).toBe(to.mapId);
    expect(own(original.occurrences, selected.from.occurrenceId).bindings.filter(isOwnedSpatialBinding)).toHaveLength(1);
    let request: SpatialConnectionEdit;
    switch (kind) {
      case "create": request = { kind: "create", connection: selected }; break;
      case "replace": request = { kind: "replace", connection: { ...selected, from: selected.to, to: selected.from, bidirectional: false } }; break;
      case "remove": request = { kind: "remove", connectionId: selected.id }; break;
      default: return assertNever(kind);
    }
    const manual = { id: "manual-unowned", name: "Manual", x: 0, y: 0, trigger: { kind: "action" as const }, commands: [] };
    own(project.maps, from.mapId).events.push(manual);
    const { controller, draft, before } = begin(project);
    const retained = pairsFor(before, parallel);
    expect(retained).toHaveLength(2);
    // When: accept exactly one explicit connection edit through the real controller.
    const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit-connection", request }, compile: { occurrenceId: placeRoot } }));
    expect(store.getCurrent()).toEqual(before);
    authoringValue(controller.apply(preview));
    // Then: precise traversal, unaffected pair/events/raster and one complete history transaction survive real IO.
    const accepted = structuredClone(store.getCurrent());
    const loaded = deserialize(serialize(accepted));
    const traversal = inspectNestedTraversal(loaded);
    switch (kind) {
      case "create": expect(traversal.routes).toHaveLength(4); break;
      case "replace": {
        expect(traversal.routes).toHaveLength(3);
        const selectedPairs = pairsFor(loaded, selected);
        expect(selectedPairs).toHaveLength(1);
        expect(selectedPairs[0]).toMatchObject({ from: to, to: from });
        break;
      }
      case "remove": expect(traversal.routes).toHaveLength(2); break;
      default: return assertNever(kind);
    }
    expect(pairsFor(loaded, parallel)).toEqual(retained);
    for (const pair of retained) expect(own(loaded.maps, pair.from.mapId).events.find(event => event.id === pair.id))
      .toEqual(own(before.maps, pair.from.mapId).events.find(event => event.id === pair.id));
    expect(own(loaded.maps, from.mapId).events).toContainEqual(manual);
    expect(loaded.mapTree).toEqual(before.mapTree);
    for (const [id, map] of Object.entries(before.maps)) {
      expect(own(loaded.maps, id).lowerTiles).toEqual(map.lowerTiles);
      expect(own(loaded.maps, id).upperTiles).toEqual(map.upperTiles);
    }
    expect(controller.undo()).toBe(true);
    expect(store.getCurrent()).toEqual(before);
    expect(controller.undo()).toBe(false);
    expect(controller.redo()).toBe(true);
    expect(store.getCurrent()).toEqual(accepted);
  });
  it.each([false, true])("preserves unaffected parallel floor event identities when persisted IDs are opaque=%s", opaque => {
    // Given: both raster owners claim both edges; endpoints are non-owning object projections.
    const scene = parallelFixture();
    const keptIds = pairsFor(scene.project, scene.parallel).map(pair => pair.id);
    const project = opaque ? renameEvents(scene.project, keptIds) : scene.project;
    const retained = pairsFor(project, scene.parallel);
    for (const endpoint of [scene.selected.from, scene.selected.to])
      expect(own(fixtureDocument(project).occurrences, endpoint.occurrenceId).bindings.every(binding => !isOwnedSpatialBinding(binding))).toBe(true);
    // Execute persisted pages before the action too: the opaque fixture is valid, not corrupt output.
    expect(inspectNestedTraversal(project).routes).toHaveLength(4);
    const { controller, draft, before } = begin(project);
    // When: remove the other actual connection, compiling the explicit containing root.
    const preview = authoringValue(controller.preview(draft, { operation: { kind: "edit-connection", request: { kind: "remove", connectionId: scene.selected.id } }, compile: { occurrenceId: placeRoot } }));
    authoringValue(controller.apply(preview));
    // Then: remaining generated pages still execute, with exact unaffected identities and event payloads.
    const loaded = deserialize(serialize(store.getCurrent()));
    expect(inspectNestedTraversal(loaded).routes).toHaveLength(2);
    expect(pairsFor(loaded, scene.parallel)).toEqual(retained);
    for (const pair of retained) expect(own(loaded.maps, pair.from.mapId).events.find(event => event.id === pair.id))
      .toEqual(own(before.maps, pair.from.mapId).events.find(event => event.id === pair.id));
  });
  it.each(["old-outside", "new-outside", "unknown-replace"] as const)("rejects replacement atomically when write-set delta is %s", scenario => {
    // Given: the inn compile contains floors, but not the root village square.
    const { project, selected } = parallelFixture();
    const document = fixtureDocument(project);
    const square = own(document.occurrences, placeChild(project, placeRoot, "square"));
    const outside = { occurrenceId: square.id, portId: resolveOccurrencePortId(square, spatialId("entry")) };
    let connection: SpatialConnection;
    switch (scenario) {
      case "old-outside": {
        const setup = begin(project);
        const edit = authoringValue(setup.controller.preview(setup.draft, { operation: { kind: "edit-connection", request: { kind: "replace", connection: { ...selected, to: outside } } }, compile: { occurrenceId: placeRoot } }));
        Object.assign(project, structuredClone(edit.project));
        connection = selected;
        break;
      }
      case "new-outside": connection = { ...selected, to: outside }; break;
      case "unknown-replace": connection = { ...selected, id: spatialId("unknown/replace") }; break;
      default: return assertNever(scenario);
    }
    const { controller, draft, before } = begin(project);
    // When: replacement's old or new endpoint escapes the requested compile, or ID is absent.
    const result = controller.preview(draft, { operation: { kind: "edit-connection", request: { kind: "replace", connection } },
      compile: { occurrenceId: placeChild(project, placeRoot, "inn") } });
    // Then: no proposal or partial cleanup/history adoption escapes.
    expect(result).toMatchObject({ kind: "error", error: { code: scenario === "unknown-replace" ? "invalid" : "ownership" } });
    expect(store.getCurrent()).toEqual(before);
    expect(getMapEditHistoryEntries()).toHaveLength(0);
  });
});
