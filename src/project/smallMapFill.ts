// project/smallMapFill.ts
// 작은 맵 화면 채우기(system.smallMapFill) — 화면보다 작은 방을 정수 캔버스 배율로 키워 화면을 채울지.
//
// 2026-10-28 에 기본으로 켰다(서재 8×9 방이 320×240 의 40% 만 차지했다, playSceneCamera.smallMapFillZoom).
// 2026-11-04 오너 결정 「모든 게임 기본값을 끄기로 해」 — 폴른 스타 플레이에서 실내가 1.333~1.667 배로 「쓸데없이 확대」됐다.
// 이제 생략 = 끔: 작은 맵은 원래 크기로 가운데에 그리고(syncRuntimeCameraBounds) 남는 곳은 여백이다.
// 채우기를 원하는 게임은 system.smallMapFill = true 로 켠다. 기본값을 다시 바꿀 때는 아래 상수 한 줄만 고친다.

import type { Project } from "@/project/types";

/** 저작이 없을 때의 작은 맵 화면 채우기. */
export const SMALL_MAP_FILL_DEFAULT = false;

export function normalizeSmallMapFill(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** 이 프로젝트가 작은 맵을 화면에 채우는가. 저작값 > 기본값. */
export function resolveSmallMapFill(project: { readonly system?: Pick<Project["system"], "smallMapFill"> } | undefined): boolean {
  return normalizeSmallMapFill(project?.system?.smallMapFill) ?? SMALL_MAP_FILL_DEFAULT;
}
