// 읍 광장의 놓기 규칙 — 광장은 깔끔하다: 가운데 기물 하나, 좌판·소품은 가장자리에, 가운데는 걷는 자리로 비우고, 기물끼리 겹치지 않는다.
//
// 왜(2026-11-15 실모델 확인 판 r5 «갈매기 포구»): 시공기가 광장에 기념 원주·우물·좌판을 놓은 뒤 조수가 그 위에 우물 하나·돌 수조 하나·좌판 셋을 더 찍었고
// 아무것도 막지 않았다 — 작은 광장에 물 기물 셋과 기둥·좌판이 겹쳐 섰다. 오너: 「그래 광장이 이렇게 깔끔해야 맞지」.
//
// 광장은 시공기가 맵에 적어 둔 로케이션(꼬리표 town-square, 테 줄까지 든 네모)으로 안다 — 타일을 다시 읽어 짐작하지 않는다. 그 표시가 없는 옛 맵은 그대로다.
// 순수 판정만 한다(찍기 도구 sharedObjectTools 가 거절하거나 가까운 자리로 옮긴다).
import type { GameMap, TilesetDef } from "@/project/types";

export const TOWN_SQUARE_TAG = "town-square";

interface Rect { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number }
export interface SquareZones {
  /** 테 줄까지 든 광장 네모. */
  readonly box: Rect;
  /** 테 안쪽 돌바닥. */
  readonly inner: Rect;
  /** 가운데(가운데 기물 하나만 서는 자리) — 안쪽에서 두 칸 들어간 네모. 광장이 작아 남지 않으면 null. */
  readonly centre: Rect | null;
}
export interface SquareRefusal { readonly code: "square-centrepiece" | "square-open" | "square-overlap"; readonly message: string }
type KitLike = { readonly id: string; readonly ai?: { readonly tags?: readonly string[] } | undefined; readonly rows?: readonly { readonly tiles?: readonly number[]; readonly upperTiles?: readonly number[] }[] };
type StampCell = { readonly dx: number; readonly dy: number; readonly foot?: boolean };

const inRect = (r: Rect, x: number, y: number): boolean => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;

/** 광장 네모 → 테 · 안 · 가운데. */
export function squareZones(box: Rect): SquareZones {
  const inner = { x0: box.x0 + 1, y0: box.y0 + 1, x1: box.x1 - 1, y1: box.y1 - 1 };
  const centre = { x0: inner.x0 + 2, y0: inner.y0 + 2, x1: inner.x1 - 2, y1: inner.y1 - 2 };
  return { box, inner, centre: centre.x0 <= centre.x1 && centre.y0 <= centre.y1 ? centre : null };
}

/** 맵에 적힌 읍 광장들. */
export function townSquares(map: Pick<GameMap, "locations">): SquareZones[] {
  return (map.locations ?? []).filter((l) => (l.tags ?? []).includes(TOWN_SQUARE_TAG) && l.w >= 5 && l.h >= 4)
    .map((l) => squareZones({ x0: l.x, y0: l.y, x1: l.x + l.w - 1, y1: l.y + l.h - 1 }));
}

/**
 * 가운데 기물 급(물 기물 · 기념물)인가 — 킷 목록에 적힌 꼬리표로만 안다(요청 글을 읽지 않는다). 아래층 그림이 없는 서는 킷만.
 * 버들항 목록의 꼬리표가 벌마다 달라(우물 water · 분수 «plaza fountain» · 석상 «lion statue» · 원주 monument) 꼬리표의 낱말로 본다.
 */
const CENTREPIECE_TAG = /^(water|monument)$|(^|\s)(fountain|well|statue|obelisk)$|(우물|분수|석상|원주)$/iu;
export function isCentrepieceKit(kit: KitLike | undefined): boolean {
  // 제 바닥을 가져오는 킷(강·운하 지형 조각도 꼬리표가 water 다)은 서는 기물이 아니다
  if ((kit?.rows ?? []).some((row) => (row.tiles ?? []).some((t) => t >= 0))) return false;
  return (kit?.ai?.tags ?? []).some((tag) => CENTREPIECE_TAG.test(tag));
}

/**
 * 서는 소품을 (x, y) 에 찍으면 광장 규칙을 어기는가. cells 는 찍기 도구의 발자국(그림이 있는 칸 · foot = 막는 칸).
 *  · 가운데 기물 급: 그 광장에 이미 가운데 기물이 있으면(가운데 자리에 무언가 섰거나 안쪽에 물 기물·기념물이 있다) 거절 — 한 광장에 하나.
 *  · 그 밖의 소품: 발이 가운데 자리나 테 줄에 서면 거절 — 가운데와 테는 걷는 자리다(가장자리 줄에만).
 *  · 어느 것이든 그림 칸이 광장의 다른 기물 그림과 겹치면 거절(replace 는 밑의 것을 지우므로 겹침이 아니고, 덮이는 기물은 «이미 선 가운데 기물»로 세지 않는다).
 */
