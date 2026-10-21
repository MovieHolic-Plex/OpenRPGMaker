// 빽빽한 숲 칠하기(jp_city 블록 jp_forest_pack, 그림 scripts/content/jp-city/forest/forest_kit_proto.py).
// 순서: 마스크 → 수관 오토타일(3층) → 하늘선 키트(윗줄 4층 덧그림, 아래 두 줄 3층) → 수관 머리(3층 불투명, 활엽은 4층 덧그림 한 겹 더) → 줄기 띠(3층).
// 숲 구획 칸마다 종류(1 활엽 · 2 대숲)를 받는다. 수관은 아래로 띠 높이(활엽 1·대숲 2)만큼 같은 종류가 이어지는 칸이고,
// 그 밑 줄이 줄기 띠 자리다 — 띠도 숲 구획 안에 들어가므로 폭 3~4칸 얕은 띠(수관 2줄 + 띠 1줄)도 칠해진다.
// 순수 함수: 맵·타일셋 구조만 읽고 칸 쓰기는 콜백으로 한다(regionComposer 단계 실행기 jpRegionTool 이 부른다).

import type { AutotileGroup, GameMap } from "@/project/types";
import { autotileVariantForMask } from "@/project/defaults/autotileEngine";
import { composeTreesAll, composeTreesInMask } from "@/project/defaults/treeComposer";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";

export const JP_FOREST_BROADLEAF = 1;   // 느티나무·잡목 활엽
export const JP_FOREST_BAMBOO = 2;
export const JP_FOREST_SAKURA = 3;      // 벚나무 숲
export const JP_FOREST_SUGI = 4;        // 삼나무 숲(사토야마 산비탈·신사 숲)
export const JP_FOREST_MAPLE = 5;       // 단풍 숲(가을 활엽)
export const JP_FOREST_PINE = 6;        // 소나무 숲(신사·해안) — r3 에서는 섞인 숲(mh)으로 칠한다(시트 한도로 소나무 단독 오토타일 없음)
export const JP_FOREST_MIX_SHRINE = 7;  // 섞인 숲: 신사(진수의 숲) — r3 오토타일 jp-forest3-mh
export const JP_FOREST_MIX_HILL = 8;    // 섞인 숲: 산비탈(삼나무+활엽) — r3 오토타일 jp-forest3-mh

interface KitRowView { readonly tiles?: readonly number[]; readonly upperTiles?: readonly number[] }
interface KitView { readonly id: string; readonly width: number; readonly height: number; readonly rows: readonly KitRowView[] }
export interface JpForestTilesetView {
  readonly autotileGroups?: readonly { readonly id: string; readonly variantMap: Readonly<Record<string, number>>; readonly interiorVariants?: readonly (readonly number[])[]; readonly phaseVariants?: AutotileGroup["phaseVariants"]; readonly composer?: AutotileGroup["composer"]; readonly memberTileIds?: readonly number[] }[];
  readonly tileGroups?: readonly { readonly id: string; readonly tileIds: readonly number[] }[];
  readonly structureKits?: readonly KitView[];
}
export interface JpForestTarget {
  readonly width: number;
  readonly height: number;
  getLayer(layer: 1 | 2 | 3 | 4, index: number): number;
  setLayer(layer: 1 | 2 | 3 | 4, index: number, tile: number): void;
}
export interface JpForestReport { readonly canopy: number; readonly sky: number; readonly heads: number; readonly overlays: number; readonly bands: number }

const N = 1, E = 2, S = 4, W_ = 8, NE = 16, SE = 32, SW = 64, NW = 128;
function canon(m: number): number {
  let c = m & 15;
  if ((m & NE) && (m & N) && (m & E)) c |= NE;
  if ((m & SE) && (m & S) && (m & E)) c |= SE;
  if ((m & SW) && (m & S) && (m & W_)) c |= SW;
  if ((m & NW) && (m & N) && (m & W_)) c |= NW;
  return c;
}
const EDGE_N = canon(E | S | W_ | SE | SW);
const EDGE_S = canon(N | E | W_ | NE | NW);
const EDGE_W = canon(N | E | S | NE | SE);
const EDGE_E = canon(N | S | W_ | SW | NW);

function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const h01 = (x: number, y: number, s: number): number => hash(x, y, s) / 4294967296;

interface Kit { readonly w: number; readonly h: number; readonly up: readonly (readonly number[])[] }
function kitOf(k: KitView): Kit {
  return { w: k.width, h: k.height, up: k.rows.map((r) => [...(r.upperTiles ?? new Array<number>(k.width).fill(-1))]) };
}

interface KindSet {
  readonly code: number;
  readonly bandH: number;
  readonly variantMap: Readonly<Record<string, number>>;
  readonly interior: readonly number[];
  readonly edges: Readonly<Record<"n" | "s" | "w" | "e", readonly number[]>>;
  readonly heads: ReadonlyMap<string, readonly Kit[]>;     // 배치 키(c2x2…) → 변형
  readonly overlays: ReadonlyMap<string, readonly Kit[]>;
  readonly sky: readonly Kit[];
  readonly bands: ReadonlyMap<string, readonly Kit[]>;     // L·M·R·one → 변형
}

