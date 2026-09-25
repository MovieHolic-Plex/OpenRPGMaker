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

import { HOUSE_KITS, type HouseKit, type HouseKitId } from "@/editor/houseKit";
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
}

export const GABLE_ROOF_BLUE: GableRoofMaterial = {
  lit: 406, dark: 407, top: 436, body: 437, eave: 467, capL: 356, capR: 357, underL: 386, underR: 387,
};
export const GABLE_ROOF_ORANGE: GableRoofMaterial = {
  lit: 376, dark: 377, top: 374, body: 375, eave: 405, capL: 354, capR: 355, underL: 384, underR: 385,
};

export function gableRoofMaterialForKit(kit: HouseKit): GableRoofMaterial {
  return kit.roof.kind === "blue" ? GABLE_ROOF_BLUE : GABLE_ROOF_ORANGE;
}

/** 박공 형태가 칠하는 모든 지붕 타일 — 감지·보호 쪽이 집 칸으로 세도록 공개한다. */
export function gableRoofTiles(): readonly number[] {
  return [GABLE_ROOF_BLUE, GABLE_ROOF_ORANGE].flatMap((material) => Object.values(material));
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

function drawFrontRoof(canvas: Canvas, kit: HouseKit, roof: GableRoofMaterial, placed: PartPlacement & { readonly part: GableFrontPart }): void {
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

/**
 * 박공 조합 형태 하나를 킷 재료로 합성한다. 결정론적 — 같은 spec·kit 이면 같은 셀.
 * id 는 spec id 그대로라 author_house·마을·감지가 같은 이름을 본다.
 */
export function composeGableHouseForm(spec: GableHouseFormSpec, kitId: HouseKitId): AuthoredHouseFormDef {
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
  for (const placed of placements) {
    if (placed.part.kind === "front") drawFrontRoof(canvas, kit, roof, placed as PartPlacement & { readonly part: GableFrontPart });
    else drawBlockRoof(canvas, roof, placed as PartPlacement & { readonly part: GableBlockPart });
    drawWalls(canvas, kit, placed);
    drawWindows(canvas, kit, placed, placed === doorPart ? doorAt.x : undefined);
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
export function composeGableHouseFormById(id: string, kitId: HouseKitId): AuthoredHouseFormDef | undefined {
  const spec = findGableHouseFormSpec(id);
  return spec ? composeGableHouseForm(spec, kitId) : undefined;
}

/** 킷과 무관한 치수 — 카탈로그 설명·슬롯 필터용(재료가 바뀌어도 칸 모양은 같다). */
export function gableHouseFormSize(spec: GableHouseFormSpec): { readonly w: number; readonly h: number } {
  const form = composeGableHouseForm(spec, "bright-plaster");
  return { w: form.w, h: form.h };
}

export { GABLE_HOUSE_FORM_SPECS };
