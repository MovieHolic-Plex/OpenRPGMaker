/**
 * House interior wall shell — whole-tile grammar (no store autotile).
 *
 * Pixel-direction roles (from sheet vision 2026-07-15):
 * - 397 = top edge line, 457 = bottom edge line
 * - 426 = left edge line, 428 = right edge line
 * - 396 = top+left, 398 = top+right, 456 = bottom+left, 458 = bottom+right
 *
 * Placement names follow house shell roles, not the old inverted edgeN/edgeS labels.
 */
export const HOUSE_SHELL_TILE = {
  // Cream face (north wall 2-row)
  creamUpperL: 74,
  creamUpperM: 75,
  creamUpperR: 76,
  creamLowerL: 104,
  creamLowerM: 105,
  creamLowerR: 106,
  soloUpper: 77,
  soloLower: 107,

  // Frame posts / caps / south trim (whole tiles)
  capStraight: 457, // bottom line faces wall below
  capJointNW: 458, // bottom+right
  capJointNE: 456, // bottom+left
  postWest: 428, // right line faces room
  postEast: 426, // left line faces room
  southTrim: 397, // top line (door step / south trim)

  // Outer south corners / door flanks
  southWestCorner: 398, // top+right
  southEastCorner: 396, // top+left

  void: 430,
  floor: 72,
} as const;

export type HouseShellTileId = (typeof HOUSE_SHELL_TILE)[keyof typeof HOUSE_SHELL_TILE];

/** All tiles that belong to a finished house shell (for wall-mount / mass neighbor checks). */
export const HOUSE_SHELL_MEMBER_TILES: readonly number[] = [
  HOUSE_SHELL_TILE.creamUpperL,
  HOUSE_SHELL_TILE.creamUpperM,
  HOUSE_SHELL_TILE.creamUpperR,
  HOUSE_SHELL_TILE.creamLowerL,
  HOUSE_SHELL_TILE.creamLowerM,
  HOUSE_SHELL_TILE.creamLowerR,
  HOUSE_SHELL_TILE.soloUpper,
  HOUSE_SHELL_TILE.soloLower,
  HOUSE_SHELL_TILE.capStraight,
  HOUSE_SHELL_TILE.capJointNW,
  HOUSE_SHELL_TILE.capJointNE,
  HOUSE_SHELL_TILE.postWest,
  HOUSE_SHELL_TILE.postEast,
  HOUSE_SHELL_TILE.southTrim,
  HOUSE_SHELL_TILE.southWestCorner,
  HOUSE_SHELL_TILE.southEastCorner,
];

/** Cream 2-row face tiles that wall-material retint may replace. */
export const HOUSE_SHELL_CREAM_FACE_TILES: readonly number[] = [
  HOUSE_SHELL_TILE.creamUpperL,
  HOUSE_SHELL_TILE.creamUpperM,
  HOUSE_SHELL_TILE.creamUpperR,
  HOUSE_SHELL_TILE.creamLowerL,
  HOUSE_SHELL_TILE.creamLowerM,
  HOUSE_SHELL_TILE.creamLowerR,
  HOUSE_SHELL_TILE.soloUpper,
  HOUSE_SHELL_TILE.soloLower,
];

/** Forbidden placeholder IDs — never write as house wall/door art. */
export const HOUSE_SHELL_FORBIDDEN_TILES: readonly number[] = [233, 257, 258];