function kindSet(tileset: JpForestTilesetView, k: "bl" | "bb" | "sk" | "sg" | "mp", code: number): KindSet | null {
  const at = (tileset.autotileGroups ?? []).find((a) => a.id === `jp-forest-${k}`);
  if (!at) return null;
  const kits = (tileset.structureKits ?? []).filter((x) => x.id.startsWith(`jp-forest-${k}-`));
  const group = (side: string): number[] => [...((tileset.tileGroups ?? []).find((g) => g.id === `jp:forest-${k}-edge-${side}`)?.tileIds ?? [])];
  const collect = (prefix: string): Map<string, Kit[]> => {
    const out = new Map<string, Kit[]>();
    for (const kit of kits) {
      if (!kit.id.startsWith(prefix)) continue;
      const rest = kit.id.slice(prefix.length);          // "<키>-<v>"
      const key = rest.slice(0, rest.lastIndexOf("-"));
      out.set(key, [...(out.get(key) ?? []), kitOf(kit)]);
    }
    return out;
  };
  const edgesOr = (side: "n" | "s" | "w" | "e", mask: number): number[] => {
    const g = group(side);
    return g.length ? g : [at.variantMap[String(mask)]!];
  };
  return {
    code,
    bandH: k === "bb" ? 2 : 1,
    variantMap: at.variantMap,
    interior: at.interiorVariants?.[0]?.length ? [...at.interiorVariants[0]] : [at.variantMap["255"]!],
    edges: { n: edgesOr("n", EDGE_N), s: edgesOr("s", EDGE_S), w: edgesOr("w", EDGE_W), e: edgesOr("e", EDGE_E) },
    heads: collect(`jp-forest-${k}-head-`),
    overlays: collect(`jp-forest-${k}-headx-`),
    sky: kits.filter((x) => x.id.startsWith(`jp-forest-${k}-sky-`)).map(kitOf),
    bands: collect(`jp-forest-${k}-band-`),
  };
}

/** 이 타일셋에 숲 팩(jp_forest_pack)이 구워져 있는가. */
export function hasJpForestPack(tileset: JpForestTilesetView): boolean {
  return (tileset.autotileGroups ?? []).some((a) => a.id === "jp-forest-bl");
}

// 소나무(6)·신사(7)는 섞인 숲(mh, 삼나무+활엽)으로 칠한다. 섞인 숲은 한 오토타일 안에서 수관마다 종이 섞인다.
const R3_CODES: readonly (readonly [number, string])[] = [[JP_FOREST_BROADLEAF, "bl"], [JP_FOREST_BAMBOO, "bb"], [JP_FOREST_SAKURA, "sk"], [JP_FOREST_SUGI, "sg"], [JP_FOREST_MAPLE, "mp"],
  [JP_FOREST_PINE, "mh"], [JP_FOREST_MIX_SHRINE, "mh"], [JP_FOREST_MIX_HILL, "mh"]];

/** 이 타일셋에 붓으로 칠하는 숲 오토타일 r3(jp_forest_r3, jp-forest3-<k>)이 구워져 있는가. */
export function hasJpForestR3(tileset: JpForestTilesetView): boolean {
  return (tileset.autotileGroups ?? []).some((a) => a.id === "jp-forest3-bl" && !!a.phaseVariants);
}

/** r3: 종마다 8방 마스크 + 위치 위상으로 칸을 고른다(편집기 붓·조수 지형 도구와 같은 표). 3층에만 쓴다. */
export function paintJpForestR3(target: JpForestTarget, tileset: JpForestTilesetView, kind: Uint8Array, seed = 0): JpForestReport {
  const W = target.width, H = target.height;
  void seed;
  const groups = new Map<number, AutotileGroup>();
  for (const [code, k] of R3_CODES) {
    const g = (tileset.autotileGroups ?? []).find((a) => a.id === `jp-forest3-${k}`);
    if (g) groups.set(code, g as unknown as AutotileGroup);
  }
  for (let i = 0; i < kind.length; i++) if (kind[i] && !groups.has(kind[i]!)) kind[i] = JP_FOREST_BROADLEAF;
  let canopy = 0;
  const DIRS: readonly (readonly [number, number, number])[] = [[N, 0, -1], [E, 1, 0], [S, 0, 1], [W_, -1, 0], [NE, 1, -1], [SE, 1, 1], [SW, -1, 1], [NW, -1, -1]];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = kind[y * W + x]!;
      const g = k ? groups.get(k) : undefined;
      if (!g) continue;
      let m = 0;
      for (const [bit, dx, dy] of DIRS) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || kind[yy * W + xx] === k) m |= bit;   // 맵 밖은 숲으로 본다
      }
      const t = autotileVariantForMask(g, canon(m), x, y);
      if (t !== undefined && t >= 0) { target.setLayer(3, y * W + x, t); canopy++; }
    }
  }
  return { canopy, sky: 0, heads: 0, overlays: 0, bands: 0 };
}

