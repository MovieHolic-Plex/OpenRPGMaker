import { resetMapEditHistory } from "../../src/editor/mapEditHistory";
import { bindSpatialAuthoringControllerFactory } from "../../src/editor/panels/spatialAuthoringAccess";
import { resetSpatialAuthoringSessions } from "../../src/editor/panels/spatialAuthoringSession";
import { createSpatialAuthoringController } from "../../src/editor/spatial/actions";
import { store } from "../../src/project/store";
import type { Project } from "../../src/project/types";
import { fixtureDocument, objectStampFixture } from "./spatialSpaceCompilerFixture";

export function installManualProject(project: Project): void {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(project);
  resetMapEditHistory();
  resetSpatialAuthoringSessions();
  bindSpatialAuthoringControllerFactory(createSpatialAuthoringController);
}

/** Setup only: canonical sources/assets with no instantiated output. */
export function manualBuildFixture() {
  const fixture = objectStampFixture();
  const document = fixtureDocument(fixture.project);
  const project = { ...fixture.project, spatialAuthoring: { ...document, occurrences: {}, rootOccurrenceIds: [], connections: [] } };
  installManualProject(project);
  return { ...fixture, project };
}
