// Tileset data for the atlas biome sheets (build-atlas-biome-chipsets.py) → src/assets/atlasBiomeTilesets.json.
// The base cells 0..2729 are the diverse forest-village tileset (the same `base` the climate sheets ship in
// climateVillageTilesets.json — not copied again); per biome only a patch: relabelled base cells, the appended cells
// (ice copies, leafless trees, drawn pieces, blob grounds, border twins) with their layer / passage / backing, the
// piece stamps as tile groups (atlas-biome:<id>) and the blob grounds as autotile groups (atlas_<biome>_<ground>_47).
// Usage: node scripts/content/prepare-atlas-biome-tilesets.mjs
import fs from "node:fs";
import assert from "node:assert/strict";

const cat = JSON.parse(fs.readFileSync("tiledata/forest-villages/diverse/catalog.json"));
const climate = JSON.parse(fs.readFileSync("src/assets/climateVillageTilesets.json"));
const sheets = JSON.parse(fs.readFileSync("tiledata/atlas-biomes/sheets.json"));
const TS = cat.tileset, N = TS.count;
assert.equal(N, sheets.baseCount);
assert.equal(climate.base.tileMeta.length, N, "climate base must be the 2730-cell forest-village base");

const lower = new Set(), tree = new Set();
for (const m of Object.values(cat.maps)) for (const t of m.lowerTiles) if (t >= 0) lower.add(t);
for (let t = 960; t < 1110; t++) tree.add(t);
for (const g of TS.tileGrafts) if (g.sourceChipset === "tex_forest_harmony" && g.sourceTile >= 960 && g.sourceTile < 1110) tree.add(g.targetTile);
const water = new Set(sheets.water);
const GROUND = /잔디|풀|초원|수풀/;
const label = (t) => TS.tileMeta[t]?.label ?? "";
const shut = () => ({ up: false, down: false, left: false, right: false }), open = () => ({ up: true, down: true, left: true, right: true });
const unused = () => ({ label: "미사용", source: "unknown" });
// Lawn cells a lower tile may be backed with (240 and its texture variants): a border twin backs onto the neighbour lawn.
const LAWN = new Set([240, 241, 242, 270, 271, 272, 300, 301, 302, 330, 331, 332, 1140, 1141, 1142, 1143, 1144, 1145, 1146, 1147]);

// Relabel prefixes per biome (water / tree / ground), as the climate sheets do.
const PREFIX = {
  jungle: { water: "탁한 강물 ·", tree: "우림", ground: "우림" }, swamp: { water: "늪물 ·", tree: "늪", ground: "늪" },
  mushroom: { water: "빛 물 ·", tree: "보랏빛", ground: "푸른 이끼" }, crystal: { water: "빛나는 물 ·", tree: "은빛", ground: "수정 돌밭" },
  badlands: { water: "흙탕 강 ·", tree: "마른", ground: "붉은 흙" }, savanna: { water: "초원 물 ·", tree: "초원", ground: "금빛 풀" },
  taiga: { water: "찬 물 ·", tree: "눈 얹힌 침엽", ground: "이끼 언" }, tundra: { water: "찬 물 ·", tree: "관목", ground: "툰드라" },
  blight: { water: "독물 ·", tree: "오염된", ground: "오염된" }, skyisle: { water: "하늘 · 구름 아래(지나갈 수 없음) ·", tree: "하늘섬", ground: "하늘섬" },
  tropical: { water: "에메랄드 바다 ·", tree: "열대", ground: "열대" },
};
const TAG = Object.fromEntries(Object.entries(sheets.biomes).map(([k, b]) => [k, b.tag]));
// Only the new labels travel (the TS side merges them onto the shared base meta and appends `relabelNote`).
function relabel(k) {
  const pre = PREFIX[k], patch = {};
  TS.tileMeta.forEach((meta, t) => {
    if (!meta?.label) return;
    let p = null;
    if (water.has(t)) p = pre.water; else if (tree.has(t)) p = pre.tree; else if (lower.has(t) && GROUND.test(meta.label)) p = pre.ground;
    if (!p || meta.label.startsWith(p)) return;
    patch[t] = `${p} ${meta.label}`;
  });
  return patch;
}

// Role → [priority, passable, passage, backing]
const ROLE = { C: ["upper", true, "star", "none"], T: ["upper", false, "solid", "none"], B: ["lower", false, "solid", 240], b: ["lower", false, "solid", "none"],
  S: ["upper", false, "solid", "none"], W: ["upper", true, "star", "none"], O: ["upper", false, "solid", "none"], V: ["upper", false, "solid", "none"] };
