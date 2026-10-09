// 마법 학교(wizarding_world, 해리포터풍) 공간 조립기 — 공간 레시피 한 장으로 방·야외 맵 한 장을 결정론으로 짓는다.
// 레시피(어느 공간에 무엇을 어디에)는 src/assets/wizardingSpaceSpec.json(scripts/content/wizarding/space_recipes.py 가 굽는다),
// 칸 번호는 프로젝트의 wizarding_world 타일셋(structureKits · `wz:floor:<id>` 1×1 반복 조각 · autotileGroups)에서 읽는다.
//
//  층:   1층 = 바닥·땅·물·바닥 조각(F/X), 2층 = 밟는 덧그림(러너·깔개·얼룩 f), 3층 = 벽·가구, 4층 = 벽 위에 건 물건·탁상 소품.
//  배치: 벽 고리(실내) 또는 땅·테두리(야외) → 바닥 채움(오토타일은 이웃 마스크) → 러너 → 가구(여유칸) → 덧그림.
//  검사: 가구 후보를 찍을 때마다 엔진 통행 규칙(passabilityOf — 위층부터 ★ 건너뛰기)으로 주 출입구 안쪽 칸에서 BFS 한다.
//        걸을 수 있는 바닥이 둘로 갈리거나, 출입구 접근칸을 덮거나, 앞서 놓은 가구의 앞 칸이 끊기면 그 후보를 버린다.
//  불변식: 조각이 덮지 않은 걸을 수 있는 칸은 모두 한 덩이이고, 모든 출입구 칸과 시작 칸이 그 안에 있다.
//         (조각 안에만 갇힌 ★ 칸 — 벽에 건 서가 윗줄 같은 것 — 은 덩이 수에서 뺀다.)
//  오류가 하나라도 있으면 issues 에 담는다 — 도구는 그때 맵을 바꾸지 않는다.
import spec from "@/assets/wizardingSpaceSpec.json";
import { passabilityOf } from "@/project/collision";
import type { AutotileGroup, TilesetDef } from "@/project/types";

/** north-wall 북벽 앞·벽에 걸기 · side-wall 서·동 벽 앞 · free 아무 바닥 · center 가운데 가까이 · corner 구석 ·
 *  edge 벽에 붙은 바닥(2~4개씩 무리) · beside near 키트 옆(2~4개씩 무리) · grid 가운데 축 대칭 줄(책상·침대·서가). */
export type WizardingPlacement = "north-wall" | "side-wall" | "free" | "center" | "corner" | "edge" | "beside" | "grid";
export type WizardingDoorSide = "n" | "s" | "e" | "w";
export type WizardingDensity = "sparse" | "normal" | "full";
export type WizardingFurnitureMode = "auto" | "none" | "list";

interface WithRecipe { readonly kit: string; readonly dx: number; readonly dy: number; readonly under?: boolean }
export interface WizardingFurnitureRecipe {
  readonly kit: string; readonly placement: WizardingPlacement; readonly count: readonly [number, number]; readonly clearance: number;
  readonly wallTop?: number; readonly wallMatch?: "plain" | "window"; readonly side?: "w" | "e"; readonly on?: "floor" | "ground" | "water";
  readonly access?: boolean; readonly with?: readonly WithRecipe[];
  /** beside: 옆에 붙일 키트 id(가구·벽 조각). */
  readonly near?: readonly string[];
  /** grid: 덩이 사이 칸 수(기본 1). gapX·gapY 가 있으면 그 축은 그 값(서가 gapX 0 = 이어 붙은 책장 줄). */
  readonly gap?: number; readonly gapX?: number; readonly gapY?: number;
  /** grid: 덩이마다 고르는 탁상 소품 묶음 하나(with 뒤에 붙는다) — 모든 탁자에 같은 소품이 찍히지 않게. */
  readonly vary?: readonly (readonly WithRecipe[])[];
  /** grid: north = 첫 줄을 북벽에 붙인다(wallTop). */
  readonly rowsFrom?: "north";
  /** grid: 같은 크기 다른 그림(30% 로 바꿔 끼운다, 예: 빈 침대 ↔ 환자 침대). */
  readonly alt?: readonly string[];
}
export interface WizardingDecalRecipe { readonly kit: string; readonly count: readonly [number, number]; readonly near?: readonly string[] }
interface FloorRecipe { readonly tile?: string; readonly autotile?: string; readonly mix?: readonly string[] }
interface RunnerRecipe { readonly ns?: string; readonly ew?: string; readonly nEnd?: string; readonly sEnd?: string }
export interface WizardingDoorInput { readonly side: WizardingDoorSide; readonly offset?: number; readonly kind?: "single" | "double" }
interface SizeRecipe { readonly min: readonly [number, number]; readonly default: readonly [number, number]; readonly max: readonly [number, number] }
export interface WizardingNpcSuggestion { readonly id: string; readonly name: string; readonly desc: string; readonly textureKey: string; readonly resourceId: string; readonly characterIndex: number }
interface WallSetRecipe {
  readonly ko: string; readonly n: string; readonly nw?: string; readonly ne?: string; readonly w: string; readonly e: string; readonly s: string;
  readonly sw?: string; readonly se?: string; readonly door1?: string; readonly door2?: string; readonly doorS?: string; readonly northFloor?: string;
  readonly rhythm: readonly string[]; readonly sRhythm: readonly string[]; readonly northRows: number;
  /** 1 = 남벽은 윗면(천장 끝) 한 줄만 — 3/4 시점에서 남벽 정면은 보이지 않는다. 남쪽 문은 틈. */
  readonly southRows: number;
}
interface GroundRecipe {
  readonly clearing?: string; readonly band?: number; readonly border?: readonly string[];
  readonly shore?: string | null; readonly shallow?: string | null; readonly deep?: string | null; readonly boathouse?: readonly string[]; readonly ramp?: string | null;
  readonly dock?: { readonly v?: string; readonly end?: string; readonly band?: string; readonly piles?: string }; readonly landFrac?: number; readonly docks?: number;
}
export interface WizardingSpaceRecipe {
  readonly ko: string; readonly spaceKo: string; readonly indoor: boolean; readonly layout: "room" | "forest" | "lake"; readonly wall?: string;
  readonly size: SizeRecipe; readonly floor: FloorRecipe; readonly runner?: RunnerRecipe | null; readonly doors?: { readonly door1?: string; readonly door2?: string };
  readonly rhythm?: readonly string[]; readonly ground?: GroundRecipe; readonly defaultDoors: readonly WizardingDoorInput[];
  readonly furniture: readonly WizardingFurnitureRecipe[]; readonly decals: readonly WizardingDecalRecipe[];
  readonly npcs: readonly WizardingNpcSuggestion[];
  readonly variants?: Readonly<Record<string, Partial<Omit<WizardingSpaceRecipe, "variants">>>>;
}
export interface WizardingSpaceSpec {
  readonly version: number; readonly tilesetId: string; readonly tileCount: number;
  readonly wallsets: Readonly<Record<string, WallSetRecipe>>; readonly spaces: Readonly<Record<string, WizardingSpaceRecipe>>;
  readonly pieces: Readonly<Record<string, { readonly name: string; readonly w: number; readonly h: number; readonly src: string }>>;
  readonly skipped: readonly string[];
}
export const WIZARDING_SPACE_SPEC = spec as unknown as WizardingSpaceSpec;
export const WIZARDING_SPACE_KEYS: readonly string[] = Object.keys(WIZARDING_SPACE_SPEC.spaces);

export interface WizardingFurnitureInput { readonly kit: string; readonly x?: number; readonly y?: number }
export interface WizardingSpaceInput {
  readonly space: string; readonly variant?: string; readonly width?: number; readonly height?: number;
  readonly doors?: readonly WizardingDoorInput[]; readonly furnitureMode?: WizardingFurnitureMode;
  readonly furniture?: readonly WizardingFurnitureInput[]; readonly density?: WizardingDensity; readonly seed?: number;
}
export interface WizardingIssue { readonly severity: "error" | "warning"; readonly code: string; readonly message: string; readonly x?: number; readonly y?: number }
export interface WizardingPlaced { readonly kit: string; readonly x: number; readonly y: number; readonly role: "wall" | "door" | "furniture" | "decal" | "border" | "runner" | "ground" }
export interface WizardingDoorCell { readonly x: number; readonly y: number; readonly side: WizardingDoorSide }
export interface WizardingSpaceResult {
  readonly space: string; readonly variant: string | null; readonly ko: string; readonly indoor: boolean;
  readonly width: number; readonly height: number;
  readonly lowerTiles: number[]; readonly lowerOverlayTiles: number[]; readonly upperTiles: number[]; readonly upperOverlayTiles: number[];
  readonly placed: WizardingPlaced[]; readonly doorCells: WizardingDoorCell[]; readonly spawn: { x: number; y: number };
  /** 시작 칸에서 걸어 닿는 칸 수. */
  readonly walkableCount: number;
  /** 조각이 덮지 않은 걸을 수 있는 칸을 가진 덩이 수(1 이어야 한다). */
  readonly components: number;
  /** 조각 안에만 갇힌 ★ 칸 덩이 수(무시한다). */
  readonly pockets: number;
  readonly issues: WizardingIssue[];
}

/** 레시피(+변형)를 합친 결과. 변형 키는 덮어쓴다(runner:null = 러너 없음). */
export function resolveWizardingRecipe(space: string, variant?: string): { recipe: WizardingSpaceRecipe; variant: string | null } | null {
  const base = WIZARDING_SPACE_SPEC.spaces[space];
  if (!base) return null;
  if (!variant) return { recipe: base, variant: null };
  const v = base.variants?.[variant];
  if (!v) return null;
  return { recipe: { ...base, ...v } as WizardingSpaceRecipe, variant };
}