// r4 나무 composer(jp_forest_r4): 종 코드 → 숲 바닥 오토타일. 지금은 활엽만 있다 — 다른 종은 r3 오토타일로 칠한다.
const R4_CODES: readonly (readonly [number, string])[] = [[JP_FOREST_BROADLEAF, "bl"]];
/** 같은 나무 그림을 다른 바닥 위에 세우는 형제 composer(2026-10-21): bm = 이끼·낙엽 바닥(지역 팩 숲 바닥) 위 활엽 숲. */
const R4_SIBLINGS: Readonly<Record<string, readonly string[]>> = { bl: ["bm"] };

function r4Group(tileset: JpForestTilesetView, k: string): AutotileGroup | undefined {
  const g = (tileset.autotileGroups ?? []).find((a) => a.id === `jp-forest4-${k}` && a.composer?.kind === "trees");
  return g as unknown as AutotileGroup | undefined;
}

/** 종 k 의 composer 들(본 + 형제). 숲 바닥이 어느 바닥 위에 칠리는지에 따라 하나를 고른다. */
function r4Family(tileset: JpForestTilesetView, k: string): AutotileGroup[] {
  return [k, ...(R4_SIBLINGS[k] ?? [])].map((x) => r4Group(tileset, x)).filter((g): g is AutotileGroup => !!g);
}

/**
 * 이 칸(1층 바닥 ground)에 칠할 숲 바닥 composer. 약속: composer.ground.apronBases[0] 이 그 composer 숲 바닥의 바탕 칸이다
 * (bl = 잔디 3281, bm = 이끼 바닥). 바탕 칸이거나 그 composer 의 숲 바닥이면 그 composer, 아니면 첫째(잔디 숲).
 */
function r4ForGround(family: readonly AutotileGroup[], ground: number): AutotileGroup | undefined {
  for (const g of family.slice(1)) {
    const base = g.composer?.ground?.apronBases?.[0];
    if (ground === base || (g.memberTileIds ?? []).includes(ground)) return g;
  }
  return family[0];
}

/** 이 타일셋에 나무 composer 숲(jp_forest_r4, jp-forest4-<k>)이 구워져 있는가. */
export function hasJpForestR4(tileset: JpForestTilesetView): boolean {
  return R4_CODES.some(([, k]) => !!r4Group(tileset, k));
}

/**
 * r4: composer 가 있는 종의 칸은 1층에 숲 바닥만 칠하고 kind 에서 뺀다(나무는 composeJpForestR4 가 맨 끝에 한 번에 세운다 —
 * 집·소품을 다 찍은 뒤라야 수관이 집 위로 넘치지 않는다). 칠한 칸 수.
 */
export function paintJpForestR4Floor(target: JpForestTarget, tileset: JpForestTilesetView, kind: Uint8Array): number {
  let n = 0;
  for (const [code, k] of R4_CODES) {
    const family = r4Family(tileset, k);
    if (!family.length || family[0]!.memberTileIds?.[0] === undefined) continue;
    // 지역 장면의 숲 구획은 직사각형이다 — 가장자리를 흔들어 덩이 모양으로(깎인 칸은 원래 바닥 그대로 둔다).
    const want = new Uint8Array(kind.length);
    for (let i = 0; i < kind.length; i++) if (kind[i] === code) want[i] = 1;
    const shaped = raggedMask(target.width, target.height, want, code);
    for (let i = 0; i < kind.length; i++) {
      if (kind[i] !== code) continue;
      kind[i] = 0;
      if (!shaped[i]) continue;
      const floor = r4ForGround(family, target.getLayer(1, i))?.memberTileIds?.[0];
      if (floor === undefined) continue;
      target.setLayer(1, i, floor);
      target.setLayer(2, i, -1);
      n++;
    }
  }
  return n;
}

/**
 * 형제 composer(잔디 bl · 이끼 bm)를 함께 짠다. 두 composer 는 같은 나무 그림 칸을 쓰므로 하나씩 composeTreesAll 하면
 * 뒤 것이 앞 것의 나무를 「제 칸」으로 보고 지운다. 그래서 숲 판정은 두 바닥을 합쳐(나무 자리는 한 벌), 쓰기만 나눈다 —
 * 첫 composer 가 자기 바닥이 아닌 칸 전부(나무·둘레 그늘)를, 형제가 자기 숲 바닥 칸(바닥 그늘 변형)을 쓴다.
 */
