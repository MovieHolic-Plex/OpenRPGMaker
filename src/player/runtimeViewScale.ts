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
