import type { GameEvent, GameMap, Project } from "@/project/types";
import { footprintBounds, normalizeCharacterFootprint } from "../../project/footprint";
import { jsonEqual } from "../../util/structuralJson";
import type { MapRunLockRegion } from "./mapRunLocks.mjs";

const GRID_FIELDS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles", "shadowBits"] as const;
const STACK_FIELDS = ["lowerTileStacks", "upperTileStacks"] as const;

export interface RegionWriteViolation {
  readonly ok: false;
  readonly summary: string;
}

function inRegion(x: number, y: number, region: MapRunLockRegion): boolean {
  return x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height;
}

function eventBoundsInRegion(event: GameEvent, region: MapRunLockRegion): boolean {
  const footprints = event.pages?.length
    ? event.pages.map((page) => normalizeCharacterFootprint(page.footprint))
    : [normalizeCharacterFootprint(undefined)];
  for (const footprint of footprints) {
    const body = footprintBounds(event.x, event.y, footprint);
    if (body.left < region.x || body.top < region.y
      || body.right >= region.x + region.width || body.bottom >= region.y + region.height) {
      return false;
    }
  }
  return true;
}

function outsideGridSamples(
  before: readonly number[] | undefined,
  after: readonly number[] | undefined,
  width: number,
  height: number,
  region: MapRunLockRegion,
  defaultValue: number,
): { readonly count: number; readonly sample: readonly string[] } {
  if (before === after) return { count: 0, sample: [] };
  const total = width * height;
  let count = 0;
  const sample: string[] = [];
  for (let i = 0; i < total; i += 1) {
    const b = before?.[i] ?? defaultValue;
    const a = after?.[i] ?? defaultValue;
    if (b === a) continue;
    const x = i % width;
    const y = Math.floor(i / width);
    if (!inRegion(x, y, region)) {
      count += 1;
      if (sample.length < 4) sample.push(`(${x},${y})`);
    }
  }
  return { count, sample };
}

function outsideStackSamples(
  before: Record<number, number[]> | undefined,
  after: Record<number, number[]> | undefined,
  width: number,
  region: MapRunLockRegion,
): { readonly count: number; readonly sample: readonly string[] } {
  if (before === after) return { count: 0, sample: [] };
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  let count = 0;
  const sample: string[] = [];
  for (const key of keys) {
    const index = Number(key);
    if (!Number.isInteger(index) || index < 0) continue;
    if (jsonEqual(before?.[index], after?.[index])) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    if (!inRegion(x, y, region)) {
      count += 1;
      if (sample.length < 4) sample.push(`(${x},${y})`);
    }
  }
  return { count, sample };
}

function outsideEventChanges(before: GameMap, after: GameMap, region: MapRunLockRegion): string[] {
  if (before.events === after.events) return [];
  const beforeById = new Map(before.events.map((event) => [event.id, event]));
  const afterById = new Map(after.events.map((event) => [event.id, event]));
  const bad: string[] = [];
  for (const [id, next] of afterById) {
    const prev = beforeById.get(id);
    if (prev && jsonEqual(prev, next)) continue;
    if (!eventBoundsInRegion(next, region) || (prev && !eventBoundsInRegion(prev, region))) {
      bad.push(`${next.name || id}(${next.x},${next.y})`);
    }
  }
  for (const [id, prev] of beforeById) {
    if (afterById.has(id)) continue;
    if (!eventBoundsInRegion(prev, region)) {
      bad.push(`삭제 ${prev.name || id}(${prev.x},${prev.y})`);
    }
  }
  return bad;
}

/**
 * 드래그 영역으로 잠근 실행이 자기 영역 밖의 맵·칸·이벤트를 고쳤는지 검사한다.
 * 같은 맵의 겹치지 않는 영역끼리 병렬 실행할 때 다른 영역을 침범하지 않도록 쓰기 경로에서 강제한다.
 */
