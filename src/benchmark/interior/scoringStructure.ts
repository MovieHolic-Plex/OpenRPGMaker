// benchmark/interior/scoringStructure.ts
// 배치형 답변("이 그리드에 집을 지어라") 채점 스킴 S5 · S6.
//
// 두 스킴을 함께 내는 것이 이 모듈의 존재 이유다:
//   S5 gridIdentity — 정본 플랜과 칸 단위로 같은가(시트를 외웠는가)
//   S6 structural   — 타일 id 를 완전히 무시하고, 지은 것이 집으로서 성립하는가
// 정본과 다른 타일로 멀쩡한 집을 지은 모델은 S5 가 낮고 S6 가 1.0 이다.
// 정본 타일을 흩뿌려 놓기만 한 모델은 그 반대다. 한 숫자로는 이 둘을 구분할 수 없다.

import type {
  HouseReference,
  InteriorGroundTruth,
  PlacementAnswer,
  SchemeScore,
  SchemeWeights,
  ScoredAnswer,
  ScoringSchemeId,
} from "./types";
import { EMPTY_CELL } from "./types";
import { weightedMean } from "./scoringSets";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function scheme(id: ScoringSchemeId, rawScore: number, detail: Record<string, number>): SchemeScore {
  return Object.freeze({
    scheme: id,
    score: clamp01(rawScore),
    rawScore: Number.isFinite(rawScore) ? rawScore : 0,
    detail: Object.freeze({ ...detail }),
  });
}

function gridShape(grid: readonly (readonly number[])[]): { width: number; height: number } {
  return { width: grid[0]?.length ?? 0, height: grid.length };
}

function cellAt(grid: readonly (readonly number[])[], x: number, y: number): number {
  return grid[y]?.[x] ?? EMPTY_CELL;
}

function isPassableTile(groundTruth: InteriorGroundTruth, tile: number): boolean {
  if (tile === EMPTY_CELL) return false;
  const flag = groundTruth.passability[tile];
  if (!flag) return false;
  return flag.up || flag.down || flag.left || flag.right;
}

/** S5 — 정본 플랜과의 칸 단위 일치 + 좌표 IoU(타일 정체성 무시). */
function gridIdentity(answer: PlacementAnswer, house: HouseReference): SchemeScore {
  const reference = new Map<string, number>();
  for (const placement of house.walls) {
    reference.set(`${placement.x},${placement.y}`, placement.tile);
  }

  const answered = new Map<string, number>();
  const { width, height } = gridShape(answer.lower);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const tile = cellAt(answer.lower, x, y);
      if (tile !== EMPTY_CELL) answered.set(`${x},${y}`, tile);
    }
  }

  let exactCells = 0;
  for (const [key, tile] of reference) {
    if (answered.get(key) === tile) exactCells += 1;
  }

  const union = new Set<string>([...reference.keys(), ...answered.keys()]);
  let intersection = 0;
  for (const key of reference.keys()) if (answered.has(key)) intersection += 1;
  const coordinateIoU = union.size === 0 ? 0 : intersection / union.size;
  const cellAccuracy = union.size === 0 ? 0 : exactCells / union.size;

  return scheme("gridIdentity", cellAccuracy, {
    exactCells,
    referencedCells: reference.size,
    answeredCells: answered.size,
    coordinateIoU,
    cellAccuracy,
  });
}

/**
 * S6 — 타일 정체성을 보지 않는 구조 타당성. 다섯 항목의 평균.
 * 정본 타일 id 와의 일치는 어디에도 들어가지 않는다 — 들어가면 S5 의 복제가 된다.
 */
