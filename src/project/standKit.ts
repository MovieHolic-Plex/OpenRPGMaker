// 숲 구성의 «다른 개체» 나무 — 같은 수종·같은 크기의 둘째·셋째 그림을 찍는 자리마다 골라 쓴다(표·까닭은 assets/tilesetStands.ts).
//
// 왜(오너 2026-11-13 «나무랑 땅 타일도 좀 다양하게 … 특히 숲쪽»): 숲 구성은 나무 킷 칸마다 수종 그림 한 장을 덮는다 — 한 맵에 같은 그림이
// 열 번씩 섰다. 변형 그림은 킷 칸에 덮지 않고 «그 킷의 다른 그림» 으로 찍는다: 킷 id·이름·칸 크기·통행은 그대로, 칸 번호만 숲 그림판 이식 칸이다
// (집 벌 project/houseSetKit.ts 와 같은 방식). 도구는 project/houseSetTiles.ts 의 표로 변형 칸을 원본 킷의 같은 자리 칸으로 되읽는다.
import { tilesetStandTableFor, type TilesetStandTable } from "@/assets/tilesetStands";
import { translateTiles } from "./objectStamp";
import type { StructureKitDef, TilesetDef } from "./types";

const tileAt = (kit: StructureKitDef, x: number, y: number): number => {
  const row = kit.rows[y];
  const upper = row?.upperTiles?.[x] ?? -1;
  return upper >= 0 ? upper : row?.tiles?.[x] ?? -1;
};

/** 그 숲 구성에서 이 킷이 가진 그림 수(원본 포함) — 변형이 없으면 1. */
export function standKitPictures(tilesetId: string, stand: string | undefined, kitId: string): number {
  return 1 + ((stand ? tilesetStandTableFor(tilesetId)?.stands[stand]?.variants?.[kitId]?.length : 0) ?? 0);
}

function variantSource(tileset: TilesetDef, table: TilesetStandTable, kit: StructureKitDef, rows: readonly (readonly number[])[]): { source: TilesetDef; wanted: number[] } {
  // 숲 그림판을 «원본 칸의 통행·위아래·이름표를 든 타일셋» 으로 본다 — translateTiles 가 새 이식 칸에 그 값을 옮긴다.
  const source: TilesetDef = {
    id: `${tileset.id}#stands`, name: table.texture, image: { type: "bundled", id: table.texture }, tileSize: table.tileSize, tilesPerRow: table.tilesPerRow, count: table.count,
    passability: [], priority: [], terrain: [], tileMeta: [],
  };
  const wanted: number[] = [];
  for (let y = 0; y < kit.height; y += 1) for (let x = 0; x < kit.width; x += 1) {
    const cell = rows[y]?.[x] ?? -1, base = tileAt(kit, x, y);
    if (cell < 0 || base < 0) continue;
    source.passability[cell] = tileset.passability[base]!;
    source.priority[cell] = tileset.priority[base]!;
    source.terrain[cell] = tileset.terrain[base] ?? 0;
    source.tileMeta![cell] = tileset.tileMeta?.[base] ?? { label: "", description: "" };
    wanted.push(cell);
  }
  return { source, wanted };
}

/**
 * 그 숲 구성에서 이 나무 킷의 pick 번째 그림으로 바꾼 킷. pick % 그림 수 가 0 이면(원본 자리) undefined — 원본 킷 그대로 찍는다.
 * 변형 그림이 비운 칸은 비우고(-1), 원본 킷이 비운 칸에는 그림을 두지 않는다. 숲 구성이 없거나 변형이 없는 킷도 undefined.
 */
export function standVariantKit(tileset: TilesetDef, kit: StructureKitDef, stand: string | undefined, pick: number): StructureKitDef | undefined {
  const table = tilesetStandTableFor(tileset.id);
  const variants = stand ? table?.stands[stand]?.variants?.[kit.id] : undefined;
  if (!table || !variants?.length || tileset.image.type !== "bundled" || tileset.image.id !== table.image || tileset.tileSize !== table.tileSize) return undefined;
  const index = (pick >>> 0) % (variants.length + 1);
  if (index === 0) return undefined;
  const rows = variants[index - 1]!;
  if (rows.length !== kit.height || rows.some((row) => row.length !== kit.width)) return undefined;
  const { source, wanted } = variantSource(tileset, table, kit, rows);
  const map = translateTiles(source, tileset, wanted).map;
  const swap = (base: number, cell: number): number => (base < 0 ? base : cell < 0 ? -1 : map.get(cell) ?? base);
  return {
    ...kit,
    rows: kit.rows.map((row, y) => ({
      ...row,
      tiles: row.tiles.map((tile, x) => ((row.upperTiles?.[x] ?? -1) >= 0 ? tile : swap(tile, rows[y]![x]!))),
      ...(row.upperTiles ? { upperTiles: row.upperTiles.map((tile, x) => swap(tile, rows[y]![x]!)) } : {}),
    })),
  };
}

/** 킷의 칸 번호를 행 우선 한 줄로(위층 칸이 있으면 그것) — 나무 composer 의 그림 정의가 쓴다. */
export function kitTilesFlat(kit: StructureKitDef): number[] {
  const out: number[] = [];
  for (let y = 0; y < kit.height; y += 1) for (let x = 0; x < kit.width; x += 1) out.push(tileAt(kit, x, y));
  return out;
}
