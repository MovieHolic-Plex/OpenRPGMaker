// 버들항 이야기 기물(bd-obj-*, 시트 꼬리 34,944~) 참고문서 — 공용 번들 beodeulCityReferences.json 의 용도 `beodeul-objects` 를 만든다.
//
//   bun scripts/content/prepare-beodeul-objects-references.mts
//
// 하는 일(tiledata/AI-REFERENCE-CONTRACT.md): 정확한 사전(킷 id·칸 번호·층·통행) · 실행 순서 · 조립 예제 한 장면의 네 층 전체 배열 ·
// 원본 해상도 그림 · 정상/오류 나란한 그림(실제로 변조해 검출) · 자동 좌표 검사와 그 범위.
// 장면은 손으로 칸을 찍지 않고 실제 놓기 도구(stamp_tileset_object)로 놓는다 — 문서의 배열은 도구가 낸 그대로다.
// 쓰는 것: tiledata/beodeul-objects/{README.md,references.json,example.json,*.png}(정본) · public/assets/beodeul-objects/*.png(128색 학습 사본) ·
//          src/assets/beodeulCityReferences.json(용도 beodeul-objects 를 넣거나 바꾼다, 문서·그림 id 는 bd-obj- 머리라 번들 소유).
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 · 변형은 fable-variety-beodeul-2026-11-12 · 새 종류는 fable-objects100-beodeul-2026-11-14 · 마을 종류별 기물은 fable-objects300-beodeul-2026-11-14 (굽기: scripts/content/beodeul-objects/bake.py).
import fs from "node:fs";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createBlankProject } from "../../src/project/defaults/blankProject";
import { BEODEUL_OBJECTS_KIT_PREFIX } from "../../src/project/defaults/beodeulCity";
import { canMove, isPassable } from "../../src/project/collision";
import { layerTileAt, setLayerTileAt } from "../../src/project/mapLayers";
import { runTool } from "../../src/editor/tools";
import { buildingEntrances } from "../../src/ai/v2/place/entrances";
import type { GameMap, Project, StructureKitDef } from "../../src/project/types";
import { renderMapPng } from "../qa-game/render.mts";
import catalog from "../../tiledata/beodeul-objects/catalog.json";

const ROOT = "tiledata/beodeul-objects", PUB = "public/assets/beodeul-objects", REFS = "src/assets/beodeulCityReferences.json";
fs.mkdirSync(PUB, { recursive: true });
const GRASS = 737, T = 16;
const base = createBlankProject() as Project;
const ts = base.tilesets.beodeul_city!;
const kits = new Map((ts.structureKits ?? []).filter((k) => k.id.startsWith(BEODEUL_OBJECTS_KIT_PREFIX)).map((k) => [k.id, k] as const));
assert.equal(kits.size, catalog.items.length);
const shore = ts.autotileGroups!.find((g) => g.id === "beodeul_lakeshore_grass")!;
const item = (id: string) => catalog.items.find((i) => i.id === id)!;
// 이야기 기물 16종(원래 목록)과 종류별 변형(variantOf — 같은 종류의 옛 킷과 칸 크기·막힌 칸이 같은 다른 그림, 2026-11-12)
// 새 종류(2026-11-14, 면제 묶음 fable-objects100-beodeul-2026-11-14): 갈아 끼우는 그림이 아니라 새 물건 — 마을 살림·물가와 물 위·농장·숲 바닥·절벽 바위·유적과 묘지
type CatalogItem = (typeof catalog.items)[number] & { variantOf?: string; on?: string; kinds?: string[]; growth?: string };
const NEW_WAIVER = "fable-objects100-beodeul-2026-11-14";
const NEWS = (catalog.items as CatalogItem[]).filter((i) => i.waiver === NEW_WAIVER);
// 마을 종류별 기물(2026-11-14, 면제 묶음 fable-objects300-beodeul-2026-11-14): 마을 종류 38개의 생업 장면 벌과 공통 기물 — 킷 태그 kind:<종류 id>, 표는 kinds.json
const KIND_WAIVER = "fable-objects300-beodeul-2026-11-14";
const KINDS = (catalog.items as CatalogItem[]).filter((i) => i.waiver === KIND_WAIVER);
const KIND_NAMES = (JSON.parse(fs.readFileSync("tiledata/beodeul-objects/kinds.json", "utf8")) as { names: Record<string, string> }).names;
const KIND_ORDER = Object.keys(KIND_NAMES);
const STORY = (catalog.items as CatalogItem[]).filter((i) => !i.variantOf && i.waiver !== NEW_WAIVER && i.waiver !== KIND_WAIVER);
const VARIANTS = (catalog.items as CatalogItem[]).filter((i) => i.variantOf);
const allKits = new Map((ts.structureKits ?? []).map((k) => [k.id, k] as const));
const kitOf = (id: string): StructureKitDef => kits.get(BEODEUL_OBJECTS_KIT_PREFIX + id)!;

type Placement = { id: string; x: number; y: number };
function grassMap(project: Project, id: string, name: string, w: number, h: number): GameMap {
  const m = structuredClone(Object.values(project.maps)[0]!) as GameMap;
  Object.assign(m, { id, name, width: w, height: h, events: [], lowerTiles: Array(w * h).fill(GRASS), upperTiles: Array(w * h).fill(-1) });
  delete (m as unknown as Record<string, unknown>).terrainDesign;
  project.maps = { [id]: m }; project.startMapId = id; project.startPos = { x: 0, y: 0 };
  return m;
}
/** 물 칸(8이웃 호숫가 오토타일) — 물 덩이의 가장자리가 풀로 스며든다. */
function water(m: GameMap, cells: readonly (readonly [number, number])[]): void {
  const set = new Set(cells.map(([x, y]) => `${x},${y}`));
  const has = (x: number, y: number) => set.has(`${x},${y}`);
  for (const [x, y] of cells) {
    let mask = (has(x, y - 1) ? 1 : 0) | (has(x + 1, y) ? 2 : 0) | (has(x, y + 1) ? 4 : 0) | (has(x - 1, y) ? 8 : 0)
      | (has(x + 1, y - 1) ? 16 : 0) | (has(x + 1, y + 1) ? 32 : 0) | (has(x - 1, y + 1) ? 64 : 0) | (has(x - 1, y - 1) ? 128 : 0);
    for (const [c, a, b] of [[16, 1, 2], [32, 4, 2], [64, 4, 8], [128, 1, 8]] as const) if (!(mask & a && mask & b)) mask &= ~c;
    m.lowerTiles[y * m.width + x] = shore.variantMap![String(mask)]!;
  }
}
/** 실제 놓기 도구로 놓는다. 도구는 프로젝트를 새 객체로 바꾸므로 끝난 프로젝트·맵을 돌려준다. */
function stampAll(project: Project, mapId: string, list: readonly Placement[]): { project: Project; map: GameMap } {
  const ctx = { project, currentMapId: mapId, assistantRun: true };
  for (const p of list) {
    const res = runTool(ctx, "stamp_tileset_object", { mapId, objectId: kitOf(p.id).id, base: { x: p.x, y: p.y + item(p.id).height - 1 } });
    assert(res.ok, `${p.id} @(${p.x},${p.y}): ${res.summary}`);
  }
  return { project: ctx.project, map: ctx.project.maps[mapId]! };
}

type Finding = { code: string; x: number; y: number; what: string };
/** 구조·통행 좌표 검사. 확인하는 것만 확인한다: 킷 칸이 위층에 통째로 있는가 · 막힘/걸음이 선언과 같은가 · 입구 앞 접근칸이 비었는가 · 널빤지 길을 걸어 건널 수 있는가. */
function check(project: Project, m: GameMap, placed: readonly Placement[], walk: readonly (readonly [number, number])[]): Finding[] {
  const out: Finding[] = [];
  for (const p of placed) {
    const it = item(p.id), kit = kitOf(p.id);
    kit.rows.forEach((row, dy) => (row.upperTiles ?? []).forEach((t, dx) => {
      if (t < 0) return;
      const x = p.x + dx, y = p.y + dy, i = y * m.width + x;
      if (layerTileAt(m, 3, i) !== t) {
        const other = ([1, 2, 4] as const).find((layer) => layerTileAt(m, layer, i) === t);
        out.push({ code: other ? "wrong-layer" : "kit-incomplete", x, y, what: other ? `${kit.id} 칸 ${t} 이 ${other}층에 있다(3층이어야 한다)` : `${kit.id} 칸 ${t} 이 없다` });
        return;
      }
      // 물 위에 선 것(왜가리 말뚝·계류 말뚝)의 윗칸은 ★ 이지만 그 밑이 물이라 걸을 수 없다 — 물 위 것은 바닥 그림(징검돌·널)만 걸음 칸이다
      const overWater = (it as CatalogItem).on === "water" && it.place !== "decal";
      const blocked = overWater || it.block.some(([bx, by]) => bx === dx && by === dy);
      if (isPassable(project, m, x, y) === blocked) out.push({ code: "passage-mismatch", x, y, what: `${kit.id} (${dx},${dy}) 은 ${blocked ? "막힘" : "걸음"}이어야 한다` });
    }));
    for (const a of (kit.ai as { access?: { dx: number; dy: number }[] } | undefined)?.access ?? []) {
      const x = p.x + a.dx, y = p.y + a.dy, i = y * m.width + x;
      if (!isPassable(project, m, x, y) || layerTileAt(m, 3, i) >= 0) out.push({ code: "entrance-blocked", x, y, what: `${kit.id} 입구 앞 접근칸이 막혔다` });
    }
  }
  for (let i = 1; i < walk.length; i++) {
    const [ax, ay] = walk[i - 1]!, [bx, by] = walk[i]!;
    if (!canMove(project, m, ax, ay, bx, by)) { out.push({ code: "walk-blocked", x: bx, y: by, what: `(${ax},${ay})→(${bx},${by}) 걸음이 막혔다` }); break; }
  }
  return out;
}

// ── 장면 1: 사전 그림(16종을 목록 순서로 풀밭에 한 줄씩) ──
const AW = 26, AH = 9;
const atlasAt: Placement[] = [];
let atlasProject = structuredClone(base);
let atlas = grassMap(atlasProject, "map_bd_obj_atlas", "버들항 이야기 기물 사전", AW, AH);
{
  let x = 1, y = 1, rowH = 0;
  for (const it of STORY) {
    if (x + it.width > AW - 1) { x = 1; y += rowH + 1; rowH = 0; }
    atlasAt.push({ id: it.id, x, y }); x += it.width + 1; rowH = Math.max(rowH, it.height);
  }
  assert(y + rowH <= AH - 1, "사전 그림 높이가 모자란다");
  ({ project: atlasProject, map: atlas } = stampAll(atlasProject, atlas.id, atlasAt));
  const f = check(atlasProject, atlas, atlasAt, []);
  assert(f.length === 0, `사전 그림 결함: ${JSON.stringify(f.slice(0, 6))}`);
}

