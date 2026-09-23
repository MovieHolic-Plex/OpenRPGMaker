// project/mapViewScale.ts
// 타일 크기가 다른 맵을 오갈 때 화면이 튀지 않게 하는 기준 — 기준 칸·세계 배율·픽셀 밀도.
//
// 왜 필요한가(2026-09-24): 한 프로젝트에 16px 마을과 32px 던전이 섞이면, 카메라 배율 1 에서
// 32px 맵은 한 화면에 칸 수가 절반만 보여 문을 지나는 순간 세상이 두 배로 줌인됐다. 캐릭터
// 자동 배율은 맵 칸 기준이라 24×32 캐릭터는 그대로 1배 → 주변만 커지고 캐릭터는 상대적으로
// 반토막이 됐다. 제작자는 타일이 몇 px 인지 몰라도 되어야 한다.
//
// 규칙: 프로젝트의 **기준 칸**(가장 많은 맵이 쓰는 타일 크기)을 정하고, 모든 맵을 그 칸 크기로
// 보여준다. 기준과 다른 맵은 카메라가 `기준 / 맵 칸` 만큼 확대·축소하고, 걸어다니는 캐릭터는
// 세계에서 `맵 칸 / 기준` 배로 그려 화면 크기가 같게 남는다. 타일 크기가 하나뿐인 프로젝트는
// 모든 배율이 1 이라 이전과 픽셀 단위로 같다 — 32px 프로젝트의 「캐릭터 1배」 결정도 그대로다.
//
// 기준보다 큰 칸의 맵을 축소해 보여주면 도트가 빠진다. 그래서 캔버스 픽셀 밀도를 정수배로
// 올린다(`playPixelDensity`) — 논리 해상도·DOM 레이아웃은 그대로, 캔버스만 촘촘해진다.

import { mapTileSize } from "@/project/tileGeometry";
import type { GameMap, PlayResolution } from "@/project/types";

type ProjectMaps = { readonly maps: Readonly<Record<string, GameMap>>; readonly startMapId?: string };

/** 캔버스 한 변 상한. 1920×1080 논리 해상도에 밀도 2 까지다. */
const MAX_CANVAS = { width: 3840, height: 2160 } as const;

const referenceCache = new WeakMap<object, number>();

/**
 * 가장 많은 맵이 쓰는 타일 크기. 동률이면 시작 맵의 크기, 그것도 동률 밖이면 작은 쪽.
 * 맵 하나를 다른 크기로 들여와도 프로젝트 전체의 보이는 크기가 바뀌지 않게 다수결로 정한다.
 */
export function projectReferenceTileSize(project: ProjectMaps): number {
  const cached = referenceCache.get(project.maps);
  if (cached !== undefined) return cached;
  const counts = new Map<number, number>();
  for (const map of Object.values(project.maps)) {
    const size = mapTileSize(map);
    counts.set(size, (counts.get(size) ?? 0) + 1);
  }
  const start = project.startMapId ? project.maps[project.startMapId] : undefined;
  const startSize = start ? mapTileSize(start) : undefined;
  const ranked = [...counts].sort(([a, countA], [b, countB]) =>
    countB - countA || Number(b === startSize) - Number(a === startSize) || a - b);
  const best = ranked[0]?.[0] ?? mapTileSize(undefined);
  referenceCache.set(project.maps, best);
  return best;
}

/** 이 맵에서 걸어다니는 캐릭터·연출이 세계 좌표로 몇 배여야 기준 맵과 같은 화면 크기인가. */
export function mapWorldScale(tileSize: number, referenceTileSize: number): number {
  return tileSize > 0 && referenceTileSize > 0 ? tileSize / referenceTileSize : 1;
}

/**
 * 캔버스 픽셀 밀도(정수). 기준보다 큰 칸의 맵이 있으면 그 맵을 1:1 로 그릴 만큼 올린다.
 * 프로젝트 기본 카메라 배율이 이미 확대(>1)면 그만큼 덜 필요하다. 한 크기뿐이면 1.
 */
export function playPixelDensity(
  project: ProjectMaps,
  resolution: Readonly<PlayResolution>,
  cameraZoom = 1,
): number {
  const reference = projectReferenceTileSize(project);
  let largest = reference;
  for (const map of Object.values(project.maps)) largest = Math.max(largest, mapTileSize(map));
  if (largest <= reference) return 1;
  const wanted = Math.ceil(largest / (reference * Math.max(1, cameraZoom)));
  const cap = Math.floor(Math.min(MAX_CANVAS.width / resolution.width, MAX_CANVAS.height / resolution.height));
  return Math.max(1, Math.min(wanted, cap));
}
