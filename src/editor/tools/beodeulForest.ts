// editor/tools/beodeulForest.ts — 버들항 숲 composer 정의를 고르고 접지 칸을 대상 칩셋에 이식한다(2026-10-20 woodland r2).
//
// 숲 종류(forestType): broadleaf 활엽 · conifer 침엽 · mixed 혼효. 그림은 모두 beodeul_city 원본 키트 칸이다
// (src/assets/beodeulForestComposer.json, 빌더 scripts/content/build-beodeul-forest-composer.py).
// 접지(TreeComposerGround, #3058 r6): 숲 바닥 그늘(1층)·숲 둘레 땅 그늘(2층) 칸은 공용 기초 칩셋 beodeul_ground 에 있어
// translateTiles 로 대상 칩셋에 이식한 번호로 바꿔 넘긴다(통행·우선순위는 source 그대로 — 둘 다 걸을 수 있다).
import data from "@/assets/beodeulForestComposer.json";
import { createBeodeulGroundTileset, ensureBeodeulGroundReferences } from "@/project/defaults/beodeulGround";
import { translateTiles } from "@/project/objectStamp";
import type { GameMap, Project, TilesetDef, TreeComposerDef, TreeComposerSprite } from "@/project/types";
import { composeTreesPlaced, treeComposerOwnTiles, treeHash, type TreePlacement } from "@/project/defaults/treeComposer";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";

export const BEODEUL_FOREST_TYPES = ["broadleaf", "conifer", "mixed"] as const;
export type BeodeulForestType = (typeof BEODEUL_FOREST_TYPES)[number];
export const BEODEUL_FOREST_TYPE_LABEL: Record<BeodeulForestType, string> = { broadleaf: "활엽수림", conifer: "침엽수림", mixed: "혼효림" };

export function parseBeodeulForestType(value: unknown, fallback: BeodeulForestType = "broadleaf"): BeodeulForestType {
  if (value === undefined || value === null || value === "") return fallback;
  if ((BEODEUL_FOREST_TYPES as readonly string[]).includes(String(value))) return value as BeodeulForestType;
  throw new Error(`forestType 은 ${BEODEUL_FOREST_TYPES.join("|")} 중 하나입니다(받은 값 ${String(value)}).`);
}

/**
 * 대상 칩셋(beodeul_city 계열)에서 쓸 composer 정의 — 접지 칸 번호를 이식해 채운다.
 * grassBases: 둘레 그늘을 깔 1층 잔디 칸(기본 민무늬 잔디 737). 둘레 그늘은 투명 덧칸이라 어느 잔디 위에서나 같은 칸을 쓴다.
 */
export function beodeulForestComposer(project: Project, target: TilesetDef, type: BeodeulForestType,
  grassBases: readonly number[] = data.ground.apronBases, woodlandGround = false): TreeComposerDef {
  const { groundShadeCover, groundShadeRows, ...rest } = structuredClone(data.types[type]);
  const def = rest as unknown as TreeComposerDef;
  const g = data.ground;
  const common = project.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  ensureBeodeulGroundReferences(common);
  // woodlandGround(r4 B): 숲 장면 잔디(채도 낮춤) 위 숲 바닥 칸 — 도로 숲 벽처럼 맵 바닥 전체가 숲 장면 잔디일 때
  const floorSrc = woodlandGround ? g.woodlandFloorTiles : g.floorTiles;
  const tr = translateTiles(common, target, [...floorSrc, ...g.floorEdgeTiles, ...g.apronTiles].filter((n) => n >= 0)).map;
  const to = (n: number) => (n >= 0 ? tr.get(n) ?? -1 : -1);
  def.ground = {
    shadeBits: g.shadeBits.map((b) => [...b]), shadeCover: groundShadeCover ?? g.shadeCover, shadeCoverBase: g.shadeCoverBase, shadeRows: groundShadeRows,
    floorTiles: floorSrc.map(to), apronLayer: g.apronLayer, apronBases: [...grassBases], apronTiles: grassBases.flatMap(() => g.apronTiles.map(to)),
  };
  edgeFloor.set(def, woodlandGround ? new Map() : new Map(g.floorTiles.map((n, k) => [to(n), to(g.floorEdgeTiles[k]!)] as const)));
  return def;
}

