import extension from "@/assets/forestHarmonyVillageExtension.json";
import type { AutotileGroup, PassFlag, StructureKitDef, TileAiMetadata, TileGraft, TileGroupMetadata, TilesetDef } from "../types";

// 숲마을 시트(2550칸) 뒤의 공용 이식 칸 2550~2759 — 굽이숲 수관·절벽·계단·폭포·다리·배·말뚝·생활 소품·판타지 폐성 조각.
// 등록 장소와 참고문서가 이 번호를 쓰는데 새 프로젝트의 forest_harmony 는 2550칸에서 끝나, 조수가 문서대로 칠하면 「범위 밖」이
// 났다(2026-09-25 조수 시험). 원본: scripts/content/extract-forest-harmony-extension.mjs → src/assets/forestHarmonyVillageExtension.json.

type ExtensionSlot = { passability: PassFlag; priority: "lower" | "upper"; terrain: number; tileMeta: TileAiMetadata };
const EXT = extension as unknown as {
  start: number; count: number; grafts: TileGraft[]; slots: ExtensionSlot[];
  autotileGroups: AutotileGroup[]; tileGroups: TileGroupMetadata[]; structureKits: StructureKitDef[];
};

export const FOREST_HARMONY_EXTENSION_COUNT = EXT.count;

const sameGraft = (a: TileGraft, b: TileGraft) => a.sourceChipset === b.sourceChipset && a.sourceTile === b.sourceTile;

function appendMissing<T extends { id: string }>(target: T[] | undefined, source: readonly T[]): T[] {
  const ids = new Set((target ?? []).map(entry => entry.id));
  return [...(target ?? []), ...structuredClone(source.filter(entry => !ids.has(entry.id)))];
}

/**
 * Grow the bundled forest_harmony to the shared tail slots. Only slots past the tileset's end, or blank slots (past the
 * 2550-cell sheet, no graft) are written; a project that already put other grafts there (generated buildings, its own
 * extension) is left alone. Returns whether anything changed.
 */
export function ensureForestHarmonyVillageSlots(tileset: TilesetDef): boolean {
  if (tileset.id !== "forest_harmony" || tileset.image.type !== "bundled" || tileset.image.id !== "tex_forest_harmony"
    || tileset.tileSize !== 16 || tileset.tilesPerRow !== 30) return false;
  const wanted = new Map(EXT.grafts.map(graft => [graft.targetTile, graft]));
  const own = new Map((tileset.tileGrafts ?? []).filter(graft => graft.targetTile >= EXT.start).map(graft => [graft.targetTile, graft]));
  for (const [tile, graft] of own) {
    const expected = wanted.get(tile);
    if (!expected || !sameGraft(expected, graft)) return false;
  }
  const missing = EXT.grafts.filter(graft => !own.has(graft.targetTile));
  if (missing.length === 0 && tileset.count >= EXT.count) return false;
  const oldCount = tileset.count;
  tileset.tileMeta ??= [];
  for (let tile = EXT.start; tile < EXT.count; tile += 1) {
    // Existing slots keep their (possibly user-edited) rules unless they are the blank slot a missing graft fills.
    if (tile < oldCount && !(wanted.has(tile) && !own.has(tile))) continue;
    const slot = EXT.slots[tile - EXT.start]!;
    tileset.passability[tile] = structuredClone(slot.passability);
    tileset.priority[tile] = slot.priority;
    tileset.terrain[tile] = slot.terrain;
    tileset.tileMeta[tile] = structuredClone(slot.tileMeta);
  }
  tileset.count = Math.max(oldCount, EXT.count);
  tileset.tileGrafts = [...(tileset.tileGrafts ?? []), ...structuredClone(missing)];
  tileset.autotileGroups = appendMissing(tileset.autotileGroups, EXT.autotileGroups);
  tileset.tileGroups = appendMissing(tileset.tileGroups, EXT.tileGroups);
  tileset.structureKits = appendMissing(tileset.structureKits, EXT.structureKits);
  return true;
}
