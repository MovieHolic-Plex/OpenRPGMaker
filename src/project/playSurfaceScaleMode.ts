// project/playSurfaceScaleMode.ts
// 플레이 화면을 창에 어떻게 키우는가(system.playSurfaceScale)와
// 모바일 세로 배치(system.portraitLayout)의 저작 규칙과 기본값.
//
// 2026-11-26 개편:
// - `adaptive`(추천 기본): 고정 480×270 레터박스를 없애고, 창·기기 비율에 맞춰
//   정수 도트 배율을 유지한 채 카메라 시야(논리 가로×세로)를 동적으로 채운다.
//   PC/노트북(1440×900·QHD 등)에서 검은 여백이 사라지고, 폰 세로에서는
//   2배 정수 확대 세로 카메라로 타일·캐릭터 시인성이 2.5배 커진다.
// - `integer`: 고정 논리 해상도 + 정수 배율 + 여백(letterbox). 에메랄드 몬스터 수집·양쪽 전신(1024×768) 기본.
// - `fit`: 고정 논리 해상도를 창에 꽉 맞춤(해상도 미저장 옛 320×240 기본).
//
// `portraitLayout`(모바일 세로 배치, adaptive 모드에서 적용):
// - `ds`(추천 기본): 상단 ~55% 세로 카메라 + 하단 ~45% 전용 대사/전투/패드 덱.
// - `fullbleed`: 화면 100% 전체 월드 + 반투명 플로팅 대사/조작 패드.

import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import type { Project } from "@/project/types";

/**
 * - `adaptive`: 반응형 정수 도트 카메라. 도트는 정수 배율로 선명하고 창·기기 비율에 맞춰 여백 없이 채운다.
 * - `integer`: 고정 해상도 정수 배율. 도트 경계가 깨지지 않고 남는 창은 여백.
 * - `fit`: contain 배율을 내림하지 않는다. 창을 꽉 채우지만 도트 굵기가 1화소씩 섞일 수 있다.
 */
export type PlaySurfaceScaleMode = "adaptive" | "integer" | "fit";

export const PLAY_SURFACE_SCALE_MODES: readonly PlaySurfaceScaleMode[] = ["adaptive", "integer", "fit"];

/**
 * 모바일 세로 화면 배치 방식(adaptive 모드).
 * - `ds`: 상단 ~55% 세로 게임 화면 + 하단 ~45% 전용 대사·전투·조작 덱(추천 기본).
 * - `fullbleed`: 화면 100% 전체 월드 + 반투명 플로팅 UI/패드.
 */
export type PortraitLayoutMode = "ds" | "fullbleed";

export const PORTRAIT_LAYOUT_MODES: readonly PortraitLayoutMode[] = ["ds", "fullbleed"];

export function normalizePlaySurfaceScale(value: unknown): PlaySurfaceScaleMode | undefined {
  return value === "adaptive" || value === "integer" || value === "fit" ? value : undefined;
}

export function normalizePortraitLayout(value: unknown): PortraitLayoutMode | undefined {
  return value === "ds" || value === "fullbleed" ? value : undefined;
}

/** 이 프로젝트를 플레이할 때 쓸 배율 정책. 저작값 > 몬스터 수집/양쪽 전신(정수 고정) > 해상도 저장 여부(반응형 기본). */
export function resolvePlaySurfaceScaleMode(
  project: Pick<Project, "meta"> & {
    readonly system: Pick<Project["system"], "playSurfaceScale" | "playResolution" | "dialogueStyle">;
  },
): PlaySurfaceScaleMode {
  if (isEmeraldMonsterStyle(project)) return "integer";
  const authored = normalizePlaySurfaceScale(project.system.playSurfaceScale);
  if (authored) return authored;
  if (project.system.dialogueStyle === "dual-fullbody-veil") return "integer";
  return project.system.playResolution ? "adaptive" : "fit";
}

/** 모바일 세로 배치 정책. 생략 = `ds`(상단 55% 세로 카메라 + 하단 전용 덱). */
export function resolvePortraitLayout(
  project: { readonly system?: Pick<Project["system"], "portraitLayout"> } | undefined,
): PortraitLayoutMode {
  return normalizePortraitLayout(project?.system?.portraitLayout) ?? "ds";
}
