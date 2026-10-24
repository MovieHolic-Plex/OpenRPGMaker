// editor/tools/beodeulForest.ts — 버들항 숲 composer 정의를 고르고 접지 칸을 대상 칩셋에 이식한다(2026-10-20 woodland r2).
//
// 숲 종류(forestType): broadleaf 활엽 · conifer 침엽 · mixed 혼효. 그림은 모두 beodeul_city 원본 키트 칸이다
// (src/assets/beodeulForestComposer.json, 빌더 scripts/content/build-beodeul-forest-composer.py).
// 나무 밑 땅(r5, 2026-10-21 사용자 정정): 원본 도시처럼 「짙은 풀」 — 속은 원본 칸 11628, 가장자리 46모양은 원본 화소 조합 칸(beodeul_ground,
// 빌더 scripts/content/build-beodeul-forest-ground.py)을 translateTiles 로 대상 칩셋에 이식해 오토타일 그룹(ensureBeodeulDarkGrass)으로 단다.
import data from "@/assets/beodeulForestComposer.json";
import { createBeodeulGroundTileset, ensureBeodeulGroundReferences } from "@/project/defaults/beodeulGround";
import { translateTiles } from "@/project/objectStamp";
import type { AutotileGroup, GameMap, Project, TilesetDef, TreeComposerDef, TreeComposerSprite } from "@/project/types";
import { composeTreesPlaced, treeComposerOwnTiles, treeHash, type TreePlacement } from "@/project/defaults/treeComposer";
import { layerTileAt, setLayerTileAt } from "@/project/mapLayers";
import { BEODEUL_NATURE, BEODEUL_NATURE_ID, createBeodeulNatureTileset } from "@/project/defaults/beodeulNature";
import { BEODEUL_FOREST_TRUNKS, BEODEUL_FOREST_TRUNKS_ID, createBeodeulForestTrunksTileset } from "@/project/defaults/beodeulForestTrunks";

export const BEODEUL_FOREST_TYPES = ["broadleaf", "conifer", "mixed"] as const;
export type BeodeulForestType = (typeof BEODEUL_FOREST_TYPES)[number];
export const BEODEUL_FOREST_TYPE_LABEL: Record<BeodeulForestType, string> = { broadleaf: "활엽수림", conifer: "침엽수림", mixed: "혼효림" };

export function parseBeodeulForestType(value: unknown, fallback: BeodeulForestType = "broadleaf"): BeodeulForestType {
  if (value === undefined || value === null || value === "") return fallback;
  if ((BEODEUL_FOREST_TYPES as readonly string[]).includes(String(value))) return value as BeodeulForestType;
  throw new Error(`forestType 은 ${BEODEUL_FOREST_TYPES.join("|")} 중 하나입니다(받은 값 ${String(value)}).`);
}

/** 짙은 풀 가장자리 두 벌 — plain: 민무늬 잔디 737 위(마을·마당 숲), woodland: 숲 장면 잔디(채도 낮춤) 위(도로 숲 벽). */
export type BeodeulDarkGrassFamily = "plain" | "woodland";
export const BEODEUL_DARK_GRASS_GROUP: Record<BeodeulDarkGrassFamily, string> = { plain: "beodeul_dark_grass", woodland: "beodeul_dark_grass_woodland" };

/**
 * 대상 칩셋(beodeul_city 계열)에서 쓸 composer 정의. r5(2026-10-21 사용자 정정): 코드가 그린 그늘 칸(접지 ground)은 쓰지 않는다 —
 * 나무 밑 땅은 원본 「짙은 풀」 오토타일(ensureBeodeulDarkGrass)이 맡는다. 그래서 def.ground 가 없고 composer 는 2~4층 나무만 쌓는다.
 */
export function beodeulForestComposer(project: Project, target: TilesetDef, type: BeodeulForestType): TreeComposerDef {
  const { groundShadeCover: _c, groundShadeRows: _r, ...rest } = structuredClone(data.types[type]);
  const def = rest as unknown as TreeComposerDef;
  def.sprites = withRedrawnTrunks(project, target, def.sprites);
  return def;
}

/**
 * 활엽수 줄기 T3(나무껍질 대비, 2026-10-24 사용자 선택·허용 — 「줄기가 안 보여 풀 덩이 같다」): 원본 나무 키트에서 줄기·뿌리 칸만
 * beodeul_forest_trunks 칸으로 바꿔 이식한다. 수관 칸은 원본 칸 번호 그대로. 표에 없는 나무(덤불·침엽수)는 손대지 않는다.
 */