// ── 장면 2: 조립 예제 22×15 ──
const W = 22, H = 15;
let sceneProject = structuredClone(base);
let scene = grassMap(sceneProject, "map_bd_obj_example", "버들항 이야기 기물 조립 예제", W, H);
const POND: [number, number][] = [];
for (let y = 8; y <= 11; y++) for (let x = 2; x <= 7; x++) POND.push([x, y]);
water(scene, POND);
const placed: Placement[] = [
  { id: "cave-mouth", x: 2, y: 1 }, { id: "spring", x: 9, y: 2 }, { id: "notice-board", x: 13, y: 2 }, { id: "note", x: 14, y: 5 }, { id: "ruin-entrance", x: 17, y: 1 },
  { id: "plank-ew", x: 2, y: 9 }, { id: "plank-ew", x: 3, y: 9 }, { id: "plank-ew", x: 4, y: 9 }, { id: "plank-ew", x: 5, y: 9 }, { id: "plank-corner", x: 6, y: 9 },
  { id: "plank-ns", x: 6, y: 10 }, { id: "plank-ns", x: 6, y: 11 }, { id: "plank-ew", x: 2, y: 11 }, { id: "plank-ew", x: 3, y: 11 }, { id: "plank-end", x: 4, y: 11 },
  { id: "camp-tent", x: 10, y: 7 }, { id: "mining-tools", x: 13, y: 7 }, { id: "livestock-pen", x: 17, y: 7 },
  { id: "broken-pillar", x: 10, y: 11 }, { id: "seal-altar", x: 12, y: 11 }, { id: "broken-pillar", x: 15, y: 11 }, { id: "shard", x: 13, y: 13 }, { id: "record-stand", x: 17, y: 12 },
];
({ project: sceneProject, map: scene } = stampAll(sceneProject, scene.id, placed));
const WALK: [number, number][] = [[1, 9], [2, 9], [3, 9], [4, 9], [5, 9], [6, 9], [6, 10], [6, 11], [6, 12]];
{ const f = check(sceneProject, scene, placed, WALK); assert(f.length === 0, `조립 예제는 결함 0 이어야 한다: ${JSON.stringify(f.slice(0, 8))}`); }
assert.equal(STORY.length, 16); assert.equal(new Set(placed.map((p) => p.id)).size, STORY.length, "예제가 16종을 모두 쓴다");
// 물 위 널빤지가 실제로 물 칸의 막힘을 연다(널빤지를 빼면 같은 칸이 막힌다)
{
  const bare = structuredClone(sceneProject), bm = bare.maps[scene.id]!;
  setLayerTileAt(bm, 3, 9 * W + 3, -1);
  assert(!isPassable(bare, bm, 3, 9) && isPassable(sceneProject, scene, 3, 9));
}
// 입구 부품은 v2 가 읽는 선언(킷 parts entrance)으로 잡힌다
const entrances = buildingEntrances(sceneProject, scene).map((e) => { const p = e as unknown as { x: number; y: number }; return `${p.x},${p.y}`; });
assert(entrances.includes("3,3") && entrances.includes("18,3"), `입구 칸이 안 잡힌다: ${entrances.join(" ")}`);
// 놓기 도구는 통째로 놓거나 거절한다 — 거절하면 맵이 그대로다
{
  const trial = structuredClone(sceneProject), before = JSON.stringify(trial.maps[scene.id]);
  const res = runTool({ project: trial, currentMapId: scene.id, assistantRun: true }, "stamp_tileset_object", { mapId: scene.id, objectId: kitOf("camp-tent").id, base: { x: 17, y: 9 } });
  assert(!res.ok && JSON.stringify(trial.maps[scene.id]) === before, "막힌 자리 놓기는 거절되고 맵이 그대로여야 한다");
}

// ── 장면 3: 종류별 변형 — 종류마다 한 줄(맨 왼쪽 원본 킷, 그 오른쪽 변형들). 두 단으로 놓는다 ──
type VPlace = { kit: string; base: string; x: number; y: number; w: number; h: number };
const VW = 30;
const families = [...new Set(VARIANTS.map((v) => v.variantOf!))].map((baseId) => ({ base: allKits.get(baseId)!, items: VARIANTS.filter((v) => v.variantOf === baseId) }));
const vPlaced: VPlace[] = [];
let VH = 0;
{
  const colY = [1, 1];
  for (const f of families) {
    assert(f.base, "변형의 원본 킷이 타일셋에 없다");
    const col = colY[0]! <= colY[1]! ? 0 : 1;
    let x = 1 + col * 15;
    const y = colY[col]!;
    for (const kit of [f.base, ...f.items.map((v) => kitOf(v.id))]) { vPlaced.push({ kit: kit.id, base: f.base.id, x, y, w: kit.width, h: kit.height }); x += kit.width + 1; }
    assert(x <= 1 + col * 15 + 15, `변형 줄이 단 폭을 넘는다: ${f.base.id}`);
    colY[col] = y + f.base.height + 1;
  }
  VH = Math.max(...colY);
}
let variantProject = structuredClone(base);
let variantScene = grassMap(variantProject, "map_bd_obj_variants", "버들항 기물 종류별 변형", VW, VH);
{
  // 열쇠 없는 실행(ctx.lookKey 없음) — 적은 id 그대로 찍힌다(게임 열쇠로 고르는 것은 조수 실행뿐이다)
  const ctx = { project: variantProject, currentMapId: variantScene.id, assistantRun: true };
  for (const p of vPlaced) {
    const res = runTool(ctx, "stamp_tileset_object", { mapId: variantScene.id, objectId: p.kit, base: { x: p.x, y: p.y + p.h - 1 } });
    assert(res.ok, `${p.kit} @(${p.x},${p.y}): ${res.summary}`);
  }
  variantProject = ctx.project; variantScene = ctx.project.maps[variantScene.id]!;
}
/** 변형 검사: 킷 칸이 3층에 통째로 있는가 · 변형의 칸마다 통행이 원본 킷의 같은 칸과 같은가(갈아 끼워도 배치·통행이 그대로인가). */
function checkVariants(project: Project, m: GameMap): Finding[] {
  const out: Finding[] = [];
  const at = new Map(vPlaced.map((p) => [p.kit, p] as const));
  for (const p of vPlaced) {
    const kit = allKits.get(p.kit)!, b = at.get(p.base)!;
    kit.rows.forEach((row, dy) => (row.upperTiles ?? []).forEach((t, dx) => {
      if (t < 0) return;
      const x = p.x + dx, y = p.y + dy, i = y * m.width + x;
      if (layerTileAt(m, 3, i) !== t) {
        const other = ([1, 2, 4] as const).find((layer) => layerTileAt(m, layer, i) === t);
        out.push({ code: other ? "wrong-layer" : "kit-incomplete", x, y, what: other ? `${kit.id} 칸 ${t} 이 ${other}층에 있다(3층이어야 한다)` : `${kit.id} 칸 ${t} 이 없다` });
      }
    }));
    if (p.kit === p.base) continue;
    for (let dy = 0; dy < p.h; dy++) for (let dx = 0; dx < p.w; dx++) {
      if (isPassable(project, m, p.x + dx, p.y + dy) !== isPassable(project, m, b.x + dx, b.y + dy)) out.push({ code: "variant-passage", x: p.x + dx, y: p.y + dy, what: `${kit.id} (${dx},${dy}) 의 통행이 원본 ${p.base} 의 같은 칸과 다르다` });
    }
  }
  return out;
}
{ const f = checkVariants(variantProject, variantScene); assert(f.length === 0, `변형 장면은 결함 0 이어야 한다: ${JSON.stringify(f.slice(0, 8))}`); }
const vAt = (kitId: string) => vPlaced.find((p) => p.kit === kitId)!;
const V_MUTATIONS: Mutation[] = [
  { code: "kit-incomplete", cell: [vAt("bd-obj-lamp-lantern").x, vAt("bd-obj-lamp-lantern").y], title: "변형 가로등 윗칸 빠짐", how: "기둥 등 가로등(1×3)의 맨 윗칸을 뺐다 — 등이 잘린다.",
    apply: (_p, m) => setLayerTileAt(m, 3, vAt("bd-obj-lamp-lantern").y * VW + vAt("bd-obj-lamp-lantern").x, -1) },
  { code: "variant-passage", cell: [vAt("bd-obj-bench-stone").x, vAt("bd-obj-bench-stone").y], title: "변형 벤치 한 칸 빠짐", how: "돌 벤치(2×1)의 왼쪽 칸을 뺐다 — 원본 벤치의 같은 칸은 막힌 칸인데 이 칸은 걸음이 된다(갈아 끼운 자리의 통행이 달라진다).",
    apply: (_p, m) => setLayerTileAt(m, 3, vAt("bd-obj-bench-stone").y * VW + vAt("bd-obj-bench-stone").x, -1) },
];
fs.writeFileSync(`${ROOT}/variants.png`, renderMapPng({ ...variantProject, startMapId: "" } as Project, variantScene).png);
const vErrors: { code: string; cell: [number, number]; detected: Finding[] }[] = [];
for (const mu of V_MUTATIONS) {
  const bad = structuredClone(variantProject), bm = bad.maps[variantScene.id]!;
  mu.apply(bad, bm);
  const found = checkVariants(bad, bm);
  assert(found.some((f) => f.code === mu.code && f.x === mu.cell[0] && f.y === mu.cell[1]), `변형 ${mu.code} @(${mu.cell}) 를 검사가 못 잡았다: ${JSON.stringify(found)}`);
  vErrors.push({ code: mu.code, cell: mu.cell, detected: found });
  fs.writeFileSync(`${ROOT}/.vbad-${mu.code}.png`, renderMapPng({ ...bad, startMapId: "" } as Project, bm).png);
}

