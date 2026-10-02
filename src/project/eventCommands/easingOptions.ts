import { EASING_LABELS, EASING_NAMES } from "@/project/easing";
import { BLEND_MODE_LABELS, BLEND_MODE_NAMES } from "@/project/blendMode";
import type { M2CommandFieldOption } from "./m2Catalog";

/** 그림 이동·카메라 제어의 「움직임 곡선」 선택지. 값과 이름의 정본은 `@/project/easing` 이다. */
export const EASING_OPTIONS: readonly M2CommandFieldOption[] = EASING_NAMES.map((value) => ({
  value,
  label: EASING_LABELS[value],
}));

/**
 * 그림 이동의 「겹치기」 선택지. 첫 값 keep 은 «앞 그림의 겹치기 그대로» — 기본값이 보통이면
 * 이동 명령 하나가 빛기둥(더하기)을 보통으로 되돌린다.
 */
export const PICTURE_BLEND_OPTIONS: readonly M2CommandFieldOption[] = [
  { value: "keep", label: "그대로" },
  ...BLEND_MODE_NAMES.map((value) => ({ value, label: BLEND_MODE_LABELS[value] })),
];
