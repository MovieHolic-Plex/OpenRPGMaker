/**
 * 실내 맵 → PNG. 에디터 캔버스와 같은 규칙으로 그린다.
 *
 * 왜 따로 있나: `reports/place-concept-inn` 의 옛 보고서는 타일 번호를 시트의 원시 셀로만 환산해
 * 그렸다. 실내 칩셋의 천장(430 계열)·벽면 프레임은 **쿼터 오토타일**이라 에디터는
 * `chipsetQuarterComposition` 으로 이웃을 보고 8px 쿼터 4개를 합성한다. 원시 셀로 그리면 천장이
 * 풀밭 조각처럼 찍혀 판정을 오염시킨다(2026-09-02 실측 — 리드가 본 verdict.png 가 그랬다).
 *
 * `scripts/demo-assistant-interior-build.mts` 의 렌더 루프와 같은 방식이며, 알파 합성과
 * 이벤트 표식 오버레이만 더했다. 순수 Node(pngjs) — 브라우저·Phaser 불필요.
 */
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { RESOURCE_SLICING } from "../../src/assets/resourceSlicing.ts";
import { chipsetQuarterComposition } from "../../src/project/defaults/terrainQuarterAutotile.ts";
import type { GameMap, TilesetDef } from "../../src/project/types.ts";

const SHEET = RESOURCE_SLICING.chipset;
const CELL = SHEET.cellWidth;
const COLS = SHEET.columns ?? 30;
const HALF = CELL / 2;

export const INTERIOR_CHIPSET_PNG = path.resolve("public/assets/easyrpg-chipset-interior-transparent.png");

/** 한 칸을 어떻게 그리나 — 테스트가 렌더 규칙을 잠그는 관측점. */
export type CellDrawPlan =
  | { readonly kind: "empty" }
  | { readonly kind: "raw"; readonly tile: number }
  | {
      readonly kind: "quarters";
      readonly underlayTile: number;
      readonly sources: readonly { readonly tile: number; readonly offsetX: 0 | 8; readonly offsetY: 0 | 8 }[];
    };

type QuarterTileset = Pick<TilesetDef, "autotileGroups" | "image">;

/** 하위 레이어 한 칸의 그리기 계획. 쿼터 합성 대상이면 quarters, 아니면 raw. */
export function lowerCellDrawPlan(map: GameMap, tileset: QuarterTileset, x: number, y: number): CellDrawPlan {
  const tile = map.lowerTiles[y * map.width + x] ?? -1;
  if (tile < 0) return { kind: "empty" };
  const composition = chipsetQuarterComposition(map, tileset, x, y);
  if (composition) {
    return {
      kind: "quarters",
      underlayTile: composition.underlayTile ?? tile,
      sources: composition.sources.map((source) => ({
        tile: source.tile,
        offsetX: source.offsetX,
        offsetY: source.offsetY,
      })),
    };
  }
  return { kind: "raw", tile };
}

export type EventMarker = {
  readonly x: number;
  readonly y: number;
  /** RGB 0..255 */
  readonly color: readonly [number, number, number];
};

export type RenderOptions = {
  readonly scale?: number;
  readonly sheetPath?: string;
  readonly background?: readonly [number, number, number];
  readonly markers?: readonly EventMarker[];
  /** 방 bbox 외곽선(디버그) — [r,g,b] 로 1px 선을 그린다. */
  readonly boxes?: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly color: readonly [number, number, number] }[];
};

let sheetCache: { path: string; png: PNG } | null = null;

function loadSheet(sheetPath: string): PNG {
  if (sheetCache && sheetCache.path === sheetPath) return sheetCache.png;
  const png = PNG.sync.read(fs.readFileSync(sheetPath));
  sheetCache = { path: sheetPath, png };
  return png;
}

