// editor/locationDrawMode.ts
// 로케이션 레이어가 켜져 있는 동안 캔버스 좌클릭은 타일 도구가 아니다.
// 툴바는 그걸 도구 선택처럼 보여 주고, 타일·이벤트 도구를 다시 고르면 레이어를 끈다.
// 팬은 오버레이가 이미 양보하므로 공존한다.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { setLocationLayerEnabled, locationLayerState, subscribeLocationLayer } from "@/editor/mapLocationLayerState";

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

/**
 * 도구가 바뀌면 구역 그리기를 끝내는 **단일 감시자**.
 *
 * 왜 필요한가: editorState.set({ tool }) 을 직접 쓰는 진입점이 열 곳 남짓이다(팔레트 칸,
 * 사이드바 레이어, 구조 킷 배치, 건축 팔레트, 영역 도구…). 거기에 각각 한 줄씩 붙이면 다음에
 * 생기는 진입점이 조용히 빠진다 — 실제로 그렇게 팔레트와 사이드바 레이어가 빠져 있었다
 * (2026-09-11 적대적 리뷰). 켠 순간의 도구를 기억해 두고 전이를 여기서 한 번만 잡는다.
 * 팬도 도구 선택이다 — 「팬 갔다가 칠하기」는 그리기를 끝내는 전이다.
 */
let toolWhenEnabled: Tool | null = null;
let layerWhenEnabled: Layer | null = null;

export function installLocationDrawModeGuard(): () => void {
  // 켜진 상태로 복원/새로고침되면 첫 상태 변화에 곧바로 꺼지면 안 된다 — 설치 시점을 기준선으로 잡는다.
  toolWhenEnabled = locationLayerState().enabled ? editorState.get().tool : null;
  layerWhenEnabled = locationLayerState().enabled ? editorState.get().layer : null;
  const offLayer = subscribeLocationLayer(() => {
    if (!locationLayerState().enabled) {
      toolWhenEnabled = null;
      layerWhenEnabled = null;
      return;
    }
    toolWhenEnabled = editorState.get().tool;
    layerWhenEnabled = editorState.get().layer;
  });
  const offEditor = editorState.subscribe((state) => {
    if (!locationLayerState().enabled) return;
    // 팬은 기준선을 바꾸지 않는다 — 지도를 보려고 밀었다가 돌아온 사람에게서
    // 그리기를 빼앗으면 안 된다.
    if (state.tool === "pan") return;
    // 이벤트 레이어는 맵 위 이벤트를 눌러야 하므로 끊는다. 그 외 레이어 전환
    // (바닥↔덧그림)은 로케이션 사각형과 무관하므로 유지하고 기준선만 갱신한다.
    const enteredEventLayer = state.layer === "event" && layerWhenEnabled !== "event";
    if (state.layer !== layerWhenEnabled && !enteredEventLayer) {
      layerWhenEnabled = state.layer;
      return;
    }
    if (state.tool !== toolWhenEnabled || enteredEventLayer) setLocationLayerEnabled(false);
  });
  return () => {
    offLayer();
    offEditor();
    toolWhenEnabled = null;
    layerWhenEnabled = null;
  };
}