const ROLE_NOTE = { C: "수관·윗부분: 위층, 지나갈 수 있다(사람 위에 그려진다)", T: "몸통: 위층, 지나갈 수 없다", B: "밑동: 아래층, 땅(240) 받침, 지나갈 수 없다",
  b: "밑동(이웃 땅에 구운 칸): 아래층, 받침 없음, 지나갈 수 없다", S: "위층, 지나갈 수 없다", W: "밟을 수 있는 장식: 위층, 지나갈 수 있다",
  O: "물(하늘) 칸 위 장식: 위층, 지나갈 수 없다", V: "절벽 덩굴: 절벽 몸통 칸 위층, 지나갈 수 없다" };
const CAT = { tree: "나무", plant: "식물", rock: "바위", crystal: "수정", water: "물 위 장식", cliff: "절벽 장식", landmark: "표지물", decal: "바닥 장식" };

// Leafless trees (bare-trees.py slots 2880..3029) in this biome's wood colours.
const BARE = sheets.bareTrees;
const BARE_NAMES = {
  badlands: { tree: "붉은 협곡 고목", shrub: "붉은 마른 덤불", note: "햇볕과 모래바람에 붉게 바랜 잎 없는 고목" },
  tundra: { tree: "눈 얹힌 툰드라 고목", shrub: "눈 얹힌 마른 덤불", note: "가지에 눈이 얹힌 잎 없는 고목" },
  blight: { tree: "오염된 뒤틀린 고목", shrub: "오염된 마른 덤불", note: "보랏빛 독기가 스민 검은 고목" },
};
const SIZE = { big: "큰", mid: "중간", small: "작은", shrub: "" };
const BARE_RULE = "잎 없는 나무: 한 덩이로 찍는다(수관 칸은 상위·통과, 밑동 줄은 하위·통행 불가, 도장의 -1 칸은 비운다). 빈 땅(240)에만, 길·문 앞·계단 끝·다리 끝에서 2칸 밖. 큰/중간 한 그루 + 곁나무 1~2 로 덩이를 짓고 밑동을 일렬로 늘어세우지 않는다(위아래 한 줄·가로 10칸 안 3그루까지).";

