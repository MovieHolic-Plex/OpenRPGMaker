import { buildEdgeCornerInnerVariantMap } from "./autotileEngine";
import { hasWorldAutotileGraft, isWorldTileset, WORLD_SEA_TILES } from "./worldCoastMapping";
import type { TerrainQuarterKit } from "./terrainQuarterAutotile";
import type { AutotileGroup, TilesetDef, TileAiMetadata } from "../types";

export const WORLD_TERRAIN_PREFIX = "harness-world-v2-terrain-";
export const WORLD_TERRAIN_BLOCKS = [
  { key: "dirt", name: "흙길", anchor: 6, solid: false },
  { key: "sand", name: "모래", anchor: 9, solid: false },
  { key: "marsh", name: "독늪", anchor: 126, solid: true },
  { key: "snow", name: "설원", anchor: 129, solid: false },
  { key: "tall-grass", name: "짙은 풀", anchor: 243, solid: false },
  { key: "snow-forest", name: "눈 숲", anchor: 246, solid: true, isolatedArt: true },
  { key: "snow-mountain", name: "설산", anchor: 249, solid: true, isolatedArt: true },
  { key: "forest", name: "숲", anchor: 360, solid: true, isolatedArt: true },
  { key: "mountain", name: "산맥", anchor: 363, solid: true, isolatedArt: true },
  { key: "metal-pit", name: "금속 테 구덩이", anchor: 366, solid: true },
  { key: "rock-pit", name: "바위 테 구덩이", anchor: 369, solid: true },
] as const;
export type WorldTerrainKey = (typeof WORLD_TERRAIN_BLOCKS)[number]["key"];

function roles(anchor: number) {
  return { isolated: anchor, inner: anchor + 2, cornerNW: anchor + 30, edgeN: anchor + 31,
    cornerNE: anchor + 32, edgeW: anchor + 60, body: anchor + 61, edgeE: anchor + 62,
    cornerSW: anchor + 90, edgeS: anchor + 91, cornerSE: anchor + 92 };
}
const members = new Map(WORLD_TERRAIN_BLOCKS.map(s => [s.key, Object.values(roles(s.anchor))]));
const snowyTiles = new Set([190, 247, 250, ...members.get("snow")!, ...members.get("snow-forest")!, ...members.get("snow-mountain")!]);
export function isWorldSnowTerrain(tile: number): boolean { return snowyTiles.has(tile); }

const GROUPS: readonly AutotileGroup[] = WORLD_TERRAIN_BLOCKS.map(spec => {
  const memberTileIds = members.get(spec.key)!;
  const hostConnections = spec.key === "snow"
    ? [...members.get("snow-forest")!, ...members.get("snow-mountain")!, 247, 250,
      ...WORLD_SEA_TILES, 3, 4, 5, 33, 34, 35, 63, 64, 65, 93, 94, 95]
    : [];
  return { id: WORLD_TERRAIN_PREFIX + spec.key, name: `월드맵 ${spec.name}`, neighborhood: 8,
    memberTileIds, connectTileIds: [...memberTileIds, ...hostConnections],
    variantMap: buildEdgeCornerInnerVariantMap(roles(spec.anchor)) };
});

/** Fixed quarter art must opt out when a user edits the group grammar in place. */
export function matchesWorldAutotileGroup(actual: AutotileGroup | undefined, expected: AutotileGroup): boolean {
  const sameSet = (a: readonly number[] | undefined, b: readonly number[] | undefined) =>
    Boolean(a && b && a.length === b.length && new Set(a).size === b.length && b.every(n => a.includes(n)));
  return Boolean(actual && actual.neighborhood === expected.neighborhood
    && sameSet(actual.memberTileIds, expected.memberTileIds)
    && sameSet(actual.connectTileIds, expected.connectTileIds)
    && Object.keys(actual.variantMap).length === Object.keys(expected.variantMap).length
    && Object.entries(expected.variantMap).every(([mask, tile]) => actual.variantMap[mask] === tile));
}