// ── 장면 4: 새 종류 — 쓰임(가족)마다 줄지어 풀밭에, 물 위 것은 못 위에, 징검돌은 못을 건너는 한 줄로 ──
const FAMILY_ORDER = ["village", "harbour", "farm", "camp", "road", "forest", "cliff", "grave", "ruin", "story"];
const FAMILY_KO: Record<string, string> = { village: "마을 살림·일터", harbour: "부두·물가 일", water: "물가·물 위", farm: "농장·과수원·텃밭", camp: "야영·나그네", road: "길가", forest: "숲 바닥", cliff: "절벽 위아래·바위", grave: "묘지", ruin: "유적", story: "이야기 물건" };
const NW = 40;
const nPlaced: Placement[] = [];
let nY = 1;
{
  let x = 1, rowH = 0;
  const land = NEWS.filter((i) => i.on !== "water").sort((a, b) => FAMILY_ORDER.indexOf(a.family === "water" ? "harbour" : a.family) - FAMILY_ORDER.indexOf(b.family === "water" ? "harbour" : b.family));
  for (const it of land) {
    if (x + it.width > NW - 1) { x = 1; nY += rowH + 1; rowH = 0; }
    nPlaced.push({ id: it.id, x, y: nY }); x += it.width + 1; rowH = Math.max(rowH, it.height);
  }
  nY += rowH + 1;
}
const POND_Y = nY + 1, NH = POND_Y + 6, FORD_X = NW - 5;
const N_POND: [number, number][] = [];
for (let y = POND_Y; y < POND_Y + 4; y++) for (let x = 1; x < NW - 1; x++) N_POND.push([x, y]);
{
  let x = 3;
  for (const it of NEWS.filter((i) => i.on === "water" && !i.id.startsWith("step-stone"))) { nPlaced.push({ id: it.id, x, y: POND_Y + 3 - it.height }); x += it.width + 2; }
  for (let j = 0; j < 4; j++) nPlaced.push({ id: j % 2 ? "step-stone-b" : "step-stone-a", x: FORD_X, y: POND_Y + j });
}
let newProject = structuredClone(base);
let newScene = grassMap(newProject, "map_bd_obj_new", "버들항 새 종류 기물", NW, NH);
water(newScene, N_POND);
({ project: newProject, map: newScene } = stampAll(newProject, newScene.id, nPlaced));
const N_WALK: [number, number][] = Array.from({ length: 6 }, (_, j) => [FORD_X, POND_Y - 1 + j] as [number, number]);
{ const f = check(newProject, newScene, nPlaced, N_WALK); assert(f.length === 0, `새 종류 장면은 결함 0 이어야 한다: ${JSON.stringify(f.slice(0, 8))}`); }
assert.equal(new Set(nPlaced.map((p) => p.id)).size, NEWS.length, "새 종류 장면이 모두를 쓴다");
// 물 위 것: 징검돌을 빼면 그 물 칸이 다시 막히고, 뗏목 칸은 뗏목이 있으나 없으나 막힌 칸이다(물은 원래 못 걷는다)
{
  const bare = structuredClone(newProject), bm = bare.maps[newScene.id]!;
  const raft = nPlaced.find((p) => p.id === "raft-log")!;
  assert(isPassable(newProject, newScene, FORD_X, POND_Y + 1) && !isPassable(newProject, newScene, raft.x, raft.y));
  setLayerTileAt(bm, 3, (POND_Y + 1) * NW + FORD_X, -1); setLayerTileAt(bm, 3, raft.y * NW + raft.x, -1);
  assert(!isPassable(bare, bm, FORD_X, POND_Y + 1) && !isPassable(bare, bm, raft.x, raft.y));
}
// 무너진 아치의 가운데 두 칸은 비어 있어 걸어서 지난다
{ const arch = nPlaced.find((p) => p.id === "ruined-arch")!; assert(canMove(newProject, newScene, arch.x + 1, arch.y + 3, arch.x + 1, arch.y + 2) && canMove(newProject, newScene, arch.x + 1, arch.y + 2, arch.x + 1, arch.y + 1)); }
// 물 위 것을 뭍에 놓으면, 뭍의 것을 물 위에 놓으면 거절되고 맵이 그대로다
for (const [id, bx, by] of [["raft-log", 1, NH - 1], ["beehive-skeps", 20, POND_Y + 2], ["step-stone-a", 3, NH - 1]] as const) {
  const trial = structuredClone(newProject), before = JSON.stringify(trial.maps[newScene.id]);
  const res = runTool({ project: trial, currentMapId: newScene.id, assistantRun: true }, "stamp_tileset_object", { mapId: newScene.id, objectId: kitOf(id).id, base: { x: bx, y: by } });
  assert(!res.ok && JSON.stringify(trial.maps[newScene.id]) === before, `${id} @(${bx},${by}) 는 거절되고 맵이 그대로여야 한다: ${res.summary}`);
}
const nAt = (id: string) => nPlaced.find((p) => p.id === id)!;
const N_MUTATIONS: Mutation[] = [
  { code: "walk-blocked", cell: [FORD_X, POND_Y + 2], title: "징검돌 한 칸 빠짐", how: "못을 건너는 징검돌 넷 가운데 하나를 뺐다 — 물 칸이 드러나 건널 수 없다.",
    apply: (_p, m) => setLayerTileAt(m, 3, (POND_Y + 2) * NW + FORD_X, -1) },
  { code: "kit-incomplete", cell: [nAt("dovecote").x, nAt("dovecote").y], title: "비둘기 집 윗칸 빠짐", how: "장대 위 비둘기 집(1×3)의 맨 윗칸을 뺐다 — 집이 잘린다.",
    apply: (_p, m) => setLayerTileAt(m, 3, nAt("dovecote").y * NW + nAt("dovecote").x, -1) },
];
fs.writeFileSync(`${ROOT}/news.png`, renderMapPng({ ...newProject, startMapId: "" } as Project, newScene).png);
const nErrors: { code: string; cell: [number, number]; detected: Finding[] }[] = [];
for (const mu of N_MUTATIONS) {
  const bad = structuredClone(newProject), bm = bad.maps[newScene.id]!;
  mu.apply(bad, bm);
  const found = check(bad, bm, nPlaced, N_WALK);
  assert(found.some((f) => f.code === mu.code && f.x === mu.cell[0] && f.y === mu.cell[1]), `새 종류 ${mu.code} @(${mu.cell}) 를 검사가 못 잡았다: ${JSON.stringify(found)}`);
  nErrors.push({ code: mu.code, cell: mu.cell, detected: found });
  fs.writeFileSync(`${ROOT}/.nbad-${mu.code}.png`, renderMapPng({ ...bad, startMapId: "" } as Project, bm).png);
}

// ── 장면 5: 마을 종류별 기물 — 종류마다 그 벌을 한 무더기로 풀밭에(한 줄에 두 종류), 물 위 것은 아래 못에, 밟는 것(줄 나룻배·빨래 디딤판·건널 널)은 뭍에 닿게 ──
const KW = 46;
const kPlaced: Placement[] = [];
const kBlocks: { kind: string; x: number; y: number; w: number; h: number }[] = [];
let kY = 1;
{
  let x = 1, rowH = 0;
  for (const kind of KIND_ORDER) {
    const land = KINDS.filter((i) => i.kinds?.[0] === kind && i.on !== "water");
    if (!land.length) continue;
    // 한 종류는 한 덩이(넘치면 덩이 안에서 줄을 바꾼다 — 공통 기물)
    const lines: CatalogItem[][] = [[]];
    let lw = 0;
    for (const it of land) { if (lw + it.width + 1 > KW - 2) { lines.push([]); lw = 0; } lines.at(-1)!.push(it); lw += it.width + 1; }
    const bw = Math.max(...lines.map((line) => line.reduce((n, it) => n + it.width + 1, 0))) - 1;
    const bh = lines.reduce((n, line) => n + Math.max(...line.map((it) => it.height)) + 1, 0) - 1;
    if (x > 1 && x + bw > KW - 1) { x = 1; kY += rowH + 2; rowH = 0; }
    let ly = kY;
    for (const line of lines) {
      const lh = Math.max(...line.map((it) => it.height));
      let lx = x;
      for (const it of line) { kPlaced.push({ id: it.id, x: lx, y: ly + lh - it.height }); lx += it.width + 1; }
      ly += lh + 1;
    }
    kBlocks.push({ kind, x, y: kY, w: bw, h: bh });
    x += bw + 3; rowH = Math.max(rowH, bh);
  }
  kY += rowH + 2;
}
const K_POND = kY + 1, KH = K_POND + 6;
const K_POND_CELLS: [number, number][] = [];
for (let y = K_POND; y < K_POND + 4; y++) for (let x = 1; x < KW - 1; x++) K_POND_CELLS.push([x, y]);
const K_FLAT = new Set(["ferry-raft", "wash-plank", "gangplank"]);
const kHas = (id: string) => KINDS.some((i) => i.id === id);
// 밟는 것: 건널 널 둘을 세로로 이어 못을 건넌다 · 줄 나룻배와 빨래 디딤판은 못 윗가에 붙여 뭍에서 올라선다
const K_GANG_X = KW - 4, K_RAFT_X = KW - 10, K_PLANK_X = KW - 14;
{
  let x = 3;
  for (const it of KINDS.filter((i) => i.on === "water" && !K_FLAT.has(i.id))) { kPlaced.push({ id: it.id, x, y: K_POND + 3 - it.height }); x += it.width + 2; }
  assert(x < K_PLANK_X - 1, "못이 좁다 — 물 위 것이 밟는 것 자리와 겹친다");
  if (kHas("gangplank")) { kPlaced.push({ id: "gangplank", x: K_GANG_X, y: K_POND }); kPlaced.push({ id: "gangplank", x: K_GANG_X, y: K_POND + 2 }); }
  if (kHas("ferry-raft")) kPlaced.push({ id: "ferry-raft", x: K_RAFT_X, y: K_POND });
  if (kHas("wash-plank")) kPlaced.push({ id: "wash-plank", x: K_PLANK_X, y: K_POND });
}
let kindProject = structuredClone(base);
let kindScene = grassMap(kindProject, "map_bd_obj_kinds", "버들항 마을 종류별 기물", KW, KH);
water(kindScene, K_POND_CELLS);
({ project: kindProject, map: kindScene } = stampAll(kindProject, kindScene.id, kPlaced));
const K_WALK: [number, number][] = kHas("gangplank") ? Array.from({ length: 6 }, (_, j) => [K_GANG_X, K_POND - 1 + j] as [number, number]) : [];
{ const f = check(kindProject, kindScene, kPlaced, K_WALK); assert(f.length === 0, `마을 종류 장면은 결함 0 이어야 한다: ${JSON.stringify(f.slice(0, 8))}`); }
assert.equal(new Set(kPlaced.map((p) => p.id)).size, KINDS.length, "마을 종류 장면이 모두를 쓴다");
const kAt = (id: string) => kPlaced.find((p) => p.id === id)!;
// 줄 나룻배·빨래 디딤판: 뭍에서 올라서고, 그 너머 물 칸은 막혀 있다. 삿대 배·짐배는 있으나 없으나 막힌 칸이다.
if (kHas("ferry-raft")) assert(canMove(kindProject, kindScene, K_RAFT_X + 1, K_POND - 1, K_RAFT_X + 1, K_POND) && canMove(kindProject, kindScene, K_RAFT_X + 1, K_POND, K_RAFT_X + 1, K_POND + 1) && !isPassable(kindProject, kindScene, K_RAFT_X + 1, K_POND + 2), "줄 나룻배에 올라서지 못한다");
if (kHas("wash-plank")) assert(canMove(kindProject, kindScene, K_PLANK_X, K_POND - 1, K_PLANK_X, K_POND) && !isPassable(kindProject, kindScene, K_PLANK_X, K_POND + 1), "빨래 디딤판에 올라서지 못한다");
for (const id of ["punt", "canal-barge", "gondola", "heron-post", "mooring-pole", "lock-gate"]) if (kHas(id)) {
  const at = kAt(id), it = item(id), bare = structuredClone(kindProject), bm = bare.maps[kindScene.id]!;
  for (let dy = 0; dy < it.height; dy++) for (let dx = 0; dx < it.width; dx++) {
    const blocked = it.block.some(([bx, by]) => bx === dx && by === dy);
    if (blocked) assert(!isPassable(kindProject, kindScene, at.x + dx, at.y + dy), `${id} (${dx},${dy}) 는 막힌 칸이어야 한다`);
    setLayerTileAt(bm, 3, (at.y + dy) * KW + at.x + dx, -1);
    assert(!isPassable(bare, bm, at.x + dx, at.y + dy), `${id} 를 걷어도 물 칸은 막혀 있어야 한다`);
  }
}
// 걸어 지나는 문(가운데 열이 빈 킷 — 고래 뼈 문·묘지 문·장터 문): 아래에서 위로 그 빈 칸을 지난다
const K_GATES = KINDS.filter((i) => i.rows[i.height - 1]!.some((t) => t < 0));
for (const it of K_GATES) {
  const at = kAt(it.id);
  for (let dx = 0; dx < it.width; dx++) {
    if (it.rows[it.height - 1]![dx]! >= 0) continue;
    for (let dy = it.height; dy > 0; dy--) assert(canMove(kindProject, kindScene, at.x + dx, at.y + dy, at.x + dx, at.y + dy - 1), `${it.id} 의 빈 칸 열 ${dx} 를 걸어 지날 수 없다 (${dy}→${dy - 1})`);
  }
}
// 물 위 것을 뭍에, 뭍의 것을 물 위에 놓으면 거절되고 맵이 그대로다
for (const [id, bx, by] of [["punt", 1, KH - 1], ["gangplank", 3, KH - 1], ["ferry-raft", 5, KH - 1], [KINDS.find((i) => !i.on && i.place !== "decal")!.id, 20, K_POND + 2]] as const) {
  if (!kHas(id)) continue;
  const trial = structuredClone(kindProject), before = JSON.stringify(trial.maps[kindScene.id]);
  const res = runTool({ project: trial, currentMapId: kindScene.id, assistantRun: true }, "stamp_tileset_object", { mapId: kindScene.id, objectId: kitOf(id).id, base: { x: bx, y: by } });
  assert(!res.ok && JSON.stringify(trial.maps[kindScene.id]) === before, `${id} @(${bx},${by}) 는 거절되고 맵이 그대로여야 한다: ${res.summary}`);
}
// 킷 태그 kind:<종류 id> 가 kinds.json·catalog 와 같다
for (const it of KINDS) assert.deepEqual((kitOf(it.id).ai?.tags ?? []).filter((t) => t.startsWith("kind:")).map((t) => t.slice(5)), it.kinds, `${it.id} 의 kind 태그`);
const K_TALL = KINDS.find((i) => i.width === 1 && i.height === 3 && !i.on)!;
const K_MUTATIONS: Mutation[] = [
  ...(kHas("gangplank") ? [{ code: "walk-blocked", cell: [K_GANG_X, K_POND + 2] as [number, number], title: "건널 널 한 칸 빠짐", how: "못을 건너는 건널 널의 한 칸을 뺐다 — 물 칸이 드러나 건널 수 없다.",
    apply: (_p: Project, m: GameMap) => setLayerTileAt(m, 3, (K_POND + 2) * KW + K_GANG_X, -1) }] : []),
  { code: "kit-incomplete", cell: [kAt(K_TALL.id).x, kAt(K_TALL.id).y], title: `${K_TALL.name.split(" · ")[0]} 윗칸 빠짐`, how: `${K_TALL.name.split(" · ")[0]}(1×3)의 맨 윗칸을 뺐다 — 그림이 잘린다.`,
    apply: (_p, m) => setLayerTileAt(m, 3, kAt(K_TALL.id).y * KW + kAt(K_TALL.id).x, -1) },
];
fs.writeFileSync(`${ROOT}/kinds.png`, renderMapPng({ ...kindProject, startMapId: "" } as Project, kindScene).png);
const kErrors: { code: string; cell: [number, number]; detected: Finding[] }[] = [];
for (const mu of K_MUTATIONS) {
  const bad = structuredClone(kindProject), bm = bad.maps[kindScene.id]!;
  mu.apply(bad, bm);
  const found = check(bad, bm, kPlaced, K_WALK);
  assert(found.some((f) => f.code === mu.code && f.x === mu.cell[0] && f.y === mu.cell[1]), `마을 종류 ${mu.code} @(${mu.cell}) 를 검사가 못 잡았다: ${JSON.stringify(found)}`);
  kErrors.push({ code: mu.code, cell: mu.cell, detected: found });
  fs.writeFileSync(`${ROOT}/.kbad-${mu.code}.png`, renderMapPng({ ...bad, startMapId: "" } as Project, bm).png);
}

