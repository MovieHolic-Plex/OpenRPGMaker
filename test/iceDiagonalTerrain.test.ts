import { describe, expect, it } from "vitest";
import {
  canonicalIceRidgeColumns,
  ICE_DIAGONAL_CANONICAL_SOURCE,
  ICE_DIAGONAL_TILES,
  iceDiagonalRole,
  mirrorIceDiagonalTile,
  stampCanonicalIceRidge,
  stampIceDiagonalColumns,
  validateIceDiagonalTerrain,
  type IceTerrainGrid,
} from "@/project/defaults/iceDiagonalTerrain";

// LegacyDb rpg-zzu-dungeon-theme-gallery / map_g_ice_grand / x=24..31, y=9..17.
// The user-authored map is the source of truth. This focused fixture is intentionally
// small enough for unit tests and contains complete peak, valley, body, and base columns.
const CANONICAL_USER_FRAGMENT = [
  [67, 67, 67, 8, 97, 8, 67, 67],
  [67, 8, 67, 98, 287, 286, 67, 98],
  [97, 96, 98, 287, 317, 316, 286, 287],
  [287, 286, 287, 317, 317, 316, 316, 317],
  [317, 316, 317, 317, 347, 346, 316, 317],
  [317, 316, 317, 347, 36, 8, 346, 347],
  [347, 346, 347, 36, 8, 67, 37, 37],
  [36, 8, 67, 67, 67, 67, 67, 67],
  [8, 67, 67, 67, 67, 67, 67, 67],
] as const;

function fragmentGrid(): IceTerrainGrid {
  return {
    width: CANONICAL_USER_FRAGMENT[0].length,
    height: CANONICAL_USER_FRAGMENT.length,
    lower: CANONICAL_USER_FRAGMENT.flat(),
  };
}