/** 숲 장면 잔디(737 채도 ×0.84, r4 B) 를 대상 칩셋으로 이식한 칸 번호. 공용 잔디 737 은 바꾸지 않는다. */
export function beodeulWoodlandGrass(project: Project, target: TilesetDef): number {
  const common = project.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  ensureBeodeulGroundReferences(common);
  return translateTiles(common, target, [data.ground.woodlandGrass]).map.get(data.ground.woodlandGrass) ?? -1;
}

const edgeFloor = new WeakMap<TreeComposerDef, Map<number, number>>();

/**
 * 숲 종류별 심기 규칙(woodland r3, 2026-10-21 독립 검수 D1~D6 대응).
 * gap: 두 밑동이 |dx|<gx 이고 |dy|<gy 이면 같이 서지 못한다. 격자가 아니라 해시 순 탐욕 배치라 밑동 높이·간격이 그루마다 다르다.
 * shapes: [모양, 몫] — 해시로 뽑는다. coniferShade: 침엽 그림은 줄기 칸 한 칸만 그늘 덮개(수관 옆으로 번지지 않게).
 */
type Shapes = readonly (readonly [string, number])[];
const PLANT: Record<BeodeulForestType, { gx: number; gy: number; rim: Shapes; core: Shapes }> = {
  // r4 B(2026-10-21 사용자 승인): 숲 덩이 한 톤 — 속(가장자리에서 2칸 이상)은 짙은 초록(D3 3×4·D2 덤불), 가장자리만 밝은 연두(큰 4×5 포함)
  broadleaf: { gx: 2, gy: 2, rim: [["T3", 0.5], ["B2", 0.3], ["T4", 0.2]], core: [["D3", 0.85], ["D2", 0.15]] },
  conifer: { gx: 2, gy: 2, rim: [["C3", 0.45], ["C2", 0.35], ["P1", 0.2]], core: [["C3", 0.45], ["C2", 0.35], ["P1", 0.2]] },
  mixed: { gx: 2, gy: 2, rim: [["T4", 0.4], ["T3", 0.35], ["S", 0.25]], core: [["D3", 0.55], ["S", 0.4], ["D2", 0.05]] },
};
const CONIFER_ART = /fir|eef4bc|28ad5e|c27062/u;

export interface BeodeulForestPlan { readonly placements: TreePlacement[]; readonly shade: Uint8Array }

/**
 * 밑동 자리 고르기. 지키는 것:
 *  · 그림의 보이는 칸(덮개 > 2%)이 모두 맵 안 — 맵 위쪽 끝에 수관 없는 줄기·잘린 꼭대기가 남지 않는다(D1·D2).
 *  · 칸마다 앞에서부터 불투명 칸이 나올 때까지 쌓인 조각 수 ≤ 그 칸에 쓸 수 있는 층 수(숲 3, 숲 밖 2 — 둘레 그늘이 2층을 쓴다).
 *    넘치면 뒤 나무가 칸 선에서 잘리므로(D5) 그 나무를 통째로 심지 않는다.
 *  · 숲 남쪽 끝 칸을 먼저 채우고(줄기·접지가 보이는 앞줄), 나머지는 해시 순 — 줄 맞춤 없음(D3).
 *  · 가까운(가로 3·세로 2칸 안) 나무와 같은 그림을 피한다(D3).
 * 그늘 덮개: 줄기 칸(침엽) 또는 아랫줄 덮개 칸(활엽, shadeRows) + 숲 가장자리에서 2~3칸 들어간 속 칸(D4 — 숲 속 바닥은 단색 그늘 덩이, 가장자리는 들쭉날쭉).
 */
