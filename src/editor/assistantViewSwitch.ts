// editor/assistantViewSwitch.ts
// 조수가 사용자 화면을 갈아 끼우는 **모든** 경로가 지나는 한 문.
//
// 여기 있는 이유는 순환 때문이다: 조합 모듈인 `editorReferenceNavigation` 은 `agentFocus` 를
// 부르므로, 그쪽에 이 문을 두면 `agentFocus → editorReferenceNavigation → agentFocus` 가 된다.
//
// 규약: `apply()` 안에 **화면이 바뀌는 일 전부**를 넣어라(맵 선택·카메라·강조). 디졸브가
// 걸리면 그 묶음이 다 덮인 뒤에 한 번에 실행되므로, 절반만 넣으면 나머지 절반은 베일 밖에서
// 그대로 덜컹인다.

import { planAssistantViewTransition } from "@/editor/assistantViewTransition";
import { canDissolveMapView, dissolveMapView } from "@/editor/mapDissolveVeil";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { prefersReducedMotion } from "@/util/reducedMotion";
import type { MapId } from "@/project/types";

/**
 * 지금 **화면에 실제로 그려져 있는** 맵.
 *
 * `editorState.currentMapId` 를 그냥 읽으면 안 된다 — 부팅 직후와 프로젝트 교체 직후에는
 * null 인데 씬은 `startMapId` 를 그리고 있다(`EditScene.mapId()` 가 같은 해석을 한다).
 * 그 null 을 «아무것도 안 열림» 으로 읽으면 같은 맵 안의 이동이 맵 전환으로 오인되어,
 * 부드러운 팬이 사라지고 대신 안 보이는 크로스페이드가 걸린다.
 */
function visibleMapId(): MapId | null {
  return resolveCurrentMapId();
}

/**
 * 같은 맵 안에서 옮기는가 — 호출부가 카메라를 «팬할지 그냥 세울지» 고르는 데 쓴다.
 *
 * 맵이 바뀌면 팬은 의미가 없다. 좌표계가 통째로 달라 출발점이 목적지와 아무 관계가 없고,
 * 디졸브가 걷힌 직후에 낯선 맵을 가로지르는 팬이 또 도는 것이 정확히 사용자가 말한
 * 「확확 전환」이다. 그때는 덮인 동안 목적지에 **도착시켜 두고** 걷기만 한다.
 */
export function isSameMapMove(toMapId: MapId): boolean {
  return visibleMapId() === toMapId;
}

/**
 * 화면 전환을 감싼다. 맵이 바뀌면 크로스페이드로 덮었다 걷고, 아니면 그대로 실행한다.
 *
 * 전환을 걸 수 없는 환경(헤드리스·테스트·동작 줄이기)에서는 `apply()` 를 **동기로** 실행한다 —
 * 전환은 장식이고 화면을 옮기는 것이 본체다.
 */
export function withAssistantViewTransition(toMapId: MapId, apply: () => void): void {
  const plan = planAssistantViewTransition(
    { fromMapId: visibleMapId(), toMapId },
    { reducedMotion: prefersReducedMotion(), canDissolve: canDissolveMapView() }
  );
  if (plan.kind === "cut") {
    apply();
    return;
  }
  dissolveMapView(plan, apply);
}
