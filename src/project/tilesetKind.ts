import type { TilesetDef, TilesetKind } from "@/project/types";

export const TILESET_KIND_LABELS = {
  rpg2k: "RPG 2000/2003",
  custom: "Custom Tile Chip",
} as const satisfies Record<TilesetKind, string>;

export function tilesetKind(tileset: TilesetDef): TilesetKind {
  if (tileset.kind) return tileset.kind;
  return tileset.image.type === "uploaded" || tileset.count !== 480 ? "custom" : "rpg2k";
}

export function isCustomTileset(tileset: TilesetDef): boolean {
  return tilesetKind(tileset) === "custom";
}

export function groupTilesetsByKind(tilesets: readonly TilesetDef[]): Readonly<Record<TilesetKind, readonly TilesetDef[]>> {
  const groups: Record<TilesetKind, TilesetDef[]> = { rpg2k: [], custom: [] };
  for (const tileset of tilesets) groups[tilesetKind(tileset)].push(tileset);
  return groups;
}
