import { DEFAULT_TILES_PER_ROW, TILE } from "./constants";
import { CHIPSET_ANIMATION_FRAME_TILES } from "./chipsetAnimation";

// allow: SIZE_OK - central descriptor table for the 480-cell EasyRPG exterior atlas.

type TileRect = {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
};

export type ChipsetTileLayer = "lower" | "upper";
export type ChipsetTilePassage = "passable" | "solid";
export type ChipsetTileRepeatRole = "body" | "variant" | "detail" | "edge" | "object" | "single";
export type ChipsetTileUsage = "terrain" | "path" | "edge" | "detail" | "structure" | "decoration" | "empty" | "unknown";

export type ChipsetTileDescriptor = {
  readonly index: number;
  readonly column: number;
  readonly row: number;
  readonly key: string;
  readonly label: string;
  readonly description: string;
  readonly aiLabel: string;
  readonly usage: ChipsetTileUsage;
  readonly tags: readonly string[];
  readonly layer: ChipsetTileLayer;
  readonly passage: ChipsetTilePassage;
  readonly terrainTag: number;
  readonly repeatRole: ChipsetTileRepeatRole;
  readonly confirmed: boolean;
};

type TileSemantic = Pick<ChipsetTileDescriptor, "key" | "label" | "aiLabel" | "usage" | "tags">;

export const TERRAIN_TAG = {
  NORMAL: 0,
  WATER: 1,
  SAND: 2,
  SNOW: 3,
  STONE: 4,
} as const;

export const DIRT_ROAD_TILE = {
  BODY: 421,
  BODY_ALT: TILE.PATH,
  EDGE_NORTH: 391,
  EDGE_SOUTH: 451,
  EDGE_WEST: 420,
  EDGE_EAST: 422,
  CORNER_NORTH_WEST: 390,
  CORNER_NORTH_EAST: 392,
  CORNER_SOUTH_WEST: 450,
  CORNER_SOUTH_EAST: 452,
} as const;

const DIRT_ROAD_SIDE_EDGES = [
  DIRT_ROAD_TILE.EDGE_NORTH,
  DIRT_ROAD_TILE.EDGE_SOUTH,
  DIRT_ROAD_TILE.EDGE_WEST,
  DIRT_ROAD_TILE.EDGE_EAST,
] as const;

const DIRT_ROAD_CORNERS = [
  DIRT_ROAD_TILE.CORNER_NORTH_WEST,
  DIRT_ROAD_TILE.CORNER_NORTH_EAST,
  DIRT_ROAD_TILE.CORNER_SOUTH_WEST,
  DIRT_ROAD_TILE.CORNER_SOUTH_EAST,
] as const;

export const SAND_TILE = {
  BODY: 424,
  EDGE_NORTH: 394,
  EDGE_SOUTH: 454,
  EDGE_WEST: 423,
  EDGE_EAST: 425,
  CORNER_NORTH_WEST: 393,
  CORNER_NORTH_EAST: 395,
  CORNER_SOUTH_WEST: 453,
  CORNER_SOUTH_EAST: 455,
} as const;

const SAND_SIDE_EDGES = [
  SAND_TILE.EDGE_NORTH,
  SAND_TILE.EDGE_SOUTH,
  SAND_TILE.EDGE_WEST,
  SAND_TILE.EDGE_EAST,
] as const;

const SAND_CORNERS = [
  SAND_TILE.CORNER_NORTH_WEST,
  SAND_TILE.CORNER_NORTH_EAST,
  SAND_TILE.CORNER_SOUTH_WEST,
  SAND_TILE.CORNER_SOUTH_EAST,
] as const;

