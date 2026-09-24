import spec from "@/assets/forestTallGrass.json";
import type { AutotileGroup, TileAiMetadata, TileGroupMetadata, TilesetDef } from "../types";
import { buildEdgeCornerInnerVariantMap, type EdgeCornerInnerTileSet } from "./autotileEngine";

// Tall grass in three kinds for the forest atlas and its climate repaints (scripts/content/tiles/tall-grass-redraw.py).
// E (dark) keeps the old id and cells 243..335; F (light) and G (short) sit in blank cells of the base sheet
// (1124..1190), so the same numbers work in forest_harmony (2550/2730/2760 cells) and every climate sheet.
// One kind per patch: touching the forest canopy → E, next to houses/roads → G, otherwise F
// (placement helper scripts/content/lib/tall-grass.mjs).
export type TallGrassKind = "E" | "F" | "G";
type Role = keyof typeof spec.tiles.E;

const SUPPORTED_TEXTURES = new Set(["tex_forest_harmony", "tex_forest_harmony_snow", "tex_forest_harmony_volcano", "tex_forest_harmony_desert", "tex_forest_harmony_autumn"]);
const LEGACY_TILE_GROUP = "harness-combined-town-tall-grass-autotile";
const ROLE_NAMES: Record<Role, string> = {
  isolated: "외딴 포기", inner: "오목 모서리", NW: "북서 모서리", N: "북쪽 변", NE: "북동 모서리",
  W: "서쪽 변", body: "몸통", E: "동쪽 변", SW: "남서 모서리", S: "남쪽 변", SE: "남동 모서리",
};
const USE = "덩이마다 한 종류만 쓴다: 숲 수관에 닿는 덩이는 짙음, 집·길 곁 덩이는 짧음, 나머지 트인 풀밭은 밝음. "
  + "덩이는 2×2 이상, 1칸 폭 띠 금지, 볼록 모서리는 깎아 둥글게. 칸은 이웃에 맞춰 오토타일로 고른다(무작위 칸 금지). 통행 가능, 하위 레이어.";

export const FOREST_TALL_GRASS_KINDS: readonly {
  readonly kind: TallGrassKind; readonly groupId: string; readonly tileGroupId: string;
  readonly name: string; readonly short: string; readonly where: string;
}[] = [
  { kind: "E", groupId: "builtin_tall_grass", tileGroupId: LEGACY_TILE_GROUP, name: "키큰 풀 · 짙음(숲 가)", short: "짙음", where: "숲 수관에 닿는 덩이" },
  { kind: "F", groupId: "builtin_tall_grass_light", tileGroupId: "forest-tall-grass-light", name: "키큰 풀 · 밝음(트인 풀밭)", short: "밝음", where: "숲·집·길에서 떨어진 트인 풀밭 덩이" },
  { kind: "G", groupId: "builtin_tall_grass_short", tileGroupId: "forest-tall-grass-short", name: "키큰 풀 · 짧음(집·길 곁)", short: "짧음", where: "집·길 곁 덩이" },
];

function roleTiles(kind: TallGrassKind): Record<Role, number> { return spec.tiles[kind]; }

function engineTiles(kind: TallGrassKind): EdgeCornerInnerTileSet {
  const r = roleTiles(kind);
  return { isolated: r.isolated, inner: r.inner, cornerNW: r.NW, edgeN: r.N, cornerNE: r.NE, edgeW: r.W, body: r.body,
    edgeE: r.E, cornerSW: r.SW, edgeS: r.S, cornerSE: r.SE };
}

function members(kind: TallGrassKind): number[] {
  const r = roleTiles(kind);
  return [r.body, r.N, r.S, r.W, r.E, r.NW, r.NE, r.SW, r.SE, r.isolated, r.inner];
}

export function forestTallGrassTiles(kind: TallGrassKind): readonly number[] { return members(kind); }

function autotileGroup(kind: TallGrassKind): AutotileGroup {
  const info = FOREST_TALL_GRASS_KINDS.find(k => k.kind === kind)!;
  return { id: info.groupId, name: info.name, neighborhood: 8, memberTileIds: members(kind), connectTileIds: members(kind),
    variantMap: buildEdgeCornerInnerVariantMap(engineTiles(kind)) };
}

