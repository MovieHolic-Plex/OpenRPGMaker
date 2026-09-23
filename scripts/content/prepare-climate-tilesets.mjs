// Tileset data for the two climate sheets (build-climate-chipsets.py) → src/assets/climateVillageTilesets.json.
// One shared base (the diverse forest-village tileset without grafts: they are baked into the sheets) plus a small
// patch per climate: renamed labels, the snow sheet's appended ice tiles and its ice autotile.
// Usage: node scripts/content/prepare-climate-tilesets.mjs
import fs from "node:fs";
import assert from "node:assert/strict";

const cat = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const sheets = JSON.parse(fs.readFileSync("tiledata/climate-villages/sheets.json"));
const TS = cat.tileset;
assert.equal(TS.count, sheets.baseCount);
// structureKits stay out: the catalog's kits are dewbank-authored, not shipped forest_harmony kits, and would list as user objects.
const { kind, tileSize, tilesPerRow, terrain, priority, passability, tileMeta, tileGroups, autotileGroups } = structuredClone(TS);
const base = { kind, tileSize, tilesPerRow, terrain, priority, passability, tileMeta, tileGroups, autotileGroups };

const lower = new Set(), tree = new Set();
for (const m of Object.values(cat.maps)) for (const t of m.lowerTiles) if (t >= 0) lower.add(t);
for (let t = 960; t < 1110; t++) tree.add(t);
for (const g of TS.tileGrafts) if (g.sourceChipset === "tex_forest_harmony" && g.sourceTile >= 960 && g.sourceTile < 1110) tree.add(g.targetTile);
const roofs = new Set(sheets.roofTiles), water = new Set(sheets.volcano.lava);
const GROUND = /잔디|풀|초원|수풀/;
const label = (t) => TS.tileMeta[t]?.label ?? "";

function relabel(prefixes, note) {
  const patch = {};
  TS.tileMeta.forEach((meta, t) => {
    if (!meta?.label) return;
    let prefix = null;
    if (water.has(t) && prefixes.water) prefix = prefixes.water;
    else if (tree.has(t)) prefix = prefixes.tree;
    else if (roofs.has(t)) prefix = prefixes.roof;
    else if (lower.has(t) && GROUND.test(meta.label)) prefix = prefixes.ground;
    if (!prefix || meta.label.startsWith(prefix)) return;
    patch[t] = { ...meta, label: `${prefix} ${meta.label}`, description: [meta.description, note].filter(Boolean).join(" ") };
  });
  return patch;
}

// ── snow: white ground, snow-capped trees and roofs, water stays open; frozen copies appended after the base ──
const snowMeta = relabel({ tree: "눈 얹힌", roof: "눈 덮인", ground: "눈 덮인" }, "설원판에서는 눈으로 칠해져 있다(칸 번호·통행은 숲마을과 같다).");
const ice = new Map(sheets.snow.ice);
const append = { terrain: [], priority: [], passability: [], tileMeta: [] };
for (const [source, target] of sheets.snow.ice) {
  assert.equal(target, TS.count + append.terrain.length);
  const fall = label(source).includes("폭포");
  const open = { up: true, down: true, left: true, right: true };
  append.terrain.push(fall ? TS.terrain[source] : 0);
  append.priority.push(TS.priority[source]);
  append.passability.push(fall ? structuredClone(TS.passability[source]) : open);
  append.tileMeta.push({
    ...structuredClone(TS.tileMeta[source] ?? {}),
    role: fall ? "water" : "terrain",
    label: `얼음판 · ${label(source) || "물 " + source}`,
    passage: fall ? "solid" : "passable",
    terrainTag: fall ? TS.terrain[source] : 0,
    tags: ["ice", "frozen", "snow"],
    defaultLayer: "lower",
    description: `물 칸 ${source}의 얼음 사본. ${fall ? "얼어붙은 폭포라 지나갈 수 없다." : "얼어붙어 걸어서 건널 수 있다."} 못 전체를 같은 대응으로 바꾸면 물가 모양이 그대로 유지된다.`,
    source: "bundled-default",
  });
}
const lake = TS.autotileGroups.find((g) => g.id === "forest_harmony_lake_47");
const toIce = (t) => ice.get(t) ?? t;
const iceGroup = {
  ...structuredClone(lake),
  id: "forest_harmony_ice_47",
  name: "얼어붙은 못 · 얼음판(걸을 수 있음)",
  variantMap: Object.fromEntries(Object.entries(lake.variantMap).map(([mask, t]) => [mask, toIce(t)])),
  memberTileIds: lake.memberTileIds.map(toIce),
  connectTileIds: lake.connectTileIds.map(toIce),
};

// ── volcano: ash ground, charred trees, every water tile painted as lava, wooden bridges as basalt ──
const volcanoMeta = relabel({ water: "용암 ·", tree: "그을린", ground: "재 덮인" }, "화산판 색으로 칠해져 있다(칸 번호·통행은 숲마을과 같다).");
for (const t of sheets.volcano.stoneBridges) {
  volcanoMeta[t] = { ...TS.tileMeta[t], label: label(t).replace("나무다리", "현무암 다리"), description: "화산판에서는 용암 위를 건너는 검은 돌다리로 칠해져 있다. 통행은 원래 나무다리와 같다." };
}

const out = {
  base,
  climates: {
    snow: {
      id: "forest_harmony_snow", textureKey: "tex_forest_harmony_snow", name: "설원 마을 · 눈 덮인 숲마을", count: sheets.snow.count,
      append, metaPatch: snowMeta, extraAutotileGroups: [iceGroup], autotileNames: {},
    },
    volcano: {
      id: "forest_harmony_volcano", textureKey: "tex_forest_harmony_volcano", name: "화산 마을 · 재와 용암의 숲마을", count: sheets.volcano.count,
      append: { terrain: [], priority: [], passability: [], tileMeta: [] }, metaPatch: volcanoMeta, extraAutotileGroups: [],
      autotileNames: { forest_harmony_lake_47: "용암 못 · 자연 가장자리(물 칸과 같은 번호, 통행 불가)" },
    },
  },
};
fs.writeFileSync("src/assets/climateVillageTilesets.json", JSON.stringify(out) + "\n");
console.log({
  bytes: fs.statSync("src/assets/climateVillageTilesets.json").size,
  snowRelabels: Object.keys(snowMeta).length, volcanoRelabels: Object.keys(volcanoMeta).length, ice: append.terrain.length,
});
