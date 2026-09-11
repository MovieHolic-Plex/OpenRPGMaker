// benchmark/town/prompts.ts
// 동결(zero-shot) 영어 프롬프트.
//
// 안티게이밍 하드 규칙(test/townBenchPrompts.test.ts 가 기계적으로 강제):
//  - 프롬프트에 나타나는 **모든 정수는 그 태스크의 팔레트(또는 프로브 목록)와
//    정확히 같은 집합**이어야 한다. 즉 후보 어휘는 줘도 되지만 역할→id,
//    좌표→id, 프로브의 정답 부분집합은 절대 넣지 않는다(palettes.ts 주석 참조).
//  - easyrpg / combined town / tileSemantics / harness / 시트 기하 수치 금지.
//  - 모든 빌더는 인자를 받지 않는 순수 함수다. 팔레트는 엔진 테이블에서 파생하며
//    정답표(정본 배치)를 읽지 않는다 — 정답이 보간될 경로가 없다.
//
// 프롬프트 문자열을 바꾸면 TOWN_PROMPT_VERSION 을 올린다 — 그래야 manifest
// 해시가 바뀌어 옛 점수와 새 점수가 섞이지 않는다.

import {
  LAYER_PROBE_TILES,
  PASSABILITY_PROBE_TILES,
  WALL_PROBE_TILES,
} from "./fixtures";
import {
  ROOF_KIT_PALETTE,
  DOOR_PALETTE,
  FENCE_PALETTE,
  ROAD_PALETTE,
  TREE_PALETTE,
  VILLAGE_PALETTE,
  WALL_KIT_PALETTE,
} from "./palettes";

export const TOWN_PROMPT_VERSION = 1;

const JSON_SET = 'Answer with a JSON object {"tileIds": number[]} listing the chosen tile ids in ascending order.';
const JSON_GRID =
  'Answer with a JSON object {"grid": number[][]} with exactly the same width and height as the grid in the image. Use -1 for a cell you leave empty.';
const JSON_LAYERED =
  'Answer with a JSON object {"lower": number[][], "upper": number[][]}, both exactly the same width and height as the grid in the image. Use -1 for a cell you leave empty.';

const IMAGE_PROBE =
  "The image shows a row of tiles, in the same order as the list below.";
const IMAGE_PALETTE_GRID =
  "The top of the image is a palette strip showing every tile you may use, in ascending id order, left to right then top to bottom. " +
  "Below the dark band is the map grid you must fill.";

function idList(ids: readonly number[]): string {
  return ids.join(", ");
}

function palette(ids: readonly number[]): string {
  return `You may only use these tile ids: ${idList(ids)}.`;
}

// ── 프로브 문항 ───────────────────────────────────────────────────────────

/** 4번 선행 — 겉보기와 통행성이 어긋나는 타일을 가려내는가. */
export function buildPassabilityProbePrompt(): string {
  return (
    `${IMAGE_PROBE} These are the tiles: ${idList(PASSABILITY_PROBE_TILES)}. ` +
    "List the ids of the tiles a character can walk onto. Some of them look like flat ground but block movement. " +
    JSON_SET
  );
}

/** 3번 선행 — 어떤 타일이 캐릭터보다 위에 그려져야 하는가. */
export function buildLayerProbePrompt(): string {
  return (
    `${IMAGE_PROBE} These are the tiles: ${idList(LAYER_PROBE_TILES)}. ` +
    "List the ids of the tiles that must be drawn on the layer above the character, because they are the part of an object that hangs over it. " +
    JSON_SET
  );
}

/** 5번 선행 — 벽면과 벽처럼 보이는 것(지붕 경계·문·창)을 구분하는가. */
export function buildWallProbePrompt(): string {
  return (
    `${IMAGE_PROBE} These are the tiles: ${idList(WALL_PROBE_TILES)}. ` +
    "List the ids of the tiles that are the wall face of a house. Roof pieces, doors, windows and ground belong to a different answer. " +
    JSON_SET
  );
}

// ── 1번 오토타일 ──────────────────────────────────────────────────────────

