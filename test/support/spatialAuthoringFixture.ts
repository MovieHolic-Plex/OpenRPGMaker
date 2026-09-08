import { createSpatialAuthoringController } from "../../src/editor/spatial/actions";
import { compileSpatialOccurrence } from "../../src/editor/spatial/compileSpatialOccurrence";
import { resetMapEditHistory } from "../../src/editor/mapEditHistory";
import { assertNever } from "../../src/project/spatial/domain";
import { store } from "../../src/project/store";
import type { SpatialAuthoringResult } from "../../src/editor/spatial/authoringTypes";
import { objectStampFixture } from "./spatialSpaceCompilerFixture";

export function authoringValue<T>(result: SpatialAuthoringResult<T>): T {
  switch (result.kind) {
    case "ok": return result.value;
    case "error": throw new TypeError(JSON.stringify(result.error));
    default: return assertNever(result);
  }
}
export function authoringFixture(compiled = false) {
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  const fixture = objectStampFixture();
  const compile = { occurrenceId: fixture.occurrenceId, target: fixture.target };
  store.replace(compiled ? compileSpatialOccurrence(fixture.project, compile) : fixture.project);
  resetMapEditHistory();
  const controller = createSpatialAuthoringController();
  const draft = authoringValue(controller.createDraft());
  return { ...fixture, compile, controller, draft };
}
