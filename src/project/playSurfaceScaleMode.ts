// project/playSurfaceScaleMode.ts
// 플레이 화면을 창에 어떻게 키우는가(system.playSurfaceScale)의 저작 규칙과 기본값.
//
// 2026-10-20 결정: 새 기본 화면 480×270 은 FHD 에서 4배, 4K 에서 8배로 꽉 차고 QHD(5배)에서만
// 얇은 여백이 남는다. 그래서 도트 굵기가 고른 정수 배율 + 여백(letterbox)을 기본으로 둔다.
// 창이 1배보다 작을 때만 calculatePlaySurfaceScale 이 비정수로 줄인다.
// 예외: 해상도를 저장하지 않은 옛 프로젝트(320×240)는 2026-10-04 결정대로 창에 꽉 맞춘다(fit) —
// 1280×900 창에서 정수 배율이면 960×720 만 그려서(면적 60%) 바꾼 결정이고, 기존 프로젝트를 말없이 바꾸지 않는다.

import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import type { Project } from "@/project/types";

/**
 * - `integer`: 정수 배율. 도트 경계가 깨지지 않고 남는 창은 여백.
 * - `fit`: contain 배율을 내림하지 않는다. 창을 꽉 채우지만 도트 굵기가 1화소씩 섞일 수 있다.
 */
export type PlaySurfaceScaleMode = "integer" | "fit";

export const PLAY_SURFACE_SCALE_MODES: readonly PlaySurfaceScaleMode[] = ["integer", "fit"];

export function normalizePlaySurfaceScale(value: unknown): PlaySurfaceScaleMode | undefined {
  return value === "integer" || value === "fit" ? value : undefined;
}

/** 이 프로젝트를 플레이할 때 쓸 배율 정책. 저작값 > 몬스터 수집(정수 고정) > 해상도 저장 여부. */
export function resolvePlaySurfaceScaleMode(
  project: Pick<Project, "meta"> & { readonly system: Pick<Project["system"], "playSurfaceScale" | "playResolution"> },
): PlaySurfaceScaleMode {
  if (isEmeraldMonsterStyle(project)) return "integer";
  const authored = normalizePlaySurfaceScale(project.system.playSurfaceScale);
  if (authored) return authored;
  return project.system.playResolution ? "integer" : "fit";
}
