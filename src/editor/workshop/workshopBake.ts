// src/editor/workshop/workshopBake.ts
/**
 * 공방 2단계 — 고른 후보를 칩셋에 굽는다: 실내 기물은 손 도트 실내(atlas_biome_interior), 맵 기물은 정의할 때 적은 그 맵 칩셋.
 * 격자를 16px 칸으로 잘라(빈 칸은 뺀다) 30칸 폭 시트 PNG 한 장을 만들고, 굽기 자체는 project/workshopTiles.ts 가 한다.
 * 다 구우면 window 에 WORKSHOP_BAKED_EVENT 를 낸다 — 조수의 「없는 타일」 카드(aiStoreCard.ts)가 듣고 후속 요청을 보낸다.
 */
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { workshopBakeSheet, workshopGridHash } from "@/harnesses/_core/workshop/bakeSheet";
import type { Grid, Palette, WorkshopEnv, WorkshopItem } from "@/harnesses/_core/workshop/types";
import { ATLAS_BIOME_INTERIOR_ID, createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { store } from "@/project/store";
import { bakedWorkshopKit, bakeWorkshopObject, workshopAssetId, workshopObjectId, type WorkshopHandKind } from "@/project/workshopTiles";
import { WORKSHOP_BAKED_EVENT, type WorkshopBakedDetail } from "./workshopEvents";


const TILE = 16;
const KINDS: ReadonlySet<string> = new Set(["floor", "wall", "hang", "flat"]);

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
 * 고른 후보를 칩셋에 굽는다. 되돌리기 한 번으로 뺄 수 있다.
 * autoPicked = 사람이 아니라 사용자가 켠 「알아서 고르기」(조수 요청 카드)가 골랐다 — 설명서에 사람 선택(review.pick)을 적지 않는다.
 */
export function bakeWorkshopPick(item: WorkshopItem, grid: Grid, palette: Palette, env: WorkshopEnv, options: { readonly autoPicked?: boolean } = {}): WorkshopBakedDetail {
  if (!KINDS.has(item.kind)) throw new Error(`이 기물 종류(${item.kind})는 칩셋에 넣을 수 없습니다.`);
  const { sheet, cells, columns, rows } = workshopBakeSheet(grid, palette);
  const dataUrl = env.encodePng(sheet);
  const objectId = workshopObjectId(item.key);
  const tilesetId = workshopTargetTileset(item);
  if (tilesetId !== ATLAS_BIOME_INTERIOR_ID) {
    const target = store.getCurrent().tilesets[tilesetId];
    if (!target) throw new Error(`이 기물을 넣을 칩셋이 프로젝트에 없습니다: ${tilesetId}`);
    if (target.tileSize !== TILE) throw new Error(`공방 그림은 16px 칸이라 ${target.tileSize}px 칩셋에는 넣을 수 없습니다.`);
  }
  recordProjectSnapshot("공방 기물 칩셋에 넣기");
  store.update((draft) => {
    if (tilesetId === ATLAS_BIOME_INTERIOR_ID) {
      if (!draft.tilesets[ATLAS_BIOME_INTERIOR_ID]) draft.tilesets[ATLAS_BIOME_INTERIOR_ID] = createAtlasBiomeInteriorTileset();
      else ensureAtlasBiomeInteriorCurrent(draft, ATLAS_BIOME_INTERIOR_ID);
    }
    bakeWorkshopObject(draft, tilesetId, {
      objectId,
      title: item.title,
      description: item.description,
      kind: item.kind as WorkshopHandKind,
      columns,
      rows,
      footRows: item.footRows ?? 1,
      risePx: item.risePx ?? Math.max(0, (rows - (item.footRows ?? 1)) * TILE - item.padTop),
      use: item.use,
      gridHash: workshopGridHash(grid),
      asset: { id: workshopAssetId(dataUrl), dataUrl, width: sheet.width, height: sheet.height },
      cells,
      // 설명서(ObjectSpec): 공방 판에서 사람이 고른 후보다. 3/4 영수증은 아직 공방 굽기에 배선되지 않았다(object-gate 문서).
      provenance: { aiGenerated: true, tool: `oprn-workshop/${item.tilesetId ? "map-objects" : "interior-props"}${options.autoPicked ? "/auto-pick" : ""}` },
      ...(options.autoPicked ? {} : { review: { pick: { by: "human" as const, at: new Date().toISOString() } } }),
    });
  }, { scope: "project", origin: "human", label: `공방 기물 칩셋에 넣기: ${item.title}` });
  const detail: WorkshopBakedDetail = { objectId, title: item.title, tilesetId, kind: item.kind, columns, rows };
  window.dispatchEvent(new CustomEvent<WorkshopBakedDetail>(WORKSHOP_BAKED_EVENT, { detail }));
  return detail;
}
