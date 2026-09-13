/** @vitest-environment happy-dom */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSpatialAuthoringController } from "../src/editor/spatial/actions";
import { bindSpatialAuthoringControllerFactory, hasAuthoringPreview } from "../src/editor/panels/spatialAuthoringAccess";
import { mutateWorkingSpace, resetSpacesAuthoringSession } from "../src/editor/panels/spatialSpaceCommands";
import { spaceChromeState } from "../src/editor/panels/spatialSpaceChromeState";
import { resetMapEditHistory } from "../src/editor/mapEditHistory";
import { spatialId } from "../src/project/spatial/domain";
import { store } from "../src/project/store";
import { placedSpaceFixture } from "./support/placedSpaceFixture";

beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] }));
afterEach(() => {
  resetSpacesAuthoringSession(); bindSpatialAuthoringControllerFactory(null);
  resetMapEditHistory(); vi.clearAllTimers(); vi.useRealTimers();
});

it("displays typed missing feedback when an obsolete placed selection is edited", () => {
  // Given the actual panel access bound to a real controller over a compiled project.
  placedSpaceFixture();
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
  const before = structuredClone(store.getCurrent());
  // When the selection refers to an occurrence that no longer exists.
  mutateWorkingSpace({ cardId: "absent", localId: "absent", name: "Absent", source: "placed", occurrenceId: spatialId("absent") },
    space => ({ ...space, width: space.width + 1 }));
  // Then feedback is visible, Apply is unavailable, and live state remains exact.
  expect(spaceChromeState.previewError).toBe("missing");
  expect(hasAuthoringPreview()).toBe(false);
  expect(store.getCurrent()).toEqual(before);
});
