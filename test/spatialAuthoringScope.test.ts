import { afterEach, expect, it } from "vitest";
import { bindSpatialAuthoringControllerFactory, editAuthoringDraft, previewAuthoringDraft } from "../src/editor/panels/spatialAuthoringAccess";
import { spatialAuthoringCompileScope } from "../src/editor/spatial/authoringScope";
import { compileSpatialOccurrence } from "../src/editor/spatial/compileSpatialOccurrence";
import { own } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { installManualProject } from "./support/spatialManualBuildFixture";
import { placeCompilerFixture, placeRoot, stairFloors, withStairConnections } from "./support/spatialPlaceCompilerFixture";
import { fixtureDocument, spaceCompilerFixture, spaceRoot } from "./support/spatialSpaceCompilerFixture";

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
