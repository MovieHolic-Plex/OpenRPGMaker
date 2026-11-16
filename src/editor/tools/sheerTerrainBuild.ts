// 깎아지른 지형 시공 — 계획(sheerTerrainPlan.ts)을 버들항 맵에 싣는다: 높이(relief.style "sheer") · 장치 칸 · 물 · 폭포 · 널다리 · 풀 결 · 볼거리 · 상자 · 막기 · 맵 배경.
//
// 도구 build_sheer_terrain(쓰기): 조수 v2 의 route 갈래(make_place type "route" + hints.kind) 빌더가 부른다. 모델은 칸·좌표를 쓰지 않는다.
// 맵 배경: 빈 곳이 있는 갈래(하늘 고원 · 정상)는 견본 파노라마(set_map_properties background.preset 과 같은 값 — mapBackgroundFromPanoramaSet)를 스스로 건다.
//   빈 곳(0 단)은 렌더러가 투명하게 두고, 1층 타일도 비운다(-1) — 그래야 게임이 빈 칸에 배경을 비친다(showInEmptyCells).
// 그림은 타일·킷만 쓴다(새로 그린 화소 없음) — 면 · 장치 그림은 렌더러가 조각(sheerArt)에서 읽는다.
import { tilesetLookGround } from "@/assets/tilesetLooks";
import { mapBackgroundFromPanoramaSet } from "@/assets/oprnPanoramas";
import { canMove, isPassable } from "@/project/collision";
import { autotileVariantForMask, canonicalAutotileMask8 } from "@/project/defaults/autotileEngine";
import { activeTilesetLook } from "@/project/kitLook";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { invalidateReliefSlopes } from "@/project/relief/walk";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { layBeodeulGrassGrain } from "./beodeulGrassGrain";
import { planBeodeulCanopy, raiseBeodeulCrowns, shapeBeodeulCanopyMask, writeBeodeulCanopy } from "./beodeulForest";
import { layBeodeulWaterSurface } from "./beodeulWater";
import { planSheerTerrain, SHEER_DEVICES, SHEER_KINDS, sheerKindById, type SheerPlan, type SheerSide } from "./sheerTerrainPlan";
import { SHARED_OBJECT_TOOLS } from "./sharedObjectTools";
import { ToolError, type ToolDefinition } from "./types";

const GRASS = 737;
/** 막는 칸(그림 없음 · solid) — 닿지 않는 걷는 칸을 막을 때 3층에 둔다. */
const SOLID_BLANK = 67;
const SIDES: readonly SheerSide[] = ["north", "south", "east", "west"];

export interface SheerBuildReport {
  readonly kind: string; readonly seed: number; readonly width: number; readonly height: number;
  readonly faceCells: number; readonly levels: number; readonly walkablePct: number;
  readonly devices: readonly { kind: string; lo: number; hi: number; at: { x: number; y: number }; extra?: boolean }[];
  readonly reach: { readonly ok: boolean; readonly missing: readonly string[]; readonly sealed: number };
  readonly entry: { x: number; y: number; side: SheerSide };
  readonly exits: readonly { x: number; y: number; side: SheerSide }[];
  readonly landmark?: { kit: string; x: number; y: number; front: { x: number; y: number }; placed: boolean };
  readonly deadEnd?: { x: number; y: number; chest: boolean };
  readonly falls: number; readonly fords: number; readonly forestCells: number;
  readonly background?: { preset: string; view: "horizon" | "surface"; prompt: string };
  readonly warnings: readonly string[];
}