function withRedrawnTrunks(project: Project, target: TilesetDef, sprites: TreeComposerSprite[]): TreeComposerSprite[] {
  const table = BEODEUL_FOREST_TRUNKS.cells;
  if (!sprites.some((s) => table[s.name]) || target.tileSize !== 16) return sprites;
  const source = project.tilesets[BEODEUL_FOREST_TRUNKS_ID] ??= createBeodeulForestTrunksTileset();
  const wanted = new Set(sprites.flatMap((s) => (table[s.name] ?? []).filter((n) => n >= 0)));
  const map = translateTiles(source, target, wanted).map;
  return sprites.map((s) => {
    const cells = table[s.name];
    if (!cells || cells.length !== s.tiles.length) return s;
    return { ...s, tiles: s.tiles.map((t, i) => (cells[i] === -1 ? t : cells[i] === -2 ? -1 : map.get(cells[i]!) ?? t)),
      cover: BEODEUL_FOREST_TRUNKS.cover[s.name] ?? s.cover };
  });
}

/** 숲 장면 잔디(737 채도 ×0.84, r4 B) 를 대상 칩셋으로 이식한 칸 번호. 공용 잔디 737 은 바꾸지 않는다. */
export function beodeulWoodlandGrass(project: Project, target: TilesetDef): number {
  const common = project.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  ensureBeodeulGroundReferences(common);
  return translateTiles(common, target, [data.ground.woodlandGrass]).map.get(data.ground.woodlandGrass) ?? -1;
}

const N = 1, E = 2, S = 4, Wb = 8, NE = 16, SE = 32, SW = 64, NW = 128;
const DIRS: readonly (readonly [number, number, number])[] = [[N, 0, -1], [E, 1, 0], [S, 0, 1], [Wb, -1, 0], [NE, 1, -1], [SE, 1, 1], [SW, -1, 1], [NW, -1, -1]];
function canonMask(m: number): number {
  if (!(m & N && m & E)) m &= ~NE;
  if (!(m & S && m & E)) m &= ~SE;
  if (!(m & S && m & Wb)) m &= ~SW;
  if (!(m & N && m & Wb)) m &= ~NW;
  return m;
}

/**
 * 「버들항 짙은 풀」 오토타일 그룹을 대상 칩셋에 단다(없으면 만들고, 있으면 같은 내용으로 맞춘다). 돌려주는 그룹은 편집기 붓·fill 이 그대로 쓴다.
 * 속(이웃 8칸 모두 짙은 풀) = 원본 칸 11628(그리고 같은 결 원본 속 칸 변형). 가장자리 46모양은 beodeul_ground 의 원본 화소 조합 칸을 이식한다.
 * 두 벌(plain·woodland)은 서로 이어진다(connect 공유) — 바탕 잔디만 다르다. 맵 가장자리 밖은 이어진 이웃으로 본다(숲이 맵 밖으로 이어진다).
 */
export function ensureBeodeulDarkGrass(project: Project, target: TilesetDef, family: BeodeulDarkGrassFamily): AutotileGroup {
  const common = project.tilesets.beodeul_ground ??= createBeodeulGroundTileset();
  ensureBeodeulGroundReferences(common);
  const dg = data.ground.darkGrass;
  const fams = dg.families as Record<BeodeulDarkGrassFamily, Record<string, number>>;
  const tr = translateTiles(common, target, [...Object.values(fams.plain), ...Object.values(fams.woodland)]).map;
  const variantsOf = (f: BeodeulDarkGrassFamily): Record<string, number> => {
    const out: Record<string, number> = {};
    for (let m = 0; m < 256; m++) {
      const c = canonMask(m);
      out[String(m)] = c === 255 ? dg.native : tr.get(fams[f][String(c)]!) ?? dg.native;
    }
    return out;
  };
  const all = [...new Set([...dg.interior, ...Object.values(variantsOf("plain")), ...Object.values(variantsOf("woodland"))])];
  const groups = target.autotileGroups ??= [];
  let result: AutotileGroup | undefined;
  for (const f of ["plain", "woodland"] as const) {
    const variantMap = variantsOf(f);
    // 속 칸(원본 11628 등)은 멤버가 아니라 이웃(connect)으로만 든다 — 「버들항 풀밭」 땅 변형으로 낱칸 깔린 11628 을 편집기가 가장자리 모양으로 바꾸지 않게.
    const members = [...new Set(Object.values(variantMap))].filter((t) => !dg.interior.includes(t));
    const group: AutotileGroup = {
      id: BEODEUL_DARK_GRASS_GROUP[f], name: f === "plain" ? "버들항 짙은 풀(숲 바닥)" : "버들항 짙은 풀(숲 장면 잔디 가)",
      neighborhood: 8, memberTileIds: members, connectTileIds: all, variantMap, edgeConnects: true,
    };
    const at = groups.findIndex((g) => g.id === group.id);
    if (at >= 0) groups[at] = group; else groups.push(group);
    if (f === family) result = group;
  }
  return result!;
}