function composeR4Family(map: GameMap, family: readonly AutotileGroup[], _grounding: boolean, seed = 0): number {
  if (!family.length) return 0;
  // 접지(땅 그늘)는 늘 켠다(2026-10-21 적대 VQA): 끄면 숲 속 그늘판 나무(d)의 밑동 칸이 맨 잔디 위에서 16px 네모 그늘로 드러났다.
  // grounding 인자는 옛 호출을 깨지 않으려 받기만 한다.
  const strip = (g: AutotileGroup): AutotileGroup => g;
  if (family.length === 1) return composeTreesAll(map, strip(family[0]!), seed);
  const W = map.width;
  const floors = family.map((g) => new Set(g.memberTileIds ?? []));
  const anyFloor = new Set(floors.flatMap((f) => [...f]));
  const hold = new Set<number>([...anyFloor, ...family.flatMap((g) => g.composer?.overhangOnTiles ?? [])]);
  const ground = (x: number, y: number): number => layerTileAt(map, 1, y * W + x);
  const forestAt = (x: number, y: number): boolean => anyFloor.has(ground(x, y));
  const holdAt = (x: number, y: number): boolean => hold.has(ground(x, y));
  const sibling = new Set(floors.slice(1).flatMap((f) => [...f]));
  let n = 0;
  family.forEach((g, k) => {
    const cp = strip(g).composer!;
    const write = k === 0 ? (x: number, y: number) => !sibling.has(ground(x, y)) : (x: number, y: number) => floors[k]!.has(ground(x, y));
    n += composeTreesInMask(map, cp, forestAt, holdAt, seed, write);
  });
  return n;
}

/** r4: 숲 바닥이 칠린 맵 전체에 나무를 세운다(편집기 붓·조수 지형 도구와 같은 composer). 바뀐 칸 수. */
export function composeJpForestR4(map: GameMap, tileset: JpForestTilesetView, seed = 0, grounding = true): number {
  let n = 0;
  for (const [, k] of R4_CODES) n += composeR4Family(map, r4Family(tileset, k), grounding, seed);
  return n;
}

/**
 * kind[y*W+x] = 0 숲 아님 · 1 활엽 · 2 대숲 · 3 벚나무 · 4 삼나무 · 5 단풍. 그 종류가 칩셋에 없으면 활엽으로 칠한다. 3층에 수관·하늘선·머리·줄기 띠, 4층에 하늘선 윗줄·머리 덧그림을 쓴다.
 * 4층은 비어 있는 칸에만 쓴다. 3층은 마스크 안 칸에만 쓴다(마스크는 부르는 쪽이 이미 점유 칸을 뺐다).
 */
