import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import {
  clearAuthoringSession,
  editAuthoringDraft,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { issuePlacedSpaceEdit } from "@/editor/panels/spatialSpacePlacedActions";
import {
  addFixedSlot,
  editSpace,
  previewSpaceDelete,
  previewSpaceLayout,
  freshSpatialId,
  slotFixed,
  spaceDraftTarget,
  spaceFromProject,
  type SpaceDraftTarget,
} from "@/editor/panels/spatialSpaceDraft";
import { spatialAuthoringCompileScope } from "@/editor/spatial/authoringScope";
import { SpatialCompileError, type SpatialCompileRequest } from "@/editor/spatial/compilerTypes";
import { inspectSpatialOccurrenceDeletion } from "@/project/spatial/ownership";
import { spatialId, SpatialOperationError } from "@/project/spatial/domain";
import { PlacedSpaceEditError } from "@/editor/spatial/placedSpaceMembers";
import type { SpaceDesign, SpatialId } from "@/project/spatial/types";
import type { SpatialAuthoringRequest } from "@/editor/spatial/authoringTypes";
import type { Project } from "@/project/types";

export function workingProject(): Project {
  return visibleAuthoringProject();
}

export function mutateSpaceDraft(mutate: (project: Project) => Project, request?: SpatialAuthoringRequest): void {
  try {
    const result = editAuthoringDraft(mutate, request ?? { operation: { kind: "edit" } });
    spaceChromeState.previewError = spatialAuthoringErrorText(result);
    if (result.kind === "ok") spaceChromeState.saveState = "초안";
  } catch (error) {
    if (error instanceof SpatialOperationError || error instanceof PlacedSpaceEditError) {
      spaceChromeState.previewError = error.code;
      return;
    }
    throw error;
  }
}

export function spaceOccurrenceCompile(occurrenceId: SpatialId): SpatialCompileRequest | undefined {
  const document = workingProject().spatialAuthoring;
  if (!document) return undefined;
  try {
    return spatialAuthoringCompileScope(document, occurrenceId);
  } catch (error) {
    if (error instanceof SpatialCompileError) {
      spaceChromeState.previewError = error.code;
      return undefined;
    }
    throw error;
  }
}

export function mutateWorkingSpace(target: SpaceDraftTarget, patch: (space: SpaceDesign) => SpaceDesign): void {
  if (target.occurrenceId) {
    const compile = spaceOccurrenceCompile(target.occurrenceId);
    if (!compile) return;
    mutateSpaceDraft((project) => editSpace(project, target, patch), { operation: { kind: "edit" }, compile });
    return;
  }
  mutateSpaceDraft((project) => editSpace(project, target, patch), { operation: { kind: "edit" } });
}

export function addSpaceObjectAt(target: SpaceDraftTarget, objectId: string, tile: { readonly x: number; readonly y: number }): void {
  const slot = slotFixed(freshSpatialId(workingProject(), "slot"), spatialId(objectId), tile.x, tile.y);
  if (target.occurrenceId) {
    issuePlacedSpaceEdit(workingProject(), target.occurrenceId, { kind: "add", slot });
    spaceChromeState.selectedSlotId = slot.id;
    spaceChromeState.selectedIndex = 0;
    spaceChromeState.selectedPortId = null;
    return;
  }
  mutateWorkingSpace(target, (current) => addFixedSlot(current, slot));
  spaceChromeState.selectedSlotId = slot.id;
  spaceChromeState.selectedIndex = null;
}

export function workingSpace(card: SpatialGalleryCard | undefined): SpaceDesign | undefined {
  if (!card) return undefined;
  return spaceFromProject(workingProject(), spaceDraftTarget(card));
}

export function layoutIssue(card: SpatialGalleryCard | undefined): string | null {
  const space = workingSpace(card);
  if (!space) return null;
  const result = previewSpaceLayout(workingProject(), space);
  if (result.ok) return null;
  return `${result.code}:${result.path}`;
}

export function spaceDeletePreview(card: SpatialGalleryCard | undefined) {
  if (!card) return null;
  const target = spaceDraftTarget(card);
  if (target.occurrenceId) {
    const project = workingProject();
    if (!project.spatialAuthoring) return null;
    const impact = inspectSpatialOccurrenceDeletion(project.spatialAuthoring, project, target.occurrenceId);
    return {
      strong: impact.artifacts.map((entry) => ({ path: entry.occurrenceId })),
      historical: impact.occurrenceIds.map(String),
    };
  }
  return previewSpaceDelete(visibleAuthoringProject(), target);
}

export function resetSpacesAuthoringSession(): void {
  clearAuthoringSession();
  spaceChromeState.saveState = "읽기";
  spaceChromeState.previewError = null;
  spaceChromeState.deleteOpen = false;
  spaceChromeState.selectedSlotId = null;
  spaceChromeState.selectedIndex = null;
  spaceChromeState.selectedPortId = null;
  spaceChromeState.selectedObjectId = null;
  spaceChromeState.cursorTile = { x: 1, y: 1 };
  spaceChromeState.environment = "all";
  spaceChromeState.gesture = null;
}
