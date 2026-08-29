// project/footprint.ts
// 다중 타일 캐릭터의 발자국 프리미티브 — 발밑 앵커, 순수 함수.
// 스펙 docs/superpowers/specs/2026-08-29-multi-tile-character-footprint-design.md §1.
//
// ⚠ project/spatialPlacements.ts 의 SpatialFootprint 와 혼동하지 말 것.
// 저쪽은 (x,y) 가 좌상단이고 우·하로 전개한다(농장 건물·집 장식).
// 이쪽은 (x,y) 가 발밑 칸이라 위·양옆으로 자란다(캐릭터).
// 이름이 다른 이유가 이것이므로 두 규약을 섞지 말 것.

import type { CharacterFootprint, FootprintRect } from "./types";

export const UNIT_FOOTPRINT: CharacterFootprint = { width: 1, height: 1 };

/**
 * 축 상한. spatialPlacements 의 16보다 보수적이다 — 그 크기의 "캐릭터"가
 * 걸어다니면 경로탐색이 사실상 항상 실패한다. 건물은 안 움직이므로 상한이 다르다.
 * 면적 상한 상수는 두지 않는다: 축 8이면 최대 면적 64가 이미 여기서 파생된다.
 */
export const CHARACTER_FOOTPRINT_AXIS_MAX = 8;

export const CHARACTER_SCALE_MIN = 0.25;
export const CHARACTER_SCALE_MAX = 8;

/**
 * 발밑 앵커 (x,y) 와 크기로 **몸 사각**을 만든다. 네 값 모두 포함(inclusive).
 *
 * 몸 사각이 지배하는 것: 조사·접촉 발동, 전투 히트, 점유, 렌더 중앙, depth, 편집 클릭.
 * **통행 차단은 이 사각이 아니다** — {@link passageBounds} 가 하단 일부만 쓴다.
 * 2차 스펙 docs/superpowers/specs/2026-08-30-character-body-vs-passage-rect-design.md §1.
 *
 * 축은 1 미만이면 1 로 올린다. 정규화(normalizeCharacterFootprint)는 runtimeEventView
 * 한 곳에만 있고 이 함수는 원시 CharacterFootprint 를 받으므로, 폭 0 이 그대로
 * 들어오면 left > right 인 역사각이 되고 파생 함수들의 셀 루프가 0회 돌아
 * **검사 없이 통과**한다(벽을 지나간다). 통행 판정이 fail-open 하는 것보다
 * 1x1 로 굳어 막히는 쪽이 안전하므로 여기서 닫는다.
 */
export function footprintBounds(x: number, y: number, fp: CharacterFootprint): FootprintRect {
  const width = safeAxis(fp.width);
  const height = safeAxis(fp.height);
  const left = x - Math.floor((width - 1) / 2);
  return {
    left,
    right: left + width - 1,
    top: y - (height - 1),
    bottom: y,
  };
}

/**
 * **통행 차단 사각** — 몸 사각의 하단 `passRows` 행. left·right·bottom 은 몸과 같고
 * top 만 올라온다. 3x3 몸에 passRows 1 이면 발밑 한 줄만 막히고 상체 두 줄은 지나갈 수 있다.
 *
 * `passRows` 가 몸 높이와 같으면(= 정규화 기본값) **정확히 footprintBounds 와 같다.**
 * 그 항등이 이 설계의 안전줄이다 — passRows 없는 기존 데이터는 동작이 안 바뀐다.
 *
 * ⚠ 하단 고정이다. "공중에 뜬 대상의 가운데만 히트" 는 표현할 수 없다(스펙 범위 밖).
 */
export function passageBounds(
  x: number,
  y: number,
  fp: CharacterFootprint,
  passRows: number
): FootprintRect {
  const body = footprintBounds(x, y, fp);
  const rows = safePassRows(passRows, body.bottom - body.top + 1);
  return { ...body, top: body.bottom - (rows - 1) };
}

/** 사각 안으로 점을 끌어당긴다 — 밖이면 최근접 모서리 칸, 안이면 그 점 자신. */
export function nearestCellInRect(
  rect: FootprintRect,
  px: number,
  py: number
): { readonly x: number; readonly y: number } {
  return {
    x: Math.min(rect.right, Math.max(rect.left, px)),
    y: Math.min(rect.bottom, Math.max(rect.top, py)),
  };
}

/** 한 칸을 사각으로. 점 질의를 사각 질의에 위임할 때 쓴다. */
export function pointRect(x: number, y: number): FootprintRect {
  return { left: x, right: x, top: y, bottom: y };
}

