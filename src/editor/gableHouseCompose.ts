// editor/gableHouseCompose.ts
// 박공 조합 형태(gableHouseFormCatalog)를 킷 재료로 셀 레시피(AuthoredHouseFormDef)로 합성한다.
//
// 타일 문법은 참고 사례 박공 집에서 그대로 옮겼다(ref-castle-08·23, ref-walled-01·02):
//  · 정면 박공 폭 w, h=w/2. 벽 윗줄 바로 위부터 위로
//      합각 행 k=1..h-1 : 가운데 w-2k 칸 = 벽 중단 가운데 타일(합각 벽), 그 양끝 칸 상위에 처마 밑 캡(386/387·384/385),
//                         바깥 k 칸씩 = 밝은 면(왼쪽)·어두운 면(오른쪽) 몸통
//      steep 행          : 온폭 몸통
//      몸통 행 j=1..h-1  : 가운데 w-2j 칸 몸통, 바로 바깥 한 칸 상위에 사선 캡(356/357·354/355)
//      꼭대기 행         : 가운데 두 칸 상위에 사선 캡
//  · 측면 박공 덩어리: 윗줄(용마루 436/374) · 몸통(437/375) · 처마(467/405). hip 은 윗줄을 들이고 모서리 캡,
//    verge 는 좌우 끝 열을 밝은/어두운 사선 테로 두고 처마 끝에 처마 밑 캡.
//  · 벽은 킷 나인슬라이스(+하프팀버 기둥 열) — 부품마다 따로 끊어 덩어리가 둘로 읽히게 한다.
//  · 불투명 칸을 새로 칠하면 그 칸의 상위(앞서 얹은 캡·창)를 지운다. 캡만 얹는 칸은 하위를 건드리지 않는다.

import { CHIMNEY_TILE, HOUSE_KITS, isWallPostAt, type HouseKit, type HouseKitId } from "@/editor/houseKit";
import { housePartTile } from "@/project/defaults/forestHarmonyHouseParts";
import type { AuthoredHouseFormDef, AuthoredHouseFormRow } from "@/project/defaults/authoredHouseFormCatalog";
import {
  findGableHouseFormSpec,
  GABLE_HOUSE_FORM_SPECS,
  type GableBlockPart,
  type GableFrontPart,
  type GableHouseFormSpec,
  type GablePart,
} from "@/project/defaults/gableHouseFormCatalog";

/** 박공 지붕 재료 — 역할별 타일. 킷의 지붕 계열(파랑/주황)에서 고른다. */
export interface GableRoofMaterial {
  /** 정면 박공 왼쪽(밝은) 면·측면 박공 왼쪽 테. */
  readonly lit: number;
  /** 정면 박공 오른쪽(어두운) 면·측면 박공 오른쪽 테. */
  readonly dark: number;
  /** 측면 덩어리 용마루 줄. */
  readonly top: number;
  /** 측면 덩어리 몸통. */
  readonly body: number;
  /** 측면 덩어리 처마 줄. */
  readonly eave: number;
  /** 사선 캡(투명) — 왼쪽 오르막 / 오른쪽 내리막. */
  readonly capL: number;
  readonly capR: number;
  /** 처마 밑 캡(투명) — 합각 벽 위 사선. */
  readonly underL: number;
  readonly underR: number;
  /** 이 지붕색의 지붕창·꼭대기 장식 부품 이름(집 부품 시트). */
  readonly parts: { readonly dormer: string; readonly finialL: string; readonly finialR: string };
}

export const GABLE_ROOF_BLUE: GableRoofMaterial = {
  lit: 406, dark: 407, top: 436, body: 437, eave: 467, capL: 356, capR: 357, underL: 386, underR: 387,
  parts: { dormer: "dormer-blue", finialL: "finial-blue-l", finialR: "finial-blue-r" },
};
export const GABLE_ROOF_ORANGE: GableRoofMaterial = {
  lit: 376, dark: 377, top: 374, body: 375, eave: 405, capL: 354, capR: 355, underL: 384, underR: 385,
  parts: { dormer: "dormer-orange", finialL: "finial-orange-l", finialR: "finial-orange-r" },
};