/**
 * 짙은 풀을 칸 집합 dark 에 깐다(1층). 이웃 8칸이 dark 이거나 이미 짙은 풀(두 벌 모두)이면 이어진 것으로 보고 47모양 칸을 고른다.
 * 속 칸은 원본 11628 과 같은 결 변형 중 칸 위치 해시로 고른다. 바뀐 칸 수.
 */
export function paintBeodeulDarkGrass(project: Project, map: GameMap, target: TilesetDef, family: BeodeulDarkGrassFamily,
  dark: ReadonlySet<number>, write: (x: number, y: number) => boolean = () => true): number {
  const group = ensureBeodeulDarkGrass(project, target, family);
  const connect = new Set(group.connectTileIds ?? group.memberTileIds);
  const W = map.width, H = map.height;
  // 짙은 풀 가장자리는 바탕 잔디(737·숲 장면 잔디) 쪽으로만 풀린다. 오토타일이 아닌 다른 바닥(공동마당의 밝은 마당 잔디 띠 등)과
  // 맞닿으면 칸 선으로 곧게 잘리므로(3차 검수 N5), 그런 바닥과 8이웃으로 닿는 칸은 짙은 풀에서 뺀다 — 뺀 칸이 그 바닥이면 다시 번진다.
  // 다른 오토타일(길·모랫길·물 등)은 가장자리가 잔디와 만나게 그려져 있어 그대로 둔다.
  const base = new Set<number>([737, beodeulWoodlandGrass(project, target), ...connect]);
  for (const g of target.autotileGroups ?? []) if ((g.layer ?? "lower") === "lower") for (const t of g.memberTileIds) base.add(t);
  const keep = new Set([...dark].filter((i) => write(i % W, Math.floor(i / W))));
  for (let changed = true; changed;) {
    changed = false;
    for (const i of [...keep]) {
      const x = i % W, y = Math.floor(i / W);
      let foreign = false;
      for (const [, dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (!keep.has(j) && !base.has(map.lowerTiles[j]!)) { foreign = true; break; }
      }
      if (foreign) { keep.delete(i); changed = true; }
    }
  }
  dark = keep;
  const on = (x: number, y: number) => x < 0 || y < 0 || x >= W || y >= H || dark.has(y * W + x) || connect.has(map.lowerTiles[y * W + x]!);
  const interior = data.ground.darkGrass.interior;
  let n = 0;
  for (const i of dark) {
    const x = i % W, y = Math.floor(i / W);
    if (!write(x, y)) continue;
    let m = 0;
    for (const [bit, dx, dy] of DIRS) if (on(x + dx, y + dy)) m |= bit;
    const c = canonMask(m);
    const t = c === 255 ? interior[treeHash(x, y, 4099) % interior.length]! : group.variantMap[String(c)]!;
    if (map.lowerTiles[i] !== t) { map.lowerTiles[i] = t; n++; }
  }
  return n;
}

/**
 * 숲 종류별 심기 규칙(woodland r3, 2026-10-21 독립 검수 D1~D6 대응).
 * gap: 두 밑동이 |dx|<gx 이고 |dy|<gy 이면 같이 서지 못한다. 격자가 아니라 해시 순 탐욕 배치라 밑동 높이·간격이 그루마다 다르다.
 * shapes: [모양, 몫] — 해시로 뽑는다. coniferShade: 침엽 그림은 줄기 칸 한 칸만 그늘 덮개(수관 옆으로 번지지 않게).
 */
type Shapes = readonly (readonly [string, number])[];
const PLANT: Record<BeodeulForestType, { gx: number; gy: number; rim: Shapes; core: Shapes }> = {
  // r4 B(2026-10-21 사용자 승인): 숲 덩이 한 톤 — 속(가장자리에서 2칸 이상)은 짙은 초록(D3 3×4·D2 덤불), 가장자리만 밝은 연두(큰 4×5 포함)
  // 3차 검수 W1: 짙은 3×4 원본 나무는 1e09f0 한 종뿐이라 속이 벽지처럼 반복됐다 — 속에도 연두 T3(3종)·짙은 덤불(4종)을 섞는다
  broadleaf: { gx: 2, gy: 2, rim: [["T3", 0.5], ["B2", 0.3], ["T4", 0.2]], core: [["D3", 0.55], ["T3", 0.2], ["D2", 0.25]] },
  conifer: { gx: 2, gy: 2, rim: [["C3", 0.45], ["C2", 0.35], ["P1", 0.2]], core: [["C3", 0.45], ["C2", 0.35], ["P1", 0.2]] },
  mixed: { gx: 2, gy: 2, rim: [["T4", 0.4], ["T3", 0.35], ["S", 0.25]], core: [["D3", 0.4], ["S", 0.35], ["T3", 0.15], ["D2", 0.1]] },
};
const CONIFER_ART = /fir|eef4bc|28ad5e|c27062/u;

export interface BeodeulForestPlan { readonly placements: TreePlacement[]; readonly shade: Uint8Array; readonly dark: ReadonlySet<number> }

/**
 * 숲 모양 시안(2026-10-24 폴른 스타 「나무 줄기가 안 보여 풀 덩이 같다」, forest-trunks-1). 기본은 지금 규칙 그대로.
 * front: 숲 남쪽 끝 칸(줄기가 보이는 앞줄) 밑동에 쓸 모양 — 줄기 있는 T3·T4 만 주면 앞줄에 덤불(B2·D2)이 서지 않는다.
 * alternate: 속 칸을 2×2 바둑판으로 나눠 밝은 수관(T3·T4)과 짙은 수관(D3)을 번갈아 — 이웃 수관이 한 덩이로 섞이지 않게.
 * gx·gy: 밑동 사이 최소 간격(기본 2·2).
 */
export interface BeodeulForestLook {
  readonly front?: Shapes;
  readonly rim?: Shapes;
  readonly core?: Shapes;
  readonly alternate?: { readonly light: Shapes; readonly dark: Shapes };
  readonly gx?: number;
  readonly gy?: number;
  /** 나무 그림 정의를 바꿔 끼운다(줄기 다시 그린 시안 — 같은 이름·모양·칸 크기, 칸 번호만 다르다). */
  readonly sprites?: TreeComposerSprite[];
}

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
  forest: (x: number, y: number) => boolean, hold: (x: number, y: number) => boolean, seed: number, look: BeodeulForestLook = {}): BeodeulForestPlan {
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
  const base = PLANT[type];
  const rule = { gx: look.gx ?? base.gx, gy: look.gy ?? base.gy, rim: look.rim ?? base.rim, core: look.core ?? base.core };
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
    const isFront = !isF(x, y + 1);
    const shapes = isFront && look.front ? look.front
      : depth[y * W + x]! <= 1 ? rule.rim
      : look.alternate ? ((((x >> 1) + (y >> 1)) & 1) ? look.alternate.light : look.alternate.dark) : rule.core;
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
        // 3차 검수 W2: 2칸 높이 덤불이 같은 밑동 줄·가로 3칸 안에 또 서면 같은 높이로 늘어선다 — 건너뛴다
        if (sp.h <= 2 && placed.some((p) => p.sprite.h <= 2 && p.ay === y && Math.abs(p.ax - x) <= 3)) continue;
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
  // 나무 밑 땅(r5): 나무 그림이 3×3 안에 닿는 숲 칸 = 짙은 풀. 나무가 없는 숲 칸(맵 위 끝처럼 그림이 다 들어가지 못해 비운 줄)은 잔디로 둔다.
  // 가장자리 모양은 짙은 풀 오토타일의 47모양이 둥글게 푼다 — 숲 덩이 경계가 칸 선이 아니다.
  const dark = new Set<number>();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!depth[y * W + x]) continue;
    let tree = false;
    for (let dy = -1; dy <= 1 && !tree; dy++) for (let dx = -1; dx <= 1; dx++) if (inMap(x + dx, y + dy) && stacks.has((y + dy) * W + x + dx)) { tree = true; break; }
    if (tree) dark.add(y * W + x);
  }
  return { placements: placed.map(({ sprite, x0, y0, z }) => ({ sprite, x0, y0, z })), shade: new Uint8Array(W * H), dark };
}

