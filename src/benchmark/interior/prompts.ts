// benchmark/interior/prompts.ts
// 동결(zero-shot) 영어 프롬프트.
//
// 안티-게이밍 하드 규칙(test/interiorBenchPrompts.test.ts 가 강제):
//  - 정답 타일 id 를 프롬프트에 넣지 않는다. 실제로는 0..479 범위의 정수 자체를
//    쓰지 않는다("tile id" 라는 단어는 허용 — 모델이 id 를 출력해야 하므로).
//  - easyrpg / interior chipset / tileSemantics / harness / tilesPerRow /
//    tileSize / 시트 기하 수치(480, 30, 16) 금지.
//  - 모든 빌더는 인자를 받지 않는 순수 함수다. 인자가 없으면 정답이 보간될 길도 없다.
//
// 프롬프트 문자열을 바꾸면 INTERIOR_PROMPT_VERSION 을 올린다 — 그래야 manifest
// 해시가 바뀌어 옛 점수와 새 점수가 섞이지 않는다.

export const INTERIOR_PROMPT_VERSION = 1;

const JSON_SET = 'Answer with a JSON object {"tileIds": number[]} listing the tile ids in ascending order.';
const JSON_GRID =
  'Answer with a JSON object {"lower": number[][], "upper": number[][]}, both the same width and height as the grid shown. Use -1 for a cell you leave empty.';

/** 일반 벽 인식 — 이 시트에서 "벽처럼 보이는" 것 전부. */
export function buildWallAnyPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that is a wall. ${JSON_SET}`;
}

/** 정본 주택 셸 벽 — 일반 벽 인식과의 격차가 이 벤치마크의 헤드라인 지표다. */
export function buildHouseShellWallPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. A house inside this sheet is built from one specific wall set: a pale plastered wall face two rows tall, plus the matching frame posts, caps and trim pieces that finish its corners and its lower edge. List only the tile ids belonging to that house wall set, not every wall-like tile in the sheet. ${JSON_SET}`;
}

/** 통행 가능한 실내 바닥 — 실외 지형이 함정으로 섞여 있다. */
export function buildFloorPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that is an indoor floor a character can walk on. Outdoor ground belongs to a different answer. ${JSON_SET}`;
}

/** 천장(미굴착 어둠) 덩어리. */
export function buildCeilingPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that is a ceiling: the dark solid mass that fills the area outside a room and forms its border. ${JSON_SET}`;
}

/** 창문. */
export function buildWindowPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that is a window. ${JSON_SET}`;
}

/** 통행을 막는 가구 — 통행 가능한 상위 소품이 함정. */
export function buildFurnitureSolidPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that is a piece of furniture a character cannot walk through. ${JSON_SET}`;
}

/** 상위 레이어 소품(투명 배경). */
export function buildPropUpperPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that must be drawn on the layer above the floor because it has a transparent background. ${JSON_SET}`;
}

/** 물. */
export function buildWaterPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that is water. ${JSON_SET}`;
}

/** 카펫/러그. */
export function buildCarpetPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that is a carpet or a rug laid over a floor. ${JSON_SET}`;
}

/** 실외 지형(이 실내 시트 안의 이물질). */
export function buildDistractorPrompt(): string {
  return `The image is a tile sheet. Tiles are numbered left to right, top to bottom, starting at zero. List every tile id that shows outdoor ground rather than anything found inside a building. ${JSON_SET}`;
}

/** 집 짓기 — 표시된 바닥 영역을 감싸고 표시된 입구를 남긴다. */
export function buildHousePrompt(): string {
  return `The image shows an empty map grid. The filled cells mark the floor of a room, and the differently coloured cell marks its entrance. Build the house: enclose the marked floor with walls and a ceiling so the room is sealed on every side, keep the entrance open so a character can walk in, and leave the marked floor walkable. Put tiles that a character walks over on the lower layer and tiles that must be drawn above them on the upper layer. ${JSON_GRID}`;
}

/** 두 방 + 사이 문 — 칸막이를 세우는지 본다. */
export function buildRoomPairPrompt(): string {
  return `The image shows an empty map grid. The filled cells mark the floors of two rooms that sit side by side, and the differently coloured cell marks the outside entrance. Build both rooms: enclose them with walls and a ceiling, separate the two rooms with a wall between them, leave a way to walk from one room into the other, keep the outside entrance open, and leave both marked floors walkable. Put tiles that a character walks over on the lower layer and tiles that must be drawn above them on the upper layer. ${JSON_GRID}`;
}
