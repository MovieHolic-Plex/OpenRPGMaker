// src/harnesses/_core/workshop/objectShape.ts
/**
 * 새 기물(조수 요청·공방 새 정의)의 크기·윗면 규칙 — 맵 기물(map-objects)과 실내 기물(interior-props) 실행기가 같이 쓴다.
 *
 * 왜(2026-10-21 objectgen 적대 VQA): 1×1 로 부탁한 벌통이 두 칸 높이로 나왔고(캔버스가 발밑 + 위로 16px 이라 꽉 채웠다),
 * 소품들이 앞면만 크고 윗면이 얇거나 없었다. 그래서
 * - 지시문은 칠할 크기(폭·높이 px)와 윗면 행 수(칠한 높이의 25~33%)를 숫자로 준다.
 * - 깨짐 검사가 칠한 범위를 재 요청 크기와 다르면 그 답을 돌려보내 다시 그리게 한다(폭이 한 칸 모자라거나 높이가 한참 낮으면).
 * - 하네스 판정이 검수자가 잰 윗면 행 수를 같은 하한으로 본다.
 */
import type { Grid, WorkshopItem } from "./types";

export const STANDING_KINDS: ReadonlySet<string> = new Set(["floor", "wall"]);
/** 윗면 = 칠한 높이의 이 비율 이상(사용자 기준 25~33%) */
export const TOP_SHARE_MIN = 0.25;
export const TOP_SHARE_MAX = 0.33;
/** 높이가 요청보다 이만큼(px) 넘게 낮으면 크기가 다르다 — 위쪽 둥근 끝·가는 꼭대기 몇 줄은 봐준다. */
const HEIGHT_SLACK = 10;

export type PaintedBounds = { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number; readonly width: number; readonly height: number };

export function paintedBounds(grid: Grid): PaintedBounds | null {
  let x0 = grid.width, y0 = grid.height, x1 = -1, y1 = -1;
  for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
    if (grid.cells[y * grid.width + x] === null) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}

/** 요청한 칠할 크기(px): 폭 = 발밑 칸 폭, 높이 = 발밑 칸 + 위로 솟는 px(캔버스에서 위 패딩을 뺀 것). */
export function requestedSize(item: WorkshopItem): { readonly width: number; readonly height: number; readonly tilesW: number; readonly footRows: number; readonly risePx: number } {
  return { width: item.width, height: item.height - item.padTop, tilesW: Math.round(item.width / 16), footRows: item.footRows ?? 1, risePx: item.risePx ?? 0 };
}

/** 윗면 최소·권장 행 수 — 칠한 높이(없으면 요청 높이) 기준. 16px → 4~5행, 32px → 8~10행. */
export function topRowsRange(height: number): { readonly min: number; readonly max: number } {
  const min = Math.max(3, Math.round(height * TOP_SHARE_MIN));
  return { min, max: Math.max(min, Math.ceil(height * TOP_SHARE_MAX)) };
}

/** 지시문 한 단락: 크기와 윗면 숫자. */
export function shapeBrief(item: WorkshopItem): string {
  const size = requestedSize(item);
  const standing = STANDING_KINDS.has(item.kind);
  const top = topRowsRange(size.height);
  const lines = [
    "## 크기 — 요청한 칸 수 그대로 (재서 지킨다)",
    `- 발밑 ${size.tilesW}×${size.footRows}칸${size.risePx ? ` + 위로 ${size.risePx}px` : ""} → 칠할 범위 폭 약 ${size.width}px · 높이 약 ${size.height}px. 캔버스 맨 아래 줄에서 위로 ${size.height}px 안에 그린다.`,
    `- 요청보다 작게 그리지 않는다(높이 ${Math.max(8, size.height - HEIGHT_SLACK)}px 미만이면 떨어진다${size.tilesW >= 2 ? `, 폭은 ${(size.tilesW - 1) * 16 + 1}px 이상` : ""}). 위로 더 솟게 그리지도 않는다(캔버스 위 패딩은 비운다).`,
    size.risePx === 0 && standing ? "- 이 물건은 발밑 칸 안에 다 들어가는 크기다 — 한 칸이면 한 칸 높이(16px)로 그린다. 두 칸 높이로 늘리지 않는다." : "",
  ];
  if (standing) {
    lines.push(
      "",
      "## 윗면 — 위가 있는 물건은 위에서 내려다본 면을 크게",
      `- 뚜껑·지붕·윗판·좌판·입구처럼 위가 있는 물건은 그 윗면을 칠한 높이의 25~33% 로 그린다: 지금 크기면 **${top.min}~${top.max}행**. ${top.min}행 미만이면 정면 아이콘으로 보고 떨어진다.`,
      "- 윗면은 위에서 본 면이라 앞면보다 밝거나 다른 색 띠로 넓게, 그 아래에 앞 모서리 선(1행)을 긋고 앞면(남쪽 면)을 둔다. 앞면을 키워 윗면을 1~2행 띠로 깎지 않는다.",
      "- 둥근 물건(통·항아리·어항·벌통 뚜껑)은 윗면이 타원이다 — 위아래로 좁아지는 타원을 위 행수만큼.",
      "- 윗면이 없는 물건(나무·식물·사람 모양 조각상·가는 기둥·막대)만 예외 — 받침대가 있으면 받침대 윗면은 그린다. 이때 topRows 는 null.",
    );
  }
  return lines.filter((line) => line !== "").join("\n");
}

/** 칠한 크기 검사 — 새 기물·서 있는 물건만(있는 그림을 고치는 판은 지금 그림 크기를 따른다). 문제 글 목록. */
export function sizeProblems(item: WorkshopItem, grid: Grid): string[] {
  if (!item.isNew || !STANDING_KINDS.has(item.kind)) return [];
  const bounds = paintedBounds(grid);
  if (!bounds) return [];
  const size = requestedSize(item);
  const problems: string[] = [];
  const minHeight = Math.max(8, size.height - HEIGHT_SLACK);
  if (bounds.height < minHeight) {
    problems.push(`크기: 칠한 높이 ${bounds.height}px — 요청 크기(발밑 ${size.tilesW}×${size.footRows}칸${size.risePx ? ` + 위로 ${size.risePx}px` : ""})는 높이 약 ${size.height}px 다. ${minHeight}px 이상으로 캔버스를 채워 다시 그려라`);
  }
  if (size.tilesW >= 2 && bounds.width <= (size.tilesW - 1) * 16) {
    problems.push(`크기: 칠한 폭 ${bounds.width}px — 요청이 ${size.tilesW}칸 폭(${size.width}px)이다. ${(size.tilesW - 1) * 16 + 1}px 이상 넓게 다시 그려라`);
  }
  return problems;
}

/** 하네스 판정: 검수자가 잰 윗면 행 수가 하한 미달이면 불합격(THIN). 윗면 없는 물건(top_rows null + 「해당 없음」)은 그대로. */
export function topShareGate(item: WorkshopItem, verdict: { verdict: "PASS" | "FAIL"; topRows: number | null; top: string }): { min: number; failed: boolean } {
  const { min } = topRowsRange(requestedSize(item).height);
  if (!item.isNew || !STANDING_KINDS.has(item.kind) || verdict.verdict !== "PASS") return { min, failed: false };
  if (verdict.topRows === null) return { min, failed: !/해당\s*없음/u.test(verdict.top) };
  return { min, failed: verdict.topRows < min };
}