// ── 오류 변조 4종: 실제로 고쳐 놓고 같은 검사가 그 칸을 짚는지 본다 ──
type Mutation = { code: string; cell: [number, number]; title: string; how: string; apply: (p: Project, m: GameMap) => void };
const MUTATIONS: Mutation[] = [
  { code: "wrong-layer", cell: [4, 9], title: "널빤지를 아래층에", how: "널빤지 칸을 3층에서 빼 1층(물 칸 자리)에 찍었다 — 물 그림이 사라지고 널빤지 둘레가 뚫린다.",
    apply: (_p, m) => { const i = 9 * W + 4, t = layerTileAt(m, 3, i); setLayerTileAt(m, 3, i, -1); setLayerTileAt(m, 1, i, t); } },
  { code: "walk-blocked", cell: [6, 10], title: "널빤지 길 한 칸 빠짐", how: "세로 널빤지 한 칸을 뺐다 — 물 칸이 드러나 길이 끊긴다.",
    apply: (_p, m) => setLayerTileAt(m, 3, 10 * W + 6, -1) },
  { code: "entrance-blocked", cell: [3, 4], title: "동굴 입구 앞을 막음", how: "굴 칸 바로 아래 접근칸에 빛나는 파편(막힘 1칸)을 놓았다 — 굴에 다가설 수 없다.",
    apply: (_p, m) => setLayerTileAt(m, 3, 4 * W + 3, kitOf("shard").rows[0]!.upperTiles![0]!) },
  { code: "kit-incomplete", cell: [10, 7], title: "천막 윗줄 빠짐", how: "야영 천막의 윗줄 두 칸을 뺐다 — 천막이 잘린다.",
    apply: (_p, m) => { setLayerTileAt(m, 3, 7 * W + 10, -1); setLayerTileAt(m, 3, 7 * W + 11, -1); } },
];
fs.writeFileSync(`${ROOT}/atlas.png`, renderMapPng({ ...atlasProject, startMapId: "" } as Project, atlas).png);
fs.writeFileSync(`${ROOT}/scene.png`, renderMapPng({ ...sceneProject, startMapId: "" } as Project, scene).png);
const errors: { code: string; cell: [number, number]; detected: Finding[] }[] = [];
for (const mu of MUTATIONS) {
  const bad = structuredClone(sceneProject), bm = bad.maps[scene.id]!;
  mu.apply(bad, bm);
  const found = check(bad, bm, placed, WALK);
  assert(found.some((f) => f.code === mu.code && f.x === mu.cell[0] && f.y === mu.cell[1]), `${mu.code} @(${mu.cell}) 를 검사가 못 잡았다: ${JSON.stringify(found)}`);
  errors.push({ code: mu.code, cell: mu.cell, detected: found });
  fs.writeFileSync(`${ROOT}/.bad-${mu.code}.png`, renderMapPng({ ...bad, startMapId: "" } as Project, bm).png);
}
// 그림: 3배 최근접 확대 · 정상/오류 나란히(빨간 상자 = 변조한 맵 칸) · 128색 학습 사본
execFileSync(process.env.BEODEUL_OBJECTS_PYTHON ?? "python3", ["-c", `
import json, sys
from PIL import Image, ImageDraw
root, pub, T = sys.argv[1], sys.argv[2], 16
def up(im, k=3): return im.resize((im.width * k, im.height * k), Image.Resampling.NEAREST)
def learn(im, name):
    im.save(f"{root}/{name}")
    im.convert("RGB").quantize(128, dither=Image.Dither.NONE).save(f"{pub}/{name}", optimize=True)
learn(up(Image.open(f"{root}/atlas.png").convert("RGB")), "atlas-3x.png")
scene = Image.open(f"{root}/scene.png").convert("RGB")
learn(scene, "scene-1x.png"); learn(up(scene), "scene-3x.png")
for code, (cx, cy) in json.loads(sys.argv[3]):
    bad = Image.open(f"{root}/.bad-{code}.png").convert("RGB")
    x0, y0 = max(0, cx - 4), max(0, cy - 3); x1, y1 = min(scene.width // T, x0 + 9), min(scene.height // T, y0 + 7)
    box = (x0 * T, y0 * T, x1 * T, y1 * T)
    a, b = up(scene.crop(box)), up(bad.crop(box))
    d = ImageDraw.Draw(b); rx, ry = (cx - x0) * T * 3, (cy - y0) * T * 3
    d.rectangle((rx, ry, rx + T * 3 - 1, ry + T * 3 - 1), outline=(255, 0, 0), width=2)
    out = Image.new("RGB", (a.width * 2 + 12, a.height), (24, 24, 24)); out.paste(a, (0, 0)); out.paste(b, (a.width + 12, 0))
    learn(out, f"err-{code}.png")
vs = Image.open(f"{root}/variants.png").convert("RGB")
learn(vs, "variants-1x.png"); learn(up(vs), "variants-3x.png")
for code, (cx, cy) in json.loads(sys.argv[4]):
    bad = Image.open(f"{root}/.vbad-{code}.png").convert("RGB")
    x0, y0 = max(0, cx - 4), max(0, cy - 3); x1, y1 = min(vs.width // T, x0 + 9), min(vs.height // T, y0 + 7)
    box = (x0 * T, y0 * T, x1 * T, y1 * T)
    a, b = up(vs.crop(box)), up(bad.crop(box))
    d = ImageDraw.Draw(b); rx, ry = (cx - x0) * T * 3, (cy - y0) * T * 3
    d.rectangle((rx, ry, rx + T * 3 - 1, ry + T * 3 - 1), outline=(255, 0, 0), width=2)
    out = Image.new("RGB", (a.width * 2 + 12, a.height), (24, 24, 24)); out.paste(a, (0, 0)); out.paste(b, (a.width + 12, 0))
    learn(out, f"err-variant-{code}.png")
ns = Image.open(f"{root}/news.png").convert("RGB")
learn(ns, "new-1x.png"); learn(up(ns, 2), "new-2x.png")
for code, (cx, cy) in json.loads(sys.argv[5]):
    bad = Image.open(f"{root}/.nbad-{code}.png").convert("RGB")
    x0, y0 = max(0, cx - 4), max(0, cy - 3); x1, y1 = min(ns.width // T, x0 + 9), min(ns.height // T, y0 + 7)
    box = (x0 * T, y0 * T, x1 * T, y1 * T)
    a, b = up(ns.crop(box)), up(bad.crop(box))
    d = ImageDraw.Draw(b); rx, ry = (cx - x0) * T * 3, (cy - y0) * T * 3
    d.rectangle((rx, ry, rx + T * 3 - 1, ry + T * 3 - 1), outline=(255, 0, 0), width=2)
    out = Image.new("RGB", (a.width * 2 + 12, a.height), (24, 24, 24)); out.paste(a, (0, 0)); out.paste(b, (a.width + 12, 0))
    learn(out, f"err-new-{code}.png")
ks = Image.open(f"{root}/kinds.png").convert("RGB")
learn(ks, "kinds-1x.png"); learn(up(ks, 2), "kinds-2x.png")
for code, (cx, cy) in json.loads(sys.argv[6]):
    bad = Image.open(f"{root}/.kbad-{code}.png").convert("RGB")
    x0, y0 = max(0, cx - 4), max(0, cy - 3); x1, y1 = min(ks.width // T, x0 + 9), min(ks.height // T, y0 + 7)
    box = (x0 * T, y0 * T, x1 * T, y1 * T)
    a, b = up(ks.crop(box)), up(bad.crop(box))
    d = ImageDraw.Draw(b); rx, ry = (cx - x0) * T * 3, (cy - y0) * T * 3
    d.rectangle((rx, ry, rx + T * 3 - 1, ry + T * 3 - 1), outline=(255, 0, 0), width=2)
    out = Image.new("RGB", (a.width * 2 + 12, a.height), (24, 24, 24)); out.paste(a, (0, 0)); out.paste(b, (a.width + 12, 0))
    learn(out, f"err-kind-{code}.png")
`, ROOT, PUB, JSON.stringify(MUTATIONS.map((m) => [m.code, m.cell])), JSON.stringify(V_MUTATIONS.map((m) => [m.code, m.cell])), JSON.stringify(N_MUTATIONS.map((m) => [m.code, m.cell])), JSON.stringify(K_MUTATIONS.map((m) => [m.code, m.cell]))]);
for (const mu of K_MUTATIONS) fs.rmSync(`${ROOT}/.kbad-${mu.code}.png`);
fs.rmSync(`${ROOT}/kinds.png`);
for (const mu of N_MUTATIONS) fs.rmSync(`${ROOT}/.nbad-${mu.code}.png`);
fs.rmSync(`${ROOT}/news.png`);
for (const mu of V_MUTATIONS) fs.rmSync(`${ROOT}/.vbad-${mu.code}.png`);
fs.rmSync(`${ROOT}/variants.png`);
for (const mu of MUTATIONS) fs.rmSync(`${ROOT}/.bad-${mu.code}.png`);
fs.rmSync(`${ROOT}/atlas.png`); fs.rmSync(`${ROOT}/scene.png`);