// ───────────────────────────── 조각 해석 (키트 · 1×1 반복 조각 · 오토타일)
interface PieceCell { readonly dx: number; readonly dy: number; readonly lower: number; readonly upper: number }
interface Piece { readonly id: string; readonly w: number; readonly h: number; readonly cells: readonly PieceCell[] }

function makeResolver(tileset: TilesetDef) {
  const kits = new Map((tileset.structureKits ?? []).map((k) => [k.id, k] as const));
  const groups = new Map<string, readonly number[]>();
  for (const g of tileset.tileGroups ?? []) if (g.id.startsWith("wz:floor:")) groups.set(g.id.slice("wz:floor:".length), g.tileIds);
  const autos = new Map((tileset.autotileGroups ?? []).map((a) => [a.id, a] as const));
  const cache = new Map<string, Piece | null>();
  const resolve = (id: string): Piece | null => {
    if (cache.has(id)) return cache.get(id)!;
    let piece: Piece | null = null;
    const kit = kits.get(id);
    if (kit) {
      const cells: PieceCell[] = [];
      kit.rows.forEach((row, dy) => {
        for (let dx = 0; dx < kit.width; dx++) {
          const lower = row.tiles[dx] ?? -1, upper = row.upperTiles?.[dx] ?? -1;
          if (lower >= 0 || upper >= 0) cells.push({ dx, dy, lower, upper });
        }
      });
      piece = { id, w: kit.width, h: kit.height, cells };
    } else if (groups.get(id)?.length === 1) {
      const t = groups.get(id)![0]!;
      const lower = tileset.tileMeta?.[t]?.defaultLayer === "lower";
      piece = { id, w: 1, h: 1, cells: [{ dx: 0, dy: 0, lower: lower ? t : -1, upper: lower ? -1 : t }] };
    } else if (autos.has(id)) {
      const a = autos.get(id)!;
      const t = a.variantMap["255"] ?? a.memberTileIds[0] ?? -1;
      piece = { id, w: 1, h: 1, cells: [{ dx: 0, dy: 0, lower: t, upper: -1 }] };
    }
    cache.set(id, piece);
    return piece;
  };
  return { resolve, autotile: (id: string): AutotileGroup | undefined => autos.get(id) };
}

// ───────────────────────────── 결정론 난수
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
function shuffle<T>(xs: T[], rnd: () => number): T[] {
  for (let i = xs.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [xs[i], xs[j]] = [xs[j]!, xs[i]!]; }
  return xs;
}

// ───────────────────────────── 칸 종류
const K_FLOOR = 1, K_WALL = 2, K_GROUND = 3, K_WATER = 4, K_PATH = 5;

interface Group { readonly id: number; readonly kit: string; readonly rect: { x: number; y: number; w: number; h: number }; readonly cells: number[]; readonly access: boolean; readonly useCells: number[] }

class Board {
  readonly n: number;
  readonly L: [Int32Array, Int32Array, Int32Array, Int32Array];
  readonly kind: Uint8Array;
  /** 가구 덩이 번호(-1 = 없음). 덧그림(f)만 있는 칸은 넣지 않는다. */
  readonly fp: Int32Array;
  /** 조각(벽·가구·테두리)이 막힘·★ 칸을 찍은 칸 = 1. 바닥 채움·덧그림은 0. */
  readonly touched: Uint8Array;
  readonly reserved: Uint8Array;
  /** 북벽 열 종류: 0 칸 없음 · 1 민벽 · 2 창 · 3 그 밖 · 4 문 · 5 모서리 */
  northKind: Uint8Array;
  private journal: number[] = [];
  constructor(readonly W: number, readonly H: number) {
    this.n = W * H;
    this.L = [new Int32Array(this.n).fill(-1), new Int32Array(this.n).fill(-1), new Int32Array(this.n).fill(-1), new Int32Array(this.n).fill(-1)];
    this.kind = new Uint8Array(this.n); this.fp = new Int32Array(this.n).fill(-1);
    this.touched = new Uint8Array(this.n); this.reserved = new Uint8Array(this.n);
    this.northKind = new Uint8Array(W);
  }
  inb(x: number, y: number): boolean { return x >= 0 && y >= 0 && x < this.W && y < this.H; }
  set(layer: 0 | 1 | 2 | 3, i: number, v: number): void { this.journal.push(layer, i, this.L[layer][i]!); this.L[layer][i] = v; }
  setFp(i: number, v: number): void { this.journal.push(4, i, this.fp[i]!); this.fp[i] = v; }
  setTouched(i: number): void { this.journal.push(5, i, this.touched[i]!); this.touched[i] = 1; }
  setReserved(i: number): void { this.journal.push(6, i, this.reserved[i]!); this.reserved[i] = 1; }
  mark(): number { return this.journal.length; }
  rollback(m: number): void {
    const j = this.journal;
    while (j.length > m) {
      const old = j.pop()!, i = j.pop()!, layer = j.pop()!;
      if (layer < 4) this.L[layer as 0 | 1 | 2 | 3][i] = old;
      else if (layer === 4) this.fp[i] = old;
      else if (layer === 5) this.touched[i] = old;
      else this.reserved[i] = old;
    }
  }
  commit(): void { this.journal.length = 0; }
}

const DENSITY_F: Record<WizardingDensity, number> = { sparse: 0, normal: 0.5, full: 1 };
const ISSUE = {
  UNKNOWN_SPACE: "UNKNOWN_SPACE", UNKNOWN_VARIANT: "UNKNOWN_VARIANT", SIZE_OUT_OF_RANGE: "SIZE_OUT_OF_RANGE", BAD_DOOR: "BAD_DOOR",
  DOOR_OVERLAP: "DOOR_OVERLAP", NO_DOOR_KIT: "NO_DOOR_KIT", MISSING_PIECE: "MISSING_PIECE", LAYOUT_SPLIT: "LAYOUT_SPLIT",
  UNKNOWN_KIT: "UNKNOWN_KIT", FURNITURE_BLOCKED: "FURNITURE_BLOCKED", FURNITURE_NO_ROOM: "FURNITURE_NO_ROOM", FURNITURE_SHORT: "FURNITURE_SHORT",
  BAD_INPUT: "BAD_INPUT", SPLIT: "SPLIT", DOOR_UNREACHABLE: "DOOR_UNREACHABLE", TILESET_OUTDATED: "TILESET_OUTDATED",
} as const;
export const WIZARDING_ISSUE_CODES: readonly string[] = Object.values(ISSUE);

interface ResolvedDoor { readonly side: WizardingDoorSide; readonly kind: "single" | "double"; readonly offset: number; readonly width: number; readonly piece: Piece | null; readonly pieceCount: number }

/**
 * 공간 한 장을 짓는다. 실내(room)에서 height 를 주지 않으면 가구가 끝나는 줄 아래로 통로 3줄만 남기고 남벽을 당겨 다시 짓는다
 * (사용자 2026-10-07: 「공간이 남으면 그건 공간이 너무 큰 것」 — 서가·약 솥 아래 절반이 빈 바닥이던 것).
 * 다시 지을 때 가구 수는 처음 넓이로 센다(줄이면 개수가 줄고 또 줄어드는 되먹임을 막는다).
 */
export function buildWizardingSpace(input: WizardingSpaceInput, tileset: TilesetDef, specIn: WizardingSpaceSpec = WIZARDING_SPACE_SPEC): WizardingSpaceResult {
  const first = buildOnce(input, tileset, specIn);
  const rec = resolveRecipeIn(specIn, input);
  if (!rec || rec.layout !== "room" || input.height !== undefined || first.issues.some((i) => i.severity === "error")) return first;
  const loose = new Set(["edge", "corner", "side-wall", "beside", "north-wall"]);
  const looseKits = new Set(rec.furniture.filter((f) => loose.has(f.placement)).map((f) => f.kit));
  const ws = rec.wall ? specIn.wallsets[rec.wall] : undefined;
  const SR = ws?.southRows ?? 2, NR = ws?.northRows ?? 4;
  let bottom = -1;
  for (const p of first.placed) {
    if (p.role !== "furniture" || looseKits.has(p.kit) || p.y < NR) continue;
    bottom = Math.max(bottom, p.y + (specIn.pieces[p.kit]?.h ?? 1) - 1);
  }
  if (bottom < 0) return first;
  const H2 = Math.max(rec.size.min[1], bottom + 1 + 3 + SR);
  if (H2 >= first.height) return first;
  const again = buildOnce({ ...input, height: H2 }, tileset, specIn, first.width * first.height);
  return again.issues.some((i) => i.severity === "error") || again.components !== 1 ? first : again;
}

function resolveRecipeIn(specIn: WizardingSpaceSpec, input: WizardingSpaceInput): WizardingSpaceRecipe | null {
  const base = specIn.spaces[input.space];
  if (!base) return null;
  const v = input.variant ? base.variants?.[input.variant] : undefined;
  return (v ? { ...base, ...v } : base) as WizardingSpaceRecipe;
}

