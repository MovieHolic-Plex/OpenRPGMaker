import { sharedVillageObjectById } from "@/project/defaults/sharedVillageObjects";
import { tiboInteriorObjectById } from "@/project/defaults/tiboInterior";
import { bakeInteriorObject } from "@/editor/harnessSuggestion/structureKitRasterModel";
import { resolveSpatialGraphic } from "@/project/spatial/assets";
import { editorState } from "@/editor/editorState";
import {
  createBlankStructureKit,
  deleteStructureKit,
  duplicateIntoTileset,
} from "@/editor/harnessSuggestion/structureKitActions";
import { interiorObjectById } from "@/editor/interiorObjectCatalog";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { patchSpatialSession, selectSpatialDesign } from "@/editor/panels/spatialAuthoringSession";
import {
  editAuthoringDraft,
  spatialAuthoringController,
  spatialAuthoringErrorText,
  visibleAuthoringProject,
} from "@/editor/panels/spatialAuthoringAccess";
import { objectChromeState } from "@/editor/panels/spatialObjectChromeState";
import {
  copyBuiltinObjectIntoProject,
  createBlankObjectIntoProject,
  duplicateObjectIntoProject,
  libraryObjectCardId,
  ownedKitCardId,
  previewObjectDelete,
  patchObjectDesign,
  removeKitFromProject,
  replaceKitInProject,
  type ObjectDraftTarget,
} from "@/editor/panels/spatialObjectDraft";
import { openStructureKitEditor, type StructureKitEditorAccess } from "@/editor/panels/structureKitEditorDialog";
import type { SpatialId } from "@/project/spatial/types";
import type { Project } from "@/project/types";
import { store } from "@/project/store";
import { randomUuid } from "@/util/id";
import { toast } from "@/util/toast";

export function commitLiveOrDraft(rerender: () => void, mutate: (project: Project) => Project, live?: () => void): void {
  const controller = visibleAuthoringProject().spatialAuthoring ? spatialAuthoringController() : null;
  if (controller) {
    const result = editAuthoringDraft(mutate);
    objectChromeState.previewError = spatialAuthoringErrorText(result);
    objectChromeState.saveState = objectChromeState.previewError ? "오류" : "초안";
    rerender();
    return;
  }
  if (live) live();
  else {
    recordProjectSnapshot();
    store.update((project) => Object.assign(project, mutate(project)), { scope: "database", label: "오브젝트 수정" });
  }
  objectChromeState.saveState = "적용";
  objectChromeState.previewError = null;
  rerender();
}

export function openDetachedKitPainter(tilesetId: string, kitId: string, rerender: () => void, libraryId?: SpatialId): void {
  const controller = visibleAuthoringProject().spatialAuthoring ? spatialAuthoringController() : null;
  if (!controller) {
    openStructureKitEditor(tilesetId, kitId, rerender);
    return;
  }
  const graphic = resolveSpatialGraphic(visibleAuthoringProject(), { tilesetId, kitId });
  if (graphic?.source === "builtin") {
    const nextKitId = libraryId ? `kit_${randomUuid()}` : kitId;
    const result = editAuthoringDraft((project) => {
      const next = replaceKitInProject(project, tilesetId,
        bakeInteriorObject(graphic.object, nextKitId, graphic.object.label));
      return libraryId ? patchObjectDesign(next, libraryId, { graphic: { tilesetId, kitId: nextKitId } }) : next;
    });
    objectChromeState.previewError = spatialAuthoringErrorText(result);
    if (result.kind === "error") { rerender(); return; }
    kitId = nextKitId;
    objectChromeState.saveState = "초안";
  }
  const access: StructureKitEditorAccess = {
    read: () => {
      const kit = visibleAuthoringProject().tilesets[tilesetId]?.structureKits?.find((entry) => entry.id === kitId);
      return kit?.kind === "section" ? kit : undefined;
    },
    write: (kit) => {
      const result = editAuthoringDraft((project) => replaceKitInProject(project, tilesetId, kit));
      objectChromeState.previewError = spatialAuthoringErrorText(result);
      objectChromeState.saveState = result.kind === "ok" ? "초안" : "오류";
      if (result.kind === "error") toast(objectChromeState.previewError ?? "수정하지 못했습니다", "error");
    },
  };
  openStructureKitEditor(tilesetId, kitId, rerender, access);
}

export function copyBuiltin(target: ObjectDraftTarget, rerender: () => void): void {
  const builtin = interiorObjectById(target.kitId) ?? tiboInteriorObjectById(target.kitId) ?? sharedVillageObjectById(target.kitId);
  if (!builtin) return;
  const controller = visibleAuthoringProject().spatialAuthoring ? spatialAuthoringController() : null;
  if (controller) {
    const kitId = `kit_${randomUuid()}`;
    const designId = `obj_${randomUuid()}`;
    const result = editAuthoringDraft((project) => {
      const copied = copyBuiltinObjectIntoProject({
        project,
        tilesetId: target.tilesetId,
        builtinId: target.kitId,
        kitId,
        designId: project.spatialAuthoring ? designId : undefined,
      });
      return "error" in copied ? project : copied.project;
    });
    objectChromeState.previewError = spatialAuthoringErrorText(result);
    objectChromeState.saveState = objectChromeState.previewError ? "오류" : "초안";
    if (!objectChromeState.previewError) {
      if (visibleAuthoringProject().spatialAuthoring) selectSpatialDesign(libraryObjectCardId(designId));
      else selectSpatialDesign(ownedKitCardId(target.tilesetId, kitId));
      patchSpatialSession({ source: "own" });
      rerender();
      openDetachedKitPainter(target.tilesetId, kitId, rerender);
      return;
    }
    rerender();
    return;
  }
  recordProjectSnapshot();
  const copy = duplicateIntoTileset(target.tilesetId, builtin);
  toast(`'${copy.name}' 사본을 만들었습니다`, "ok");
  selectSpatialDesign(ownedKitCardId(target.tilesetId, copy.id));
  patchSpatialSession({ source: "own" });
  openStructureKitEditor(target.tilesetId, copy.id, rerender);
}