const LAKE_WATER_BODY_TILES = [120, 150, 180, 210] as const;
const LAKE_WATER_BODY_ANIMATION_FRAMES = [
  ...tilesInRect({ left: 0, top: 4, right: 2, bottom: 7 }),
] as const;
const LAKE_SHORE_EDGE_TILES = [0, 30, 60, 90] as const;
const LAKE_SHORE_EDGE_ANIMATION_FRAMES = [
  ...tilesInRect({ left: 0, top: 0, right: 2, bottom: 3 }),
] as const;
const WATERFALL_WATER_TILES = [93, 123, 153, 183, 213] as const;
const WATERFALL_WATER_ANIMATION_FRAMES = [
  ...tilesInRect({ left: 3, top: 3, right: 5, bottom: 7 }),
] as const;
const DESERT_SAND_BODY_TILES = [SAND_TILE.BODY] as const;
const DESERT_SAND_EDGE_TILES = [...SAND_SIDE_EDGES, ...SAND_CORNERS] as const;
const HOUSE_PURPLE_STONE_WALL_OBJECTS = [12, 13, 14, 42, 43, 44, 72, 73, 74] as const;
const HOUSE_WHITE_WALL_UPPER_OBJECTS = [15, 16, 17] as const;
const HOUSE_WHITE_WALL_BODY_OBJECTS = [45, 46, 47] as const;
const HOUSE_WHITE_WALL_LOWER_OBJECTS = [75, 76, 77] as const;
const HOUSE_WHITE_WALL_OBJECTS = [
  ...HOUSE_WHITE_WALL_UPPER_OBJECTS,
  ...HOUSE_WHITE_WALL_BODY_OBJECTS,
  ...HOUSE_WHITE_WALL_LOWER_OBJECTS,
] as const;
const HOUSE_WOOD_WALL_UPPER_OBJECTS = [102, 103, 104] as const;
const HOUSE_WOOD_WALL_BODY_OBJECTS = [132, 133, 134] as const;
const HOUSE_WOOD_WALL_LOWER_OBJECTS = [162, 163, 164] as const;
const HOUSE_WOOD_WALL_OBJECTS = [
  ...HOUSE_WOOD_WALL_UPPER_OBJECTS,
  ...HOUSE_WOOD_WALL_BODY_OBJECTS,
  ...HOUSE_WOOD_WALL_LOWER_OBJECTS,
] as const;
const HOUSE_WHITE_WALL_LEFT_COLUMN_OBJECTS = [15, 45, 75] as const;
const HOUSE_WHITE_WALL_REPEAT_COLUMN_OBJECTS = [16, 46, 76] as const;
const HOUSE_WHITE_WALL_RIGHT_COLUMN_OBJECTS = [17, 47, 77] as const;
const HOUSE_PLASTER_WALL_OBJECTS = [
  ...HOUSE_PURPLE_STONE_WALL_OBJECTS,
  ...HOUSE_WHITE_WALL_OBJECTS,
] as const;
const WOOD_STRUCTURE_OBJECTS = [105, 106, 107, 135, 136, 137, 165, 166, 167] as const;
const TIMBER_POST_STRUCTURE_OBJECTS = [193, 194, 195, 196, 197, 223, 224, 225, 226, 227] as const;
const HOUSE_ENTRANCE_UPPER_OBJECTS = [329] as const;
const HOUSE_ENTRANCE_LOWER_OBJECTS = [359] as const;
const HOUSE_ENTRANCE_OBJECTS = [
  ...HOUSE_ENTRANCE_UPPER_OBJECTS,
  ...HOUSE_ENTRANCE_LOWER_OBJECTS,
] as const;
const HOUSE_ROOF_OBJECTS = [374, 375, 376, 377, 384, 386, 387, 404, 405, 406, 407] as const;
const HOUSE_FACADE_OBJECTS = [385, 434, 435, 436, 437, 464, 466, 467] as const;
const HOUSE_DOOR_OBJECTS = [465] as const;
const HOUSE_WINDOW_OBJECTS = [85, 87] as const;
const HOUSE_WALL_OBJECTS = [
  ...HOUSE_PLASTER_WALL_OBJECTS,
  ...HOUSE_WOOD_WALL_OBJECTS,
  ...HOUSE_FACADE_OBJECTS,
] as const;

