import { DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP, templateBlockFromAnchor } from "./autotileGroups";
import type { AutotileGroup, TilesetDef } from "../types";
import type { TerrainQuarterKit } from "./terrainQuarterAutotile";

// Tibo's expanded sheet repeats the EasyRPG interior atlas cell-for-cell in 0~479, so its ceiling uses the
// same quarters. Without them thin partitions and T-junctions draw whole tiles and leave rim stubs.
const TEXTURES = new Set(["tex_easyrpg_chipset_interior", "tex_tibo_interior_expanded"]);
const GROUP: AutotileGroup = {
  ...DEFAULT_DARKNESS_DEEP_AUTOTILE_GROUP,
  id: "harness-interior-house-v1-ceiling",
  name: "천장(회암 테두리)",
};
const roles = templateBlockFromAnchor(369);
const KIT: TerrainQuarterKit = {
  body: roles.body,
  bodyAlt: roles.isolated,
  isolated: roles.isolated,
  inner: roles.inner,
  edgeNorth: roles.edgeN, edgeSouth: roles.edgeS,
  edgeWest: roles.edgeW, edgeEast: roles.edgeE,
  cornerNorthWest: roles.cornerNW, cornerNorthEast: roles.cornerNE,
  cornerSouthWest: roles.cornerSW, cornerSouthEast: roles.cornerSE,
  targetTiles: GROUP.memberTileIds,
  connect: new Set(GROUP.connectTileIds),
};

function isInterior(tileset: Pick<TilesetDef, "image">): boolean {
  return tileset.image.type === "bundled" && TEXTURES.has(tileset.image.id);
}

function hasGraft(tileset: Pick<TilesetDef, "tileGrafts">): boolean {
  return tileset.tileGrafts?.some(graft => GROUP.memberTileIds.includes(graft.targetTile)) ?? false;
}

/** Shared by normal tileset initialization and the room generator. Preserve authored groups. */
export function seedInteriorCeilingAutotile(tileset: TilesetDef): boolean {
  if (!isInterior(tileset) || hasGraft(tileset)) return false;
  const groups = tileset.autotileGroups ?? [];
  if (groups.some(group => group.id === GROUP.id
    || group.memberTileIds.some(tile => GROUP.memberTileIds.includes(tile)))) return false;
  if (GROUP.memberTileIds.some(tile => {
    const meta = tileset.tileMeta?.[tile];
    return meta?.locked || meta?.userLocked || meta?.origin === "user" || meta?.source === "user";
  })) return false;
  tileset.autotileGroups = [...groups, {
    ...GROUP,
    memberTileIds: [...GROUP.memberTileIds],
    connectTileIds: [...GROUP.connectTileIds!],
    variantMap: { ...GROUP.variantMap },
  }];
  return true;
}

/** Only the native ceiling grammar may sample these fixed 8×8 atlas quarters. */
export function interiorCeilingQuarterKit(
  tileset: Pick<TilesetDef, "image" | "autotileGroups" | "tileGrafts">,
  tile: number,
): TerrainQuarterKit | null {
  if (!isInterior(tileset) || !KIT.targetTiles.includes(tile) || hasGraft(tileset)) return null;
  const group = tileset.autotileGroups?.find(candidate => candidate.id === GROUP.id);
  const sameSet = (actual: readonly number[] | undefined, expected: readonly number[]) =>
    actual?.length === expected.length && expected.every(value => actual.includes(value));
  if (!group || group.neighborhood !== GROUP.neighborhood
    || !sameSet(group.memberTileIds, GROUP.memberTileIds)
    || !sameSet(group.connectTileIds, GROUP.connectTileIds!)
    || Object.keys(group.variantMap).length !== Object.keys(GROUP.variantMap).length
    || !Object.entries(GROUP.variantMap).every(([mask, value]) => group.variantMap[mask] === value)) return null;
  return KIT;
}
