import { editorState } from "@/editor/editorState";
import { applyAuthoringPreview } from "@/editor/panels/spatialAuthoringAccess";
import { previewSpatialSourceBuild } from "@/editor/panels/spatialBuildActions";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { freshSpatialId } from "@/editor/panels/spatialSpaceDraft";
import { serialize } from "@/project/io";
import { regionReference } from "@/project/regionReferences";
import { importReferenceScene, preloadRegionReferenceScene } from "@/project/regionReferenceImport";
import { convertLegacySpatialSnapshot } from "@/project/spatial/legacyImport";
import { store } from "@/project/store";
import type { SpatialId } from "@/project/spatial/types";
import type { MapId, Project } from "@/project/types";

function note(saveState: string, previewError: string | null = null): void {
  placeChromeState.saveState = saveState;
  placeChromeState.previewError = previewError;
}

/** 검토 장소를 넣을 도서관이 없으면, 따로 켜기 버튼을 요구하지 않고 그 자리에서 문서를 만든다. */
function ensureSpatialAuthoringDocument(draft: Project): void {
  if (draft.spatialAuthoring) return;
  const document = convertLegacySpatialSnapshot(serialize(draft)).preview.spatialAuthoring;
  if (document === undefined) throw new Error("장소 설계 문서를 만들지 못했습니다.");
  draft.spatialAuthoring = document;
}

export function placeReviewedPreset(id: string, rerender: () => void): void {
  if (placeChromeState.buildSeed === null) {
    note(placeChromeState.saveState, "시드는 정수여야 합니다");
    rerender();
    return;
  }
  note("기본 장소를 프로젝트에 넣는 중…");
  rerender();
  void import("@/project/defaults/spatial/reviewedPlaceCatalog").then(({ installBundledReviewedPlace }) => {
    let installedId: SpatialId | "" = "";
    store.update((draft) => {
      ensureSpatialAuthoringDocument(draft);
      const installed = installBundledReviewedPlace(draft, id);
      installedId = installed.id;
      if (installed.project !== draft) {
        draft.spatialAuthoring = installed.project.spatialAuthoring;
        draft.tilesets = installed.project.tilesets;
        draft.assets = installed.project.assets;
      }
    }, { scope: "project", label: "기본 장소 프리셋" });
    const seed = placeChromeState.buildSeed ?? 7;
    const result = previewSpatialSourceBuild({
      source: { kind: "place", id: installedId as SpatialId },
      rootId: freshSpatialId(store.getCurrent(), "occ"),
      seed,
      destination: { kind: "new-maps" },
    });
    if (result.kind === "error") {
      note(placeChromeState.saveState, result.error.detail ?? result.error.message);
      rerender();
      return;
    }
    const applied = applyAuthoringPreview();
    if (applied.kind === "error") {
      note(placeChromeState.saveState, applied.error.detail ?? applied.error.message);
      rerender();
      return;
    }
    const mapId = applied.value.impact.mapIds[0] ?? result.value.impact.mapIds[0];
    if (!mapId || !Object.hasOwn(store.getCurrent().maps, mapId)) {
      note(placeChromeState.saveState, "맵을 만들지 못했습니다");
      rerender();
      return;
    }
    editorState.set({ currentMapId: mapId as MapId });
    note("맵에 넣었습니다");
    rerender();
  }).catch((error: unknown) => {
    note(placeChromeState.saveState, error instanceof Error ? error.message : String(error));
    rerender();
  });
}

export function placeReferenceMapPreset(id: string, rerender: () => void): void {
  const reference = regionReference(id);
  if (!reference) {
    note(placeChromeState.saveState, "프리셋을 찾을 수 없습니다");
    rerender();
    return;
  }
  note("완성 맵을 프로젝트에 넣는 중…");
  rerender();
  // 조수 도구 import_region_reference 와 같은 경로 — 타일셋 이식·뒤쪽 칸·업로드 아틀라스까지 함께 싣는다.
  void preloadRegionReferenceScene(id).then((scene) => {
    let mapId = "";
    let tilesetNote = "";
    store.update((draft) => {
      const result = importReferenceScene(draft, scene, { newMapId: freshPresetMapId(draft, id) });
      mapId = result.mapId;
      if (result.tileset.mode === "copied") tilesetNote = ` (타일셋 사본 ${result.tileset.tilesetId})`;
    }, { scope: "project", label: "완성 맵 프리셋" });
    if (mapId) editorState.set({ currentMapId: mapId as MapId });
    note(`「${reference.name}」을 맵 목록에 넣었습니다${tilesetNote}`);
    rerender();
  }).catch((error: unknown) => {
    note(placeChromeState.saveState, error instanceof Error ? error.message : String(error));
    rerender();
  });
}

function freshPresetMapId(draft: Project, id: string): string {
  const base = `preset:${id}`;
  let mapId = base;
  let suffix = 2;
  while (Object.hasOwn(draft.maps, mapId)) mapId = `${base}:${suffix++}`;
  return mapId;
}