/**
 * 버들항 숲 한 번 짓기: 밑동 고르기(planBeodeulForest) → composer 가 2~4층에 나무 칸 쌓기 → 나무 밑 땅에 짙은 풀 오토타일(1층).
 * family: 짙은 풀 가장자리의 바탕 잔디(plain 737 · woodland 숲 장면 잔디).
 */
export function composeBeodeulForest(project: Project, map: GameMap, target: TilesetDef, type: BeodeulForestType,
  forest: (x: number, y: number) => boolean, hold: (x: number, y: number) => boolean, seed: number,
  write: (x: number, y: number) => boolean = hold, family: BeodeulDarkGrassFamily = "plain", look: BeodeulForestLook = {},
  planOut?: (plan: BeodeulForestPlan) => void): TreeComposerDef {
  const def = beodeulForestComposer(project, target, type);
  if (look.sprites) def.sprites = look.sprites;
  const plan = planBeodeulForest(map, def, type, forest, hold, seed, look);
  composeTreesPlaced(map, def, plan.placements, plan.shade, forest, hold, write);
  paintBeodeulDarkGrass(project, map, target, family, plan.dark, write);
  planOut?.(plan);
  return def;
}

// ---------- 이어진 숲 수관 오토타일(BEODEUL_NATURE.forestCanopy) ----------
// 2026-10-22 사용자 「숲 오토타일을 제대로 적용해야 함」(village-diversity-1): 마을 숲이 짙은 풀 위 낱 나무(composer)로 서서
// 숲 덩이가 아니라 듬성듬성한 과수원·네모 짙은 풀 판으로 읽혔다. 마을·붓 숲 덩이는 다시 수관 오토타일 한 장으로 덮는다 —
// 수관은 칸 2×2 덩이 안에서만 그려져 칸 경계에서 잘리지 않고(append-beodeul-forest-canopy.py), 남쪽 끝 칸엔 줄기·뿌리,
// 그 아래 빈 칸엔 물결치는 숲 그늘(이끼 치마) 띠가 붙는다. 이 함수 둘이 그 칸 고르기의 정본이다.