function tileGroup(kind: TallGrassKind): TileGroupMetadata {
  const info = FOREST_TALL_GRASS_KINDS.find(k => k.kind === kind)!, r = roleTiles(kind);
  return {
    // E keeps the shipped palette name so an exact material "키큰 풀" still resolves to this group (tileVocabulary).
    id: info.tileGroupId, name: kind === "E" ? "키큰 풀" : info.name, role: "terrain", source: "bundled-default", defaultLayer: "lower", layerHome: "lower",
    tileIds: members(kind), confidence: "high",
    description: `숲마을 키큰 풀 ${info.short} — ${info.where}에 깐다. 잔디 위 풀숲 덩이(인카운터 풀밭 상징으로도 쓴다). ${USE}`,
    placementRules: `하위 레이어 오토타일(${info.groupId}). ${USE} 헤드리스 저작은 scripts/content/lib/tall-grass.mjs 의 arrangeTallGrass.`,
    patternGrammar: {
      axis: "both", kind: "autotile_3x3", minWidth: 2, minHeight: 2, preserveCaps: true, repeat: "center",
      parts: [
        { role: "topLeft", tileIds: [r.NW] }, { role: "top", tileIds: [r.N] }, { role: "topRight", tileIds: [r.NE] },
        { role: "left", tileIds: [r.W] }, { role: "center", tileIds: [r.body] }, { role: "right", tileIds: [r.E] },
        { role: "bottomLeft", tileIds: [r.SW] }, { role: "bottom", tileIds: [r.S] }, { role: "bottomRight", tileIds: [r.SE] },
      ],
    },
  };
}

function tileMeta(kind: TallGrassKind, role: Role): TileAiMetadata {
  const info = FOREST_TALL_GRASS_KINDS.find(k => k.kind === kind)!;
  return { role: "terrain", label: `키큰 풀 · ${info.short} · ${ROLE_NAMES[role]}`, source: "bundled-default", passage: "passable",
    confidence: "high", terrainTag: 0, defaultLayer: "lower", repeatability: "auto",
    description: `${info.name}의 ${ROLE_NAMES[role]} 칸. ${info.where}. 오토타일 ${info.groupId} 이 이웃에 맞춰 고른다.` };
}

function setSlot(tileset: TilesetDef, tile: number, meta: TileAiMetadata): void {
  tileset.passability[tile] = { up: true, down: true, left: true, right: true };
  tileset.priority[tile] = "lower";
  tileset.terrain[tile] = 0;
  (tileset.tileMeta ??= [])[tile] = meta;
}

/** Old shipped grammar marked every tile as `center`, so fill tools scattered edge pieces at random. */
function isLegacyGrammar(group: TileGroupMetadata): boolean {
  return (group.patternGrammar?.parts.find(p => p.role === "center")?.tileIds.length ?? 0) > 1;
}

export function isForestTallGrassTileset(tileset: Pick<TilesetDef, "image" | "count">): boolean {
  return tileset.image.type === "bundled" && SUPPORTED_TEXTURES.has(tileset.image.id) && tileset.count > 1190;
}

/**
 * Give a forest atlas (forest_harmony or a climate sheet) the three tall grass kinds: rename the shipped E group,
 * add the F/G autotile groups with their cell metadata, fix the old all-center tile group grammar and add the F/G
 * tile groups. Edited names, grafted slots and user tile groups are left alone. Returns whether anything changed.
 */
export function ensureForestTallGrass(tileset: TilesetDef): boolean {
  if (!isForestTallGrassTileset(tileset)) return false;
  let changed = false;
  const grafted = new Set((tileset.tileGrafts ?? []).map(g => g.targetTile));
  for (const info of FOREST_TALL_GRASS_KINDS) {
    const groups = tileset.autotileGroups ??= [];
    const existing = groups.find(g => g.id === info.groupId);
    if (existing) {
      if (info.kind === "E" && existing.name === "키큰 풀") { existing.name = info.name; changed = true; }
    } else {
      if (info.kind !== "E" && members(info.kind).some(t => grafted.has(t))) continue;
      groups.push(autotileGroup(info.kind));
      if (info.kind !== "E") for (const [role, tile] of Object.entries(roleTiles(info.kind)) as [Role, number][]) setSlot(tileset, tile, tileMeta(info.kind, role));
      changed = true;
    }
    if (info.kind === "E") for (const [role, tile] of Object.entries(roleTiles("E")) as [Role, number][]) {
      const own = tileset.tileMeta?.[tile];
      if (own && own.label === "키큰 풀" && !own.description) { tileset.tileMeta![tile] = { ...own, ...tileMeta("E", role) }; changed = true; }
    }
    const tileGroups = tileset.tileGroups ??= [];
    const index = tileGroups.findIndex(g => g.id === info.tileGroupId);
    if (index < 0) { tileGroups.push(tileGroup(info.kind)); changed = true; }
    else if (info.kind === "E" && tileGroups[index]!.source === "bundled-default" && isLegacyGrammar(tileGroups[index]!)) {
      tileGroups[index] = tileGroup("E"); changed = true;
    }
  }
  return changed;
}
