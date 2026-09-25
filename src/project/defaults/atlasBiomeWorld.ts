import sheet from "@/assets/atlasBiomeWorldSheet.json";
import type { AutotileGroup, TileGroupMetadata, TilesetDef } from "../types";
import { buildEdgeCornerInnerVariantMap } from "./autotileEngine";

// World sheet of the atlas biomes (scripts/content/build-atlas-biome-world.py): the bundled EasyRPG world sheet
// (0..479 unchanged, same passage, layers, sea coast and terrain groups) plus ten world terrain blocks for the new
// biomes (jungle, mushroom forest, blighted forest, taiga, crystal hills, red canyon hills, savanna, tundra, swamp,
// crystal plain — 480..599, the stock 3×4 block grammar) and 2×2 biome icons (600..).
export const ATLAS_BIOME_WORLD_TEXTURE = sheet.texture;
export const ATLAS_BIOME_WORLD_ID = "atlas_biome_world";
export const ATLAS_BIOME_WORLD_PREFIX = "atlas-world-";

function roles(anchor: number) {
  return { isolated: anchor, inner: anchor + 2, cornerNW: anchor + 30, edgeN: anchor + 31,
    cornerNE: anchor + 32, edgeW: anchor + 60, body: anchor + 61, edgeE: anchor + 62,
    cornerSW: anchor + 90, edgeS: anchor + 91, cornerSE: anchor + 92 };
}

/** Copy of the bundled world tileset (as the project seeds it) on this sheet, with the biome blocks and icons. */
export function createAtlasBiomeWorldTileset(world: TilesetDef): TilesetDef {
  const t = structuredClone(world);
  t.id = ATLAS_BIOME_WORLD_ID;
  t.name = "월드맵 · 바이옴 확장 (OPRN)";
  t.image = { type: "bundled", id: ATLAS_BIOME_WORLD_TEXTURE };
  // the stock sheet paints its object cells on the #ff678b key colour
  t.transparentColor = "#ff678b";
  const n = sheet.count;
  const old = t.count;
  t.count = n;
  for (let i = old; i < n; i++) {
    t.passability[i] = { up: true, down: true, left: true, right: true };
    t.priority[i] = "lower";
    t.terrain[i] = 0;
    if (t.tileMeta) t.tileMeta[i] = { label: "", description: "", source: "bundled-default" };
  }
  const autotiles: AutotileGroup[] = [], groups: TileGroupMetadata[] = [];
  for (const b of sheet.blocks) {
    const members = Object.values(roles(b.anchor));
    autotiles.push({ id: ATLAS_BIOME_WORLD_PREFIX + b.key, name: `월드맵 ${b.name}`, neighborhood: 8, memberTileIds: members,
      connectTileIds: members, variantMap: buildEdgeCornerInnerVariantMap(roles(b.anchor)) });
    groups.push({ id: ATLAS_BIOME_WORLD_PREFIX + b.key, name: `월드맵 ${b.name}`, role: "terrain", defaultLayer: "lower", tileIds: members,
      source: "bundled-default", confidence: "high",
      description: `3×4 지형 블록(바이옴 확장). 기본 월드 블록을 ${b.name} 색으로 다시 칠했다. 하위 레이어에 칠하면 8방 이웃으로 테두리가 잡힌다.`,
      placementRules: b.solid ? "몸통 타일로 영역을 칠한다. 지나갈 수 없는 지형이다. 길은 둘러 간다." : "몸통 타일로 영역을 칠한다. 걸어서 지나갈 수 있다." });
    for (const tile of members) {
      const pass = !b.solid;
      t.passability[tile] = { up: pass, down: pass, left: pass, right: pass };
      t.priority[tile] = "lower";
      if (t.tileMeta) t.tileMeta[tile] = { label: b.name, description: `월드맵 ${b.name} 지형`, source: "bundled-default" };
    }
  }
  for (const icon of sheet.icons) {
    const cells = icon.cells.flat();
    groups.push({ id: ATLAS_BIOME_WORLD_PREFIX + "icon-" + icon.key, name: `월드맵 아이콘 · ${icon.name}`, role: "prop", defaultLayer: "upper", tileIds: cells,
      source: "bundled-default", confidence: "high", description: `${icon.name} — 바이옴 지역을 표시하는 월드맵 아이콘.`,
      placementRules: "위층에 칸 모양 그대로 찍는다. 아래층은 그 바이옴 지형이나 평야. 지나갈 수 없다." });
    for (const tile of cells) {
      t.passability[tile] = { up: false, down: false, left: false, right: false };
      t.priority[tile] = "upper";
      if (t.tileMeta) t.tileMeta[tile] = { label: icon.name, description: `월드맵 아이콘 · ${icon.name}`, source: "bundled-default" };
    }
  }
  t.autotileGroups = [...(t.autotileGroups ?? []), ...autotiles];
  t.tileGroups = [...(t.tileGroups ?? []), ...groups];
  return t;
}