export type BeodeulCanopyStyle = "leaf" | "snow";

/**
 * 8이웃 비트(북서1 북2 북동4 서8 동16 남서32 남64 남동128). 맵 밖은 동·서·남으로는 숲으로 본다(숲이 맵 밖으로 이어진다).
 * 북쪽 맵 밖은 숲이 아니다 — 숲으로 보면 맨 윗줄이 맵 밖 덩이의 아래 반쪽(뒤집힌 듯 잘린 꼭대기·줄기만 남은 줄)으로 그려졌다(VQA r1).
 */
export function beodeulCanopyMask(W: number, H: number, c: number, isForest: (c: number) => boolean): number {
  const x = c % W, y = (c - x) / W; let mask = 0, b = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const nx = x + dx, ny = y + dy;
    if (ny >= 0 && (nx < 0 || nx >= W || ny >= H || isForest(ny * W + nx))) mask |= 1 << b;
    b++;
  }
  return mask;
}

export interface BeodeulCanopyShape {
  /** 빈 칸을 숲으로 메워도 되는가(구멍·오목한 홈 메우기). */
  readonly canFill?: (c: number) => boolean;
  /** 두 이웃 칸의 수관이 이어지는가(기본 늘). 마을은 같은 단끼리만 — 단 동서 끝 너머로 이으면 두 단이 다른 높이로 그려져 수관이 칸 선에서 썰렸다(VQA r2). */
  readonly joins?: (a: number, b: number) => boolean;
  /** 이 칸 수 미만 덩이는 지운다(맵 가장자리에 닿으면 절반). */
  readonly minComponent?: number;
  /** 가로·세로 폭이 이 줄 수 미만인 덩이는 지운다 — 단 사이 2~3줄 띠는 산울타리로 읽힌다(VQA r1·r2). */
  readonly minExtent?: number;
  /** 100칸 미만 덩이에서 속 칸(8이웃이 모두 같은 덩이·맵 밖) 비율이 이 값 미만이면 지운다 — 2~3줄 가지가 얽힌 뼈대 덩이는 수관이 듬성듬성 끊긴 조각으로 읽혔다(실제 입력창 VQA r13). */
  readonly minInterior?: number;
  /** 오목한 ㄱ자 홈을 한 번 메운다(기본 늘). 작은 덩이(붓)는 끄는 편이 덜 네모나다. */
  readonly fillCorners?: boolean;
  /** 열기 크기(2 또는 3): 모든 숲 칸은 다 숲인 block×block 덩이에 들어야 한다. 3 이면 좁은 목·한두 칸 혹이 없어 짙은 틈 홈이 덜 생긴다. */
  readonly block?: number;
}

