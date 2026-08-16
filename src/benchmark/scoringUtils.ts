// benchmark/scoringUtils.ts
// 벤치마크 스코어링 공용 순수 함수 모음. DOM/브라우저 의존성 없음.
// todo 5 — 특정 차원(dimension)의 채점 로직은 절대 여기에 두지 않는다.
//
// 빈 집합 계약(모든 곳에서 NaN 금지):
//  - pred=∅, truth=∅  → 정밀도/재현율/F1/jaccard = 1.0 (공허 참)
//  - pred=∅, truth≠∅  → 정밀도/F1 = 0.0
//  - pred≠∅, truth=∅  → 재현율/F1 = 0.0

/** 임의 반복 가능한 id 컬렉션을 중복 제거된 Set으로 정규화한다. */
function toSet(values: Iterable<number>): Set<number> {
  return values instanceof Set ? values : new Set(values);
}

/** 정밀도 = |pred ∩ truth| / |pred|. 빈 pred는 빈 truth일 때만 1, 아니면 0. */
export function precision(pred: Iterable<number>, truth: Iterable<number>): number {
  const p = toSet(pred);
  const t = toSet(truth);
  if (p.size === 0) return t.size === 0 ? 1 : 0;
  let tp = 0;
  for (const id of p) {
    if (t.has(id)) tp += 1;
  }
  return tp / p.size;
}

/** 재현율 = |pred ∩ truth| / |truth|. 빈 truth는 빈 pred일 때만 1, 아니면 0. */
export function recall(pred: Iterable<number>, truth: Iterable<number>): number {
  const p = toSet(pred);
  const t = toSet(truth);
  if (t.size === 0) return p.size === 0 ? 1 : 0;
  let tp = 0;
  for (const id of p) {
    if (t.has(id)) tp += 1;
  }
  return tp / t.size;
}

/**
 * F1 = 조화 평균. 빈/빈 = 1.0, 교집합이 0이면 0.0 (NaN 금지).
 * f1([], [306]) === 0, f1([], []) === 1.0 이 계약을 테스트가 고정한다.
 */
export function f1(pred: Iterable<number>, truth: Iterable<number>): number {
  const p = toSet(pred);
  const t = toSet(truth);
  if (p.size === 0 && t.size === 0) return 1;
  let tp = 0;
  for (const id of p) {
    if (t.has(id)) tp += 1;
  }
  if (tp === 0) return 0;
  const prec = tp / p.size; // p.size > 0 보장
  const rec = tp / t.size; // t.size > 0 보장
  return (2 * prec * rec) / (prec + rec);
}