export const CHIPSET_TILE_GROUPS = {
  water: CHIPSET_ANIMATION_FRAME_TILES,
  snowGround: [
    ...tilesInRect({ left: 6, top: 0, right: 8, bottom: 3 }),
  ],
  grassGround: [
    240, 241, 242, 243, 244, 245,
    270, 271, 272, 273, 274, 275,
    300, 301, 302, 303, 304, 305,
    330, 331, 332, 333, 334, 335,
  ],
  lakeWaterBody: LAKE_WATER_BODY_TILES,
  lakeWaterBodyAnimationFrames: LAKE_WATER_BODY_ANIMATION_FRAMES,
  lakeShoreEdges: LAKE_SHORE_EDGE_TILES,
  lakeShoreEdgeAnimationFrames: LAKE_SHORE_EDGE_ANIMATION_FRAMES,
  waterBody: LAKE_WATER_BODY_TILES,
  waterEdges: LAKE_SHORE_EDGE_TILES,
  waterfallWater: WATERFALL_WATER_TILES,
  waterfallWaterAnimationFrames: WATERFALL_WATER_ANIMATION_FRAMES,
  dirtRoadBody: [DIRT_ROAD_TILE.BODY_ALT, DIRT_ROAD_TILE.BODY],
  dirtRoadVariants: [],
  dirtRoadDetail: [156, 157, 158, 186, 187, 188, 216, 217, 218],
  dirtRoadSideEdges: DIRT_ROAD_SIDE_EDGES,
  dirtRoadCorners: DIRT_ROAD_CORNERS,
  dirtEdges: [...DIRT_ROAD_SIDE_EDGES, ...DIRT_ROAD_CORNERS],
  desertSandBody: DESERT_SAND_BODY_TILES,
  desertSandEdges: DESERT_SAND_EDGE_TILES,
  sandBody: DESERT_SAND_BODY_TILES,
  sandSideEdges: SAND_SIDE_EDGES,
  sandCorners: SAND_CORNERS,
  sandGround: [363, 364, 365, 393, 394, 395, 423, 424, 425, 453, 454, 455],
  stoneFloorBody: [342],
  woodBridgeBody: [],
  woodFloorBody: [192, 222, 228, 229, 230],
  groundDetail: [402, 403, 432, 433, 462, 463],
  darkWallBody: [
    366, 367, 368, 369, 370, 371,
    396, 397, 398, 399, 400, 401,
    426, 427, 428, 429, 430, 431,
    456, 457, 458, 459, 460, 461,
  ],
  stoneGround: [
    129, 130, 131, 159, 160, 161, 189, 190, 191, 219, 220, 221,
    342, 343, 344, 345, 346, 347, 372, 373, 462, 463,
  ],
  stoneWallBody: [306],
  stoneWall: [
    246, 247, 248, 249, 250, 251,
    276, 277, 278, 279, 280, 281,
    306, 307, 308, 309, 310, 311,
    336, 337, 338, 339, 340, 341,
  ],
  structureSolid: [
    ...tilesInRect({ left: 6, top: 8, right: 17, bottom: 12 }),
    ...tilesInRect({ left: 18, top: 0, right: 29, bottom: 3 }),
  ],
  upperObjects: [
    ...tilesInRect({ left: 18, top: 8, right: 29, bottom: 15 }),
  ],
  treeObjects: [260, 262, 263, 289, 290, 292, 293],
  flowerObjects: [288, 348, 351],
  stakeObjects: [378, 408, 438],
  fenceObjects: [378, 379, 380, 408, 409, 410, 438, 439],
  housePurpleStoneWallObjects: HOUSE_PURPLE_STONE_WALL_OBJECTS,
  houseWhiteWallUpperObjects: HOUSE_WHITE_WALL_UPPER_OBJECTS,
  houseWhiteWallBodyObjects: HOUSE_WHITE_WALL_BODY_OBJECTS,
  houseWhiteWallLowerObjects: HOUSE_WHITE_WALL_LOWER_OBJECTS,
  houseWhiteWallObjects: HOUSE_WHITE_WALL_OBJECTS,
  houseWoodWallUpperObjects: HOUSE_WOOD_WALL_UPPER_OBJECTS,
  houseWoodWallBodyObjects: HOUSE_WOOD_WALL_BODY_OBJECTS,
  houseWoodWallLowerObjects: HOUSE_WOOD_WALL_LOWER_OBJECTS,
  houseWoodWallObjects: HOUSE_WOOD_WALL_OBJECTS,
  houseWhiteWallLeftColumnObjects: HOUSE_WHITE_WALL_LEFT_COLUMN_OBJECTS,
  houseWhiteWallRepeatColumnObjects: HOUSE_WHITE_WALL_REPEAT_COLUMN_OBJECTS,
  houseWhiteWallRightColumnObjects: HOUSE_WHITE_WALL_RIGHT_COLUMN_OBJECTS,
  housePlasterWallObjects: HOUSE_PLASTER_WALL_OBJECTS,
  woodStructureObjects: WOOD_STRUCTURE_OBJECTS,
  timberPostStructureObjects: TIMBER_POST_STRUCTURE_OBJECTS,
  houseEntranceUpperObjects: HOUSE_ENTRANCE_UPPER_OBJECTS,
  houseEntranceLowerObjects: HOUSE_ENTRANCE_LOWER_OBJECTS,
  houseEntranceObjects: HOUSE_ENTRANCE_OBJECTS,
  houseRoofObjects: HOUSE_ROOF_OBJECTS,
  houseFacadeObjects: HOUSE_FACADE_OBJECTS,
  houseWallObjects: HOUSE_WALL_OBJECTS,
  houseDoorObjects: HOUSE_DOOR_OBJECTS,
  houseWindowObjects: HOUSE_WINDOW_OBJECTS,
  houseObjects: [...HOUSE_ROOF_OBJECTS, ...HOUSE_WALL_OBJECTS, ...HOUSE_ENTRANCE_OBJECTS, ...HOUSE_DOOR_OBJECTS],
  roofObjects: [374, 375, 376, 377, 384, 385, 386, 387, 404, 405, 406, 407, 436, 437],
  buildingFrontObjects: [414, 415, 416, 444, 445, 446, 474, 475, 476],
  tentObjects: [389, 418, 419, 448, 449, 477, 478, 479],
  benchObjects: [327, 328, 357, 358],
  vineObjects: [291, 321, 325, 355, 356],
  signObjects: [319, 320, 327],
  fireObjects: [318, 381],
  statueObjects: [352, 353, 382, 383, 412, 413],
  smallObjects: [259, 318, 319, 320, 323, 327, 348, 349, 350, 351, 411, 440, 441, 442, 443, 472, 473],
} as const;

