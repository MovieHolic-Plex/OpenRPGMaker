// editor/locationDrawMode.ts
// 로케이션 레이어가 켜져 있는 동안 캔버스 좌클릭은 타일 도구가 아니다.
// 툴바는 그걸 도구 선택처럼 보여 주고, 타일·이벤트 도구를 다시 고르면 레이어를 끈다.
// 팬은 오버레이가 이미 양보하므로 공존한다.

import { setLocationLayerEnabled, locationLayerState } from "@/editor/mapLocationLayerState";
import type { Layer, Tool } from "@/editor/editorState";

export function isLocationDrawMode(): boolean {
  return locationLayerState().enabled;
}

/** 타일·이벤트 도구를 고르면 구역 그리기를 끝낸다. 팬은 공존. */
export function dismissLocationDrawModeForTool(tool: Tool): void {
  if (tool === "pan") return;
  if (locationLayerState().enabled) setLocationLayerEnabled(false);
}

/** 이벤트 레이어로 가면 맵 위 이벤트를 눌러야 하므로 구역 그리기를 끝낸다. */
export function dismissLocationDrawModeForLayer(layer: Layer): void {
  if (layer === "event" && locationLayerState().enabled) setLocationLayerEnabled(false);
}