export function paintJpForest(target: JpForestTarget, tileset: JpForestTilesetView, kind: Uint8Array, seed = 0): JpForestReport {
  // r4 만 구워진 칩셋(다른 종 오토타일·숲 팩 없음): 모든 종을 활엽 composer 숲으로 — 안 그러면 다른 종 칸이 빈 땅으로 남는다
  if (hasJpForestR4(tileset) && !hasJpForestR3(tileset) && !hasJpForestPack(tileset)) for (let i = 0; i < kind.length; i++) if (kind[i]) kind[i] = JP_FOREST_BROADLEAF;
  const floor = hasJpForestR4(tileset) ? paintJpForestR4Floor(target, tileset, kind) : 0;
  if (floor > 0 && !kind.some((k) => k > 0)) return { canopy: floor, sky: 0, heads: 0, overlays: 0, bands: 0 };
  if (hasJpForestR3(tileset)) {
    const r = paintJpForestR3(target, tileset, kind, seed);
    return { ...r, canopy: r.canopy + floor };
  }
  const W = target.width, H = target.height;
  const rep = { canopy: 0, sky: 0, heads: 0, overlays: 0, bands: 0 };
  const sets = [kindSet(tileset, "bl", JP_FOREST_BROADLEAF), kindSet(tileset, "bb", JP_FOREST_BAMBOO), kindSet(tileset, "sk", JP_FOREST_SAKURA), kindSet(tileset, "sg", JP_FOREST_SUGI), kindSet(tileset, "mp", JP_FOREST_MAPLE)]
    .filter((s): s is KindSet => s !== null);
  const put3 = (x: number, y: number, t: number): void => { if (t >= 0) target.setLayer(3, y * W + x, t); };
  const put4 = (x: number, y: number, t: number): boolean => {
    if (t < 0) return true;
    const i = y * W + x;
    if (target.getLayer(4, i) >= 0) return false;
    target.setLayer(4, i, t);
    return true;
  };
  const have = new Set(sets.map((k) => k.code));
  if (have.has(JP_FOREST_BROADLEAF)) for (let i = 0; i < kind.length; i++) if (kind[i] && !have.has(kind[i]!)) kind[i] = JP_FOREST_BROADLEAF;
  for (const ks of sets) {
    const F = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && kind[y * W + x] === ks.code;
    // 1) 마스크: 아래로 띠 높이만큼 같은 숲이 이어지는 칸(맵 아래 끝 밖은 숲으로 본다 — 띠를 맵 밖에 둘 수 없다)
    const C = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!F(x, y)) continue;
        let ok = true;
        for (let d = 1; d <= ks.bandH && ok; d++) ok = y + d >= H || F(x, y + d);
        if (ok) C[y * W + x] = 1;
      }
    }
    // 맵 밖은 숲이 이어진다고 본다(오토타일 edgeConnects) — 맵 끝에서 가장자리 칸이 생기지 않는다.
    const onB = (x: number, y: number): boolean => (x < 0 || y < 0 || x >= W || y >= H) ? true : C[y * W + x] === 1;
    const maskAt = (x: number, y: number): number =>
      (onB(x, y - 1) ? N : 0) | (onB(x + 1, y) ? E : 0) | (onB(x, y + 1) ? S : 0) | (onB(x - 1, y) ? W_ : 0)
      | (onB(x + 1, y - 1) ? NE : 0) | (onB(x + 1, y + 1) ? SE : 0) | (onB(x - 1, y + 1) ? SW : 0) | (onB(x - 1, y - 1) ? NW : 0);
    const masks = new Int16Array(W * H).fill(-1);
    // 2) 수관 오토타일
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!C[y * W + x]) continue;
        const m = canon(maskAt(x, y));
        masks[y * W + x] = m;
        let t = ks.variantMap[String(m)] ?? ks.variantMap["255"]!;
        const pick = (list: readonly number[], s: number): number => list[hash(x, y, seed + s) % list.length]!;
        if (m === 255) t = pick(ks.interior, 1);
        else if (m === EDGE_N) t = pick(ks.edges.n, 3);
        else if (m === EDGE_S) t = pick(ks.edges.s, 5);
        else if (m === EDGE_W) t = pick(ks.edges.w, 7);
        else if (m === EDGE_E) t = pick(ks.edges.e, 9);
        put3(x, y, t);
        rep.canopy++;
      }
    }
    const headOk = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= W || y >= H || !C[y * W + x]) return false;
      const m = masks[y * W + x]!;
      return m === 255 || (ks.code !== JP_FOREST_BAMBOO && (m | S | SE | SW) === 255);
    };
    const used = new Uint8Array(W * H);
    // 3) 하늘선: 곧은 위 가장자리 칸 줄 + 밑 몸통 줄. 윗줄(숲 밖)은 4층 덧그림.
    for (let y = 0; y < H - 1 && ks.sky.length; y++) {
      let x = 0;
      while (x < W) {
        const kit = ks.sky[hash(x, y, seed * 3 + 11) % ks.sky.length]!;
        let ok = x + kit.w <= W && h01(x, y, seed + 77) < 0.9;
        for (let i = 0; ok && i < kit.w; i++) ok = C[y * W + x + i] === 1 && masks[y * W + x + i] === EDGE_N && headOk(x + i, y + 1);
        if (!ok) { x++; continue; }
        for (let j = 0; j < kit.h; j++) {
          const yy = y - 1 + j;
          if (yy < 0 || yy >= H) continue;
          for (let i = 0; i < kit.w; i++) {
            const t = kit.up[j]?.[i] ?? -1;
            if (j === 0) put4(x + i, yy, t);
            else { put3(x + i, yy, t); used[yy * W + x + i] = 1; }
          }
        }
        rep.sky++;
        x += kit.w + 1;
      }
    }
    // 4) 수관 머리(3층, 몸통 칸을 바꿔 놓는다) — 위에서 아래로 훑으며 큰 키트부터
    const keys = [...ks.heads.keys()];
    const big = keys.filter((k) => k !== "c1x1");
    const sizeOf = (k: string): [number, number] => { const kit = ks.heads.get(k)![0]!; return [kit.w, kit.h]; };
    const fits = (x: number, y: number, w: number, h: number, mark: Uint8Array): boolean => {
      if (x + w > W || y + h > H) return false;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (mark[(y + j) * W + x + i] || !headOk(x + i, y + j)) return false;
      return true;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (used[y * W + x] || !headOk(x, y)) continue;
        const order = [...big].sort((a, b) => h01(x, y, seed + 7 + keyCode(a)) - h01(x, y, seed + 7 + keyCode(b)));
        if (keys.includes("c1x1")) order.push("c1x1");
        for (const key of order) {
          const [w, h] = sizeOf(key);
          if (!fits(x, y, w, h, used)) continue;
          if (key !== "c1x1" && h01(x, y, seed + 6) > 0.95) break;
          const vs = ks.heads.get(key)!;
          const kit = vs[hash(x, y, seed + 13) % vs.length]!;
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { put3(x + i, y + j, kit.up[j]?.[i] ?? -1); used[(y + j) * W + x + i] = 1; }
          rep.heads++;
          break;
        }
      }
    }
    // 4b) 활엽: 덧그림 머리 한 겹(4층) — 첫 층 키트 경계에 엇갈려 얹어 덩이를 겹친다
    if (ks.overlays.size) {
      const used2 = new Uint8Array(W * H);
      const okeys = [...ks.overlays.keys()].filter((k) => k !== "c1x1");
      for (let y = 1; y < H; y++) {
        for (let x = 1; x < W; x++) {
          if (used2[y * W + x] || h01(x, y, seed + 31) > 0.5) continue;
          const order = [...okeys].sort((a, b) => h01(x, y, seed + 37 + keyCode(a)) - h01(x, y, seed + 37 + keyCode(b)));
          for (const key of order) {
            const vs = ks.overlays.get(key)!;
            const kit = vs[hash(x + 11, y + 5, seed) % vs.length]!;
            if (!fits(x, y, kit.w, kit.h, used2)) continue;
            let free4 = true;
            for (let j = 0; free4 && j < kit.h; j++) for (let i = 0; free4 && i < kit.w; i++) free4 = (kit.up[j]?.[i] ?? -1) < 0 || target.getLayer(4, (y + j) * W + x + i) < 0;
            if (!free4) continue;
            for (let j = 0; j < kit.h; j++) for (let i = 0; i < kit.w; i++) { put4(x + i, y + j, kit.up[j]?.[i] ?? -1); used2[(y + j) * W + x + i] = 1; }
            rep.overlays++;
            break;
          }
        }
      }
    }
    // 5) 줄기 띠: 수관 아래 끝 칸 밑(같은 숲 구획 안) — 왼끝·가운데·오른끝·한 칸
    for (let y = 0; y < H - 1; y++) {
      for (let x = 0; x < W; x++) {
        if (!C[y * W + x] || C[(y + 1) * W + x] || !F(x, y + 1)) continue;
        const l = x > 0 && (C[y * W + x - 1] === 1 || C[(y + 1) * W + x - 1] === 1);
        const r = x + 1 < W && (C[y * W + x + 1] === 1 || C[(y + 1) * W + x + 1] === 1);
        const part = !l && !r ? "one" : !l ? "L" : !r ? "R" : "M";
        const vs = ks.bands.get(part) ?? ks.bands.get("M");
        if (!vs?.length) continue;
        const kit = vs[hash(x + seed, y, 17) % vs.length]!;
        for (let j = 0; j < kit.h; j++) {
          const yy = y + 1 + j;
          if (yy >= H || !F(x, yy)) break;
          put3(x, yy, kit.up[j]?.[0] ?? -1);
        }
        rep.bands++;
      }
    }
  }
  return rep;
}

