// Bundled by save-joseon-baram.mjs: blank project + bundled tilesets + engine passability/autotile helpers.
export { createBlankProject } from "@/project/defaults";
export { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
export { createJoseonBaramTileset, JOSEON_BARAM_ID } from "@/project/defaults/joseonBaram";
export { charsetFrameIndex } from "@/assets/easyrpgRtp";
export { isPassable, canMove } from "@/project/collision";
export { autotileVariantForCell, autotileLayerView } from "@/project/defaults/autotileEngine";
export { tilesetFamily } from "@/project/tilesetFamily";
export { passageMarkForTile } from "@/project/tilesetPassage";
export { validateTilesetReferences } from "@/project/tilesetReferences";
export { isBundledReferenceImage } from "@/project/bundledReferenceImagePath";
