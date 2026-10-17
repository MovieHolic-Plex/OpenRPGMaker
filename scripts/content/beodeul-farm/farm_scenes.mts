// 버들항 농장(beodeul_farm) 조립 장면 · 구조 검사 · 참고문서.
//
//   npx tsx scripts/content/beodeul-farm/farm_scenes.mts [--out DIR] [--refs]
//
// 실제 번들 타일셋(createBlankProject 의 beodeul_city)과 엔진 렌더러(scripts/qa-game/render.mts renderMapPng)로
// 농장 장면 다섯을 원본 해상도로 그린다. 밭 흙은 엔진 오토타일(autotileVariantForCell)로 모양을 잡고, 기물은 번들 키트를 찍는다.
// 장면마다 구조 검사(checkFarm)를 돌려 결함을 좌표로 적는다 — 구조·통행 범위만 본다(미적 품질은 사람이 그림으로 본다).
// --refs 는 참고문서(tiledata/beodeul-farm/*.md, public/assets/beodeul-farm/*.png, src/assets/beodeulCityReferences.json 의 beodeul-farm 용도)를 쓴다.
import fs from "node:fs";
import path from "node:path";
import { createBlankProject } from "../../../src/project/defaults.ts";
import { autotileVariantForCell } from "../../../src/project/defaults/autotileEngine.ts";
import type { AutotileGroup, GameMap, Project, StructureKitDef, TilesetDef } from "../../../src/project/types.ts";
import { renderMapPng } from "../../qa-game/render.mts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const args = process.argv.slice(2);
const OUT = path.resolve(ROOT, args.includes("--out") ? args[args.indexOf("--out") + 1]! : "verify-shots/beodeul-farm");
const REFS = args.includes("--refs");

// ---- 칸 번호(bake_farm.py 와 같다: 꼬리 27,648 + 행×128 + 열) ----
const BASE = 27648, COLS = 128;
const tid = (r: number, c: number) => BASE + r * COLS + c;
const FENCE = Object.fromEntries(["h", "v", "cNW", "cNE", "cSW", "cSE", "gate", "endW", "endE", "vN", "vS", "post", "vE"].map((n, i) => [n, tid(5, i)])) as Record<string, number>;
const CROP = Object.fromEntries(["wheat_sprout", "wheat_young", "wheat_mature", "cabbage_sprout", "cabbage_young", "cabbage_mature",
  "tomato_sprout", "tomato_young", "tomato_mature", "seeded"].map((n, i) => [n, tid(4, i)])) as Record<string, number>;
const FENCE_LINKS: Record<number, string> = { [FENCE.h!]: "WE", [FENCE.v!]: "NS", [FENCE.cNW!]: "ES", [FENCE.cNE!]: "WS", [FENCE.cSW!]: "EN",
  [FENCE.cSE!]: "WN", [FENCE.gate!]: "WE", [FENCE.endW!]: "E", [FENCE.endE!]: "W", [FENCE.vN!]: "S", [FENCE.vS!]: "N", [FENCE.post!]: "", [FENCE.vE!]: "NS" };
const GRASS = 737;
// 3판 새 칸: 풀 무늬(행 1, 열 32~37) — 넓은 풀밭이 납작하지 않게 드문드문 섞는다.
const GRASS_VARS = [0, 1, 2, 3, 4, 5].map((i) => tid(1, 32 + i));

type Scene = { id: string; name: string; map: GameMap; occ: Map<number, string>; notes: string[]; doors: Array<{ x: number; y: number; kit: string }> };