export const CONFIRMED_CHIPSET_TILE_INDEXES = [
  ...CHIPSET_TILE_GROUPS.lakeWaterBody,
  ...CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames,
  ...CHIPSET_TILE_GROUPS.waterfallWater,
  ...CHIPSET_TILE_GROUPS.lakeShoreEdges,
  ...CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames,
  ...CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames,
  240,
  241,
  270,
  271,
  300,
  301,
  330,
  331,
  ...CHIPSET_TILE_GROUPS.dirtRoadBody,
  ...CHIPSET_TILE_GROUPS.dirtRoadSideEdges,
  ...CHIPSET_TILE_GROUPS.dirtRoadCorners,
  ...CHIPSET_TILE_GROUPS.desertSandBody,
  ...CHIPSET_TILE_GROUPS.desertSandEdges,
  ...CHIPSET_TILE_GROUPS.woodBridgeBody,
  ...CHIPSET_TILE_GROUPS.woodFloorBody,
  ...CHIPSET_TILE_GROUPS.groundDetail,
  ...CHIPSET_TILE_GROUPS.darkWallBody,
  342,
  343,
  TILE.WALL,
  TILE.TREE,
  TILE.FLOWERS,
  ...CHIPSET_TILE_GROUPS.stakeObjects,
  ...CHIPSET_TILE_GROUPS.fenceObjects,
  ...CHIPSET_TILE_GROUPS.houseObjects,
  ...CHIPSET_TILE_GROUPS.houseWindowObjects,
  ...CHIPSET_TILE_GROUPS.woodStructureObjects,
  ...CHIPSET_TILE_GROUPS.timberPostStructureObjects,
  ...CHIPSET_TILE_GROUPS.roofObjects,
  ...CHIPSET_TILE_GROUPS.buildingFrontObjects,
  ...CHIPSET_TILE_GROUPS.tentObjects,
  ...CHIPSET_TILE_GROUPS.benchObjects,
  ...CHIPSET_TILE_GROUPS.vineObjects,
  ...CHIPSET_TILE_GROUPS.signObjects,
  ...CHIPSET_TILE_GROUPS.fireObjects,
  ...CHIPSET_TILE_GROUPS.statueObjects,
  ...CHIPSET_TILE_GROUPS.smallObjects,
] as const;

const DIRT_TILES = [
  ...CHIPSET_TILE_GROUPS.dirtRoadBody,
  ...CHIPSET_TILE_GROUPS.dirtRoadVariants,
  ...CHIPSET_TILE_GROUPS.dirtRoadDetail,
  ...CHIPSET_TILE_GROUPS.dirtEdges,
] as const;

export function isWaterChipsetTile(index: number): boolean {
  return hasTile(CHIPSET_TILE_GROUPS.water, index);
}

export function isPropOverlayChipsetTile(index: number): boolean {
  if (isBuildingBaseChipsetTile(index)) return false;
  return (
    hasTile(CHIPSET_TILE_GROUPS.upperObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.treeObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.flowerObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stakeObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fenceObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.benchObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.vineObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.signObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.fireObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.statueObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.houseWindowObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.smallObjects, index)
  );
}

export function isUpperChipsetTile(index: number): boolean {
  return isPropOverlayChipsetTile(index);
}

function isBuildingBaseChipsetTile(index: number): boolean {
  return (
    hasTile(CHIPSET_TILE_GROUPS.houseObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.timberPostStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.roofObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.buildingFrontObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.tentObjects, index)
  );
}

export function isSolidChipsetTile(index: number): boolean {
  if (hasTile(CHIPSET_TILE_GROUPS.flowerObjects, index)) return false;
  return (
    isWaterChipsetTile(index) ||
    hasTile(CHIPSET_TILE_GROUPS.treeObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.houseObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.roofObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.timberPostStructureObjects, index) ||
    hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneWall, index) ||
    hasTile(CHIPSET_TILE_GROUPS.structureSolid, index) ||
    hasTile(CHIPSET_TILE_GROUPS.upperObjects, index)
  );
}

export function terrainTagForChipsetTile(index: number): number {
  if (isWaterChipsetTile(index)) return TERRAIN_TAG.WATER;
  if (hasTile(CHIPSET_TILE_GROUPS.sandGround, index)) return TERRAIN_TAG.SAND;
  if (hasTile(CHIPSET_TILE_GROUPS.snowGround, index)) return TERRAIN_TAG.SNOW;
  if (hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index)) return TERRAIN_TAG.STONE;
  if (hasTile(CHIPSET_TILE_GROUPS.stoneGround, index)) return TERRAIN_TAG.STONE;
  return TERRAIN_TAG.NORMAL;
}

export function tileLabelForIndex(index: number): string {
  return tileSemanticForIndex(index).label;
}

export function tileAiLabelForIndex(index: number): string {
  return tileSemanticForIndex(index).aiLabel;
}

export function tileDisplayLabelForIndex(index: number): string {
  const semantic = tileSemanticForIndex(index);
  const label = koreanTileLabel(semantic.key, index);
  return `${index} ${label}`;
}

export function describeChipsetTile(index: number): ChipsetTileDescriptor {
  const semantic = tileSemanticForIndex(index);
  return {
    index,
    column: index % DEFAULT_TILES_PER_ROW,
    row: Math.floor(index / DEFAULT_TILES_PER_ROW),
    key: semantic.key,
    label: semantic.label,
    description: semantic.aiLabel,
    aiLabel: semantic.aiLabel,
    usage: semantic.usage,
    tags: semantic.tags,
    layer: isUpperChipsetTile(index) ? "upper" : "lower",
    passage: isSolidChipsetTile(index) ? "solid" : "passable",
    terrainTag: terrainTagForChipsetTile(index),
    repeatRole: repeatRoleForChipsetTile(index),
    confirmed: hasTile(CONFIRMED_CHIPSET_TILE_INDEXES, index),
  };
}

export function dirtLikeTiles(): readonly number[] {
  return DIRT_TILES;
}

