// 조수 v2 장소 빌더 목록 — 명세 종류(type·style)로 하나를 고른다. 앞에 있는 것이 먼저.
import type { PlaceBuilder, PlaceSpec } from "../types";

export const PLACE_BUILDERS: PlaceBuilder[] = [];

export function builderFor(spec: PlaceSpec): PlaceBuilder | undefined {
  return PLACE_BUILDERS.find((builder) => builder.accepts(spec));
}