export function squareRefusal(map: GameMap, tileset: Pick<TilesetDef, "structureKits"> | undefined, kit: KitLike | undefined,
  at: { readonly x: number; readonly y: number }, cells: readonly StampCell[], label: string, opts: { readonly replace?: boolean } = {}): SquareRefusal | undefined {
  const squares = townSquares(map);
  if (!squares.length) return undefined;
  const W = map.width;
  const feet = cells.filter((c) => c.foot).map((c) => ({ x: at.x + c.dx, y: at.y + c.dy }));
  const upper = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < W && y < map.height
    && ((map.upperTiles[y * W + x] ?? -1) >= 0 || (map.upperOverlayTiles?.[y * W + x] ?? -1) >= 0);
  for (const sq of squares) {
    if (!feet.some((f) => inRect(sq.box, f.x, f.y))) continue;
    const where = `square (${sq.box.x0},${sq.box.y0})–(${sq.box.x1},${sq.box.y1})`;
    // replace(밑의 것을 지우고 찍기)는 겹침이 아니다 — 가운데 기물을 다른 것으로 바꾸는 길을 남긴다
    const covered = (x: number, y: number): boolean => !!opts.replace && cells.some((c) => at.x + c.dx === x && at.y + c.dy === y);
    const overlaps = !opts.replace && cells.some((c) => inRect(sq.box, at.x + c.dx, at.y + c.dy) && upper(at.x + c.dx, at.y + c.dy));
    const overlapNo: SquareRefusal = { code: "square-overlap", message: `${label} at (${at.x},${at.y}) would overlap another piece on ${where}` };
    const onRing = feet.some((f) => inRect(sq.box, f.x, f.y) && !inRect(sq.inner, f.x, f.y));
    const inCentre = !!sq.centre && feet.some((f) => inRect(sq.centre!, f.x, f.y));
    if (isCentrepieceKit(kit)) {
      // 이미 선 가운데 기물: 가운데 자리의 그림 칸, 또는 안쪽 어디든 물 기물·기념물의 그림 칸
      const classTiles = new Set<number>();
      for (const k of tileset?.structureKits ?? []) if (isCentrepieceKit(k as KitLike)) for (const row of (k as KitLike).rows ?? []) for (const t of row.upperTiles ?? []) if (t >= 0) classTiles.add(t);
      let has = false;
      for (let y = sq.inner.y0; y <= sq.inner.y1 && !has; y += 1) for (let x = sq.inner.x0; x <= sq.inner.x1; x += 1) {
        if (covered(x, y)) continue;
        if ((sq.centre && inRect(sq.centre, x, y) && upper(x, y)) || classTiles.has(map.upperTiles[y * W + x] ?? -1)) { has = true; break; }
      }
      if (has) return { code: "square-centrepiece", message: `${label}: ${where} already has its centrepiece — one water feature or monument per square; put this one at another gathering spot` };
      if (overlaps) return overlapNo;
      if (onRing) return { code: "square-open", message: `${label} at (${at.x},${at.y}) would stand on the border paving of ${where}, the walkway round it` };
      continue;
    }
    if (overlaps) return overlapNo;
    // 그 밖의 소품은 가장자리 줄에: 발 하나는 안쪽 돌바닥의 맨 바깥 줄에 닿고, 가운데 자리와 테 줄은 밟지 않는다
    const onEdge = feet.some((f) => inRect(sq.inner, f.x, f.y) && (f.x === sq.inner.x0 || f.x === sq.inner.x1 || f.y === sq.inner.y0 || f.y === sq.inner.y1));
    if (inCentre || onRing || !onEdge) return { code: "square-open", message: `${label} at (${at.x},${at.y}) would stand ${onRing ? "on the border paving" : "in the middle"} of ${where}, kept open for walking — props go along its inner edges` };
  }
  return undefined;
}

/**
 * 찍기 도구용: (x, y) 가 광장 규칙을 어기면 그 까닭과, 규칙을 지키는 가장 가까운 자리(둘레 9칸 안, free = 그 밖의 놓기 규칙을 통과하는 자리)를 돌려준다.
 */
export function squareSpot(map: GameMap, tileset: Pick<TilesetDef, "structureKits"> | undefined, kit: KitLike | undefined,
  at: { readonly x: number; readonly y: number }, cells: readonly StampCell[], label: string,
  opts: { readonly replace?: boolean; readonly free: (x: number, y: number) => boolean }): (SquareRefusal & { readonly free?: { x: number; y: number } }) | undefined {
  const no = squareRefusal(map, tileset, kit, at, cells, label, opts);
  if (!no) return undefined;
  for (let r = 1; r <= 9; r += 1) for (let dy = -r; dy <= r; dy += 1) for (let dx = -r; dx <= r; dx += 1) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = at.x + dx, y = at.y + dy;
    if (opts.free(x, y) && !squareRefusal(map, tileset, kit, { x, y }, cells, label)) return { ...no, free: { x, y } };
  }
  return no;
}
