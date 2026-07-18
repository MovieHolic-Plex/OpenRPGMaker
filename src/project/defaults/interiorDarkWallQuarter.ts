/**
 * Dark wall quarter render (store = 366 only).
 * Samples 368/396–458 as atlas sources — never as store members.
 */
import { DARK_WALL_AUTOTILE_GROUP_ID, DARK_WALL_QUARTER_SOURCE, DARK_WALL_TILE } from "@/project/defaults/darkWallAutotile";
import { INTERIOR_TEXTURE_KEY } from "@/project/tilesetHarness/themePacks";
import type { TilesetDef } from "@/project/types";
import type { TerrainQuarter, TerrainQuarterSource } from "./terrainQuarterAutotile";

type MapLike = {
  readonly width: number;
  readonly height: number;
  readonly lowerTiles: readonly number[];
};

export type InteriorDarkWallQuarterComposition = {
  readonly underlayTile: number;
  readonly sources: readonly TerrainQuarterSource[];
};

const Q = DARK_WALL_QUARTER_SOURCE;

function tileAt(map: MapLike, x: number, y: number): number | undefined {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return undefined;
  return map.lowerTiles[y * map.width + x];
}

function isDarkMass(tile: number | undefined): boolean {
  // Outside map = solid mass; only stored dark body is mass in-map.
  if (tile === undefined) return true;
  return tile === DARK_WALL_TILE.BODY;
}

function quarterOffsets(q: TerrainQuarter): { offsetX: 0 | 8; offsetY: 0 | 8 } {
  if (q === "nw") return { offsetX: 0, offsetY: 0 };
  if (q === "ne") return { offsetX: 8, offsetY: 0 };
  if (q === "sw") return { offsetX: 0, offsetY: 8 };
  return { offsetX: 8, offsetY: 8 };
}

function pickSource(v: boolean, h: boolean, d: boolean, q: TerrainQuarter): number {
  // v = vertical neighbor is mass toward this quarter's outer V side
  // h = horizontal neighbor is mass toward this quarter's outer H side
  // d = diagonal neighbor is mass
  if (v && h && d) return Q.center;
  if (v && h && !d) return Q.concave;
  if (v && !h) return q === "nw" || q === "sw" ? Q.edgeW : Q.edgeE;
  if (!v && h) return q === "nw" || q === "ne" ? Q.edgeN : Q.edgeS;
  // both open → convex corner
  if (q === "nw") return Q.cornerNW;
  if (q === "ne") return Q.cornerNE;
  if (q === "sw") return Q.cornerSW;
  return Q.cornerSE;
}

export function interiorDarkWallQuarterComposition(
  map: MapLike,
  tileset: Pick<TilesetDef, "autotileGroups" | "image">,
  x: number,
  y: number,
): InteriorDarkWallQuarterComposition | null {
  if (tileset.image.type !== "bundled" || tileset.image.id !== INTERIOR_TEXTURE_KEY) return null;
  const center = tileAt(map, x, y);
  if (center !== DARK_WALL_TILE.BODY) return null;

  // Prefer dark group id when present; still allow if texture matches and center is 366
  // (blank projects always seed dark group).
  const hasDark =
    !tileset.autotileGroups ||
    tileset.autotileGroups.length === 0 ||
    tileset.autotileGroups.some((g) => g.id === DARK_WALL_AUTOTILE_GROUP_ID);
  if (!hasDark) return null;

  const n = isDarkMass(tileAt(map, x, y - 1));
  const s = isDarkMass(tileAt(map, x, y + 1));
  const w = isDarkMass(tileAt(map, x - 1, y));
  const e = isDarkMass(tileAt(map, x + 1, y));
  const nw = isDarkMass(tileAt(map, x - 1, y - 1));
  const ne = isDarkMass(tileAt(map, x + 1, y - 1));
  const sw = isDarkMass(tileAt(map, x - 1, y + 1));
  const se = isDarkMass(tileAt(map, x + 1, y + 1));

  const sources: TerrainQuarterSource[] = (["nw", "ne", "sw", "se"] as const).map((quarter) => {
    let v = false;
    let h = false;
    let d = false;
    if (quarter === "nw") {
      v = n;
      h = w;
      d = nw;
    } else if (quarter === "ne") {
      v = n;
      h = e;
      d = ne;
    } else if (quarter === "sw") {
      v = s;
      h = w;
      d = sw;
    } else {
      v = s;
      h = e;
      d = se;
    }
    const tile = pickSource(v, h, d, quarter);
    const { offsetX, offsetY } = quarterOffsets(quarter);
    return { quarter, tile, offsetX, offsetY };
  });

  return { underlayTile: Q.center, sources };
}

/** @deprecated alias — prefer interiorDarkWallQuarterComposition */
export const interiorWallFrameQuarterComposition = interiorDarkWallQuarterComposition;
