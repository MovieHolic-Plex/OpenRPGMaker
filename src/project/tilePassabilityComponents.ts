// project/tilePassabilityComponents.ts
// 4방향 통행 그래프의 연결 성분. 도달 불가를 전체 탐색 없이 판정하는 데 쓴다.
//
// 왜 정확한가: canMove 는 **대칭**이다.
//   canMove(a→b) = a.<dir> && b.<opposite>   (collision.ts §canMove)
//   canMove(b→a) = b.<opposite> && a.<dir>   ← 같은 논리곱
// 즉 인접 통행 관계는 무향 그래프이고, 연결 성분은 findChasePath 의 도달 가능성과
// 정확히 일치한다(근사가 아니다). 성분이 다르면 A* 는 반드시 빈 경로를 낸다.
//
// 무엇을 안 덮는가: **통행 사각이 1x1 보다 큰** 이동. canMoveFootprint 는 이동 방향의
// 선행 모서리만 보므로 폭이 2 이상이면 대칭이 깨진다(오른쪽으로 갈 때는 오른쪽 열,
// 왼쪽으로 갈 때는 왼쪽 열을 본다). 판정 기준은 `pass` 인자의 **유무가 아니라 사각 크기**다
// — 런타임 추격은 1x1 NPC 에도 pass 를 객체로 항상 넘기므로(playSceneAutonomous.ts),
// 유무로 가르면 모든 추격에서 색인이 죽는다(chaseAi.ts §passIsUnitRect).
//
// ── 비용을 어디에 두었는가 (실측 100×100 = 1만 칸)
// 색인을 만드는 데 2.9ms 다. 그래서 **미리 만들지 않는다** — A* 가 실제로 빈 경로를 낸
// 뒤에만(이미 6.7ms 를 쓴 뒤) 만들어 둔다. 그 다음부터 같은 질의는 25µs 다.
// 두 값 모두 맵 면적에 **선형**이다. clampMapSize 상한 256×256(6.5만 칸)이면 빌드 약
// 19ms, 지문 약 160µs 로 예산을 넘는다 — 그래서 방금 훑은 범위가 면적에 비해 작으면
// 아예 만들지 않는다(§armTerrainComponents 의 scannedCells).
// 도달 **가능** 질의는 라벨 두 번 읽기로 끝나 지문 비용을 치르지 않는다 — 낙관적으로 낸
// "도달 가능" 은 틀려도 호출부가 A* 를 돌려 스스로 바로잡기 때문이다(§terrainMayReach).

import { canMove, getTileset } from "./collision";
import type { GameMap, Project, TilesetDef } from "./types";

interface ComponentIndex {
  readonly labels: Int32Array;
  readonly width: number;
  readonly height: number;
  readonly tileset: TilesetDef;
  /** 타일 내용 지문. 제자리 수정(applyMapOverrides 등)을 결론 시점에 잡는다. */
  readonly fingerprint: number;
}

const indexByMap = new WeakMap<GameMap, ComponentIndex>();

/**
 * 한 출발점에서 여러 목표를 물을 때 쓰는 판정기. 돌려주는 함수는 목표마다
 * **false 면 "확정 도달 불가"**, true 면 "탐색으로 확인해야 함" 을 뜻한다.
 *
 * 지문 검증을 판정기 하나당 **한 번만** 하는 게 이 형태의 이유다. 후보마다 검증하면
 * 경계 100칸 질의가 100 × 25µs = 2.5ms 로 되돌아간다(실측).
 *
 * 지문을 "도달 불가" 쪽에서만 확인하는 이유: 낡은 색인이 낼 수 있는 오답은 두 종류다.
 *  - 낡은 "도달 가능" → 호출부가 탐색을 돌고 탐색이 정답을 낸다. **무해**하다.
 *  - 낡은 "도달 불가" → 호출부가 탐색을 건너뛴다. 벽이 열렸는데 추격을 포기하는 버그다.
 * 그래서 결과를 바꾸는 후자에서만 검증하고, 필요하면 그 자리에서 다시 만든다. 전자는
 * 라벨 비교로 끝나므로 정상 추격은 새 비용이 없다.
 *
 * 검증 뒤에 색인이 바뀌어도, 그 전에 낙관적으로 통과시킨 목표는 다시 보지 않는다 —
 * 통과는 "탐색해 보라"는 뜻이라 틀려도 탐색이 바로잡기 때문이다. 탈락은 언제나 검증된
 * 색인으로만 낸다.
 */
