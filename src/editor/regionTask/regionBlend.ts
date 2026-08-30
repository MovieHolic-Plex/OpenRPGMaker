// 영역 다듬기의 마감과 검증 — 이음새를 결정론으로 정돈하고, "정말 이어졌는가" 를 기계로 센다.
//
// 두 가지를 한다:
//  1) polishRegionSeams — 영역+1칸에 polishMapTerrain 을 돌려 오토타일 변형을 다시 계산한다.
//     모래·흙길 같은 지형은 저장 시점 오토타일이라(물/호수만 렌더 시점 합성) 영역 안만 칠하면
//     경계가 계단식 직각으로 굳는다. polishMapTerrain 은 **그룹 멤버 칸의 변형만** 고치므로
//     "재질은 그대로, 이음새 모양만" 이라는 계약이 구조적으로 보장된다.
//  2) analyzeRegionBlend — 경계 셀과 바로 밖 이웃을 비교해 연속성 비율·끊긴 연결·새로 막힌 진입을
//     센다. 사람이 승인 화면에서 볼 근거이고, 차단은 하지 않는다(경계가 조금 어긋난 초안조차
//     적용을 못 하게 하면 사용자가 막힌다).
//
// 순수 함수 — store/DOM 의존 없음.
import { cloneDetachedDraft } from "@/editor/detachedDraftMemory";
import { polishMapTerrain } from "@/editor/tools/v3/terrainPolish";
import { isPassable } from "@/project/collision";
import type { MapId, Project } from "@/project/types";
import type { RegionRect } from "./clipToRegion";
import { categorizeRegionCell, regionBorderPairs } from "./regionSurroundings";

export interface RegionSeamResult {
  readonly project: Project;
  /** 영역 **밖**에서 변형이 바뀐 칸 수(= 허용한 1칸 이음새의 실제 규모). */
  readonly seamCells: number;
  /** 영역 안까지 포함해 polishMapTerrain 이 고친 총 칸 수. */
  readonly polishedCells: number;
}

export interface RegionBlendBreak {
  readonly x: number;
  readonly y: number;
  readonly kind: "road" | "water";
}

export interface RegionBlendReport {
  /** 0..100. 경계 연속성 비율에서 끊긴 연결·막힌 진입 벌점을 뺀 값. 결정론 휴리스틱이다. */
  readonly score: number;
  readonly matchedEdgeCells: number;
  readonly totalEdgeCells: number;
  /** 바깥이 길/물인데 안쪽이 이어받지 않은 칸. */
  readonly brokenCrossings: readonly RegionBlendBreak[];
  /** 바깥에서 들어올 수 있었는데 이 초안이 새로 막은 칸. */
  readonly newlyBlockedEntrances: readonly { readonly x: number; readonly y: number }[];
}

/** 벌점 상한 — 연속성 점수가 벌점만으로 0이 되면 개선 여부를 비교할 수 없다. */
const MAX_PENALTY = 60;
const PENALTY_PER_BREAK = 10;

/** region 을 margin 만큼 키워 맵 안으로 자른다. */
export function expandRegion(
  region: RegionRect,
  margin: number,
  bounds?: { readonly width: number; readonly height: number },
): RegionRect {
  const x = region.x - margin;
  const y = region.y - margin;
  const right = region.x + region.width + margin;
  const bottom = region.y + region.height + margin;
  const clampedX = Math.max(0, x);
  const clampedY = Math.max(0, y);
  const clampedRight = bounds ? Math.min(bounds.width, right) : right;
  const clampedBottom = bounds ? Math.min(bounds.height, bottom) : bottom;
  return {
    x: clampedX,
    y: clampedY,
    width: Math.max(0, clampedRight - clampedX),
    height: Math.max(0, clampedBottom - clampedY),
  };
}

/**
 * 영역+1칸의 지형 오토타일을 다시 계산한 새 프로젝트를 돌려준다. 입력은 변형하지 않는다.
 * 멱등이다 — 승인 시 재검토에서 다시 불려도 결과가 같다.
 */
