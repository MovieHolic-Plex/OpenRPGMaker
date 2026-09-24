import data from "@/assets/dungeonSheetTilesets.json";
import type { AssetRef, PassFlag, Project, TileAiMetadata, TileGraft, TilesetDef, TilesetId } from "../types";

// 던전 재칠 시트 타일셋 oprn_dungeon_cave·stone·desert·sea·lair. 던전 장소 문서가 이 id 로 그렸지만 새 프로젝트에는 없다 —
// 쓰려는 순간(create_map·set_map_properties·던전 파이프라인·import_region_reference) 프로젝트의 easyrpg_chipset_dungeon 을
// 바탕으로 만들어 넣는다. 칸 번호는 원본 던전 칩셋과 같다. 원본: scripts/content/extract-dungeon-sheet-tilesets.mjs.

type Cell = { passability: PassFlag; priority: "lower" | "upper"; terrain: number; tileMeta?: TileAiMetadata };
type Sheet = { id: string; name: string; image: AssetRef; count: number; tileGrafts: TileGraft[]; overrides: Record<string, Cell>; tail: Cell[] };
const DATA = data as unknown as { sheets: Record<string, Sheet>; common: { passability: PassFlag[]; priority: ("lower" | "upper")[]; terrain: number[] } };
const BASE_ID = "easyrpg_chipset_dungeon";

export const DUNGEON_SHEET_TILESET_IDS: readonly string[] = Object.keys(DATA.sheets);

export function isDungeonSheetTilesetId(id: string): boolean {
  return Object.hasOwn(DATA.sheets, id);
}

function setCell(tileset: TilesetDef, tile: number, cell: Cell): void {
  tileset.passability[tile] = structuredClone(cell.passability);
  tileset.priority[tile] = cell.priority;
  tileset.terrain[tile] = cell.terrain;
  if (cell.tileMeta) (tileset.tileMeta ??= [])[tile] = structuredClone(cell.tileMeta);
}

/** Add oprn_dungeon_<theme> to the project when it is missing. Returns whether it was added. */
export function ensureDungeonSheetTileset(project: Pick<Project, "tilesets">, id: string): boolean {
  const sheet = DATA.sheets[id];
  const base = project.tilesets[BASE_ID];
  if (!sheet || project.tilesets[id] || !base) return false;
  const tileset: TilesetDef = { ...structuredClone(base), id: id as TilesetId, name: sheet.name, image: structuredClone(sheet.image), count: sheet.count };
  // The dungeon place documents live on the stock dungeon chipset; the repaint shares them instead of copying ~800KB.
  delete tileset.referenceDocuments;
  tileset.referenceSourceTilesetId = BASE_ID;
  tileset.passability = tileset.passability.slice(0, 480);
  tileset.priority = tileset.priority.slice(0, 480);
  tileset.terrain = tileset.terrain.slice(0, 480);
  tileset.tileMeta = (tileset.tileMeta ?? []).slice(0, 480);
  for (let tile = 0; tile < 480; tile += 1) {
    setCell(tileset, tile, { passability: DATA.common.passability[tile]!, priority: DATA.common.priority[tile]!, terrain: DATA.common.terrain[tile]! });
  }
  for (const [tile, cell] of Object.entries(sheet.overrides)) setCell(tileset, Number(tile), cell);
  sheet.tail.forEach((cell, i) => setCell(tileset, 480 + i, { ...cell, tileMeta: cell.tileMeta ?? { label: "", description: "" } }));
  tileset.tileGrafts = [...(base.tileGrafts ?? []).filter(graft => graft.targetTile < 480), ...structuredClone(sheet.tileGrafts)];
  project.tilesets[id] = tileset;
  return true;
}

/**
 * Tilesets the place documents name but a new project may lack, made on first use. Returns true when `id` now exists.
 * (forest_harmony's shared tail slots are ensured on load: defaults/forestHarmonyExtension.ts.)
 */
export function ensureDocumentedTileset(project: Pick<Project, "tilesets">, id: string): boolean {
  if (project.tilesets[id]) return true;
  return ensureDungeonSheetTileset(project, id);
}
