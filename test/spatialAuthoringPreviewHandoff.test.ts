import { afterEach, expect, it } from "vitest";
import { getMapEditHistoryEntries } from "../src/editor/mapEditHistory";
import { applyAuthoringPreview, bindSpatialAuthoringControllerFactory, editAuthoringDraft, retainAuthoringPreview, spatialAuthoringController, visibleAuthoringProject } from "../src/editor/panels/spatialAuthoringAccess";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { authoringValue } from "./support/spatialAuthoringFixture";
import { manualBuildFixture } from "./support/spatialManualBuildFixture";
import { spaceDesign } from "./support/spatialSpaceCompilerFixture";

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