/** AABB 겹침. 3x3 대 3x3 도 81셀이 아니라 4비교로 끝난다. */
export function rectsOverlap(a: FootprintRect, b: FootprintRect): boolean {
  return a.left <= b.right && b.left <= a.right && a.top <= b.bottom && b.top <= a.bottom;
}

export function footprintContains(
  x: number,
  y: number,
  fp: CharacterFootprint,
  px: number,
  py: number
): boolean {
  return rectsOverlap(footprintBounds(x, y, fp), pointRect(px, py));
}

/**
 * 발자국이 덮는 모든 칸. 판정에는 rectsOverlap 을 쓰고, 이건 순회가 필요할 때만.
 *
 * ⚠ 이름에 character 가 붙은 이유: spatialPlacements.ts 도 `footprintCells` 를
 * **export** 하는데 앵커가 좌상단이고 orientation 인자를 받는다. 같은 이름이면
 * grep 과 자동 import 가 앵커 규약이 반대인 함수를 집어온다.
 */
export function characterFootprintCells(
  x: number,
  y: number,
  fp: CharacterFootprint
): { readonly x: number; readonly y: number }[] {
  return rectCells(footprintBounds(x, y, fp));
}

/**
 * 사각이 덮는 모든 칸. 통행 사각처럼 이미 사각으로 들고 있는 값을 순회할 때 쓴다
 * (그걸 다시 크기+앵커로 되돌려 characterFootprintCells 에 넣으면 top 이 복원되지 않는다).
 */
export function rectCells(rect: FootprintRect): { readonly x: number; readonly y: number }[] {
  const cells: { x: number; y: number }[] = [];
  for (let cy = rect.top; cy <= rect.bottom; cy += 1) {
    for (let cx = rect.left; cx <= rect.right; cx += 1) cells.push({ x: cx, y: cy });
  }
  return cells;
}

export function normalizeCharacterFootprint(value: unknown): CharacterFootprint {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return UNIT_FOOTPRINT;
  const raw = value as { width?: unknown; height?: unknown };
  return { width: clampAxis(raw.width), height: clampAxis(raw.height) };
}

/**
 * 통행 차단 행 수를 굳힌다. 비정규(정수 아님·0 이하·NaN·문자열·null)면 **몸 높이 전체**다.
 *
 * fail-closed 방향이 위쪽인 이유: 행 수가 적을수록 통행이 열린다. 잘못된 값이 벽을 여는
 * 것보다 다 막는 쪽이 안전하고, 게다가 전체 높이는 곧 **생략 시 항등 기본값**이라
 * 실수와 기본값이 같은 곳으로 수렴한다. 1차 safeAxis 가 폭 0 을 1 로 올린 것과 같은 방향이다.
 */
export function normalizePassRows(value: unknown, height: number): number {
  const max = clampAxis(height);
  // 1 미만은 max 로 올린다. **1 로 클램프하면 안 된다** — 0 이나 -3 이 "발밑 한 줄만
  // 막힘" 이 되어 3x3 의 상체 두 줄이 조용히 열린다. 그게 fail-open 이다.
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) return max;
  return Math.min(max, value);
}

export function normalizeCharacterScale(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return 1;
  return Math.max(CHARACTER_SCALE_MIN, Math.min(CHARACTER_SCALE_MAX, value));
}

function clampAxis(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return 1;
  return Math.max(1, Math.min(CHARACTER_FOOTPRINT_AXIS_MAX, value));
}

/**
 * 이미 CharacterFootprint 로 타이핑된 값의 축을 최소 1 로 굳힌다.
 * clampAxis 와 달리 상한을 걸지 않는다 — 정규화를 안 거친 큰 값은 경로탐색이
 * 느려질 뿐이지만, 1 미만은 통행 판정을 무력화하므로 그것만 막는다.
 */
function safeAxis(value: number): number {
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1;
}

/**
 * 이미 number 로 타이핑된 통행 행 수를 [1, height] 로 굳힌다.
 * normalizePassRows 와 달리 정규화를 안 거친 경로(passageBounds 직접 호출)를 위한 것이고,
 * 비정규는 height 로 올린다 — 위쪽이 fail-closed 다.
 */
function safePassRows(value: number, height: number): number {
  // normalizePassRows 와 같은 이유로 1 미만은 height 로 **올린다**(1 로 클램프 금지).
  if (!Number.isFinite(value) || value < 1) return height;
  return Math.min(height, Math.floor(value));
}
