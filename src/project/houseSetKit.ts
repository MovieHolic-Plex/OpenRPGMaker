// 집 벌 갈아 끼우기 — 원본 건물 킷을 그 게임의 벌 그림으로 바꾼 킷을 만든다(표·까닭은 assets/houseSets.ts).
import { houseSetTableFor } from "@/assets/houseSets";
import { translateTiles } from "./objectStamp";
export { houseSetBaseTiles } from "./houseSetTiles";
import type { StructureKitDef, TilesetDef } from "./types";

const tileAt = (kit: StructureKitDef, x: number, y: number): number => {
  const row = kit.rows[y];
  const upper = row?.upperTiles?.[x] ?? -1;
  return upper >= 0 ? upper : row?.tiles?.[x] ?? -1;
};

/**
 * 원본 킷을 그 벌의 그림(변형 pick 번째)으로 바꾼 킷(id·이름·부품·칸 크기 그대로, 칸 번호만 다르다). 덮지 않는 킷·다른 그림판의 사본이면 undefined.
 * 벌 그림 칸은 타일셋에 이식 칸으로 붙고(이미 붙은 그림은 다시 쓴다), 통행·위아래·지형·이름표는 원본 킷의 같은 자리 칸 것을 옮긴다.
 */
export function houseSetKit(tileset: TilesetDef, kit: StructureKitDef, set: string, pick = 0): StructureKitDef | undefined {
  const table = houseSetTableFor(tileset.id);
  const variants = table?.sets[set]?.kits[kit.id];
  // 같은 벌 안 변형: pick(게임 열쇠 + 킷 + 찍는 자리의 해시)으로 한 장 — 그 집은 다시 지어도 같은 그림이다.
  const rows = variants?.length ? variants[pick % variants.length] : undefined;
  if (!table || !rows || tileset.image.type !== "bundled" || tileset.image.id !== table.image || tileset.tileSize !== table.tileSize) return undefined;
  if (rows.length !== kit.height || rows.some((row) => row.length !== kit.width)) return undefined;
  // 벌 그림판을 «원본 칸의 통행을 든 타일셋» 으로 본다 — translateTiles 가 새 이식 칸에 그 값을 옮긴다.
  const source: TilesetDef = {
    id: `${tileset.id}#houses`, name: table.texture, image: { type: "bundled", id: table.texture }, tileSize: table.tileSize, tilesPerRow: table.tilesPerRow, count: table.count,
    passability: [], priority: [], terrain: [], tileMeta: [],
  };
  const wanted: number[] = [];
  for (let y = 0; y < kit.height; y += 1) for (let x = 0; x < kit.width; x += 1) {
    const cell = rows[y]![x]!;
    const base = tileAt(kit, x, y);
    if (cell < 0 || base < 0) continue;
    source.passability[cell] = tileset.passability[base]!;
    source.priority[cell] = tileset.priority[base]!;
    source.terrain[cell] = tileset.terrain[base] ?? 0;
    source.tileMeta![cell] = tileset.tileMeta?.[base] ?? { label: "", description: "" };
    wanted.push(cell);
  }
  const map = translateTiles(source, tileset, wanted).map;
  const swap = (base: number, cell: number): number => (base < 0 || cell === -2 ? base : cell < 0 ? -1 : map.get(cell) ?? base);
  return {
    ...kit,
    rows: kit.rows.map((row, y) => ({
      ...row,
      tiles: row.tiles.map((tile, x) => ((row.upperTiles?.[x] ?? -1) >= 0 ? tile : swap(tile, rows[y]![x]!))),
      ...(row.upperTiles ? { upperTiles: row.upperTiles.map((tile, x) => swap(tile, rows[y]![x]!)) } : {}),
    })),
  };
}