export function createWorldTerrainAutotileGroups(): AutotileGroup[] {
  return GROUPS.map(g => ({ ...g, memberTileIds: [...g.memberTileIds], connectTileIds: [...g.connectTileIds!], variantMap: { ...g.variantMap } }));
}
const KITS = WORLD_TERRAIN_BLOCKS.map((s, i): TerrainQuarterKit => {
  const r = roles(s.anchor), group = GROUPS[i];
  return { body: r.body, edgeNorth: r.edgeN, edgeSouth: r.edgeS, edgeWest: r.edgeW, edgeEast: r.edgeE,
    cornerNorthWest: r.cornerNW, cornerNorthEast: r.cornerNE, cornerSouthWest: r.cornerSW, cornerSouthEast: r.cornerSE,
    inner: r.inner, isolated: r.isolated, ...("isolatedArt" in s ? { bodyAlt: r.isolated } : {}),
    targetTiles: group.memberTileIds, connect: new Set(group.connectTileIds) };
});
const specIndex = new Map(GROUPS.flatMap((g, i) => g.memberTileIds.map(t => [t, i] as const)));

export function worldTerrainQuarterKit(tileset: Pick<TilesetDef, "image" | "autotileGroups" | "tileGrafts">, tile: number): TerrainQuarterKit | null {
  if (!isWorldTileset(tileset)) return null;
  const index = specIndex.get(tile);
  if (index === undefined) return null;
  const expected = GROUPS[index], actual = tileset.autotileGroups?.find(g => g.id === expected.id);
  if (hasWorldAutotileGraft(tileset, expected.memberTileIds)) return null;
  return matchesWorldAutotileGroup(actual, expected) ? KITS[index] : null;
}

/** Shared with the semantic seeder to avoid metadata/passability oscillation on every load. */
export function worldTerrainMetadata(tile: number): Pick<TileAiMetadata, "defaultLayer" | "passage"> | undefined {
  const index = specIndex.get(tile);
  if (index === undefined) return undefined;
  return { defaultLayer: "lower", passage: WORLD_TERRAIN_BLOCKS[index].solid ? "solid" : "passable" };
}

export function seedWorldTerrainAutotiles(tileset: TilesetDef): boolean {
  if (!isWorldTileset(tileset)) return false;
  let changed = false;
  for (const desired of createWorldTerrainAutotileGroups()) {
    if (hasWorldAutotileGraft(tileset, desired.memberTileIds)) continue;
    if (!(tileset.autotileGroups ?? []).some(g => g.memberTileIds.some(t => desired.memberTileIds.includes(t)))) {
      tileset.autotileGroups = [...(tileset.autotileGroups ?? []), desired]; changed = true;
    }
    const current = tileset.autotileGroups?.find(g => g.id === desired.id);
    if (!matchesWorldAutotileGroup(current, desired)) continue;
    if (!(tileset.tileGroups ?? []).some(g => g.id === desired.id)) {
      tileset.tileGroups = [...(tileset.tileGroups ?? []), { id: desired.id, name: desired.name, role: "terrain",
        defaultLayer: "lower", tileIds: [...desired.memberTileIds], source: "bundled-default", confidence: "high",
        description: "3×4 지형 블록. 하위 레이어에 칠하면 8방 이웃과 8×8 쿼터로 연결됩니다.",
        placementRules: "몸통 타일로 영역을 칠한다. 눈 숲·설산은 설원 안에 배치한다. 평야 240은 별도 바탕이다." }]; changed = true;
    }
    for (const tile of desired.memberTileIds) {
      const meta = tileset.tileMeta?.[tile];
      if (meta?.source === "user" || meta?.userLocked) continue;
      const override = worldTerrainMetadata(tile)!;
      if (meta && (meta.defaultLayer !== override.defaultLayer || meta.passage !== override.passage)) {
        tileset.tileMeta![tile] = { ...meta, ...override }; changed = true;
      }
      const pass = override.passage !== "solid", flag = { up: pass, down: pass, left: pass, right: pass };
      if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(flag)) { tileset.passability[tile] = flag; changed = true; }
      if (tileset.priority[tile] !== "lower") { tileset.priority[tile] = "lower"; changed = true; }
    }
  }
  return changed;
}