/** 계획을 맵에 싣는다. map 은 버들항 칩셋의 맵(크기는 계획과 같다). */
export function buildSheerTerrain(project: Project, map: GameMap, plan: SheerPlan): SheerBuildReport {
  const tileset = project.tilesets[map.tilesetId]!;
  const { W, H, kind } = plan, N = W * H, warnings = [...plan.warnings];
  const stamp = SHARED_OBJECT_TOOLS.find((t) => t.name === "stamp_object")!;
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const water = tileset.autotileGroups?.find((g) => g.id === "beodeul_canal_lake_47")?.variantMap?.["255"] ?? -1;
  const plank = kits.get("bd-pick-fishing-port-jetty-west")?.rows.map((r) => r.tiles?.[0] ?? -1).filter((t) => t >= 0) ?? [];
  // ---------- 1. 바닥: 걷는 땅은 풀, 빈 곳은 비운다(맵 배경이 비친다), 물은 물 몸통 ----------
  for (let c = 0; c < N; c++) {
    for (const L of [2, 3, 4] as const) setLayerTileAt(map, L, c, -1);
    map.lowerTiles[c] = plan.levels[c] ? GRASS : -1;
    if (map.upperTiles) map.upperTiles[c] = -1;
  }
  const fords = new Set(plan.fords);
  if (water >= 0) for (let c = 0; c < N; c++) if (plan.water[c] && !fords.has(c)) map.lowerTiles[c] = water;
  plan.fords.forEach((c, i) => { if (plank.length) map.lowerTiles[c] = plank[1 + (i % Math.max(1, plank.length - 1))] ?? plank[0]!; });
  // ---------- 2. 높이 ----------
  map.relief = { width: W, height: H, levels: Array.from(plan.levels), ramps: Array.from(plan.ramps), style: "sheer" };
  invalidateReliefSlopes(map.relief);
  // ---------- 3. 물 둑 · 깊이 띠 · 폭포 ----------
  const wet = (c: number) => !!plan.water[c];
  if (water >= 0 && plan.water.some(Boolean)) {
    layBeodeulWaterSurface(map, tileset, { seed: plan.seed, wet: (c) => wet(c) || fords.has(c), open: (c) => wet(c) && !fords.has(c) && layerTileAt(map, 2, c) < 0 });
  }
  // 폭포는 렌더러가 그린다(relief.falls — 그린 턱 · 코드로 짠 물기둥 · 물보라, 면 한 띠). 벽면 장식 타일은 깎아지른 면(48px)에 맞지 않는다.
  if (plan.falls.length) map.relief.falls = plan.falls.map((f) => ({ x: f.x0, y: f.y, w: f.x1 - f.x0 + 1 }));
  const falls = plan.falls.length;
  // ---------- 4. 볼거리 · 막다른 턱 상자 · 둘레 꾸밈 ----------
  const put = (kit: string, x: number, y: number): boolean => {
    if (!kits.has(kit)) return false;
    try { stamp.run(project, { objectId: `kit:${tileset.id}/${kit}`, mapId: map.id, x, y }); return true; } catch { return false; }
  };
  const landmarkPlaced = plan.landmark ? put(plan.landmark.kit, plan.landmark.x, plan.landmark.y) : false;
  if (plan.landmark && !landmarkPlaced) warnings.push(`landmark kit ${plan.landmark.kit} could not be stamped`);
  const chest = plan.deadEnd ? put(kind.chest, plan.deadEnd.x, plan.deadEnd.y - 1) || put(kind.chest, plan.deadEnd.x, plan.deadEnd.y) : false;
  // 바깥 숲: 버들항 숲 수관 오토타일(마을 숲과 같은 그림 · 같은 밝기)로 같은 단끼리 덮는다 — 단 끝 너머로 이으면 두 높이에서 칸 선으로 썰린다
  let forestCells = 0;
  if (plan.forest.some(Boolean)) {
    const lv = plan.levels, set = new Set<number>();
    for (let c = 0; c < N; c++) if (plan.forest[c]) set.add(c);
    const sameLv = (a: number, b: number) => lv[a] === lv[b];
    shapeBeodeulCanopyMask(W, H, set, { canFill: () => false, joins: sameLv, minComponent: 12, minExtent: 3, minInterior: 0.15, block: 2 });
    const cp = planBeodeulCanopy(W, H, "leaf", set, (c) => !set.has(c) && lv[c]! > 0 && !plan.water[c] && !plan.ramps[c] && layerTileAt(map, 2, c) < 0, sameLv);
    writeBeodeulCanopy(project, map, tileset, cp);
    raiseBeodeulCrowns(map, tileset, new Set(cp.canopy.keys()), plan.seed);
    forestCells = cp.canopy.size;
  }
  // 꾸밈(목표 화면 a·b·c, 2026-11-16 감독 검토): 장치 사이 흙길 · 짙은 풀 무리 · 풀포기 무리 · 못가 부들과 돌 · 맨 위 단 나무 · 덤불 · 면의 덩굴과 돌.
  // 막는 킷은 놓을 때마다 닿는 길을 다시 재고, 목표나 다른 걷는 칸을 끊으면 되돌린다.
  dressSheerTerrain(project, map, tileset, plan, put, kits);
  // ---------- 5. 풀 결(버들항 풀 변형 섞기) ----------
  const look = activeTilesetLook(tileset);
  // 겉모습이 없는 게임(조수 첫 맵 · 오프라인)은 풀포기 무리 결 — 목표 화면처럼 짙은 풀 무리가 섞여 깔린다
  layBeodeulGrassGrain(project, map, look?.grain ?? "tufted", { seed: plan.seed, ...((g) => (g ? { ground: g } : {}))(tilesetLookGround(tileset.id, look)) });
  // ---------- 6. 닿는 길: 그림 칸까지 본 물들이기, 닿지 않는 걷는 칸은 막는다 ----------
  const flood = () => {
    const s = plan.entry.y * W + plan.entry.x, seen = new Set<number>([s]), q = [s];
    for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = ny * W + nx; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen.has(n) || !canMove(project, map, x, y, nx, ny)) continue; seen.add(n); q.push(n); } }
    return seen;
  };
  let seen = flood();
  const goal = (label: string, c: { x: number; y: number }) => ({ label, c });
  const goals = [...plan.exits.map((e) => goal(`exit ${e.side} (${e.x},${e.y})`, e)), ...(plan.landmark ? [goal(`landmark front (${plan.landmark.front.x},${plan.landmark.front.y})`, plan.landmark.front)] : []), ...(plan.deadEnd ? [goal(`dead-end ledge (${plan.deadEnd.x},${plan.deadEnd.y})`, plan.deadEnd)] : [])];
  let sealed = 0;
  for (let c = 0; c < N; c++) {
    const x = c % W, y = (c - x) / W;
    if (seen.has(c) || !isPassable(project, map, x, y)) continue;
    setLayerTileAt(map, 3, c, SOLID_BLANK); sealed++;
  }
  seen = flood();
  const missing = goals.filter((g) => !seen.has(g.c.y * W + g.c.x)).map((g) => g.label);
  let walk = 0; for (let c = 0; c < N; c++) if (seen.has(c)) walk++;
  // ---------- 7. 맵 배경 ----------
  let background: SheerBuildReport["background"];
  if (kind.backdrop) {
    const bg = mapBackgroundFromPanoramaSet(kind.backdrop.preset);
    if (bg) { map.background = bg; background = { ...kind.backdrop }; }
  }
  return {
    kind: kind.id, seed: plan.seed, width: W, height: H, faceCells: 3, levels: plan.levelCount,
    walkablePct: Math.round((walk / N) * 100),
    devices: plan.devices.map((d) => { const c = d.cells[0] ?? 0; return { kind: d.kind, lo: d.lo, hi: d.hi, at: { x: c % W, y: Math.floor(c / W) }, ...(d.extra ? { extra: true } : {}) }; }),
    forestCells,
    reach: { ok: missing.length === 0, missing, sealed },
    entry: plan.entry, exits: plan.exits,
    ...(plan.landmark ? { landmark: { kit: plan.landmark.kit, x: plan.landmark.x, y: plan.landmark.y, front: plan.landmark.front, placed: landmarkPlaced } } : {}),
    ...(plan.deadEnd ? { deadEnd: { ...plan.deadEnd, chest } } : {}),
    falls, fords: plan.fords.length,
    ...(background ? { background } : {}),
    warnings,
  };
}

