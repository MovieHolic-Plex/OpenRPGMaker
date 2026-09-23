import { editorState } from "@/editor/editorState";
import { previewSpatialSourceBuild } from "@/editor/panels/spatialBuildActions";
import { placeChromeState } from "@/editor/panels/spatialPlaceChromeState";
import { freshSpatialId } from "@/editor/panels/spatialSpaceDraft";
import { serialize } from "@/project/io";
import { regionReference } from "@/project/regionReferences";
import { loadReferencePresetScene } from "@/project/referencePresetSnapshot";
import { convertLegacySpatialSnapshot } from "@/project/spatial/legacyImport";
import { store } from "@/project/store";
import type { SpatialId } from "@/project/spatial/types";
import type { GameMap, MapId, Project, TilesetId } from "@/project/types";

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
    note(result.kind === "ok" ? "미리보기" : placeChromeState.saveState, result.kind === "error" ? result.error.message : null);
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
  void loadReferencePresetScene(id).then((scene) => {
    if (!scene) {
      note(placeChromeState.saveState, "이 사례의 맵 자료를 찾을 수 없습니다");
      rerender();
      return;
    }
    let mapId = "";
    store.update((draft) => {
      const tilesetId = scene.tileset.id;
      if (!Object.hasOwn(draft.tilesets, tilesetId)) draft.tilesets[tilesetId] = { ...scene.tileset, id: tilesetId };
      const base = `preset:${id}`;
      mapId = base;
      let suffix = 2;
      while (Object.hasOwn(draft.maps, mapId)) mapId = `${base}:${suffix++}`;
      const map: GameMap = {
        id: mapId as MapId,
        name: reference.name,
        width: scene.map.width,
        height: scene.map.height,
        tilesetId: tilesetId as TilesetId,
        tileSize: scene.map.tileSize || 16,
        lowerTiles: [...scene.map.lowerTiles],
        upperTiles: [...scene.map.upperTiles],
        events: scene.map.events ?? [],
      };
      draft.maps[map.id] = map;
    }, { scope: "project", label: "완성 맵 프리셋" });
    if (mapId) editorState.set({ currentMapId: mapId as MapId });
    note(`「${reference.name}」을 맵 목록에 넣었습니다`);
    rerender();
  }).catch((error: unknown) => {
    note(placeChromeState.saveState, error instanceof Error ? error.message : String(error));
    rerender();
  });
}