/** 재칠 지붕(집 부품 시트 roof-<재료>-<원본>) — 파랑 계열은 파랑 박공 문법, 주황 계열은 주황 문법을 그대로 따른다. */
function recoloredMaterial(material: string, base: GableRoofMaterial): GableRoofMaterial {
  const t = (tile: number): number => housePartTile(`roof-${material}-${tile}`);
  return {
    lit: t(base.lit), dark: t(base.dark), top: t(base.top), body: t(base.body), eave: t(base.eave),
    capL: t(base.capL), capR: t(base.capR), underL: t(base.underL), underR: t(base.underR),
    parts: { dormer: `dormer-${material}`, finialL: `finial-${material}-l`, finialR: `finial-${material}-r` },
  };
}

/** 재칠 재료와 그 재료를 쓰는 킷 지붕 몸통 칸(주황 계열 = 404 재칠본, 파랑 계열 = 406 재칠본). */
const RECOLORED: readonly { readonly material: GableRoofMaterial; readonly kitBody: number }[] = [
  { material: recoloredMaterial("moss", GABLE_ROOF_ORANGE), kitBody: housePartTile("roof-moss-404") },
  { material: recoloredMaterial("thatch", GABLE_ROOF_ORANGE), kitBody: housePartTile("roof-thatch-404") },
  { material: recoloredMaterial("slate", GABLE_ROOF_BLUE), kitBody: housePartTile("roof-slate-406") },
  { material: recoloredMaterial("charcoal", GABLE_ROOF_BLUE), kitBody: housePartTile("roof-charcoal-406") },
];
const RECOLORED_MATERIALS = RECOLORED.map((entry) => entry.material);

/** 킷 지붕의 몸통 칸으로 박공 재료를 고른다. */
const MATERIAL_BY_KIT_BODY: ReadonlyMap<number, GableRoofMaterial> = new Map([
  [404, GABLE_ROOF_ORANGE],
  [406, GABLE_ROOF_BLUE],
  ...RECOLORED.map((entry): [number, GableRoofMaterial] => [entry.kitBody, entry.material]),
]);

export function gableRoofMaterialForKit(kit: HouseKit): GableRoofMaterial {
  return MATERIAL_BY_KIT_BODY.get(kit.roof.body) ?? (kit.roof.kind === "blue" ? GABLE_ROOF_BLUE : GABLE_ROOF_ORANGE);
}

/** 박공 형태가 칠하는 모든 지붕 타일 — 감지·보호 쪽이 집 칸으로 세도록 공개한다. */
export function gableRoofTiles(): readonly number[] {
  return [GABLE_ROOF_BLUE, GABLE_ROOF_ORANGE, ...RECOLORED_MATERIALS].flatMap((material) =>
    [material.lit, material.dark, material.top, material.body, material.eave, material.capL, material.capR, material.underL, material.underR]);
}

export function isGableHouseFormId(id: string | undefined): boolean {
  return id !== undefined && findGableHouseFormSpec(id) !== undefined;
}

const wallRowsOf = (part: GablePart): number => (part.wall === "low" ? 2 : 3);

function partTop(part: GablePart): number {
  const wallTop = part.bottom - wallRowsOf(part) + 1;
  if (part.kind === "front") return wallTop - (part.w - 1 + (part.steep ?? 0));
  return wallTop - part.roofRows;
}

interface Canvas {
  readonly w: number;
  readonly h: number;
  readonly lower: number[];
  readonly upper: number[];
  /** 칸마다 그 칸 벽을 칠한 부품 번호(-1 = 벽 아님) — 보이는 벽 면·창 자리 계산용. */
  readonly wallOwner: number[];
}

/** 불투명 칸 — 하위를 칠하고 앞서 얹은 상위(캡·창)를 지운다. owner 는 벽을 칠한 부품(지붕이면 -1). */
function paint(canvas: Canvas, x: number, y: number, tile: number, owner = -1): void {
  if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) return;
  canvas.lower[y * canvas.w + x] = tile;
  canvas.upper[y * canvas.w + x] = -1;
  canvas.wallOwner[y * canvas.w + x] = owner;
}

/** 투명 캡·창 — 상위만 얹는다. */
function overlay(canvas: Canvas, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) return;
  canvas.upper[y * canvas.w + x] = tile;
}