const DRESS = {
  tufts: ["bd-pick-deep-forest-path-wild-a", "bd-pick-deep-forest-path-wild-b", "bd-pick-deep-forest-path-wild-c", "bd-pick-deep-forest-path-heath-a", "bd-pick-deep-forest-path-heath-b", "bd-pick-deep-forest-path-fern-c"],
  stones: ["bd-pick-deep-forest-path-stones-a"],
  rim: ["bd-obj-bulrush", "bd-obj-bulrush", "bd-pick-coast-cliff-road-sea-rock-s"],
  pads: ["bd-pick-dungeon-theme-lily-pads"],
  bushes: ["bd-org-bush-m", "bd-obj-berry-bush"],
  wall: ["bd-out-ivy", "bd-mpart-ivy-wall-a", "bd-mpart-ivy-wall-b"],
  wallBits: ["bd-obj-boulder-s"],
  tree: { "sky-plateau": ["bd-tree-3e8732", "bd-tree-a80c85"], summit: ["bd-pick-coast-cliff-road-fir-m", "bd-pick-coast-cliff-road-fir-l"], "waterfall-terraces": ["bd-tree-f4f319", "bd-tree-3e8732"] } as Record<string, string[]>,
};

/** 깎아지른 지형 꾸밈 — 목표 화면의 땅 꾸밈을 버들항 킷 · 오토타일로. 그림을 새로 그리지 않는다. */
function dressSheerTerrain(project: Project, map: GameMap, tileset: TilesetDef, plan: SheerPlan,
  put: (kit: string, x: number, y: number) => boolean, kits: ReadonlyMap<string, NonNullable<TilesetDef["structureKits"]>[number]>): void {
  const { W, H, kind } = plan, N = W * H, lv = plan.levels;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const R = (i: number, salt: number) => hash01(i, plan.seed, salt);
  const top = Math.max(...lv);
  // 걷는 윗면 칸: 단 · 물 · 장치 · 숲 · 가려진 칸 · 막다른 턱 밖
  const open = (c: number) => lv[c]! > 0 && !plan.water[c] && !plan.ramps[c] && !plan.forest[c] && !plan.hidden[c] && layerTileAt(map, 2, c) < 0;
  /** 둘레 r 칸이 모두 같은 단(가장자리 · 면 위 · 다른 단 곁이 아니다) */
  const inner = (c: number, r: number) => { const x = c % W, y = (c - x) / W; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { if (!inMap(x + dx, y + dy) || lv[(y + dy) * W + x + dx] !== lv[c]) return false; } return true; };
  const reserved = new Uint8Array(N);
  const mark = (c: number, r: number) => { const x = c % W, y = (c - x) / W; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (inMap(x + dx, y + dy)) reserved[(y + dy) * W + x + dx] = 1; };
  for (const d of plan.devices) for (const c of d.cells) mark(c, 1);
  for (const c of [plan.entry, ...plan.exits, ...(plan.landmark ? [plan.landmark.front] : []), ...(plan.deadEnd ? [plan.deadEnd] : [])]) mark(c.y * W + c.x, 1);
  for (let c = 0; c < N; c++) if (layerTileAt(map, 3, c) >= 0) mark(c, 0);
  // 장치 끝(사다리 · 덩굴 · 계단의 위 칸과 발치, 다리 양끝)도 비운다
  for (const d of plan.devices) {
    const xs = d.cells.map((c) => c % W), ys = d.cells.map((c) => Math.floor(c / W));
    for (const x of xs) for (const y of [Math.min(...ys) - 1, Math.max(...ys) + 1]) if (inMap(x, y)) mark(y * W + x, 1);
  }
  // ---- 닿는 길 재기(시공 6 단계와 같은 물들이기) ----
  const flood = () => {
    const s = plan.entry.y * W + plan.entry.x, seen = new Set<number>([s]), q = [s];
    for (let h = 0; h < q.length; h++) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy, n = ny * W + nx; if (!inMap(nx, ny) || seen.has(n) || !canMove(project, map, x, y, nx, ny)) continue; seen.add(n); q.push(n); } }
    return seen;
  };
  const goals = [...plan.exits, ...(plan.landmark ? [plan.landmark.front] : []), ...(plan.deadEnd ? [plan.deadEnd] : [])].map((g) => g.y * W + g.x);
  let reach = flood();
  const goalsOk = (seen: Set<number>) => goals.every((g) => !reach.has(g) || seen.has(g));
  const layers = () => [map.lowerTiles.slice(), map.upperTiles.slice(), map.lowerOverlayTiles?.slice(), map.upperOverlayTiles?.slice()] as const;
  /** 킷을 놓고, 막는 칸이 있으면 닿는 길을 다시 잰다 — 목표나 그 밖의 걷는 칸을 끊으면 되돌린다. */
  const place = (id: string, x: number, y: number): boolean => {
    const k = kits.get(id); if (!k) return false;
    for (let j = 0; j < k.height; j++) for (let i = 0; i < k.width; i++) { const X = x + i, Y = y + j; if (!inMap(X, Y)) return false; const e = Y * W + X; if (reserved[e] || !open(e) || lv[e] !== lv[y * W + x]) return false; }
    const blocks = k.rows.some((r) => (r.upperTiles ?? []).some((t) => t >= 0 && ((p) => !!p && !p.up && !p.down && !p.left && !p.right)(tileset.passability[t])));
    const snap = blocks ? layers() : undefined;
    if (!put(id, x, y)) return false;
    if (snap) {
      const seen = flood();
      let lost = 0; for (const c of reach) if (!seen.has(c)) lost++;
      if (!goalsOk(seen) || lost > k.width * k.height) {
        map.lowerTiles = snap[0]; map.upperTiles = snap[1]; if (snap[2]) map.lowerOverlayTiles = snap[2]; if (snap[3]) map.upperOverlayTiles = snap[3];
        return false;
      }
      reach = seen;
    }
    for (let j = 0; j < k.height; j++) for (let i = 0; i < k.width; i++) reserved[(y + j) * W + x + i] = 1;
    return true;
  };
  // ---- 1) 흙길: 같은 단 덩이 안에서 장치 끝(위 · 아래)과 볼거리 앞을 잇는다 — 두 칸 폭 모랫길 오토타일(목표 a 의 흙길) ----
  const sand = tileset.autotileGroups?.find((g) => g.id === "beodeul_sand_autotile");
  const path = new Set<number>();
  if (sand) {
    const ends: number[] = [];
    for (const d of plan.devices) {
      const xs = d.cells.map((c) => c % W), ys = d.cells.map((c) => Math.floor(c / W)), x = xs[0]!;
      const pts = d.kind === "bridge" ? [[Math.min(...xs) - 1, ys[0]!], [Math.max(...xs) + 1, ys[0]!]] : [[x, Math.min(...ys) - 1], [x, Math.max(...ys) + 1]];
      for (const [px, py] of pts) if (inMap(px!, py!)) ends.push(py! * W + px!);
    }
    if (plan.landmark) ends.push(plan.landmark.front.y * W + plan.landmark.front.x);
    const walk = (c: number) => lv[c]! > 0 && !plan.water[c] && !plan.ramps[c] && !plan.forest[c] && !plan.hidden[c];
    const pending = ends.filter(walk);
    const done = new Set<number>();
    for (const s0 of pending) {
      if (done.has(s0)) continue;
      // s0 에서 같은 단의 가장 가까운 다른 끝(또는 이미 깐 길)까지 — 너무 멀면 잇지 않는다
      const prev = new Map<number, number>([[s0, -1]]), q = [s0]; let hit = -1;
      for (let h = 0; h < q.length && hit < 0; h++) {
        const c = q[h]!, x = c % W, y = (c - x) / W;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy, n = ny * W + nx; if (!inMap(nx, ny) || prev.has(n) || !walk(n) || lv[n] !== lv[s0]) continue;
          prev.set(n, c); q.push(n);
          if ((pending.includes(n) && n !== s0) || path.has(n)) { hit = n; break; }
        }
      }
      if (hit < 0 || q.length > W * H) continue;
      const cells: number[] = []; for (let c = hit; c >= 0; c = prev.get(c)!) cells.push(c);
      if (cells.length > (W + H) * 0.7 || cells.length < 5) continue;
      for (const c of cells) { const x = c % W, y = (c - x) / W; for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) { const n = (y + dy) * W + x + dx; if (inMap(x + dx, y + dy) && walk(n) && lv[n] === lv[c] && inner(n, 1)) path.add(n); } }
      done.add(s0); done.add(hit);
    }
    const isPath = (x: number, y: number) => !inMap(x, y) || path.has(y * W + x);
    for (const c of path) {
      const x = c % W, y = (c - x) / W; let m = 0;
      for (const [dx, dy, bit] of [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8], [1, -1, 16], [1, 1, 32], [-1, 1, 64], [-1, -1, 128]] as const) if (isPath(x + dx, y + dy)) m |= bit;
      const t = autotileVariantForMask(sand, m, x, y) ?? sand.variantMap[String(canonicalAutotileMask8(m))] ?? sand.variantMap["255"];
      if (typeof t === "number") { map.lowerTiles[c] = t; reserved[c] = 1; }
    }
  }
  // (짙은 풀 무리는 깔지 않는다 — 짙은 풀 오토타일이 이 크기에서는 각진 네모로 읽혔다. 짙은 결은 풀 결 섞기(5 단계)의 무리가 맡는다.)
  // ---- 3) 풀포기 · 작은 돌 무리(통행 — 무리 지어) ----
  for (let i = 0, n = Math.max(3, Math.round(N / 90)); i < n * 4; i++) {
    const c = Math.floor(R(i, 61) * N); if (!open(c) || reserved[c]) continue;
    const x0 = c % W, y0 = (c - x0) / W, many = 2 + Math.floor(R(i, 62) * 4);
    for (let k = 0; k < many; k++) {
      const x = x0 + Math.floor(R(i * 7 + k, 63) * 5) - 2, y = y0 + Math.floor(R(i * 7 + k, 64) * 3) - 1;
      const list = R(i * 7 + k, 65) < 0.12 ? DRESS.stones : DRESS.tufts;
      place(list[Math.floor(R(i * 7 + k, 66) * list.length)]!, x, y);
    }
  }
  // ---- 3b) 갈래 꾸밈 킷(큰 바위 · 돌탑 등) 몇 ----
  for (let i = 0, n = 0; i < 400 && n < Math.round(N / 200); i++) {
    const c = Math.floor(R(i, 41) * N); if (!open(c) || reserved[c] || !inner(c, 1)) continue;
    if (place(kind.dressing[Math.floor(R(i, 42) * kind.dressing.length)]!, c % W, Math.floor(c / W))) { n++; mark(c, 2); }
  }
  // ---- 4) 못가: 부들 · 바위(물에 닿는 땅), 못 위 연잎 ----
  for (let c = 0; c < N; c++) {
    if (!plan.water[c] || R(c, 71) > 0.5) continue;
    const x = c % W, y = (c - x) / W;
    if (R(c, 72) < 0.06) { const pad = DRESS.pads[0]!, k = kits.get(pad); if (k && !reserved[c]) { const in4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => inMap(x + dx!, y + dy!) && plan.water[(y + dy!) * W + x + dx!]); if (in4 && put(pad, x, y)) mark(c, 1); } }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, -1]] as const) {
      const X = x + dx, Y = y + dy; if (!inMap(X, Y) || R(Y * W + X, 73) > 0.22) continue;
      const id = DRESS.rim[Math.floor(R(Y * W + X, 74) * DRESS.rim.length)]!, k = kits.get(id); if (!k) continue;
      place(id, X, Y - (k.height - 1));
    }
  }
  // ---- 5) 맨 위 단에 나무 하나(넓은 맵은 둘) — 가장자리에서 한 칸 들어와 ----
  const trees = DRESS.tree[kind.id] ?? [];
  let planted = 0;
  for (let i = 0; i < 300 && trees.length && planted < (N > 1400 ? 2 : 1); i++) {
    const id = trees[Math.floor(R(i, 81) * trees.length)]!, k = kits.get(id); if (!k) continue;
    const cands: number[] = []; for (let c = 0; c < N; c++) if (lv[c] === top && inner(c, 1)) cands.push(c);
    if (!cands.length) break;
    const c = cands[Math.floor(R(i, 82) * cands.length)]!, x = c % W, y = (c - x) / W;
    let ok = true; for (let j = 0; j < k.height && ok; j++) for (let q = 0; q < k.width; q++) { const e = (y + j) * W + x + q; if (!inMap(x + q, y + j) || lv[e] !== top || !inner(e, 1)) { ok = false; break; } }
    if (ok && place(id, x, y)) planted++;
  }
  // ---- 6) 덤불: 윗면 북쪽 가장자리 · 면 발치 곁에 드문드문 ----
  for (let i = 0, n = Math.round(N / 120); i < n * 3; i++) {
    const c = Math.floor(R(i, 91) * N), x = c % W, y = (c - x) / W; if (!open(c) || reserved[c]) continue;
    const northEdge = y > 0 && lv[c - W]! < lv[c]!, foot = y > 0 && lv[c - W]! > lv[c]!;
    if (!northEdge && !foot && R(i, 92) > 0.15) continue;
    place(DRESS.bushes[Math.floor(R(i, 93) * DRESS.bushes.length)]!, x, y);
  }
  // ---- 7) 면 꾸밈(relief.wallDecor — 그림만): 윗테에서 늘어진 덩굴, 면 중간의 돌 · 덤불 ----
  const relief = map.relief!; const decor = [...(relief.wallDecor ?? [])];
  const busyCol = new Set<number>();
  for (const d of plan.devices) for (const c of d.cells) { busyCol.add(c % W); busyCol.add(c % W - 1); busyCol.add(c % W + 1); }
  const fallCols = new Set<number>(); for (const f of plan.falls) for (let x = f.x0 - 1; x <= f.x1 + 1; x++) fallCols.add(f.y * W + x);
  const nearDevice = (x: number, y: number) => plan.devices.some((d) => d.cells.some((e) => Math.abs((e % W) - x) <= 1 && Math.abs(Math.floor(e / W) - y) <= 4));
  let lastX = -9, lastY = -1;
  for (let c = 0; c < N; c++) {
    const x = c % W, y = (c - x) / W; if (y + 1 >= H || !lv[c]) continue;
    const below = lv[c + W]!, rows = 3 * (lv[c]! - below); if (rows < 3 || fallCols.has(c) || nearDevice(x, y)) continue;
    if (x > 0 && lv[c - 1] !== lv[c] || x + 1 < W && lv[c + 1] !== lv[c]) continue;   // 엽 끝(둥근 모서리)은 비운다
    if (y === lastY && x - lastX < 4) continue;
    const r = R(c, 101);
    if (r < 0.13) {
      const id = DRESS.wall[Math.floor(R(c, 102) * DRESS.wall.length)]!, k = kits.get(id); if (!k) continue;
      k.rows.forEach((row, j) => { const t = row.upperTiles?.[0] ?? -1; if (t >= 0 && j + 1 <= rows) decor.push({ x, y, row: j + 1, tile: t }); });
      lastX = x; lastY = y;
    } else if (r < 0.19) {
      const id = DRESS.wallBits[Math.floor(R(c, 103) * DRESS.wallBits.length)]!, t = kits.get(id)?.rows[0]?.upperTiles?.[0] ?? -1; if (t < 0) continue;
      decor.push({ x, y, row: Math.min(rows - 1, 2 + Math.floor(R(c, 104) * (rows - 2))), tile: t });
      lastX = x; lastY = y;
    }
  }
  if (decor.length) relief.wallDecor = decor;
}

