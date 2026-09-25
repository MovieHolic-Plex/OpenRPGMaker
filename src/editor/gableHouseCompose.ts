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

import { CHIMNEY_TILE, HOUSE_KITS, type HouseKit, type HouseKitId } from "@/editor/houseKit";
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
}

/** 불투명 칸 — 하위를 칠하고 앞서 얹은 상위(캡·창)를 지운다. */
function paint(canvas: Canvas, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) return;
  canvas.lower[y * canvas.w + x] = tile;
  canvas.upper[y * canvas.w + x] = -1;
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
  if (kit.postColumn && offset % kit.postColumn.every === 0) return kit.postColumn.tiles[role];
  return slice[1];
}

function isPostOffset(kit: HouseKit, offset: number, width: number): boolean {
  return kit.postColumn !== undefined && offset > 0 && offset < width - 1 && offset % kit.postColumn.every === 0;
}

interface PartPlacement {
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
    for (let dx = 0; dx < part.w; dx += 1) paint(canvas, x + dx, y, wallTileAt(kit, role, dx, part.w));
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

function drawWindows(canvas: Canvas, kit: HouseKit, placed: PartPlacement, doorX: number | undefined): void {
  const { part, x, wallTop } = placed;
  if (part.wall === "low") return;
  const y = wallTop + 1;
  for (let dx = 1; dx < part.w - 1; dx += 1) {
    const cx = x + dx;
    if (doorX !== undefined && Math.abs(cx - doorX) <= 1) continue;
    if (isPostOffset(kit, dx, part.w)) continue;
    // 킷 창 규칙과 같은 간격(두 칸 띄움, 왼쪽 두 번째 칸부터).
    if ((dx - 1) % 3 !== 0) continue;
    overlay(canvas, cx, y, kit.windowTile);
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
  const kit = HOUSE_KITS[kitId];
  const roof = gableRoofMaterialForKit(kit);
  const minX = Math.min(...spec.parts.map((part) => part.x));
  const maxX = Math.max(...spec.parts.map((part) => part.x + part.w - 1));
  const minY = Math.min(...spec.parts.map(partTop));
  const maxY = Math.max(...spec.parts.map((part) => part.bottom));
  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const canvas: Canvas = { w, h, lower: new Array<number>(w * h).fill(-1), upper: new Array<number>(w * h).fill(-1) };
  const placements: PartPlacement[] = spec.parts
    .map((part) => ({ part, x: part.x - minX, bottom: part.bottom - minY, wallTop: part.bottom - minY - wallRowsOf(part) + 1 }))
    .sort((a, b) => a.bottom - b.bottom || (a.part.kind === b.part.kind ? 0 : a.part.kind === "block" ? -1 : 1));
  const doorPart = placements.find((placed) => placed.part.door === true)
    ?? placements.reduce((best, placed) => (placed.bottom > best.bottom || (placed.bottom === best.bottom && placed.part.w > best.part.w) ? placed : best));
  const doorAt = { x: doorPart.x + doorOffset(kit, doorPart.part), y: doorPart.bottom };
  const apexes: { x: number; y: number }[] = [];
  for (const placed of placements) {
    if (placed.part.kind === "front") apexes.push(drawFrontRoof(canvas, kit, roof, placed as PartPlacement & { readonly part: GableFrontPart }));
    else drawBlockRoof(canvas, roof, placed as PartPlacement & { readonly part: GableBlockPart });
    drawWalls(canvas, kit, placed);
    drawWindows(canvas, kit, placed, placed === doorPart ? doorAt.x : undefined);
  }
  if (options.accentSeed !== undefined) {
    addAccents({ canvas, kit, roof, placements, apexes, doorAt, doorPart }, options.accentSeed >>> 0);
  }
  const rows: AuthoredHouseFormRow[] = [];
  for (let y = 0; y < h; y += 1) {
    const tiles = canvas.lower.slice(y * w, (y + 1) * w);
    const upperTiles = canvas.upper.slice(y * w, (y + 1) * w);
    rows.push(upperTiles.some((tile) => tile !== -1) ? { tiles, upperTiles } : { tiles });
  }
  return { id: spec.id, name: spec.name, w, h, stories: 1, kitId, doorAt, rows };
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
