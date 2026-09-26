import type { TilesetDef, TilesetKind } from "@/project/types";

export const TILESET_KIND_LABELS = {
  rpg2k: "RPG 2000/2003",
  custom: "Custom Tile Chip",
} as const satisfies Record<TilesetKind, string>;

export function tilesetKind(tileset: TilesetDef): TilesetKind {
  if (tileset.kind) return tileset.kind;
  return tileset.image.type === "uploaded" || tileset.count !== 480 ? "custom" : "rpg2k";
}

/** 합본 마을 칩은 숲마을 칩(forest_harmony)이 대신한다. 기존 맵이 쓰므로 목록에는 남기고 표시만 한다. */
const DEPRECATED_TILESET_IDS: ReadonlySet<string> = new Set(["easyrpg_chipset_combined_town"]);

export function isDeprecatedTileset(tileset: Pick<TilesetDef, "id">): boolean {
  return DEPRECATED_TILESET_IDS.has(tileset.id);
}

export function isCustomTileset(tileset: TilesetDef): boolean {
  return tilesetKind(tileset) === "custom";
}

export function groupTilesetsByKind(tilesets: readonly TilesetDef[]): Readonly<Record<TilesetKind, readonly TilesetDef[]>> {
  const groups: Record<TilesetKind, TilesetDef[]> = { rpg2k: [], custom: [] };
  for (const tileset of tilesets) groups[tilesetKind(tileset)].push(tileset);
  return groups;
}
