/**
 * Session placeable overlay graphics (rock/gem charset + tree chipset tile).
 * Kept free of Phaser/scene imports so the asset loader can depend on it safely.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { COMBINED_TOWN_TILESET_TEXTURE_KEY, TILE } from "@/project/defaults/constants";

export type PlaceableOverlayGraphic = {
  readonly texture: string;
  readonly frame: string | number;
};

/** EasyRPG RTP Object2: 5=rock, 6=gem. */
const PLACEABLE_CHARSET: Readonly<Record<string, { readonly texture: string; readonly characterIndex: number }>> = {
  rock: { texture: "tex_easyrpg_charset_object2", characterIndex: 5 },
  gem: { texture: "tex_easyrpg_charset_object2", characterIndex: 6 },
};

/**
 * Combined-town tile 290 (`TILE.TREE`) is a one-cell small tree (canopy + trunk),
 * verified by image inspection of `easyrpg-chipset-combined-town-transparent.png`.
 * Not a rock/gem charset marker.
 */
export const PLACEABLE_TREE_GRAPHIC: PlaceableOverlayGraphic = {
  texture: COMBINED_TOWN_TILESET_TEXTURE_KEY,
  frame: `tile_${TILE.TREE}`,
};

/** Textures the play loader must keep for placeable overlays even without event refs. */
export const PLACEABLE_OVERLAY_TEXTURE_KEYS: readonly string[] = [
  PLACEABLE_CHARSET.rock!.texture,
  PLACEABLE_TREE_GRAPHIC.texture,
];

export function resolvePlaceableOverlayGraphic(kind: string): PlaceableOverlayGraphic | null {
  if (kind === "tree") return PLACEABLE_TREE_GRAPHIC;
  const charset = PLACEABLE_CHARSET[kind];
  if (!charset) return null;
  return {
    texture: charset.texture,
    frame: charsetFrameIndex({ characterIndex: charset.characterIndex, direction: "down", pattern: 1 }),
  };
}
