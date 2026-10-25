// 오프닝 컷 배경으로 «게임 속 맵 그대로»를 쓴다 — resourceId `map-view:<mapId>`.
//
// 맞는 오프닝 그림(스틸)이 없는 게임은 엉뚱한 그림을 깔게 된다(시타마치 VQA before: 도쿄 상점가 자막 위에 미국 교외·서양 목장).
// 이 id 를 image 레이어에 주면 플레이어가 그 맵의 타일 층을 원 크기(칸 = map.tileSize px)로 한 번 그려 그림처럼 쓴다.
// 맵의 어느 부분을 보일지는 레이어 crop(맵 화소 좌표)으로 정한다 — place_opening_background({mapId, focus}) 가 계산해 준다.
// 이벤트(인물)는 그리지 않는다 — 인물은 place_opening_charset_actor 로 위에 얹는다.
import type { GameMap, Project } from "@/project/types";

export const OPENING_MAP_VIEW_PREFIX = "map-view:";

export function openingMapViewResourceId(mapId: string): string {
  return `${OPENING_MAP_VIEW_PREFIX}${mapId}`;
}

/** `map-view:<mapId>` 이면 mapId, 아니면 undefined. */
export function openingMapViewMapId(resourceId: string | undefined): string | undefined {
  if (!resourceId?.startsWith(OPENING_MAP_VIEW_PREFIX)) return undefined;
  const mapId = resourceId.slice(OPENING_MAP_VIEW_PREFIX.length).trim();
  return mapId || undefined;
}

/** 맵 그림 전체 크기(px). */
export function openingMapViewSize(map: GameMap): { width: number; height: number } {
  return { width: map.width * map.tileSize, height: map.height * map.tileSize };
}

/**
 * 무대(stage) 비율 그대로 맵에서 오려 낼 영역(맵 화소). focus = 가운데에 올 칸(기본 맵 가운데).
 * zoom 1 = 맵 화소 1 : 무대 화소 1(도트 무대 384×216 이면 칸 24×13.5개). zoom 2 = 두 배로 당겨 칸 절반만큼.
 * 맵이 무대보다 작으면 맵 안에 들어가는 가장 큰 무대 비율 영역을 쓴다(늘려 그린다).
 */
export function openingMapViewCrop(
  map: GameMap,
  stage: { width: number; height: number },
  focus?: { x: number; y: number },
  zoom = 1,
): { x: number; y: number; width: number; height: number } {
  const full = openingMapViewSize(map);
  const z = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
  let width = stage.width / z, height = stage.height / z;
  if (width > full.width) { width = full.width; height = (width * stage.height) / stage.width; }
  if (height > full.height) { height = full.height; width = (height * stage.width) / stage.height; }
  width = Math.max(1, Math.floor(width)); height = Math.max(1, Math.floor(height));
  const cx = ((focus?.x ?? map.width / 2 - 0.5) + 0.5) * map.tileSize;
  const cy = ((focus?.y ?? map.height / 2 - 0.5) + 0.5) * map.tileSize;
  const x = Math.round(Math.min(Math.max(0, cx - width / 2), full.width - width));
  const y = Math.round(Math.min(Math.max(0, cy - height / 2), full.height - height));
  return { x, y, width, height };
}

/** 프로젝트의 맵마다 쓸 수 있는 map-view id(리소스 검증 목록용). */
export function openingMapViewResourceIds(project: Pick<Project, "maps">): string[] {
  return Object.keys(project.maps ?? {}).map(openingMapViewResourceId);
}
