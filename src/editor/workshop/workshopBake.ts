// src/editor/workshop/workshopBake.ts
/**
 * 공방 2단계 — 고른 후보를 칩셋에 굽는다: 실내 기물은 손 도트 실내(atlas_biome_interior), 맵 기물은 정의할 때 적은 그 맵 칩셋.
 * 격자를 16px 칸으로 잘라(빈 칸은 뺀다) 30칸 폭 시트 PNG 한 장을 만들고, 굽기 자체는 project/workshopTiles.ts 가 한다.
 * 다 구우면 window 에 WORKSHOP_BAKED_EVENT 를 낸다 — 조수의 「없는 타일」 카드(aiStoreCard.ts)가 듣고 후속 요청을 보낸다.
 */
import { editorState } from "@/editor/editorState";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { workshopObjectInput } from "@/harnesses/_core/workshop/autoInstall";
import { workshopGridHash } from "@/harnesses/_core/workshop/bakeSheet";
import type { BaseInfo, GateAdvice, Grid, Palette, WorkshopEnv, WorkshopItem } from "@/harnesses/_core/workshop/types";
import { ATLAS_BIOME_INTERIOR_ID, createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { store } from "@/project/store";
import { bakedWorkshopKit, bakeWorkshopObject, workshopObjectId } from "@/project/workshopTiles";
import { withInstallOwnership } from "./installOwnership";
import { WORKSHOP_BAKED_EVENT, type WorkshopBakedDetail } from "./workshopEvents";


const TILE = 16;

export { workshopGridHash };

/** 구워 넣을 칩셋: 맵 기물은 정의할 때 적은 칩셋, 실내 기물은 손 도트 실내. */
export function workshopTargetTileset(item: WorkshopItem): string {
  return item.tilesetId ?? ATLAS_BIOME_INTERIOR_ID;
}

/** 이 후보 그림이 지금 프로젝트 칩셋에 이미 들어갔는가. */
export function isWorkshopPickBaked(item: WorkshopItem, grid: Grid): boolean {
  return bakedWorkshopKit(store.getCurrent().tilesets[workshopTargetTileset(item)], workshopObjectId(item.key), workshopGridHash(grid)) !== undefined;
}

/**
 * 칩셋에 들어간 기물을 지금 맵에 놓을 수 있게 붓에 담는다(기물 탭의 「맵에 놓기」와 같은 길: activePaletteStamp + 칠하기 도구).
 * 지금 맵이 그 칩셋을 쓰지 않으면 놓을 수 없다 — 사람이 읽는 이유를 돌려준다. 담았으면 null.
 */
export function armWorkshopStamp(item: WorkshopItem, grid: Grid): string | null {
  const project = store.getCurrent();
  const tilesetId = workshopTargetTileset(item);
  const kit = bakedWorkshopKit(project.tilesets[tilesetId], workshopObjectId(item.key), workshopGridHash(grid));
  if (!kit || kit.kind !== "section") return "아직 칩셋에 들어가지 않았어요.";
  const mapId = editorState.get().currentMapId;
  const map = mapId ? project.maps[mapId] : undefined;
  if (!map || map.tilesetId !== tilesetId) return `지금 맵은 「${project.tilesets[tilesetId]?.name ?? tilesetId}」 칩셋을 쓰지 않아요. 그 칩셋을 쓰는 맵을 열면 놓을 수 있어요.`;
  editorState.set({ activePaletteStamp: paletteStampFromKit(kit), tool: "paint" });
  return null;
}

/**
 * 고른 후보를 칩셋에 굽는다. 되돌리기 한 번으로 뺄 수 있다.
 * autoPicked = 사람이 아니라 「알아서 고르기」(조수 요청 카드, 기본 켜짐)가 골랐다 — 설명서에 사람 선택(review.pick)을 적지 않는다.
 */
export function bakeWorkshopPick(item: WorkshopItem, grid: Grid, palette: Palette, env: WorkshopEnv, options: { readonly autoPicked?: boolean; readonly gate?: GateAdvice | null; readonly base?: BaseInfo | null } = {}): WorkshopBakedDetail {
  const input = workshopObjectInput(item, grid, palette, env, options);
  const { objectId, columns, rows } = input;
  const tilesetId = workshopTargetTileset(item);
  if (tilesetId !== ATLAS_BIOME_INTERIOR_ID) {
    const target = store.getCurrent().tilesets[tilesetId];
    if (!target) throw new Error(`이 기물을 넣을 칩셋이 프로젝트에 없습니다: ${tilesetId}`);
    if (target.tileSize !== TILE) throw new Error(`공방 그림은 16px 칸이라 ${target.tileSize}px 칩셋에는 넣을 수 없습니다.`);
  }
  // 그 칩셋을 쓰는 맵을 조수가 쥐고 있으면 넣지 않는다(WorkshopInstallBusy) — 되돌리기 기록도 남기지 않는다.
  withInstallOwnership([tilesetId], `공방 넣기: ${item.title}`, () => {
    recordProjectSnapshot("공방 기물 칩셋에 넣기");
    store.update((draft) => {
      if (tilesetId === ATLAS_BIOME_INTERIOR_ID) {
        if (!draft.tilesets[ATLAS_BIOME_INTERIOR_ID]) draft.tilesets[ATLAS_BIOME_INTERIOR_ID] = createAtlasBiomeInteriorTileset();
        else ensureAtlasBiomeInteriorCurrent(draft, ATLAS_BIOME_INTERIOR_ID);
      }
      bakeWorkshopObject(draft, tilesetId, input);
    }, { scope: "project", origin: "human", label: `공방 기물 칩셋에 넣기: ${item.title}` });
  });
  const detail: WorkshopBakedDetail = { objectId, title: item.title, tilesetId, kind: item.kind, columns, rows };
  window.dispatchEvent(new CustomEvent<WorkshopBakedDetail>(WORKSHOP_BAKED_EVENT, { detail }));
  return detail;
}