function keyCode(k: string): number {
  let s = 0;
  for (let i = 0; i < k.length; i++) s += k.charCodeAt(i);
  return s;
}

// ── 조수 숲 칠하기(paint_jp_forest · 공원 숲 · 지역 숲 공용, 2026-10-21) ──────────────────────────
/** dense = 빽빽한 숲(신사 진수의 숲·산비탈, 영역 전체) · grove = 공원 숲(덩이 숲 사이에 잔디 빈터·산책 틈을 남긴다). */
export type JpForestType = "dense" | "grove";
export const JP_FOREST_TYPES: readonly JpForestType[] = ["dense", "grove"];
export interface JpForestAreaOptions {
  readonly forestType?: JpForestType;
  /** 나무 밑 땅 그늘(r6 접지: 숲 바닥 그늘 변형 + 숲 밖 잔디 둘레 그늘). 기본 true. */
  readonly grounding?: boolean;
  /** grove 덩이 모양 씨앗(나무 배치는 위치 해시로 정해지고 씨앗을 쓰지 않는다). */
  readonly seed?: number;
}
export interface JpForestAreaReport { readonly floorCells: number; readonly skipped: number; readonly changed: number; readonly forestType: JpForestType; readonly grounding: boolean }

/** k×k 열기(침식 → 팽창): k×k 정사각형이 통째로 들어가는 칸만 남긴다 — 나무가 설 수 없는 가는 띠·외톨이 칸을 지운다. */
function openMask(W: number, H: number, m: Uint8Array, k: number): Uint8Array {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? 0 : m[y * W + x]!);
  const out = new Uint8Array(W * H);
  for (let y = 0; y + k <= H; y++) for (let x = 0; x + k <= W; x++) {
    let ok = true;
    for (let dy = 0; dy < k && ok; dy++) for (let dx = 0; dx < k && ok; dx++) if (!at(x + dx, y + dy)) ok = false;
    if (ok) for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) out[(y + dy) * W + x + dx] = 1;
  }
  return out;
}

/**
 * grove: 숲이 될 수 있는 칸 중 값 잡음(5칸 격자 보간)이 높은 쪽 약 55% 를 덩이로 고르고(분위수 문턱 — 잔디 조각이 작아도 비율이 같다),
 * 3×3 열기로 덩이 폭을 3칸 이상으로 맞춘다. 나머지는 잔디 빈터로 남는다.
 */
function groveMask(W: number, H: number, ok: Uint8Array, seed: number): Uint8Array {
  const g = (gx: number, gy: number): number => h01(gx, gy, 9001 + seed * 7);
  const val = (x: number, y: number): number => {
    const fx = x / 5, fy = y / 5, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx, b = g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  const vals: number[] = [];
  for (let i = 0; i < W * H; i++) if (ok[i]) vals.push(val(i % W, Math.floor(i / W)));
  if (!vals.length) return new Uint8Array(W * H);
  vals.sort((a, b) => a - b);
  const cut = vals[Math.floor(vals.length * 0.45)]!;
  const m = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) if (ok[i] && val(i % W, Math.floor(i / W)) >= cut) m[i] = 1;
  return openMask(W, H, m, 3);
}

