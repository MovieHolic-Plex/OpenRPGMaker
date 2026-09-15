import { copyReviewedPlace } from "@/project/defaults/spatial/reviewedPlaceCatalog";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialDomainChrome } from "@/editor/panels/spatialTilesTab";
import {
  applyAuthoringPreview,
  clearAuthoringSession,
  editAuthoringDraft,
  hasAuthoringDraft,
  hasAuthoringPreview,
  previewAuthoringDraft,
  spatialAuthoringController,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { selectSpatialDesign, selectSpatialOccurrence, spatialSession } from "@/editor/panels/spatialAuthoringSession";
import { assertNever } from "@/project/spatial/domain";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import {
  BUILD_SEED_INTEGER_REQUIRED,
  bindSpatialBuildInputs,
  parseSpatialBuildSeed,
  discloseSpatialBuildInput,
  runSpatialSourceBuild,
  spatialBuildDisabledReason,
} from "@/editor/panels/spatialBuildChrome";
import {
  blankPlaceDesign,
  commitPlaceEdit,
  editPlace,
  freshPlaceId,
  placeDraftTarget,
  placeFromProject,
  upsertPlaceDesign,
  type PlaceDraftTarget,
  type PlaceEditResult,
} from "@/editor/panels/spatialPlaceDraft";
import { libraryPlaceCardId, placedPlaceCloneProposal, previewPlaceDelete } from "@/editor/panels/spatialPlaceQuery";
import type { PlaceDesign, SpatialId } from "@/project/spatial/types";
import type { SpatialAuthoringRequest } from "@/editor/spatial/authoringTypes";
import { spatialAuthoringCompileScope } from "@/editor/spatial/authoringScope";
import type { Project } from "@/project/types";

export type SpatialPlaceChrome = SpatialDomainChrome;

export function workingProject(): Project {
  return visibleAuthoringProject();
}

function compileRequest(target: PlaceDraftTarget | undefined): SpatialAuthoringRequest {
  if (!target?.occurrenceId) return { operation: { kind: "edit" } };
  const document = visibleAuthoringProject().spatialAuthoring;
  if (!document) return { operation: { kind: "edit" }, compile: { occurrenceId: target.occurrenceId } };
  return { operation: { kind: "edit" }, compile: spatialAuthoringCompileScope(document, target.occurrenceId) };
}

function note(result: ReturnType<typeof spatialAuthoringErrorText>, saveState?: string): void {
  placeChromeState.previewError = result;
  if (saveState !== undefined) placeChromeState.saveState = saveState;
}

export function mutateWorkingPlace(target: PlaceDraftTarget, patch: (place: PlaceDesign) => PlaceDesign): void {
  const result = editAuthoringDraft((project) => editPlace(project, target, patch), compileRequest(target));
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안" : placeChromeState.saveState);
}

export function commitWorkingPlace(target: PlaceDraftTarget, edited: PlaceEditResult): boolean {
  if (edited.kind === "rejected") {
    placeChromeState.previewError = edited.code;
    return false;
  }
  const result = editAuthoringDraft(
    (project) => commitPlaceEdit(project, target, edited),
    compileRequest(target),
  );
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안" : placeChromeState.saveState);
  return result.kind === "ok";
}

export function workingPlace(card: SpatialGalleryCard | undefined): PlaceDesign | undefined {
  if (!card) return undefined;
  return placeFromProject(workingProject(), placeDraftTarget(card));
}

export function visiblePlaceSelection(card: SpatialGalleryCard | undefined): SpatialGalleryCard | undefined {
  if (spatialSession().occurrenceId) return card;
  const createdId = placeChromeState.createdDesignId;
  if (!createdId) return card;
  const createdCardId = libraryPlaceCardId(createdId);
  const requested = spatialSession().designId;
  if (requested && requested !== createdCardId) return card;
  const place = workingProject().spatialAuthoring?.library.places[createdId];
  if (!place) return card;
  return {
    id: createdCardId,
    localId: place.id,
    name: place.name,
    source: "own",
    kind: "places",
    usage: 0,
    placeKind: place.kind,
    canonicalSource: { kind: "place", id: place.id },
  };
}

export function spatialPlacesChrome(card: SpatialGalleryCard | undefined, rerender: () => void): SpatialPlaceChrome {
  bindSpatialBuildInputs();
  const controller = spatialAuthoringController();
  const target = card ? placeDraftTarget(card) : undefined;
  const builtinLocked = card?.source === "default";
  const missing = Boolean(card?.missingSource);
  const occurrenceId = target?.occurrenceId;
  return {
    saveState: placeChromeState.saveState,
    previewError: placeChromeState.previewError,
    deleteOpen: placeChromeState.deleteOpen,
    add: controller ? () => addBlankPlace(rerender) : undefined,
    duplicate: controller && workingProject().spatialAuthoring && card?.reviewedPlaceId ? () => copyBuiltinPlace(card.reviewedPlaceId!, rerender) : controller && target && !builtinLocked ? () => clonePlace(target, rerender) : undefined,
    delete: controller && target && !builtinLocked ? () => { placeChromeState.deleteOpen = true; rerender(); } : undefined,
    onDeleteConfirm: controller && target && placeChromeState.deleteOpen ? () => confirmDelete(target, rerender) : undefined,
    preview: controller && hasAuthoringDraft() ? () => previewPlace(rerender) : undefined,
    build: controller && !spatialBuildDisabledReason(card) ? () => {
      const seed = placeChromeState.buildSeed;
      if (seed === null) {
        note(BUILD_SEED_INTEGER_REQUIRED);
        rerender();
        return;
      }
      const result = runSpatialSourceBuild(card, seed, { kind: "new-maps" });
      note(spatialAuthoringErrorText(result), result.kind === "ok" ? "미리보기" : placeChromeState.saveState);
      rerender();
    } : undefined,
    buildSeed: placeChromeState.buildSeed,
    buildSeedText: placeChromeState.buildSeedText ?? undefined,
    onBuildSeed: (raw) => { placeChromeState.buildSeedText = raw; placeChromeState.buildSeed = parseSpatialBuildSeed(raw); },
    buildInputText: discloseSpatialBuildInput(),
    apply: controller && hasAuthoringPreview() ? () => applyPlace(rerender) : undefined,
    undo: controller ? () => { controller.undo(); rerender(); } : undefined,
    redo: controller ? () => { controller.redo(); rerender(); } : undefined,
    refresh: controller && occurrenceId && !missing
      ? () => {
        const compile = compileRequest(target).compile;
        queueOperation({
          operation: { kind: "refresh", request: { occurrenceId, externalConnections: "reject" } },
          ...(compile ? { compile } : {}),
        }, rerender);
      }
      : undefined,
    detach: controller && occurrenceId
      ? () => queueOperation({ operation: { kind: "detach", occurrenceId } }, rerender)
      : undefined,
  };
}

function previewPlace(rerender: () => void): void {
  const result = previewAuthoringDraft();
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "미리보기" : placeChromeState.saveState);
  rerender();
}

