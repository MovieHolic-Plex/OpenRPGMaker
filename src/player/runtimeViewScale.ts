// 플레이 씬이 맵마다 쓰는 보기 배율 — 규칙의 정본은 @/project/mapViewScale.
import { mapWorldScale, projectReferenceTileSize } from "@/project/mapViewScale";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap } from "@/project/types";

/** createPlayGame 이 캔버스를 만들 때 정한 픽셀 밀도를 넣어 두는 registry 키. */
export const PLAY_PIXEL_DENSITY_KEY = "playPixelDensity";

type SceneLike = {
  readonly map?: GameMap;
  readonly game?: { readonly registry?: { get(key: string): unknown } };
};

/** 캔버스 픽셀 ÷ 논리 픽셀. 화면 고정 레이어와 DOM 좌표 환산이 쓴다. 밀도가 없으면 1. */
export function runtimePixelDensity(scene: SceneLike): number {
  const value = scene.game?.registry?.get(PLAY_PIXEL_DENSITY_KEY);
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 1;
}

/** 현재 맵에서 세계 1px 이 기준 맵 세계 몇 px 인가(캐릭터·연출 크기 보정). 한 크기뿐이면 1. */
export function runtimeMapWorldScale(scene: SceneLike): number {
  return mapWorldScale(mapTileSize(scene.map), projectReferenceTileSize(store.getCurrent()));
}

/** 저작 배율 1 일 때의 카메라 배율: 밀도 × 기준 칸 / 맵 칸. 모든 맵이 같은 칸 수를 보여준다. */
export function runtimeMapViewZoom(scene: SceneLike): number {
  return runtimePixelDensity(scene) / runtimeMapWorldScale(scene);
}

/**
 * 맵 위 도트 글자(출구 이름표·떠오르는 「+ 이름」)를 **논리 화면** 글꼴 격자 그대로 그리는 해상도·배율.
 * 글꼴 크기 N px 은 논리 화면(예: 480×270)에서 N px 이 된다 — 캔버스 픽셀이 아니다.
 * 2026-10-31 폴른 스타 2막 첫 플레이: 밀도 2 캔버스(960×540)에서 `setScale(1 / 카메라 배율)` 로 그린 12px 이름표가
 * 논리 화면에서 6px 로 줄어 읽을 수 없었다. 텍스처 해상도는 밀도(캔버스 1화소 = 텍스처 1화소), 세계 크기 = 밀도 ÷ 카메라 배율.
 */
export function runtimeLogicalTextScale(scene: SceneLike, cameraZoom: number): { readonly resolution: number; readonly scale: number } {
  const density = runtimePixelDensity(scene);
  const zoom = Number.isFinite(cameraZoom) && cameraZoom > 0 ? cameraZoom : 1;
  return { resolution: Math.max(1, Math.round(density)), scale: density / zoom };
}
