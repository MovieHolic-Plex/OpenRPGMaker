// 영역 지정 AI 작업의 "하드 스코프" 보장. AI 제안(proposed)에서 지정 사각형 밖의
// 타일·이벤트 변경을 base 상태로 되돌린다. 다른 맵·타일셋·그룹 등 프로젝트 변경은
// 통과시킨다(배치에 필요한 그룹 정의 보존). base/proposed는 변형하지 않는 순수 함수.
import { transferDetachedDraftMemory } from "@/editor/detachedDraftMemory";
import type { GameEvent, GameMap, MapId, Project } from "@/project/types";

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

export function inRegion(x: number, y: number, region: RegionRect): boolean {
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

  const nextEvents = clipEventsToRegion(baseMap.events ?? [], proposedMap.events ?? [], region);
  // 타일 클립도 없고 이벤트도 proposed와 동일하면 복제 없이 통과.
  if (clippedCells === 0 && eventsEqualList(proposedMap.events ?? [], nextEvents)) {
    return { project: proposed, clippedCells: 0 };
  }

  const nextMap: GameMap = {
    ...proposedMap,
    lowerTiles: nextLower,
    upperTiles: nextUpper,
    events: nextEvents,
  };
  // 선택 필드는 비면 키 자체를 지워 원래 직렬화 형태를 유지(exactOptionalPropertyTypes 안전).
  const lowerField = stacksToField(nextLowerStacks);
  const upperField = stacksToField(nextUpperStacks);
  if (lowerField) nextMap.lowerTileStacks = lowerField;
  else delete nextMap.lowerTileStacks;
  if (upperField) nextMap.upperTileStacks = upperField;
  else delete nextMap.upperTileStacks;

  const nextProject: Project = { ...proposed, maps: { ...proposed.maps, [mapId]: nextMap } };
  transferDetachedDraftMemory(proposed, nextProject);
  return { project: nextProject, clippedCells };
}

/**
 * 영역 밖 이벤트는 base 상태로 고정, 영역 안은 proposed 허용.
 * (영역 밖 신규 NPC 배치·영역 밖 이벤트 삭제/이동을 막는다.)
 *
 * "막는다" 는 **원상 복구**를 뜻한다 — 예전 구현은 `밖(base) + 안(proposed)` 두 목록을 이어 붙였고,
 * 그래서 원래 영역 안에 있던 이벤트를 모델이 영역 밖으로 1칸 옮기면 두 목록 어디에도 들지 못해
 * **이벤트가 통째로 사라졌다**(이동을 막은 것이 아니라 삭제였다). 반대 방향(밖에 있던 이벤트를
 * 영역 안으로 끌어오기)은 같은 id 가 두 목록에 모두 들어 **id 가 중복된 이벤트 두 개**가 됐다.
 * 이제 이동만 되돌리고 이벤트 자체는 보존한다.
 *
 * 영역 안 이벤트의 **삭제는 허용**한다(다듬기 전권 — 2026-08-31 사용자 결정). proposed 에서
 * 사라진 안쪽 이벤트는 그대로 사라진다.
 */
export function clipEventsToRegion(
  baseEvents: readonly GameEvent[],
  proposedEvents: readonly GameEvent[],
  region: RegionRect,
): GameEvent[] {
  const baseById = new Map(baseEvents.map((event) => [event.id, event]));
  const frozenOutside = baseEvents.filter((event) => !inRegion(event.x, event.y, region));
  const frozenIds = new Set(frozenOutside.map((event) => event.id));
  const result: GameEvent[] = frozenOutside.map((event) => structuredClone(event));

  for (const event of proposedEvents) {
    // 영역 밖에 있던 이벤트는 밖 상태가 정본이다 — 영역 안으로 끌어오는 것도 영역 밖 변경이다.
    if (frozenIds.has(event.id)) continue;
    if (inRegion(event.x, event.y, region)) {
      result.push(structuredClone(event));
      continue;
    }
    // 여기까지 오면 "영역 안이었거나 새로 생긴" 이벤트를 영역 밖에 두려는 것이다.
    const before = baseById.get(event.id);
    // 안 → 밖 이동: 원위치로 되돌린다. base 에 없던 신규를 밖에 놓는 것은 계속 차단(통과시키지 않음).
    if (before) result.push(structuredClone(before));
  }
  return result;
}

function eventsEqualList(a: readonly GameEvent[], b: readonly GameEvent[]): boolean {
  if (a.length !== b.length) return false;
  const byId = new Map(b.map((event) => [event.id, event]));
  for (const event of a) {
    const other = byId.get(event.id);
    if (!other || JSON.stringify(event) !== JSON.stringify(other)) return false;
  }
  return true;
}
