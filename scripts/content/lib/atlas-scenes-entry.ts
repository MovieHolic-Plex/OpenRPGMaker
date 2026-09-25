// Bundled by author-atlas-scenes.mjs / save-atlas-scenes.mjs: default tilesets (incl. the vehicles sheet), the outdoor
// painters the OutdoorMap builder calls, the interior shell grammar (ship cabins) and the runtime move rule.
export { createBlankProject } from "@/project/defaults";
export { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
export { createClimateVillageTileset } from "@/project/defaults/climateVillages";
export { canMove } from "@/project/collision";
export { paintContouredForest, forestContourScore, shadeForestCanopy } from "@/editor/tools/village/forestContour";
export { applyInteriorRoomLayer, createEmptyRoomMap, retintHouseWallFace } from "@/editor/interiorRoomPipeline";
