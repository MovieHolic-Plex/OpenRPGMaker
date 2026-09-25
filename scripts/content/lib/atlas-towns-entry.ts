// Bundled by scripts/content/author-atlas-towns.mjs / save-atlas-towns.mjs: tilesets, painters, the runtime move rule and
// the gable-house composer (editor/gableHouseCompose) so the atlas towns can build many house shapes from the kits.
export { createBlankProject } from "@/project/defaults";
export { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
export { createClimateVillageTileset } from "@/project/defaults/climateVillages";
export { canMove } from "@/project/collision";
export { paintContouredForest, forestContourScore, shadeForestCanopy } from "@/editor/tools/village/forestContour";
export { computeReachableCells, isAdjacentOrOn } from "@/project/lint/reachability";
export { composeGableHouseForm, auditGableHouseForm, GABLE_HOUSE_FORM_SPECS } from "@/editor/gableHouseCompose";
export { ALL_HOUSE_KIT_IDS, MIXABLE_HOUSE_KIT_IDS } from "@/editor/houseKit";
export { HOUSE_PART_TILE, downgradeHouseParts } from "@/project/defaults/forestHarmonyHouseParts";
export { HOUSE_DOOR_BACKGROUND_TILE } from "@/editor/houseInteriors";
