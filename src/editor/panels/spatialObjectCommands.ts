import { editorState } from "@/editor/editorState";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { getMapEditHistoryState, recordProjectSnapshot, redoMapEdit, undoMapEdit } from "@/editor/mapEditHistory";
import type { SpatialGalleryCard } from "@/editor/panels/spatialCatalog";
import {
  applyAuthoringPreview,
  hasAuthoringDraft,
  hasAuthoringPreview,
  previewAuthoringDraft,
  spatialAuthoringController,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import {
  BUILD_SEED_INTEGER_REQUIRED,
  bindSpatialBuildInputs,
  parseSpatialBuildSeed,
  discloseSpatialBuildInput,
  objectBuildDestinationError,
  runSpatialSourceBuild,
  spatialBuildDisabledReason,
} from "@/editor/panels/spatialBuildChrome";
import type { SpatialSourceBuildInput } from "@/editor/panels/spatialBuildActions";
import { objectChromeState } from "@/editor/panels/spatialObjectChromeState";
import {
  atlasMismatch,
  objectAnchor,
  patchObjectDesign,
  renameOwnedKit,
  type ObjectDraftTarget,
} from "@/editor/panels/spatialObjectDraft";
import type { SpatialObjectInspectorHandlers } from "@/editor/panels/spatialObjectInspector";
import {
  addBlankObject,
  commitLiveOrDraft,
  confirmDelete,
  copyBuiltin,
  duplicateObject,
  openDetachedKitPainter,
} from "@/editor/panels/spatialObjectMutations";
import type { SpatialDomainChrome } from "@/editor/panels/spatialTilesTab";
import { spatialId } from "@/project/spatial/domain";
import type { ObjectDesign } from "@/project/spatial/types";
import { store } from "@/project/store";

export function objectDraftTarget(card: SpatialGalleryCard): ObjectDraftTarget | undefined {
  const tilesetId = card.tilesetId;
  const kitId = card.objectId ?? card.localId;
  if (!tilesetId || !kitId) return undefined;
  const libraryId = card.id.startsWith("library-object/") && card.localId
    ? spatialId(card.localId)
    : undefined;
  return {
    cardId: card.id,
    tilesetId,
    kitId,
    name: card.name,
    source: card.source,
    ...(libraryId ? { libraryId } : {}),
  };
}

export function objectBuildDestination(): Extract<SpatialSourceBuildInput["destination"], { kind: "map" }> {
  bindSpatialBuildInputs();
  const mapId = objectChromeState.buildMapId;
  const x = objectChromeState.buildRectX;
  const y = objectChromeState.buildRectY;
  const width = objectChromeState.buildRectWidth;
  const height = objectChromeState.buildRectHeight;
  const entryX = objectChromeState.buildEntryX;
  const entryY = objectChromeState.buildEntryY;
  return {
    kind: "map",
    currentMapId: mapId,
    selection: mapId !== null && x !== null && y !== null && width !== null && height !== null
      ? { mapId, x, y, width, height }
      : null,
    entry: entryX !== null && entryY !== null ? { x: entryX, y: entryY } : null,
  };
}

export function spatialObjectsChrome(card: SpatialGalleryCard | undefined, rerender: () => void): SpatialDomainChrome {
  bindSpatialBuildInputs();
  const controller = spatialAuthoringController();
  const history = getMapEditHistoryState();
  const target = card ? objectDraftTarget(card) : undefined;
  const builtinLocked = card?.source === "default";
  const blocked = spatialBuildDisabledReason(card);
  const canBuild = Boolean(controller && !blocked);
  return {
    saveState: objectChromeState.saveState,
    previewError: objectChromeState.previewError,
    deleteOpen: objectChromeState.deleteOpen,
    add: () => addBlankObject(rerender),
    duplicate: target && !builtinLocked ? () => duplicateObject(target, rerender) : undefined,
    delete: target && !builtinLocked ? () => { objectChromeState.deleteOpen = true; rerender(); } : undefined,
    onDeleteConfirm: target && objectChromeState.deleteOpen ? () => confirmDelete(target, rerender) : undefined,
    preview: controller && hasAuthoringDraft() ? () => {
      const result = previewAuthoringDraft();
      objectChromeState.previewError = spatialAuthoringErrorText(result);
      objectChromeState.saveState = objectChromeState.previewError ? "오류" : "미리보기";
      rerender();
    } : undefined,
    build: canBuild ? () => {
      const seed = objectChromeState.buildSeed;
      if (seed === null) {
        objectChromeState.previewError = BUILD_SEED_INTEGER_REQUIRED;
        objectChromeState.saveState = "오류";
        rerender();
        return;
      }
      const destination = objectBuildDestination();
      const destError = objectBuildDestinationError(destination);
      if (destError) {
        objectChromeState.previewError = destError;
        objectChromeState.saveState = "오류";
        rerender();
        return;
      }
      const result = runSpatialSourceBuild(card, seed, destination);
      objectChromeState.previewError = spatialAuthoringErrorText(result);
      objectChromeState.saveState = result.kind === "ok" ? "미리보기" : "오류";
      rerender();
    } : undefined,
    buildSeed: objectChromeState.buildSeed,
    buildSeedText: objectChromeState.buildSeedText ?? undefined,
    onBuildSeed: (raw) => { objectChromeState.buildSeedText = raw; objectChromeState.buildSeed = parseSpatialBuildSeed(raw); },
    buildInputText: discloseSpatialBuildInput(),
    apply: controller && hasAuthoringPreview() ? () => {
      const result = applyAuthoringPreview();
      objectChromeState.previewError = spatialAuthoringErrorText(result);
      objectChromeState.saveState = objectChromeState.previewError ? "오류" : "적용";
      rerender();
    } : undefined,
    undo: controller ? () => { controller.undo(); rerender(); } : history.canUndo ? () => { undoMapEdit(); rerender(); } : undefined,
    redo: controller ? () => { controller.redo(); rerender(); } : history.canRedo ? () => { redoMapEdit(); rerender(); } : undefined,
  };
}

export function objectInspectorHandlers(
  target: ObjectDraftTarget,
  design: ObjectDesign | undefined,
  rerender: () => void,
): SpatialObjectInspectorHandlers {
  const builtinLocked = target.source === "default";
  return {
    builtinLocked,
    onBuildTarget: rerender,
    onName: (name: string) => commitLiveOrDraft(rerender, (project) => {
      let next = renameOwnedKit(project, target.tilesetId, target.kitId, name);
      if (target.libraryId) next = patchObjectDesign(next, target.libraryId, { name });
      return next;
    }, () => {
      recordProjectSnapshot();
      store.update((draft) => {
        const tileset = draft.tilesets[target.tilesetId];
        if (!tileset?.structureKits) return;
        tileset.structureKits = tileset.structureKits.map((kit) =>
          kit.id === target.kitId ? { ...kit, name } : kit,
        );
      });
    }),
    onGraphic: (tilesetId: string, kitId: string) => {
      const mapId = editorState.get().currentMapId ?? visibleAuthoringProject().startMapId;
      if (tilesetId !== target.tilesetId) {
        const mismatch = atlasMismatch(visibleAuthoringProject(), tilesetId, mapId);
        if (mismatch) {
          objectChromeState.previewError = mismatch;
          rerender();
          return;
        }
      }
      patchLibrary(target, rerender, { graphic: { tilesetId, kitId } });
    },
    onAnchor: (index, patch) => {
      if (!design) return;
      const anchors = design.anchors.map((anchor, i) => i === index ? { ...anchor, ...patch } : anchor);
      patchLibrary(target, rerender, { anchors });
    },
    onAddAnchor: () => {
      if (!design || !target.libraryId) return;
      const id = `${target.libraryId}-anchor-${design.anchors.length + 1}`;
      patchLibrary(target, rerender, { anchors: [...design.anchors, objectAnchor(id, "앵커", 0, 0)] });
    },
    onChipToggle: (chip, on) => {
      const chips = new Set(design?.chips ?? []);
      if (on) chips.add(chip); else chips.delete(chip);
      patchLibrary(target, rerender, { chips: [...chips] });
    },
    onChipCustom: (value) => {
      const extras = value.split(",").map((part) => part.trim()).filter(Boolean);
      const kept = (design?.chips ?? []).filter((chip) => ["pass", "block", "sit", "sleep", "counter"].includes(chip));
      patchLibrary(target, rerender, { chips: [...kept, ...extras] });
    },
    onEditGraphic: () => openDetachedKitPainter(target.tilesetId, target.kitId, rerender),
    onCopyBuiltin: () => copyBuiltin(target, rerender),
  };
}

export function placeObjectOnCurrentMap(card: SpatialGalleryCard): string | null {
  const target = objectDraftTarget(card);
  if (!target) return "대상이 없습니다";
  const project = visibleAuthoringProject();
  const mapId = editorState.get().currentMapId ?? project.startMapId;
  const mismatch = atlasMismatch(project, target.tilesetId, mapId);
  if (mismatch) {
    objectChromeState.previewError = mismatch;
    return mismatch;
  }
  const kit = project.tilesets[target.tilesetId]?.structureKits?.find((entry) => entry.id === target.kitId);
  if (kit && kit.kind === "section") {
    editorState.set({ activePaletteStamp: paletteStampFromKit(kit), tool: "paint" });
    return null;
  }
  objectChromeState.previewError = "호환되는 그림이 없습니다";
  return objectChromeState.previewError;
}

function patchLibrary(target: ObjectDraftTarget, rerender: () => void, patch: Parameters<typeof patchObjectDesign>[2]): void {
  const libraryId = target.libraryId;
  if (!libraryId) return;
  commitLiveOrDraft(rerender, (project) => patchObjectDesign(project, libraryId, patch));
}