const hash01 = (a: number, b: number, c: number): number => {
  let h = Math.imul(a * 73856093 ^ b * 19349663 ^ c * 83492791, 0x27d4eb2d);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

/** 조수 v2 빌더가 부르는 도구 — 이미 만든 버들항 맵 위에 깎아지른 지형 한 장을 시공한다. 조수에게 직접 내놓지 않는다(make_place 의 route 갈래가 부른다). */
export const SHEER_TERRAIN_TOOLS: readonly ToolDefinition[] = [{
  name: "build_sheer_terrain", mode: "write", domains: ["map"], preservesAuthoredRaster: true,
  description: "버들항 맵 한 장에 깎아지른 지형(단 하나 = 면 3칸 · 엽 꼴 고원 · 단마다 장치 · 물길과 폭포 · 볼거리 · 막다른 턱 · 빈 곳에 맵 배경)을 시공한다. "
    + `kind: ${SHEER_KINDS.map((k) => `${k.id}(${k.ko})`).join(" · ")}. 맵 크기는 그대로 쓴다. 결과 data 는 단 수 · 걷는 땅 몫 · 장치 · 닿는 길 검사 · 들어오는/나가는 칸.`,
  parameters: {
    type: "object",
    properties: {
      mapId: { type: "string" },
      kind: { type: "string", enum: SHEER_KINDS.map((k) => k.id) },
      seed: { type: "integer" },
      sides: { type: "array", items: { type: "string", enum: [...SIDES] }, description: "길이 닿을 변(첫째가 들어오는 변). 기본 south · north" },
    },
    required: ["mapId", "kind"], additionalProperties: false,
  },
  run(project, args) {
    const map = project.maps[String(args.mapId)];
    if (!map) throw new ToolError(`맵 ${String(args.mapId)} 가 없습니다.`, { code: "map-not-found" });
    const tileset = project.tilesets[map.tilesetId];
    if (!tileset || map.tilesetId !== "beodeul_city") throw new ToolError("버들항(beodeul_city) 맵만 지원합니다.", { code: "unsupported-tileset", mapId: map.id });
    const kind = sheerKindById(String(args.kind));
    if (!kind) throw new ToolError(`kind 는 ${SHEER_KINDS.map((k) => k.id).join("·")} 중 하나입니다.`, { code: "invalid-args", mapId: map.id });
    const seed = Number.isFinite(Number(args.seed)) ? Math.floor(Number(args.seed)) : 1;
    const sides = (Array.isArray(args.sides) ? args.sides : []).map(String).filter((s): s is SheerSide => (SIDES as readonly string[]).includes(s));
    const plan = planSheerTerrain(kind, map.width, map.height, seed, sides.length ? sides : ["south", "north"]);
    const report = buildSheerTerrain(project, map, plan);
    const devices = report.devices.map((d) => `${SHEER_DEVICES[d.kind as keyof typeof SHEER_DEVICES]?.ko ?? d.kind}(${d.lo}→${d.hi})`).join(" · ");
    return {
      summary: `깎아지른 지형 «${kind.ko}» ${map.width}×${map.height}: 단 ${report.levels} · 면 3칸 · 걷는 땅 ${report.walkablePct}% · 장치 ${report.devices.length}(${devices}) · 닿는 길 ${report.reach.ok ? "모두 닿음" : `못 닿음 ${report.reach.missing.join(", ")}`}${report.reach.sealed ? ` · 막은 칸 ${report.reach.sealed}` : ""}${report.background ? ` · 맵 배경 ${report.background.preset}` : ""}`,
      data: { mapId: map.id, ...report },
      ...(report.warnings.length ? { warnings: report.warnings } : {}),
    };
  },
}];
