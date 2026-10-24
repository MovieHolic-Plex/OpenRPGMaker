/**
 * Session placeable overlay graphics (rock/gem charset + tree image).
 * Kept free of Phaser/scene imports so the asset loader can depend on it safely.
 */
import { charsetFrameIndex } from "@/assets/easyrpgRtp";

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
 * Choppable tree: one whole Beodeul warm tree (hand-drawn, 64x80, trunk base on row 61).
 * The old one-cell tree came from the EasyRPG combined-town chipset, deleted on 2026-10-07.
 * `PLACEABLE_TREE_FRAME` crops the empty rows under the trunk so `setOrigin(0.5, 1)` stands it on its tile.
 */
export const PLACEABLE_TREE_TEXTURE_KEY = "tex_placeable_tree";
export const PLACEABLE_TREE_FRAME = { name: "placeable", x: 0, y: 0, width: 64, height: 62 } as const;

export const PLACEABLE_OVERLAY_IMAGE_ASSETS: readonly { readonly textureKey: string; readonly path: string; readonly name: string }[] = [
  { textureKey: PLACEABLE_TREE_TEXTURE_KEY, path: "assets/beodeul-warm-trees/tree-03a8f7.png", name: "버들항 · 베어 낼 수 있는 나무" },
];

export const PLACEABLE_TREE_GRAPHIC: PlaceableOverlayGraphic = {
  texture: PLACEABLE_TREE_TEXTURE_KEY,
  frame: PLACEABLE_TREE_FRAME.name,
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
