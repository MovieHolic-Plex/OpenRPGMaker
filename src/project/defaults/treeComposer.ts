// 나무 composer — 1층 「숲 바닥」 오토타일(AutotileGroup.composer)을 칠하거나 지운 둘레를 나무 그림 조각으로 2~4층에 다시 짠다.
// jp 숲 r4(2026-10-20). 규칙 원형: scripts/content/jp-city/forest/forest_r4_compose.py 의 anchor_at · cell_stack (해시까지 같다).
//
//  · 나무 = 그림 한 장(T4 4×5 · T3 3×4 · T2 2×3 …). 밑동 칸 (x, y) 에 나무가 서는지는 그 칸 해시와 이웃 몇 칸만으로 정해진다 —
//    짝수 줄 또는 숲 남쪽 끝 줄, 줄마다 위상이 다른 3칸 간격, 줄기 열이 숲 안, 그림 칸이 넘침 금지 칸에 걸리지 않을 것.
//  · 칸마다 덮는 조각을 깊이(남쪽 = 앞)로 줄 세워 앞에서부터 composer.layers(예: 4·3·2층)에 둔다. 앞 조각이 칸을 다 덮으면 뒤는 놓지 않는다.
//  · 수관은 숲 밖으로 넘칠 수 있으나 overhangOnTiles(잔디) 위로만, 그리고 2~4층에 남의 칸(집·소품)이 없는 곳만.
// 그래서 붓질 한 번은 둘레 몇 칸만 바꾸고(국소), 같은 숲 바닥이면 언제나 같은 나무가 선다(결정적).
// 순수 로직 — DOM/스토어에 의존하지 않는다. 편집기 붓·지우개·채우기, 조수 지형 도구, forestPainter 가 모두 엔진의
// shapeAutotileGroupAround 를 거쳐 여기로 온다.

import type { AutotileGroup, GameMap, TreeComposerDef, TreeComposerSprite } from "../types";
import { layerTileAt, setLayerTileAt, type TileLayerNo } from "../mapLayers";

export interface TreePoint { readonly x: number; readonly y: number }

/** forest_r4_compose.ih 와 비트까지 같은 32비트 해시. */
export function treeHash(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const h01 = (x: number, y: number, s: number): number => treeHash(x, y, s) / 4294967296;

/** 나무 한 그루: 그림, 왼쪽 위 칸, 깊이(클수록 앞). */
export interface TreePlacement { readonly sprite: TreeComposerSprite; readonly x0: number; readonly y0: number; readonly z: number }
type Placement = TreePlacement;

interface Ctx {
  readonly map: GameMap;
  readonly cp: TreeComposerDef;
  readonly W: number;
  readonly H: number;
  readonly floor: ReadonlySet<number>;
  readonly overhang: ReadonlySet<number>;
  readonly own: ReadonlySet<number>;
  readonly byKey: ReadonlyMap<string, readonly TreeComposerSprite[]>;
  readonly phase: Map<number, number>;
  readonly sd: number;
  readonly maxW: number;
  readonly maxH: number;
  /** 1층 숲 바닥 대신 쓰는 숲 판정(composeTreesInMask — 숲 바닥 오토타일이 없는 칩셋, 예: 버들항). */
  readonly forestAt?: (x: number, y: number) => boolean;
  /** 1층 잔디 판정 대신 쓰는 「수관이 덮어도 되는 칸」. */
  readonly holdAt?: (x: number, y: number) => boolean;
}

function context(map: GameMap, group: AutotileGroup, seed: number): Ctx | null {
  return group.composer ? contextFor(map, group.composer, group.memberTileIds, seed) : null;
}

function contextFor(map: GameMap, cp: TreeComposerDef, floorTiles: readonly number[], seed: number,
  forestAt?: (x: number, y: number) => boolean, holdAt?: (x: number, y: number) => boolean): Ctx | null {
  if (cp.kind !== "trees" || !cp.sprites?.length) return null;
  const byKey = new Map<string, TreeComposerSprite[]>();
  const own = new Set<number>();
  let maxW = 1, maxH = 1;
  for (const t of cp.ground?.apronTiles ?? []) if (t >= 0) own.add(t);
  for (const sp of cp.sprites) {
    const key = sp.shape + (sp.dark ? "d" : "");
    byKey.set(key, [...(byKey.get(key) ?? []), sp]);
    for (const t of sp.tiles) if (t >= 0) own.add(t);
    maxW = Math.max(maxW, sp.w); maxH = Math.max(maxH, sp.h);
  }
  // forest_r4_compose 는 같은 모양 안에서 이름 순으로 고른다 — 굽기도 이름 순으로 싣지만, 손으로 고친 정의에도 같게 맞춘다.
  for (const list of byKey.values()) list.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const floor = new Set(floorTiles);
  const overhang = new Set<number>([...(cp.overhangOnTiles ?? []), ...floor]);
  return { map, cp, W: map.width, H: map.height, floor, overhang, own, byKey, phase: new Map(), sd: seed * 101, maxW, maxH, forestAt, holdAt };
}

function isForest(c: Ctx, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= c.W || y >= c.H) return false;
  return c.forestAt ? c.forestAt(x, y) : c.floor.has(layerTileAt(c.map, 1, y * c.W + x));
}