export function polishRegionSeams(project: Project, mapId: MapId, region: RegionRect): RegionSeamResult {
  const sourceMap = project.maps[mapId];
  if (!sourceMap) return { project, seamCells: 0, polishedCells: 0 };
  const rect = expandRegion(region, 1, sourceMap);
  if (rect.width === 0 || rect.height === 0) return { project, seamCells: 0, polishedCells: 0 };

  const next = cloneDetachedDraft(project);
  const map = next.maps[mapId];
  if (!map) return { project, seamCells: 0, polishedCells: 0 };
  const result = polishMapTerrain(map, next.tilesets[map.tilesetId], {
    x: rect.x,
    y: rect.y,
    w: rect.width,
    h: rect.height,
  });
  if (result.changed === 0) return { project, seamCells: 0, polishedCells: 0 };

  // 영역 밖에서 몇 칸이 바뀌었는지 센다 — 승인 화면이 "경계 N칸 정돈" 으로 밝히는 값이다.
  let seamCells = 0;
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      if (x >= region.x && x < region.x + region.width && y >= region.y && y < region.y + region.height) continue;
      const index = y * map.width + x;
      if (map.lowerTiles[index] !== sourceMap.lowerTiles[index]) seamCells += 1;
    }
  }
  return { project: next, seamCells, polishedCells: result.changed };
}

/**
 * 경계 연속성 리포트. base 를 주면 "이 초안이 **새로** 막은 진입" 만 센다
 * (원래부터 벽이던 경계를 지적하면 모든 실내·건물 영역이 매번 경고를 받는다).
 */
export function analyzeRegionBlend(input: {
  readonly project: Project;
  readonly mapId: MapId;
  readonly region: RegionRect;
  readonly base?: Project;
}): RegionBlendReport {
  const { project, mapId, region } = input;
  const map = project.maps[mapId];
  if (!map) {
    return { score: 0, matchedEdgeCells: 0, totalEdgeCells: 0, brokenCrossings: [], newlyBlockedEntrances: [] };
  }
  const tileset = project.tilesets[map.tilesetId];
  const baseMap = input.base?.maps[mapId];
  const sameSize = baseMap ? baseMap.width === map.width && baseMap.height === map.height : false;
  const brokenCrossings: RegionBlendBreak[] = [];
  const newlyBlockedEntrances: { x: number; y: number }[] = [];
  let matched = 0;
  let total = 0;

  for (const pair of regionBorderPairs(map, region)) {
    const insideIndex = pair.inside.y * map.width + pair.inside.x;
    const outsideIndex = pair.outside.y * map.width + pair.outside.x;
    const insideCategory = categorizeRegionCell(map, insideIndex, tileset);
    const outsideCategory = categorizeRegionCell(map, outsideIndex, tileset);
    total += 1;
    if (insideCategory === outsideCategory) matched += 1;
    if ((outsideCategory === "road" || outsideCategory === "water") && insideCategory !== outsideCategory) {
      brokenCrossings.push({ x: pair.inside.x, y: pair.inside.y, kind: outsideCategory });
    }
    if (!input.base || !baseMap || !sameSize) continue;
    // 바깥에서 들어올 수 있는 칸인데 안쪽이 막혔나 — base 에서도 막혔다면 이 초안의 책임이 아니다.
    if (!isPassable(project, map, pair.outside.x, pair.outside.y)) continue;
    if (isPassable(project, map, pair.inside.x, pair.inside.y)) continue;
    if (!isPassable(input.base, baseMap, pair.inside.x, pair.inside.y)) continue;
    newlyBlockedEntrances.push({ x: pair.inside.x, y: pair.inside.y });
  }

  const continuity = total === 0 ? 100 : Math.round((matched / total) * 100);
  const penalty = Math.min(
    MAX_PENALTY,
    (brokenCrossings.length + newlyBlockedEntrances.length) * PENALTY_PER_BREAK,
  );
  return {
    score: Math.max(0, continuity - penalty),
    matchedEdgeCells: matched,
    totalEdgeCells: total,
    brokenCrossings,
    newlyBlockedEntrances,
  };
}

const BREAK_KIND_LABEL: Readonly<Record<RegionBlendBreak["kind"], string>> = {
  road: "길",
  water: "물",
};

/** 경고 issue 문장. 좌표를 남겨 사용자가 어디를 볼지 알 수 있게 한다. */
export function describeBlendBreak(next: RegionBlendBreak): string {
  return `바깥 ${BREAK_KIND_LABEL[next.kind]}이 영역 경계 (${next.x},${next.y})에서 끊깁니다 — 영역 안으로 이어지지 않았습니다.`;
}

export function describeBlockedEntrance(point: { readonly x: number; readonly y: number }): string {
  return `바깥에서 들어오던 칸 (${point.x},${point.y})이 새로 막혔습니다.`;
}