// ── 문서 ──
const row = (it: (typeof catalog.items)[number]) => {
  const kit = kitOf(it.id), ai = kit.ai as { growthAxis?: string; access?: { dx: number; dy: number }[] } | undefined;
  const cells = it.rows.map((r) => r.join(" ")).join(" / ");
  const star = it.place === "decal" ? "—" : it.rows.flatMap((r, y) => r.map((t, x) => (t >= 0 && !it.block.some(([bx, by]) => bx === x && by === y) ? `(${x},${y})` : ""))).filter(Boolean).join(" ") || "—";
  const ent = (kit.parts ?? []).filter((p) => p.kind === "entrance").map((p) => `입구 칸 (${p.dx},${p.dy})`).concat((ai?.access ?? []).map((a) => `접근칸 (${a.dx},${a.dy})`)).join(" · ") || "—";
  return `| \`${kit.id}\` | ${it.name} | ${it.width}×${it.height} | ${cells} | ${it.place === "decal" ? "바닥 그림(밟고 지나감)" : "서 있는 기물"} | ${it.block.map(([x, y]) => `(${x},${y})`).join(" ") || "—"} | ${star} | ${ai?.growthAxis ? `반복(${ai.growthAxis === "horizontal" ? "가로" : "세로"})` : "고정"} | ${ent} | ${it.words.join(", ")} |`;
};
const nrow = (it: CatalogItem) => {
  const kit = kitOf(it.id);
  const star = it.place === "decal" ? "—" : it.rows.flatMap((r, y) => r.map((t, x) => (t >= 0 && !it.block.some(([bx, by]) => bx === x && by === y) ? `(${x},${y})` : ""))).filter(Boolean).join(" ") || "—";
  const how = it.on === "water" ? (it.place === "decal" ? "물 위 · 바닥 그림(밟고 건넌다)" : "물 위 · 막힘") : it.place === "decal" ? "바닥 그림(밟고 지나감)" : it.on === "shore" ? "서 있는 기물 · 물가" : "서 있는 기물";
  return `| \`${kit.id}\` | ${it.name} | ${it.width}×${it.height} | ${it.rows.map((r) => r.join(" ")).join(" / ")} | ${how} | ${it.block.map(([x, y]) => `(${x},${y})`).join(" ") || "—"} | ${star} | ${it.words.join(", ")} |`;
};
const vrow = (f: (typeof families)[number]) => f.items.map((it) => {
  const kit = kitOf(it.id);
  return `| \`${f.base.id}\` ${f.base.name ?? ""} | \`${kit.id}\` | ${it.name} | ${it.width}×${it.height} | ${it.rows.map((r) => r.join(" ")).join(" / ")} | ${it.block.map(([x, y]) => `(${x},${y})`).join(" ") || "—"} | ${it.words.join(", ")} |`;
}).join("\n");
const guide = `# 버들항 이야기 기물 16종 — 샘·동굴 입구·유적 입구·게시판·쪽지·봉인 제단·널빤지 길 (bd-obj-*, 2026-11-12)

타일셋 \`beodeul_city\` · 그림 \`public/assets/beodeul-city/beodeul-city-chipset.png\`(텍스처 \`tex_beodeul_city\`) · **16px 칸, 한 줄 128칸**.
번호 n 의 칸 = 행 ⌊n/128⌋, 열 n mod 128. 이 기물의 칸은 시트 꼬리 **${catalog.base}~${catalog.base + catalog.items.flatMap((i) => i.rows.flat()).filter((n) => n >= 0).length - 1}**(행 ${catalog.base / 128}~${catalog.count / 128 - 1})이다 — 이야기 기물 16종, 종류별 변형(6절), 새 종류(7절), 마을 종류별 기물(8절) 순서. 다른 칩셋 번호를 섞지 않는다.
게임들이 바랐는데 그림이 없던 물건이다(조수 실행의 «없는 그림» 장부). 그림 정본 \`tiledata/beodeul-objects/pieces/<id>.png\`, 정의 \`tiledata/beodeul-objects/spec.json\`, 굽기 \`scripts/content/beodeul-objects/bake.py\`.
**3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 fable-oneshot-2026-11-12, Claude Fable 5.2 한 방 그림). 관문을 통과한 그림이 아니다 — 스토어로는 나가지 않는다.

## 1. 정확한 사전

모든 칸은 **3층(upperTiles)** 에 놓는다(1층 = 땅·물은 그대로 둔다 — 투명 화소 밑으로 풀·물이 비친다). 2·4층은 쓰지 않는다.
- **서 있는 기물**: 막힌 칸은 사람과 같은 층(네 방향 막힘), 나머지 칸은 ★(사람 위에 그려지고 걸을 수 있다 — 지붕·윗면).
- **바닥 그림**(널빤지 길·쪽지): 사람 아래에 그려지고 걸을 수 있다. 3층에 있으므로 **물 칸 위에 놓으면 그 칸을 걸을 수 있게 된다**(엔진은 ★ 아닌 맨 위 층의 통행을 쓴다).
칸 번호 행렬은 위 줄 → 아래 줄(« / » 로 줄을 나눔), 좌표 (dx,dy) 는 킷 왼쪽 위가 (0,0).

| 킷 id | 무엇 | 크기 | 칸 번호 | 놓는 방식 | 막힌 칸 | ★ 칸 | 반복 | 입구·접근칸 | 찾는 낱말(킷 태그) |
|---|---|---|---|---|---|---|---|---|---|
${STORY.map(row).join("\n")}

없는 것(임의 번호를 만들지 않는다): 널빤지 길 모퉁이는 **서→남** 하나, 끝 조각은 **동쪽 끝** 하나뿐이다(다른 방향 모퉁이·끝 그림은 없다 — 길을 그 모양에 맞춰 놓는다). 동굴 **안**·던전 방은 이 기물이 아니다(장소로 짓는다).

## 2. 실행 순서

1. 땅을 먼저 깐다(풀 737 등). 물가 장면이면 물 칸을 먼저 깐다 — 널빤지 길은 그 위에 얹는다.
2. 기물은 \`stamp_tileset_object({ mapId, objectId: "bd-obj-…", base })\` 로 놓는다. **base = 맨 아래 줄의 왼쪽 칸**(킷 왼쪽 위 (x,y), 높이 h 이면 base = (x, y+h−1)). 조수 v2 는 \`place_object({ mapId, objectId, at })\`(같은 base).
   도구는 통째로 놓거나 거절한다(거절하면 맵이 그대로다). 건물 보호 영역·이미 놓인 기물 위에는 거절된다.
3. 큰 것부터(동굴 입구·유적 입구·가축 우리 3×3 → 2×2 → 1×2 → 1×1). 서로 한 칸 이상 띄운다.
4. **입구 둘**(동굴 입구·유적 입구): 입구 칸은 맨 아래 줄 가운데 (1,2) — 막힌 칸이다(부딪쳐 들어간다). 바로 아래 **접근칸 (1,3) 을 비운다**(기물·이벤트 그림 금지). 이동 이벤트는 접근칸에 «플레이어 접촉» 으로, 또는 입구 칸에 «같은 높이·결정 키» 로 둔다. 그림은 입구일 뿐 들어갈 맵은 따로 잇는다.
5. **널빤지 길**: 가로 조각은 가로로, 세로 조각은 세로로 이어 놓는다(같은 조각 반복). 꺾이는 칸에 모퉁이(서쪽에서 와서 남쪽으로), 막다른 동쪽 끝에 끝 조각. 길의 양 끝은 걸을 수 있는 땅에 닿아야 한다. 풀밭 위에 놓으면 판자 바닥으로만 보인다 — 물·늪 위에 쓴다.
6. 게시판·기록부·쪽지·파편·제단은 그림이다 — 읽기·줍기·봉인 풀기는 그 칸(또는 앞 칸)에 이벤트를 따로 둔다. 막힌 칸의 이벤트는 «같은 높이·결정 키».
7. 금지: 문 앞 2칸·다리 끝·계단 앞뒤에 놓지 않는다. 절벽(높이 지형) 가장자리 두 칸 안에 놓지 않는다(절벽 그림이 기물을 가린다). 빈 땅 채우기에 흩어 쓰지 않는다 — 이야기가 부를 때만 놓는다(킷 태그 «주제 소품»).

## 3. 조립 예제 — 「조립 예제 배열」 문서

${W}×${H} 한 장면에 16종을 모두 놓았다(못: 4×6 물 + 널빤지 길 ㄱ자와 막다른 잔교 · 북쪽 동굴 입구·샘·게시판·쪽지·유적 입구 · 가운데 천막·곡괭이·가축 우리 · 남쪽 제단·무너진 기둥 둘·파편·기록부).
네 층 전체 배열과 놓은 순서(킷 id·왼쪽 위 좌표)는 「조립 예제 배열」 문서에 있다. 그림: 원본 해상도 \`scene-1x.png\`, 3배 최근접 \`scene-3x.png\`, 사전 그림 \`atlas-3x.png\`(목록 순서, 왼쪽 위 좌표는 예제 문서).

## 4. 정상/오류 (실제로 변조해 검출)

| 오류 코드 | 변조한 맵 칸 | 무엇을 했나 | 그림 |
|---|---|---|---|
${MUTATIONS.map((m) => `| \`${m.code}\` | (${m.cell[0]},${m.cell[1]}) | ${m.how} | err-${m.code}.png (왼쪽 정상 · 오른쪽 오류, 빨간 상자) |`).join("\n")}

