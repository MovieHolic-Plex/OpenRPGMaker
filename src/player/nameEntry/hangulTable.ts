// player/nameEntry/hangulTable.ts
// RM2K3 스타일 이름 입력 문자표(순수 로직). DOM 의존성이 없어 단위 테스트 대상.
// 한글은 초성×중성 조합으로 완성형 음절을 생성하고, 영문 페이지는 대/소문자·숫자·기호를 제공한다.

// 한글 완성형 음절 코드 = 0xAC00 + (초성*21 + 중성)*28 + 종성.
const HANGUL_BASE = 0xac00;
const JUNGSEONG_COUNT = 21;
const JONGSEONG_COUNT = 28;

// 기본 초성 14자(ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ)의 초성 인덱스.
const BASIC_CHOSEONG_INDEXES = [0, 2, 3, 5, 6, 7, 9, 11, 12, 14, 15, 16, 17, 18] as const;
// 기본 중성 10자(ㅏㅑㅓㅕㅗㅛㅜㅠㅡㅣ)의 중성 인덱스.
const BASIC_JUNGSEONG_INDEXES = [0, 2, 4, 6, 8, 12, 13, 17, 18, 20] as const;

export type NameEntryPageId = "hangul" | "latin";

export interface NameEntryCharPage {
  readonly id: NameEntryPageId;
  readonly label: string;
  // 그리드 행 목록. 각 행은 문자(그리드 셀) 배열.
  readonly rows: readonly (readonly string[])[];
}

export interface GridCursor {
  readonly row: number;
  readonly col: number;
}

function composeSyllable(choseongIndex: number, jungseongIndex: number): string {
  const code = HANGUL_BASE + (choseongIndex * JUNGSEONG_COUNT + jungseongIndex) * JONGSEONG_COUNT;
  return String.fromCharCode(code);
}

function buildHangulRows(): readonly (readonly string[])[] {
  return BASIC_CHOSEONG_INDEXES.map((choseongIndex) =>
    BASIC_JUNGSEONG_INDEXES.map((jungseongIndex) => composeSyllable(choseongIndex, jungseongIndex))
  );
}

function chunk<T>(values: readonly T[], size: number): readonly (readonly T[])[] {
  const rows: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    rows.push(values.slice(index, index + size));
  }
  return rows;
}

const LATIN_UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LATIN_LOWER = "abcdefghijklmnopqrstuvwxyz".split("");
const LATIN_EXTRA = "0123456789 -.".split(""); // 숫자 + 공백 + 하이픈 + 마침표

function buildLatinRows(): readonly (readonly string[])[] {
  return [
    ...chunk(LATIN_UPPER, 13),
    ...chunk(LATIN_LOWER, 13),
    LATIN_EXTRA,
  ];
}

export const NAME_ENTRY_PAGES: readonly NameEntryCharPage[] = [
  { id: "hangul", label: "가나다", rows: buildHangulRows() },
  { id: "latin", label: "ABC", rows: buildLatinRows() },
];

export function pageById(id: NameEntryPageId): NameEntryCharPage {
  return NAME_ENTRY_PAGES.find((page) => page.id === id) ?? NAME_ENTRY_PAGES[0];
}

// 커서 위치의 문자를 반환한다. 범위를 벗어나면 빈 문자열.
export function charAt(page: NameEntryCharPage, cursor: GridCursor): string {
  return page.rows[cursor.row]?.[cursor.col] ?? "";
}

// 방향키로 커서를 이동한다. 행 길이가 달라도 항상 유효한 셀을 가리키도록 열을 clamp 한다.
export function moveCursor(
  page: NameEntryCharPage,
  cursor: GridCursor,
  direction: "up" | "down" | "left" | "right"
): GridCursor {
  const rowCount = page.rows.length;
  if (rowCount === 0) return { row: 0, col: 0 };
  let { row, col } = cursor;
  if (direction === "up") row = (row + rowCount - 1) % rowCount;
  else if (direction === "down") row = (row + 1) % rowCount;
  const rowLength = Math.max(1, page.rows[row]?.length ?? 1);
  if (direction === "left") col = (col + rowLength - 1) % rowLength;
  else if (direction === "right") col = (col + 1) % rowLength;
  col = Math.min(col, rowLength - 1);
  return { row, col };
}

// 이름 문자열을 최대 길이(코드포인트 기준)로 자른다.
export function clampName(name: string, maxLength: number): string {
  const limit = clampMaxLength(maxLength);
  return Array.from(name).slice(0, limit).join("");
}

// 이름에 문자를 덧붙이되 최대 길이를 넘지 않게 한다.
export function appendChar(name: string, char: string, maxLength: number): string {
  return clampName(`${name}${char}`, maxLength);
}

// 마지막 글자를 지운다(백스페이스).
export function deleteLastChar(name: string): string {
  return Array.from(name).slice(0, -1).join("");
}

// 최대 길이를 1~12 범위로 제한한다(기본 6).
export function clampMaxLength(maxLength: number): number {
  if (!Number.isFinite(maxLength)) return 6;
  return Math.max(1, Math.min(12, Math.trunc(maxLength)));
}

export const DEFAULT_NAME_MAX_LENGTH = 6;