function applyPlace(rerender: () => void): void {
  if (!hasAuthoringPreview()) {
    placeChromeState.previewError = "authoring-preview-missing";
    rerender();
    return;
  }
  const result = applyAuthoringPreview();
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "적용" : placeChromeState.saveState);
  rerender();
}

function addBlankPlace(rerender: () => void): void {
  if (!visibleAuthoringProject().spatialAuthoring) {
    placeChromeState.previewError = "이 프로젝트에는 장소 설계 문서가 없습니다 — 새 설계를 만들 수 없습니다";
    rerender();
    return;
  }
  let createdId: ReturnType<typeof freshPlaceId> | undefined;
  const result = editAuthoringDraft((project) => {
    const created = blankPlaceDesign(project);
    createdId = created.id;
    return upsertPlaceDesign(project, created);
  });
  if (result.kind === "ok" && createdId) {
    placeChromeState.createdDesignId = createdId;
    selectSpatialDesign(libraryPlaceCardId(createdId));
  }
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안" : placeChromeState.saveState);
  rerender();
}

function clonePlace(target: PlaceDraftTarget, rerender: () => void): void {
  if (target.occurrenceId) {
    const proposal = placedPlaceCloneProposal({
      occurrenceId: target.occurrenceId, rootId: freshPlaceId(visibleAuthoringProject()),
    });
    queueOperation(proposal.request, rerender, proposal.destination.occurrenceId);
    return;
  }
  if (!target.libraryId) return;
  queueOperation({
    operation: {
      kind: "clone-design",
      source: { kind: "place", id: target.libraryId },
      id: freshPlaceId(visibleAuthoringProject()),
      name: `${target.name} 복제`,
    },
  }, rerender);
}

function confirmDelete(target: PlaceDraftTarget, rerender: () => void): void {
  if (target.occurrenceId) {
    queueOperation({
      operation: { kind: "delete-occurrence", request: { occurrenceId: target.occurrenceId, externalConnections: "reject" } },
    }, rerender);
  } else if (target.libraryId) {
    queueOperation({ operation: { kind: "delete-design", source: { kind: "place", id: target.libraryId } } }, rerender);
  }
  rerender();
}

function queueOperation(request: SpatialAuthoringRequest, rerender: () => void, selectedOccurrenceId?: SpatialId): void {
  const edited = editAuthoringDraft((project) => project, request);
  switch (edited.kind) {
    case "error":
      note(spatialAuthoringErrorText(edited));
      rerender();
      return;
    case "ok": break;
    default: return assertNever(edited);
  }
  const previewed = previewAuthoringDraft();
  switch (previewed.kind) {
    case "ok":
      if (selectedOccurrenceId) selectSpatialOccurrence(selectedOccurrenceId);
      note(null, "미리보기");
      break;
    case "error":
      note(spatialAuthoringErrorText(previewed));
      break;
    default: return assertNever(previewed);
  }
  rerender();
}

export function placeDeletePreview(card: SpatialGalleryCard | undefined): ReturnType<typeof previewPlaceDelete> {
  if (!card) return null;
  return previewPlaceDelete(workingProject(), placeDraftTarget(card));
}

export { clearAuthoringSession };

function copyBuiltinPlace(id: string, rerender: () => void): void {
  let copiedId: SpatialId | undefined;
  const namespace = freshPlaceId(workingProject());
  const result = editAuthoringDraft(project => {
    const copied = copyReviewedPlace(project, id, namespace);
    copiedId = copied.id;
    return copied.project;
  });
  if (result.kind === "ok" && copiedId) {
    placeChromeState.createdDesignId = copiedId;
    selectSpatialDesign(libraryPlaceCardId(copiedId));
  }
  note(spatialAuthoringErrorText(result), result.kind === "ok" ? "초안 · 미리보기 후 적용" : placeChromeState.saveState);
  rerender();
}