function wallTileAt(kit: HouseKit, role: 0 | 1 | 2, offset: number, width: number): number {
  const slice = role === 0 ? kit.wall.top : role === 1 ? kit.wall.mid : kit.wall.bottom;
  if (offset === 0) return slice[0];
  if (offset === width - 1) return slice[2];
  if (kit.postColumn && isWallPostAt(kit, offset, width)) return kit.postColumn.tiles[role];
  return slice[1];
}

const isPostOffset = (kit: HouseKit, offset: number, width: number): boolean => isWallPostAt(kit, offset, width);

interface PartPlacement {
  /** spec.parts 안 순번 — 벽 주인 표시. */
  readonly index: number;
  readonly part: GablePart;
  /** 캔버스 좌표로 옮긴 x·bottom. */
  readonly x: number;
  readonly bottom: number;
  readonly wallTop: number;
}

function drawWalls(canvas: Canvas, kit: HouseKit, placed: PartPlacement): void {
  const { part, x, bottom, wallTop } = placed;
  for (let y = wallTop; y <= bottom; y += 1) {
    const role: 0 | 1 | 2 = y === wallTop ? 0 : y === bottom ? 2 : 1;
    for (let dx = 0; dx < part.w; dx += 1) paint(canvas, x + dx, y, wallTileAt(kit, role, dx, part.w), placed.index);
  }
}

function drawFrontRoof(canvas: Canvas, kit: HouseKit, roof: GableRoofMaterial, placed: PartPlacement & { readonly part: GableFrontPart }): { readonly x: number; readonly y: number } {
  const { part, x, wallTop } = placed;
  const w = part.w;
  const h = w / 2;
  const face = (dx: number): number => (dx < h ? roof.lit : roof.dark);
  const pediment = kit.wall.mid[1];
  let y = wallTop - 1;
  // 합각 행 — 아래가 넓다.
  for (let k = 1; k <= h - 1; k += 1, y -= 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const inPediment = dx >= k && dx <= w - 1 - k;
      paint(canvas, x + dx, y, inPediment ? pediment : face(dx));
    }
    overlay(canvas, x + k, y, roof.underL);
    overlay(canvas, x + w - 1 - k, y, roof.underR);
  }
  // 온폭 몸통 행.
  for (let s = 0; s < (part.steep ?? 0); s += 1, y -= 1) {
    for (let dx = 0; dx < w; dx += 1) paint(canvas, x + dx, y, face(dx));
  }
  // 좁아지는 몸통 행 + 바깥 사선 캡.
  for (let j = 1; j <= h - 1; j += 1, y -= 1) {
    for (let dx = j; dx <= w - 1 - j; dx += 1) paint(canvas, x + dx, y, face(dx));
    overlay(canvas, x + j - 1, y, roof.capL);
    overlay(canvas, x + w - j, y, roof.capR);
  }
  // 꼭대기.
  overlay(canvas, x + h - 1, y, roof.capL);
  overlay(canvas, x + h, y, roof.capR);
  return { x: x + h - 1, y };
}

function drawBlockRoof(canvas: Canvas, roof: GableRoofMaterial, placed: PartPlacement & { readonly part: GableBlockPart }): void {
  const { part, x, wallTop } = placed;
  const w = part.w;
  const top = wallTop - part.roofRows;
  const eave = wallTop - 1;
  const verge = part.ends === "verge";
  for (let y = top; y <= eave; y += 1) {
    for (let dx = 0; dx < w; dx += 1) {
      const edge = dx === 0 || dx === w - 1;
      if (y === top) {
        if (edge) overlay(canvas, x + dx, y, dx === 0 ? roof.capL : roof.capR);
        else paint(canvas, x + dx, y, roof.top);
        continue;
      }
      if (y === eave) {
        paint(canvas, x + dx, y, roof.eave);
        if (verge && edge) overlay(canvas, x + dx, y, dx === 0 ? roof.underL : roof.underR);
        continue;
      }
      paint(canvas, x + dx, y, verge && edge ? (dx === 0 ? roof.lit : roof.dark) : roof.body);
    }
  }
}

