import { describe, expect, it } from "vitest";
import { supportsChipsetQuarterComposition } from "@/editor/tilesetImage";
import { createBlankProject } from "@/project/defaults";
import { chipsetQuarterComposition } from "@/project/defaults/terrainQuarterAutotile";
import { DARK_WALL_QUARTER_SOURCE, DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";

type MapView = {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: number[];
};

type InteriorCornerFixture = {
  readonly center: number;
  readonly east?: number;
  readonly north?: number;
  readonly south?: number;
  readonly west?: number;
  readonly northEast?: number;
  readonly northWest?: number;
  readonly southEast?: number;
  readonly southWest?: number;
};

function mapWithInteriorCorner(fixture: InteriorCornerFixture): MapView {
  return {
    width: 3,
    height: 3,
    lowerTiles: [
      fixture.northWest ?? 72, fixture.north ?? 72, fixture.northEast ?? 72,
      fixture.west ?? 72, fixture.center, fixture.east ?? 72,
      fixture.southWest ?? 72, fixture.south ?? 72, fixture.southEast ?? 72,
    ],
  };
}

const B = DARK_WALL_TILE.BODY;
const Q = DARK_WALL_QUARTER_SOURCE;
const F = 72;

describe("interior dark-wall quarter composition (Option B: store 366 only)", () => {
  it("allows the Interior tileset through production quarter-render gates", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    expect(supportsChipsetQuarterComposition(tileset)).toBe(true);
  });

  it("isolated 366 → four convex corner quarters", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: B }),
      tileset,
      1,
      1,
    );
    expect(composition).toEqual({
      underlayTile: Q.center,
      sources: [
        { quarter: "nw", tile: Q.cornerNW, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: Q.cornerNE, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: Q.cornerSW, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: Q.cornerSE, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("1-row band of 366 → N/S edge quarters", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: B, west: B, east: B }),
      tileset,
      1,
      1,
    );
    expect(composition).toEqual({
      underlayTile: Q.center,
      sources: [
        { quarter: "nw", tile: Q.edgeN, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: Q.edgeN, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: Q.edgeS, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: Q.edgeS, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("1-col band of 366 → W/E edge quarters", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({ center: B, north: B, south: B }),
      tileset,
      1,
      1,
    );
    expect(composition).toEqual({
      underlayTile: Q.center,
      sources: [
        { quarter: "nw", tile: Q.edgeW, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: Q.edgeE, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: Q.edgeW, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: Q.edgeE, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("cross junction of 366 (diagonals open) → concave 368 ×4", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      mapWithInteriorCorner({
        center: B,
        north: B,
        south: B,
        west: B,
        east: B,
        northWest: F,
        northEast: F,
        southWest: F,
        southEast: F,
      }),
      tileset,
      1,
      1,
    );
    expect(composition).toEqual({
      underlayTile: Q.center,
      sources: [
        { quarter: "nw", tile: Q.concave, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: Q.concave, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: Q.concave, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: Q.concave, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("solid 3×3 of 366 → center body quarters", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    const composition = chipsetQuarterComposition(
      {
        width: 3,
        height: 3,
        lowerTiles: [B, B, B, B, B, B, B, B, B],
      },
      tileset,
      1,
      1,
    );
    expect(composition).toEqual({
      underlayTile: Q.center,
      sources: [
        { quarter: "nw", tile: Q.center, offsetX: 0, offsetY: 0 },
        { quarter: "ne", tile: Q.center, offsetX: 8, offsetY: 0 },
        { quarter: "sw", tile: Q.center, offsetX: 0, offsetY: 8 },
        { quarter: "se", tile: Q.center, offsetX: 8, offsetY: 8 },
      ],
    });
  });

  it("house whole tiles (428/397/105/430/233/257) are never quarter-composed", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    for (const center of [428, 397, 105, 430, 233, 257, 258, 456, 457, 458, 396, 398, 426]) {
      expect(
        chipsetQuarterComposition(
          mapWithInteriorCorner({ center, north: center, south: center, west: F, east: F }),
          tileset,
          1,
          1,
        ),
      ).toBeNull();
    }
  });

  it("does not invent quarters on deep void", () => {
    const tileset = createBlankProject().tilesets.easyrpg_chipset_interior;
    expect(
      chipsetQuarterComposition(
        mapWithInteriorCorner({ center: 430, west: 426, south: 457, southWest: 456 }),
        tileset,
        1,
        1,
      ),
    ).toBeNull();
  });
});
