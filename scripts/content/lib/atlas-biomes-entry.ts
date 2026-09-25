// Bundled by author-atlas-biomes.mjs / save-atlas-biomes.mjs: the outdoor builder's api plus the atlas biome tilesets.
export { createBlankProject } from "@/project/defaults";
export { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
export { createClimateVillageTileset } from "@/project/defaults/climateVillages";
export { createAtlasBiomeTileset } from "@/project/defaults/atlasBiomes";
export { canMove } from "@/project/collision";
export { paintContouredForest, forestContourScore, shadeForestCanopy } from "@/editor/tools/village/forestContour";
export { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
