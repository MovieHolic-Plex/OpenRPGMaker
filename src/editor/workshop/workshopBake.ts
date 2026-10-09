// src/editor/workshop/workshopBake.ts
/**
 * 공방 2단계 — 고른 후보를 칩셋에 굽는다: 실내 기물은 손 도트 실내(atlas_biome_interior), 맵 기물은 정의할 때 적은 그 맵 칩셋.
 * 격자를 16px 칸으로 잘라(빈 칸은 뺀다) 30칸 폭 시트 PNG 한 장을 만들고, 굽기 자체는 project/workshopTiles.ts 가 한다.
 * 다 구우면 window 에 WORKSHOP_BAKED_EVENT 를 낸다 — 조수의 「없는 타일」 카드(aiStoreCard.ts)가 듣고 후속 요청을 보낸다.
 */
import { bundledChipsetTilesPerRow } from "@/assets/bundledChipsetGeometry";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { renderGrid } from "@/harnesses/_core/workshop/grid";
import type { Grid, Palette, RgbaImage, WorkshopEnv, WorkshopItem } from "@/harnesses/_core/workshop/types";
import { ATLAS_BIOME_INTERIOR_ID, createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { store } from "@/project/store";
import { bakedWorkshopKit, bakeWorkshopObject, workshopAssetId, workshopObjectId, type WorkshopHandKind } from "@/project/workshopTiles";
import { WORKSHOP_BAKED_EVENT, type WorkshopBakedDetail } from "./workshopEvents";


const TILE = 16;
const KINDS: ReadonlySet<string> = new Set(["floor", "wall", "hang", "flat"]);

export function workshopGridHash(grid: Grid): string {
  const text = `${grid.width}x${grid.height}|${grid.cells.map((cell) => cell ?? "").join(",")}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** 구워 넣을 칩셋: 맵 기물은 정의할 때 적은 칩셋, 실내 기물은 손 도트 실내. */
export function workshopTargetTileset(item: WorkshopItem): string {
  return item.tilesetId ?? ATLAS_BIOME_INTERIOR_ID;
}

/** 이 후보 그림이 지금 프로젝트 칩셋에 이미 들어갔는가. */
export function isWorkshopPickBaked(item: WorkshopItem, grid: Grid): boolean {
  return bakedWorkshopKit(store.getCurrent().tilesets[workshopTargetTileset(item)], workshopObjectId(item.key), workshopGridHash(grid)) !== undefined;
}

/** 그림을 16px 칸으로 자른다. 완전히 투명한 칸은 뺀다. */
function sliceTiles(image: RgbaImage): { dx: number; dy: number; pixels: Uint8ClampedArray }[] {
  const columns = Math.ceil(image.width / TILE), rows = Math.ceil(image.height / TILE);
  const out: { dx: number; dy: number; pixels: Uint8ClampedArray }[] = [];
  for (let dy = 0; dy < rows; dy++) {
    for (let dx = 0; dx < columns; dx++) {
      const pixels = new Uint8ClampedArray(TILE * TILE * 4);
      let any = false;
      for (let y = 0; y < TILE; y++) {
        const sy = dy * TILE + y;
        if (sy >= image.height) break;
        for (let x = 0; x < TILE; x++) {
          const sx = dx * TILE + x;
          if (sx >= image.width) break;
          const from = (sy * image.width + sx) * 4;
          if (image.data[from + 3] === 0) continue;
          any = true;
          pixels.set(image.data.subarray(from, from + 4), (y * TILE + x) * 4);
        }
      }
      if (any) out.push({ dx, dy, pixels });
    }
  }
  return out;
}

/** 고른 후보를 칩셋에 굽는다. 되돌리기 한 번으로 뺄 수 있다. */
export function bakeWorkshopPick(item: WorkshopItem, grid: Grid, palette: Palette, env: WorkshopEnv): WorkshopBakedDetail {
  if (!KINDS.has(item.kind)) throw new Error(`이 기물 종류(${item.kind})는 칩셋에 넣을 수 없습니다.`);
  const image = renderGrid(grid, palette);
  const tiles = sliceTiles(image);
  if (!tiles.length) throw new Error("그림이 비어 있습니다.");
  const columns = Math.ceil(image.width / TILE), rows = Math.ceil(image.height / TILE);
  // 이식 소스 시트의 칸 폭은 업로드 자산 기본값(bundledChipsetTilesPerRow 의 마지막 줄)을 따른다 — 렌더러가 같은 값으로 자른다
  const perRow = bundledChipsetTilesPerRow("workshop_");
  const sheet: RgbaImage = { width: perRow * TILE, height: Math.ceil(tiles.length / perRow) * TILE, data: new Uint8ClampedArray(perRow * TILE * Math.ceil(tiles.length / perRow) * TILE * 4) };
  tiles.forEach((tile, k) => {
    const ox = (k % perRow) * TILE, oy = Math.floor(k / perRow) * TILE;
    for (let y = 0; y < TILE; y++) sheet.data.set(tile.pixels.subarray(y * TILE * 4, (y + 1) * TILE * 4), ((oy + y) * sheet.width + ox) * 4);
  });
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
      cells: tiles.map((tile, k) => ({ sourceTile: k, dx: tile.dx, dy: tile.dy })),
    });
  }, { scope: "project", origin: "human", label: `공방 기물 칩셋에 넣기: ${item.title}` });
  const detail: WorkshopBakedDetail = { objectId, title: item.title, tilesetId, kind: item.kind, columns, rows };
  window.dispatchEvent(new CustomEvent<WorkshopBakedDetail>(WORKSHOP_BAKED_EVENT, { detail }));
  return detail;
}
