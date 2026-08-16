// benchmark/prompts.ts
// 벤치마크 고정(zero-shot) 영어 프롬프트(todo 3).
//
// 안티-게이밍 하드 규칙(plan todo 3 + test/benchmarkPrompts.test.ts가 강제):
//  - 어떤 프롬프트에도 ground-truth 타일 id를 넣지 않는다(정답 id만 금지 —
//    "tile id"라는 단어 자체는 허용, 모델이 id를 출력해야 하므로).
//  - easyrpg / combined_town·combined-town·combinedTown·combined town(대소문자
//    무시) / tileSize / tilesPerRow / 시트 기하 수치(480, 30, 16) 금지.
//  - 프롬프트는 동결 문자열: 상수 또는 ground-truth 데이터를 받지 않는 순수
//    빌더만 허용(id 보간 금지).
//
// 출력 JSON 형상 계약(contract.ts와 정합): detection → {tileIds}, construction
// → {lower, upper}, autotileGrid → {grid}, autotileCount → {count, types}.
// 아래 문자열을 바꿀 때는 반드시 test/benchmarkPrompts.test.ts를 함께 갱신하고
// PROMPT_VERSION을 올린다(고정 버전 계약).

/** 프롬프트 버전 — 프롬프트 문자열을 바꾸면 반드시 올린다. */
export const PROMPT_VERSION = 1;

/** d1 — 벽/바닥 감지(태스크 레벨 통합 안내; 실제 실행은 wall/floor 서브런). */
export function buildD1Prompt(): string {
  return "examine the tileset image and list every tile id that is a wall or floor tile, as a JSON object {tileIds: number[]}";
}

/** d1 wall 서브런 — 벽 타일 감지. */
export function buildD1WallPrompt(): string {
  return "examine the tileset image and list every tile id that is a wall tile, as a JSON object {tileIds: number[]}";
}

/** d1 floor 서브런 — 바닥 타일 감지. */
export function buildD1FloorPrompt(): string {
  return "examine the tileset image and list every tile id that is a floor tile, as a JSON object {tileIds: number[]}";
}

/** d2 — 지붕 타일 감지. */
export function buildD2RoofPrompt(): string {
  return "examine the tileset image and list every tile id that is a roof tile, as a JSON object {tileIds: number[]}";
}

/**
 * d3 — 지붕+벽 조합(건설). 12x10 그리드 위에 집을 짓는다.
 * 벽은 표시된 바닥 영역 경계를 따라 lower 레이어에, 지붕은 그 벽 경계의 맨 윗줄
 * 위(같은 칸) upper 레이어에 놓는다 — scoringConstruction roofSupport 계약과 정합.
 */
export function buildD3HousePrompt(): string {
  return "build a house on the given 12x10 grid: place wall tiles in the lower layer along the boundary of the marked floor region, and place roof tiles in the upper layer on the top row of that wall boundary, as a JSON object {lower, upper}";
}

/** d4 — 창문 타일 감지. */
export function buildD4WindowPrompt(): string {
  return "examine the tileset image and list every tile id that is a window tile, as a JSON object {tileIds: number[]}";
}

/** d5 — 나무 하위+상위 레이어 조합. trunk는 lower, canopy는 upper, 같은 좌표. */
export function buildD5TreePrompt(): string {
  return "place exactly 4 trees on the given grid: for each tree, put the trunk tile in the lower layer and the canopy tile in the upper layer at the same coordinate, as a JSON object {lower, upper}";
}

/** d6a — 오토타일 구현(L자형 흙길; 경로 칸은 두 번째 이미지에 표시). */
export function buildD6aAutotileGridPrompt(): string {
  return "implement an L-shaped dirt path on the given grid: the path cells are marked in the second image; use the correct edge and corner tiles, as a JSON object {grid}";
}

/** d6b — 오토타일 종류 세기. */
export function buildD6bAutotileCountPrompt(): string {
  return "how many terrain autotile types does this tileset have? list them by name, as a JSON object {count, types}";
}

/** d7 — 울타리 구현(표시된 정원 사각형 경계). */
export function buildD7FencePrompt(): string {
  return "fence the marked garden rectangle on the given grid: place fence tiles along the rectangle boundary, as a JSON object {lower, upper}";
}
