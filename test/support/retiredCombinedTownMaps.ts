import { COMBINED_TOWN_TILESET_ID, TILE } from "../../src/project/defaults/constants";
import type { GameMap, Project } from "../../src/project/types";
import { withRetiredEasyRpgTilesets } from "./retiredEasyRpgTilesets";

/**
 * 2026-10-07 저작권 정리 전의 빈 프로젝트를 재현한다 — 그때는 기본 타일셋이 합본 마을이었고, 시작 맵도 합본 마을 풀밭이었다.
 *
 * 왜: 공정 도구(build_wall·build_roof·lay_path·arrange_rows)·클러스터 규칙 테스트는 합본 마을 하네스 어휘(9분할 벽·벤치·호수 오토타일)와
 * 그 칸 번호(TILE.GRASS=240·260·290…)를 쓴다. withRetiredEasyRpgTilesets 로 정의만 되살리면 시작 맵은 여전히 버들항(beodeul_city)을 가리켜
 * 도구가 버들항 재료를 찾다 실패한다. 버들항에서 240 은 벽이다(defaultProject.ts 주석).
 * 맵을 합본 마을로 돌리고 바닥을 그 풀밭으로 다시 깐다.
 */
export function useRetiredCombinedTown(map: GameMap): GameMap {
  map.tilesetId = COMBINED_TOWN_TILESET_ID;
  map.lowerTiles.fill(TILE.GRASS);
  map.upperTiles.fill(TILE.EMPTY);
  return map;
}

/** 합본 마을 정의를 되살리고 모든 맵을 합본 마을 풀밭으로 돌린 프로젝트. */
export function withRetiredCombinedTownMaps<T extends Project>(project: T): T {
  withRetiredEasyRpgTilesets(project);
  for (const map of Object.values(project.maps)) useRetiredCombinedTown(map);
  return project;
}