export function duplicateObject(target: ObjectDraftTarget, rerender: () => void): void {
  const controller = visibleAuthoringProject().spatialAuthoring ? spatialAuthoringController() : null;
  if (controller) {
    const nextKitId = `kit_${randomUuid()}`;
    const nextDesignId = `obj_${randomUuid()}`;
    const result = editAuthoringDraft((project) => {
      const copied = duplicateObjectIntoProject({
        project,
        tilesetId: target.tilesetId,
        kitId: target.kitId,
        nextKitId,
        sourceDesignId: target.libraryId,
        nextDesignId,
      });
      return "error" in copied ? project : copied.project;
    });
    objectChromeState.previewError = spatialAuthoringErrorText(result);
    objectChromeState.saveState = objectChromeState.previewError ? "오류" : "초안";
    if (!objectChromeState.previewError) {
      if (target.libraryId) selectSpatialDesign(libraryObjectCardId(nextDesignId));
      else selectSpatialDesign(ownedKitCardId(target.tilesetId, nextKitId));
    }
    rerender();
    return;
  }
  const kit = store.getCurrent().tilesets[target.tilesetId]?.structureKits?.find((entry) => entry.id === target.kitId);
  if (!kit || kit.kind !== "section") return;
  recordProjectSnapshot();
  const copy = duplicateIntoTileset(target.tilesetId, kit);
  selectSpatialDesign(ownedKitCardId(target.tilesetId, copy.id));
  rerender();
}

export function addBlankObject(rerender: () => void, preferredTilesetId?: string): void {
  const mapId = editorState.get().currentMapId;
  const tilesetId = preferredTilesetId ?? (mapId ? store.getCurrent().maps[mapId]?.tilesetId : undefined)
    ?? Object.keys(store.getCurrent().tilesets)[0];
  if (!tilesetId) return;
  const controller = visibleAuthoringProject().spatialAuthoring ? spatialAuthoringController() : null;
  if (controller) {
    const kitId = `kit_${randomUuid()}`;
    const designId = `obj_${randomUuid()}`;
    const result = editAuthoringDraft((project) => {
      const created = createBlankObjectIntoProject({
        project, tilesetId, kitId, designId: project.spatialAuthoring ? designId : undefined,
      });
      return "error" in created ? project : created.project;
    });
    objectChromeState.previewError = spatialAuthoringErrorText(result);
    objectChromeState.saveState = objectChromeState.previewError ? "오류" : "초안";
    if (!objectChromeState.previewError) {
      if (visibleAuthoringProject().spatialAuthoring) selectSpatialDesign(libraryObjectCardId(designId));
      else selectSpatialDesign(ownedKitCardId(tilesetId, kitId));
      patchSpatialSession({ source: "own" });
      rerender();
      openDetachedKitPainter(tilesetId, kitId, rerender);
      return;
    }
    rerender();
    return;
  }
  recordProjectSnapshot();
  const kit = createBlankStructureKit(tilesetId);
  selectSpatialDesign(ownedKitCardId(tilesetId, kit.id));
  patchSpatialSession({ source: "own" });
  openStructureKitEditor(tilesetId, kit.id, rerender);
}

export function confirmDelete(target: ObjectDraftTarget, rerender: () => void): void {
  const preview = previewObjectDelete(visibleAuthoringProject(), target);
  if (preview.strong.length > 0) {
    objectChromeState.previewError = "참조 중인 설계는 지울 수 없습니다";
    objectChromeState.deleteOpen = false;
    rerender();
    return;
  }
  const controller = visibleAuthoringProject().spatialAuthoring ? spatialAuthoringController() : null;
  const libraryId = target.libraryId;
  if (controller && libraryId) {
    const result = editAuthoringDraft((project) => project, {
      operation: { kind: "delete-design", source: { kind: "object", id: libraryId } },
    });
    objectChromeState.previewError = spatialAuthoringErrorText(result);
    objectChromeState.saveState = objectChromeState.previewError ? "오류" : "초안";
  } else if (controller) {
    const result = editAuthoringDraft((project) => removeKitFromProject(project, target.tilesetId, target.kitId));
    objectChromeState.previewError = spatialAuthoringErrorText(result);
    objectChromeState.saveState = objectChromeState.previewError ? "오류" : "초안";
  } else {
    recordProjectSnapshot();
    deleteStructureKit(target.tilesetId, target.kitId);
  }
  objectChromeState.deleteOpen = false;
  rerender();
}