function build(k) {
  const b = sheets.biomes[k], count = b.count;
  const rows = { terrain: [], priority: [], passability: [], tileMeta: [] };
  for (let t = N; t < count; t++) { rows.terrain.push(0); rows.priority.push("lower"); rows.passability.push(shut()); rows.tileMeta.push(unused()); }
  const set = (t, pr, pass, meta, terrain = 0) => { const i = t - N; rows.priority[i] = pr; rows.passability[i] = pass; rows.tileMeta[i] = meta; rows.terrain[i] = terrain; };
  const extraAuto = [], groups = [];
  // ice copies
  if (b.ice) {
    for (const [src, dst] of b.ice) {
      const fall = label(src).includes("폭포");
      set(dst, TS.priority[src], fall ? structuredClone(TS.passability[src]) : open(), {
        ...structuredClone(TS.tileMeta[src] ?? {}), role: fall ? "water" : "terrain", label: `얼음판 · ${label(src) || "물 " + src}`, passage: fall ? "solid" : "passable",
        terrainTag: fall ? TS.terrain[src] : 0, tags: ["ice", "frozen", TAG[k]], defaultLayer: "lower",
        description: `물 칸 ${src}의 얼음 사본. ${fall ? "얼어붙은 폭포라 지나갈 수 없다." : "얼어붙어 걸어서 건널 수 있다."} 못 전체를 같은 대응으로 바꾸면 물가 모양이 그대로 유지된다.`, source: "bundled-default",
      }, fall ? TS.terrain[src] : 0);
    }
    const lake = TS.autotileGroups.find((g) => g.id === "forest_harmony_lake_47"), ice = new Map(b.ice), toIce = (t) => ice.get(t) ?? t;
    extraAuto.push({ ...structuredClone(lake), id: "forest_harmony_ice_47", name: "얼어붙은 못 · 얼음판(걸을 수 있음)",
      variantMap: Object.fromEntries(Object.entries(lake.variantMap).map(([m, t]) => [m, toIce(t)])), memberTileIds: lake.memberTileIds.map(toIce), connectTileIds: lake.connectTileIds.map(toIce) });
  }
  // leafless trees
  if (b.bare) {
    const names = BARE_NAMES[k];
    for (const st of BARE.stamps) {
      const shrub = st.kind === "shrub", n = st.id.split("-")[1], tileIds = [], cellLayers = [], lo = [], up = [];
      st.tiles.forEach((t, j) => {
        const dx = j % st.w, dy = Math.floor(j / st.w), base = !shrub && dy === st.h - 1;
        lo.push(t < 0 ? -1 : base ? t : shrub ? -1 : 240); up.push(t < 0 || base ? -1 : t);
        if (t < 0) return;
        tileIds.push(t); cellLayers.push(base ? "lower" : "upper");
        const name = shrub ? `${names.shrub} · ${n}` : `${names.tree} · ${SIZE[st.kind]} ${n}`;
        set(t, base ? "lower" : "upper", shrub || base ? shut() : open(), {
          role: shrub ? "plant" : "prop", tags: ["나무", "잎 없는 나무", "고목", "투명", TAG[k], shrub ? "덤불" : base ? "밑동" : "수관"],
          label: shrub ? name : `${name} (${dx + 1},${dy + 1})`, source: "user", origin: "user", locked: true, userLocked: true,
          passage: shrub || base ? "solid" : "star", defaultLayer: base ? "lower" : "upper", layerBacking: base ? 240 : "none", confidence: "high",
          description: shrub ? `${TAG[k]} 마른 덤불 1칸(위층, 통행 불가). 고목 밑동 옆에만 붙인다.` : `${names.note}(${st.w}×${st.h} bare-trees:${st.id})의 (${dx + 1},${dy + 1}). ${base ? "밑동 줄: 하위 레이어 + 땅(240) 받침, 지나갈 수 없다." : "수관·줄기: 상위, 지나갈 수 있다."}`,
        });
      });
      groups.push({ id: `bare-trees:${st.id}`, name: shrub ? `잎 없는 나무 · ${names.shrub} ${n}` : `잎 없는 나무 · ${names.tree} ${SIZE[st.kind]} ${n}`,
        role: shrub ? "plant" : "prop", source: "bundled-default", tileIds, layerHome: "perCell", cellLayers, confidence: "high",
        previewMap: { width: st.w, height: st.h, lowerTiles: lo, upperTiles: up }, sourceRect: { x: st.col * 16, y: (BARE.first / 30 + st.row) * 16, width: st.w * 16, height: st.h * 16 },
        description: `${names.note} ${st.w}×${st.h} 칸.`, defaultLayer: shrub ? "upper" : "mixed", patternGrammar: { kind: "source_rect", parts: [], repeat: "source_order", preserveCaps: false }, placementRules: BARE_RULE });
    }
  }
  // drawn pieces
  const nbBody = b.blobs.neighbour?.body;
  for (const p of b.pieces) {
    const tileIds = [], cellLayers = [], lo = [], up = [];
    p.tiles.forEach((t, j) => {
      const role = p.roles[j], dx = j % p.w, dy = Math.floor(j / p.w);
      if (t < 0) { lo.push(-1); up.push(-1); return; }
      const [pr, pass, passage, backing0] = ROLE[role];
      const backing = backing0 === 240 && p.neighbour ? nbBody : backing0;
      tileIds.push(t); cellLayers.push(pr);
      lo.push(pr === "lower" ? t : role === "O" || role === "V" ? -1 : p.neighbour ? nbBody : 240); up.push(pr === "upper" ? t : -1);
      set(t, pr, pass ? open() : shut(), {
        role: { tree: "prop", plant: "plant", rock: "rock", crystal: "rock", water: "prop", cliff: "prop", landmark: "prop", decal: "decor" }[p.cat],
        tags: ["바이옴", TAG[k], CAT[p.cat], p.name, ...(p.neighbour ? ["경계", "이웃 " + (sheets.biomes[p.neighbour]?.tag ?? "숲")] : [])],
        label: `${p.name}${p.w * p.h > 1 ? ` (${dx + 1},${dy + 1})` : ""}`, source: "user", origin: "user", locked: true, userLocked: true,
        passage, defaultLayer: pr, layerBacking: backing, confidence: "high",
        description: `${sheets.biomes[k].name} 시트의 ${p.name}(${p.w}×${p.h} atlas-biome:${p.id}). ${ROLE_NOTE[role]}. ${p.rule}`,
      });
    });
    groups.push({ id: `atlas-biome:${p.id}`, name: `${TAG[k]} · ${p.name}`, role: p.cat === "plant" ? "plant" : "prop", source: "bundled-default", tileIds, layerHome: "perCell", cellLayers, confidence: "high",
      previewMap: { width: p.w, height: p.h, lowerTiles: lo, upperTiles: up }, sourceRect: { x: p.col * 16, y: p.row * 16, width: p.w * 16, height: p.h * 16 },
      description: `${p.name} ${p.w}×${p.h}. ${p.rule}`, defaultLayer: cellLayers.every((l) => l === "upper") ? "upper" : cellLayers.every((l) => l === "lower") ? "lower" : "mixed",
      patternGrammar: { kind: "source_rect", parts: [], repeat: "source_order", preserveCaps: false }, placementRules: p.rule, ...(p.neighbour ? { neighbour: p.neighbour } : {}) });
  }
  // blob grounds
  for (const [gid, g] of Object.entries(b.blobs)) {
    const solid = g.kind === "pool", nbName = gid === "neighbour" ? (sheets.biomes[b.neighbour]?.name ?? "숲마을 · 푸른 숲") : null;
    const name = gid === "neighbour" ? `이웃 땅 · ${nbName}` : g.name;
    for (const t of g.members) set(t, "lower", solid ? shut() : open(), {
      role: solid ? "water" : "terrain", tags: ["바이옴 땅", TAG[k], name], label: `${name}${t === g.body ? " · 속" : g.interior.includes(t) ? " · 속 변형" : " · 가장자리"}`,
      source: "user", origin: "user", locked: true, userLocked: true, passage: solid ? "solid" : "passable", defaultLayer: "lower", layerBacking: "none", confidence: "high",
      description: `${name}: 2×2 칸 덩이를 이어 붙인 자연 가장자리(오토타일 atlas_${k}_${gid.replace(/-/g, "_")}_47). ${solid ? "지나갈 수 없다." : "지나갈 수 있다."}${gid === "neighbour" ? " 경계 필드에서 이웃 바이옴 쪽 땅을 덮는다(속칸 = 이웃 바이옴의 잔디)." : ""}`,
    });
    extraAuto.push({ id: `atlas_${k}_${gid.replace(/-/g, "_")}_47`, name: `${name} · 자연 가장자리(2×2 덩이)`, neighborhood: 8, memberTileIds: g.members, connectTileIds: g.members,
      variantMap: g.variantMap, interiorVariants: [[g.body, ...g.interior], [g.body, ...g.interior]], description: `${name}. ${solid ? "통행 불가." : "통행 가능."}` });
  }
  // border twins: same passage / layer as the source, lawn pixels show the neighbour; lawn backing → neighbour lawn body
  for (const [src, dst] of b.twins ?? []) {
    const meta = structuredClone(TS.tileMeta[src] ?? {});
    const backing = LAWN.has(Number(meta.layerBacking)) ? nbBody : meta.layerBacking;
    set(dst, TS.priority[src], structuredClone(TS.passability[src]), { ...meta, ...(backing !== undefined ? { layerBacking: backing } : {}),
      label: `이웃 땅 · ${meta.label ?? "칸 " + src}`, tags: [...(meta.tags ?? []), "경계", TAG[k]],
      description: `${src}번 칸의 경계 사본: 잔디 화소가 이웃 바이옴(${sheets.biomes[b.neighbour]?.tag ?? "숲"})의 땅으로 칠해져 있다. 경계 필드의 이웃 쪽에서 ${src} 대신 쓴다(통행·레이어는 ${src}와 같다).` }, TS.terrain[src]);
  }
  return { id: `atlas_biome_${k}`, textureKey: b.textureKey, name: `${b.name} (바이옴)`, count, append: rows, relabels: relabel(k), relabelNote: `${sheets.biomes[k].name} 시트 색으로 칠해져 있다(칸 번호·통행은 숲마을과 같다).`, extraAutotileGroups: extraAuto, extraTileGroups: groups,
    autotileNames: { forest_harmony_lake_47: k === "skyisle" ? "하늘 · 섬 가장자리(구름 바다, 통행 불가)" : `${PREFIX[k].water.replace(" ·", "")} · 자연 가장자리` },
    neighbour: b.neighbour ?? null, twins: b.twins ?? [], ice: b.ice ?? null };
}
const out = { biomes: Object.fromEntries(Object.keys(sheets.biomes).map((k) => [k, build(k)])) };
for (const [k, c] of Object.entries(out.biomes)) assert.equal(N + c.append.terrain.length, c.count, k);
fs.writeFileSync("src/assets/atlasBiomeTilesets.json", JSON.stringify(out) + "\n");
// Frame counts for src/assets/bundled.ts (kept tiny so the asset list does not pull the tileset data).
fs.writeFileSync("src/assets/atlasBiomeSheets.json", JSON.stringify(Object.fromEntries(Object.values(out.biomes).map((c) => [c.textureKey, c.count])), null, 1) + "\n");
console.log({ bytes: fs.statSync("src/assets/atlasBiomeTilesets.json").size, biomes: Object.fromEntries(Object.entries(out.biomes).map(([k, c]) => [k, { count: c.count, relabels: Object.keys(c.relabels).length, groups: c.extraTileGroups.length, autos: c.extraAutotileGroups.length }])) });
