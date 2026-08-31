// editor/transientEditorChrome.ts
// 조수가 맵을 만진 뒤에 남는 **일시 표시**의 수명.
//
// 실측(2026-08-31): 조수가 타일·이벤트를 고친 뒤에도 맵 위에 `편집 위치 11,8` 배지가
// 그대로 있었다. 그 문자열은 이벤트 레이어 **마지막 클릭** 피드백
// (`renderEventLayerClickFeedback`)인데, 상태를 비우는 경로가 없어 store.replace 가
// 전체 재렌더를 타면 같은 칸에 다시 그려졌다. 질문용 `highlight_map_region` 선택 사각형도
// 턴이 끝난 뒤 남았다. 둘 다 결과물이 아니라 진행 중 크롬이다.

import type { EditActivityOrigin } from "@/editor/editActivityLog";
import type { EventLayerClickFeedback } from "@/editor/editSceneEventMarkers";
import type { MapId } from "@/project/types";

export function retainEventLayerClickFeedback(input: {
  readonly feedback: EventLayerClickFeedback | null;
  readonly currentMapId: MapId | null;
  readonly changeOrigin?: EditActivityOrigin;
  readonly mapChanged?: boolean;
}): EventLayerClickFeedback | null {
  const feedback = input.feedback;
  if (!feedback) return null;
  if (input.mapChanged) return null;
  if (input.changeOrigin === "ai") return null;
  if (input.currentMapId !== null && feedback.mapId !== input.currentMapId) return null;
  return feedback;
}

/** highlight_map_region 이 세운 선택은 사용자 선택이 아니라 질문용 강조다. */
export function shouldClearAiHighlightSelection(highlightedThisTurn: boolean): boolean {
  return highlightedThisTurn;
}