export function terrainReachFilter(
  project: Project,
  map: GameMap,
  fromX: number,
  fromY: number
): (toX: number, toY: number) => boolean {
  let components = indexByMap.get(map) ?? null;
  let verified = false;
  return (toX: number, toY: number): boolean => {
    if (!components) return true;
    if (!withinIndex(components, fromX, fromY) || !withinIndex(components, toX, toY)) return true;
    if (sameLabel(components, fromX, fromY, toX, toY)) return true;
    if (verified) return false;
    verified = true;
    components = validIndex(project, map, components) ? components : rebuildIndex(project, map);
    if (!components) return true;
    if (!withinIndex(components, fromX, fromY) || !withinIndex(components, toX, toY)) return true;
    return sameLabel(components, fromX, fromY, toX, toY);
  };
}

/**
 * 한 쌍만 묻는 축약형. **false 는 "확정 도달 불가"**, true 는 "탐색으로 확인해야 함".
 * 색인이 없으면(아직 만들 이유가 없었으면) 언제나 true 다 — 판정을 건너뛴다.
 */
export function terrainMayReach(
  project: Project,
  map: GameMap,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  return terrainReachFilter(project, map, fromX, fromY)(toX, toY);
}

/**
 * 색인을 만들 만큼 방금 훑은 범위가 넓은가를 가르는 비율. 방금 탐색이 훑은 칸이
 * 면적의 1/8 이상이면 만든다.
 *
 * 왜 필요한가: 빌드와 지문은 둘 다 **면적**에 선형인데, 방금 치른 탐색은 **자기 성분**에만
 * 선형이다. 집 안에 갇힌 주민(성분 20칸)이 100×100 맵에서 실패하면 20칸을 훑고 1만 칸을
 * 짓게 된다 — 색인이 없을 때보다 느려지고, 그 뒤 질의마다 지문 25µs 를 더 낸다.
 * 넓은 성분에서 실패한 경우(맵 전체가 열려 있고 목표만 벽 안인 그 렉의 원인)에는 방금
 * 훑은 값이 이미 빌드와 같은 수준이라 즉시 이득이다.
 */
const INDEX_SCAN_RATIO = 8;

/**
 * 이 맵의 성분 색인을 만들어 둔다. 전체 탐색이 **이미 실패한 뒤**에 부른다 —
 * 그 시점에는 색인을 만드는 값(2.9ms)이 방금 치른 탐색(6.7ms)보다 싸고, 다음부터 같은
 * 질의가 25µs 로 끝난다. 미리 만들지 않으므로 도달 불가가 없는 맵은 값을 치르지 않는다.
 *
 * `scannedCells` 는 방금 실패한 탐색이 닫은 칸 수다. 주면 그 값이 면적에 비해 너무 작을
 * 때 만들지 않는다(§INDEX_SCAN_RATIO). 생략하면 언제나 만든다.
 */
export function armTerrainComponents(project: Project, map: GameMap, scannedCells?: number): void {
  const cached = indexByMap.get(map);
  if (cached && validIndex(project, map, cached)) return;
  if (scannedCells !== undefined && scannedCells * INDEX_SCAN_RATIO < map.width * map.height) return;
  rebuildIndex(project, map);
}

/** 캐시를 버린다. 지문이 이미 막아주지만, 타일을 고친 자리에서 뜻을 밝혀 두는 값이 있다. */
export function invalidateTilePassabilityComponents(map: GameMap): void {
  indexByMap.delete(map);
}

function withinIndex(index: ComponentIndex, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < index.width && y < index.height;
}

function sameLabel(
  index: ComponentIndex,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): boolean {
  const { labels, width } = index;
  return labels[fromY * width + fromX] === labels[toY * width + toX];
}

function validIndex(project: Project, map: GameMap, index: ComponentIndex): boolean {
  if (index.width !== map.width || index.height !== map.height) return false;
  const tileset = getTileset(project, map);
  if (index.tileset !== tileset) return false;
  return index.fingerprint === passabilityFingerprint(map, tileset);
}

function rebuildIndex(project: Project, map: GameMap): ComponentIndex | null {
  const tileset = getTileset(project, map);
  if (!tileset) return null;
  if (map.width <= 0 || map.height <= 0) return null;
  const built: ComponentIndex = {
    labels: buildLabels(project, map),
    width: map.width,
    height: map.height,
    tileset,
    fingerprint: passabilityFingerprint(map, tileset),
  };
  indexByMap.set(map, built);
  return built;
}

/**
 * 유니온-파인드로 성분 라벨을 만든다. 간선은 오른쪽·아래 두 방향만 본다 —
 * canMove 가 대칭이므로 반대 방향은 같은 판정이다(파일 머리 주석 참조).
 */
