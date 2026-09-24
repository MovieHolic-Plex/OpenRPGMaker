// Tileset data for the two climate sheets (build-climate-chipsets.py) → src/assets/climateVillageTilesets.json.
// One shared base (the diverse forest-village tileset without grafts: they are baked into the sheets) plus a small
// patch per climate: renamed labels, the snow sheet's appended ice tiles and its ice autotile, and (snow, volcano,
// desert) the leafless trees from 2880 with their bare-trees:* tile groups. Climates: snow, volcano, desert, autumn.
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

// ── desert: sand ground, dry scrub for leaves, sandstone cliffs, clay roofs; water stays as oasis water ──
const desertMeta = relabel({ tree: "마른", roof: "흙빛", ground: "모래 덮인" }, "사막판 색으로 칠해져 있다(칸 번호·통행은 숲마을과 같다).");
for (const t of sheets.desert.sandstone) {
  const meta = TS.tileMeta[t];
  if (meta?.label && !meta.label.startsWith("사암")) desertMeta[t] = { ...meta, label: `사암 ${meta.label}`, description: [meta.description, "사막판에서는 황토색 사암 절벽으로 칠해져 있다(통행은 숲마을과 같다)."].filter(Boolean).join(" ") };
}
// ── autumn: gold grass, autumn leaves (forest orange-maroon, broadleaf gold, bushes crimson) ──
const autumnMeta = relabel({ tree: "단풍 든", ground: "가을" }, "가을판 색으로 칠해져 있다(칸 번호·통행은 숲마을과 같다).");

const none = { terrain: [], priority: [], passability: [], tileMeta: [] };
// ── leafless trees (build-climate-chipsets.py → bare-trees.py): same slots from 2880 on snow, volcano and desert ──
// Crown rows: upper, walkable (drawn over the walker). Bottom row: the trunk base, lower on ground 240, solid.
// Shrubs 1×1: upper, solid. Cells a tree does not draw on are unused and stay -1 in every stamp.
const BARE = sheets.bareTrees;
const BARE_NAMES = {
  desert: { tree: "바랜 고목", shrub: "마른 덤불", tag: "사막", note: "햇볕에 바랜 잎 없는 고목" },
  volcano: { tree: "그을린 고목", shrub: "그을린 덤불", tag: "화산", note: "불씨가 박힌 그을린 잎 없는 고목" },
  snow: { tree: "눈 얹힌 고목", shrub: "눈 얹힌 마른 덤불", tag: "설원", note: "가지에 눈이 얹힌 잎 없는 고목" },
};
const SIZE = { big: "큰", mid: "중간", small: "작은", shrub: "" };
const PLACE_RULE = "잎 없는 나무: 한 덩이로 찍는다(수관 칸은 상위·통과, 밑동 줄은 하위·통행 불가, 도장의 -1 칸은 비운다). 빈 땅(240)에만, 집·길·문 앞·계단 끝·다리 끝·울타리에서 2칸 밖에. 낱개로 흩뿌리지 말고 큰/중간 한 그루 + 곁나무 1~2 + 밑동 옆 바위·마른 덤불로 덩이를 짓고, 맵 가장자리 띠는 8칸·안쪽은 13칸 간격. 다른 나무와 칸을 겹치지 않는다(한 칸에 위층 하나).";
const unused = () => ({ label: "미사용", source: "unknown" });
function bareTrees(climate, from) {
  const names = BARE_NAMES[climate], rows = { terrain: [], priority: [], passability: [], tileMeta: [] };
  const cell = new Map();
  for (const st of BARE.stamps) st.tiles.forEach((t, k) => { if (t >= 0) cell.set(t, { st, dx: k % st.w, dy: Math.floor(k / st.w) }); });
  const shut = { up: false, down: false, left: false, right: false }, open = { up: true, down: true, left: true, right: true };
  for (let t = from; t < sheets[climate].count; t++) {
    const c = cell.get(t);
    rows.terrain.push(0);
    if (!c) { rows.priority.push("lower"); rows.passability.push({ ...shut }); rows.tileMeta.push(unused()); continue; }
    const { st, dx, dy } = c, n = st.id.split("-")[1];
    const shrub = st.kind === "shrub", base = !shrub && dy === st.h - 1;
    const name = shrub ? `${names.shrub} · ${n}` : `${names.tree} · ${SIZE[st.kind]} ${n}`;
    rows.priority.push(base ? "lower" : "upper");
    rows.passability.push(shrub || base ? { ...shut } : { ...open });
    rows.tileMeta.push({
      role: shrub ? "plant" : "prop",
      tags: ["나무", "잎 없는 나무", "고목", "투명", names.tag, shrub ? "덤불" : base ? "밑동" : "수관"],
      label: shrub ? name : `${name} (${dx + 1},${dy + 1})`,
      // Locked like the forest-wall tiles: the renderers only honour defaultLayer / layerBacking on confirmed metadata.
      source: "user", origin: "user", locked: true, userLocked: true,
      passage: shrub || base ? "solid" : "star",
      defaultLayer: base ? "lower" : "upper",
      layerBacking: base ? 240 : "none",
      confidence: "high",
      description: shrub
        ? `${names.tag}판 마른 덤불 1칸(위층, 통행 불가). 잎 없는 나무 덩이의 밑동 옆에만 붙인다 — 낱개로 흩뿌리지 않는다.`
        : `${names.note}(${st.w}×${st.h} 칸 bare-trees:${st.id})의 (${dx + 1},${dy + 1}). ${base ? "밑동 줄: 하위 레이어에 땅(240) 받침과 함께, 지나갈 수 없다." : "수관·줄기: 상위 레이어로 사람 위에 그려지고 지나갈 수 있다."}`,
    });
  }
  const groups = BARE.stamps.map((st) => {
    const shrub = st.kind === "shrub", n = st.id.split("-")[1];
    const tileIds = [], cellLayers = [], lower = [], upper = [];
    st.tiles.forEach((t, k) => {
      const base = !shrub && Math.floor(k / st.w) === st.h - 1;
      if (t >= 0) { tileIds.push(t); cellLayers.push(base ? "lower" : "upper"); }
      lower.push(t < 0 ? -1 : base ? t : shrub ? -1 : 240);
      upper.push(t < 0 || base ? -1 : t);
    });
    return {
      id: `bare-trees:${st.id}`,
      name: shrub ? `잎 없는 나무 · ${names.shrub} ${n}` : `잎 없는 나무 · ${names.tree} ${SIZE[st.kind]} ${n}`,
      role: shrub ? "plant" : "prop", source: "bundled-default", tileIds, layerHome: "perCell", cellLayers, confidence: "high",
      previewMap: { width: st.w, height: st.h, lowerTiles: lower, upperTiles: upper },
      sourceRect: { x: st.col * 16, y: (BARE.first / 30 + st.row) * 16, width: st.w * 16, height: st.h * 16 },
      description: shrub
        ? `${names.tag}판 마른 덤불 1×1(위층, 통행 불가). 고목 밑동 옆에 붙여 덩이의 일부로만 쓴다.`
        : `${names.note} ${st.w}×${st.h} 칸. 수관·줄기는 상위(지나갈 수 있음), 밑동 줄은 하위+땅 받침(통행 불가). 그림이 없는 칸은 -1(도장에 넣지 않는다).`,
      defaultLayer: shrub ? "upper" : "mixed",
      patternGrammar: { kind: "source_rect", parts: [], repeat: "source_order", preserveCaps: false },
      placementRules: PLACE_RULE,
    };
  });
  return { rows, groups };
}
const bare = Object.fromEntries(BARE.climates.map((k) => [k, bareTrees(k, k === "snow" ? TS.count + append.terrain.length : TS.count)]));
const withBare = (k, a) => ({ terrain: [...a.terrain, ...bare[k].rows.terrain], priority: [...a.priority, ...bare[k].rows.priority], passability: [...a.passability, ...bare[k].rows.passability], tileMeta: [...a.tileMeta, ...bare[k].rows.tileMeta] });