function structural(
  answer: PlacementAnswer,
  house: HouseReference,
  groundTruth: InteriorGroundTruth,
): SchemeScore {
  const { width, height } = house;
  const floorMask = house.floor;
  const door = house.door;
  const isFloorCell = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < width && y < height && floorMask[y * width + x] === true;

  // 1) interiorWalkable — 방 안쪽 칸에 실제로 통행 가능한 타일이 깔렸는가.
  let floorCells = 0;
  let walkableFloorCells = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFloorCell(x, y)) continue;
      floorCells += 1;
      if (isPassableTile(groundTruth, cellAt(answer.lower, x, y))) walkableFloorCells += 1;
    }
  }
  const interiorWalkable = floorCells === 0 ? 0 : walkableFloorCells / floorCells;

  // 2) ringClosed — 방 안이 밖으로 새는가.
  //
  // "방에 인접한 칸은 전부 통행 불가"로 재면 방 사이 밑문이 샘으로 오분류된다
  // (정본 두 방 플랜 자신이 0.95로 깎이는 버그가 이것이었다). 대신 그리드 밖에서
  // 새들어올 수 있는가를 물어야 한다: 경계에서 시작해 방 칸을 통과하지 않고
  // 통행 가능한 칸만 다니는 플러드필이 방에 인접한 칸에 닿으면 그것이 샘이다.
  // 방 사이 밑문은 새층 안쪽이라 밖에서 도달할 수 없으므로 샘으로 세지 않는다.
  // 현관문 한 칸은 뚫려 있어야 하므로 샘 한 개는 면제한다.
  const boundary = new Set<string>();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!isFloorCell(x, y)) continue;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (isFloorCell(nx, ny)) continue;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        boundary.add(`${nx},${ny}`);
      }
    }
  }
  const boundaryCells = boundary.size;

  const outsideTraversable = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    if (isFloorCell(x, y)) return false;
    const tile = cellAt(answer.lower, x, y);
    return tile === EMPTY_CELL || isPassableTile(groundTruth, tile);
  };
  const outside = new Set<string>();
  const outsideQueue: [number, number][] = [];
  const seedOutside = (x: number, y: number): void => {
    const key = `${x},${y}`;
    if (outside.has(key) || !outsideTraversable(x, y)) return;
    outside.add(key);
    outsideQueue.push([x, y]);
  };
  for (let x = 0; x < width; x += 1) {
    seedOutside(x, 0);
    seedOutside(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    seedOutside(0, y);
    seedOutside(width - 1, y);
  }
  while (outsideQueue.length > 0) {
    const [cx, cy] = outsideQueue.shift()!;
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ] as const) {
      seedOutside(cx + dx, cy + dy);
    }
  }

  let leaks = 0;
  for (const key of boundary) if (outside.has(key)) leaks += 1;
  const ringClosed =
    boundaryCells === 0 ? 0 : 1 - Math.max(0, leaks - 1) / Math.max(1, boundaryCells);

  // 3) doorReachable — 출입구에서 4방향 플러드필로 방 전체에 닿는가.
  const reachable = new Set<string>();
  const start = `${door.x},${door.y}`;
  if (isPassableTile(groundTruth, cellAt(answer.lower, door.x, door.y))) {
    const queue: [number, number][] = [[door.x, door.y]];
    reachable.add(start);
    while (queue.length > 0) {
      const [cx, cy] = queue.shift()!;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const key = `${nx},${ny}`;
        if (reachable.has(key)) continue;
        if (!isPassableTile(groundTruth, cellAt(answer.lower, nx, ny))) continue;
        reachable.add(key);
        queue.push([nx, ny]);
      }
    }
  }
  let reachedFloorCells = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isFloorCell(x, y) && reachable.has(`${x},${y}`)) reachedFloorCells += 1;
    }
  }
  const doorReachable = floorCells === 0 ? 0 : reachedFloorCells / floorCells;

  // 4) layerDiscipline — 상위 레이어에 놓은 것이 실제로 상위 소품인가.
  let upperCells = 0;
  let upperCorrect = 0;
  const upperShape = gridShape(answer.upper);
  for (let y = 0; y < upperShape.height; y += 1) {
    for (let x = 0; x < upperShape.width; x += 1) {
      const tile = cellAt(answer.upper, x, y);
      if (tile === EMPTY_CELL) continue;
      upperCells += 1;
      if (groundTruth.priority[tile] === "upper") upperCorrect += 1;
    }
  }
  // 상위 레이어를 아예 쓰지 않은 답도 규율 위반은 아니다 — 이 집은 상위 소품이 필수가 아니다.
  const layerDiscipline = upperCells === 0 ? 1 : upperCorrect / upperCells;

  // 5) noForbidden — 금지 타일(플레이스홀더)을 쓰지 않았는가.
  let forbiddenHits = 0;
  for (const grid of [answer.lower, answer.upper]) {
    for (const row of grid) {
      for (const tile of row) if (tile !== EMPTY_CELL && groundTruth.forbidden.has(tile)) forbiddenHits += 1;
    }
  }
  const noForbidden = forbiddenHits === 0 ? 1 : 0;

  const parts = [ringClosed, doorReachable, interiorWalkable, layerDiscipline, noForbidden];
  const value = parts.reduce((sum, part) => sum + part, 0) / parts.length;
  return scheme("structural", value, {
    ringClosed,
    doorReachable,
    interiorWalkable,
    layerDiscipline,
    noForbidden,
    boundaryCells,
    floorCells,
    leaks,
  });
}

export function scorePlacementAnswer(input: {
  readonly answer: PlacementAnswer;
  readonly house: HouseReference;
  readonly groundTruth: InteriorGroundTruth;
  readonly schemes: readonly ScoringSchemeId[];
  readonly weights: SchemeWeights;
}): ScoredAnswer {
  const { width, height } = gridShape(input.answer.lower);
  const expectedWidth = input.house.width;
  const expectedHeight = input.house.height;

  // 그리드 형상이 다르면 좌표계가 아예 다르므로 채점이 성립하지 않는다.
  // 던지지 않고 0점 + 플래그로 기록한다 — 형상 오류도 유효한 벤치마크 결과다.
  if (width !== expectedWidth || height !== expectedHeight) {
    const schemes = input.schemes.map((id) =>
      scheme(id, 0, { shapeMismatch: 1, width, height, expectedWidth, expectedHeight }),
    );
    return Object.freeze({ schemes: Object.freeze(schemes), composite: 0 });
  }

  const schemes: SchemeScore[] = [];
  for (const id of input.schemes) {
    if (id === "gridIdentity") schemes.push(gridIdentity(input.answer, input.house));
    else if (id === "structural") schemes.push(structural(input.answer, input.house, input.groundTruth));
    else throw new Error(`interior scoringStructure: 배치형 답변에 쓸 수 없는 스킴 "${id}"`);
  }
  return Object.freeze({ schemes: Object.freeze(schemes), composite: weightedMean(schemes, input.weights) });
}
