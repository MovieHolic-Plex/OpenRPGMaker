import {
  editAuthoringDraft,
  retainAuthoringPreview,
  spatialAuthoringController,
  spatialAuthoringErrorText,
} from "@/editor/panels/spatialAuthoringAccess";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { spatialAuthoringCompileScope } from "@/editor/spatial/authoringScope";
import { SpatialCompileError } from "@/editor/spatial/compilerTypes";
import { previewPlacedSpaceEdit, type PlacedSpaceEdit } from "@/editor/spatial/placedSpaceEdits";
import { assertNever } from "@/project/spatial/domain";
import type { SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";

export function issuePlacedSpaceEdit(project: Project, occurrenceId: SpatialId, edit: PlacedSpaceEdit): void {
  const controller = spatialAuthoringController();
  const document = project.spatialAuthoring;
  if (!controller || !document) {
    spaceChromeState.previewError = "authoring-controller-unavailable";
    return;
  }
  let compile;
  try {
    compile = spatialAuthoringCompileScope(document, occurrenceId);
  } catch (error) {
    if (error instanceof SpatialCompileError) {
      spaceChromeState.previewError = error.code;
      return;
    }
    throw error;
  }
  const drafted = editAuthoringDraft((current) => current);
  switch (drafted.kind) {
    case "error":
      spaceChromeState.previewError = spatialAuthoringErrorText(drafted);
      return;
    case "ok":
      break;
    default:
      return assertNever(drafted);
  }
  const issued = previewPlacedSpaceEdit(controller, drafted.value, { occurrenceId, compile, edit });
  switch (issued.kind) {
    case "error":
      spaceChromeState.previewError = spatialAuthoringErrorText(issued);
      return;
    case "ok": {
      const retained = retainAuthoringPreview(issued.value);
      spaceChromeState.previewError = spatialAuthoringErrorText(retained);
      if (retained.kind === "ok") spaceChromeState.saveState = "미리보기";
      return;
    }
    default:
      return assertNever(issued);
  }
}