## 5. 자동 검사와 범위

\`bun scripts/content/prepare-beodeul-objects-references.mts\` 가 이 문서를 만들 때마다 엔진 판정(isPassable·canMove)으로 다시 잰다:
- 킷 칸이 3층에 통째로 있는가(\`wrong-layer\`·\`kit-incomplete\`) · 막힌 칸/걸음 칸이 선언과 같은가(\`passage-mismatch\`) · 입구 앞 접근칸이 비었는가(\`entrance-blocked\`) · 널빤지 길을 (1,9)→(6,12) 로 걸어 건널 수 있는가(\`walk-blocked\`).
- 물 위 널빤지를 빼면 그 칸이 다시 막히는가, 입구 칸이 조수 v2 의 입구 판독(킷 parts entrance)에 잡히는가, 막힌 자리 놓기가 거절되고 맵이 그대로인가.
- **확인하지 않는 것**: 이벤트 실행(읽기·이동·줍기), 그림의 미적 품질·3/4 시점(이 그림들은 관문 미통과다), 다른 기물과의 어울림, 모델이 실제로 잘 놓는지.

## 6. 종류별 변형 ${VARIANTS.length}종 — 같은 종류, 다른 그림 (2026-11-12)

우물·벤치·이정표처럼 그림이 한 장뿐이던 종류 ${families.length}개에 **모양·재질이 다른 그림**을 더했다(면제 묶음 fable-variety-beodeul-2026-11-12, 같은 3/4 관문 미통과 — 오너 면제). 건물·바닥 타일은 없다.
- 변형 킷은 \`ai.variantOf\` 에 **원본 킷 id** 를 적는다. 칸 크기·막힌 칸·★ 칸·층(3층)이 원본과 같다(굽기가 맞춰 보고 다르면 멈춘다) — 원본 자리에 갈아 끼워도 배치·통행이 그대로다.
- **놓을 때는 원본 킷 id 를 쓴다**(\`bd-prop-well_roofed\` 등, 원래 쓰던 그대로). 조수 실행에서는 놓기 도구가 그 게임의 열쇠로 원본·변형 가운데 하나를 고른다 — 한 게임 안에서는 늘 같은 그림, 게임이 다르면 다른 그림(\`src/project/kitLook.ts\`). 도구 결과의 \`objectId\` 가 실제로 찍힌 킷이다.
- 특정 그림이 꼭 필요할 때만 변형 킷 id 를 직접 쓴다 — 직접 댄 변형 id 는 바뀌지 않는다. 사람 편집(조수 실행이 아닌 놓기)은 고른 킷 그대로다.
- 이름으로 찾기(«우물»)는 원본 킷을 먼저 준다. 변형만의 낱말(«펌프», «돌 벤치», «이정석» …)은 그 변형을 준다.
- 이미 깐 맵은 바뀌지 않는다(맵은 칸 번호를 갖고 있고 옛 칸의 그림은 그대로다).

| 원본 킷 | 변형 킷 id | 무엇 | 크기 | 칸 번호 | 막힌 칸 | 찾는 낱말 |
|---|---|---|---|---|---|---|
${families.map(vrow).join("\n")}

그림 \`variants-1x.png\`(원본 해상도) · \`variants-3x.png\`: 종류마다 한 줄 — 맨 왼쪽이 원본 킷, 그 오른쪽이 변형. 전체 배열은 「종류별 변형 배열」 문서.

| 오류 코드 | 변조한 맵 칸 | 무엇을 했나 | 그림 |
|---|---|---|---|
${V_MUTATIONS.map((m) => `| \`${m.code}\` | (${m.cell[0]},${m.cell[1]}) | ${m.how} | err-variant-${m.code}.png (왼쪽 정상 · 오른쪽 오류, 빨간 상자) |`).join("\n")}

자동 검사(같은 스크립트): 변형 장면의 킷 칸이 3층에 통째로 있는가 · **변형의 칸마다 엔진 통행(isPassable)이 원본 킷의 같은 칸과 같은가**(\`variant-passage\`). 확인하지 않는 것: 그림이 그 종류로 읽히는지(사람이 1배에서 보고 5장을 뺐다), 게임마다 실제로 갈리는지(\`test/kitLook.test.ts\`·\`scripts/content/beodeul-variety/sixSeeds.mts\`).

## 7. 새 종류 ${NEWS.length}종 — 마을 살림·물가와 물 위·농장·숲 바닥·절벽 바위·유적과 묘지 (2026-11-14)

버들항에 없던 **새 물건**이다(변형이 아니다 — \`ai.variantOf\` 없음, 갈아 끼워지지 않는다). 면제 묶음 ${NEW_WAIVER}, 같은 3/4 관문 미통과 — 오너 면제. 건물·바닥 타일·나무는 없다.
- 놓는 법은 1·2절과 같다: 3층, \`stamp_tileset_object({ mapId, objectId, base })\` / 조수 v2 \`place_object\`. 서 있는 것은 막힌 칸만 막히고 윗줄은 ★.
- **물 위에 놓는 것**(표의 «물 위» — 킷 태그 \`물 위\`): **모든 칸이 물 칸이어야 한다**(뭍에 놓으면 거절). 3층에 놓여 물 그림은 그대로 비친다.
  - 뗏목·가죽배·부표·수련·오리 집·어살: 막힌 칸이다. 물은 원래 못 걷는 칸이라 **통행은 달라지지 않는다** — 걸어서 올라탈 수 없다(타는 배가 아니라 풍경이다).
  - **물 징검돌 둘**(\`bd-obj-step-stone-a\`·\`-b\`): 바닥 그림이다 — **놓인 물 칸을 걸을 수 있게 된다**. 뭍에서 뭍까지 한 칸씩 이어 놓아 물을 건넌다(두 그림을 번갈아). 한 칸이라도 빠지면 건널 수 없다. 뭍의 징검돌은 깊은 숲길 것(\`bd-pick-deep-forest-path-stones-*\`)을 쓴다.
- **물가에 두는 것**(표의 «물가» — 부들·낚싯대·부두 기중기·감개·밧줄·노 걸이·그물·통발): 뭍의 걷는 바닥 위, 물에서 한두 칸.
- **무너진 아치**(\`bd-obj-ruined-arch\` 3×3): 가운데 열 아래 두 칸 (1,1)(1,2) 이 비어 있다 — 그 칸으로 걸어서 지난다. 그 두 칸과 앞뒤 한 칸에 다른 기물을 두지 않는다.
- **쇠 울타리**(\`bd-obj-iron-fence\` 2×1): 가로로 이어 찍는다(repeat x).
- 바위(절벽·바위 가족): 절벽(높이 지형) 가장자리 두 칸 안에는 놓지 않는다 — 절벽 위·아래에서 두세 칸 떨어진 자리에.
- **마을·길 빌더가 스스로 놓는다**(\`src/editor/tools/beodeulObjectSets.ts\`): 강가·포구 마을을 조수 실행으로 지으면 그 게임의 벌(집 곁 살림 · 광장 · 일터 · 물가 · 물 위 · 바위 · 들 · 한 귀퉁이)이 놓이고, 도구 결과 \`data.newObjects\` 에 쓰임마다 놓은 수가 온다. 게임 열쇠로 고르므로 한 게임 안에서는 늘 같은 물건이다.
  이름을 대서 더 놓을 때는 아래 낱말로 찾는다. 이야기 물건(바위에 꽂힌 검·쇠 우리·지도 탁자·무기 걸이·받침대·덫·길 막이·징검돌)은 빌더가 놓지 않거나 드물다 — 이야기가 부를 때 놓는다.

${["village", "harbour", "water", "farm", "camp", "road", "forest", "cliff", "grave", "ruin", "story"].filter((f) => NEWS.some((i) => i.family === f)).map((f) => `### ${FAMILY_KO[f]} (${NEWS.filter((i) => i.family === f).length})

| 킷 id | 무엇 | 크기 | 칸 번호 | 놓는 방식 | 막힌 칸 | ★ 칸 | 찾는 낱말(킷 태그) |
|---|---|---|---|---|---|---|---|
${NEWS.filter((i) => i.family === f).map(nrow).join("\n")}`).join("\n\n")}

그림 \`new-1x.png\`(원본 해상도) · \`new-2x.png\`: 쓰임 순서로 풀밭에 줄지어 놓고, 아래 못에 물 위 것과 못을 건너는 징검돌 한 줄. 전체 배열은 「새 종류 배열」 문서.

| 오류 코드 | 변조한 맵 칸 | 무엇을 했나 | 그림 |
|---|---|---|---|
${N_MUTATIONS.map((m) => `| \`${m.code}\` | (${m.cell[0]},${m.cell[1]}) | ${m.how} | err-new-${m.code}.png (왼쪽 정상 · 오른쪽 오류, 빨간 상자) |`).join("\n")}

자동 검사(같은 스크립트): 새 종류 장면의 킷 칸이 3층에 통째로 있는가 · 막힌 칸/걸음 칸이 선언과 같은가 · 징검돌 한 줄을 ${N_WALK.map(([x, y]) => `(${x},${y})`).join("→")} 로 걸어 건널 수 있는가 · 징검돌을 빼면 그 물 칸이 다시 막히는가 · 뗏목 칸은 뗏목이 있으나 없으나 막혀 있는가 · 무너진 아치 밑을 걸어 지날 수 있는가 · 물 위 것을 뭍에, 뭍의 것을 물 위에 놓으면 거절되고 맵이 그대로인가.
확인하지 않는 것: 그림의 미적 품질·3/4 시점(관문 미통과다 — 기계 검사 불합격 11장을 포함해 모두 구웠다), 빌더가 고른 자리가 보기 좋은지, 모델이 이름으로 잘 찾는지.

## 8. 마을 종류별 기물 ${KINDS.length}종 — 종류마다 한 벌 (2026-11-14)

