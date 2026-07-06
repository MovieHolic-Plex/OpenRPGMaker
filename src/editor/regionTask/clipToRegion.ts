// 영역 지정 AI 작업의 "하드 스코프" 보장. AI 제안(proposed)에서 지정 사각형 밖의
// 타일 변경을 base 상태로 되돌린다. 타일 4구조(lower/upper Tiles·Stacks)만 대상이며
// 다른 맵·타일셋·그룹 등 프로젝트 변경은 통과시킨다(배치에 필요한 그룹 정의 보존).
// base/proposed는 변형하지 않는 순수 함수.
import type { GameMap, MapId, Project } from "@/project/types";

export interface RegionRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface RegionClipResult {
  readonly project: Project;
  // 영역 밖에서 base로 되돌린 셀 수(투명 보고용). 0이면 클립 없음.
  readonly clippedCells: number;
}

function inRegion(x: number, y: number, region: RegionRect): boolean {
  return x >= region.x && y >= region.y && x < region.x + region.width && y < region.y + region.height;
}

type Stacks = Record<number, number[]>;

function toMutableStacks(stacks: Stacks | undefined): Stacks {
  const next: Stacks = {};
  if (!stacks) return next;
  for (const key of Object.keys(stacks)) {
    const arr = stacks[Number(key)];
    if (arr) next[Number(key)] = arr.slice();
  }
  return next;
}

function arraysEqual(a: number[] | undefined, b: number[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

// next[i]를 base[i]에 맞춘다(base에 없으면 삭제). 변경이 있었으면 true.
function restoreStackCell(next: Stacks, base: Stacks | undefined, index: number): boolean {
  const baseArr = base?.[index];
  const nextArr = next[index];
  if (arraysEqual(nextArr, baseArr)) return false;
  if (baseArr) next[index] = baseArr.slice();
  else delete next[index];
  return true;
}

function stacksToField(stacks: Stacks): Stacks | undefined {
  return Object.keys(stacks).length > 0 ? stacks : undefined;
}

/**
 * proposed 프로젝트에서 mapId 맵의 region 밖 타일 변경을 base로 되돌린다.
 * 맵 크기가 base와 다르면(리사이즈 등) 셀 대응이 깨지므로 그대로 통과.
 */
export function clipMapCellsToRegion(
  base: Project,
  proposed: Project,
  mapId: MapId,
  region: RegionRect,
): RegionClipResult {
  const baseMap = base.maps[mapId];
  const proposedMap = proposed.maps[mapId];
  if (!baseMap || !proposedMap) return { project: proposed, clippedCells: 0 };
  if (baseMap.width !== proposedMap.width || baseMap.height !== proposedMap.height) {
    return { project: proposed, clippedCells: 0 };
  }

  const { width, height } = baseMap;
  const nextLower = proposedMap.lowerTiles.slice();
  const nextUpper = proposedMap.upperTiles.slice();
  const nextLowerStacks = toMutableStacks(proposedMap.lowerTileStacks);
  const nextUpperStacks = toMutableStacks(proposedMap.upperTileStacks);

  let clippedCells = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (inRegion(x, y, region)) continue;
      const index = y * width + x;
      let changed = false;
      if (nextLower[index] !== baseMap.lowerTiles[index]) {
        nextLower[index] = baseMap.lowerTiles[index];
        changed = true;
      }
      if (nextUpper[index] !== baseMap.upperTiles[index]) {
        nextUpper[index] = baseMap.upperTiles[index];
        changed = true;
      }
      if (restoreStackCell(nextLowerStacks, baseMap.lowerTileStacks, index)) changed = true;
      if (restoreStackCell(nextUpperStacks, baseMap.upperTileStacks, index)) changed = true;
      if (changed) clippedCells += 1;
    }
  }

  if (clippedCells === 0) return { project: proposed, clippedCells: 0 };

  const nextMap: GameMap = { ...proposedMap, lowerTiles: nextLower, upperTiles: nextUpper };
  // 선택 필드는 비면 키 자체를 지워 원래 직렬화 형태를 유지(exactOptionalPropertyTypes 안전).
  const lowerField = stacksToField(nextLowerStacks);
  const upperField = stacksToField(nextUpperStacks);
  if (lowerField) nextMap.lowerTileStacks = lowerField;
  else delete nextMap.lowerTileStacks;
  if (upperField) nextMap.upperTileStacks = upperField;
  else delete nextMap.upperTileStacks;

  const nextProject: Project = { ...proposed, maps: { ...proposed.maps, [mapId]: nextMap } };
  return { project: nextProject, clippedCells };
}
