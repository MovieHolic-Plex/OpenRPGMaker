import { buildEdgeCornerInnerVariantMap } from "./autotileEngine";
import { animationStripForTile } from "./chipsetAnimation";
import type { AutotileGroup, TileGroupMetadata, TilesetDef } from "../types";

/** World.png pixel audit: columns 0–2 are animated grass shores, NOT a 3×4 terrain block.
 * Rows 0/1/2/3 = outer/vertical/horizontal/inner; rows 4–7 = sea body.
 * Columns 3–5 rows 0–3 are snow shores; rows 4–7 are vertical water effects.
 */
export const WORLD_COAST_TEXTURE = "tex_easyrpg_chipset_world";
export const WORLD_COAST_GROUP_ID = "harness-world-coast-v1-sea";
export const WORLD_PLAIN_TILE = 240;
export const WORLD_SEA_TILE = 120;
export const WORLD_SEA_TILES = Array.from({ length: 8 }, (_, row) => [row * 30, row * 30 + 1, row * 30 + 2]).flat();
export const WORLD_SNOW_SHORE_TILES = [3, 4, 5, 33, 34, 35, 63, 64, 65, 93, 94, 95];
export const WORLD_WATER_TILES = [...WORLD_SEA_TILES, ...WORLD_SNOW_SHORE_TILES];
const sea = new Set(WORLD_SEA_TILES);
const water = new Set(WORLD_WATER_TILES);
export function isWorldWaterTile(tile: number): boolean { return water.has(tile); }
export function isWorldAnimatedTile(tile: number, tileset?: Pick<TilesetDef, "tileGrafts">): boolean {
  if (!water.has(tile) && ![123,124,125,153,154,155,183,184,185,213,214,215].includes(tile)) return false;
  const strip = animationStripForTile(tile);
  // A graft in any frame changes this strip's authored art. Keep its stored
  // frame still rather than switching the grafted image back to water.
  return Boolean(strip && (!tileset || !hasWorldAutotileGraft(tileset, strip.frames)));
}

export function isWorldTileset(tileset: Pick<TilesetDef, "image"> | undefined): boolean {
  return tileset?.image.type === "bundled" && tileset.image.id === WORLD_COAST_TEXTURE;
}

export function isWorldSeaTile(tile: number): boolean { return sea.has(tile); }

/** Fixed source geometry is invalid once any of its source slots is grafted. */
export function hasWorldAutotileGraft(tileset: Pick<TilesetDef, "tileGrafts">, sourceTiles: readonly number[]): boolean {
  return Boolean(tileset.tileGrafts?.some(graft => sourceTiles.includes(graft.targetTile)));
}

export function createWorldCoastAutotileGroup(): AutotileGroup {
  return {
    id: WORLD_COAST_GROUP_ID, name: "월드맵 바다·초원 해안", neighborhood: 8,
    memberTileIds: [...WORLD_WATER_TILES], connectTileIds: [...WORLD_WATER_TILES],
    variantMap: buildEdgeCornerInnerVariantMap({
      body: WORLD_SEA_TILE, isolated: 0, inner: 90,
      edgeN: 60, edgeS: 60, edgeW: 30, edgeE: 30,
      cornerNW: 0, cornerNE: 0, cornerSW: 0, cornerSE: 0,
    }),
  };
}

export function worldCoastAutotileGroup(tileset: Pick<TilesetDef, "image" | "autotileGroups" | "tileGrafts">): AutotileGroup | undefined {
  if (!isWorldTileset(tileset)) return undefined;
  const group = (tileset.autotileGroups ?? []).find(candidate => candidate.id === WORLD_COAST_GROUP_ID);
  if (!matchesCoast(group, WORLD_WATER_TILES) && !matchesCoast(group, WORLD_SEA_TILES)) return undefined;
  return group && !hasWorldAutotileGraft(tileset, group.memberTileIds) ? group : undefined;
}

export function hasWorldCoastMapping(tileset: Pick<TilesetDef, "image" | "autotileGroups" | "tileGrafts">): boolean {
  return Boolean(worldCoastAutotileGroup(tileset));
}
function matchesCoast(group: AutotileGroup | undefined, tiles: number[]): boolean {
  const same = (a: number[] | undefined) => a?.length === tiles.length && new Set(a).size === tiles.length && tiles.every(t => a.includes(t));
  return Boolean(group && group.neighborhood === 8 && same(group.memberTileIds) && same(group.connectTileIds)
    && Object.keys(group.variantMap).length === Object.keys(COAST_VARIANTS).length
    && Object.entries(COAST_VARIANTS).every(([mask, tile]) => group.variantMap[mask] === tile));
}