마을 종류 ${KIND_ORDER.length - 1}개(어부 포구·대장간 마을·성벽 장시 …)마다 **그 종류의 생업 장면에 같이 놓이는 벌**과, 여러 종류가 같이 쓰는 공통 기물(간판·울·등·화분·의자·수레)이다. 면제 묶음 ${KIND_WAIVER}, 같은 3/4 관문 미통과 — 오너 면제. 변형이 아닌 새 물건이고 건물·바닥 타일·나무는 없다.
- **킷 사전은 따로 있다**: \`KINDS.md\`(「마을 종류별 기물 사전」 문서) — 종류마다 표 하나(킷 id·크기·칸 번호·놓는 방식·막힌 칸·★ 칸·낱말). 배열은 「마을 종류별 기물 배열」 문서.
- **어느 종류의 것인지**: 킷 태그 \`kind:<종류 id>\`(여럿일 수 있다, 공통은 \`kind:common\`)와 같은 내용의 표 \`tiledata/beodeul-objects/kinds.json\`(킷 id → 종류 id 목록, 종류 이름).
- **한 벌은 한 자리에 모아 놓는다** — 대장간 마당·그물 말리는 터처럼 서너 가지가 붙어 있어야 «무슨 일을 하는 곳» 으로 읽힌다. 낱개로 흩지 않는다. 서로 한 칸 띄우고, 문 앞 2칸·길 한가운데는 비운다.
- 놓는 법은 1·2·7절과 같다(3층, base = 맨 아래 줄 왼쪽 칸, 서 있는 것은 막힌 칸만 막히고 윗줄은 ★).
- **물 위 것**(킷 태그 \`물 위\`, 모든 칸이 물): 삿대 배·짐배·긴 나룻배·왜가리 말뚝·줄무늬 계류 말뚝·운하 수문은 막힌 칸이다(물은 원래 못 걷는다 — 풍경이다).
  **줄 나룻배**(\`bd-obj-ferry-raft\` 3×2)·**빨래 디딤판**(\`bd-obj-wash-plank\` 2×1)·**건널 널**(\`bd-obj-gangplank\` 1×2)은 바닥 그림이다 — 놓인 물 칸을 걷게 된다. 뭍에 닿게 놓는다(건널 널은 세로로 이어 물을 건넌다).
- **걸어 지나는 문**(${K_GATES.map((i) => `\`bd-obj-${i.id}\` ${i.name.split(" · ")[0]} ${i.width}×${i.height}`).join(" · ")}): 가운데 열의 아랫칸이 비어 있다 — 그 칸으로 걸어서 지난다. 그 칸과 앞뒤 한 칸에 다른 기물을 두지 않는다.
- **이어 찍는 것**(${KINDS.filter((i) => i.growth).map((i) => `\`bd-obj-${i.id}\` ${i.name.split(" · ")[0]}`).join(" · ")}): 가로로 이어 찍는다(repeat x) — 그림이 칸의 왼쪽·오른쪽 끝까지 닿아 이어진다.
- 이름으로 찾기: 아래 낱말(한국어·영어)이 그 킷을 첫째로 준다. 옛 킷이 이름으로 가진 말은 여전히 옛 킷이 먼저 받는다.

종류별 수: ${KIND_ORDER.map((k) => `${KIND_NAMES[k]}(\`${k}\`) ${KINDS.filter((i) => i.kinds?.includes(k)).length}`).join(" · ")}.

그림 \`kinds-1x.png\`(원본 해상도) · \`kinds-2x.png\`: 종류마다 한 무더기씩 풀밭에, 아래 못에 물 위 것.

| 오류 코드 | 변조한 맵 칸 | 무엇을 했나 | 그림 |
|---|---|---|---|
${K_MUTATIONS.map((m) => `| \`${m.code}\` | (${m.cell[0]},${m.cell[1]}) | ${m.how} | err-kind-${m.code}.png (왼쪽 정상 · 오른쪽 오류, 빨간 상자) |`).join("\n")}

자동 검사(같은 스크립트): 마을 종류 장면의 킷 칸이 3층에 통째로 있는가 · 막힌 칸/걸음 칸이 선언과 같은가 · 건널 널 둘을 ${K_WALK.map(([x, y]) => `(${x},${y})`).join("→")} 로 걸어 건널 수 있는가 · 줄 나룻배·빨래 디딤판에 뭍에서 올라설 수 있는가 · 배·말뚝·수문 칸은 있으나 없으나 막혀 있는가 · 걸어 지나는 문의 빈 칸을 지날 수 있는가 · 물 위 것을 뭍에, 뭍의 것을 물 위에 놓으면 거절되는가 · 킷의 \`kind:\` 태그가 목록과 같은가.
확인하지 않는 것: 그림의 미적 품질·3/4 시점(관문 미통과다 — 기계 검사 불합격 그림을 포함해 모두 구웠다), 한 벌이 한 곳으로 읽히는지(사람이 장면 판에서 본다), 마을 빌더가 종류에 맞게 놓는지(마을 종류 작업의 몫이다).
`;
const kindGuide = `# 버들항 마을 종류별 기물 사전 — ${KINDS.length}종 (bd-obj-*, 2026-11-14)

타일셋 \`beodeul_city\` · 16px 칸, 한 줄 128칸 · 모든 칸 3층. 좌표 (dx,dy) 는 킷 왼쪽 위가 (0,0), 놓는 기준점 base = 맨 아래 줄 왼쪽 칸. 규칙·검사는 README 8절.
**3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 ${KIND_WAIVER}). 종류 id 는 킷 태그 \`kind:<id>\` · \`kinds.json\` 과 같다. 여러 종류에 속한 킷은 첫 종류의 표에 있고, 다른 종류에는 «같이 쓰는 것» 으로 적었다.

${KIND_ORDER.map((k) => {
  const own = KINDS.filter((i) => i.kinds?.[0] === k), shared = KINDS.filter((i) => i.kinds?.includes(k) && i.kinds[0] !== k);
  return `## ${KIND_NAMES[k]} — \`${k}\` (${own.length + shared.length})

| 킷 id | 무엇 | 크기 | 칸 번호 | 놓는 방식 | 막힌 칸 | ★ 칸 | 찾는 낱말(킷 태그) |
|---|---|---|---|---|---|---|---|
${own.map(nrow).join("\n")}${shared.length ? `\n\n같이 쓰는 것: ${shared.map((i) => `\`bd-obj-${i.id}\` ${i.name.split(" · ")[0]} ${i.width}×${i.height}`).join(" · ")}` : ""}`;
}).join("\n\n")}
`;
const kindDoc = `# 버들항 마을 종류별 기물 배열 (${KW}×${KH}, 16px)

\`index = y*${KW} + x\`. 숫자는 \`beodeul_city\` 칸 번호(−1 = 빈 칸). 1층 = 풀 ${GRASS}, 못은 호숫가 오토타일 \`beodeul_lakeshore_grass\`(x 1~${KW - 2}, y ${K_POND}~${K_POND + 3}). 3층 = 기물. 2·4층은 비었다.
실제 놓기 도구(stamp_tileset_object)가 낸 배열 그대로다. 검사 결함 0. 그림 \`kinds-1x.png\`(원본 ${KW * T}×${KH * T}) · \`kinds-2x.png\`.

## 종류마다 한 무더기 (종류 id · 왼쪽 위 좌표 · 크기)

${kBlocks.map((b) => `- \`${b.kind}\` ${KIND_NAMES[b.kind]} (${b.x},${b.y}) ${b.w}×${b.h}`).join("\n")}

## 놓은 순서 (킷 id · 왼쪽 위 좌표 · base)

${kPlaced.map((p, i) => `${i + 1}. \`${kitOf(p.id).id}\` (${p.x},${p.y}) · base (${p.x},${p.y + item(p.id).height - 1})`).join("\n")}

건널 널 걷기 확인 경로: ${K_WALK.map(([x, y]) => `(${x},${y})`).join("→")}.

## 1층 lowerTiles (한 줄 = 맵 한 줄)

\`\`\`
${Array.from({ length: KH }, (_, y) => Array.from({ length: KW }, (_, x) => layerTileAt(kindScene, 1, y * KW + x)).join(",")).join("\n")}
\`\`\`

## 3층 upperTiles

\`\`\`
${Array.from({ length: KH }, (_, y) => Array.from({ length: KW }, (_, x) => layerTileAt(kindScene, 3, y * KW + x)).join(",")).join("\n")}
\`\`\`

## 2층 lowerOverlayTiles · 4층 upperOverlayTiles

모두 −1(쓰지 않는다).
`;
const newDoc = `# 버들항 새 종류 기물 배열 (${NW}×${NH}, 16px)

\`index = y*${NW} + x\`. 숫자는 \`beodeul_city\` 칸 번호(−1 = 빈 칸). 1층 = 풀 ${GRASS}, 못은 호숫가 오토타일 \`beodeul_lakeshore_grass\`(x 1~${NW - 2}, y ${POND_Y}~${POND_Y + 3}). 3층 = 기물. 2·4층은 비었다.
실제 놓기 도구(stamp_tileset_object)가 낸 배열 그대로다. 검사 결함 0. 그림 \`new-1x.png\`(원본 ${NW * T}×${NH * T}) · \`new-2x.png\`.

## 놓은 순서 (킷 id · 왼쪽 위 좌표 · base)

${nPlaced.map((p, i) => `${i + 1}. \`${kitOf(p.id).id}\` (${p.x},${p.y}) · base (${p.x},${p.y + item(p.id).height - 1})`).join("\n")}

징검돌 걷기 확인 경로: ${N_WALK.map(([x, y]) => `(${x},${y})`).join("→")}.

## 1층 lowerTiles (한 줄 = 맵 한 줄)

\`\`\`
${Array.from({ length: NH }, (_, y) => Array.from({ length: NW }, (_, x) => layerTileAt(newScene, 1, y * NW + x)).join(",")).join("\n")}
\`\`\`

## 3층 upperTiles

\`\`\`
${Array.from({ length: NH }, (_, y) => Array.from({ length: NW }, (_, x) => layerTileAt(newScene, 3, y * NW + x)).join(",")).join("\n")}
\`\`\`

## 2층 lowerOverlayTiles · 4층 upperOverlayTiles

모두 −1(쓰지 않는다).
`;
const variantsDoc = `# 버들항 기물 종류별 변형 배열 (${VW}×${VH}, 16px)

\`index = y*${VW} + x\`. 숫자는 \`beodeul_city\` 칸 번호(−1 = 빈 칸). 1층 = 풀 ${GRASS} 한 가지, 3층 = 기물. 2·4층은 비었다.
실제 놓기 도구(stamp_tileset_object, 게임 열쇠 없음 — 적은 id 그대로)가 낸 배열이다. 검사 결함 0. 그림 \`variants-1x.png\`(원본 ${VW * T}×${VH * T}) · \`variants-3x.png\`.

## 놓은 순서 (킷 id · 왼쪽 위 좌표 · base) — 줄의 첫 킷이 원본, 뒤가 그 변형

${families.map((f) => vPlaced.filter((p) => p.base === f.base.id).map((p) => `\`${p.kit}\` (${p.x},${p.y}) base (${p.x},${p.y + p.h - 1})`).join(" · ")).map((line, i) => `${i + 1}. ${line}`).join("\n")}

## 3층 upperTiles (한 줄 = 맵 한 줄)

\`\`\`
${Array.from({ length: VH }, (_, y) => Array.from({ length: VW }, (_, x) => layerTileAt(variantScene, 3, y * VW + x)).join(",")).join("\n")}
\`\`\`

## 1층 lowerTiles · 2층 · 4층

1층은 모든 칸 ${GRASS}(풀). 2층 lowerOverlayTiles · 4층 upperOverlayTiles 는 모두 −1.
`;
const layer = (m: GameMap, n: 1 | 2 | 3 | 4) => Array.from({ length: m.height }, (_, y) => Array.from({ length: m.width }, (_, x) => layerTileAt(m, n, y * m.width + x)).join(","));
const example = `# 버들항 이야기 기물 조립 예제 배열 (${W}×${H}, 16px)

\`index = y*${W} + x\`. 숫자는 \`beodeul_city\` 칸 번호(−1 = 빈 칸). 1층 = 땅(풀 ${GRASS}, 못은 호숫가 오토타일 \`beodeul_lakeshore_grass\`), 3층 = 기물. 2·4층은 비었다.
실제 놓기 도구(stamp_tileset_object)가 낸 배열 그대로다. 검사 결함 0. 그림 \`scene-1x.png\`(원본 ${W * T}×${H * T}) · \`scene-3x.png\`.

## 놓은 순서 (킷 id · 왼쪽 위 좌표 · base)

${placed.map((p, i) => `${i + 1}. \`${kitOf(p.id).id}\` (${p.x},${p.y}) · base (${p.x},${p.y + item(p.id).height - 1})`).join("\n")}