const out = {
  base,
  climates: {
    snow: {
      id: "forest_harmony_snow", textureKey: "tex_forest_harmony_snow", name: "설원 마을 · 눈 덮인 숲마을", count: sheets.snow.count,
      append: withBare("snow", append), metaPatch: snowMeta, extraAutotileGroups: [iceGroup], extraTileGroups: bare.snow.groups, autotileNames: {},
    },
    volcano: {
      id: "forest_harmony_volcano", textureKey: "tex_forest_harmony_volcano", name: "화산 마을 · 재와 용암의 숲마을", count: sheets.volcano.count,
      append: withBare("volcano", none), metaPatch: volcanoMeta, extraAutotileGroups: [], extraTileGroups: bare.volcano.groups,
      autotileNames: { forest_harmony_lake_47: "용암 못 · 자연 가장자리(물 칸과 같은 번호, 통행 불가)" },
    },
    desert: {
      id: "forest_harmony_desert", textureKey: "tex_forest_harmony_desert", name: "사막 마을 · 모래와 사암의 숲마을", count: sheets.desert.count,
      append: withBare("desert", none), metaPatch: desertMeta, extraAutotileGroups: [], extraTileGroups: bare.desert.groups, autotileNames: { forest_harmony_lake_47: "오아시스 못 · 자연 가장자리" },
    },
    autumn: {
      id: "forest_harmony_autumn", textureKey: "tex_forest_harmony_autumn", name: "가을 마을 · 단풍 든 숲마을", count: sheets.autumn.count,
      append: none, metaPatch: autumnMeta, extraAutotileGroups: [], extraTileGroups: [], autotileNames: {},
    },
  },
};
fs.writeFileSync("src/assets/climateVillageTilesets.json", JSON.stringify(out) + "\n");
console.log({
  bytes: fs.statSync("src/assets/climateVillageTilesets.json").size,
  snowRelabels: Object.keys(snowMeta).length, volcanoRelabels: Object.keys(volcanoMeta).length, ice: append.terrain.length,
  desertRelabels: Object.keys(desertMeta).length, autumnRelabels: Object.keys(autumnMeta).length,
  bareTreeGroups: BARE.stamps.length, counts: Object.fromEntries(Object.entries(out.climates).map(([k, c]) => [k, [c.count, TS.count + c.append.terrain.length]])),
});
for (const c of Object.values(out.climates)) assert.equal(TS.count + c.append.terrain.length, c.count, c.id);
