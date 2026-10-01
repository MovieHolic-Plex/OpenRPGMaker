import { EASING_LABELS, EASING_NAMES } from "@/project/easing";
import type { M2CommandFieldOption } from "./m2Catalog";

/** 그림 이동·카메라 제어의 「움직임 곡선」 선택지. 값과 이름의 정본은 `@/project/easing` 이다. */
export const EASING_OPTIONS: readonly M2CommandFieldOption[] = EASING_NAMES.map((value) => ({
  value,
  label: EASING_LABELS[value],
}));
