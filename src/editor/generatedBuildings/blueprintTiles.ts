/**
 * 확정 그림 → 16px 칸(village_tiles.py 이식). 칸 역할은 실제 설계도가 정한다:
 * X·G = 하위, * · A = 상위(통행), D = 원본 타일(위 칸 검정 doorTop, 아래 칸 문 doorBottom). 같은 그림·같은 레이어 칸은 한 번만 싣는다.
 */
import type { BlueprintFitResult } from "./blueprintFit.ts";
import { createRaster, type Raster } from "./raster.ts";

export type BuildingCell =
  | null
  | { readonly layer: "lower"; readonly orig: "doorTop" | "doorBottom" }
  | { readonly layer: "lower" | "upper"; readonly tile: number; readonly walk: boolean };

export interface SlicedBuilding {
  readonly w: number;
  readonly h: number;
  readonly headExtra: number;
  /** 행 우선 w×h. */
  readonly cells: readonly BuildingCell[];
  readonly doors: BlueprintFitResult["effective"]["doors"];
}

export interface BuildingTileSheet {
  /** 각 16×16 RGBA 조각. 번호 = cells 의 tile. */
  readonly tiles: Uint8ClampedArray[];
  readonly buildings: SlicedBuilding[];
}

/** 여러 채를 한 시트에 모은다(같은 칸은 채끼리도 공유). */
export function sliceBuildingTiles(fits: readonly BlueprintFitResult[], tileSize = 16): BuildingTileSheet {
  const T = tileSize, tiles: Uint8ClampedArray[] = [], index = new Map<string, number>();
  const buildings = fits.map((fit): SlicedBuilding => {
    if (!fit.pass) throw new Error("검사 탈락작은 타일로 싣지 않는다");
    const { map } = fit.effective, H = map.length, W = map[0]!.length, art = fit.art;
    if (art.height !== H * T || art.width !== W * T) throw new Error("그림 크기와 설계도가 다르다");
    const cells: BuildingCell[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const c = map[y]![x]!;
        if (c === ".") { cells.push(null); continue; }
        if (c === "D") { cells.push({ layer: "lower", orig: y + 1 < H && map[y + 1]![x] === "D" ? "doorTop" : "doorBottom" }); continue; }
        const px = new Uint8ClampedArray(T * T * 4);
        let any = false;
        for (let yy = 0; yy < T; yy++) {
          const row = art.data.subarray(((y * T + yy) * art.width + x * T) * 4, ((y * T + yy) * art.width + x * T + T) * 4);
          px.set(row, yy * T * 4);
        }
        for (let i = 3; i < px.length; i += 4) if (px[i]) { any = true; break; }
        if (!any) { cells.push(null); continue; }
        const layer = "*A".includes(c) ? "upper" : "lower";
        const key = `${layer}:${Array.prototype.join.call(px, ",")}`;
        let k = index.get(key);
        if (k === undefined) { k = tiles.length; index.set(key, k); tiles.push(px); }
        cells.push({ layer, tile: k, walk: "*AG".includes(c) });
      }
    }
    return { w: W, h: H, headExtra: fit.effective.headExtra, cells, doors: fit.effective.doors };
  });
  return { tiles, buildings };
}

/** 조각들을 cols 열 시트 한 장으로. */
export function composeTileSheet(tiles: readonly Uint8ClampedArray[], cols = 30, tileSize = 16): Raster {
  const T = tileSize, rows = Math.max(1, Math.ceil(tiles.length / cols));
  const sheet = createRaster(cols * T, rows * T);
  tiles.forEach((px, k) => {
    const ox = (k % cols) * T, oy = Math.floor(k / cols) * T;
    for (let y = 0; y < T; y++) sheet.data.set(px.subarray(y * T * 4, (y + 1) * T * 4), ((oy + y) * sheet.width + ox) * 4);
  });
  return sheet;
}