function buildOnce(input: WizardingSpaceInput, tileset: TilesetDef, specIn: WizardingSpaceSpec, countArea?: number): WizardingSpaceResult {
  const issues: WizardingIssue[] = [];
  const err = (code: string, message: string, x?: number, y?: number) => issues.push({ severity: "error", code, message, ...(x !== undefined ? { x, y } : {}) });
  const warn = (code: string, message: string, x?: number, y?: number) => issues.push({ severity: "warning", code, message, ...(x !== undefined ? { x, y } : {}) });
  const base = specIn.spaces[input.space];
  const empty = (W = 0, H = 0, ko = ""): WizardingSpaceResult => ({ space: input.space, variant: input.variant ?? null, ko, indoor: base?.indoor ?? true, width: W, height: H,
    lowerTiles: [], lowerOverlayTiles: [], upperTiles: [], upperOverlayTiles: [], placed: [], doorCells: [], spawn: { x: 0, y: 0 }, walkableCount: 0, components: 0, pockets: 0, issues });
  if (!base) { err(ISSUE.UNKNOWN_SPACE, `공간 "${input.space}" 이 없다 — ${Object.keys(specIn.spaces).join(", ")}`); return empty(); }
  let recipe: WizardingSpaceRecipe = base;
  if (input.variant) {
    const v = base.variants?.[input.variant];
    if (!v) { err(ISSUE.UNKNOWN_VARIANT, `공간 ${input.space} 에 변형 "${input.variant}" 이 없다 — ${Object.keys(base.variants ?? {}).join(", ") || "변형 없음"}`); return empty(); }
    recipe = { ...base, ...v } as WizardingSpaceRecipe;
  }
  if (tileset.count < specIn.tileCount) { err(ISSUE.TILESET_OUTDATED, `이 프로젝트의 wizarding_world 사본(${tileset.count}칸)이 레시피 기준(${specIn.tileCount}칸)보다 작다 — 프로젝트를 다시 열어 번들 타일셋을 갱신한다`); return empty(); }
  const W = input.width ?? recipe.size.default[0], H = input.height ?? recipe.size.default[1];
  if (!Number.isInteger(W) || !Number.isInteger(H) || W < recipe.size.min[0] || H < recipe.size.min[1] || W > recipe.size.max[0] || H > recipe.size.max[1]) {
    err(ISSUE.SIZE_OUT_OF_RANGE, `${recipe.ko} 크기 ${W}×${H} 는 범위 밖 — 최소 ${recipe.size.min.join("×")} · 기본 ${recipe.size.default.join("×")} · 최대 ${recipe.size.max.join("×")}`);
    return empty(0, 0, recipe.ko);
  }
  const { resolve, autotile } = makeResolver(tileset);
  const seed = Number.isInteger(input.seed) ? (input.seed as number) : 1;
  const rnd = mulberry32(seed ^ hashString(`${input.space}/${input.variant ?? ""}/${W}x${H}`));
  const density = DENSITY_F[input.density ?? "normal"] ?? 0.5;
  const b = new Board(W, H);
  const placed: WizardingPlaced[] = [];
  /** beside 의 기준: 찍은 조각(벽·땅 구조·가구)의 칸. */
  const anchors: { kit: string; cells: number[] }[] = [];
  const pass = (t: number) => t >= 0 && t < tileset.passability.length && !!(tileset.passability[t]?.up || tileset.passability[t]?.down || tileset.passability[t]?.left || tileset.passability[t]?.right);
  const isFlat = (t: number) => pass(t) && tileset.priority[t] !== "upper";
  const need = (id: string | undefined | null, what: string): Piece | null => {
    if (!id) return null;
    const p = resolve(id);
    if (!p) err(ISSUE.MISSING_PIECE, `${what} 조각 "${id}" 이 타일셋에 없다 — 번들 타일셋을 갱신한다`);
    return p;
  };

  // ── 바닥 재료
  const floorAuto = recipe.floor.autotile ? autotile(recipe.floor.autotile) : undefined;
  const floorPiece = recipe.floor.tile ? need(recipe.floor.tile, "바닥") : null;
  const floorBase = floorAuto ? (floorAuto.variantMap["255"] ?? floorAuto.memberTileIds[0] ?? -1) : (floorPiece?.cells[0]?.lower ?? -1);
  if (floorBase < 0) { err(ISSUE.MISSING_PIECE, `${recipe.ko} 바닥 재료를 찾지 못했다`); return empty(W, H, recipe.ko); }
  const mixTiles = (recipe.floor.mix ?? []).map((id) => resolve(id)?.cells[0]?.lower ?? -1).filter((t) => t >= 0);

  // ── 찍기 (structure = 벽 고리처럼 자리를 통째로 바꾼다 / overlay = 가구 · 덧그림)
  const stampReplace = (p: Piece, x: number, y: number, clipY1 = H - 1, role: WizardingPlaced["role"] = "wall") => {
    for (const c of p.cells) {
      const X = x + c.dx, Y = y + c.dy;
      if (!b.inb(X, Y) || Y > clipY1) continue;
      const i = Y * W + X;
      if (c.lower >= 0) { b.set(0, i, c.lower); if (!pass(c.lower)) b.setTouched(i); else if (c.upper < 0) b.setTouched(i); }
      if (c.upper >= 0) { b.set(2, i, c.upper); b.set(3, i, -1); if (!isFlat(c.upper)) b.setTouched(i); }
      else if (c.lower >= 0) { b.set(2, i, -1); b.set(3, i, -1); }
    }
    placed.push({ kit: p.id, x, y, role });
    const cells: number[] = [];
    for (const c of p.cells) { const X = x + c.dx, Y = y + c.dy; if (b.inb(X, Y) && Y <= clipY1) cells.push(Y * W + X); }
    anchors.push({ kit: p.id, cells });
  };
  const stampDecal = (p: Piece, x: number, y: number) => {
    for (const c of p.cells) {
      const X = x + c.dx, Y = y + c.dy;
      if (!b.inb(X, Y)) continue;
      const i = Y * W + X;
      if (c.lower >= 0) b.set(0, i, c.lower);
      if (c.upper >= 0) b.set(1, i, c.upper);
    }
  };

  // ── 출입구 정리
  const ws = recipe.wall ? specIn.wallsets[recipe.wall] : undefined;
  const NR = recipe.layout === "room" ? (ws?.northRows ?? 4) : 0;
  const SR = recipe.layout === "room" ? (ws?.southRows ?? 2) : 0;
  const doorsIn = input.doors && input.doors.length ? input.doors : recipe.defaultDoors;
  const door1Id = recipe.doors?.door1 ?? ws?.door1, door2Id = recipe.doors?.door2 ?? ws?.door2;
  const doors: ResolvedDoor[] = [];
  const sideCount: Record<WizardingDoorSide, number> = { n: 0, s: 0, e: 0, w: 0 };
  for (const d of doorsIn) sideCount[d.side] = (sideCount[d.side] ?? 0) + 1;
  const sideSeen: Record<WizardingDoorSide, number> = { n: 0, s: 0, e: 0, w: 0 };
  let lakeL = 0;
  if (recipe.layout === "lake") lakeL = Math.max(6, Math.min(H - 5, Math.round(H * (recipe.ground?.landFrac ?? 0.42))));
  for (const d of doorsIn) {
    if (!["n", "s", "e", "w"].includes(d.side)) { err(ISSUE.BAD_DOOR, `문 side "${String(d.side)}" 는 n·s·e·w 중 하나`); continue; }
    const kind = d.kind === "double" ? "double" : "single";
    let piece: Piece | null = null, pieceCount = 1, width = kind === "double" ? 2 : 1;
    if (recipe.layout === "room" && d.side === "n") {
      const id = kind === "double" ? (door2Id ?? door1Id) : door1Id;
      if (!id) { err(ISSUE.NO_DOOR_KIT, `${recipe.ko} 의 북벽에는 문 조각이 없다 — 문은 s·e·w 로 낸다`); continue; }
      piece = need(id, "북쪽 문");
      if (!piece) continue;
      pieceCount = kind === "double" && !door2Id ? 2 : 1;
      width = piece.w * pieceCount;
    } else if (recipe.layout === "room" && d.side === "s" && ws?.doorS && SR > 1) {
      piece = need(ws.doorS, "남쪽 출입구");
      pieceCount = width;
    }
    // 같은 변에 문이 여럿이고 offset 이 없으면 고르게 나눈다.
    const k = sideSeen[d.side]++, nSide = sideCount[d.side];
    const horizontal = d.side === "n" || d.side === "s";
    let lo: number, hi: number;
    if (recipe.layout === "room") { if (horizontal) { lo = 1; hi = W - 1 - width; } else { lo = NR; hi = H - SR - width; } }
    else if (recipe.layout === "lake") { if (horizontal) { lo = 1; hi = W - 1 - width; } else { lo = 1; hi = lakeL - 1 - width; } }
    else { if (horizontal) { lo = 1; hi = W - 1 - width; } else { lo = 1; hi = H - 1 - width; } }
    const def = horizontal
      ? Math.round((W * (k + 1)) / (nSide + 1) - width / 2)
      : recipe.layout === "room" ? Math.round(NR + ((H - SR - NR) * (k + 1)) / (nSide + 1) - width / 2)
        : Math.round(((recipe.layout === "lake" ? lakeL : H) * (k + 1)) / (nSide + 1) - width / 2);
    const offset = d.offset ?? Math.max(lo, Math.min(hi, def));
    if (!Number.isInteger(offset) || offset < lo || offset > hi) { err(ISSUE.BAD_DOOR, `${d.side} 문 offset ${String(d.offset)} 는 ${lo}~${hi} 안이어야 한다(${horizontal ? "x" : "y"} 좌표, 문 폭 ${width})`); continue; }
    doors.push({ side: d.side, kind, offset, width, piece, pieceCount });
  }
  for (let a = 0; a < doors.length; a++) for (let c = a + 1; c < doors.length; c++) {
    const A = doors[a]!, C = doors[c]!;
    if (A.side === C.side && A.offset <= C.offset + C.width && C.offset <= A.offset + A.width) err(ISSUE.DOOR_OVERLAP, `${A.side} 변의 문 둘이 겹치거나 붙어 있다(offset ${A.offset}·${C.offset}) — 사이에 벽 한 칸 이상`);
  }
  if (!doors.length && !issues.some((i) => i.severity === "error")) err(ISSUE.BAD_DOOR, "문이 하나도 없다 — doors 를 주거나 생략한다(기본 출입구)");
  if (issues.some((i) => i.severity === "error")) return empty(W, H, recipe.ko);

  const doorCells: WizardingDoorCell[] = [];
  const insideCells: { x: number; y: number }[] = [];
  const reserve = (x: number, y: number) => { if (b.inb(x, y)) b.setReserved(y * W + x); };
  const floorRegion = new Uint8Array(W * H); // 바닥 오토타일 칠할 칸

  // ════════════════ 레이아웃
  if (recipe.layout === "room") {
    if (!ws) { err(ISSUE.MISSING_PIECE, `${recipe.ko} 의 벽 묶음 "${recipe.wall}" 이 사양에 없다`); return empty(W, H, recipe.ko); }
    const pn = need(ws.n, "북벽"), pw = need(ws.w, "서벽"), pe = need(ws.e, "동벽"), ps = need(ws.s, "남벽");
    if (!pn || !pw || !pe || !ps) return empty(W, H, recipe.ko);
    b.L[0].fill(floorBase);
    const northFloor = ws.northFloor ? resolve(ws.northFloor)?.cells[0]?.lower ?? -1 : -1;
    for (let i = 0; i < W * H; i++) {
      const x = i % W, y = (i / W) | 0;
      const wall = y < NR || y >= H - SR || x === 0 || x === W - 1;
      b.kind[i] = wall ? K_WALL : K_FLOOR;
      if (!wall) floorRegion[i] = 1;
      if (y < NR && northFloor >= 0) b.L[0][i] = northFloor;
    }
    // 북벽: 문 자리 먼저, 그다음 리듬
    const taken = new Uint8Array(W);
    taken[0] = taken[W - 1] = 1; b.northKind[0] = b.northKind[W - 1] = 5;
    for (const d of doors.filter((d) => d.side === "n")) for (let x = d.offset; x < d.offset + d.width; x++) { taken[x] = 1; b.northKind[x] = 4; }
    const rhythm = recipe.rhythm ?? ws.rhythm;
    const kindOf = (id: string) => (id === ws.n || /-(repair|moss)$/.test(id) ? 1 : id.includes("window") ? 2 : 3);
    for (let x = 1; x < W - 1; x++) {
      if (taken[x]) continue;
      const want = rhythm.length ? rhythm[(x - 1) % rhythm.length]! : "n";
      let id = want === "n" ? ws.n : want;
      let p = resolve(id);
      if (!p || x + p.w - 1 > W - 2 || [...Array(p.w).keys()].some((k) => taken[x + k])) { id = ws.n; p = pn; }
      stampReplace(p, x, 0, NR - 1);
      for (let k = 0; k < p.w; k++) { taken[x + k] = 1; b.northKind[x + k] = kindOf(id); }
      x += p.w - 1;
    }
    stampReplace(ws.nw ? need(ws.nw, "북서 모서리") ?? pn : pn, 0, 0, NR - 1);
    stampReplace(ws.ne ? need(ws.ne, "북동 모서리") ?? pn : pn, W - 1, 0, NR - 1);
    // 서·동 벽
    for (let y = NR; y < H - SR; y += pw.h) stampReplace(pw, 0, y, H - SR - 1);
    for (let y = NR; y < H - SR; y += pe.h) stampReplace(pe, W - 1, y, H - SR - 1);
    // 남벽
    const sTaken = new Uint8Array(W);
    for (const d of doors.filter((d) => d.side === "s")) for (let x = d.offset; x < d.offset + d.width; x++) sTaken[x] = 1;
    stampReplace(ws.sw ? need(ws.sw, "남서 모서리") ?? ps : ps, 0, H - SR);
    stampReplace(ws.se ? need(ws.se, "남동 모서리") ?? ps : ps, W - 1, H - SR);
    for (let x = 1; x < W - 1; x++) {
      if (sTaken[x]) continue;
      const want = ws.sRhythm.length ? ws.sRhythm[(x - 1) % ws.sRhythm.length]! : "s";
      const p = (want === "s" ? ps : resolve(want)) ?? ps;
      stampReplace(p.w === 1 ? p : ps, x, H - SR);
    }
    // 문
    const gap = (x: number, y: number) => {
      const i = y * W + x;
      b.set(0, i, floorBase); b.set(2, i, -1); b.set(3, i, -1); b.kind[i] = K_PATH; floorRegion[i] = 1;
    };
    for (const d of doors) {
      if (d.side === "n") {
        for (let k = 0; k < d.pieceCount; k++) stampReplace(d.piece!, d.offset + k * d.piece!.w, 0, NR - 1, "door");
        const yb = NR - 1;
        let any = false;
        for (let x = d.offset; x < d.offset + d.width; x++) {
          const i = yb * W + x;
          if (pass(cellTop(b, i))) { any = true; doorCells.push({ x, y: yb, side: "n" }); insideCells.push({ x, y: NR }); }
        }
        if (!any) err(ISSUE.NO_DOOR_KIT, `북쪽 문 조각 ${d.piece!.id} 의 아랫줄이 통행이 아니다`);
      } else if (d.side === "s") {
        for (let x = d.offset; x < d.offset + d.width; x++) {
          if (d.piece) stampReplace(d.piece, x, H - SR, H - 1, "door");
          else for (let y = H - SR; y < H; y++) gap(x, y);
          for (let y = H - SR; y < H; y++) b.kind[y * W + x] = K_PATH;
          doorCells.push({ x, y: H - 1, side: "s" }); insideCells.push({ x, y: H - SR - 1 });
        }
      } else {
        const x = d.side === "w" ? 0 : W - 1;
        for (let y = d.offset; y < d.offset + d.width; y++) {
          gap(x, y);
          doorCells.push({ x, y, side: d.side }); insideCells.push({ x: d.side === "w" ? 1 : W - 2, y });
        }
      }
    }
    // 바닥 오토타일·섞기
    paintFloor(b, floorRegion, floorAuto, mixTiles, rnd, true);
    // 러너(주 출입구 축)
    const runner = recipe.runner;
    const main = doors[0]!;
    if (runner) {
      if ((main.side === "n" || main.side === "s") && runner.ns) {
        const ns = resolve(runner.ns), nEnd = runner.nEnd ? resolve(runner.nEnd) : null, sEnd = runner.sEnd ? resolve(runner.sEnd) : null;
        if (ns) {
          const cx = main.offset + Math.floor(main.width / 2);
          const rx = Math.max(1, Math.min(W - 1 - ns.w, cx - Math.floor(ns.w / 2)));
          const hasN = doors.some((d) => d.side === "n" && d.offset <= rx + ns.w - 1 && rx <= d.offset + d.width - 1);
          const hasS = doors.some((d) => d.side === "s" && d.offset <= rx + ns.w - 1 && rx <= d.offset + d.width - 1);
          for (let y = NR; y < H - SR; y += ns.h) {
            let p = ns;
            if (y === NR && !hasN && nEnd) p = nEnd;
            if (y + ns.h >= H - SR && !hasS && sEnd) p = sEnd;
            stampDecal(p, rx, y);
            for (let dx = 0; dx < p.w; dx++) for (let dy = 0; dy < p.h; dy++) reserve(rx + dx, y + dy);
          }
          placed.push({ kit: ns.id, x: rx, y: NR, role: "runner" });
        }
      } else if ((main.side === "e" || main.side === "w") && runner.ew) {
        const ew = resolve(runner.ew);
        if (ew) {
          const ry = Math.max(NR, Math.min(H - SR - ew.h, main.offset));
          for (let x = 1; x < W - 1; x += ew.w) { stampDecal(ew, x, ry); for (let dx = 0; dx < ew.w; dx++) for (let dy = 0; dy < ew.h; dy++) reserve(x + dx, ry + dy); }
          placed.push({ kit: ew.id, x: 1, y: ry, role: "runner" });
        }
      }
    }
  } else if (recipe.layout === "forest") {
    const g = recipe.ground ?? {};
    b.L[0].fill(floorBase); b.kind.fill(K_GROUND);
    const cw = Math.max(6, Math.round(W * 0.5)), ch = Math.max(5, Math.round(H * 0.45));
    const cx0 = Math.floor((W - cw) / 2), cy0 = Math.floor((H - ch) / 2);
    for (let y = cy0; y < cy0 + ch; y++) for (let x = cx0; x < cx0 + cw; x++) { b.kind[y * W + x] = K_FLOOR; floorRegion[y * W + x] = 1; }
    for (const d of doors) {
      const cols: number[] = [];
      for (let k = 0; k < d.width; k++) cols.push(d.offset + k);
      if (d.width === 1) cols.push(d.offset + 1 < W - 1 ? d.offset + 1 : d.offset - 1);
      for (const c of cols) {
        if (d.side === "n") for (let y = 0; y < cy0; y++) setPath(c, y);
        else if (d.side === "s") for (let y = cy0 + ch; y < H; y++) setPath(c, y);
        else if (d.side === "w") for (let x = 0; x < cx0; x++) setPath(x, c);
        else for (let x = cx0 + cw; x < W; x++) setPath(x, c);
      }
      edgeDoor(d);
    }
    paintFloor(b, floorRegion, null, mixTiles, rnd, false, (i) => b.kind[i] === K_GROUND);
    const dirt = g.clearing ? autotile(g.clearing) : undefined;
    if (dirt) paintAutotile(b, floorRegion, dirt, true);
  } else {
    // 호수: 위 = 자갈 땅, 물가 한 줄, 아래 = 얕은 물 두 줄 + 깊은 물
    const g = recipe.ground ?? {};
    const Lr = lakeL;
    const shore = g.shore ? resolve(g.shore) : null, shallow = g.shallow ? resolve(g.shallow) : null, deep = g.deep ? resolve(g.deep) : null;
    if (!shore || !shallow || !deep) { err(ISSUE.MISSING_PIECE, "호수 물·물가 조각이 없다"); return empty(W, H, recipe.ko); }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y < Lr) { b.L[0][i] = floorBase; b.kind[i] = K_FLOOR; }
      else if (y === Lr) { b.L[0][i] = shore.cells[0]!.lower; b.kind[i] = K_WALL; }
      else { b.L[0][i] = (y <= Lr + 2 ? shallow : deep).cells[0]!.lower; b.kind[i] = K_WATER; }
    }
    paintFloor(b, null, null, mixTiles, rnd, false, (i) => b.kind[i] === K_FLOOR);
    // 보트 창고 + 진수대
    const bh = (g.boathouse ?? []).map((id) => resolve(id)).find((p) => p && p.w <= W - 6 && p.h <= Lr) ?? null;
    if (bh) {
      const bx = Math.max(1, Math.min(W - bh.w - 1, Math.round(W * 0.18))), by = Lr - bh.h;
      stampReplace(bh, bx, by, H - 1, "ground");
      for (const c of bh.cells) {
        const i = (by + c.dy) * W + bx + c.dx;
        b.kind[i] = pass(cellTop(b, i)) && c.dy === bh.h - 1 ? K_PATH : K_WALL;
        if (b.kind[i] === K_PATH) b.setReserved(i);
      }
      const ramp = g.ramp ? resolve(g.ramp) : null;
      if (ramp) {
        const rx = bx + Math.floor((bh.w - ramp.w) / 2);
        stampReplace(ramp, rx, Lr, H - 1, "ground");
        for (const c of ramp.cells) { const X = rx + c.dx, Y = Lr + c.dy; if (b.inb(X, Y)) { b.kind[Y * W + X] = K_PATH; b.setReserved(Y * W + X); } }
        // 진수대 양옆이 물이라 창고 앞 배 대는 곳이 땅과 끊긴다 — 물가 줄을 따라 창고 동쪽 땅까지 가로 갑판을 깐다(밑은 갑판 옆면 띠).
        const walk = resolve("wz-lake-dock-h"), side = g.dock?.band ? resolve(g.dock.band) : null;
        const land = bx + bh.w;
        if (walk && land < W - 1) for (let x = rx + ramp.w; x <= land; x++) {
          stampReplace(walk, x, Lr, H - 1, "ground"); b.kind[Lr * W + x] = K_PATH; b.setReserved(Lr * W + x);
          if (side && Lr + 1 < H && x >= rx + ramp.w) stampReplace(side, x, Lr + 1, H - 1, "ground");
        }
      }
    }
    // 부두
    const dock = g.dock ?? {};
    const dv = dock.v ? resolve(dock.v) : null, dend = dock.end ? resolve(dock.end) : null, dband = dock.band ? resolve(dock.band) : null, dpiles = dock.piles ? resolve(dock.piles) : null;
    const southDoors = doors.filter((d) => d.side === "s");
    const dockCols: { x: number; toEdge: boolean }[] = [];
    for (const d of southDoors) for (let k = 0; k < d.width; k++) dockCols.push({ x: d.offset + k, toEdge: true });
    const nDocks = W >= 20 ? (g.docks ?? 2) : 1;
    for (const fx of [0.7, 0.88].slice(0, nDocks)) {
      const x = Math.max(1, Math.min(W - 2, Math.round(W * fx)));
      if (dockCols.some((c) => Math.abs(c.x - x) <= 2)) continue;
      if (b.L[2][(Lr - 1) * W + x]! >= 0 || b.reserved[Lr * W + x]) continue;
      dockCols.push({ x, toEdge: false });
    }
    if (dv) for (const c of dockCols) {
      const len = c.toEdge ? H - Lr : Math.min(6, H - Lr - 4);
      for (let y = Lr; y < Lr + len; y++) { stampReplace(dv, c.x, y, H - 1, "ground"); b.kind[y * W + c.x] = K_PATH; b.setReserved(y * W + c.x); }
      if (!c.toEdge) {
        let y = Lr + len;
        if (dend && y < H) { stampReplace(dend, c.x, y, H - 1, "ground"); b.kind[y * W + c.x] = K_PATH; b.setReserved(y * W + c.x); y++; }
        if (dband && y < H) { stampReplace(dband, c.x, y, H - 1, "ground"); y++; }
        if (dpiles && y < H) stampReplace(dpiles, c.x, y, H - 1, "ground");
      }
    }
    for (const d of doors) {
      if (d.side === "s") { for (let x = d.offset; x < d.offset + d.width; x++) { doorCells.push({ x, y: H - 1, side: "s" }); insideCells.push({ x, y: H - 2 }); } }
      else edgeDoor(d);
    }
  }
  if (issues.some((i) => i.severity === "error")) return empty(W, H, recipe.ko);

  function setPath(x: number, y: number) {
    if (!b.inb(x, y)) return;
    const i = y * W + x;
    if (b.kind[i] === K_FLOOR) return;
    b.kind[i] = K_PATH; floorRegion[i] = 1; b.setReserved(i);
  }
  function edgeDoor(d: ResolvedDoor) {
    for (let k = 0; k < d.width; k++) {
      const p = d.offset + k;
      const [x, y, ix, iy] = d.side === "n" ? [p, 0, p, 1] : d.side === "s" ? [p, H - 1, p, H - 2] : d.side === "w" ? [0, p, 1, p] : [W - 1, p, W - 2, p];
      doorCells.push({ x, y, side: d.side }); insideCells.push({ x: ix, y: iy });
    }
  }

  // 출입구 접근칸 예약(문 칸 + 안쪽 두 줄)
  for (let k = 0; k < doorCells.length; k++) {
    const dc = doorCells[k]!, ic = insideCells[k]!;
    reserve(dc.x, dc.y); reserve(ic.x, ic.y);
    reserve(ic.x + (ic.x - dc.x), ic.y + (ic.y - dc.y));
  }
  const spawn = { ...insideCells[0]! };
  b.commit();

  // ════════════════ 통행 검사
  const cellPass = (i: number) => {
    const p = passabilityOf(tileset, b.L[0][i]!, b.L[1][i]!, b.L[2][i]!, b.L[3][i]!);
    return p.up || p.down || p.left || p.right;
  };
  const groups: Group[] = [];
  const startI = spawn.y * W + spawn.x;
  const reach = (): Uint8Array | null => {
    const seen = new Uint8Array(W * H);
    if (!cellPass(startI)) return null;
    const passGrid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) passGrid[i] = cellPass(i) ? 1 : 0;
    const q = [startI]; seen[startI] = 1;
    while (q.length) {
      const i = q.pop()!, x = i % W, y = (i / W) | 0;
      if (x > 0 && passGrid[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; q.push(i - 1); }
      if (x < W - 1 && passGrid[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; q.push(i + 1); }
      if (y > 0 && passGrid[i - W] && !seen[i - W]) { seen[i - W] = 1; q.push(i - W); }
      if (y < H - 1 && passGrid[i + W] && !seen[i + W]) { seen[i + W] = 1; q.push(i + W); }
    }
    for (let i = 0; i < W * H; i++) if (passGrid[i] && !seen[i]) seen[i] = 2; // 닿지 못한 통행 칸
    return seen;
  };
  /** 실패 이유(없으면 null). */
  const connectivityProblem = (extra?: Group): string | null => {
    const seen = reach();
    if (!seen) return "시작 칸이 막혔다";
    for (let i = 0; i < W * H; i++) if (seen[i] === 2 && !b.touched[i]) return `바닥이 갈린다(${i % W},${(i / W) | 0})`;
    for (const c of doorCells) if (seen[c.y * W + c.x] !== 1) return `출입구 (${c.x},${c.y}) 에 닿지 못한다`;
    for (const c of insideCells) if (seen[c.y * W + c.x] !== 1) return `출입구 안쪽 (${c.x},${c.y}) 에 닿지 못한다`;
    for (const g of extra ? [...groups, extra] : groups) {
      if (!g.access) continue;
      if (!g.useCells.some((i) => seen[i] === 1)) return `${g.kit}(${g.rect.x},${g.rect.y}) 앞에 닿지 못한다`;
    }
    return null;
  };
  const base0 = connectivityProblem();
  if (base0) { err(ISSUE.LAYOUT_SPLIT, `공간 골조부터 통행이 끊긴다 — ${base0}. 문 위치·크기를 바꾼다`); return empty(W, H, recipe.ko); }

  // ════════════════ 가구
  const floorKindOf = (on: WizardingFurnitureRecipe["on"]) => (on === "water" ? K_WATER : on === "ground" ? K_GROUND : K_FLOOR);
  const areaBounds = (k: number) => {
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let i = 0; i < W * H; i++) if (b.kind[i] === k) { const x = i % W, y = (i / W) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x0, y0, x1, y1 };
  };
  let groupSeq = 0;
  interface GroupPart { readonly piece: Piece; readonly dx: number; readonly dy: number; readonly under: boolean }
  const partsOf = (r: WizardingFurnitureRecipe): GroupPart[] | null => {
    const main = resolve(r.kit);
    if (!main) return null;
    const parts: GroupPart[] = [{ piece: main, dx: 0, dy: 0, under: false }];
    for (const w of r.with ?? []) { const p = resolve(w.kit); if (p) parts.push({ piece: p, dx: w.dx, dy: w.dy, under: !!w.under }); }
    return parts;
  };
  const flatOnly = (p: Piece) => p.cells.every((c) => c.lower < 0 && c.upper >= 0 && isFlat(c.upper));
  const mountedRow = (r: WizardingFurnitureRecipe, y: number) => recipe.layout === "room" && r.placement === "north-wall" && y < NR && y >= 0;

  /** 덩이를 (x,y) 에 놓아 본다. 성공하면 Group, 실패하면 이유 문자열. 실패 시 판은 그대로. */
  const tryPlace = (r: WizardingFurnitureRecipe, parts: GroupPart[], x: number, y: number): Group | string => {
    const main = parts[0]!.piece;
    const on = floorKindOf(r.on);
    const gid = groupSeq + 1;
    const cells = new Set<number>();
    const mainCells = new Set<number>();
    // 1) 칸 검사
    for (const part of parts) {
      const flat = flatOnly(part.piece);
      for (const c of part.piece.cells) {
        const X = x + part.dx + c.dx, Y = y + part.dy + c.dy;
        if (!b.inb(X, Y)) return "맵 밖";
        const i = Y * W + X, k = b.kind[i]!;
        if (part === parts[0]) mainCells.add(i);
        if (flat) {
          if (k === K_WALL) return "벽 위 덧그림";
          if (k === K_WATER && on !== K_WATER) return "물 위";
          if (!mainCells.has(i) && b.fp[i]! >= 0) return "다른 가구 위 덧그림";
          if (part === parts[0] && (b.reserved[i] || (k !== on && !(on === K_FLOOR && k === K_GROUND)) || b.L[1][i]! >= 0)) return "깔개 자리가 아니다";
          continue;
        }
        if (k === K_WALL) {
          if (!mountedRow(r, Y) || X < 1 || X > W - 2) return "벽";
          const nk = b.northKind[X]!;
          if (nk === 4 || nk === 5) return "문·모서리 벽";
          if (r.wallMatch === "plain" && nk !== 1 && nk !== 3) return "민벽이 아니다";
          if (r.wallMatch === "window" && nk !== 2) return "창이 아니다";
          if (b.L[3][i]! >= 0) return "벽 위가 찼다";
          cells.add(i);
          continue;
        }
        if (part !== parts[0] && mainCells.has(i)) { if (b.L[3][i]! >= 0) return "탁상 자리가 찼다"; continue; }
        if (k !== on) return "바닥 종류가 다르다";
        if (b.fp[i]! >= 0) return "다른 가구";
        if (b.reserved[i]) return "출입구·통로 자리";
        if (b.L[2][i]! >= 0 && !isFlat(b.L[2][i]!)) return "찬 칸";
        cells.add(i);
      }
    }
    // 2) 여유칸: 주 조각 사각형 둘레
    if (r.clearance > 0) {
      const cl = r.clearance;
      for (let Y = y - cl; Y < y + main.h + cl; Y++) for (let X = x - cl; X < x + main.w + cl; X++) {
        if (!b.inb(X, Y)) continue;
        const i = Y * W + X;
        if (b.kind[i] === K_WALL) continue;
        if (b.fp[i]! >= 0) return "여유칸에 다른 가구";
      }
    }
    // 3) 찍기
    const m = b.mark();
    const order = [...parts.filter((p) => p.under), ...parts.filter((p) => !p.under)];
    for (const part of order) {
      for (const c of part.piece.cells) {
        const X = x + part.dx + c.dx, Y = y + part.dy + c.dy, i = Y * W + X;
        const wallCell = b.kind[i] === K_WALL;
        if (c.lower >= 0) { b.set(0, i, c.lower); if (c.upper < 0 && wallCell) { b.set(2, i, -1); b.set(3, i, -1); } b.setTouched(i); }
        if (c.upper >= 0) {
          if (isFlat(c.upper) && b.L[2][i]! < 0) b.set(1, i, c.upper);
          else if (b.L[2][i]! < 0) { b.set(2, i, c.upper); b.setTouched(i); }
          else { b.set(3, i, c.upper); if (!isFlat(c.upper)) b.setTouched(i); }
        }
      }
    }
    for (const i of cells) if (b.kind[i] !== K_WALL) b.setFp(i, gid);
    // 앞(쓰는) 칸: 벽 쪽이면 옆, 아니면 덩이 아래 줄(벽 줄이면 더 아래 첫 바닥)
    const rect = { x, y, w: main.w, h: main.h };
    let gx0 = x, gy0 = y, gx1 = x + main.w - 1, gy1 = y + main.h - 1;
    for (const part of parts) { gx0 = Math.min(gx0, x + part.dx); gy0 = Math.min(gy0, y + part.dy); gx1 = Math.max(gx1, x + part.dx + part.piece.w - 1); gy1 = Math.max(gy1, y + part.dy + part.piece.h - 1); }
    const useCells: number[] = [];
    const side = r.placement === "side-wall" ? (x <= 1 ? "w" : "e") : null;
    if (side) {
      const cx = side === "w" ? gx1 + 1 : gx0 - 1;
      for (let Y = gy0; Y <= gy1; Y++) if (b.inb(cx, Y)) useCells.push(Y * W + cx);
    } else {
      for (let X = gx0; X <= gx1; X++) {
        let Y = gy1 + 1;
        while (b.inb(X, Y) && b.kind[Y * W + X] === K_WALL && Y < NR + 1) Y++;
        if (b.inb(X, Y) && !cells.has(Y * W + X)) useCells.push(Y * W + X);
      }
      if (!useCells.some((i) => b.kind[i] !== K_WALL)) {
        for (const i of cells) for (const j of [i - 1, i + 1, i - W, i + W]) if (j >= 0 && j < W * H && !cells.has(j) && Math.abs((j % W) - (i % W)) <= 1) useCells.push(j);
      }
    }
    const mountedOnly = recipe.layout === "room" && r.placement === "north-wall" && (r.wallTop ?? 4) + main.h <= NR;
    const access = r.access ?? !mountedOnly;
    const g: Group = { id: gid, kit: r.kit, rect, cells: [...cells], access, useCells };
    const problem = connectivityProblem(g);
    if (problem) { b.rollback(m); return problem; }
    groupSeq = gid;
    groups.push(g);
    anchors.push({ kit: r.kit, cells: g.cells.length ? g.cells : [...mainCells] });
    for (const part of order) placed.push({ kit: part.piece.id, x: x + part.dx, y: y + part.dy, role: flatOnly(part.piece) ? "decal" : "furniture" });
    return g;
  };

  /** 덩이 하나를 찍어 보고 되면 확정한다. */
  const place = (r: WizardingFurnitureRecipe, parts: GroupPart[], x: number, y: number): Group | string => {
    const res = tryPlace(r, parts, x, y);
    if (typeof res !== "string") b.commit();
    return res;
  };
  const wallAdjacent = (i: number) => {
    const x = i % W, y = (i / W) | 0;
    for (const [X, Y] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) if (b.inb(X, Y) && b.kind[Y * W + X] === K_WALL) return true;
    return false;
  };
  const rectCells = (x: number, y: number, p: Piece) => p.cells.map((c) => (y + c.dy) * W + x + c.dx).filter((i) => i >= 0 && i < W * H);
  /** 칸 집합과 사각형(x,y,p) 사이 최소 맨해튼 거리. */
  const distTo = (cells: readonly number[], x: number, y: number, p: Piece) => {
    let best = 1e9;
    for (const i of cells) {
      const cx = i % W, cy = (i / W) | 0;
      const dx = cx < x ? x - cx : cx > x + p.w - 1 ? cx - (x + p.w - 1) : 0;
      const dy = cy < y ? y - cy : cy > y + p.h - 1 ? cy - (y + p.h - 1) : 0;
      best = Math.min(best, dx + dy);
    }
    return best;
  };

  /** 후보 자리(결정론). */
  const candidates = (r: WizardingFurnitureRecipe, main: Piece): [number, number][] => {
    const out: [number, number][] = [];
    const on = floorKindOf(r.on);
    if (recipe.layout === "room" && r.placement === "north-wall") {
      const y = Math.max(0, Math.min(NR, r.wallTop ?? NR));
      for (let x = 1; x + main.w - 1 <= W - 2; x++) out.push([x, y]);
      return shuffle(out, rnd);
    }
    if (recipe.layout === "room" && r.placement === "side-wall") {
      const xs = r.side === "w" ? [1] : r.side === "e" ? [W - 1 - main.w] : [1, W - 1 - main.w];
      for (const x of xs) for (let y = NR; y + main.h - 1 <= H - SR - 1; y++) out.push([x, y]);
      return shuffle(out, rnd);
    }
    const bb = areaBounds(on);
    if (bb.x1 < 0) return out;
    if (r.placement === "corner") {
      const cs: [number, number][] = [[bb.x0, bb.y0], [bb.x1 - main.w + 1, bb.y0], [bb.x0, bb.y1 - main.h + 1], [bb.x1 - main.w + 1, bb.y1 - main.h + 1]];
      for (const [cx, cy] of shuffle(cs, rnd)) for (const [ox, oy] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [0, 2]] as const) out.push([cx + (cx === bb.x0 ? ox : -ox), cy + (cy === bb.y0 ? oy : -oy)]);
      return out;
    }
    for (let y = bb.y0; y + main.h - 1 <= bb.y1; y++) for (let x = bb.x0; x + main.w - 1 <= bb.x1; x++) out.push([x, y]);
    if (r.placement === "center") {
      const mx = (bb.x0 + bb.x1 + 1) / 2, my = (bb.y0 + bb.y1 + 1) / 2;
      const score = new Map(out.map(([x, y]) => [`${x},${y}`, Math.hypot(x + main.w / 2 - mx, (y + main.h / 2 - my) * 1.4) + rnd() * 2.5]));
      return out.sort((a, c) => score.get(`${a[0]},${a[1]}`)! - score.get(`${c[0]},${c[1]}`)!);
    }
    return shuffle(out, rnd);
  };

  /** 무리 짓기(edge·beside): 무리 하나에 2~4개, 다음 무리는 다른 기준에서. */
  const placeClustered = (r: WizardingFurnitureRecipe, n: number): number => {
    const parts = partsOf(r);
    if (!parts) return 0;
    const main = parts[0]!.piece;
    const on = floorKindOf(r.on);
    const bb = areaBounds(on);
    if (bb.x1 < 0) return 0;
    const all: [number, number][] = [];
    for (let y = bb.y0; y + main.h - 1 <= bb.y1; y++) for (let x = bb.x0; x + main.w - 1 <= bb.x1; x++) all.push([x, y]);
    const nearSet = new Set(r.near ?? []);
    const anchorPool = r.placement === "beside" ? shuffle(anchors.filter((a) => !nearSet.size || nearSet.has(a.kit)), rnd) : [];
    if (r.placement === "beside" && !anchorPool.length) return 0;
    let got = 0, guard = 0, anchorIdx = 0;
    while (got < n && guard++ < 40) {
      const size = Math.min(n - got, 2 + Math.floor(rnd() * 3));
      const cluster: number[] = [];
      let seedCells: number[];
      if (r.placement === "beside") { seedCells = anchorPool[anchorIdx++ % anchorPool.length]!.cells; }
      else {
        const edgePos = shuffle(all.filter(([x, y]) => rectCells(x, y, main).some(wallAdjacent)), rnd);
        if (!edgePos.length) break;
        const [sx, sy] = edgePos[0]!;
        seedCells = rectCells(sx, sy, main);
      }
      let placedHere = 0;
      for (let k = 0; k < size; k++) {
        const ref = cluster.length ? cluster : seedCells;
        const edgeFirst = r.placement === "edge" && !cluster.length;
        const minD = edgeFirst ? 0 : 1;
        const maxD = edgeFirst ? 0.4 : r.placement === "edge" ? 1.6 : 2.1;
        const cands = all
          .map(([x, y]) => ({ x, y, d: distTo(ref, x, y, main) + (r.placement === "beside" && cluster.length ? distTo(seedCells, x, y, main) * 0.5 : 0) + rnd() * 0.3 }))
          .filter((c) => c.d >= minD && c.d <= maxD)
          .filter((c) => r.placement !== "edge" || rectCells(c.x, c.y, main).some(wallAdjacent))
          .sort((a, c) => a.d - c.d);
        let ok = false;
        for (const c of cands.slice(0, 60)) {
          const res = place(r, parts, c.x, c.y);
          if (typeof res !== "string") { cluster.push(...res.cells); got++; placedHere++; ok = true; break; }
        }
        if (!ok) break;
      }
      if (!placedHere && r.placement === "beside" && anchorIdx >= anchorPool.length * 2) break;
    }
    return got;
  };

  /** 가운데 축 대칭 줄(책상·침대·서가): 가운데 통로를 두고 좌우 같은 열, 위에서 아래로 줄. 짝 하나가 안 되면 둘 다 뺀다. */
  const placeGrid = (r0: WizardingFurnitureRecipe, n: number): number => {
    const r: WizardingFurnitureRecipe = { ...r0, clearance: 0 };
    const parts0 = partsOf(r);
    if (!parts0) return 0;
    const alts = (r.alt ?? []).map((id) => resolve(id)).filter((p): p is Piece => !!p && p.w === parts0[0]!.piece.w && p.h === parts0[0]!.piece.h);
    let gx0 = 0, gy0 = 0, gx1 = 0, gy1 = 0;
    for (const pt of parts0) { gx0 = Math.min(gx0, pt.dx); gy0 = Math.min(gy0, pt.dy); gx1 = Math.max(gx1, pt.dx + pt.piece.w - 1); gy1 = Math.max(gy1, pt.dy + pt.piece.h - 1); }
    const gw = gx1 - gx0 + 1, gh = gy1 - gy0 + 1, gapX = r.gapX ?? r.gap ?? 1, gapY = r.gapY ?? r.gap ?? 1;
    const bb = areaBounds(floorKindOf(r.on));
    if (bb.x1 < 0) return 0;
    // 가운데 통로: 예약 칸(러너)이 가운데에 있으면 그 폭 + 양쪽 한 칸, 아니면 두 칸
    const mid = W / 2;
    let aisleL = Math.floor(mid) - 1, aisleR = Math.ceil(mid);
    for (let x = 0; x < W; x++) for (let y = bb.y0; y <= bb.y1; y++) if (b.reserved[y * W + x] && Math.abs(x + 0.5 - mid) < 3 && y > bb.y0 + 1 && y < bb.y1 - 1) { aisleL = Math.min(aisleL, x - 1); aisleR = Math.max(aisleR, x + 1); }
    const leftXs: number[] = [];
    for (let x = aisleL - gw; x >= bb.x0 + 1; x -= gw + gapX) leftXs.push(x);
    const cols: [number, number | null][] = leftXs.map((x) => [x, W - x - gw] as [number, number]);
    if (!cols.length && gw <= bb.x1 - bb.x0 - 1) cols.push([Math.floor((W - gw) / 2), null]);
    const top = r.rowsFrom === "north" ? (r.wallTop ?? NR) : bb.y0 + 1;
    // 줄 단위(위→아래)로 채운다: 한 줄은 모든 열 쌍을 시도하고, 쌍은 좌우가 같이 들어가야 한다.
    const perRow = cols.reduce((t, c) => t + (c[1] === null ? 1 : 2), 0);
    if (!perRow) return 0;
    const rowsWanted = Math.max(1, Math.round(n / perRow));
    let got = 0, rowsDone = 0;
    const varySets = (r.vary ?? []).map((set) => set.map((w) => { const p = resolve(w.kit); return p ? { piece: p, dx: w.dx, dy: w.dy, under: !!w.under } : null; }).filter((x): x is GroupPart => !!x));
    const pick = () => {
      const base = alts.length && rnd() < 0.3 ? [{ ...parts0[0]!, piece: alts[Math.floor(rnd() * alts.length)]! }, ...parts0.slice(1)] : parts0;
      return varySets.length ? [...base, ...varySets[Math.floor(rnd() * varySets.length)]!] : base;
    };
    // 줄은 위에서부터 한 칸씩 내려가며 찾는다: 앞선 grid(서가 줄) 밑에 다음 grid(열람 탁자)가 이어 붙도록. 한 줄이 들어가면 gh+gapY 만큼 건너뛴다.
    for (let y = top; y + gh - 1 <= bb.y1 - 2; ) {
      if (rowsDone >= rowsWanted) break;
      let inRow = 0;
      for (const [xl, xr] of cols) {
        const mark = b.mark(), gLen = groups.length, pLen = placed.length, aLen = anchors.length, seq = groupSeq;
        const undo = () => { b.rollback(mark); groups.length = gLen; placed.length = pLen; anchors.length = aLen; groupSeq = seq; };
        const a = tryPlace(r, pick(), xl - gx0, y - gy0);
        if (typeof a === "string") { undo(); continue; }
        if (xr !== null) {
          const c = tryPlace(r, pick(), xr - gx0, y - gy0);
          if (typeof c === "string") { undo(); continue; }
          inRow++;
        }
        b.commit();
        inRow++;
      }
      if (inRow) { got += inRow; rowsDone++; y += gh + gapY; } else y++;
    }
    return got;
  };

  let singles = 0;
  const placeAuto = (r: WizardingFurnitureRecipe, n0: number): number => {
    const parts = partsOf(r);
    if (!parts) return 0;
    let n = n0;
    const single = (r.placement === "free" || r.placement === "center") && parts.length === 1 && parts[0]!.piece.w === 1 && parts[0]!.piece.h === 1;
    if (single) n = Math.min(n, Math.max(0, 2 - singles));
    if (n <= 0) return 0;
    let got: number;
    if (r.placement === "grid") got = placeGrid(r, n);
    else if (r.placement === "edge" || r.placement === "beside") got = placeClustered(r, n);
    else {
      got = 0;
      let tries = 0;
      for (const [x, y] of candidates(r, parts[0]!.piece)) {
        if (got >= n || tries > 900) break;
        const res = place(r, parts, x, y);
        tries++;
        if (typeof res !== "string") got++;
      }
    }
    if (single) singles += got;
    return got;
  };
  const defArea = recipe.size.default[0] * recipe.size.default[1];
  const scale = Math.max(0.4, Math.min(3, Math.pow((countArea ?? W * H) / defArea, 0.75)));
  const countFor = (r: WizardingFurnitureRecipe): number => {
    const baseN = r.count[0] + (r.count[1] - r.count[0]) * density;
    if (r.placement === "corner") return Math.max(0, Math.min(4, Math.round(baseN)));
    const n = Math.round(baseN * scale);
    return scale >= 0.75 ? Math.max(r.count[0], n) : n;
  };
  const mode: WizardingFurnitureMode = input.furnitureMode ?? "auto";
  if (mode === "none" && input.furniture?.length) warn(ISSUE.BAD_INPUT, `furnitureMode "none" 이라 furniture ${input.furniture.length}개를 무시했다`);
  if (mode !== "none") {
    for (const f of input.furniture ?? []) {
      const r: WizardingFurnitureRecipe = recipe.furniture.find((e) => e.kit === f.kit)
        ?? { kit: f.kit, placement: f.y !== undefined && f.y < NR ? "north-wall" : "free", count: [1, 1], clearance: 0 };
      const parts = partsOf(r);
      if (!parts) { err(ISSUE.UNKNOWN_KIT, `가구 "${f.kit}" 이 타일셋에 없다 — list_wizarding_spaces 로 이 공간의 가구 id 를 확인한다`); continue; }
      if ((f.x === undefined) !== (f.y === undefined)) { err(ISSUE.BAD_INPUT, `가구 ${f.kit} 는 x·y 를 함께 주거나 둘 다 뺀다`); continue; }
      if (f.x !== undefined && f.y !== undefined) {
        const res = place(r, parts, f.x, f.y);
        if (typeof res === "string") err(ISSUE.FURNITURE_BLOCKED, `가구 ${f.kit} 를 (${f.x},${f.y}) 에 놓지 못했다 — ${res}`, f.x, f.y);
      } else {
        const one: WizardingFurnitureRecipe = r.placement === "grid" ? { ...r, placement: "center" } : r;
        if ((one.placement === "edge" || one.placement === "beside" ? placeClustered(one, 1) : (() => { for (const [x, y] of candidates(one, parts[0]!.piece).slice(0, 900)) if (typeof place(one, parts, x, y) !== "string") return 1; return 0; })()) < 1)
          err(ISSUE.FURNITURE_NO_ROOM, `가구 ${f.kit} 를 놓을 자리가 없다(통행·여유칸을 지키는 자리)`);
      }
    }
    if (mode === "auto") {
      for (const r of recipe.furniture) {
        const n = countFor(r);
        if (n <= 0) continue;
        const got = placeAuto(r, n);
        const single = (r.placement === "free" || r.placement === "center") && (SPEC_PIECE_1x1(r.kit));
        if (got < Math.min(n, r.count[0]) && !single && !(r.placement === "grid" && got > 0)) warn(ISSUE.FURNITURE_SHORT, `${r.kit} ${got}/${n}개만 놓았다(자리 부족)`);
      }
    }
  }
  function SPEC_PIECE_1x1(kit: string) { const p = resolve(kit); return !!p && p.w === 1 && p.h === 1; }
  // 숲 테두리 나무(가구 다음 — 공터 쪽 가구 자리를 먼저 지킨다)
  if (recipe.layout === "forest") {
    const g = recipe.ground ?? {};
    const band = g.band ?? 4;
    const border = (g.border ?? []).map((id) => resolve(id)).filter((p): p is Piece => !!p);
    if (border.length) {
      const target = Math.round(((2 * (W + H)) / 3) * (0.7 + 0.6 * density));
      const pos: [number, number][] = [];
      for (let y = -1; y < H; y++) for (let x = -1; x < W; x++) if (x < band || y < band || x > W - 1 - band || y > H - 1 - band) pos.push([x, y]);
      shuffle(pos, rnd);
      let got = 0, k = 0;
      for (const [x, y] of pos) {
        if (got >= target) break;
        const p = border[k++ % border.length]!;
        const r: WizardingFurnitureRecipe = { kit: p.id, placement: "free", count: [1, 1], clearance: 0, on: "ground", access: false };
        const px = Math.max(0, Math.min(W - p.w, x)), py = Math.max(0, Math.min(H - p.h, y));
        const res = place(r, [{ piece: p, dx: 0, dy: 0, under: false }], px, py);
        if (typeof res !== "string") { got++; placed[placed.length - 1] = { ...placed[placed.length - 1]!, role: "border" }; }
      }
    }
  }

  // 덧그림: 흩뿌리지 않는다 — near 키트 둘레(없으면 벽에 붙은 바닥)에 2~4개씩 무리로.
  if (mode === "auto") {
    const decalOk = (p: Piece, x: number, y: number) => {
      for (const c of p.cells) {
        const X = x + c.dx, Y = y + c.dy;
        if (!b.inb(X, Y)) return false;
        const i = Y * W + X, kk = b.kind[i]!;
        if ((recipe.layout === "forest" ? kk !== K_GROUND && kk !== K_FLOOR : kk !== K_FLOOR) || b.fp[i]! >= 0 || b.reserved[i] || b.L[2][i]! >= 0 || b.L[1][i]! >= 0 || !cellPass(i)) return false;
      }
      return true;
    };
    for (const d of recipe.decals) {
      const p = resolve(d.kit);
      if (!p || !flatOnly(p)) continue;
      const n = Math.round((d.count[0] + (d.count[1] - d.count[0]) * density) * scale);
      if (n <= 0) continue;
      const nearSet = new Set(d.near ?? []);
      const pool = shuffle(anchors.filter((a) => nearSet.has(a.kit)), rnd);
      const seeds: number[][] = pool.length ? pool.map((a) => a.cells) : [];
      if (!seeds.length) {
        const edge: number[] = [];
        for (let i = 0; i < W * H; i++) if (wallAdjacent(i) && decalOk(p, i % W, (i / W) | 0)) edge.push(i);
        for (const i of shuffle(edge, rnd).slice(0, 8)) seeds.push([i]);
      }
      let got = 0, si = 0;
      while (got < n && si < seeds.length * 2) {
        const ref = seeds[si++ % seeds.length]!;
        const size = Math.min(n - got, 2 + Math.floor(rnd() * 3));
        const cluster: number[] = [];
        for (let k = 0; k < size; k++) {
          const around = cluster.length ? cluster : ref;
          let best: [number, number] | null = null, bestD = 1e9;
          for (const i of around) {
            const cx = i % W, cy = (i / W) | 0;
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
              const x = cx + dx, y = cy + dy;
              if (!decalOk(p, x, y)) continue;
              const dd = distTo(around, x, y, p) + distTo(ref, x, y, p) * 0.3 + rnd() * 0.4;
              if (dd >= 1 && dd < bestD) { bestD = dd; best = [x, y]; }
            }
          }
          if (!best || bestD > 2.6) break;
          stampDecal(p, best[0], best[1]);
          placed.push({ kit: p.id, x: best[0], y: best[1], role: "decal" });
          cluster.push(...rectCells(best[0], best[1], p));
          got++;
        }
      }
    }
  }
  // ════════════════ 마지막 불변식
  const seen = reach();
  let comps = 0, pockets = 0;
  if (!seen) err(ISSUE.SPLIT, "시작 칸이 막혔다");
  else {
    const label = new Int32Array(W * H).fill(-1);
    for (let s0 = 0; s0 < W * H; s0++) {
      if (label[s0]! >= 0 || !cellPass(s0)) continue;
      const q = [s0]; label[s0] = s0; let real = false;
      while (q.length) {
        const i = q.pop()!, x = i % W, y = (i / W) | 0;
        if (!b.touched[i]) real = true;
        for (const [j, okk] of [[i - 1, x > 0], [i + 1, x < W - 1], [i - W, y > 0], [i + W, y < H - 1]] as const) if (okk && label[j]! < 0 && cellPass(j)) { label[j] = s0; q.push(j); }
      }
      if (real) comps++; else pockets++;
    }
    if (comps !== 1) err(ISSUE.SPLIT, `걸을 수 있는 바닥이 ${comps}덩이다(1이어야 한다)`);
    for (const c of doorCells) if (seen[c.y * W + c.x] !== 1) err(ISSUE.DOOR_UNREACHABLE, `출입구 (${c.x},${c.y}) 에 닿지 못한다`, c.x, c.y);
  }
  const walkableCount = seen ? seen.reduce((a, v) => a + (v === 1 ? 1 : 0), 0) : 0;
  return {
    space: input.space, variant: input.variant ?? null, ko: recipe.ko, indoor: recipe.indoor, width: W, height: H,
    lowerTiles: [...b.L[0]], lowerOverlayTiles: [...b.L[1]], upperTiles: [...b.L[2]], upperOverlayTiles: [...b.L[3]],
    placed, doorCells, spawn, walkableCount, components: comps, pockets, issues,
  };
}