/** 맵을 PNG 로 렌더한다(하위 → 상위, 쿼터 합성 포함). */
export function renderInteriorMapPng(map: GameMap, tileset: QuarterTileset, options: RenderOptions = {}): PNG {
  const scale = Math.max(1, Math.floor(options.scale ?? 2));
  const sheet = loadSheet(options.sheetPath ?? INTERIOR_CHIPSET_PNG);
  const [br, bg, bb] = options.background ?? [20, 18, 24];
  const out = new PNG({ width: map.width * CELL * scale, height: map.height * CELL * scale });
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = br;
    out.data[i + 1] = bg;
    out.data[i + 2] = bb;
    out.data[i + 3] = 255;
  }

  const blit = (tile: number, dx: number, dy: number, quarter?: { sx: number; sy: number }): void => {
    if (tile < 0) return;
    const sx0 = (tile % COLS) * CELL + (quarter?.sx ?? 0);
    const sy0 = Math.floor(tile / COLS) * CELL + (quarter?.sy ?? 0);
    const size = quarter ? HALF : CELL;
    for (let y = 0; y < size * scale; y += 1) {
      for (let x = 0; x < size * scale; x += 1) {
        const si = ((sy0 + Math.floor(y / scale)) * sheet.width + (sx0 + Math.floor(x / scale))) * 4;
        const alpha = (sheet.data[si + 3] ?? 0) / 255;
        if (alpha === 0) continue;
        const di = ((dy + y) * out.width + (dx + x)) * 4;
        for (let c = 0; c < 3; c += 1) {
          const src = sheet.data[si + c] ?? 0;
          const dst = out.data[di + c] ?? 0;
          out.data[di + c] = Math.round(src * alpha + dst * (1 - alpha));
        }
        out.data[di + 3] = 255;
      }
    }
  };

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const plan = lowerCellDrawPlan(map, tileset, x, y);
      const dx = x * CELL * scale;
      const dy = y * CELL * scale;
      if (plan.kind === "raw") blit(plan.tile, dx, dy);
      if (plan.kind === "quarters") {
        blit(plan.underlayTile, dx, dy);
        for (const source of plan.sources) {
          blit(source.tile, dx + source.offsetX * scale, dy + source.offsetY * scale, { sx: source.offsetX, sy: source.offsetY });
        }
      }
      const upper = map.upperTiles[y * map.width + x] ?? -1;
      if (upper >= 0) blit(upper, dx, dy);
    }
  }

  const px = (x: number, y: number, color: readonly [number, number, number]): void => {
    if (x < 0 || y < 0 || x >= out.width || y >= out.height) return;
    const i = (y * out.width + x) * 4;
    out.data[i] = color[0];
    out.data[i + 1] = color[1];
    out.data[i + 2] = color[2];
    out.data[i + 3] = 255;
  };

  for (const box of options.boxes ?? []) {
    const x0 = box.x * CELL * scale;
    const y0 = box.y * CELL * scale;
    const x1 = (box.x + box.w) * CELL * scale - 1;
    const y1 = (box.y + box.h) * CELL * scale - 1;
    for (let x = x0; x <= x1; x += 1) {
      px(x, y0, box.color);
      px(x, y1, box.color);
    }
    for (let y = y0; y <= y1; y += 1) {
      px(x0, y, box.color);
      px(x1, y, box.color);
    }
  }

  // 이벤트 표식: 칸의 오른쪽 아래에 작은 사각 + 흰 테두리. 칩 집행(수면·조사·노획·연결)이 어디 붙었는지 보인다.
  for (const marker of options.markers ?? []) {
    const size = Math.max(3, Math.floor((CELL * scale) / 3));
    const x0 = (marker.x + 1) * CELL * scale - size - 1;
    const y0 = (marker.y + 1) * CELL * scale - size - 1;
    for (let y = -1; y <= size; y += 1) {
      for (let x = -1; x <= size; x += 1) {
        const edge = x === -1 || y === -1 || x === size || y === size;
        px(x0 + x, y0 + y, edge ? [255, 255, 255] : marker.color);
      }
    }
  }
  return out;
}

export function pngToDataUrl(png: PNG): string {
  return `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
}

export function writePng(png: PNG, file: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, PNG.sync.write(png));
}