function buildLabels(project: Project, map: GameMap): Int32Array {
  const width = map.width;
  const height = map.height;
  const count = width * height;
  const parent = new Int32Array(count);
  const rank = new Int32Array(count);
  for (let index = 0; index < count; index += 1) parent[index] = index;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width && canMove(project, map, x, y, x + 1, y)) {
        unite(parent, rank, index, index + 1);
      }
      if (y + 1 < height && canMove(project, map, x, y, x, y + 1)) {
        unite(parent, rank, index, index + width);
      }
    }
  }
  const labels = new Int32Array(count);
  for (let index = 0; index < count; index += 1) labels[index] = findRoot(parent, index);
  return labels;
}

function findRoot(parent: Int32Array, start: number): number {
  let root = start;
  while (parent[root] !== root) {
    // 경로 반감 — 재귀 없이 트리를 눌러 둔다.
    parent[root] = parent[parent[root] as number] as number;
    root = parent[root] as number;
  }
  return root;
}

function unite(parent: Int32Array, rank: Int32Array, a: number, b: number): void {
  let rootA = findRoot(parent, a);
  let rootB = findRoot(parent, b);
  if (rootA === rootB) return;
  if ((rank[rootA] as number) < (rank[rootB] as number)) {
    const swap = rootA;
    rootA = rootB;
    rootB = swap;
  }
  parent[rootB] = rootA;
  if (rank[rootA] === rank[rootB]) rank[rootA] = (rank[rootA] as number) + 1;
}

/**
 * 통행 판정에 들어가는 모든 입력의 32비트 지문 — 맵의 하위/상위 타일과 타일 스택,
 * 그리고 **타일셋의 통행 정의**. FNV-1a 변형.
 *
 * 타일셋을 왜 넣는가: identity 비교만으로는 부족하다. `setPassageMark` 는 같은 TilesetDef
 * 객체의 `passability[tile]` 과 `priority[tile]` 을 **제자리에서** 바꾼다
 * (tilesetPassage.ts §setPassageMark). 그러면 맵 타일 배열은 그대로이므로 타일만 해싱한
 * 지문은 낡음을 못 잡고, 색인이 "확정 도달 불가" 를 우겨 벽이 열렸는데 추격을 포기한다.
 * 타일셋 길이는 맵 면적보다 훨씬 작아 비용은 사실상 그대로다.
 *
 * 스택은 지금 폐기된 개념이라 `topTileInStack` 이 언제나 undefined 를 낸다(스택 루프는
 * 사실상 돌지 않는다). 그래도 `tileAt` 이 스택을 거치므로 지문에 넣어 둔다 — 스택이
 * 되살아나도 캐시가 조용히 낡지 않는다.
 */
function passabilityFingerprint(map: GameMap, tileset: TilesetDef | null): number {
  const lower = map.lowerTiles;
  const upper = map.upperTiles;
  let hash = 0x811c9dc5 | 0;
  for (let index = 0; index < lower.length; index += 1) {
    hash = Math.imul(hash ^ (lower[index] as number), 0x01000193);
  }
  for (let index = 0; index < upper.length; index += 1) {
    hash = Math.imul(hash ^ (upper[index] as number), 0x01000193);
  }
  hash = mixStacks(hash, map.lowerTileStacks);
  hash = mixStacks(hash, map.upperTileStacks);
  return mixTilesetPassage(hash, tileset) | 0;
}

/**
 * 타일셋의 통행 관련 필드만 섞는다 — 4방향 통행 비트와 우선도(★ 판정에 쓰인다,
 * collision.ts §tilePassability). 그림·이름 같은 통행 무관 필드는 넣지 않는다.
 */
function mixTilesetPassage(hash: number, tileset: TilesetDef | null): number {
  if (!tileset) return hash;
  let mixed = hash;
  const flags = tileset.passability;
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    const bits = flag
      ? (flag.up ? 1 : 0) | (flag.down ? 2 : 0) | (flag.left ? 4 : 0) | (flag.right ? 8 : 0)
      : 16;
    mixed = Math.imul(mixed ^ bits, 0x01000193);
  }
  const priority = tileset.priority;
  for (let index = 0; index < priority.length; index += 1) {
    mixed = Math.imul(mixed ^ (priority[index] === "upper" ? 1 : 0), 0x01000193);
  }
  return mixed;
}

function mixStacks(hash: number, stacks: Record<number, number[]> | undefined): number {
  if (!stacks) return hash;
  let mixed = hash;
  for (const key in stacks) {
    mixed = Math.imul(mixed ^ Number(key), 0x01000193);
    const stack = stacks[key as unknown as number];
    if (!stack) continue;
    for (let index = 0; index < stack.length; index += 1) {
      mixed = Math.imul(mixed ^ (stack[index] as number), 0x01000193);
    }
  }
  return mixed;
}