/** 수관이 놓여도 되는 칸: 1층이 잔디·숲 바닥이고 composer 층(2~4층)에 남의 칸이 없다. */
function canHold(c: Ctx, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= c.W || y >= c.H) return false;
  const i = y * c.W + x;
  if (c.holdAt ? !c.holdAt(x, y) : !c.overhang.has(layerTileAt(c.map, 1, i))) return false;
  for (const L of c.cp.layers) {
    const t = layerTileAt(c.map, L as TileLayerNo, i);
    if (t >= 0 && !c.own.has(t)) return false;
  }
  return true;
}

function rowPhase(c: Ctx, y: number): number {
  const hit = c.phase.get(y);
  if (hit !== undefined) return hit;
  let p = 0;
  for (let i = 0; i <= (y >> 1); i++) p += 1 + (treeHash(0, i, 11 + c.sd) % 2);
  const v = (p + (y & 1)) % c.cp.colStep;
  c.phase.set(y, v);
  return v;
}

function anchorAt(c: Ctx, x: number, y: number): Placement | null {
  if (!isForest(c, x, y)) return null;
  if (!(y % c.cp.rowStep === 0 || !isForest(c, x, y + 1))) return null;
  if ((((x - rowPhase(c, y)) % c.cp.colStep) + c.cp.colStep) % c.cp.colStep !== 0) return null;
  if (h01(x, y, 13 + c.sd) < c.cp.skip) return null;
  const r = h01(x, y, 17 + c.sd);
  const [a, b, d] = c.cp.shapeOrder as [string, string, string];
  const [o1, o2] = c.cp.shapeOdds as [number, number];
  const order = r < o1 ? [a, b, d] : r < o2 ? [b, a, d] : [d, b];
  for (const shape of order) {
    const tcols = c.cp.trunkCols[shape] ?? [0];
    if (!tcols.every((i) => isForest(c, x + i, y))) continue;
    const inner = tcols.every((i) => isForest(c, x + i, y + 1));
    const names = c.byKey.get(shape + (inner ? "d" : "")) ?? [];
    if (!names.length) continue;
    const sp = names[treeHash(x, y, 19 + c.cp.shapeOrder.indexOf(shape) + c.sd) % names.length]!;
    const x0 = x, y0 = y - sp.h + 1;
    let ok = true;
    for (let j = 0; j < sp.h && ok; j++) {
      for (let i = 0; i < sp.w; i++) {
        if ((sp.cover[j * sp.w + i] ?? 0) <= 2) continue;
        const xx = x0 + i, yy = y0 + j;
        if (yy < 0) continue;                       // 맵 위쪽 밖으로 넘친 수관은 잘린다
        if (!canHold(c, xx, yy)) { ok = false; break; }
      }
    }
    if (ok) return { sprite: sp, x0, y0, z: y * 4096 + (treeHash(x, y, 23 + c.sd) % 4096) };
  }
  return null;
}