const COAST_VARIANTS = createWorldCoastAutotileGroup().variantMap;

/** Add defaults only into an unclaimed area. Authored groups and locked tile metadata win. */
export function seedWorldCoastMapping(tileset: TilesetDef): boolean {
  if (!isWorldTileset(tileset)) return false;
  let changed = false;
  let existing = tileset.autotileGroups ?? [];
  // Migrate only our exact old 24-slot grammar; authored edits opt out.
  const old = existing.find(g => g.id === WORLD_COAST_GROUP_ID);
  if (matchesCoast(old, WORLD_SEA_TILES) && !hasWorldAutotileGraft(tileset, WORLD_WATER_TILES)
    && !existing.some(g => g !== old && g.memberTileIds.some(t => WORLD_SNOW_SHORE_TILES.includes(t)))) {
    // Name, explicit trigger scope and other authored properties are independent
    // of the source-art migration. Only the two slot sets need expansion.
    tileset.autotileGroups = existing = existing.map(g => g === old
      ? { ...g, memberTileIds: [...WORLD_WATER_TILES], connectTileIds: [...WORLD_WATER_TILES] } : g);
    changed = true;
  }
  if (!hasWorldAutotileGraft(tileset, WORLD_WATER_TILES) && !existing.some(group => group.memberTileIds.some(isWorldWaterTile))) {
    tileset.autotileGroups = [...existing, createWorldCoastAutotileGroup()];
    changed = true;
  }
  const coast = worldCoastAutotileGroup(tileset);
  if (!coast) return changed;
  const supportsSnow = coast.memberTileIds.includes(3);
  const groups: TileGroupMetadata[] = [
    { id: WORLD_COAST_GROUP_ID, name: "월드맵 바다·초원 해안", role: "terrain", defaultLayer: "lower",
      tileIds: [...coast.memberTileIds], source: "bundled-default", confidence: "high",
      description: "바다 120을 칠하면 초원 해안이 연결됩니다. 통행 불가. 0 볼록·30 세로·60 가로·90 오목의 8×8 조각으로 렌더합니다.",
      placementRules: "평야 240을 바탕으로 바다 120을 칠한다. 해안은 물 칸이며 걷지 못한다. "
        + (supportsSnow ? "눈 지형 옆은 3/33/63/93 눈 해안 조각으로 합성한다. " : "눈 해안은 별도 사용자 영역이다. ")
        + "폭포는 별도 애니메이션이다." },
    { id: "harness-world-coast-v1-plain", name: "월드맵 초원 평야", role: "terrain", defaultLayer: "lower",
      tileIds: [WORLD_PLAIN_TILE], source: "bundled-default", confidence: "high",
      description: "통행 가능한 평야 바탕 240. 바다 주변의 육지와 섬·반도를 구성합니다.", placementRules: "단일 반복 바닥. 바다 해안 그룹에 편입하지 않는다." },
  ];
  for (const group of groups) {
    const prior = (tileset.tileGroups ?? []).find(current => current.id === group.id);
    if (supportsSnow && prior?.source === "bundled-default" && prior.id === WORLD_COAST_GROUP_ID && prior.tileIds.length === 24) {
      tileset.tileGroups = tileset.tileGroups!.map(current => current === prior ? group : current); changed = true;
    }
    if (!(tileset.tileGroups ?? []).some(current => current.id === group.id)) {
      tileset.tileGroups = [...(tileset.tileGroups ?? []), group];
      changed = true;
    }
  }
  for (const tile of [...coast.memberTileIds, WORLD_PLAIN_TILE]) {
    const meta = tileset.tileMeta?.[tile];
    if (meta?.source === "user" || meta?.userLocked) continue;
    const passable = tile === WORLD_PLAIN_TILE;
    const passage = passable ? "passable" : "solid";
    if (meta && (meta.defaultLayer !== "lower" || meta.passage !== passage)) {
      tileset.tileMeta![tile] = { ...meta, defaultLayer: "lower", passage };
      changed = true;
    }
    const flag = { up: passable, down: passable, left: passable, right: passable };
    if (JSON.stringify(tileset.passability[tile]) !== JSON.stringify(flag)) {
      tileset.passability[tile] = flag; changed = true;
    }
    if (tileset.priority[tile] !== "lower") { tileset.priority[tile] = "lower"; changed = true; }
  }
  return changed;
}
