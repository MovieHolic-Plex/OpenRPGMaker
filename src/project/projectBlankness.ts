// project/projectBlankness.ts
// "아직 아무것도 안 만든 프로젝트인가" 판정. 첫 방문 브리핑(「어떤 게임을 만들까요?」·「빈 맵으로 시작」)이
// 이미 만든 프로젝트 위에 뜨지 않게 하는 관문이 이것을 본다.
//
// 왜 필요한가 (2026-09-28): 브리핑 게이트는 localStorage 의 닫음 표시만 봤다. 표시는 출처(origin)마다
// 따로라 워크트리 dev 포트·팀 호스트 주소·새 프로필에서는 늘 비어 있고, 그때마다 맵과 이벤트가 가득한
// 프로젝트 위에 「빈 맵으로 시작」이 떴다. 프로젝트 내용을 직접 보면 출처와 무관하게 맞는다.

import { TILE } from "@/project/defaults/constants";
import type { GameMap, Project } from "@/project/types";

function allEqual(values: readonly number[] | undefined, value: number): boolean {
  return values === undefined || values.every((entry) => entry === value);
}

/**
 * 만들어진 직후 그대로인 맵인가 — 바닥 한 종류로 균일하고, 그 위 층·그림자·높이·이벤트가 하나도 없다.
 * 길 한 칸, 가구 하나, 이벤트 하나라도 있으면 저작이 시작된 맵이다.
 */
export function isUntouchedMap(map: GameMap): boolean {
  if (map.events.length > 0) return false;
  if (Object.keys(map.lowerTileStacks ?? {}).length > 0) return false;
  if (Object.keys(map.upperTileStacks ?? {}).length > 0) return false;
  if (!allEqual(map.upperTiles, TILE.EMPTY)) return false;
  if (!allEqual(map.lowerOverlayTiles, TILE.EMPTY)) return false;
  if (!allEqual(map.upperOverlayTiles, TILE.EMPTY)) return false;
  if (!allEqual(map.shadowBits, 0)) return false;
  if (!allEqual(map.relief?.levels, 0)) return false;
  const first = map.lowerTiles[0];
  return first === undefined || allEqual(map.lowerTiles, first);
}

/**
 * 첫 방문 브리핑을 보여 줘도 되는 빈 프로젝트인가. 맵이 둘 이상이거나, 하나뿐인 맵에 손이 갔거나,
 * 공통 이벤트가 있으면 이미 무언가를 만든 프로젝트다.
 */
export function isBlankStartProject(project: Pick<Project, "maps" | "commonEvents">): boolean {
  if (project.commonEvents.length > 0) return false;
  const maps = Object.values(project.maps);
  if (maps.length > 1) return false;
  return maps.every(isUntouchedMap);
}
