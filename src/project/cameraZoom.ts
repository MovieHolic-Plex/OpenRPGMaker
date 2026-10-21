// project/cameraZoom.ts
// 프로젝트 기본 카메라 배율의 저작 규칙 — 상수·클램프·정리.
//
// 왜 system 에 있는가(2026-09-22): 줌은 원래 연출 상태(session.camera.zoom, 이벤트 명령
// m2-201)로만 존재했다. 그래서 고해상도 배경(1920x1080)을 1:1 로 쓰려면 맵마다 auto
// 이벤트를 심어 줌을 걸어야 했고 새 맵에서는 1 로 돌아갔다. 기본값은 프로젝트가 정하고
// 연출 명령은 그 위에 일시적으로 덮어쓰는 것이 맞는 구조다.
//
// 배율 범위의 정본이 여기 있는 이유: 런타임(playSceneCamera)과 저작 정규화가 같은 값을
// 봐야 «저장은 됐는데 플레이에서는 다른 배율» 이 안 생긴다. 런타임이 이 모듈을 import 한다.

import type { SystemRecords } from "@/project/types";

/**
 * 카메라 배율 범위. 하한 0.25 는 멀리 보기, 상한 6 은 «고해상도 + 확대» 조합이다.
 *
 * 왜 상한이 4 가 아닌가: 1920x1080 배경 아트를 무손실(1:1)로 쓰려면 게임 해상도를
 * 1440x1080 으로 두고 배율 4.5 가 필요하다(시야 20x15 타일 = 320x240 과 동일,
 * 배경 배율 0.2222 x 4.5 = 1.0). 4 로는 시야가 22x17 타일이 되어 클래식과 어긋난다.
 */
export const CAMERA_ZOOM_LIMITS = { min: 0.25, max: 6 } as const;

/** 배율 1 은 «클래식» 이라 저장하지 않는다 — 생략이 곧 기본값이고 옛 JSON 바이트가 유지된다. */
export const DEFAULT_CAMERA_ZOOM = 1;

/**
 * 저작값 정리. 유한하지 않거나 1 이면 undefined(= 필드 제거), 범위를 넘으면 클램프한다.
 * 1 을 지우는 이유는 playResolution 이 기본값을 생략으로 저장하는 것과 같다.
 */
export function normalizeCameraZoom(
  value: unknown,
  options: { readonly keepDefault?: boolean } = {},
): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  const clamped = Math.min(CAMERA_ZOOM_LIMITS.max, Math.max(CAMERA_ZOOM_LIMITS.min, value));
  if (!options.keepDefault && clamped === DEFAULT_CAMERA_ZOOM) return undefined;
  return clamped;
}

/** 양쪽 전신 대화창 프로젝트는 배율 생략이 3.2 를 뜻하므로 작가가 고른 1 도 값으로 남긴다(playResolution 과 같은 규칙). */
function keepsExplicitDefaultZoom(system: Pick<SystemRecords, "dialogueStyle"> | undefined): boolean {
  return system?.dialogueStyle === "dual-fullbody-veil";
}

/** 플레이·편집기가 쓰는 유효 배율. 저작이 없으면 1. */
export function resolveCameraZoom(
  system: Pick<SystemRecords, "cameraZoom" | "dialogueStyle" | "playResolution"> | undefined,
): number {
  const normalized = normalizeCameraZoom(system?.cameraZoom, { keepDefault: true });
  if (normalized !== undefined) return normalized;
  // 양쪽 전신 승격(1024×768·3.2배)은 해상도를 아무도 안 정한 옛 프로젝트에만 — resolvePlayResolution 과 같은 조건.
  if (system?.dialogueStyle === "dual-fullbody-veil" && system.playResolution === undefined) return 3.2;
  return DEFAULT_CAMERA_ZOOM;
}

/** 편집기 입력용 저장 함수 — 1 이면 필드를 지운다. */
export function storeCameraZoom(system: SystemRecords, value: unknown): void {
  const normalized = normalizeCameraZoom(value, { keepDefault: keepsExplicitDefaultZoom(system) });
  if (normalized === undefined) delete system.cameraZoom;
  else system.cameraZoom = normalized;
}