/**
 * 가장자리 흔들기(2026-10-21 적대 VQA r1: 직사각형 숲 바닥·그늘이 칸 격자에 맞춘 곧은 선으로 보였다).
 * 볼록 모서리 칸은 거의 늘 깎고, 가장자리 칸은 3칸 격자 값 잡음이 낮은 곳을 깎은 뒤 2×2 열기로 가는 띠를 지운다 —
 * 숲 윤곽이 덩이 모양이 되고, 수관이 그 위로 넘쳐 곧은 칸 선을 가린다. 위치 해시만 써서 같은 칸은 늘 같게 나온다.
 */
function raggedMask(W: number, H: number, m: Uint8Array, seed: number): Uint8Array {
  const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? 0 : m[y * W + x]!);
  const g = (gx: number, gy: number): number => h01(gx, gy, 7717 + seed * 13);
  const val = (x: number, y: number): number => {
    const fx = x / 3, fy = y / 3, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx, b = g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  let area = 0;
  for (let i = 0; i < W * H; i++) area += m[i]!;
  const out = Uint8Array.from(m);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!at(x, y)) continue;
    const n = !at(x, y - 1), s = !at(x, y + 1), w = !at(x - 1, y), e = !at(x + 1, y);
    if (!(n || s || w || e)) continue;
    const corner = (n || s) && (w || e);
    const v = val(x, y) * 0.75 + h01(x, y, 5531 + seed) * 0.25;
    if (corner ? v < 0.85 : v < 0.42) out[y * W + x] = 0;
  }
  const opened = openMask(W, H, out, 2);
  let kept = 0;
  for (let i = 0; i < W * H; i++) kept += opened[i]!;
  if (kept * 10 >= area * 6) return opened;
  // 작은 숲(깎으면 반 가까이 사라진다): 볼록 모서리만 깎는다 — 직사각형 네 귀가 둥글어진다
  const corners = openMask(W, H, m, 2);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!corners[y * W + x]) continue;
    const n = !at(x, y - 1), s = !at(x, y + 1), w = !at(x - 1, y), e = !at(x + 1, y);
    if ((n || s) && (w || e)) corners[y * W + x] = 0;
  }
  const c2 = openMask(W, H, corners, 2);
  let k2 = 0;
  for (let i = 0; i < W * H; i++) k2 += c2[i]!;
  return k2 * 10 >= area * 6 ? c2 : openMask(W, H, m, 2);   // 그래도 너무 줄면 그대로 둔다
}

/**
 * 맵의 칸 묶음(want[y*W+x]=1)에 나무 composer 숲(jp-forest4-bl)을 칠한다 — 1층 숲 바닥을 깔고 맵 전체 composer 를 다시 돌린다.
 * 잔디·자갈잔디(composer overhangOnTiles)나 이미 숲 바닥인 칸만 숲이 된다. 2~4층에 남의 칸(집·소품·길 덧칸)이 있는 칸은 건너뛴다.
 * 이 칩셋에 r4 composer 가 없으면 null.
 */
export function paintJpForestArea(map: GameMap, tileset: JpForestTilesetView, want: Uint8Array, opts: JpForestAreaOptions = {}): JpForestAreaReport | null {
  const g0 = r4Group(tileset, "bl");
  const floor = g0?.memberTileIds?.[0];
  if (!g0 || floor === undefined || !g0.composer) return null;
  const forestType: JpForestType = opts.forestType === "grove" ? "grove" : "dense";
  const grounding = opts.grounding !== false;
  const seed = opts.seed ?? 0;
  const W = map.width, H = map.height;
  const family = r4Family(tileset, "bl");
  const own = new Set<number>();
  const groundOk = new Set<number>();
  for (const g of family) {
    const c = g.composer!;
    for (const sp of c.sprites) for (const t of sp.tiles) if (t >= 0) own.add(t);
    for (const t of c.ground?.apronTiles ?? []) if (t >= 0) own.add(t);
    for (const t of [...(c.overhangOnTiles ?? []), ...(g.memberTileIds ?? [])]) groundOk.add(t);
  }
  const eligible = (x: number, y: number): boolean => {
    const i = y * W + x;
    if (!groundOk.has(layerTileAt(map, 1, i))) return false;
    for (const L of [2, 3, 4] as const) { const t = layerTileAt(map, L, i); if (t >= 0 && !own.has(t)) return false; }
    return true;
  };
  // 숲이 될 수 있는 칸 = 요청 칸 ∩ 잔디·이끼 바닥(남의 칸 없음). 모양(dense 2×2 열기 · grove 덩이)은 이 칸들 위에서 정한다 —
  // 길·건물에 잘려 남은 1칸 띠는 나무가 못 서고 막힌 숲 바닥만 남으므로 숲으로 칠하지 않는다.
  const ok = new Uint8Array(W * H);
  let skipped = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!want[i]) continue;
    if (eligible(x, y)) ok[i] = 1; else skipped++;
  }
  const mask = raggedMask(W, H, forestType === "grove" ? groveMask(W, H, ok, seed) : openMask(W, H, ok, 2), seed);
  let floorCells = 0;
  for (let i = 0; i < W * H; i++) {
    if (!mask[i]) continue;
    // 바닥에 맞는 숲 바닥(잔디 위 = bl, 이끼·낙엽 위 = bm) — 숲 바닥 색이 둘레 땅과 같아야 경계가 안 보인다
    setLayerTileAt(map, 1, i, r4ForGround(family, layerTileAt(map, 1, i))?.memberTileIds?.[0] ?? floor);
    floorCells++;
  }
  // composer 씨앗은 늘 0 — 편집기 붓(shapeAutotileGroupAround)이 씨앗 0 으로 다시 짜므로, 다른 씨앗으로 세우면 붓질 한 번에 둘레 나무가 바뀐다.
  const changed = composeR4Family(map, family, grounding, 0);
  return { floorCells, skipped, changed, forestType, grounding: true };
}