export function planBeodeulForest(map: GameMap, def: TreeComposerDef, type: BeodeulForestType,
  forest: (x: number, y: number) => boolean, hold: (x: number, y: number) => boolean, seed: number): BeodeulForestPlan {
  const W = map.width, H = map.height, own = treeComposerOwnTiles(def), sd = seed * 131 + 7;
  const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;
  const isF = (x: number, y: number) => inMap(x, y) && forest(x, y);
  const canHold = (x: number, y: number) => {
    if (!inMap(x, y) || !hold(x, y)) return false;
    for (const L of def.layers) { const t = layerTileAt(map, L as 1 | 2 | 3 | 4, y * W + x); if (t >= 0 && !own.has(t)) return false; }
    return true;
  };
  const byShape = new Map<string, TreeComposerSprite[]>();
  for (const sp of def.sprites) if (!sp.dark) byShape.set(sp.shape, [...(byShape.get(sp.shape) ?? []), sp]);
  const rule = PLANT[type];
  // 숲 밖(맵 밖은 숲으로 본다)까지 체비쇼프 거리(1~3)
  const depth = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!forest(x, y)) continue;
    let d = 3;
    for (let r = 1; r <= 2 && d === 3; r++) {
      for (let dy = -r; dy <= r && d === 3; dy++) for (let dx = -r; dx <= r; dx++) {
        if ((Math.abs(dx) === r || Math.abs(dy) === r) && inMap(x + dx, y + dy) && !forest(x + dx, y + dy)) { d = r; break; }
      }
    }
    depth[y * W + x] = d;
  }
  const cand: { x: number; y: number; k: number }[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!forest(x, y)) continue;
    const front = !isF(x, y + 1);
    cand.push({ x, y, k: (front ? 0 : 1) + treeHash(x, y, sd) / 4294967296 });
  }
  cand.sort((a, b) => a.k - b.k);
  const stacks = new Map<number, { z: number; cv: number }[]>();
  const placed: (TreePlacement & { ax: number; ay: number })[] = [];
  const cap = (x: number, y: number) => (isF(x, y) ? def.layers.length : def.layers.length - 1);
  const fits = (sp: TreeComposerSprite, x0: number, y0: number, z: number): boolean => {
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
      const cv = sp.cover[j * sp.w + i] ?? 0, t = sp.tiles[j * sp.w + i] ?? -1;
      if (cv <= 0 || t < 0) continue;
      const xx = x0 + i, yy = y0 + j;
      if (!inMap(xx, yy)) { if (cv > 2) return false; continue; }
      if (cv > 2 && !canHold(xx, yy)) return false;
      const list = [...(stacks.get(yy * W + xx) ?? []), { z, cv }].sort((a, b) => b.z - a.z);
      let n = 0;
      for (const e of list) { n++; if (e.cv >= 98) break; }
      if (n > cap(xx, yy)) return false;
    }
    return true;
  };
  const topTouch: number[] = [], tipSet = new Set<number>(), trunkSet = new Set<number>();
  const tipCells = (sp: TreeComposerSprite, x0: number, y0: number): number[] => {
    if (!CONIFER_ART.test(sp.name)) return [];
    for (let j = 0; j < sp.h; j++) {
      const row: number[] = [];
      for (let i = 0; i < sp.w; i++) if ((sp.cover[j * sp.w + i] ?? 0) > 2 && inMap(x0 + i, y0 + j)) row.push((y0 + j) * W + x0 + i);
      if (row.length) return row;
    }
    return [];
  };
  for (const { x, y } of cand) {
    if (placed.some((p) => Math.abs(p.ax - x) < rule.gx && Math.abs(p.ay - y) < rule.gy)) continue;
    const r = treeHash(x, y, sd + 17) / 4294967296;
    const shapes = depth[y * W + x]! <= 1 ? rule.rim : rule.core;
    let acc = 0, first = shapes.length - 1;
    for (let i = 0; i < shapes.length; i++) { acc += shapes[i]![1]; if (r < acc) { first = i; break; } }
    const order = [first, ...shapes.map((_, i) => i).filter((i) => i !== first)];
    const z = y * 4096 + (treeHash(x, y, sd + 23) % 4096);
    let done = false;
    for (const si of order) {
      const shape = shapes[si]![0];
      const tcols = def.trunkCols[shape] ?? [0];
      if (!tcols.every((i) => isF(x + i, y))) continue;
      const near = new Set(placed.filter((p) => Math.abs(p.ax - x) <= 3 && Math.abs(p.ay - y) <= 2).map((p) => p.sprite.name));
      const all = byShape.get(shape) ?? [];
      const rot = treeHash(x, y, sd + 19 + si);
      const names = [...all.filter((sp) => !near.has(sp.name)), ...all.filter((sp) => near.has(sp.name))];
      const fresh = names.length - all.filter((sp) => near.has(sp.name)).length;
      const pick = fresh > 0 ? [names[rot % fresh]!, ...names] : names;
      for (const sp of pick) {
        const x0 = x, y0 = y - sp.h + 1;
        // 꼭대기가 수관 한계(맵 위 끝·hold 밖)에 딱 닿는 나무는 반만, 그리고 그런 나무끼리는 2칸 안에 하나만 —
        // 숲 윗줄 나무(특히 1칸 폭 측백)가 같은 높이로 늘어서지 않게(D2·D3, 2차 검수 N2)
        const touch = !tcols.some((i) => canHold(x + i, y0 - 1));
        if (touch && (treeHash(x, y, sd + 29) % 100 < 60 || topTouch.some((tx) => Math.abs(tx - x) <= 2))) continue;
        // 침엽 꼭대기가 다른 나무 줄기 칸에 꽂히지 않게(2차 검수 N4) — 꼭대기 칸 ↔ 줄기 칸이 겹치는 배치는 건너뛴다
        const tips = tipCells(sp, x0, y0), trunks = (def.trunkCols[sp.shape] ?? [0]).map((i) => y * W + x + i);
        if (tips.some((k) => trunkSet.has(k)) || trunks.some((k) => tipSet.has(k))) continue;
        if (!fits(sp, x0, y0, z)) continue;
        if (touch) topTouch.push(x);
        for (const k of tips) tipSet.add(k);
        for (const k of trunks) trunkSet.add(k);
        placed.push({ sprite: sp, x0, y0, z, ax: x, ay: y });
        for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
          const cv = sp.cover[j * sp.w + i] ?? 0, xx = x0 + i, yy = y0 + j;
          if (cv <= 0 || (sp.tiles[j * sp.w + i] ?? -1) < 0 || !inMap(xx, yy)) continue;
          const key = yy * W + xx; stacks.set(key, [...(stacks.get(key) ?? []), { z, cv }]);
        }
        done = true; break;
      }
      if (done) break;
    }
  }
  const shade = new Uint8Array(W * H), gr = def.ground;
  for (const p of placed) {
    const sp = p.sprite, conifer = CONIFER_ART.test(sp.name);
    const tcols = def.trunkCols[sp.shape] ?? [0];
    for (let j = 0; j < sp.h; j++) for (let i = 0; i < sp.w; i++) {
      const xx = p.x0 + i, yy = p.y0 + j, cv = sp.cover[j * sp.w + i] ?? 0;
      if (!inMap(xx, yy)) continue;
      const base = j === sp.h - 1;
      const on = conifer ? base && tcols.includes(i)
        : !!gr && j >= sp.h - (gr.shadeRows ?? sp.h) && cv >= (base ? gr.shadeCoverBase : gr.shadeCover);
      if (on) shade[yy * W + xx] = 1;
    }
  }
  // 숲 속 바닥(r4 B — jp 숲처럼 덩이 밑이 고르게 어둡다): 거리 2 이상은 그늘(3+ 전부, 2 는 80%), 가장자리 25%.
  // 나무가 없는 숲 칸(맵 위 끝처럼 그림이 다 들어가지 못해 비운 줄)에는 덩이를 깔지 않는다 — 나무 없는 그늘(D1)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const d = depth[y * W + x]!;
    if (!d) continue;
    let tree = false;
    for (let dy = -1; dy <= 1 && !tree; dy++) for (let dx = -1; dx <= 1; dx++) if (stacks.has((y + dy) * W + x + dx) && inMap(x + dx, y + dy)) { tree = true; break; }
    const pct = d >= 3 ? 100 : d === 2 ? 80 : 25;
    if (tree && treeHash(x, y, sd + 31) % 100 < pct) shade[y * W + x] = 1;
  }
  return { placements: placed.map(({ sprite, x0, y0, z }) => ({ sprite, x0, y0, z })), shade };
}