/**
 * 숲 칸 집합을 수관 오토타일이 받아 줄 모양으로 다듬는다(제자리). 수관은 «네 칸이 다 숲인 2×2 덩이» 에만 서므로,
 * 어떤 덩이에도 들지 못한 칸(한 칸 폭 띠·뾰족한 끝·외톨이)은 수관 없이 덤불 낱칸으로 남아 숲 끝이 칸 계단으로 보인다 — 그런 칸은 지운다.
 * 4이웃 셋 이상이 숲인 구멍은 canFill 이 허락하면 메운다. 맵 밖은 동·서·남으로 숲, 북쪽은 숲이 아니다(beodeulCanopyMask 와 같다).
 */
export function shapeBeodeulCanopyMask(W: number, H: number, forest: Set<number>, opt: BeodeulCanopyShape = {}): void {
  const canFill = opt.canFill ?? (() => false), joins = opt.joins ?? (() => true), B = opt.block ?? 2;
  const inside = (x: number, y: number) => y >= 0 && (x < 0 || x >= W || y >= H || forest.has(y * W + x));
  const linked = (c: number, x: number, y: number) => x < 0 || x >= W || y >= H || joins(c, y * W + x);
  const blockOk = (bx: number, by: number, c: number) => {
    for (let j = 0; j < B; j++) for (let i = 0; i < B; i++) if (!inside(bx + i, by + j) || !linked(c, bx + i, by + j)) return false;
    return true;
  };
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    for (let c = 0; c < W * H; c++) {
      if (forest.has(c) || !canFill(c)) continue;
      const x = c % W, y = (c - x) / W;
      const f = (dx: number, dy: number) => inside(x + dx, y + dy) && linked(c, x + dx, y + dy);
      const k = (f(1, 0) ? 1 : 0) + (f(-1, 0) ? 1 : 0) + (f(0, 1) ? 1 : 0) + (f(0, -1) ? 1 : 0);
      // 오목한 안쪽 모서리(ㄱ자 홈 — 두 직교 이웃과 그 사이 대각이 숲)도 메운다: 칸 계단 홈에서 아래 겹 짙은 수관이 풀밭 쪽으로 드러나 검은 홈이 됐다(VQA r4)
      const corner = (f(0, -1) && f(-1, 0) && f(-1, -1)) || (f(0, -1) && f(1, 0) && f(1, -1)) || (f(0, 1) && f(-1, 0) && f(-1, 1)) || (f(0, 1) && f(1, 0) && f(1, 1));
      if (k >= 3 || (corner && pass === 0 && opt.fillCorners !== false)) { forest.add(c); changed = true; } // 모서리 메우기는 한 번만 — 되풀이하면 오목한 덩이가 직사각형으로 차오른다
    }
    for (const c of [...forest]) {
      const x = c % W, y = (c - x) / W;
      let ok = false;
      for (let oy = 0; oy < B && !ok; oy++) for (let ox = 0; ox < B; ox++) if (blockOk(x - ox, y - oy, c)) { ok = true; break; }
      if (!ok) { forest.delete(c); changed = true; }
    }
    if (!changed) break;
  }
  const minComponent = opt.minComponent ?? 0, minExtent = opt.minExtent ?? 0;
  if (minComponent > 0 || minExtent > 0) {
    const seen = new Set<number>();
    for (const c0 of [...forest]) {
      if (seen.has(c0)) continue;
      const comp = [c0]; seen.add(c0); let edge = false;
      let x0 = W, x1 = -1, y0 = H, y1 = -1;
      for (let h = 0; h < comp.length; h++) {
        const c = comp[h]!, x = c % W, y = (c - x) / W;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (x === 0 || x === W - 1 || y === H - 1) edge = true; // 북쪽 맵 끝은 숲이 이어지지 않는다(beodeulCanopyMask) — 절반 봐주기 없음
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const n = ny * W + nx; if (forest.has(n) && !seen.has(n) && joins(c, n)) { seen.add(n); comp.push(n); }
        }
      }
      // 두께: 열마다 평균 줄 수·줄마다 평균 칸 수 — 단을 따라 계단진 띠는 상자 크기는 커도 두께가 2~3줄이다
      const cols = new Set(comp.map((c) => c % W)).size, rows = new Set(comp.map((c) => Math.floor(c / W))).size;
      const thin = minExtent > 0 && (comp.length / cols < minExtent - 0.5 || comp.length / rows < minExtent - 0.5);
      let skeletal = false;
      if ((opt.minInterior ?? 0) > 0 && comp.length < 100) {
        const inComp = new Set(comp); let inner = 0;
        for (const c of comp) {
          const x = c % W, y = (c - x) / W; let all = true;
          for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; if (!inComp.has(ny * W + nx)) { all = false; break; } }
          if (all) inner++;
        }
        skeletal = inner / comp.length < opt.minInterior!;
      }
      if (comp.length < (edge ? minComponent / 2 : minComponent) || x1 - x0 + 1 < minExtent || y1 - y0 + 1 < minExtent || thin || skeletal) for (const c of comp) forest.delete(c);
    }
  }
}