못(물 칸): x 2~7, y 8~11. 널빤지 길 걷기 확인 경로: ${WALK.map(([x, y]) => `(${x},${y})`).join("→")}. 입구 칸: 동굴 (3,3) · 유적 (18,3), 접근칸 (3,4) · (18,4).

## 1층 lowerTiles (한 줄 = 맵 한 줄)

\`\`\`
${layer(scene, 1).join("\n")}
\`\`\`

## 3층 upperTiles

\`\`\`
${layer(scene, 3).join("\n")}
\`\`\`

## 2층 lowerOverlayTiles · 4층 upperOverlayTiles

모두 −1(쓰지 않는다).

## 사전 그림 atlas-3x.png 의 자리 (${AW}×${AH} 풀밭, 왼쪽 위 좌표)

${atlasAt.map((p) => `- \`${kitOf(p.id).id}\` (${p.x},${p.y}) ${item(p.id).width}×${item(p.id).height}`).join("\n")}
`;
assert(guide.length <= 120000 && example.length <= 120000 && variantsDoc.length <= 120000 && newDoc.length <= 120000 && kindGuide.length <= 120000 && kindDoc.length <= 120000, `문서가 너무 길다: ${guide.length} ${example.length} ${variantsDoc.length} ${newDoc.length} ${kindGuide.length} ${kindDoc.length}`);
fs.writeFileSync(`${ROOT}/README.md`, guide);
fs.writeFileSync(`${ROOT}/KINDS.md`, kindGuide);
fs.writeFileSync(`${ROOT}/example.json`, JSON.stringify({ map: { id: scene.id, width: W, height: H, lowerTiles: scene.lowerTiles, upperTiles: scene.upperTiles }, placed, walk: WALK, entrances: ["3,3", "18,3"], errors,
  variants: { map: { id: variantScene.id, width: VW, height: VH, upperTiles: variantScene.upperTiles }, placed: vPlaced, errors: vErrors },
  news: { map: { id: newScene.id, width: NW, height: NH, lowerTiles: newScene.lowerTiles, upperTiles: newScene.upperTiles }, placed: nPlaced, walk: N_WALK, errors: nErrors },
  kinds: { map: { id: kindScene.id, width: KW, height: KH, lowerTiles: kindScene.lowerTiles, upperTiles: kindScene.upperTiles }, placed: kPlaced, blocks: kBlocks, walk: K_WALK, errors: kErrors } }, null, 1) + "\n");
const img = (file: string) => `/assets/beodeul-objects/${file}`;
const category = {
  id: "beodeul-objects", name: "버들항 · 이야기 기물과 새 종류 기물(샘·입구·제단·널빤지 길 · 살림·물 위·바위·묘지 · 마을 종류별 벌)",
  description: `이야기가 부르는 기물 16종, 종류별 변형 ${VARIANTS.length}종, 새 종류 ${NEWS.length}종(마을 살림·물가와 물 위·농장·숲 바닥·절벽 바위·유적과 묘지 — 물 위 것은 물 칸 위에만, 징검돌은 밟고 건넌다)(bd-obj-*, 칸 ${catalog.base}~): 킷 사전·층·통행, 놓는 순서(입구 접근칸·물 위 널빤지 길), 16종을 모두 쓴 조립 예제 배열, 우물·벤치·이정표 등 ${families.length}종류의 다른 그림(원본 킷 id 로 놓으면 게임마다 하나를 고른다), 마을 종류 ${KIND_ORDER.length - 1}개의 생업 장면 벌과 공통 기물 ${KINDS.length}종(킷 태그 kind:<종류 id> — 한 벌을 한 자리에 모아 놓는다), 정상/오류 그림. 3/4 관문 미통과 — 오너 면제 그림.`,
  documents: [
    { id: "bd-obj-guide", name: "이야기 기물 사전·실행 순서·검사 범위", markdown: guide },
    { id: "bd-obj-example", name: `이야기 기물 조립 예제 배열(${W}×${H})`, markdown: example },
    { id: "bd-obj-variants", name: `종류별 변형 배열(${VW}×${VH})`, markdown: variantsDoc },
    { id: "bd-obj-new", name: `새 종류 배열(${NW}×${NH})`, markdown: newDoc },
    { id: "bd-obj-kinds-guide", name: `마을 종류별 기물 사전(${KINDS.length}종 · 종류 ${KIND_ORDER.length - 1}개와 공통)`, markdown: kindGuide },
    { id: "bd-obj-kinds", name: `마을 종류별 기물 배열(${KW}×${KH})`, markdown: kindDoc },
  ],
  images: [
    { id: "bd-obj-atlas", name: "이야기 기물 16종(목록 순서)", caption: `풀밭 위에 실제 칸을 놓은 그림을 3배 최근접 확대(원본 ${AW * T}×${AH * T}). 자리는 「조립 예제 배열」 문서 끝. 128색 학습 사본 — 게임 소재로 잘라 쓰지 않는다.`, dataUrl: img("atlas-3x.png") },
    { id: "bd-obj-scene", name: `조립 예제 ${W}×${H} (원본 해상도)`, caption: `원본 ${W * T}×${H * T}, 시트 칸 그대로(실제 놓기 도구 출력). 검사 결함 0.`, dataUrl: img("scene-1x.png") },
    { id: "bd-obj-scene-3x", name: `조립 예제 ${W}×${H} (3배 최근접)`, caption: "같은 장면을 3배 최근접 확대. 못 위 널빤지 길 ㄱ자·막다른 잔교, 입구 둘 앞 접근칸이 비어 있다.", dataUrl: img("scene-3x.png") },
    { id: "bd-obj-variants", name: `종류별 변형 ${VARIANTS.length}종 (원본 해상도)`, caption: `원본 ${VW * T}×${VH * T}. 종류마다 한 줄 — 맨 왼쪽이 원본 킷, 그 오른쪽이 변형(칸 크기·막힌 칸이 원본과 같다). 자리는 「종류별 변형 배열」 문서.`, dataUrl: img("variants-1x.png") },
    { id: "bd-obj-variants-3x", name: `종류별 변형 ${VARIANTS.length}종 (3배 최근접)`, caption: "같은 그림을 3배 최근접 확대. 128색 학습 사본 — 게임 소재로 잘라 쓰지 않는다.", dataUrl: img("variants-3x.png") },
    { id: "bd-obj-new", name: `새 종류 ${NEWS.length}종 (원본 해상도)`, caption: `원본 ${NW * T}×${NH * T}. 쓰임 순서로 풀밭에 줄지어 놓고, 아래 못에 물 위 것과 못을 건너는 징검돌 한 줄. 자리는 「새 종류 배열」 문서.`, dataUrl: img("new-1x.png") },
    { id: "bd-obj-new-2x", name: `새 종류 ${NEWS.length}종 (2배 최근접)`, caption: "같은 그림을 2배 최근접 확대. 128색 학습 사본 — 게임 소재로 잘라 쓰지 않는다.", dataUrl: img("new-2x.png") },
    { id: "bd-obj-kinds", name: `마을 종류별 기물 ${KINDS.length}종 (원본 해상도)`, caption: `원본 ${KW * T}×${KH * T}. 종류마다 한 무더기씩 풀밭에, 아래 못에 물 위 것과 못을 건너는 건널 널. 자리는 「마을 종류별 기물 배열」 문서.`, dataUrl: img("kinds-1x.png") },
    { id: "bd-obj-kinds-2x", name: `마을 종류별 기물 ${KINDS.length}종 (2배 최근접)`, caption: "같은 그림을 2배 최근접 확대. 128색 학습 사본 — 게임 소재로 잘라 쓰지 않는다.", dataUrl: img("kinds-2x.png") },
    ...K_MUTATIONS.map((m) => ({ id: `bd-obj-err-kind-${m.code}`, name: `정상/오류 · ${m.code} · ${m.title}`, caption: `왼쪽 정상 · 오른쪽 오류(빨간 상자 = 마을 종류 장면 칸 (${m.cell[0]},${m.cell[1]})). ${m.how} 검사 코드 ${m.code} 검출. 3배 최근접 확대.`, dataUrl: img(`err-kind-${m.code}.png`) })),
    ...N_MUTATIONS.map((m) => ({ id: `bd-obj-err-new-${m.code}`, name: `정상/오류 · ${m.code} · ${m.title}`, caption: `왼쪽 정상 · 오른쪽 오류(빨간 상자 = 새 종류 장면 칸 (${m.cell[0]},${m.cell[1]})). ${m.how} 검사 코드 ${m.code} 검출. 3배 최근접 확대.`, dataUrl: img(`err-new-${m.code}.png`) })),
    ...V_MUTATIONS.map((m) => ({ id: `bd-obj-err-variant-${m.code}`, name: `정상/오류 · ${m.code} · ${m.title}`, caption: `왼쪽 정상 · 오른쪽 오류(빨간 상자 = 변형 장면 칸 (${m.cell[0]},${m.cell[1]})). ${m.how} 검사 코드 ${m.code} 검출. 3배 최근접 확대.`, dataUrl: img(`err-variant-${m.code}.png`) })),
    ...MUTATIONS.map((m) => ({ id: `bd-obj-err-${m.code}`, name: `정상/오류 · ${m.code} · ${m.title}`, caption: `왼쪽 정상 · 오른쪽 오류(빨간 상자 = 맵 칸 (${m.cell[0]},${m.cell[1]})). ${m.how} 검사 코드 ${m.code} 검출. 실제 시트 칸 조립을 3배 최근접 확대.`, dataUrl: img(`err-${m.code}.png`) })),
  ],
};
fs.writeFileSync(`${ROOT}/references.json`, JSON.stringify([category], null, 1) + "\n");
const refs = JSON.parse(fs.readFileSync(REFS, "utf8")) as { id: string }[];
const at = refs.findIndex((c) => c.id === category.id);
if (at < 0) refs.push(category); else refs[at] = category;
// prepare-beodeul-city-references.py·wall_refs.py 와 같은 꼴(구조 줄바꿈만, 들여쓰기 없음)
fs.writeFileSync(REFS, JSON.stringify(refs, null, 1).replace(/\n +/g, "\n") + "\n");
console.log(JSON.stringify({ kinds: KINDS.length, kindScene: `${KW}x${KH}`, kindErrors: kErrors.map((e) => `${e.code}@(${e.cell})`), news: NEWS.length, newScene: `${NW}x${NH}`, newErrors: nErrors.map((e) => `${e.code}@(${e.cell})`), variants: VARIANTS.length, families: families.length, variantErrors: vErrors.map((e) => `${e.code}@(${e.cell})`), docs: category.documents.map((d) => [d.id, d.markdown.length]), images: category.images.length, sceneFindings: 0, errors: errors.map((e) => `${e.code}@(${e.cell})`), entrances }));