/** 자카드 유사도 = |a ∩ b| / |a ∪ b|. 빈/빈 = 1.0, 한쪽만 빈 = 0. */
export function jaccard(a: Iterable<number>, b: Iterable<number>): number {
  const sa = toSet(a);
  const sb = toSet(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let inter = 0;
  for (const id of sa) {
    if (sb.has(id)) inter += 1;
  }
  const union = sa.size + sb.size - inter;
  return union === 0 ? 1 : inter / union;
}

/** 셀 단위 정확도 = 일치하는 셀 수 / 전체 셀 수. 형상이 다르면 throw, 빈/빈 = 1. */
export function cellAccuracy(gridA: readonly (readonly unknown[])[], gridB: readonly (readonly unknown[])[]): number {
  assertRectangular(gridA);
  assertRectangular(gridB);
  const height = gridA.length;
  const width = gridA[0]?.length ?? 0;
  if (height !== gridB.length) {
    throw new Error(`cellAccuracy: grid heights differ (${height} vs ${gridB.length})`);
  }
  if (width !== (gridB[0]?.length ?? 0)) {
    throw new Error(`cellAccuracy: grid widths differ (${width} vs ${gridB[0]?.length ?? 0})`);
  }
  if (height === 0) return 1; // 공허 참
  let equal = 0;
  for (let y = 0; y < height; y += 1) {
    const rowA = gridA[y];
    const rowB = gridB[y];
    for (let x = 0; x < width; x += 1) {
      if (rowA[x] === rowB[x]) equal += 1;
    }
  }
  return equal / (height * width);
}

/**
 * 클래스별 IoU의 평균. predSet/truthSet은 클래스 이름 → id 컬렉션 맵.
 * 한쪽에만 있는 클래스는 빈 집합으로 취급한다. 클래스가 없으면 1.0 (NaN 금지).
 */
export function perClassIoU(
  predSet: ReadonlyMap<string, Iterable<number>>,
  truthSet: ReadonlyMap<string, Iterable<number>>,
): number {
  const classes = new Set<string>([...predSet.keys(), ...truthSet.keys()]);
  if (classes.size === 0) return 1;
  let sum = 0;
  for (const cls of classes) {
    sum += jaccard(predSet.get(cls) ?? [], truthSet.get(cls) ?? []);
  }
  return sum / classes.size;
}

/** 이름 정규화: 소문자/trim/괄호(영문·전각) 내용 제거/내부 공백 축소. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[（(][^（）()]*[）)]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** 집합 차집합 a \ b 를 Set으로 반환. */
export function setDiff(a: Iterable<number>, b: Iterable<number>): Set<number> {
  const sa = toSet(a);
  const sb = toSet(b);
  const out = new Set<number>();
  for (const id of sa) {
    if (!sb.has(id)) out.add(id);
  }
  return out;
}

/** 그리드가 직사각형인지 검증. 아니면 Error를 던진다. */
export function assertRectangular(grid: readonly (readonly unknown[])[]): void {
  if (!Array.isArray(grid)) {
    throw new Error("assertRectangular: grid must be an array of rows");
  }
  const width = grid[0]?.length ?? 0;
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    if (!Array.isArray(row)) {
      throw new Error(`assertRectangular: row ${y} is not an array`);
    }
    if (row.length !== width) {
      throw new Error(`assertRectangular: row ${y} has length ${row.length}, expected ${width}`);
    }
  }
}

export interface GridPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * 4-방향 플러드 필. isCell(x, y)가 참인 셀만 방문한다.
 * 반환: 방문한 셀의 "x,y" 키 Set (Set 크기 = 컴포넌트 칸 수).
 * 시작점이 범위 밖이면 throw, 시작점이 비-셀이면 빈 Set.
 */
export function floodFill4(
  grid: readonly (readonly unknown[])[],
  start: GridPoint,
  isCell: (x: number, y: number) => boolean,
): Set<string> {
  assertRectangular(grid);
  const height = grid.length;
  const width = grid[0]?.length ?? 0;
  const { x, y } = start;
  if (x < 0 || y < 0 || x >= width || y >= height) {
    throw new Error(`floodFill4: start (${x},${y}) is outside grid ${width}x${height}`);
  }
  const visited = new Set<string>();
  if (!isCell(x, y)) return visited;
  const stack: GridPoint[] = [{ x, y }];
  while (stack.length > 0) {
    const cur = stack.pop() as GridPoint;
    const key = `${cur.x},${cur.y}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const neighbors: readonly GridPoint[] = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.y < 0 || n.x >= width || n.y >= height) continue;
      if (isCell(n.x, n.y)) stack.push(n);
    }
  }
  return visited;
}

/** isCell이 참인 4-연결 컴포넌트의 개수. */
export function countConnectedComponents(
  grid: readonly (readonly unknown[])[],
  isCell: (x: number, y: number) => boolean,
): number {
  assertRectangular(grid);
  const visited = new Set<string>();
  let count = 0;
  for (let y = 0; y < grid.length; y += 1) {
    const row = grid[y];
    for (let x = 0; x < row.length; x += 1) {
      const key = `${x},${y}`;
      if (visited.has(key) || !isCell(x, y)) continue;
      const component = floodFill4(grid, { x, y }, isCell);
      for (const k of component) visited.add(k);
      count += 1;
    }
  }
  return count;
}