/** 영역 [x0,x1)×[y0,y1) 칸을 다시 짠다(나무 칸 + r6 땅 그늘). 바뀐 칸 수. */
function rewrite(c: Ctx, x0: number, y0: number, x1: number, y1: number, canWrite?: (x: number, y: number) => boolean,
  pre?: { readonly placements: readonly Placement[]; readonly cover: Uint8Array }): number {
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(c.W, x1); y1 = Math.min(c.H, y1);
  if (x1 <= x0 || y1 <= y0) return 0;
  const gr = c.cp.ground;
  // 그늘 덮개는 영역 바깥 한 칸까지 알아야 한다(그늘 코드가 이웃을 본다)
  const ex0 = Math.max(0, x0 - 1), ey0 = Math.max(0, y0 - 1), ex1 = Math.min(c.W, x1 + 1), ey1 = Math.min(c.H, y1 + 1);
  const cover = pre ? pre.cover : new Uint8Array(c.W * c.H);
  const stacks = new Map<number, { z: number; tile: number; cover: number }[]>();
  const found: Placement[] = [];
  if (pre) found.push(...pre.placements);
  else for (let y = ey0; y < Math.min(c.H, ey1 + c.maxH); y++) {
    for (let x = ex0 - c.maxW; x < ex1; x++) {
      const p = anchorAt(c, x, y);
      if (p) found.push(p);
    }
  }
  {
    for (const p of found) {
      const sp = p.sprite;
      for (let j = 0; j < sp.h; j++) {
        for (let i = 0; i < sp.w; i++) {
          const k = j * sp.w + i;
          const tile = sp.tiles[k] ?? -1, cv = sp.cover[k] ?? 0;
          if (tile < 0 || cv <= 0) continue;
          const xx = p.x0 + i, yy = p.y0 + j;
          if (xx < ex0 || yy < ey0 || xx >= ex1 || yy >= ey1) continue;
          const key = yy * c.W + xx;
          if (!pre && gr && j >= sp.h - (gr.shadeRows ?? sp.h) && cv >= (j === sp.h - 1 ? gr.shadeCoverBase : gr.shadeCover)) cover[key] = 1;
          if (xx < x0 || yy < y0 || xx >= x1 || yy >= y1) continue;
          const list = stacks.get(key) ?? [];
          list.push({ z: p.z, tile, cover: cv });
          stacks.set(key, list);
        }
      }
    }
  }
  const shadeCode = (x: number, y: number): number => {
    let code = 0;
    gr!.shadeBits.forEach(([dx, dy], k) => {
      let xx = x + dx!, yy = y + dy!;
      // composeTreesPlaced: 숲은 맵 끝 너머로 이어진다고 보고 맵 밖 이웃은 맵 끝 칸을 읽는다(맵 위 끝 숲 줄에 밝은 띠가 남지 않게)
      if (pre) { xx = Math.min(c.W - 1, Math.max(0, xx)); yy = Math.min(c.H - 1, Math.max(0, yy)); }
      if (xx >= 0 && yy >= 0 && xx < c.W && yy < c.H && cover[yy * c.W + xx]) code |= 1 << k;
    });
    return code;
  };
  let changed = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (canWrite && !canWrite(x, y)) continue;
      const i = y * c.W + x;
      // r6 접지: 숲 칸은 1층 숲 바닥 그늘 변형, 숲 밖 잔디 칸은 apronLayer 에 둘레 그늘 덧칸
      let apron = -1;
      if (gr) {
        const code = shadeCode(x, y);
        if (isForest(c, x, y)) {
          const t = gr.floorTiles[code] ?? gr.floorTiles[0]!;
          if (layerTileAt(c.map, 1, i) !== t) { setLayerTileAt(c.map, 1, i, t); changed++; }
        } else {
          const bi = gr.apronBases.indexOf(layerTileAt(c.map, 1, i));
          const cur = layerTileAt(c.map, gr.apronLayer as TileLayerNo, i);
          if (bi >= 0 && (cur < 0 || c.own.has(cur))) apron = gr.apronTiles[bi * 64 + code] ?? -1;
        }
      }
      const treeLayers = c.cp.layers.filter((L) => !(apron >= 0 && L === gr!.apronLayer));
      const list = (stacks.get(i) ?? []).sort((a, b) => b.z - a.z);
      const keep: number[] = [];
      for (const e of list) {
        keep.push(e.tile);
        if (e.cover >= 98 || keep.length === treeLayers.length) break;
      }
      for (const L of c.cp.layers) {
        const layer = L as TileLayerNo;
        const cur = layerTileAt(c.map, layer, i);
        if (cur >= 0 && !c.own.has(cur)) continue;      // 남의 칸(집·소품)은 그대로
        const n = treeLayers.indexOf(L);
        const next = apron >= 0 && L === gr!.apronLayer ? apron : n >= 0 ? (keep[n] ?? -1) : -1;
        if (cur !== next) { setLayerTileAt(c.map, layer, i, next); changed++; }
      }
    }
  }
  return changed;
}

