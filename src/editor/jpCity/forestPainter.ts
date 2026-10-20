// 빽빽한 숲 칠하기(jp_city 블록 jp_forest_pack, 그림 scripts/content/jp-city/forest/forest_kit_proto.py).
// 순서: 마스크 → 수관 오토타일(3층) → 하늘선 키트(윗줄 4층 덧그림, 아래 두 줄 3층) → 수관 머리(3층 불투명, 활엽은 4층 덧그림 한 겹 더) → 줄기 띠(3층).
// 숲 구획 칸마다 종류(1 활엽 · 2 대숲)를 받는다. 수관은 아래로 띠 높이(활엽 1·대숲 2)만큼 같은 종류가 이어지는 칸이고,
// 그 밑 줄이 줄기 띠 자리다 — 띠도 숲 구획 안에 들어가므로 폭 3~4칸 얕은 띠(수관 2줄 + 띠 1줄)도 칠해진다.
// 순수 함수: 맵·타일셋 구조만 읽고 칸 쓰기는 콜백으로 한다(regionComposer 단계 실행기 jpRegionTool 이 부른다).

import type { AutotileGroup, GameMap } from "@/project/types";
import { autotileVariantForMask } from "@/project/defaults/autotileEngine";
import { composeTreesAll } from "@/project/defaults/treeComposer";
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

function r4Group(tileset: JpForestTilesetView, k: string): AutotileGroup | undefined {
  const g = (tileset.autotileGroups ?? []).find((a) => a.id === `jp-forest4-${k}` && a.composer?.kind === "trees");
  return g as unknown as AutotileGroup | undefined;
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
    const g = r4Group(tileset, k);
    const floor = g?.memberTileIds?.[0];
    if (floor === undefined) continue;
    for (let i = 0; i < kind.length; i++) {
      if (kind[i] !== code) continue;
      target.setLayer(1, i, floor);
      target.setLayer(2, i, -1);
      kind[i] = 0;
      n++;
    }
  }
  return n;
}

/** r4: 숲 바닥이 칠린 맵 전체에 나무를 세운다(편집기 붓·조수 지형 도구와 같은 composer). 바뀐 칸 수. */
export function composeJpForestR4(map: GameMap, tileset: JpForestTilesetView, seed = 0, grounding = true): number {
  let n = 0;
  for (const [, k] of R4_CODES) {
    const g = r4Group(tileset, k);
    if (!g) continue;
    const cp = g.composer;
    n += composeTreesAll(map, (grounding || !cp?.ground ? g : { ...g, composer: { ...cp, ground: undefined } }) as unknown as AutotileGroup, seed);
  }
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
  readonly seed?: number;
}
export interface JpForestAreaReport { readonly floorCells: number; readonly skipped: number; readonly changed: number; readonly forestType: JpForestType; readonly grounding: boolean }

/** grove: 값 잡음(4칸 격자 보간)으로 덩이를 고르고, 3칸 미만 폭은 지운다(나무 한 그루 크기 3×4 보다 좁은 숲은 밑동이 서지 않는다). */
function groveMask(W: number, H: number, inArea: (x: number, y: number) => boolean, seed: number): Uint8Array {
  const g = (gx: number, gy: number): number => h01(gx, gy, 9001 + seed * 7);
  const val = (x: number, y: number): number => {
    const fx = x / 4, fy = y / 4, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
    const a = g(ix, iy) * (1 - tx) + g(ix + 1, iy) * tx, b = g(ix, iy + 1) * (1 - tx) + g(ix + 1, iy + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
  const m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inArea(x, y) && val(x, y) > 0.47) m[y * W + x] = 1;
  // 열기(3×3 침식 → 팽창): 가는 띠·외톨이 칸을 지운다
  const er = new Uint8Array(W * H);
  const at = (a: Uint8Array, x: number, y: number): number => (x < 0 || y < 0 || x >= W || y >= H ? 0 : a[y * W + x]!);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let ok = 1;
    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1 && ok; dx++) if (!at(m, x + dx, y + dy)) ok = 0;
    er[y * W + x] = ok;
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!m[y * W + x]) continue;
    let hit = 0;
    for (let dy = -1; dy <= 1 && !hit; dy++) for (let dx = -1; dx <= 1 && !hit; dx++) if (at(er, x + dx, y + dy)) hit = 1;
    out[y * W + x] = hit;
  }
  return out;
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
  const cp = g0.composer;
  const own = new Set<number>();
  for (const sp of cp.sprites) for (const t of sp.tiles) if (t >= 0) own.add(t);
  for (const t of cp.ground?.apronTiles ?? []) if (t >= 0) own.add(t);
  const floorSet = new Set(g0.memberTileIds ?? []);
  const groundOk = new Set<number>([...(cp.overhangOnTiles ?? []), ...floorSet]);
  const eligible = (x: number, y: number): boolean => {
    const i = y * W + x;
    if (!groundOk.has(layerTileAt(map, 1, i))) return false;
    for (const L of [2, 3, 4] as const) { const t = layerTileAt(map, L, i); if (t >= 0 && !own.has(t)) return false; }
    return true;
  };
  const inWant = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < H && want[y * W + x] === 1;
  const mask = forestType === "grove" ? groveMask(W, H, inWant, seed) : want;
  let floorCells = 0, skipped = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!mask[i]) continue;
    if (!eligible(x, y)) { skipped++; continue; }
    setLayerTileAt(map, 1, i, floor);
    floorCells++;
  }
  const group = (grounding || !cp.ground ? g0 : { ...g0, composer: { ...cp, ground: undefined } }) as unknown as AutotileGroup;
  const changed = composeTreesAll(map, group, seed);
  return { floorCells, skipped, changed, forestType, grounding };
}