function tileSemanticForIndex(index: number): TileSemantic {
  if (index === TILE.EMPTY) return semantic({ key: "empty", label: "Empty", aiLabel: "Empty tile: clears the selected map layer.", usage: "empty", tags: ["empty", "erase"] });
  if (hasTile(CHIPSET_TILE_GROUPS.woodBridgeBody, index)) return semantic({ key: "wood_bridge_body", label: "Wood bridge", aiLabel: "Wood bridge body: lower-layer walkable bridge surface for crossing water.", usage: "path", tags: ["wood", "bridge", "walkable", "water-crossing"] });
  if (index === 378) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence upper-left corner: use at the top-left of a fenced enclosure before horizontal rail 379.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "upper-left"] });
  if (index === 379) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence top/bottom horizontal rail: repeat this tile across the upper or lower run between fence corners or terminators.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "horizontal", "repeat-horizontal"] });
  if (index === 380) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence upper-right corner: use at the top-right of a fenced enclosure after horizontal rail 379.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "upper-right"] });
  if (index === 408) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence vertical rail: repeat this tile down the left or right side of a fenced enclosure.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "vertical", "repeat-vertical"] });
  if (index === 409) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence right-side lower terminator: use at the inner-left end of a lower-right fence run so it does not imply continuation further left.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "terminator", "right-side", "lower-run"] });
  if (index === 410) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence lower-right turn: use where the right vertical fence bends into the lower horizontal fence.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "lower-right"] });
  if (index === 438) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence lower-left turn: use where the left vertical fence bends into the lower horizontal fence.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "corner", "lower-left"] });
  if (index === 439) return semantic({ key: "fence_object", label: "Fence", aiLabel: "Fence left-side lower terminator: use at the inner-right end of a lower-left fence run so it does not imply continuation further right.", usage: "decoration", tags: ["fence", "barrier", "village", "upper", "terminator", "left-side", "lower-run"] });
  if (hasTile(CHIPSET_TILE_GROUPS.stakeObjects, index)) return semantic({ key: "stake_object", label: "Stake", aiLabel: "Stake object: upper-layer wooden post or palisade marker for fences and boundaries.", usage: "decoration", tags: ["stake", "post", "fence", "boundary", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames, index)) return semantic({ key: "lake_water_body", label: "Lake water", aiLabel: "Lake water body: lower-layer still, impassable pond, lake, or oasis interior tile with 3fps water animation.", usage: "terrain", tags: ["lake", "still-water", "pond", "oasis", "body", "animation-frame", "impassable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames, index)) return semantic({ key: "lake_shore_edge", label: "Lake shore", aiLabel: "Lake shore edge: lower-layer bank transition for still water beside grass or sand with 3fps water animation.", usage: "edge", tags: ["lake", "shore", "edge", "bank", "still-water", "animation-frame", "impassable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames, index)) return semantic({ key: "waterfall_water", label: "Waterfall", aiLabel: "Waterfall water: lower-layer vertical flowing water tile for cliffs with 3fps animation, not a lake surface.", usage: "terrain", tags: ["waterfall", "flowing-water", "cliff", "animation-frame", "impassable"] });
  if (isWaterChipsetTile(index)) return semantic({ key: "water_surface", label: "Water", aiLabel: "Water surface: lower-layer impassable lake or river tile.", usage: "terrain", tags: ["water", "lake", "river", "impassable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.snowGround, index)) return semantic({ key: "snow_ground", label: "Snow", aiLabel: "Snow ground: lower-layer cold terrain surface.", usage: "terrain", tags: ["snow", "ground", "cold"] });
  if (hasTile(CHIPSET_TILE_GROUPS.grassGround, index)) return semantic({ key: "grass_ground", label: "Grass", aiLabel: "Grass ground: lower-layer walkable outdoor base terrain.", usage: "terrain", tags: ["grass", "ground", "walkable", "outdoor"] });
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadBody, index)) return semantic({ key: "dirt_road_body", label: "Dirt road", aiLabel: "Dirt road body: lower-layer walkable road center tile.", usage: "path", tags: ["dirt", "road", "walkable", "body"] });
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadDetail, index)) return semantic({ key: "dirt_road_detail", label: "Dirt detail", aiLabel: "Dirt detail: small lower-layer road variation or ground accent.", usage: "detail", tags: ["dirt", "detail", "variation"] });
  if (index === DIRT_ROAD_TILE.EDGE_NORTH) return semantic({ key: "dirt_road_edge_north", label: "Dirt edge", aiLabel: "Dirt road north edge: use along the top border of a road mass after all connected road rectangles are merged.", usage: "edge", tags: ["dirt", "road", "edge", "north", "autotile"] });
  if (index === DIRT_ROAD_TILE.EDGE_SOUTH) return semantic({ key: "dirt_road_edge_south", label: "Dirt edge", aiLabel: "Dirt road south edge: use along the bottom border of a road mass after all connected road rectangles are merged.", usage: "edge", tags: ["dirt", "road", "edge", "south", "autotile"] });
  if (index === DIRT_ROAD_TILE.EDGE_WEST) return semantic({ key: "dirt_road_edge_west", label: "Dirt edge", aiLabel: "Dirt road west edge: use along the left border of a road mass, including vertical branch sides.", usage: "edge", tags: ["dirt", "road", "edge", "west", "autotile"] });
  if (index === DIRT_ROAD_TILE.EDGE_EAST) return semantic({ key: "dirt_road_edge_east", label: "Dirt edge", aiLabel: "Dirt road east edge: use along the right border of a road mass, including vertical branch sides.", usage: "edge", tags: ["dirt", "road", "edge", "east", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_NORTH_WEST) return semantic({ key: "dirt_road_corner_north_west", label: "Dirt corner", aiLabel: "Dirt road outer north-west corner: use only where both north and west neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "north-west", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_NORTH_EAST) return semantic({ key: "dirt_road_corner_north_east", label: "Dirt corner", aiLabel: "Dirt road outer north-east corner: use only where both north and east neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "north-east", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_SOUTH_WEST) return semantic({ key: "dirt_road_corner_south_west", label: "Dirt corner", aiLabel: "Dirt road outer south-west corner: use only where both south and west neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "south-west", "autotile"] });
  if (index === DIRT_ROAD_TILE.CORNER_SOUTH_EAST) return semantic({ key: "dirt_road_corner_south_east", label: "Dirt corner", aiLabel: "Dirt road outer south-east corner: use only where both south and east neighbors are grass/non-road.", usage: "edge", tags: ["dirt", "road", "corner", "outer", "south-east", "autotile"] });
  if (hasTile(CHIPSET_TILE_GROUPS.dirtEdges, index)) return semantic({ key: "dirt_road_edge", label: "Dirt edge", aiLabel: "Dirt road edge: lower-layer border or corner for shaped road transitions.", usage: "edge", tags: ["dirt", "road", "edge", "autotile"] });
  if (hasTile(CHIPSET_TILE_GROUPS.desertSandBody, index)) return semantic({ key: "desert_sand_body", label: "Desert sand", aiLabel: "Desert sand body: lower-layer walkable dry terrain interior tile.", usage: "terrain", tags: ["desert", "sand", "dry", "walkable", "body"] });
  if (hasTile(CHIPSET_TILE_GROUPS.desertSandEdges, index)) return semantic({ key: "desert_sand_edge", label: "Desert edge", aiLabel: "Desert sand edge: lower-layer border or corner for dry terrain transitions.", usage: "edge", tags: ["desert", "sand", "edge", "autotile"] });
  if (hasTile(CHIPSET_TILE_GROUPS.sandGround, index)) return semantic({ key: "sand_ground", label: "Sand", aiLabel: "Sand terrain: lower-layer beach, plaza, or desert tile.", usage: "terrain", tags: ["sand", "beach", "plaza", "desert"] });
  if (hasTile(CHIPSET_TILE_GROUPS.woodFloorBody, index)) return semantic({ key: "wood_floor_body", label: "Wood floor", aiLabel: "Wood floor body: lower-layer plank or pier surface.", usage: "path", tags: ["wood", "floor", "plank", "walkable"] });
  if (hasTile(CHIPSET_TILE_GROUPS.groundDetail, index)) return semantic({ key: "ground_detail", label: "Ground detail", aiLabel: "Ground detail: lower-layer rubble, flowers, moss, or terrain accent.", usage: "detail", tags: ["ground", "detail", "rubble", "accent"] });
  if (hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index)) return semantic({ key: "dark_wall_body", label: "Dark wall", aiLabel: "Dark wall body: solid lower-layer cave, cliff, or deep masonry boundary.", usage: "structure", tags: ["dark", "wall", "solid", "cave"] });
  if (hasTile(CHIPSET_TILE_GROUPS.stoneGround, index)) return semantic({ key: "stone_floor", label: "Stone floor", aiLabel: "Stone floor: lower-layer town, ruin, or paved surface.", usage: "structure", tags: ["stone", "floor", "paved", "town"] });
  if (hasTile(CHIPSET_TILE_GROUPS.stoneWall, index)) return semantic({ key: "stone_wall", label: "Castle wall top", aiLabel: "Castle wall top / battlement: lower-layer stone castle-wall surface, parapet, or rampart-walk component. Prefer Korean labels like 성벽 상단, 성곽 위, 여장, or 성벽 보행로 instead of generic 돌담.", usage: "structure", tags: ["stone", "castle", "wall", "battlement", "parapet", "rampart", "castle-wall", "structure"] });
  if (hasTile(CHIPSET_TILE_GROUPS.housePurpleStoneWallObjects, index)) return semantic({ key: "house_purple_stone_wall_object", label: "House purple stone wall", aiLabel: "House purple stone wall: upper-layer exterior home wall panel with timber beams and purple stone infill.", usage: "structure", tags: ["house", "wall", "purple-stone", "timber", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallUpperObjects, index)) return semantic({ key: "house_white_wall_upper_object", label: "House white wall upper", aiLabel: "House white wall upper: top row of the cream-white house wall; repeat tile 16 horizontally between left cap 15 and right cap 17.", usage: "structure", tags: ["house", "wall", "white", "cream", "upper-wall", "facade", "upper", ...whiteWallColumnTags(index)] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallBodyObjects, index)) return semantic({ key: "house_white_wall_body_object", label: "House white wall body", aiLabel: "House white wall body: middle cream-white exterior wall row; repeat tile 46 horizontally between left cap 45 and right cap 47.", usage: "structure", tags: ["house", "wall", "white", "cream", "body", "facade", "upper", ...whiteWallColumnTags(index)] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallLowerObjects, index)) return semantic({ key: "house_white_wall_lower_object", label: "House white wall lower", aiLabel: "House white wall lower: bottom cream-white exterior wall row; repeat tile 76 horizontally between left cap 75 and right cap 77.", usage: "structure", tags: ["house", "wall", "white", "cream", "lower-wall", "facade", "upper", ...whiteWallColumnTags(index)] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWoodWallUpperObjects, index)) return semantic({ key: "house_wood_wall_upper_object", label: "House wood wall upper", aiLabel: "House wood wall upper: top row of the wooden house wall; use tiles 102, 103, and 104 as the upper row.", usage: "structure", tags: ["house", "wood", "wall", "upper-wall", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWoodWallBodyObjects, index)) return semantic({ key: "house_wood_wall_body_object", label: "House wood wall body", aiLabel: "House wood wall body: middle row of the wooden house wall; use tiles 132, 133, and 134 below the upper row.", usage: "structure", tags: ["house", "wood", "wall", "body", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWoodWallLowerObjects, index)) return semantic({ key: "house_wood_wall_lower_object", label: "House wood wall lower", aiLabel: "House wood wall lower: bottom row of the wooden house wall; use tiles 162, 163, and 164 below the body row.", usage: "structure", tags: ["house", "wood", "wall", "lower-wall", "facade", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.woodStructureObjects, index)) return semantic({ key: "wood_structure_object", label: "Wood structure", aiLabel: "Wood structure piece: upper-layer wooden building component; inspect its neighbors before use because this is not a repeatable house wall.", usage: "structure", tags: ["wood", "structure", "beam", "plank", "needs-manual-composition", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.timberPostStructureObjects, index)) return semantic({ key: "timber_post_structure_object", label: "Timber post structure", aiLabel: "Timber post structure piece: upper-layer post, plaster, or wood component; use only in a hand-mapped composition, not as a standalone house wall.", usage: "structure", tags: ["timber", "post", "structure", "needs-manual-composition", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseEntranceUpperObjects, index)) return semantic({ key: "house_entrance_upper_object", label: "House entrance upper", aiLabel: "House entrance upper: top half of a two-tile vertical house entrance; place tile 329 directly above tile 359.", usage: "structure", tags: ["house", "entrance", "doorway", "upper-half", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseEntranceLowerObjects, index)) return semantic({ key: "house_entrance_lower_object", label: "House entrance lower", aiLabel: "House entrance lower: bottom half of a two-tile vertical house entrance; place tile 359 directly below tile 329.", usage: "structure", tags: ["house", "entrance", "doorway", "lower-half", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseRoofObjects, index)) return semantic({ key: "house_roof_object", label: "House roof", aiLabel: "House roof object: upper-layer exterior home roof section for AI-composed village houses.", usage: "structure", tags: ["house", "roof", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseFacadeObjects, index)) return semantic({ key: "house_facade_object", label: "House facade", aiLabel: "House facade object: upper-layer exterior home front wall, window, or roof-facing section paired with the red or blue roof tiles.", usage: "structure", tags: ["house", "wall", "facade", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseDoorObjects, index)) return semantic({ key: "house_door_object", label: "House door", aiLabel: "House door object: upper-layer exterior home entrance or base section for AI-composed village houses.", usage: "structure", tags: ["house", "door", "entrance", "building", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.houseWindowObjects, index)) return semantic({ key: "house_window_object", label: "House window", aiLabel: "House window object: upper-layer exterior window placed on top of a house wall tile, not a lower terrain tile.", usage: "structure", tags: ["house", "window", "facade", "upper", "overlay"] });
  if (hasTile(CHIPSET_TILE_GROUPS.roofObjects, index)) return semantic({ key: "roof_object", label: "Roof", aiLabel: "Roof object: upper-layer house or tent roof section for exterior buildings.", usage: "structure", tags: ["roof", "building", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.buildingFrontObjects, index)) return semantic({ key: "building_front_object", label: "Building front", aiLabel: "Building front object: upper-layer facade, door, or wall face for exterior buildings.", usage: "structure", tags: ["building", "facade", "door", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.tentObjects, index)) return semantic({ key: "tent_object", label: "Tent", aiLabel: "Tent object: upper-layer shelter or campsite structure.", usage: "structure", tags: ["tent", "shelter", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.benchObjects, index)) return semantic({ key: "bench_object", label: "Bench", aiLabel: "Bench object: upper-layer village furniture decoration.", usage: "decoration", tags: ["bench", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.vineObjects, index)) return semantic({ key: "vine_object", label: "Vines", aiLabel: "Vine object: upper-layer organic wall or ruin decoration.", usage: "decoration", tags: ["vine", "nature", "ruin", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.signObjects, index)) return semantic({ key: "sign_object", label: "Sign", aiLabel: "Sign object: upper-layer signpost or readable map marker.", usage: "decoration", tags: ["sign", "marker", "village", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.fireObjects, index)) return semantic({ key: "fire_object", label: "Fire", aiLabel: "Fire object: upper-layer torch or campfire decoration.", usage: "decoration", tags: ["fire", "torch", "campfire", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.statueObjects, index)) return semantic({ key: "statue_object", label: "Statue", aiLabel: "Statue object: upper-layer monument or ruin decoration.", usage: "decoration", tags: ["statue", "monument", "ruin", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.treeObjects, index)) return semantic({ key: "tree_object", label: "Tree", aiLabel: "Tree object: upper-layer forest canopy or trunk part.", usage: "decoration", tags: ["tree", "forest", "solid", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.flowerObjects, index)) return semantic({ key: "flower_object", label: "Flowers", aiLabel: "Flowers object: upper-layer small passable nature decoration.", usage: "decoration", tags: ["flower", "nature", "passable", "upper"] });
  if (hasTile(CHIPSET_TILE_GROUPS.upperObjects, index)) return semantic({ key: "generic_object", label: "Object", aiLabel: "Generic upper-layer exterior object; inspect visually before procedural use.", usage: "decoration", tags: ["object", "upper", "unclassified"] });
  return semantic({ key: `tile_${index}`, label: `Tile ${index}`, aiLabel: `Unmapped chipset tile ${index}: needs manual classification before AI placement.`, usage: "unknown", tags: ["unmapped"] });
}

function semantic(definition: TileSemantic): TileSemantic {
  return definition;
}

function koreanTileLabel(key: string, index: number): string {
  const labels: Record<string, string> = {
    empty: "빈 타일",
    wood_bridge_body: "나무 다리",
    stake_object: "말뚝",
    fence_object: "울타리",
    lake_water_body: "호수 물",
    lake_shore_edge: "호수 외곽",
    waterfall_water: "폭포",
    water_surface: "물",
    snow_ground: "눈밭",
    grass_ground: "풀밭",
    dirt_road_body: "흙길 중심",
    dirt_road_detail: "흙길 장식",
    dirt_road_edge: "흙길 외곽",
    desert_sand_body: "사막 모래",
    desert_sand_edge: "사막 외곽",
    sand_ground: "모래 지형",
    wood_floor_body: "나무 바닥",
    ground_detail: "지면 장식",
    dark_wall_body: "어두운 벽",
    stone_floor: "돌 바닥",
    stone_wall: "성벽 상단",
    house_purple_stone_wall_object: "보라 석재 집벽",
    house_white_wall_upper_object: "흰 집벽 상단",
    house_white_wall_body_object: "흰 집벽 중단",
    house_white_wall_lower_object: "흰 집벽 하단",
    house_wood_wall_upper_object: "나무 집벽 상단",
    house_wood_wall_body_object: "나무 집벽 중단",
    house_wood_wall_lower_object: "나무 집벽 하단",
    wood_structure_object: "나무 구조물",
    timber_post_structure_object: "목재 기둥 구조",
    house_entrance_upper_object: "집 입구 상단",
    house_entrance_lower_object: "집 입구 하단",
    house_roof_object: "집 지붕",
    house_facade_object: "집 전면",
    house_door_object: "집 문",
    roof_object: "지붕",
    building_front_object: "건물 전면",
    tent_object: "천막",
    bench_object: "벤치",
    vine_object: "덩굴",
    sign_object: "표지판",
    fire_object: "불/횃불",
    statue_object: "석상",
    tree_object: "나무",
    flower_object: "꽃",
    generic_object: "오브젝트",
  };
  return labels[key] ?? `미분류 칩 ${index}`;
}

function whiteWallColumnTags(index: number): readonly string[] {
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallRepeatColumnObjects, index)) return ["center", "repeat-horizontal"] as const;
  if (hasTile(CHIPSET_TILE_GROUPS.houseWhiteWallRightColumnObjects, index)) return ["right-cap"] as const;
  return ["left-cap"] as const;
}

function repeatRoleForChipsetTile(index: number): ChipsetTileRepeatRole {
  if (
    hasTile(CHIPSET_TILE_GROUPS.dirtRoadBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.lakeWaterBodyAnimationFrames, index) ||
    hasTile(CHIPSET_TILE_GROUPS.sandBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodBridgeBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.woodFloorBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.darkWallBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneFloorBody, index) ||
    hasTile(CHIPSET_TILE_GROUPS.stoneWallBody, index)
  ) {
    return "body";
  }
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadVariants, index)) return "variant";
  if (hasTile(CHIPSET_TILE_GROUPS.dirtRoadDetail, index) || hasTile(CHIPSET_TILE_GROUPS.groundDetail, index) || hasTile(CHIPSET_TILE_GROUPS.waterfallWaterAnimationFrames, index)) return "detail";
  if (
    hasTile(CHIPSET_TILE_GROUPS.dirtEdges, index) ||
    hasTile(CHIPSET_TILE_GROUPS.lakeShoreEdgeAnimationFrames, index) ||
    hasTile(CHIPSET_TILE_GROUPS.sandSideEdges, index) ||
    hasTile(CHIPSET_TILE_GROUPS.sandCorners, index)
  ) {
    return "edge";
  }
  if (isUpperChipsetTile(index)) return "object";
  return "single";
}

function tilesInRect(rect: TileRect): readonly number[] {
  const tiles: number[] = [];
  for (let row = rect.top; row <= rect.bottom; row++) {
    for (let col = rect.left; col <= rect.right; col++) {
      tiles.push(row * DEFAULT_TILES_PER_ROW + col);
    }
  }
  return tiles;
}

function hasTile(tiles: readonly number[], index: number): boolean {
  return tiles.includes(index);
}