/**
 * 버들항 숲 한 번 짓기: 밑동 고르기(planBeodeulForest) → composer 칸 쌓기·접지 → 숲 가장자리 칸 바닥을 가장자리 변형으로.
 */
export function composeBeodeulForest(project: Project, map: GameMap, target: TilesetDef, type: BeodeulForestType,
  forest: (x: number, y: number) => boolean, hold: (x: number, y: number) => boolean, seed: number,
  write: (x: number, y: number) => boolean = hold, grassBases?: readonly number[], woodlandGround = false): TreeComposerDef {
  const def = beodeulForestComposer(project, target, type, grassBases, woodlandGround);
  const plan = planBeodeulForest(map, def, type, forest, hold, seed);
  composeTreesPlaced(map, def, plan.placements, plan.shade, forest, hold, write);
  const edge = edgeFloor.get(def)!;
  for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) {
    if (!forest(x, y) || !write(x, y)) continue;
    let rim = false;
    for (let dy = -1; dy <= 1 && !rim; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && !forest(nx, ny)) { rim = true; break; }
    }
    if (!rim) continue;
    const i = y * map.width + x, t = edge.get(layerTileAt(map, 1, i));
    if (t !== undefined && t >= 0) setLayerTileAt(map, 1, i, t);
  }
  return def;
}
