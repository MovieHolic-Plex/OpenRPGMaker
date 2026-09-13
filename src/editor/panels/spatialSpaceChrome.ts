import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import type { SpatialDomainChrome } from "@/editor/panels/spatialTilesTab";
import {
  applyAuthoringPreview,
  hasAuthoringDraft,
  hasAuthoringPreview,
  previewAuthoringDraft,
  spatialAuthoringController,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { patchSpatialSession, selectSpatialDesign, selectSpatialOccurrence } from "@/editor/panels/spatialAuthoringSession";
import {
  BUILD_SEED_INTEGER_REQUIRED,
  bindSpatialBuildInputs,
  parseSpatialBuildSeed,
  discloseSpatialBuildInput,
  runSpatialSourceBuild,
  spatialBuildDisabledReason,
} from "@/editor/panels/spatialBuildChrome";
import { spaceChromeState } from "@/editor/panels/spatialSpaceChromeState";
import { mutateSpaceDraft, spaceOccurrenceCompile } from "@/editor/panels/spatialSpaceCommands";
import {
  freshSpatialId,
  librarySpaceCardId,
  spaceDraftTarget,
  upsertSpaceDesign,
  type SpaceDraftTarget,
} from "@/editor/panels/spatialSpaceDraft";
import { assertNever, spatialId } from "@/project/spatial/domain";
import type { SpaceDesign, SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";

export type SpatialSpaceChrome = SpatialDomainChrome;

export function spatialSpacesChrome(card: SpatialGalleryCard | undefined, rerender: () => void): SpatialSpaceChrome {
  bindSpatialBuildInputs();
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
    duplicate: controller && target && (target.libraryId || target.occurrenceId) && !builtinLocked ? () => queueClone(target, rerender) : undefined,
    delete: controller && target && (target.libraryId || target.occurrenceId) && !builtinLocked ? () => { spaceChromeState.deleteOpen = true; rerender(); } : undefined,
    onDeleteConfirm: controller && target && spaceChromeState.deleteOpen ? () => queueDelete(target, rerender) : undefined,
    preview: controller && hasAuthoringDraft() ? () => previewSpace(rerender) : undefined,
    build: controller && !spatialBuildDisabledReason(card) ? () => {
      const seed = spaceChromeState.buildSeed;
      if (seed === null) {
        spaceChromeState.previewError = BUILD_SEED_INTEGER_REQUIRED;
        rerender();
        return;
      }
      const result = runSpatialSourceBuild(card, seed, { kind: "new-maps" });
      spaceChromeState.previewError = spatialAuthoringErrorText(result);
      if (result.kind === "ok") spaceChromeState.saveState = "미리보기";
      rerender();
    } : undefined,
    buildSeed: spaceChromeState.buildSeed,
    buildSeedText: spaceChromeState.buildSeedText ?? undefined,
    onBuildSeed: (raw) => { spaceChromeState.buildSeedText = raw; spaceChromeState.buildSeed = parseSpatialBuildSeed(raw); },
    buildInputText: discloseSpatialBuildInput(),
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
  if (!visibleAuthoringProject().spatialAuthoring) {
    spaceChromeState.previewError = "이 프로젝트에는 공간 설계 문서가 없습니다 — 새 설계를 만들 수 없습니다";
    rerender();
    return;
  }
  let createdId: ReturnType<typeof freshSpatialId> | undefined;
  mutateSpaceDraft((project) => {
    const created = blankInteriorSpace(project);
    createdId = created.id;
    return upsertSpaceDesign(project, created);
  });
  if (createdId && !spaceChromeState.previewError) {
    selectSpatialDesign(librarySpaceCardId(createdId));
    patchSpatialSession({ source: "own", inspectorOpen: true });
  }
  rerender();
}

function queueClone(target: SpaceDraftTarget, rerender: () => void): void {
  if (target.occurrenceId) {
    const rootId = freshSpatialId(visibleAuthoringProject(), "occ");
    mutateSpaceDraft((project) => project, {
      operation: {
        kind: "clone-occurrence",
        request: { occurrenceId: target.occurrenceId, rootId, externalConnections: "omit" },
      },
    });
    const previewed = previewAuthoringDraft();
    spaceChromeState.previewError = spatialAuthoringErrorText(previewed);
    switch (previewed.kind) {
      case "ok":
        selectSpatialOccurrence(rootId);
        spaceChromeState.saveState = "초안";
        break;
      case "error":
        break;
      default:
        return assertNever(previewed);
    }
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

function queueRefresh(occurrenceId: SpatialId, rerender: () => void): void {
  const compile = spaceOccurrenceCompile(occurrenceId);
  if (!compile) {
    rerender();
    return;
  }
  mutateSpaceDraft((project) => project, {
    operation: { kind: "refresh", request: { occurrenceId, externalConnections: "reject" } },
    compile,
  });
  rerender();
}

function queueDetach(occurrenceId: SpatialId, rerender: () => void): void {
  mutateSpaceDraft((project) => project, { operation: { kind: "detach", occurrenceId } });
  rerender();
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