describe("ice diagonal terrain canonical grammar", () => {
  it("records the immutable user-authored LegacyDb source", () => {
    expect(ICE_DIAGONAL_CANONICAL_SOURCE).toEqual({
      projectId: "rpg-zzu-dungeon-theme-gallery",
      mapId: "map_g_ice_grand",
      name: "얼음 동굴 · 대형 (55×55)",
    });
  });

  it("classifies all six canonical tiles by face and vertical layer", () => {
    // Given: the six tiles observed in the user-authored ice mountain.
    const expected = [
      [ICE_DIAGONAL_TILES.left.cap, { face: "left", layer: "cap" }],
      [ICE_DIAGONAL_TILES.left.body, { face: "left", layer: "body" }],
      [ICE_DIAGONAL_TILES.left.base, { face: "left", layer: "base" }],
      [ICE_DIAGONAL_TILES.right.cap, { face: "right", layer: "cap" }],
      [ICE_DIAGONAL_TILES.right.body, { face: "right", layer: "body" }],
      [ICE_DIAGONAL_TILES.right.base, { face: "right", layer: "base" }],
    ] as const;

    // When: each tile is classified.
    const roles = expected.map(([tile]) => iceDiagonalRole(tile));

    // Then: the classification preserves the face and layer seen in the canonical map.
    expect(roles).toEqual(expected.map(([, role]) => role));
    expect(iceDiagonalRole(67)).toBeNull();
  });

  it("swaps the left and right diagonal faces when a canonical map is mirrored", () => {
    expect([6, 36, 66, 96].map(mirrorIceDiagonalTile)).toEqual([8, 38, 68, 98]);
    expect([8, 38, 68, 98].map(mirrorIceDiagonalTile)).toEqual([6, 36, 66, 96]);
    expect([7, 37, 67, 97].map(mirrorIceDiagonalTile)).toEqual([7, 37, 67, 97]);
    expect([408, 409].map(mirrorIceDiagonalTile)).toEqual([409, 408]);
    expect(mirrorIceDiagonalTile(ICE_DIAGONAL_TILES.left.cap)).toBe(ICE_DIAGONAL_TILES.right.cap);
    expect(mirrorIceDiagonalTile(ICE_DIAGONAL_TILES.left.body)).toBe(ICE_DIAGONAL_TILES.right.body);
    expect(mirrorIceDiagonalTile(ICE_DIAGONAL_TILES.left.base)).toBe(ICE_DIAGONAL_TILES.right.base);
    expect(mirrorIceDiagonalTile(ICE_DIAGONAL_TILES.right.cap)).toBe(ICE_DIAGONAL_TILES.left.cap);
    expect(mirrorIceDiagonalTile(ICE_DIAGONAL_TILES.right.body)).toBe(ICE_DIAGONAL_TILES.left.body);
    expect(mirrorIceDiagonalTile(ICE_DIAGONAL_TILES.right.base)).toBe(ICE_DIAGONAL_TILES.left.base);
    expect(mirrorIceDiagonalTile(67)).toBe(67);
  });

  it("accepts a horizontally mirrored canonical fragment", () => {
    const grid = fragmentGrid();
    const mirrored = new Array<number>(grid.lower.length);
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        mirrored[y * grid.width + x] = mirrorIceDiagonalTile(
          grid.lower[y * grid.width + (grid.width - 1 - x)]!,
        );
      }
    }

    expect(validateIceDiagonalTerrain({ ...grid, lower: mirrored })).toEqual([]);
  });

  it("accepts the exact user-authored peak and valley fragment", () => {
    // Given: an exact 8x9 crop reloaded from the canonical LegacyDb map.
    const grid = fragmentGrid();

    // When: the diagonal terrain validator scans it.
    const issues = validateIceDiagonalTerrain(grid);

    // Then: the canonical terrain has no structural violations.
    expect(issues).toEqual([]);
  });

  it("rejects a left cap that does not continue into a left body", () => {
    // Given: a canonical fragment whose 286 cap has an incorrect 317 below it.
    const grid = fragmentGrid();
    const lower = [...grid.lower];
    lower[2 * grid.width + 5] = 317;

    // When: the malformed fragment is validated.
    const issues = validateIceDiagonalTerrain({ ...grid, lower });

    // Then: the failure identifies the cap coordinate and contract.
    expect(issues).toContainEqual({ code: "left-cap-needs-left-body", x: 5, y: 1, actual: 317 });
  });

  it("rejects the two forbidden diagonal and stacked-base patterns", () => {
    // Given: minimal columns containing the forbidden 286 north-east 287 and stacked 347.
    const lower = [
      67, 67, 287, 67,
      67, 286, 67, 67,
      67, 316, 347, 67,
      67, 346, 347, 67,
    ];

    // When: the grid is validated.
    const issues = validateIceDiagonalTerrain({ width: 4, height: 4, lower });

    // Then: both visual breakages are reported at their source cells.
    expect(issues.some((issue) => issue.code === "left-cap-north-east-right-cap" && issue.x === 1 && issue.y === 1)).toBe(true);
    expect(issues.some((issue) => issue.code === "right-base-vertical-stack" && issue.x === 2 && issue.y === 2)).toBe(true);
  });

  it("locks the canonical ridge topology extracted from map_g_ice_grand", () => {
    // Given: the source bounds x=22..33, y=9..17 normalized to origin 0,0.
    const expected = [
      { x: 0, topY: 5, bottomY: 8, face: "right" },
      { x: 1, topY: 4, bottomY: 7, face: "right" },
      { x: 2, topY: 3, bottomY: 6, face: "right" },
      { x: 3, topY: 3, bottomY: 6, face: "left" },
      { x: 4, topY: 3, bottomY: 6, face: "right" },
      { x: 5, topY: 2, bottomY: 5, face: "right" },
      { x: 6, topY: 1, bottomY: 4, face: "right" },
      { x: 7, topY: 1, bottomY: 4, face: "left" },
      { x: 8, topY: 2, bottomY: 5, face: "left" },
      { x: 9, topY: 2, bottomY: 5, face: "right" },
      { x: 10, topY: 1, bottomY: 4, face: "right" },
      { x: 11, topY: 0, bottomY: 3, face: "right" },
    ] as const;

    // When: the canonical motif is translated to the zero origin.
    const columns = canonicalIceRidgeColumns(0, 0);

    // Then: its rises, valleys, and face changes match the user map exactly.
    expect(columns).toEqual(expected);
  });

  it("stamps a valid canonical ridge without mutating its input grid", () => {
    // Given: a snow field large enough for the canonical 12-column motif.
    const lower = new Array<number>(12 * 9).fill(67);
    const before = [...lower];

    // When: the canonical ridge is staged.
    const result = stampCanonicalIceRidge({ width: 12, height: 9, lower }, { x: 0, y: 0 });

    // Then: the input stays unchanged and the staged result passes the grammar.
    expect(lower).toEqual(before);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(validateIceDiagonalTerrain({ width: 12, height: 9, lower: result.lower })).toEqual([]);
      expect(result.lower.filter((tile) => tile === 287)).toHaveLength(9);
      expect(result.lower.filter((tile) => tile === 286)).toHaveLength(3);
      expect(result.changedCells).toHaveLength(48);
    }
  });

  it("is idempotent and reports only cells whose tile actually changed", () => {
    const first = stampCanonicalIceRidge(
      { width: 12, height: 9, lower: new Array<number>(12 * 9).fill(67) },
      { x: 0, y: 0 },
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = stampCanonicalIceRidge(
      { width: 12, height: 9, lower: first.lower },
      { x: 0, y: 0 },
    );
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.lower).toEqual(first.lower);
      expect(second.changedCells).toEqual([]);
    }
  });

  it("fails atomically when any requested column crosses the map boundary", () => {
    // Given: a small snow field and one valid plus one out-of-bounds column.
    const lower = new Array<number>(6 * 6).fill(67);
    const before = [...lower];

    // When: both columns are requested as one stamp.
    const result = stampIceDiagonalColumns(
      { width: 6, height: 6, lower },
      [
        { x: 1, topY: 1, bottomY: 4, face: "right" },
        { x: 6, topY: 1, bottomY: 4, face: "left" },
      ],
    );

    // Then: no partial writes escape and the boundary issue is explicit.
    expect(result.ok).toBe(false);
    expect(lower).toEqual(before);
    if (!result.ok) expect(result.issues.some((issue) => issue.code === "column-out-of-bounds")).toBe(true);
  });
});