/** 문 칸 — 정면 박공은 가운데 왼쪽, 덩어리는 가운데. 하프팀버 기둥 열은 피한다. */
function doorOffset(kit: HouseKit, part: GablePart): number {
  const base = part.kind === "front" ? part.w / 2 - 1 : Math.floor((part.w - 1) / 2);
  for (const candidate of [base, base + 1, base - 1]) {
    if (candidate > 0 && candidate < part.w - 1 && !isPostOffset(kit, candidate, part.w)) return candidate;
  }
  return base;
}

/**
 * 사선 캡 뒤 메우기(2026-09-25 사용자 검토): 두 박공이 앞뒤로 엇갈리면 앞 박공의 사선 캡(투명) 밑이 비고 그 바깥에
 * 뒤 지붕이 서서, 실루엣 안쪽에 풀밭 삼각형이 비친다. 그런 캡 칸의 하위를 바깥(없으면 위) 지붕 칸으로 채워
 * 뒤 지붕이 사선 뒤로 이어지게 한다. 실루엣 바깥(바깥·위가 빈) 캡은 그대로 둔다.
 */
function backfillSlopes(canvas: Canvas, roof: GableRoofMaterial): void {
  const roofTiles = new Set([roof.lit, roof.dark, roof.top, roof.body, roof.eave]);
  const lowerAt = (x: number, y: number): number => (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h ? -1 : canvas.lower[y * canvas.w + x]!);
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (let y = 0; y < canvas.h; y += 1) {
      for (let x = 0; x < canvas.w; x += 1) {
        const index = y * canvas.w + x;
        if (canvas.lower[index] !== -1) continue;
        const upper = canvas.upper[index]!;
        const outside = upper === roof.capL ? x - 1 : upper === roof.capR ? x + 1 : undefined;
        if (outside === undefined) continue;
        const side = lowerAt(outside, y);
        const above = lowerAt(x, y - 1);
        if (side === -1 && above === -1) continue;
        const fill = roofTiles.has(side) ? side : roofTiles.has(above) ? above : roof.body;
        canvas.lower[index] = fill === roof.top || fill === roof.eave ? roof.body : fill;
        changed = true;
      }
    }
    if (!changed) return;
  }
}

/** 창을 낼 벽 줄 —보통 벽은 가운데 줄, 낮은 벽(상·하 2줄)은 윗줄(처마 밑 창). */
function windowRows(placed: PartPlacement): number[] {
  return [placed.part.wall === "low" ? placed.wallTop : placed.wallTop + 1];
}

/** 이 줄에서 부품 벽이 실제로 보이는 연속 칸 구간(뒤 부품이 앞 부품에 가린 곳은 뺀다). */
function visibleWallRuns(canvas: Canvas, placed: PartPlacement, y: number): { x0: number; x1: number }[] {
  const runs: { x0: number; x1: number }[] = [];
  let start = -1;
  for (let x = placed.x; x <= placed.x + placed.part.w; x += 1) {
    const own = x < placed.x + placed.part.w && y >= 0 && y < canvas.h && canvas.wallOwner[y * canvas.w + x] === placed.index;
    if (own && start < 0) start = x;
    if (!own && start >= 0) { runs.push({ x0: start, x1: x - 1 }); start = -1; }
  }
  return runs;
}

/** 연속 후보 칸 구간 안에 창을 고르게 — 칸 3개마다 하나꼴, 서로 붙지 않게, 가운데 정렬. */
function spreadInSegment(a: number, b: number): number[] {
  const length = b - a + 1;
  const count = Math.max(1, Math.floor((length + 2) / 3));
  if (count === 1) return [a + Math.floor((length - 1) / 2)];
  return Array.from({ length: count }, (_, i) => a + Math.round((i * (length - 1)) / (count - 1)));
}

/**
 * 창 배치(2026-09-25 사용자 규칙): 보이는 벽 면이 3칸 이상이면 창이 적어도 하나. 넓은 면은 빈 벽 2~3칸마다 하나,
 * 문과는 붙지 않게(문 좌우 한 칸 비움), 벽 끝 칸·기둥 열에는 내지 않는다. 문 양쪽 구간을 따로 채워 좌우가 맞는다.
 */