export function findRegionWriteViolation(
  before: Project,
  after: Project,
  region: MapRunLockRegion,
  toolName: string,
): RegionWriteViolation | null {
  if (before === after) return null;
  const rectText = `(${region.x},${region.y} ${region.width}×${region.height})`;

  // 1. 다른 기존 맵 수정·삭제 차단 (단일 맵 영역 락은 다른 맵을 잠그지 않는다).
  const otherMapIds = new Set([...Object.keys(before.maps), ...Object.keys(after.maps)]);
  const touchedOtherMaps: string[] = [];
  for (const mapId of otherMapIds) {
    if (mapId === region.mapId) continue;
    const prev = before.maps[mapId];
    const next = after.maps[mapId];
    if (prev === next) continue;
    if (!jsonEqual(prev, next)) touchedOtherMaps.push(`${prev?.name ?? next?.name ?? mapId}(${mapId})`);
  }
  if (touchedOtherMaps.length > 0) {
    return {
      ok: false,
      summary: `${toolName} 호출을 되돌렸습니다: 드래그 영역 작업은 맵 '${region.mapId}'의 ${rectText} 안에서만 쓸 수 있습니다(다른 맵 수정 불가: ${touchedOtherMaps.slice(0, 4).join(", ")}).`,
    };
  }

  // 2. 대상 맵의 크기 변경·삭제 차단.
  const prevMap = before.maps[region.mapId];
  const nextMap = after.maps[region.mapId];
  if (prevMap === nextMap) return null;
  if (!prevMap || !nextMap) {
    return {
      ok: false,
      summary: `${toolName} 호출을 되돌렸습니다: 드래그 영역 작업 중 대상 맵 '${region.mapId}'을 삭제하거나 교체할 수 없습니다.`,
    };
  }
  if (prevMap.width !== nextMap.width || prevMap.height !== nextMap.height) {
    return {
      ok: false,
      summary: `${toolName} 호출을 되돌렸습니다: 드래그 영역 작업 중 맵 크기(${prevMap.width}×${prevMap.height} → ${nextMap.width}×${nextMap.height})를 바꿀 수 없습니다.`,
    };
  }

  // 3. 영역 밖 타일·오버레이·그림자·스택·지형 높이 변경 차단.
  let outsideCells = 0;
  const cellSamples: string[] = [];
  const collect = (found: { readonly count: number; readonly sample: readonly string[] }) => {
    outsideCells += found.count;
    for (const coord of found.sample) {
      if (cellSamples.length < 4 && !cellSamples.includes(coord)) cellSamples.push(coord);
    }
  };
  for (const field of GRID_FIELDS) {
    const defaultValue = field === "shadowBits" ? 0 : -1;
    collect(outsideGridSamples(prevMap[field], nextMap[field], prevMap.width, prevMap.height, region, defaultValue));
  }
  for (const field of STACK_FIELDS) {
    collect(outsideStackSamples(prevMap[field], nextMap[field], prevMap.width, region));
  }
  if (prevMap.relief !== nextMap.relief) {
    if (prevMap.relief?.levels !== nextMap.relief?.levels) {
      collect(outsideGridSamples(prevMap.relief?.levels, nextMap.relief?.levels, prevMap.width, prevMap.height, region, 0));
    }
    if (prevMap.relief?.ramps !== nextMap.relief?.ramps) {
      collect(outsideGridSamples(prevMap.relief?.ramps, nextMap.relief?.ramps, prevMap.width, prevMap.height, region, 0));
    }
  }
  if (outsideCells > 0) {
    return {
      ok: false,
      summary: `${toolName} 호출을 되돌렸습니다: 선택한 드래그 영역 ${rectText} 밖의 타일 ${outsideCells}칸${cellSamples.length ? ` (${cellSamples.join(", ")}${outsideCells > cellSamples.length ? " 외" : ""})` : ""}을 수정했습니다. x=${region.x}..${region.x + region.width - 1}, y=${region.y}..${region.y + region.height - 1} 범위 안에서만 작업하세요.`,
    };
  }

  // 4. 영역 밖 이벤트 추가·수정·삭제 차단.
  const badEvents = outsideEventChanges(prevMap, nextMap, region);
  if (badEvents.length > 0) {
    return {
      ok: false,
      summary: `${toolName} 호출을 되돌렸습니다: 선택한 드래그 영역 ${rectText} 밖의 이벤트를 변경했습니다(${badEvents.slice(0, 4).join(", ")}). 영역 안에서만 이벤트를 배치·수정하세요.`,
    };
  }

  return null;
}
