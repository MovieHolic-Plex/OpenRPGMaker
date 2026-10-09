/** @vitest-environment happy-dom */
import { expect, it } from "vitest";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { editAuthoringDraft, previewAuthoringDraft, retainAuthoringPreview, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialSession } from "../src/editor/panels/spatialAuthoringSession";
import { previewSpatialSourceBuild, spatialBuildProposal } from "../src/editor/panels/spatialBuildActions";
import { spatialAuthoringCompileScope } from "../src/editor/spatial/authoringScope";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { previewPlacedPlaceEdit } from "../src/editor/spatial/placedPlaceEdits";
import { previewPlacedSpaceEdit } from "../src/editor/spatial/placedSpaceEdits";
import { own, requireOccurrenceAssociations, spatialId } from "../src/project/spatial/domain";
import { occurrenceSubtree } from "../src/project/spatial/ownership";
import { spatialPortLanding } from "../src/project/spatial/overview";
import { store } from "../src/project/store";
import { expectAcceptedTransaction, setupCombinedAuthoring, sharedController } from "./support/combinedAuthoringFixture";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { renameEvents, sharedFixture } from "./support/spatialConnectionIdentityFixture";
import { installManualProject, manualBuildFixture } from "./support/spatialManualBuildFixture";
import { placeChild, placeCompilerFixture, placeRoot } from "./support/spatialPlaceCompilerFixture";
import { inspectNestedTraversal } from "./support/spatialPlaceTraversal";
import { fixtureDocument, spaceDesign } from "./support/spatialSpaceCompilerFixture";

setupCombinedAuthoring();

it("accepts one nested transaction when shared space and place adapters move delete and add actual members", () => {
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

it("preserves the continuing build when an obsolete member adapter hands off after a newer shared edit", () => {
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

it("retains opaque transfer identities when an ordinary shared containing edit moves their actual destination", () => {
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