function newScene(p: Project, id: string, name: string, w: number, h: number): Scene {
  const base = structuredClone(p.maps[p.startMapId]!) as GameMap;
  const map = { ...base, id, name, width: w, height: h, tilesetId: "beodeul_city", events: [] } as GameMap;
  const n = w * h;
  (map as { lowerTiles: number[] }).lowerTiles = Array(n).fill(GRASS);
  for (const k of ["upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const) if (k in base || k === "upperTiles") (map as Record<string, unknown>)[k] = Array(n).fill(-1);
  delete (map as { relief?: unknown }).relief;
  p.maps[id] = map;
  return { id, name, map, occ: new Map(), notes: [], doors: [] };
}

const at = (s: Scene, x: number, y: number) => y * s.map.width + x;
const inMap = (s: Scene, x: number, y: number) => x >= 0 && y >= 0 && x < s.map.width && y < s.map.height;

function setUpper(s: Scene, x: number, y: number, t: number, who: string) {
  if (!inMap(s, x, y) || t < 0) return;
  const i = at(s, x, y);
  const prev = s.occ.get(i);
  if (prev && prev !== who) s.notes.push(`overlap (${x},${y}) ${who} 가 ${prev} 위에 겹침`);
  (s.map.upperTiles as number[])[i] = t;
  s.occ.set(i, who);
}

function paintGroup(s: Scene, group: AutotileGroup, cells: Array<[number, number]>) {
  const lower = s.map.lowerTiles as number[];
  const body = group.variantMap["255"] ?? group.memberTileIds[0]!;
  for (const [x, y] of cells) if (inMap(s, x, y)) lower[at(s, x, y)] = body;
  const view = { width: s.map.width, height: s.map.height, lowerTiles: lower };
  // 칠한 칸과 그 둘레를 다시 맞춘다(이웃이 바뀌면 둘레 칸 모양도 바뀐다).
  const touch = new Set<number>();
  for (const [x, y] of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(s, x + dx, y + dy)) touch.add(at(s, x + dx, y + dy));
  const members = new Set(group.memberTileIds);
  for (const i of touch) {
    if (!members.has(lower[i]!)) continue;
    const v = autotileVariantForCell(view, group, i % s.map.width, Math.floor(i / s.map.width));
    if (typeof v === "number") lower[i] = v;
  }
}

const rect = (x0: number, y0: number, w: number, h: number) => {
  const out: Array<[number, number]> = [];
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.push([x, y]);
  return out;
};

function kit(ts: TilesetDef, id: string): StructureKitDef {
  const k = ts.structureKits?.find((kit) => kit.id === id);
  if (!k) throw new Error(`키트 없음: ${id}`);
  return k;
}

function stampKit(s: Scene, ts: TilesetDef, id: string, x0: number, y0: number) {
  const k = kit(ts, id);
  k.rows.forEach((row, dy) => {
    (row.tiles ?? []).forEach((t, dx) => { if (t >= 0 && inMap(s, x0 + dx, y0 + dy)) (s.map.lowerTiles as number[])[at(s, x0 + dx, y0 + dy)] = t; });
    (row.upperTiles ?? []).forEach((t, dx) => setUpper(s, x0 + dx, y0 + dy, t, id));
  });
  for (const part of k.parts ?? []) if (part.kind === "entrance") s.doors.push({ x: x0 + part.dx, y: y0 + part.dy, kit: id });
}

/** 밭: 흙 오토타일 + 줄마다 작물(앞에서부터 crops[0] = 맨 뒤 줄). wet 면 물 준 흙. */
function field(s: Scene, ts: TilesetDef, x0: number, y0: number, w: number, crops: Array<string | null>, wet = false) {
  const g = ts.autotileGroups!.find((a) => a.id === (wet ? "farmland_watered" : "farmland"))!;
  paintGroup(s, g, rect(x0, y0, w, crops.length));
  crops.forEach((c, dy) => { if (c) for (let dx = 0; dx < w; dx++) setUpper(s, x0 + dx, y0 + dy, CROP[c]!, `field@${x0},${y0}`); });
}

/** 둘레 울타리 W×H(바깥 테), 문은 아래 줄 gateX(상대). */
function fenceRing(s: Scene, x0: number, y0: number, w: number, h: number, gateX?: number) {
  const who = `fence@${x0},${y0}`;
  for (let x = 1; x < w - 1; x++) { setUpper(s, x0 + x, y0, FENCE.h!, who); setUpper(s, x0 + x, y0 + h - 1, x === gateX ? FENCE.gate! : FENCE.h!, who); }
  for (let y = 1; y < h - 1; y++) { setUpper(s, x0, y0 + y, FENCE.v!, who); setUpper(s, x0 + w - 1, y0 + y, FENCE.vE!, who); }
  setUpper(s, x0, y0, FENCE.cNW!, who); setUpper(s, x0 + w - 1, y0, FENCE.cNE!, who);
  setUpper(s, x0, y0 + h - 1, FENCE.cSW!, who); setUpper(s, x0 + w - 1, y0 + h - 1, FENCE.cSE!, who);
  if (gateX !== undefined) s.doors.push({ x: x0 + gateX, y: y0 + h - 1, kit: who });
}

/** 농가 흙길(3판 `beodeul_farm_lane`, 반듯한 가장자리). 2판의 모랫길(들쭉날쭉한 윤곽) 대신 쓴다. */
function sand(s: Scene, ts: TilesetDef, cells: Array<[number, number]>) {
  paintGroup(s, ts.autotileGroups!.find((a) => a.id === "beodeul_farm_lane")!, cells);
}

/** 마을 큰길(버들항 포석). */
function road(s: Scene, ts: TilesetDef, cells: Array<[number, number]>) {
  paintGroup(s, ts.autotileGroups!.find((a) => a.id === "beodeul_road_autotile")!, cells);
}

/** 나무·덤불(버들항 키트) — 윗층이 비었고 땅이 풀인 칸에만. */
function tree(s: Scene, ts: TilesetDef, id: string, x0: number, y0: number) {
  const k = kit(ts, id);
  const lower = s.map.lowerTiles as number[];
  const ok = k.rows.every((row, dy) => (row.upperTiles ?? []).every((t, dx) => t < 0 || (inMap(s, x0 + dx, y0 + dy) && !s.occ.has(at(s, x0 + dx, y0 + dy)) && lower[at(s, x0 + dx, y0 + dy)] === GRASS)));
  if (!ok) { s.notes.push(`overlap (${x0},${y0}) ${id} 자리가 비지 않았다`); return; }
  stampKit(s, ts, id, x0, y0);
}

/** 풀 무늬 흩기: 바탕 잔디 칸 중 약 1/7 을 무늬 칸으로(같은 무늬가 이웃하지 않게, 결정적). */
function dressGrass(s: Scene, seed = 7) {
  const lower = s.map.lowerTiles as number[], upper = s.map.upperTiles as number[];
  const W = s.map.width;
  for (let i = 0; i < lower.length; i++) {
    if (lower[i] !== GRASS || upper[i]! >= 0) continue;
    const h = Math.imul(i + seed * 7919, 2654435761) >>> 0;
    if (h % 7 !== 0) continue;
    const v = GRASS_VARS[(h >>> 8) % GRASS_VARS.length]!;
    if (lower[i - 1] === v || lower[i - W] === v || GRASS_VARS.includes(lower[i - 1]!) && GRASS_VARS.includes(lower[i - W]!)) continue;
    lower[i] = v;
  }
}

// ---------------------------------------------------------------- 구조 검사
type Defect = { code: string; x: number; y: number; note: string };

export function checkFarm(s: Scene, ts: TilesetDef): Defect[] {
  const out: Defect[] = [];
  const { width: W, height: H } = s.map;
  const lower = s.map.lowerTiles as number[], upper = s.map.upperTiles as number[];
  const dry = ts.autotileGroups!.find((g) => g.id === "farmland")!, wet = ts.autotileGroups!.find((g) => g.id === "farmland_watered")!;
  const soil = new Set([...dry.memberTileIds, ...wet.memberTileIds]);
  const crops = new Set(Object.values(CROP));
  const fences = new Set(Object.values(FENCE));
  const objectCells = new Set(ts.tileGroups?.find((g) => g.id === "beodeul:farm_buildings")?.tileIds ?? []);
  const passable = (x: number, y: number) => {
    if (!inMap(s, x, y)) return false;
    const u = upper[at(s, x, y)]!, l = lower[at(s, x, y)]!;
    const pu = u >= 0 ? ts.passability[u] : undefined, pl = ts.passability[l];
    return (!pu || pu.up || ts.tileMeta?.[u]?.passage === "star") && (!!pl?.up);
  };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, u = upper[i]!, l = lower[i]!;
    if (crops.has(u) && !soil.has(l)) out.push({ code: "crop-off-soil", x, y, note: "작물이 경작지 밖(풀·길) 위에 있다" });
    for (const g of [dry, wet]) if (g.memberTileIds.includes(l)) {
      const v = autotileVariantForCell({ width: W, height: H, lowerTiles: lower }, g, x, y);
      if (v !== undefined && v !== l) out.push({ code: "farmland-edge-mismatch", x, y, note: `경작지 칸 ${l} ≠ 이웃 모양 ${v}` });
    }
    if (fences.has(u)) {
      for (const d of FENCE_LINKS[u] ?? "") {
        const [dx, dy, back] = d === "N" ? [0, -1, "S"] : d === "S" ? [0, 1, "N"] : d === "W" ? [-1, 0, "E"] : [1, 0, "W"];
        const n = inMap(s, x + dx, y + dy) ? upper[at(s, x + dx, y + dy)]! : -1;
        if (!fences.has(n) || !(FENCE_LINKS[n] ?? "").includes(back)) out.push({ code: "fence-gap", x, y, note: `울타리가 ${d} 쪽에서 끊긴다` });
      }
      if (u === FENCE.gate && !passable(x, y + 1)) out.push({ code: "gate-blocked", x, y: y + 1, note: "울타리 문 앞 칸이 막혔다" });
    }
    if ((objectCells.has(u) || fences.has(u)) && soil.has(l)) out.push({ code: "object-on-soil", x, y, note: "건물·울타리가 경작지 흙 위에 있다" });
  }
  // 문(키트 entrance·울타리 문) 앞 칸은 길(모랫길·포석)이어야 한다 — 길 없는 건물·울타리는 떠 있다(QA 1차 결함 7).
  const paths = new Set(ts.autotileGroups!.filter((g) => ["beodeul_sand_autotile", "beodeul_road_autotile", "beodeul_farm_lane"].includes(g.id)).flatMap((g) => g.memberTileIds));
  for (const d of s.doors) {
    if (!inMap(s, d.x, d.y + 1) || !paths.has(lower[at(s, d.x, d.y + 1)]!)) out.push({ code: "door-unreached", x: d.x, y: d.y + 1, note: `${d.kit} 문 앞 칸이 길이 아니다` });
  }
  for (const note of s.notes) {
    const m = /\((\d+),(\d+)\)/.exec(note);
    out.push({ code: "overlap", x: Number(m?.[1] ?? -1), y: Number(m?.[2] ?? -1), note });
  }
  return out;
}

// ---------------------------------------------------------------- 장면
function scenes(p: Project): Scene[] {
  const ts = p.tilesets.beodeul_city!;
  const list: Scene[] = [];

  // 1. 밭 조각보: 작물·단계가 다른 밭 덩이를 흙길이 가른다.
  {
    const s = newScene(p, "farm_patchwork", "밭 조각보(모든 단계)", 32, 20);
    sand(s, ts, [...rect(0, 9, 32, 2), ...rect(15, 0, 2, 20)]);
    field(s, ts, 1, 2, 6, ["wheat_mature", "wheat_mature", "wheat_young", "wheat_sprout"]);
    field(s, ts, 8, 2, 5, ["cabbage_mature", "cabbage_mature", "cabbage_young", "cabbage_sprout"]);
    field(s, ts, 18, 2, 5, ["tomato_mature", "tomato_young", "tomato_young", "tomato_sprout"]);
    field(s, ts, 24, 2, 6, [null, "seeded", "seeded", "wheat_sprout"]);
    field(s, ts, 1, 12, 7, ["wheat_mature", "wheat_mature", "wheat_mature", "wheat_mature", "wheat_young"]);
    field(s, ts, 9, 13, 4, [null, null, null]);
    stampKit(s, ts, "bd-farm-fenced-plot", 18, 12);
    sand(s, ts, [...rect(21, 18, 1, 2), ...rect(17, 19, 4, 1)]);
    field(s, ts, 26, 13, 5, ["cabbage_young", "cabbage_young", "cabbage_sprout"], true);
    stampKit(s, ts, "bd-pick-riverside-mill-haystack", 13, 4);
    stampKit(s, ts, "bd-pick-riverside-mill-wheat-stooks-a", 9, 17);
    tree(s, ts, "bd-tree-f4f319", 30, 0); tree(s, ts, "bd-tree-47e17a", 0, 17); tree(s, ts, "bd-tree-eef4bc", 13, 12); tree(s, ts, "bd-tree-c27062", 31, 12);
    tree(s, ts, "bd-tree-e9d9b3", 2, 18); tree(s, ts, "bd-tree-cc0fcb", 13, 15); tree(s, ts, "bd-tree-37f48b", 30, 18);
    dressGrass(s, 1);
    list.push(s);
  }
  // 2. 농가: 헛간·닭장·흙 마당·우물·물통·건초·울타리 밭·살림집.
  {
    const s = newScene(p, "farm_farmstead", "농가(헛간·울타리·우물)", 30, 22);
    sand(s, ts, [...rect(2, 8, 15, 3), ...rect(8, 11, 2, 11), ...rect(10, 19, 20, 2), ...rect(20, 8, 1, 2), ...rect(17, 9, 3, 1)]);
    stampKit(s, ts, "bd-farm-barn", 2, 2);
    stampKit(s, ts, "bd-farm-coop", 10, 5);
    stampKit(s, ts, "bd-farm-fenced-plot", 17, 2);
    stampKit(s, ts, "bd-prop-well_roofed", 14, 5);
    sand(s, ts, rect(10, 11, 7, 3));
    stampKit(s, ts, "bd-pick-walled-market-trough", 13, 11);
    stampKit(s, ts, "bd-pick-riverside-mill-haystack", 0, 5);
    stampKit(s, ts, "bd-pick-mining-valley-crates", 10, 11);
    stampKit(s, ts, "bd-pick-walled-market-hay-bales", 15, 12);
    stampKit(s, ts, "bd-house-h103_1", 2, 13);
    sand(s, ts, rect(4, 19, 4, 1));
    fenceRing(s, 19, 11, 9, 7, 4);
    sand(s, ts, rect(23, 18, 1, 1));
    stampKit(s, ts, "bd-pick-walled-market-trough", 21, 13);
    stampKit(s, ts, "bd-pick-coast-cliff-road-haystack", 24, 14);
    stampKit(s, ts, "bd-tree-f4f319", 27, 1);
    stampKit(s, ts, "bd-tree-47e17a", 27, 4);
    tree(s, ts, "bd-tree-e9d9b3", 0, 0); tree(s, ts, "bd-tree-f4f319", 0, 20); tree(s, ts, "bd-tree-eef4bc", 18, 12);
    tree(s, ts, "bd-tree-cc0fcb", 25, 0); tree(s, ts, "bd-tree-28ad5e", 28, 7); tree(s, ts, "bd-tree-c27062", 17, 15);
    dressGrass(s, 2);
    list.push(s);
  }
  // 3. 과수원·목장 가장자리: 나무 줄, 울타리 목장, 그 옆 밭.
  {
    const s = newScene(p, "farm_orchard_pasture", "과수원·목장 가장자리", 30, 20);
    sand(s, ts, [...rect(0, 10, 30, 2), ...rect(14, 12, 2, 8)]);
    const olives = ["bd-pick-vineyard-olive-a", "bd-pick-vineyard-olive-b", "bd-pick-vineyard-olive-c"];
    [[0, 0], [4, 0], [8, 0], [2, 5], [6, 5], [10, 5]].forEach(([x, y], i) => stampKit(s, ts, olives[i % 3]!, x!, y!));
    fenceRing(s, 16, 1, 12, 8, 6);
    sand(s, ts, rect(22, 9, 1, 1));
    stampKit(s, ts, "bd-pick-walled-market-trough", 18, 3);
    stampKit(s, ts, "bd-pick-coast-cliff-road-haystack", 23, 3);
    stampKit(s, ts, "bd-pick-walled-market-hay-bales", 24, 6);
    field(s, ts, 1, 13, 6, ["cabbage_mature", "cabbage_young", "cabbage_young", "cabbage_sprout"]);
    field(s, ts, 17, 13, 8, ["wheat_mature", "wheat_mature", "wheat_young", "wheat_young", "wheat_sprout"]);
    stampKit(s, ts, "bd-pick-riverside-mill-wheat-stooks-b", 26, 14);
    stampKit(s, ts, "bd-farm-coop", 10, 13);
    sand(s, ts, rect(10, 16, 4, 1));
    tree(s, ts, "bd-tree-e9d9b3", 26, 17); tree(s, ts, "bd-tree-eef4bc", 0, 17); tree(s, ts, "bd-tree-cc0fcb", 12, 1);
    dressGrass(s, 3);
    list.push(s);
  }
  // 4. 마을 텃밭: 살림집 곁 울타리 텃밭, 문에서 길로.
  {
    const s = newScene(p, "farm_village_plot", "마을 집 곁 텃밭", 24, 16);
    sand(s, ts, [...rect(0, 13, 24, 2), ...rect(4, 7, 1, 6), ...rect(15, 11, 1, 2)]);
    stampKit(s, ts, "bd-house-h101_0", 2, 1);
    fenceRing(s, 11, 2, 9, 9, 4);
    field(s, ts, 12, 3, 7, ["tomato_mature", "tomato_young", "cabbage_mature", "cabbage_young"]);
    field(s, ts, 12, 8, 7, ["seeded", "wheat_sprout"], true);
    stampKit(s, ts, "bd-prop-well_roofed", 7, 9);
    stampKit(s, ts, "bd-prop-crate_cabbage", 16, 12);
    stampKit(s, ts, "bd-tree-47e17a", 21, 2);
    tree(s, ts, "bd-tree-f4f319", 0, 9); tree(s, ts, "bd-tree-e9d9b3", 21, 9);
    tree(s, ts, "bd-tree-eef4bc", 23, 5); tree(s, ts, "bd-tree-cc0fcb", 21, 11); tree(s, ts, "bd-tree-28ad5e", 0, 4);
    dressGrass(s, 4);
    list.push(s);
  }
  // 5. 심는 중: 갓 간 흙 → 씨 뿌림 → 물 준 싹, 둑 끝 상자·자루.
  {
    const s = newScene(p, "farm_planting", "심는 중인 밭", 26, 16);
    sand(s, ts, [...rect(0, 12, 26, 2), ...rect(12, 1, 1, 11)]);
    field(s, ts, 1, 2, 10, [null, null, "seeded", "seeded", "seeded", "wheat_sprout", "wheat_sprout", "wheat_young"]);
    field(s, ts, 14, 2, 10, ["seeded", "cabbage_sprout", "cabbage_sprout", "cabbage_young", "cabbage_young"], true);
    field(s, ts, 14, 8, 10, [null, null, null]);
    stampKit(s, ts, "bd-pick-mining-valley-crates", 1, 14);
    stampKit(s, ts, "bd-pick-walled-market-hay-bales", 22, 14);
    stampKit(s, ts, "bd-prop-crate_cabbage", 13, 14);
    tree(s, ts, "bd-tree-37f48b", 24, 0); tree(s, ts, "bd-tree-e9d9b3", 0, 0);
    tree(s, ts, "bd-tree-eef4bc", 25, 8); tree(s, ts, "bd-tree-cc0fcb", 2, 0); tree(s, ts, "bd-tree-28ad5e", 13, 3);
    dressGrass(s, 5);
    list.push(s);
  }
  // 6. 마을 가장자리(3판): 버들항 포석 큰길과 민가 줄 바로 남쪽에 농가가 붙는다 — 같은 화면에서 화풍이 이어지는지 보는 장면.
  {
    const s = newScene(p, "farm_town_edge", "버들항 마을 가장자리의 농가", 34, 22);
    road(s, ts, rect(0, 10, 34, 2));
    stampKit(s, ts, "bd-house-h107_0", 1, 4);
    stampKit(s, ts, "bd-house-h101_0", 8, 4);
    tree(s, ts, "bd-tree-d43edd", 16, 3);
    field(s, ts, 22, 4, 8, ["wheat_mature", "wheat_mature", "wheat_young", "wheat_sprout"]);
    tree(s, ts, "bd-tree-f4f319", 31, 1);
    sand(s, ts, [...rect(17, 12, 2, 10), ...rect(2, 19, 15, 1), ...rect(19, 19, 10, 1), ...rect(28, 16, 1, 3)]);
    stampKit(s, ts, "bd-farm-fenced-plot", 1, 13);
    field(s, ts, 9, 13, 6, ["cabbage_mature", "tomato_mature", "tomato_young", "seeded"]);
    stampKit(s, ts, "bd-farm-barn", 21, 13);
    stampKit(s, ts, "bd-farm-coop", 28, 13);
    tree(s, ts, "bd-tree-eef4bc", 31, 18);
    tree(s, ts, "bd-tree-e9d9b3", 32, 14);
    // QA 3판: 버들항은 큰 나무·덤불·사이프러스를 덩이로 모은다 — 외톨이 나무만 있으면 휑했다
    tree(s, ts, "bd-tree-47e17a", 20, 6); tree(s, ts, "bd-tree-eef4bc", 15, 3); tree(s, ts, "bd-tree-37f48b", 30, 8);
    tree(s, ts, "bd-tree-3e8732", 0, 0); tree(s, ts, "bd-tree-c27062", 3, 0); tree(s, ts, "bd-tree-28ad5e", 4, 0);
    tree(s, ts, "bd-tree-cc0fcb", 13, 0); tree(s, ts, "bd-tree-f4f319", 15, 13); tree(s, ts, "bd-tree-e9d9b3", 0, 20);
    dressGrass(s, 6);
    list.push(s);
  }
  return list;
}

// ---------------------------------------------------------------- 실행
fs.mkdirSync(OUT, { recursive: true });
const p = createBlankProject();
const ts = p.tilesets.beodeul_city!;
const report: Record<string, unknown> = {};
const made = scenes(p);
for (const s of made) {
  fs.writeFileSync(path.join(OUT, `${s.id}.png`), renderMapPng(p, s.map).png);
  const defects = checkFarm(s, ts);
  report[s.id] = { name: s.name, size: [s.map.width, s.map.height], defects };
}
fs.writeFileSync(path.join(OUT, "check.json"), JSON.stringify(report, null, 1) + "\n");
console.log(JSON.stringify(Object.fromEntries(Object.entries(report).map(([k, v]) => [k, (v as { defects: Defect[] }).defects.length]))));

if (REFS) {
  const { writeFarmReferences } = await import("./farm_refs.mts");
  writeFarmReferences({ p, ts, made, checkFarm, FENCE, CROP, OUT, ROOT });
}
