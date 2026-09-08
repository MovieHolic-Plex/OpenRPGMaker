import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import {
  applyAuthoringPreview,
  clearAuthoringSession,
  editAuthoringDraft,
  hasAuthoringPreview,
  previewAuthoringDraft,
  spatialAuthoringController,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { selectSpatialDesign } from "@/editor/panels/spatialAuthoringSession";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import {
  editSpace,
  previewSpaceDelete,
  previewSpaceLayout,
  freshSpatialId,
  librarySpaceCardId,
  spaceDraftTarget,
  spaceFromProject,
  upsertSpaceDesign,
  type SpaceDraftTarget,
} from "@/editor/panels/spatialSpaceDraft";
import { inspectSpatialOccurrenceDeletion } from "@/project/spatial/ownership";
import { spatialId, SpatialOperationError } from "@/project/spatial/domain";
import { PlacedSpaceEditError } from "@/editor/spatial/placedSpaceMembers";
import type { SpaceDesign } from "@/project/spatial/types";
import type { SpatialAuthoringRequest } from "@/editor/spatial/authoringTypes";
import type { Project } from "@/project/types";

export type SpatialSpaceChrome = {
  readonly add?: () => void;
  readonly duplicate?: () => void;
  readonly delete?: () => void;
  readonly preview?: () => void;
  readonly apply?: () => void;
  readonly refresh?: () => void;
  readonly detach?: () => void;
  readonly undo?: () => void;
  readonly redo?: () => void;
  readonly saveState: string;
  readonly previewError: string | null;
  readonly deleteOpen?: boolean;
  readonly onDeleteConfirm?: () => void;
};

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

export function mutateWorkingSpace(target: SpaceDraftTarget, patch: (space: SpaceDesign) => SpaceDesign): void {
  const request: SpatialAuthoringRequest = target.occurrenceId
    ? { operation: { kind: "edit" }, compile: { occurrenceId: target.occurrenceId } }
    : { operation: { kind: "edit" } };
  mutateSpaceDraft((project) => editSpace(project, target, patch), request);
}

export function spatialSpacesChrome(card: SpatialGalleryCard | undefined, rerender: () => void): SpatialSpaceChrome {
  const controller = spatialAuthoringController();
  const target = card ? spaceDraftTarget(card) : undefined;
  const builtinLocked = card?.source === "default";
  const missing = Boolean(card?.missingSource);
  const occurrenceId = target?.occurrenceId;
  return {
    saveState: spaceChromeState.saveState,
    previewError: spaceChromeState.previewError,
    deleteOpen: spaceChromeState.deleteOpen,
    add: controller ? () => addBlankSpace(rerender) : undefined,
    duplicate: controller && target && !builtinLocked ? () => queueClone(target, rerender) : undefined,
    delete: controller && target && !builtinLocked ? () => { spaceChromeState.deleteOpen = true; rerender(); } : undefined,
    onDeleteConfirm: controller && target && spaceChromeState.deleteOpen ? () => queueDelete(target, rerender) : undefined,
    preview: controller ? () => previewSpace(rerender) : undefined,
    apply: controller && hasAuthoringPreview() ? () => applySpace(rerender) : undefined,
    undo: controller ? () => { controller.undo(); rerender(); } : undefined,
    redo: controller ? () => { controller.redo(); rerender(); } : undefined,
    refresh: controller && occurrenceId && !missing ? () => queueRefresh(occurrenceId, rerender) : undefined,
    detach: controller && occurrenceId ? () => queueDetach(occurrenceId, rerender) : undefined,
  };
}

function previewSpace(rerender: () => void): void {
  const result = previewAuthoringDraft();
  spaceChromeState.previewError = spatialAuthoringErrorText(result);
  if (result.kind === "ok") spaceChromeState.saveState = "미리보기";
  rerender();
}

function applySpace(rerender: () => void): void {
  if (!hasAuthoringPreview()) {
    spaceChromeState.previewError = "authoring-preview-missing";
    rerender();
    return;
  }
  const result = applyAuthoringPreview();
  spaceChromeState.previewError = spatialAuthoringErrorText(result);
  if (result.kind === "ok") {
    spaceChromeState.saveState = "적용";
    spaceChromeState.deleteOpen = false;
  }
  rerender();
}

function addBlankSpace(rerender: () => void): void {
  let createdId: ReturnType<typeof freshSpatialId> | undefined;
  mutateSpaceDraft((project) => {
    const created = blankInteriorSpace(project);
    createdId = created.id;
    return upsertSpaceDesign(project, created);
  });
  if (createdId) selectSpatialDesign(librarySpaceCardId(createdId));
  rerender();
}

function queueClone(target: SpaceDraftTarget, rerender: () => void): void {
  if (target.occurrenceId) {
    mutateSpaceDraft((project) => project, {
      operation: {
        kind: "clone-occurrence",
        request: {
          occurrenceId: target.occurrenceId,
          rootId: freshSpatialId(visibleAuthoringProject(), "occ"),
          externalConnections: "omit",
        },
      },
    });
    rerender();
    return;
  }
  if (!target.libraryId) return;
  mutateSpaceDraft((project) => project, {
    operation: {
      kind: "clone-design",
      source: { kind: "space", id: target.libraryId },
      id: freshSpatialId(visibleAuthoringProject(), "space"),
      name: `${target.name} 복제`,
    },
  });
  rerender();
}

function queueDelete(target: SpaceDraftTarget, rerender: () => void): void {
  if (target.occurrenceId) {
    mutateSpaceDraft((project) => project, {
      operation: { kind: "delete-occurrence", request: { occurrenceId: target.occurrenceId, externalConnections: "reject" } },
    });
    rerender();
    return;
  }
  if (!target.libraryId) return;
  mutateSpaceDraft((project) => project, {
    operation: { kind: "delete-design", source: { kind: "space", id: target.libraryId } },
  });
  rerender();
}

function queueRefresh(occurrenceId: ReturnType<typeof spatialId>, rerender: () => void): void {
  mutateSpaceDraft((project) => project, {
    operation: { kind: "refresh", request: { occurrenceId, externalConnections: "reject" } },
    compile: { occurrenceId },
  });
  rerender();
}

function queueDetach(occurrenceId: ReturnType<typeof spatialId>, rerender: () => void): void {
  mutateSpaceDraft((project) => project, {
    operation: { kind: "detach", occurrenceId },
  });
  rerender();
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
  return previewSpaceDelete(projectOrLive(), target);
}

function projectOrLive(): Project {
  return visibleAuthoringProject();
}

function blankInteriorSpace(project: Project): SpaceDesign {
  const id = freshSpatialId(project, "space");
  return {
    id,
    name: "새 공간",
    revision: 1,
    tags: [],
    provenance: { origin: "user" },
    environment: "interior",
    role: "room",
    tilesetId: "easyrpg_chipset_interior",
    shape: "rect",
    width: 10,
    height: 8,
    floor: "wood",
    wall: "cream",
    objectSlots: [],
    ports: [{ id: spatialId(`${id}-entry`), name: "입구", x: 5, y: 7 }],
  };
}

export function resetSpacesAuthoringSession(): void {
  clearAuthoringSession();
  resetImportedChrome();
}

function resetImportedChrome(): void {
  spaceChromeState.saveState = "읽기";
  spaceChromeState.previewError = null;
  spaceChromeState.deleteOpen = false;
  spaceChromeState.selectedSlotId = null;
  spaceChromeState.selectedPortId = null;
  spaceChromeState.environment = "all";
  spaceChromeState.gesture = null;
}