function drawWindows(canvas: Canvas, kit: HouseKit, placements: readonly PartPlacement[], doorAt: { readonly x: number; readonly y: number }, doorPart: PartPlacement): void {
  for (const placed of placements) {
    for (const y of windowRows(placed)) {
      for (const run of visibleWallRuns(canvas, placed, y)) {
        if (run.x1 - run.x0 + 1 < 3) continue;
        const free = (x: number): boolean => {
          if (x <= run.x0 || x >= run.x1) return false;
          if (isPostOffset(kit, x - placed.x, placed.part.w)) return false;
          if (placed === doorPart && Math.abs(x - doorAt.x) <= 1) return false;
          return canvas.upper[y * canvas.w + x] === -1;
        };
        let segmentStart = -1;
        let placedAny = false;
        for (let x = run.x0; x <= run.x1 + 1; x += 1) {
          const ok = x <= run.x1 && free(x);
          if (ok && segmentStart < 0) segmentStart = x;
          if (!ok && segmentStart >= 0) {
            for (const wx of spreadInSegment(segmentStart, x - 1)) overlay(canvas, wx, y, kit.windowTile);
            segmentStart = -1;
            placedAny = true;
          }
        }
        if (placedAny) continue;
        // 폭 4 박공처럼 문이 안쪽 칸을 다 먹으면 문에서 먼 벽 끝 칸에 창(끝 반기둥 옆에 붙는 작은 창).
        const ends = [run.x0, run.x1]
          .filter((x) => !(placed === doorPart && Math.abs(x - doorAt.x) <= 1) && canvas.upper[y * canvas.w + x] === -1)
          .sort((a, b) => Math.abs(b - doorAt.x) - Math.abs(a - doorAt.x));
        if (ends.length > 0) overlay(canvas, ends[0]!, y, kit.windowTile);
      }
    }
  }
}

export interface GableComposeOptions {
  /**
   * 작은 지붕 부품(굴뚝·지붕창·현관 차양·박공 꼭대기 장식)을 0~2개 붙이는 씨앗. 생략하면 부품 없음.
   * 부품 칸(forest_harmony 3060~)이 있는 타일셋에서만 넘겨야 한다 — tilesetHasHouseParts.
   */
  readonly accentSeed?: number;
}