/** 편집 칸 둘레만 다시 짠다(붓·지우개·채우기 한 번). 바뀐 칸 수. */
export function composeTreesAround(map: GameMap, group: AutotileGroup, points: readonly TreePoint[], canWrite?: (x: number, y: number) => boolean, seed = 0): number {
  if (!points.length) return 0;
  const c = context(map, group, seed);
  if (!c) return 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of points) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  // 칸 p 를 읽는 밑동의 그림은 p 에서 그림 크기만큼 떨어진 칸까지 덮는다
  const pad = Math.max(c.maxW, c.maxH) + 1;
  return rewrite(c, x0 - pad, y0 - pad, x1 + pad + 1, y1 + pad + 1, canWrite);
}

/** 맵 전체를 다시 짠다(forestPainter·불러온 뒤 맞추기). 바뀐 칸 수. */
export function composeTreesAll(map: GameMap, group: AutotileGroup, seed = 0): number {
  const c = context(map, group, seed);
  return c ? rewrite(c, 0, 0, c.W, c.H) : 0;
}

/** 이 그룹이 나무 composer 숲 바닥인가. */
export function isTreeComposerGroup(group: AutotileGroup): boolean {
  return group.composer?.kind === "trees";
}

/**
 * 숲 바닥 오토타일 없이 숲 칸 판정으로 맵 전체를 짠다(버들항 woodland, 2026-10-20).
 * forest(x,y) = 나무가 설 수 있는 숲 칸, hold(x,y) = 수관이 덮어도 되는 칸(숲 칸 포함). 규칙은 composeTreesAll 과 같다.
 * hold 밖 칸은 쓰지 않는다 — 같은 나무 그림을 따로 찍어 둔 낱 나무·덤불(composer 그림과 칸 번호가 같다)을 지우지 않게.
 */
export function composeTreesInMask(map: GameMap, cp: TreeComposerDef, forest: (x: number, y: number) => boolean,
  hold: (x: number, y: number) => boolean, seed = 0, write: (x: number, y: number) => boolean = hold): number {
  // write: 다시 짜도 되는 칸(기본 hold). 접지 둘레 그늘(apron)은 수관이 못 가는 숲 밖 잔디에 깔리므로 hold 보다 넓게 줄 수 있다(버들항 도로 숲 벽).
  const c = contextFor(map, cp, [], seed, forest, hold);
  return c ? rewrite(c, 0, 0, c.W, c.H, write) : 0;
}

/**
 * 밑동 자리를 부르는 쪽이 정한 나무 목록으로 짠다(버들항 woodland r3, 2026-10-21). 칸 쌓기·접지 그늘 칸 고르기는
 * composeTreesInMask 와 같고, 밑동 격자(anchorAt) 대신 placements, 그림 덮개 그늘 대신 shade(맵 칸마다 1 = 그늘 덮개)를 쓴다.
 * 침엽 숲처럼 격자 식재가 조림지로 읽히는 숲, 칸당 층 수를 넘는 겹침을 미리 빼야 하는 숲에 쓴다.
 */
export function composeTreesPlaced(map: GameMap, cp: TreeComposerDef, placements: readonly TreePlacement[], shade: Uint8Array,
  forest: (x: number, y: number) => boolean, hold: (x: number, y: number) => boolean, write: (x: number, y: number) => boolean = hold): number {
  const c = contextFor(map, cp, [], 0, forest, hold);
  return c ? rewrite(c, 0, 0, c.W, c.H, write, { placements, cover: shade }) : 0;
}

/** composer 정의가 「제 것」으로 보는 칸 번호(나무 그림 + 둘레 그늘). 이 밖의 칸이 2~4층에 있으면 남의 칸이다. */
export function treeComposerOwnTiles(cp: TreeComposerDef): Set<number> {
  const own = new Set<number>();
  for (const t of cp.ground?.apronTiles ?? []) if (t >= 0) own.add(t);
  for (const sp of cp.sprites ?? []) for (const t of sp.tiles) if (t >= 0) own.add(t);
  return own;
}