function cellTop(b: Board, i: number): number {
  for (const l of [3, 2, 1, 0] as const) if (b.L[l][i]! >= 0) return b.L[l][i]!;
  return -1;
}

/** 오토타일 이웃 마스크(1 N · 2 E · 4 S · 8 W · 16 NE · 32 SE · 64 SW · 128 NW) → variantMap. packLayoutTool 의 규칙과 같다. */
function paintAutotile(b: Board, region: Uint8Array, g: AutotileGroup, outsideSame: boolean): void {
  const { W, H } = b;
  const same = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? outsideSame : region[y * W + x] === 1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!region[y * W + x]) continue;
    let m = 0;
    if (same(x, y - 1)) m |= 1; if (same(x + 1, y)) m |= 2; if (same(x, y + 1)) m |= 4; if (same(x - 1, y)) m |= 8;
    if ((g.neighborhood ?? 4) === 8) { if (same(x + 1, y - 1)) m |= 16; if (same(x + 1, y + 1)) m |= 32; if (same(x - 1, y + 1)) m |= 64; if (same(x - 1, y - 1)) m |= 128; }
    const t = g.variantMap[String(m)] ?? g.memberTileIds[0];
    if (t !== undefined && t >= 0) b.L[0][y * W + x] = t;
  }
}

/** 바닥: 오토타일이면 마스크로, 아니면 섞을 칸을 드문드문(12%) 바꾼다. */
function paintFloor(b: Board, region: Uint8Array | null, auto: AutotileGroup | null | undefined, mix: readonly number[], rnd: () => number, outsideSame: boolean, where?: (i: number) => boolean): void {
  if (auto && region) { paintAutotile(b, region, auto, outsideSame); return; }
  if (!mix.length) return;
  for (let i = 0; i < b.n; i++) {
    if (where ? !where(i) : !(region && region[i])) continue;
    if (rnd() < 0.12) b.L[0][i] = mix[Math.floor(rnd() * mix.length)]!;
  }
}
