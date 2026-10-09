// player/pictures/pictureTween.ts
// 픽처(그림) 변환 상태의 순수 계산. Show/Move Picture 의 이동·스케일·불투명·회전
// 트윈을 시간 기반으로 보간한다. DOM 렌더러(runtimeDom)는 여기 결과를 적용만 한다.
// 테스트는 이 순수 함수들을 직접 검증한다.

import { applyEasing, type EasingName } from "@/project/easing";
import type { PictureState } from "@/project/session";

export type PictureTransform = {
  readonly x: number;
  readonly y: number;
  // 스케일(%) — RM2K3 는 100 을 기본(원본 크기)으로 사용한다.
  readonly scale: number;
  // 불투명도(0~255) — RM2K3 호환. 255 = 완전 불투명.
  readonly opacity: number;
  // 회전(도).
  readonly rotation: number;
};

export const DEFAULT_PICTURE_TRANSFORM: PictureTransform = {
  x: 0,
  y: 0,
  scale: 100,
  opacity: 255,
  rotation: 0,
};

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.max(0, value);
}

function clampOpacity(value: number): number {
  if (!Number.isFinite(value)) return 255;
  return Math.max(0, Math.min(255, value));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// PictureState(세션 저장 상태) → 렌더 변환값. 선택 필드는 RM2K3 기본으로 보정.
export function pictureTransformFromState(state: PictureState): PictureTransform {
  return {
    x: finiteOr(state.x, 0),
    y: finiteOr(state.y, 0),
    scale: clampScale(finiteOr(state.scale, 100)),
    opacity: clampOpacity(finiteOr(state.opacity, 255)),
    rotation: finiteOr(state.rotation, 0),
  };
}

// 트윈 진행도(0~1). duration<=0 이면 즉시 완료(1). 음수 elapsed 는 0 으로.
export function tweenProgress(elapsedMs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 1;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  return Math.max(0, Math.min(1, elapsedMs / durationMs));
}

// 시간 진행도 → 보간 계수. 끝 판정은 시간 진행도(tweenProgress)로 하고, 보간에만 곡선을 건다.
export function easedTweenProgress(progress: number, easing: EasingName | undefined): number {
  return applyEasing(easing, progress);
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

// 두 변환값 사이 선형 보간. t 는 0~1 로 클램프.
export function interpolatePictureTransform(
  from: PictureTransform,
  to: PictureTransform,
  t: number
): PictureTransform {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 1));
  return {
    x: lerp(from.x, to.x, clamped),
    y: lerp(from.y, to.y, clamped),
    scale: lerp(from.scale, to.scale, clamped),
    opacity: lerp(from.opacity, to.opacity, clamped),
    rotation: lerp(from.rotation, to.rotation, clamped),
  };
}

// 두 변환값이 (렌더 관점에서) 사실상 동일한지. 트윈 시작 여부 판단에 사용.
export function pictureTransformsEqual(a: PictureTransform, b: PictureTransform): boolean {
  const eps = 0.001;
  return (
    Math.abs(a.x - b.x) < eps &&
    Math.abs(a.y - b.y) < eps &&
    Math.abs(a.scale - b.scale) < eps &&
    Math.abs(a.opacity - b.opacity) < eps &&
    Math.abs(a.rotation - b.rotation) < eps
  );
}

// 픽처 번호로 z-order 를 유도한다. RM2K3 는 번호가 클수록 위에 그려진다.
// pictureId 끝의 숫자(pic1, picture_10 등)를 추출; 없으면 0.
export function pictureZIndex(pictureId: string): number {
  const match = pictureId.match(/(\d+)\s*$/);
  if (!match) return 0;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : 0;
}

// CSS transform 문자열 생성(위치는 left/top 로 별도 적용하므로 scale/rotation 만).
export function pictureCssTransform(transform: PictureTransform): string {
  const scale = transform.scale / 100;
  return `scale(${round(scale)}) rotate(${round(transform.rotation)}deg)`;
}

// CSS opacity(0~1) 값.
export function pictureCssOpacity(transform: PictureTransform): number {
  return round(transform.opacity / 255);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
