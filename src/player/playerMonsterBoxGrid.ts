/**
 * 보관함(PC) 화면의 격자 커서 이동. 첫 줄은 [◀ | 상자 이름 | ▶] 세 칸, 그 아래 5줄은 6칸씩이다.
 * 목록 번호(0..32)와 화면 칸을 오가는 순수 함수만 둔다 — 컨트롤러가 키를 받아 여기로 묻는다.
 */
import { MONSTER_BOX_COLUMNS, MONSTER_BOX_ROWS, MONSTER_BOX_SIZE } from "@/project/monsterBox";

export const BOX_HEADER_ENTRY_COUNT = 3;
export const BOX_ENTRY_COUNT = BOX_HEADER_ENTRY_COUNT + MONSTER_BOX_SIZE;
/** 머리 줄 세 칸이 차지하는 첫 열(◀=0, 이름=1, ▶=5). */
const HEADER_COLUMNS = [0, 1, MONSTER_BOX_COLUMNS - 1] as const;

export type BoxCursor = { readonly row: number; readonly col: number };
export type BoxDirection = "up" | "down" | "left" | "right";

/** 목록 번호 → 격자 위치(머리 줄은 row 0, col 은 그 칸이 시작하는 열). */
export function boxCursorOf(index: number): BoxCursor {
  if (index < BOX_HEADER_ENTRY_COUNT) return { row: 0, col: HEADER_COLUMNS[Math.max(0, index)]! };
  const cell = index - BOX_HEADER_ENTRY_COUNT;
  return { row: 1 + Math.floor(cell / MONSTER_BOX_COLUMNS), col: cell % MONSTER_BOX_COLUMNS };
}

/** 격자 위치 → 목록 번호. 머리 줄은 가장 가까운 칸. */
export function boxIndexAt(row: number, col: number): number {
  if (row <= 0) {
    let best = 0;
    HEADER_COLUMNS.forEach((c, i) => { if (Math.abs(c - col) < Math.abs(HEADER_COLUMNS[best]! - col)) best = i; });
    return best;
  }
  return BOX_HEADER_ENTRY_COUNT + (row - 1) * MONSTER_BOX_COLUMNS + Math.max(0, Math.min(MONSTER_BOX_COLUMNS - 1, col));
}

/**
 * 한 칸 이동. 왼쪽 끝에서 더 왼쪽 / 위쪽 끝에서 더 위는 null(바깥으로 나감 — 호출자가 레일·닫기를 정한다).
 * 아래쪽 끝에서 더 아래는 머리 줄로 돌아간다. 오른쪽 끝에서 더 오른쪽은 제자리(null 아님).
 */
export function moveBoxCursor(index: number, direction: BoxDirection): number | null {
  const { row, col } = boxCursorOf(index);
  if (row === 0) {
    if (direction === "down") return boxIndexAt(1, col);
    if (direction === "up") return null;
    const at = Math.max(0, HEADER_COLUMNS.indexOf(col as 0 | 1 | 5));
    if (direction === "left") return at === 0 ? null : at - 1;
    return Math.min(HEADER_COLUMNS.length - 1, at + 1);
  }
  switch (direction) {
    case "up": return row === 1 ? boxIndexAt(0, col) : boxIndexAt(row - 1, col);
    case "down": return row === MONSTER_BOX_ROWS ? boxIndexAt(0, col) : boxIndexAt(row + 1, col);
    case "left": return col === 0 ? null : boxIndexAt(row, col - 1);
    case "right": return col === MONSTER_BOX_COLUMNS - 1 ? index : boxIndexAt(row, col + 1);
  }
}

/** 목록 번호가 상자 칸(0..29)이면 그 칸 번호, 머리 줄이면 -1. */
export function boxCellOfIndex(index: number): number {
  return index >= BOX_HEADER_ENTRY_COUNT ? index - BOX_HEADER_ENTRY_COUNT : -1;
}
