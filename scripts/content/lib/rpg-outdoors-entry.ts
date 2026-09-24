// Bundled by author-rpg-outdoors.mjs / save-rpg-outdoors.mjs: tilesets, painters and the runtime move rule.
export { createBlankProject } from "@/project/defaults";
export { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
export { createClimateVillageTileset } from "@/project/defaults/climateVillages";
export { canMove } from "@/project/collision";
export { paintContouredForest, forestContourScore, shadeForestCanopy } from "@/editor/tools/village/forestContour";
export { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
