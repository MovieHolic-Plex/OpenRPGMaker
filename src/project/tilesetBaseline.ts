// 그림체(칩셋 계열) 기준 맵 — 실행기 계열 검사(toolRunner)와 칩셋 질문 도구(ask_tileset_change)가 같은 판정을 쓴다.

import { DEFAULT_TILESET_ID } from "@/project/defaults/constants";
import { EXTRA_LAYER_KEYS } from "@/project/mapLayers";
import { tilesetFamily } from "@/project/tilesetFamily";
import type { GameMap, Project } from "@/project/types";

/** edit_world_terrain 이 만든 세계 지도 — 칩셋이 그 맵 전용 `worldmap_<mapId>` 다. */
export function isWorldmapKitMap(map: GameMap): boolean {
  return Boolean(map.worldmapSource) && map.tilesetId === `worldmap_${map.id}`;
}

/**
 * 기본 칩셋 한 가지 타일로만 채우고 이벤트도 없는 맵 — 새 프로젝트의 빈 시작 맵처럼 사용자가 아직 그림체를 고르지 않은 맵.
 * 사용자가 다른 칩셋을 고른 빈 맵(업로드 칩셋 등)은 고른 것이므로 기준으로 남는다.
 */
export function isBlankCanvasMap(map: GameMap): boolean {
  if (map.tilesetId !== DEFAULT_TILESET_ID || map.events.length > 0 || map.upperTiles.some((t) => t >= 0)) return false;
  if (EXTRA_LAYER_KEYS.some((key) => map[key]?.some((t) => key === "shadowBits" ? t !== 0 : t >= 0))) return false;
  if (map.relief?.levels.some((level) => level !== 0) || map.relief?.ramps?.some((ramp) => ramp !== 0)
    || map.relief?.wallDecor?.length || map.doodadGroups?.length) return false;
  const first = map.lowerTiles[0];
  return map.lowerTiles.every((t) => t === first);
}

/**
 * 그림체 기준 맵. 보는 맵이 세계 지도(지도 그림을 자른 전용 칩셋)거나 빈 캔버스(새 프로젝트의 빈 시작 맵)면 그 칩셋은 사용자가 고른 그림체가 아니다 —
 * 프로젝트에서 실제로 칠한 맵 중 가장 많은 계열의 맵을 기준으로, 그런 맵이 없으면 기준 없음(검사 안 함 — 조수가 처음 고른 계열이 다음부터 기준이 된다).
 * 실측(2026-10-03 조선 시험): 빈 버들항 시작 맵 때문에 조선 고을을 로마풍 버들항 칩셋으로 깔았다.
 */
export function familyBaselineMap(project: Project, viewed: GameMap): GameMap | undefined {
  if (!isWorldmapKitMap(viewed) && !isBlankCanvasMap(viewed)) return viewed;
  const painted = Object.values(project.maps).filter((map) => !isWorldmapKitMap(map) && !isBlankCanvasMap(map));
  if (!painted.length) return undefined;
  const counts = new Map<string, number>();
  for (const map of painted) {
    const family = tilesetFamily(project, map.tilesetId);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  return painted.find((map) => tilesetFamily(project, map.tilesetId) === top);
}
