import type { Project } from "../types";
import { DEFAULT_TILESET_ID } from "./constants";

/**
 * 새 야외·마을 맵의 기본 타일셋 = 버들항(beodeul_city).
 * 예전에는 숲마을(forest_harmony)이 있는 옛 프로젝트에서 숲마을을 골랐다(forestHarmony.ts). 숲마을 칩셋은
 * 2026-10-07 저작권 정리로 지웠으므로 언제나 기본 칩셋이다.
 */
export function defaultOutdoorTilesetId(_project?: Pick<Project, "tilesets"> & Partial<Pick<Project, "maps">>): string {
  return DEFAULT_TILESET_ID;
}

/** tilesetId 생략 도구의 대상: 시작 맵 타일셋, 없으면 새 야외 기본. */
export function defaultToolTilesetId(project: Pick<Project, "tilesets" | "maps" | "startMapId">): string {
  const start = project.maps[project.startMapId]?.tilesetId;
  return start && project.tilesets[start] ? start : defaultOutdoorTilesetId(project);
}