export function buildAutotilePrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} The marked cells are a dirt path and the unmarked cells stay grass. ` +
    "Put the right path tile in every marked cell so that the path reads correctly against the grass: straight edges on its sides, " +
    "outer corners where it turns, the concave piece where the path wraps around a hole, and the single standalone piece for a cell with no path neighbour. " +
    "Leave every unmarked cell empty. " +
    `${palette(ROAD_PALETTE)} ${JSON_GRID}`
  );
}

// ── 3번 나무(레이어 분리) ─────────────────────────────────────────────────

export function buildTreePlacementPrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} Plant one tree on each marked cell. ` +
    "A tree is two pieces: the trunk the character walks behind and the crown that hangs over the character. " +
    "Put each piece on the layer where it belongs, on the same cell, and keep the two pieces of one tree from the same tree. " +
    "Leave every other cell empty. " +
    `${palette(TREE_PALETTE)} ${JSON_LAYERED}`
  );
}

// ── 4번 길 ────────────────────────────────────────────────────────────────

export function buildRoadPrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} The dark blocks are buildings and the bright cells are three places that must be reachable on foot. ` +
    "Lay a dirt path that connects all three of them into one single connected network. " +
    "Do not pave any cell of a building. Shape the path tiles so the network reads correctly against the grass at every edge, corner and junction. " +
    "Leave every cell that is not path empty. " +
    `${palette(ROAD_PALETTE)} ${JSON_GRID}`
  );
}

// ── 5번 벽 외곽 ───────────────────────────────────────────────────────────

export function buildHouseShellPrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} The marked rectangle is the footprint of one house. Build it. ` +
    "The wall is a nine-slice: its own left edge, repeating middle and right edge, with a top row, middle rows and a bottom row. " +
    "Above the wall sits the roof: a ridge row, the roof face, and an eaves row that overhangs the wall on both sides, " +
    "with the vertical trim pieces closing the roof's left and right flanks. " +
    "Opaque roof and wall pieces go on the lower layer; only the see-through caps go on the layer above. " +
    "Leave every cell outside the footprint empty. " +
    `${palette(WALL_KIT_PALETTE)} ${JSON_LAYERED}`
  );
}

// ── 6번 지붕 대각 ─────────────────────────────────────────────────────────

export function buildRoofDiagonalPrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} The marked rectangle is the footprint of one house. Build it. ` +
    "The roof has a ridge row on top, roof-face rows under it, and an eaves row that overhangs the wall on both sides. " +
    "The roof face is inset by one cell on each side, so its two slanted flanks need the vertical trim pieces. " +
    "Where the ridge row and the eaves row meet those slanted flanks, close the corner with the diagonal caps. " +
    "Below the eaves comes the wall as a nine-slice: its own left edge, repeating middle and right edge, with a top row, middle rows and a bottom row. " +
    "Opaque pieces (ridge, roof face, trim, eaves, wall) go on the lower layer; only the see-through caps go on the layer above. " +
    "Leave every cell outside the footprint empty. " +
    `${palette(ROOF_KIT_PALETTE)} ${JSON_LAYERED}`
  );
}

// ── 7번 문 ────────────────────────────────────────────────────────────────

export function buildDoorPrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} The house is already built. The marked cell is where its front door goes. ` +
    "Install the door: it is two pieces tall, an upper half above a lower half, and both halves must come from the same door. " +
    "Fill only the cells you change and leave every other cell empty. " +
    `${palette(DOOR_PALETTE)} ${JSON_GRID}`
  );
}

// ── 8번 울타리 끝 ─────────────────────────────────────────────────────────

export function buildFencePrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} The house is already built. Fence its front yard along the marked cells, ` +
    "leaving the marked gap in front of the door open so the character can walk through. " +
    "Every run of fence must be finished off at both of its ends: a run stops with an end piece, and a corner piece may only be used " +
    "where a vertical run of fence actually continues from it. Do not leave a post or a corner standing on its own. " +
    "Fill only the cells you change and leave every other cell empty. " +
    `${palette(FENCE_PALETTE)} ${JSON_GRID}`
  );
}

// ── 9번 마을 ──────────────────────────────────────────────────────────────

export function buildVillagePrompt(): string {
  return (
    `${IMAGE_PALETTE_GRID} Build a village. The marked rectangles at the top are the footprints of three houses, ` +
    "the marked rectangle at the bottom is a paved square, and the two marked cells on the left and right edges are where the street enters the map. " +
    "Give every house its walls, its roof and a front door on its bottom wall row. Run one connected street across the map that reaches both entry cells, " +
    "passes in front of every door, and joins the paved square. Fence the yard of each house, leaving the way to its door open. " +
    "Opaque pieces go on the lower layer; see-through pieces and anything that hangs over the character go on the layer above. " +
    "Leave the rest of the ground empty. " +
    `${palette(VILLAGE_PALETTE)} ${JSON_LAYERED}`
  );
}