export interface BeodeulCanopyPlan {
  /** 숲 칸 → beodeul_nature 수관 칸(막힘). */
  readonly canopy: Map<number, number>;
  /** 숲 바로 남쪽 빈 칸 → beodeul_nature 숲 그늘(이끼 치마) 칸(통행). */
  readonly shade: Map<number, number>;
}

/**
 * 숲 칸마다 이웃 비트·P×P 위상으로 수관 칸을, 숲 남쪽 바로 아래 칸(shadeOk 가 허락한 칸)에는 물결치는 숲 그늘을 고른다.
 * 칸 번호는 beodeul_nature 원본 번호 — 대상 칩셋으로는 writeBeodeulCanopy 가 옮긴다.
 */
export function planBeodeulCanopy(W: number, H: number, style: BeodeulCanopyStyle, forest: ReadonlySet<number>,
  shadeOk: (c: number) => boolean = () => true, joins: (a: number, b: number) => boolean = () => true): BeodeulCanopyPlan {
  const phases = BEODEUL_NATURE.forestCanopy[style], P = BEODEUL_NATURE.forestPeriod[style], shades = BEODEUL_NATURE.forestShade[style];
  const isF = (n: number) => forest.has(n);
  const canopy = new Map<number, number>(), shade = new Map<number, number>();
  for (const c of forest) {
    const x = c % W, y = (c - x) / W;
    const t = phases[(x % P) + P * (y % P)]![beodeulCanopyMask(W, H, c, (n) => isF(n) && joins(c, n))]!;
    if (t >= 0) canopy.set(c, t);
    const s = c + W;
    if (y + 1 < H && !isF(s) && shadeOk(s)) {
      const nw = x > 0 && isF(c - 1), ne = x + 1 < W && isF(c + 1);
      const sh = shades[(x % P) * 4 + (nw ? 2 : 0) + (ne ? 1 : 0)]!;
      if (sh >= 0) shade.set(s, sh);
    }
  }
  return { canopy, shade };
}

/** beodeul_nature 를 프로젝트에 (최신으로) 두고 돌려준다. */
export function beodeulNatureTileset(project: Project): TilesetDef {
  const t = project.tilesets[BEODEUL_NATURE_ID];
  return t && t.count >= BEODEUL_NATURE.count ? t : (project.tilesets[BEODEUL_NATURE_ID] = createBeodeulNatureTileset());
}

/**
 * 수관·그늘 계획을 대상 칩셋으로 옮겨 2층에 쓴다(상위 — 3/4 시점에서 인물 뒤 수관이 앞으로 나오지 않게 2층 묶음).
 * 수관 칸은 막힘, 그늘 칸은 통행. 이미 2층에 무언가 있는 칸은 건너뛴다. 쓴 칸 수.
 */
