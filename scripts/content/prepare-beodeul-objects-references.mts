// 버들항 이야기 기물(bd-obj-*, 시트 꼬리 34,944~) 참고문서 — 공용 번들 beodeulCityReferences.json 의 용도 `beodeul-objects` 를 만든다.
//
//   bun scripts/content/prepare-beodeul-objects-references.mts
//
// 하는 일(tiledata/AI-REFERENCE-CONTRACT.md): 정확한 사전(킷 id·칸 번호·층·통행) · 실행 순서 · 조립 예제 한 장면의 네 층 전체 배열 ·
// 원본 해상도 그림 · 정상/오류 나란한 그림(실제로 변조해 검출) · 자동 좌표 검사와 그 범위.
// 장면은 손으로 칸을 찍지 않고 실제 놓기 도구(stamp_tileset_object)로 놓는다 — 문서의 배열은 도구가 낸 그대로다.
// 쓰는 것: tiledata/beodeul-objects/{README.md,references.json,example.json,*.png}(정본) · public/assets/beodeul-objects/*.png(128색 학습 사본) ·
//          src/assets/beodeulCityReferences.json(용도 beodeul-objects 를 넣거나 바꾼다, 문서·그림 id 는 bd-obj- 머리라 번들 소유).
// 그림은 3/4 관문 미통과 — 오너 면제 묶음 fable-oneshot-2026-11-12 (굽기: scripts/content/beodeul-objects/bake.py).
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
      const blocked = it.block.some(([bx, by]) => bx === dx && by === dy);
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
  for (const it of catalog.items) {
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
assert.equal(new Set(placed.map((p) => p.id)).size, catalog.items.length, "예제가 16종을 모두 쓴다");
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
execFileSync("python3", ["-c", `
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
`, ROOT, PUB, JSON.stringify(MUTATIONS.map((m) => [m.code, m.cell]))]);
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
const guide = `# 버들항 이야기 기물 16종 — 샘·동굴 입구·유적 입구·게시판·쪽지·봉인 제단·널빤지 길 (bd-obj-*, 2026-11-12)

타일셋 \`beodeul_city\` · 그림 \`public/assets/beodeul-city/beodeul-city-chipset.png\`(텍스처 \`tex_beodeul_city\`) · **16px 칸, 한 줄 128칸**.
번호 n 의 칸 = 행 ⌊n/128⌋, 열 n mod 128. 이 기물의 칸은 시트 꼬리 **${catalog.base}~${catalog.base + catalog.items.flatMap((i) => i.rows.flat()).filter((n) => n >= 0).length - 1}**(행 ${catalog.base / 128})이다. 다른 칩셋 번호를 섞지 않는다.
게임들이 바랐는데 그림이 없던 물건이다(조수 실행의 «없는 그림» 장부). 그림 정본 \`tiledata/beodeul-objects/pieces/<id>.png\`, 정의 \`tiledata/beodeul-objects/spec.json\`, 굽기 \`scripts/content/beodeul-objects/bake.py\`.
**3/4 관문 미통과 — 오너 면제 그림**(면제 묶음 fable-oneshot-2026-11-12, Claude Fable 5.2 한 방 그림). 관문을 통과한 그림이 아니다 — 스토어로는 나가지 않는다.

## 1. 정확한 사전

모든 칸은 **3층(upperTiles)** 에 놓는다(1층 = 땅·물은 그대로 둔다 — 투명 화소 밑으로 풀·물이 비친다). 2·4층은 쓰지 않는다.
- **서 있는 기물**: 막힌 칸은 사람과 같은 층(네 방향 막힘), 나머지 칸은 ★(사람 위에 그려지고 걸을 수 있다 — 지붕·윗면).
- **바닥 그림**(널빤지 길·쪽지): 사람 아래에 그려지고 걸을 수 있다. 3층에 있으므로 **물 칸 위에 놓으면 그 칸을 걸을 수 있게 된다**(엔진은 ★ 아닌 맨 위 층의 통행을 쓴다).
칸 번호 행렬은 위 줄 → 아래 줄(« / » 로 줄을 나눔), 좌표 (dx,dy) 는 킷 왼쪽 위가 (0,0).

| 킷 id | 무엇 | 크기 | 칸 번호 | 놓는 방식 | 막힌 칸 | ★ 칸 | 반복 | 입구·접근칸 | 찾는 낱말(킷 태그) |
|---|---|---|---|---|---|---|---|---|---|
${catalog.items.map(row).join("\n")}

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
assert(guide.length <= 120000 && example.length <= 120000);
fs.writeFileSync(`${ROOT}/README.md`, guide);
fs.writeFileSync(`${ROOT}/example.json`, JSON.stringify({ map: { id: scene.id, width: W, height: H, lowerTiles: scene.lowerTiles, upperTiles: scene.upperTiles }, placed, walk: WALK, entrances: ["3,3", "18,3"], errors }, null, 1) + "\n");
const img = (file: string) => `/assets/beodeul-objects/${file}`;
const category = {
  id: "beodeul-objects", name: "버들항 · 이야기 기물(샘·입구·제단·게시판·쪽지·널빤지 길)",
  description: `이야기가 부르는 기물 16종(bd-obj-*, 칸 ${catalog.base}~): 킷 사전·층·통행, 놓는 순서(입구 접근칸·물 위 널빤지 길), 16종을 모두 쓴 조립 예제 배열, 정상/오류 그림. 3/4 관문 미통과 — 오너 면제 그림.`,
  documents: [
    { id: "bd-obj-guide", name: "이야기 기물 사전·실행 순서·검사 범위", markdown: guide },
    { id: "bd-obj-example", name: `이야기 기물 조립 예제 배열(${W}×${H})`, markdown: example },
  ],
  images: [
    { id: "bd-obj-atlas", name: "이야기 기물 16종(목록 순서)", caption: `풀밭 위에 실제 칸을 놓은 그림을 3배 최근접 확대(원본 ${AW * T}×${AH * T}). 자리는 「조립 예제 배열」 문서 끝. 128색 학습 사본 — 게임 소재로 잘라 쓰지 않는다.`, dataUrl: img("atlas-3x.png") },
    { id: "bd-obj-scene", name: `조립 예제 ${W}×${H} (원본 해상도)`, caption: `원본 ${W * T}×${H * T}, 시트 칸 그대로(실제 놓기 도구 출력). 검사 결함 0.`, dataUrl: img("scene-1x.png") },
    { id: "bd-obj-scene-3x", name: `조립 예제 ${W}×${H} (3배 최근접)`, caption: "같은 장면을 3배 최근접 확대. 못 위 널빤지 길 ㄱ자·막다른 잔교, 입구 둘 앞 접근칸이 비어 있다.", dataUrl: img("scene-3x.png") },
    ...MUTATIONS.map((m) => ({ id: `bd-obj-err-${m.code}`, name: `정상/오류 · ${m.code} · ${m.title}`, caption: `왼쪽 정상 · 오른쪽 오류(빨간 상자 = 맵 칸 (${m.cell[0]},${m.cell[1]})). ${m.how} 검사 코드 ${m.code} 검출. 실제 시트 칸 조립을 3배 최근접 확대.`, dataUrl: img(`err-${m.code}.png`) })),
  ],
};
fs.writeFileSync(`${ROOT}/references.json`, JSON.stringify([category], null, 1) + "\n");
const refs = JSON.parse(fs.readFileSync(REFS, "utf8")) as { id: string }[];
const at = refs.findIndex((c) => c.id === category.id);
if (at < 0) refs.push(category); else refs[at] = category;
// prepare-beodeul-city-references.py·wall_refs.py 와 같은 꼴(구조 줄바꿈만, 들여쓰기 없음)
fs.writeFileSync(REFS, JSON.stringify(refs, null, 1).replace(/\n +/g, "\n") + "\n");
console.log(JSON.stringify({ docs: category.documents.map((d) => [d.id, d.markdown.length]), images: category.images.length, sceneFindings: 0, errors: errors.map((e) => `${e.code}@(${e.cell})`), entrances }));