// ── 숲 구조 검사(참고문서 「정상/오류」와 조수 확인용, 2026-10-21) ──────────────────────────────
/** 구조·통행만 본다(보기 좋은지는 판정하지 않는다). 칸 좌표는 0 기준. */
export type JpForestIssueCode = "FOREST_TILE_ON_LAYER1" | "FOREST_ROOT_OFF_FOREST" | "FOREST_OVER_FOREIGN" | "FOREST_TRUNK_MISSING" | "FOREST_APRON_OFF_LAWN";
export interface JpForestIssue { readonly code: JpForestIssueCode; readonly x: number; readonly y: number; readonly layer: number; readonly tile: number }

export function checkJpForest(map: GameMap, tileset: JpForestTilesetView): JpForestIssue[] {
  const g = r4Group(tileset, "bl");
  const cp = g?.composer;
  if (!g || !cp) return [];
  const W = map.width, H = map.height;
  const family = r4Family(tileset, "bl");   // 형제 composer(이끼 바닥 bm)는 같은 나무 그림을 쓴다 — 바닥·덧칸만 합친다
  const floor = new Set(family.flatMap((f) => f.memberTileIds ?? []));
  const hold = new Set<number>([...family.flatMap((f) => f.composer?.overhangOnTiles ?? []), ...floor]);
  const apron = new Set(family.flatMap((f) => f.composer?.ground?.apronTiles ?? []).filter((t) => t >= 0));
  const apronBases = new Set(family.flatMap((f) => f.composer?.ground?.apronBases ?? []));
  // 칸 번호 → 그림 속 자리(같은 칸이 여러 나무에 쓰일 수 있다)
  const occ = new Map<number, { onlyRoot: boolean; onlyAboveRoot: boolean }>();
  for (const sp of cp.sprites) {
    for (let k = 0; k < sp.tiles.length; k++) {
      const t = sp.tiles[k]!;
      if (t < 0 || floor.has(t)) continue;     // 숲 바닥과 같은 그림으로 합쳐진 칸(불투명 밑동 칸)은 바닥으로 본다
      const cy = Math.floor(k / sp.w), cx = k % sp.w;
      const root = cy === sp.h - 1 && (cp.trunkCols?.[sp.shape] ?? []).includes(cx);   // 줄기 기둥 밑칸만(옆으로 뻗은 뿌리·그늘 칸은 잔디에 걸쳐도 된다)
      const below = (cy + 1) * sp.w + cx;
      const above = cy === sp.h - 2 && (sp.tiles[below] ?? -1) >= 0 && !floor.has(sp.tiles[below]!) && (sp.cover[below] ?? 0) > 2;
      const prev = occ.get(t);
      occ.set(t, prev ? { onlyRoot: prev.onlyRoot && root, onlyAboveRoot: prev.onlyAboveRoot && above } : { onlyRoot: root, onlyAboveRoot: above });
    }
  }
  const out: JpForestIssue[] = [];
  const spriteAt = (i: number): boolean => ([2, 3, 4] as const).some((L) => occ.has(layerTileAt(map, L, i)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const base = layerTileAt(map, 1, i);
    if (occ.has(base) || (apron.has(base) && !floor.has(base))) out.push({ code: "FOREST_TILE_ON_LAYER1", x, y, layer: 1, tile: base });
    for (const L of [2, 3, 4] as const) {
      const t = layerTileAt(map, L, i);
      if (apron.has(t) && !apronBases.has(base)) out.push({ code: "FOREST_APRON_OFF_LAWN", x, y, layer: L, tile: t });
      const o = occ.get(t);
      if (!o) continue;
      if (!hold.has(base)) out.push({ code: "FOREST_OVER_FOREIGN", x, y, layer: L, tile: t });
      else if (o.onlyRoot && !floor.has(base)) out.push({ code: "FOREST_ROOT_OFF_FOREST", x, y, layer: L, tile: t });
      if (o.onlyAboveRoot && (y + 1 >= H || !spriteAt(i + W))) out.push({ code: "FOREST_TRUNK_MISSING", x, y, layer: L, tile: t });
    }
  }
  return out;
}
