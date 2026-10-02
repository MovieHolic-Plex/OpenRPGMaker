// src/harnesses/interior-props/editor/items.ts
/**
 * 기물 사전: 번들 handInteriorSpec.json(414종) + 사용자가 공방에서 정의한 새 기물.
 * 지금 그림은 시트(public/assets/atlas-interior/interior-chipset.png, 16px · 48칸 폭)에서 cells 대로 잘라 붙인다.
 */
import spec from "@/assets/handInteriorSpec.json";
import type { ItemDefinition, RgbaImage, WorkshopItem } from "@/harnesses/_core/workshop/types";
import { opaqueBounds } from "@/harnesses/_core/workshop/grid";
import viewFail from "./viewFail.json";

export const SHEET_PATH = "assets/atlas-interior/interior-chipset.png";
export const TILE = 16;
export const SHEET_COLUMNS = 48;
/** 벽면 걸이·바닥 무늬 — 평평한 게 정상이라 가구의 기준 그림으로 주면 정면도를 배운다(투구 선반 h49) */
export const FLAT_KINDS: ReadonlySet<string> = new Set(["hang", "flat"]);
export const KIND_LABELS: Readonly<Record<string, string>> = { floor: "바닥 기물", wall: "북쪽 벽 앞 기물", hang: "벽면 걸이", flat: "바닥 무늬" };
/** 2026-10-01 3/4 전수조사에서 위반으로 나왔고 아직 v5 원본 그대로인 기물 — 기준 그림에서 뺀다 */
export const VIEW_FAIL: ReadonlySet<string> = new Set(viewFail.keys);

export type SpecObject = {
  ko: string; category: string; category_ko: string; kind: string; w: number; h: number; up: number;
  cells: [number, number, number, number][]; desc: string; tags: string[]; place: string; pair: string[]; use: string[];
};

export function specObjects(): [string, SpecObject][] {
  return Object.entries((spec as unknown as { objects: Record<string, SpecObject> }).objects);
}

export function cropCells(sheet: RgbaImage, cells: SpecObject["cells"]): RgbaImage {
  const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys);
  const width = (Math.max(...xs) - x0 + 1) * TILE, height = (Math.max(...ys) - y0 + 1) * TILE;
  const data = new Uint8ClampedArray(width * height * 4);
  const columns = Math.floor(sheet.width / TILE);
  for (const [dx, dy, tile] of cells) {
    const sx = (tile % columns) * TILE, sy = Math.floor(tile / columns) * TILE;
    const ox = (dx - x0) * TILE, oy = (dy - y0) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const from = ((sy + y) * sheet.width + sx + x) * 4;
        const alpha = sheet.data[from + 3];
        if (alpha === 0) continue;
        const to = ((oy + y) * width + ox + x) * 4;
        // 겹친 칸(층)은 뒤에 온 것이 위다. 빈 자리엔 원본 RGBA 를 그대로 둔다(반투명 그림자 색 보존),
        // 이미 그려진 자리엔 표준 source-over 합성.
        const backAlpha = data[to + 3];
        if (backAlpha === 0) {
          for (let c = 0; c < 4; c++) data[to + c] = sheet.data[from + c];
          continue;
        }
        const as = alpha / 255, ad = backAlpha / 255, out = as + ad * (1 - as);
        for (let c = 0; c < 3; c++) data[to + c] = Math.round((sheet.data[from + c] * as + data[to + c] * ad * (1 - as)) / out);
        data[to + 3] = Math.round(out * 255);
      }
    }
  }
  return { width, height, data };
}

export function itemFromSpec(key: string, object: SpecObject, current: RgbaImage | null): WorkshopItem {
  const xs = object.cells.map((c) => c[0]), ys = object.cells.map((c) => c[1]);
  const bounds = current ? opaqueBounds(current) : null;
  return {
    key, title: object.ko, description: object.desc, kind: object.kind, category: object.category_ko,
    width: (Math.max(...xs) - Math.min(...xs) + 1) * TILE,
    height: (Math.max(...ys) - Math.min(...ys) + 1) * TILE,
    padTop: bounds ? bounds.y0 : 0,
    isNew: false, refs: [], use: object.use,
  };
}

export function itemFromDefinition(def: ItemDefinition): WorkshopItem {
  const drawn = def.tilesH * TILE + def.rise;
  const height = Math.ceil(drawn / TILE) * TILE;
  return {
    key: def.key, title: def.title, description: def.description, kind: def.kind, category: def.category,
    width: def.tilesW * TILE, height, padTop: height - drawn, isNew: true, refs: def.refs, use: def.use,
  };
}

export function newItemKey(title: string, taken: ReadonlySet<string>): string {
  const base = `new:${title.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "") || "item"}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
}
