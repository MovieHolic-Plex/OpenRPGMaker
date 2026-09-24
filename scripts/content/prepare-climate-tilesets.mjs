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
const BARE = sheets.bareTrees, TERRAIN_FIRST = sheets.terrain.first;
const BARE_NAMES = {
  desert: { tree: "바랜 고목", shrub: "마른 덤불", tag: "사막", note: "햇볕에 바랜 잎 없는 고목" },
  volcano: { tree: "그을린 고목", shrub: "그을린 덤불", tag: "화산", note: "불씨가 박힌 그을린 잎 없는 고목" },
  snow: { tree: "눈 얹힌 고목", shrub: "눈 얹힌 마른 덤불", tag: "설원", note: "가지에 눈이 얹힌 잎 없는 고목" },
};
const SIZE = { big: "큰", mid: "중간", small: "작은", shrub: "" };
const PLACE_RULE = "잎 없는 나무: 한 덩이로 찍는다(수관 칸은 상위·통과, 밑동 줄은 하위·통행 불가, 도장의 -1 칸은 비운다). 빈 땅(240)에만, 집·길·문 앞·계단 끝·다리 끝·울타리에서 2칸 밖에. 낱개로 흩뿌리지 말고 큰/중간 한 그루 + 곁나무 1~2 + 밑동 옆 바위·마른 덤불로 덩이를 짓고, 맵 가장자리 띠는 8칸·안쪽은 13칸 간격. 밑동을 일렬로 늘어세우지 않는다(위아래 한 줄·가로 10칸 안 3그루까지, 가장자리 덩이는 0~3줄 들쭉날쭉, 맵 끝 줄·끝 칸 밑동 금지). 다른 나무와 칸을 겹치지 않는다(한 칸에 위층 하나).";
const unused = () => ({ label: "미사용", source: "unknown" });
function bareTrees(climate, from) {
  const names = BARE_NAMES[climate], rows = { terrain: [], priority: [], passability: [], tileMeta: [] };
  const cell = new Map();
  for (const st of BARE.stamps) st.tiles.forEach((t, k) => { if (t >= 0) cell.set(t, { st, dx: k % st.w, dy: Math.floor(k / st.w) }); });
  const shut = { up: false, down: false, left: false, right: false }, open = { up: true, down: true, left: true, right: true };
  for (let t = from; t < TERRAIN_FIRST; t++) {
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

// ── climate ground (build-climate-chipsets.py → climate-terrain.py): from 3030, each sheet draws only its own block ──
// Volcano: lava cracks (N/E/S/W autotile), cooled lava plates and small lava pools (47 blob autotiles), fumaroles,
// sulfur, basalt columns, obsidian, ash heaps. Desert: ripple sand, cracked dry earth (47 blob), dunes, sandstone
// mesas, cacti, bones, a half-buried column. Snow: snow-capped copies of the castle tops.
const TERRAIN = sheets.terrain;
const T_NAMES = {
  crack: "용암 균열", plate: "식은 용암 판", pool: "작은 용암 웅덩이", sulfur: "유황 얼룩", obsidian: "흑요석 조각", ash: "재 더미",
  fumarole: "분기공", basalt: "현무암 기둥 무리", ripple: "모래 물결", cracked: "갈라진 마른 땅", dune: "사구", mesa: "사암 메사",
  cactus: "선인장", bones: "짐승 뼈", column: "반쯤 묻힌 돌기둥",
};
const T_RULES = {
  crack: "용암 균열: 1칸 폭으로 가지 치며 이어지는 길(autotile volcano_lava_crack, 네 방향 이웃으로 칸을 고른다). 한 줄기 8~20칸, 식은 용암 판·용암 웅덩이 가장자리에서 시작해 재밭으로 뻗는다. 2×2 로 뭉치지 않는다. 길·문·집·계단 1칸 밖. 지나갈 수 있다(아래 레이어).",
  plate: "식은 용암 판: 2×2 칸 덩이를 이어 붙인 3×3 이상 덩이(autotile volcano_lava_plate_47). 한 칸 폭 꼬리 금지, 네모 그대로 두지 말고 모서리를 깎는다. 속칸(255)은 본체 3종을 섞는다. 재밭의 큰 빈 땅을 이 판과 균열로 채운다. 지나갈 수 있다.",
  pool: "작은 용암 웅덩이: 2×2 칸 덩이 2~4개(autotile volcano_lava_pool_47), 굳은 껍질 테두리. 맵마다 한두 곳, 집·길에서 2칸 밖. 지나갈 수 없다.",
  sulfur: "유황 얼룩: 분기공·균열 곁에 1~2칸. 흩뿌리지 않는다. 지나갈 수 있다.",
  obsidian: "흑요석 조각: 용암 균열에 붙여 한두 개만(균열 곁 말고는 두지 않는다). 지나갈 수 없다(위 레이어).",
  ash: "재 더미: 균열·분기공 곁에만 한두 개. 지나갈 수 없다(위 레이어).",
  fumarole: "분기공: 구멍(아래, 통행 불가) 위 칸에 연기(위, 통과). 연기 두 그림은 같은 분기공의 다른 모양이다(엔진에 타일 움직임이 없어 한 장씩 고른다). 맵마다 1~3곳, 유황 얼룩과 함께.",
  basalt: "현무암 기둥 무리: 한 덩이로 찍는다(-1 칸은 비운다). 맵 가장자리·절벽 밑에 맵마다 한두 무리. 통행 불가.",
  ripple: "모래 물결: 모래 바닥 변형 4종. 2×2 이상 덩어리 무늬로 깔고 네 종류를 섞는다(한 칸씩 흩뿌리지 않는다). 사구 곁·트인 모래밭. 지나갈 수 있다.",
  cracked: "갈라진 마른 땅: 2×2 칸 덩이를 이어 붙인 덩이(autotile desert_cracked_earth_47). 오아시스에서 먼 트인 곳에 한두 덩이. 지나갈 수 있다.",
  dune: "사구: 한 덩이로 찍는다(-1 칸은 비운다, 아래 레이어, 지나갈 수 있다). 맵 가장자리 띠와 트인 모래밭에 크기(3×2·4×3·6×3)를 섞어 둔다. 집·길 1칸 밖, 서로 겹치지 않는다.",
  mesa: "사암 메사: 한 덩이로 찍는다(-1 칸은 비운다). 맵마다 0~2개, 가장자리나 길 없는 곳. 통행 불가.",
  cactus: "선인장: 기둥 선인장(1×2, 윗칸 통과·아랫칸 불가)·통 선인장·꽃 핀 선인장. 두세 그루를 한 무리로, 맵 전체에 서너 무리까지. 한 그루씩 흩뿌리지 않는다.",
  bones: "짐승 뼈: 길 없는 외딴 곳 한 곳만. 통행 불가.",
  column: "반쯤 묻힌 돌기둥: 길 없는 외딴 곳 한두 곳, 뼈와 함께 두어도 된다. 통행 불가.",
};
const LAYERS = {
  // kind → (dy, h) → [layer, solid]
  crack: () => ["lower", false], plate: () => ["lower", false], ripple: () => ["lower", false], cracked: () => ["lower", false],
  sulfur: () => ["lower", false], dune: () => ["lower", false], pool: () => ["lower", true], basalt: () => ["lower", true], mesa: () => ["lower", true],
  obsidian: () => ["upper", true], ash: () => ["upper", true], bones: () => ["upper", true],
  fumarole: (dy) => (dy === 0 ? ["upper", false] : ["lower", true]),
  cactus: (dy, h) => (h === 2 && dy === 0 ? ["upper", false] : ["upper", true]),
  column: (dy) => (dy === 0 ? ["upper", false] : ["upper", true]),
};
const CLIMATE_TAG = { volcano: "화산", desert: "사막", snow: "설원" };
function terrainRows(climate, from, count) {
  const rows = { terrain: [], priority: [], passability: [], tileMeta: [] };
  const cell = new Map();
  for (const st of TERRAIN.stamps) if (st.climate === climate) st.tiles.forEach((t, k) => { if (t >= 0) cell.set(t, { st, dx: k % st.w, dy: Math.floor(k / st.w) }); });
  const walls = new Map(climate === "snow" ? TERRAIN.snowWalls.map(([src, dst]) => [dst, src]) : []);
  const shut = { up: false, down: false, left: false, right: false }, open = { up: true, down: true, left: true, right: true };
  for (let t = from; t < count; t++) {
    const src = walls.get(t);
    if (src != null) {  // snow-capped castle top: same passage, layer and backing as its source
      const meta = TS.tileMeta[src] ?? {};
      rows.terrain.push(TS.terrain[src]); rows.priority.push(TS.priority[src]); rows.passability.push(structuredClone(TS.passability[src]));
      rows.tileMeta.push({ ...structuredClone(meta), label: `눈 쌓인 ${meta.label ?? "성벽 " + src}`, tags: [...(meta.tags ?? []), "눈", "설원", "눈 쌓인 성벽"],
        description: `성벽·성탑 윗면 칸 ${src}에 눈이 쌓인 사본(흰 눈 + 푸른 회색 윤곽 1px). 설원 맵의 성벽·성탑·문루에서 ${src} 대신 쓴다. 통행·레이어는 ${src}와 같다.` });
      continue;
    }
    const c = cell.get(t);
    rows.terrain.push(0);
    if (!c) { rows.priority.push("lower"); rows.passability.push({ ...shut }); rows.tileMeta.push(unused()); continue; }
    const { st, dx, dy } = c, [layer, solid] = LAYERS[st.kind](dy, st.h);
    const name = T_NAMES[st.kind], part = st.id.slice(st.kind === "cactus" || st.kind === "column" ? 0 : st.kind.length + 1);
    rows.priority.push(layer);
    rows.passability.push(solid ? { ...shut } : { ...open });
    rows.tileMeta.push({
      role: { pool: "water", basalt: "rock", mesa: "rock", obsidian: "rock", ash: "rock", bones: "prop", column: "prop", cactus: "plant" }[st.kind] ?? "terrain",
      tags: ["기후 지형", CLIMATE_TAG[climate], name, ...(st.kind === "pool" || st.kind === "crack" ? ["용암", "lava"] : [])],
      label: `${name} · ${part}${st.w * st.h > 1 ? ` (${dx + 1},${dy + 1})` : ""}`,
      source: "user", origin: "user", locked: true, userLocked: true,
      passage: solid ? "solid" : layer === "upper" ? "star" : "passable", defaultLayer: layer, layerBacking: layer === "upper" ? "none" : "none",
      terrainTag: 0, confidence: "high",
      description: `${CLIMATE_TAG[climate]}판 ${name} (${st.id}). ${T_RULES[st.kind]}`,
    });
  }
  const groups = TERRAIN.stamps.filter((st) => st.climate === climate && !["crack", "plate", "pool", "cracked", "ripple"].includes(st.kind)).map((st) => {
    const lowerTiles = [], upperTiles = [], tileIds = [], cellLayers = [];
    st.tiles.forEach((t, k) => {
      const [layer] = LAYERS[st.kind](Math.floor(k / st.w), st.h);
      if (t >= 0) { tileIds.push(t); cellLayers.push(layer); }
      lowerTiles.push(t < 0 ? -1 : layer === "lower" ? t : 240); upperTiles.push(t < 0 || layer === "lower" ? -1 : t);
    });
    return {
      id: `climate-terrain:${st.id}`, name: `${CLIMATE_TAG[climate]} 지형 · ${T_NAMES[st.kind]} ${st.id}`,
      role: st.kind === "cactus" ? "plant" : ["dune", "sulfur"].includes(st.kind) ? "terrain" : "prop", source: "bundled-default",
      tileIds, layerHome: "perCell", cellLayers, confidence: "high",
      previewMap: { width: st.w, height: st.h, lowerTiles, upperTiles },
      sourceRect: { x: st.col * 16, y: (TERRAIN.first / 30 + st.row) * 16, width: st.w * 16, height: st.h * 16 },
      description: `${CLIMATE_TAG[climate]}판 ${T_NAMES[st.kind]} ${st.w}×${st.h}. ${T_RULES[st.kind]}`,
      defaultLayer: cellLayers.every((l) => l === "upper") ? "upper" : cellLayers.every((l) => l === "lower") ? "lower" : "mixed",
      patternGrammar: { kind: "source_rect", parts: [], repeat: "source_order", preserveCaps: false },
      placementRules: T_RULES[st.kind],
    };
  });
  const ripple = TERRAIN.stamps.filter((st) => st.climate === climate && st.kind === "ripple");
  if (ripple.length) groups.push({
    id: "climate-terrain:ripple", name: "사막 지형 · 모래 물결 바닥 4종", role: "terrain", source: "bundled-default",
    tileIds: ripple.map((st) => st.tiles[0]), layerHome: "perCell", cellLayers: ripple.map(() => "lower"), confidence: "high",
    previewMap: { width: ripple.length, height: 1, lowerTiles: ripple.map((st) => st.tiles[0]), upperTiles: ripple.map(() => -1) },
    sourceRect: { x: ripple[0].col * 16, y: (TERRAIN.first / 30 + ripple[0].row) * 16, width: ripple.length * 16, height: 16 },
    description: `모래 바닥 변형 4종(물결 줄이 칸 옆변에서 이어진다). ${T_RULES.ripple}`, defaultLayer: "lower",
    patternGrammar: { kind: "source_rect", parts: [], repeat: "source_order", preserveCaps: false }, placementRules: T_RULES.ripple,
  });
  const AUTO = { volcano: [["plate", "volcano_lava_plate_47"], ["pool", "volcano_lava_pool_47"], ["crack", "volcano_lava_crack"]], desert: [["cracked", "desert_cracked_earth_47"]], snow: [] }[climate];
  const autotiles = AUTO.map(([k, id]) => {
    const g = TERRAIN.autotiles[k];
    return { id, name: `${T_NAMES[k]} · ${k === "crack" ? "1칸 폭 네 방향 연결" : "자연 가장자리(2×2 덩이)"}`, neighborhood: 8, memberTileIds: g.members, connectTileIds: g.members,
      variantMap: g.variantMap, ...(g.interior ? { interiorVariants: [[g.body, ...g.interior], [g.body, ...g.interior]] } : {}), description: T_RULES[k] };
  });
  return { rows, groups, autotiles };
}
const ground = Object.fromEntries(["snow", "volcano", "desert"].map((k) => [k, terrainRows(k, sheets.bareTrees.first + 150, sheets[k].count)]));
const withBare = (k, a) => ({ terrain: [...a.terrain, ...bare[k].rows.terrain, ...ground[k].rows.terrain], priority: [...a.priority, ...bare[k].rows.priority, ...ground[k].rows.priority], passability: [...a.passability, ...bare[k].rows.passability, ...ground[k].rows.passability], tileMeta: [...a.tileMeta, ...bare[k].rows.tileMeta, ...ground[k].rows.tileMeta] });

const out = {
  base,
  climates: {
    snow: {
      id: "forest_harmony_snow", textureKey: "tex_forest_harmony_snow", name: "설원 마을 · 눈 덮인 숲마을", count: sheets.snow.count,
      append: withBare("snow", append), metaPatch: snowMeta, extraAutotileGroups: [iceGroup], extraTileGroups: [...bare.snow.groups, ...ground.snow.groups], autotileNames: {},
    },
    volcano: {
      id: "forest_harmony_volcano", textureKey: "tex_forest_harmony_volcano", name: "화산 마을 · 재와 용암의 숲마을", count: sheets.volcano.count,
      append: withBare("volcano", none), metaPatch: volcanoMeta, extraAutotileGroups: ground.volcano.autotiles, extraTileGroups: [...bare.volcano.groups, ...ground.volcano.groups],
      autotileNames: { forest_harmony_lake_47: "용암 못 · 자연 가장자리(물 칸과 같은 번호, 통행 불가)" },
    },
    desert: {
      id: "forest_harmony_desert", textureKey: "tex_forest_harmony_desert", name: "사막 마을 · 모래와 사암의 숲마을", count: sheets.desert.count,
      append: withBare("desert", none), metaPatch: desertMeta, extraAutotileGroups: ground.desert.autotiles, extraTileGroups: [...bare.desert.groups, ...ground.desert.groups], autotileNames: { forest_harmony_lake_47: "오아시스 못 · 자연 가장자리" },
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