function mix(seed: number, salt: number): number {
  let h = (seed ^ Math.imul(salt + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

type AccentKind = "chimney" | "dormer" | "awning" | "finial";

interface AccentContext {
  readonly canvas: Canvas;
  readonly kit: HouseKit;
  readonly roof: GableRoofMaterial;
  readonly placements: readonly PartPlacement[];
  readonly apexes: readonly { readonly x: number; readonly y: number }[];
  readonly doorAt: { readonly x: number; readonly y: number };
  readonly doorPart: PartPlacement;
}

const at = (canvas: Canvas, x: number, y: number): { lower: number; upper: number } | undefined =>
  x < 0 || y < 0 || x >= canvas.w || y >= canvas.h ? undefined : { lower: canvas.lower[y * canvas.w + x]!, upper: canvas.upper[y * canvas.w + x]! };

function placeAccent(context: AccentContext, kind: AccentKind, seed: number): boolean {
  const { canvas, roof } = context;
  const roofTiles = new Set([roof.lit, roof.dark, roof.body, roof.top]);
  if (kind === "chimney") {
    // 지붕 칸 중 그 열 지붕의 위 세 줄 안, 위 칸이 합각 벽이 아닌 곳. 오른쪽(어두운 면)을 먼저.
    const candidates: { x: number; y: number }[] = [];
    for (let x = 0; x < canvas.w; x += 1) {
      let firstRoofY = -1;
      for (let y = 0; y < canvas.h; y += 1) {
        const cell = at(canvas, x, y)!;
        if (!roofTiles.has(cell.lower)) continue;
        if (firstRoofY < 0) firstRoofY = y;
        if (y - firstRoofY > 2 || cell.upper !== -1) continue;
        candidates.push({ x, y });
      }
    }
    if (candidates.length === 0) return false;
    const right = candidates.filter((cell) => (at(canvas, cell.x, cell.y)!.lower === roof.dark || cell.x >= canvas.w / 2));
    const pool = right.length > 0 ? right : candidates;
    const cell = pool[mix(seed, 1) % pool.length]!;
    const tiles = [CHIMNEY_TILE, housePartTile("chimney-brick"), housePartTile("chimney-brick-smoke"), housePartTile("chimney-stone-smoke")];
    overlay(canvas, cell.x, cell.y, tiles[mix(seed, 2) % tiles.length]!);
    return true;
  }
  if (kind === "dormer") {
    // 측면 덩어리의 몸통 줄(용마루·처마 아닌 줄) 가운데 칸 — 아직 몸통으로 남아 있는 칸만.
    const candidates: { x: number; y: number }[] = [];
    for (const placed of context.placements) {
      if (placed.part.kind !== "block" || placed.part.roofRows < 3) continue;
      const top = placed.wallTop - placed.part.roofRows;
      for (let y = top + 1; y <= placed.wallTop - 2; y += 1) {
        for (let dx = 1; dx < placed.part.w - 1; dx += 1) {
          const cell = at(canvas, placed.x + dx, y);
          if (!cell || cell.lower !== roof.body || cell.upper !== -1) continue;
          // 양옆도 몸통이어야 지붕 한가운데에 선다.
          if (at(canvas, placed.x + dx - 1, y)?.lower !== roof.body || at(canvas, placed.x + dx + 1, y)?.lower !== roof.body) continue;
          candidates.push({ x: placed.x + dx, y });
        }
      }
    }
    if (candidates.length === 0) return false;
    const cell = candidates[mix(seed, 3) % candidates.length]!;
    overlay(canvas, cell.x, cell.y, housePartTile(roof.parts.dormer));
    return true;
  }
  if (kind === "awning") {
    // 문 바로 위 벽 윗줄(보통 높이 벽만).
    if (context.doorPart.part.wall === "low") return false;
    const y = context.doorAt.y - 2;
    const cell = at(canvas, context.doorAt.x, y);
    if (!cell || cell.upper !== -1 || y !== context.doorPart.wallTop) return false;
    overlay(canvas, context.doorAt.x, y, housePartTile(mix(seed, 4) % 2 === 0 ? "awning-wood" : "awning-cloth"));
    return true;
  }
  // finial — 정면 박공 꼭대기 캡 두 칸을 장식 캡으로.
  const apex = context.apexes.find((candidate) =>
    at(canvas, candidate.x, candidate.y)?.upper === roof.capL && at(canvas, candidate.x + 1, candidate.y)?.upper === roof.capR);
  if (!apex) return false;
  overlay(canvas, apex.x, apex.y, housePartTile(roof.parts.finialL));
  overlay(canvas, apex.x + 1, apex.y, housePartTile(roof.parts.finialR));
  return true;
}

/** 집마다 0~2개 — 종류 순서도 씨앗으로 섞는다. 붙일 자리가 없는 종류는 건너뛴다. */
function addAccents(context: AccentContext, seed: number): void {
  const want = mix(seed, 0) % 3;
  if (want === 0) return;
  const kinds: AccentKind[] = ["chimney", "dormer", "awning", "finial"];
  for (let i = kinds.length - 1; i > 0; i -= 1) {
    const j = mix(seed, 10 + i) % (i + 1);
    [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
  }
  let placed = 0;
  for (const kind of kinds) {
    if (placed >= want) break;
    if (placeAccent(context, kind, mix(seed, 100 + placed))) placed += 1;
  }
}

/**
 * 박공 조합 형태 하나를 킷 재료로 합성한다. 결정론적 — 같은 spec·kit·씨앗이면 같은 셀.
 * id 는 spec id 그대로라 author_house·마을·감지가 같은 이름을 본다.
 */
export function composeGableHouseForm(spec: GableHouseFormSpec, kitId: HouseKitId, options: GableComposeOptions = {}): AuthoredHouseFormDef {
  return composeInternal(spec, kitId, options).form;
}

interface ComposeResult {
  readonly form: AuthoredHouseFormDef;
  readonly canvas: Canvas;
  readonly placements: readonly PartPlacement[];
  readonly roof: GableRoofMaterial;
  readonly doorPart: PartPlacement;
}

function composeInternal(spec: GableHouseFormSpec, kitId: HouseKitId, options: GableComposeOptions): ComposeResult {
  const kit = HOUSE_KITS[kitId];
  const roof = gableRoofMaterialForKit(kit);
  const minX = Math.min(...spec.parts.map((part) => part.x));
  const maxX = Math.max(...spec.parts.map((part) => part.x + part.w - 1));
  const minY = Math.min(...spec.parts.map(partTop));
  const maxY = Math.max(...spec.parts.map((part) => part.bottom));
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const canvas: Canvas = {
    w, h, lower: new Array<number>(w * h).fill(-1), upper: new Array<number>(w * h).fill(-1), wallOwner: new Array<number>(w * h).fill(-1),
  };
  const placements: PartPlacement[] = spec.parts
    .map((part, index) => ({ index, part, x: part.x - minX, bottom: part.bottom - minY, wallTop: part.bottom - minY - wallRowsOf(part) + 1 }))
    .sort((a, b) => a.bottom - b.bottom || (a.part.kind === b.part.kind ? 0 : a.part.kind === "block" ? -1 : 1));
  const doorPart = placements.find((placed) => placed.part.door === true)
    ?? placements.reduce((best, placed) => (placed.bottom > best.bottom || (placed.bottom === best.bottom && placed.part.w > best.part.w) ? placed : best));
  const doorAt = { x: doorPart.x + doorOffset(kit, doorPart.part), y: doorPart.bottom };
  const apexes: { x: number; y: number }[] = [];
  for (const placed of placements) {
    if (placed.part.kind === "front") apexes.push(drawFrontRoof(canvas, kit, roof, placed as PartPlacement & { readonly part: GableFrontPart }));
    else drawBlockRoof(canvas, roof, placed as PartPlacement & { readonly part: GableBlockPart });
    drawWalls(canvas, kit, placed);
  }
  backfillSlopes(canvas, roof);
  drawWindows(canvas, kit, placements, doorAt, doorPart);
  if (options.accentSeed !== undefined) {
    addAccents({ canvas, kit, roof, placements, apexes, doorAt, doorPart }, options.accentSeed >>> 0);
  }
  const rows: AuthoredHouseFormRow[] = [];
  for (let y = 0; y < h; y += 1) {
    const tiles = canvas.lower.slice(y * w, (y + 1) * w);
    const upperTiles = canvas.upper.slice(y * w, (y + 1) * w);
    rows.push(upperTiles.some((tile) => tile !== -1) ? { tiles, upperTiles } : { tiles });
  }
  return { form: { id: spec.id, name: spec.name, w, h, stories: 1, kitId, doorAt, rows }, canvas, placements, roof, doorPart };
}

/** 합성 검사 결과 — 비어 있으면 통과. */
export interface GableFormAuditIssue {
  readonly kind: "floating-slope" | "enclosed-gap" | "narrow-wall" | "no-window";
  readonly x: number;
  readonly y: number;
  readonly detail: string;
}

/**
 * 합성한 박공 형태를 검사한다(2026-09-25 사용자 검토 규칙). 킷과 무관한 칸 모양 결함을 찾는다.
 *  · floating-slope: 사선 캡(/ \) 칸 밑이 비었는데 그 바깥쪽(/ 는 왼쪽, \ 는 오른쪽) 또는 위 칸이 지붕·벽으로 차 있다 —
 *    지붕 실루엣 **안쪽**에서 사선 뒤로 풀밭이 비친다(교차 박공 날개 옆 삼각 구멍). 처마 밑 캡은 밑이 비면 무조건.
 *  · enclosed-gap: 형태 바깥과 이어지지 않은 빈 칸(지붕에 난 구멍).
 *  · narrow-wall: 부품 벽 맨 아랫줄에서 보이는 벽 면이 1~2칸.
 *  · no-window: 3칸 이상 벽 면이 있는데 창이 하나도 없다.
 */
export function auditGableHouseForm(spec: GableHouseFormSpec, kitId: HouseKitId = "blue-stone"): GableFormAuditIssue[] {
  const { canvas, placements, roof, form } = composeInternal(spec, kitId, {});
  const issues: GableFormAuditIssue[] = [];
  const empty = (x: number, y: number): boolean =>
    x < 0 || y < 0 || x >= canvas.w || y >= canvas.h || canvas.lower[y * canvas.w + x] === -1;
  for (let y = 0; y < canvas.h; y += 1) {
    for (let x = 0; x < canvas.w; x += 1) {
      if (!empty(x, y)) continue;
      const upper = canvas.upper[y * canvas.w + x]!;
      if (upper === roof.underL || upper === roof.underR) {
        issues.push({ kind: "floating-slope", x, y, detail: "처마 밑 캡 뒤가 비었다" });
        continue;
      }
      const outside = upper === roof.capL ? x - 1 : upper === roof.capR ? x + 1 : undefined;
      if (outside === undefined) continue;
      if (!empty(outside, y) || !empty(x, y - 1)) {
        issues.push({ kind: "floating-slope", x, y, detail: `사선 캡(${upper === roof.capL ? "/" : "\\"}) 뒤가 비었는데 바깥이 막혔다` });
      }
    }
  }
  // 바깥과 이어진 빈 칸 — 테두리에서 빈 칸만 따라 번진다.
  const reach = new Set<number>();
  const queue: number[] = [];
  for (let y = 0; y < canvas.h; y += 1) {
    for (let x = 0; x < canvas.w; x += 1) {
      const border = x === 0 || y === 0 || x === canvas.w - 1 || y === canvas.h - 1;
      if (border && empty(x, y)) {
        reach.add(y * canvas.w + x);
        queue.push(y * canvas.w + x);
      }
    }
  }
  while (queue.length > 0) {
    const cell = queue.pop()!;
    const x = cell % canvas.w;
    const y = Math.floor(cell / canvas.w);
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
      if (nx < 0 || ny < 0 || nx >= canvas.w || ny >= canvas.h || !empty(nx, ny)) continue;
      const key = ny * canvas.w + nx;
      if (!reach.has(key)) {
        reach.add(key);
        queue.push(key);
      }
    }
  }
  for (let y = 0; y < canvas.h; y += 1) {
    for (let x = 0; x < canvas.w; x += 1) {
      if (empty(x, y) && !reach.has(y * canvas.w + x)) issues.push({ kind: "enclosed-gap", x, y, detail: "지붕·벽에 둘러싸인 빈 칸" });
    }
  }
  let wideFace = false;
  for (const placed of placements) {
    for (const run of visibleWallRuns(canvas, placed, placed.bottom)) {
      const width = run.x1 - run.x0 + 1;
      if (width >= 3) wideFace = true;
      else issues.push({ kind: "narrow-wall", x: run.x0, y: placed.bottom, detail: `보이는 벽 면이 ${width}칸` });
    }
  }
  const windowTile = HOUSE_KITS[kitId].windowTile;
  const windows = form.rows.reduce((sum, row) => sum + (row.upperTiles ?? []).filter((tile) => tile === windowTile).length, 0);
  if (wideFace && windows === 0) issues.push({ kind: "no-window", x: form.doorAt.x, y: form.doorAt.y, detail: "3칸 이상 벽 면에 창이 없다" });
  return issues;
}

/** id 로 합성. 박공 형태가 아니면 undefined. */
export function composeGableHouseFormById(id: string, kitId: HouseKitId, options: GableComposeOptions = {}): AuthoredHouseFormDef | undefined {
  const spec = findGableHouseFormSpec(id);
  return spec ? composeGableHouseForm(spec, kitId, options) : undefined;
}

/** 자리마다 다른 부품 씨앗 — 같은 자리·같은 형태면 같은 부품. */
export function gableAccentSeed(templateId: string, x: number, y: number, salt = 0): number {
  let h = 0x811c9dc5 ^ salt;
  for (const char of templateId) h = Math.imul(h ^ char.charCodeAt(0), 0x01000193) >>> 0;
  return mix(mix(h, x), y);
}

/** 킷과 무관한 치수 — 카탈로그 설명·슬롯 필터용(재료가 바뀌어도 칸 모양은 같다). */
export function gableHouseFormSize(spec: GableHouseFormSpec): { readonly w: number; readonly h: number } {
  const form = composeGableHouseForm(spec, "bright-plaster");
  return { w: form.w, h: form.h };
}

export { GABLE_HOUSE_FORM_SPECS };