export function writeBeodeulCanopy(project: Project, map: GameMap, target: TilesetDef, plan: BeodeulCanopyPlan): number {
  if (!plan.canopy.size && !plan.shade.size) return 0;
  const tr = translateTiles(beodeulNatureTileset(project), target, new Set([...plan.canopy.values(), ...plan.shade.values()]));
  const blocked = new Set(plan.canopy.values());
  for (const [from, to] of tr.map) {
    target.priority[to] = "upper";
    target.passability[to] = blocked.has(from) ? { up: false, down: false, left: false, right: false } : { up: true, down: true, left: true, right: true };
  }
  // 남쪽도 숲인 수관 칸은 3층(위층 묶음) — 2층(아래층 묶음)은 높이 지형의 동서 끝 1px 선(relief over 띠)보다 먼저 그려져 그 선이 숲을 세로로 갈랐다(VQA r1).
  // 남쪽이 숲인 칸 앞(남쪽)에는 인물이 설 수 없으니 3층 상위여도 머리를 가리지 않는다. 숲 남쪽 끝 줄(줄기·뿌리)은 2층 — 그 앞에 선 인물이 수관 위로 그려진다.
  let n = 0;
  for (const [c, t] of plan.shade) { setLayerTileAt(map, 2, c, tr.map.get(t)!); n++; }
  for (const [c, t] of plan.canopy) {
    const s = c + map.width;
    setLayerTileAt(map, s < map.width * map.height && plan.canopy.has(s) ? 3 : 2, c, tr.map.get(t)!); n++;
  }
  return n;
}

/**
 * 붓·조수 범용 숲(place_props density dense·impassable)을 버들항 맵에 깔 때 — 사각형 area 안에 둥근 숲 덩이(dense: 물결진 타원,
 * impassable: 모서리를 깎은 사각) 를 잡고 수관 오토타일로 덮는다. 길·물·건물(2~4층에 무언가 있는 칸)·막힌 바닥은 건너뛴다.
 */
export function plantBeodeulCanopyArea(project: Project, map: GameMap, target: TilesetDef,
  area: { x: number; y: number; w: number; h: number }, density: "dense" | "impassable", seed: number, style: BeodeulCanopyStyle = "leaf"):
  { forestCells: number; shadeCells: number } {
  const W = map.width, H = map.height;
  const lowerAuto = new Set<number>();
  const darkGroups = new Set(Object.values(BEODEUL_DARK_GRASS_GROUP));
  for (const g of target.autotileGroups ?? []) if ((g.layer ?? "lower") === "lower" && !darkGroups.has(g.id)) for (const t of g.memberTileIds) lowerAuto.add(t);
  const groundOk = (c: number) => {
    const lt = map.lowerTiles[c]!; const ps = target.passability[lt];
    if (lowerAuto.has(lt) && lt !== 737) return false; // 길·물·모랫길 같은 오토타일 바닥
    if (ps && !ps.up && !ps.down && !ps.left && !ps.right) return false;
    return ([2, 3, 4] as const).every((L) => layerTileAt(map, L, c) < 0);
  };
  const cx = area.x + (area.w - 1) / 2, cy = area.y + (area.h - 1) / 2, rx = Math.max(1, area.w / 2), ry = Math.max(1, area.h / 2);
  const wob = (treeHash(area.x, area.y, seed) % 628) / 100;
  const forest = new Set<number>();
  for (let y = area.y; y < area.y + area.h; y++) for (let x = area.x; x < area.x + area.w; x++) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const c = y * W + x; if (!groundOk(c)) continue;
    const ex = (x - cx) / rx, ey = (y - cy) / ry;
    // 둥근 덩이: 각도 물결(3·5배) + 칸 잡음으로 가장자리를 흔든다 — 작은 area 에서 2×2 열기만 하면 상자가 됐다(VQA r5)
    const ang = Math.atan2(ey, ex), jitter = ((treeHash(x, y, seed + 41) % 1000) / 1000 - 0.5) * 0.3;
    // impassable 은 더 꽉 찬 타원(초타원은 area 상자에 잘려 윗변이 곧은 상자로 읽혔다, VQA r10)
    const amp = density === "dense" ? 1 : 1.2;
    const lim = (density === "dense" ? 0.8 : 0.95) + amp * (0.22 * Math.sin(ang * 3 + wob) + 0.12 * Math.sin(ang * 5 + wob * 2)) + jitter;
    if (ex * ex + ey * ey > lim) continue;
    forest.add(c);
  }
  const inArea = (c: number) => { const x = c % W, y = (c - x) / W; return x >= area.x && y >= area.y && x < area.x + area.w && y < area.y + area.h && groundOk(c); };
  shapeBeodeulCanopyMask(W, H, forest, { canFill: inArea, minComponent: 9, minExtent: 3, fillCorners: false });
  const plan = planBeodeulCanopy(W, H, style, forest, (s) => !forest.has(s) && groundOk(s));
  writeBeodeulCanopy(project, map, target, plan);
  return { forestCells: plan.canopy.size, shadeCells: plan.shade.size };
}
