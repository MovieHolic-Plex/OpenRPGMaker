// editor/locationPointerPriority.ts
// 로케이션과 이벤트가 **같은 칸에서** 만날 때 누가 그 클릭을 갖는가 — 순수 판정기.
//
// 왜 순수 모듈인가: 이 판정은 (a) 오버레이의 pointerdown, (b) 캔버스의 pointerup 더블클릭,
// (c) 오버레이가 캔버스에 양보하는 경로 세 곳에서 같은 답을 내야 한다. 세 곳에 if 를 복사하면
// 한 곳만 고쳐도 나머지가 조용히 어긋난다(2026-09-11 로케이션 도구-모드 누락과 같은 실패).
//
// ## 규칙 (2026-09-12)
//
// 로케이션 레이어가 켜져 있으면 좌클릭은 **구역의 것**이다. 그 칸에 이벤트가 서 있어도 마찬가지다 —
// 그리기 도구가 켜져 있는 동안 타일·이벤트 편집이 클릭을 가져가면 사용자는 "그림이 안 그려지는"
// 상태에 갇힌다. 대신 이벤트를 **빼앗지 않고** 두 가지 통로를 남긴다:
//
//   Alt+클릭    그 칸의 이벤트를 편집기로 연다. 도구를 끄고 레이어를 옮기고 다시 찾는 3단계를
//               한 번의 클릭으로 줄인다. 이벤트가 없으면 평소대로 그리기 시작이다.
//   더블클릭    같은 통로의 넓은 판이다. 클릭 두 번은 한 번보다 우연히 일어나기 어려워,
//               "그리다가 실수로 열렸다"가 드물다.
//
// 왜 "이벤트 먼저"가 아닌가: 이벤트는 맵 위에 점으로 서 있고 구역은 넓은 면이다. 면을 칠하려는
// 사람이 그 안의 NPC 한 명 때문에 매번 막히면 그리기 도구 자체가 쓸 수 없게 된다. 반대로
// 이벤트를 열고 싶은 사람은 Alt 를 알고 있으면 되고, 모르면 더블클릭이 잡아 준다.
//
// 두 규칙은 **구역이 켜져 있을 때만** 적용한다. 꺼져 있으면 이벤트 레이어 클릭은 종전 그대로다.

export type LocationOverlapOutcome =
  /** 그리기(구역 생성·선택·이동)를 시작한다. */
  | { readonly kind: "draw" }
  /** 그 칸의 이벤트를 연다. 오버레이는 손을 떼고 캔버스에 넘긴다. */
  | { readonly kind: "openEvent"; readonly eventId: string };

export type LocationOverlapInput = {
  /** 로케이션 레이어가 켜져 있는가. 꺼져 있으면 이 판정을 쓰지 않는다. */
  readonly locationLayerEnabled: boolean;
  /** 눌린 칸을 덮는 이벤트의 id. 없으면 null. */
  readonly eventIdAtPoint: string | null;
  readonly altKey: boolean;
  readonly clickCount: number;
};

/** 더블클릭으로 인정하는 클릭 수. */
export const LOCATION_OPEN_EVENT_CLICK_COUNT = 2;

/**
 * 같은 칸을 이 시간 안에 두 번 누르면 더블클릭으로 본다.
 *
 * 왜 `event.detail` 로 못 하나: 이 저장소의 Chromium 실측(2026-08-11)에서 **pointerdown 의
 * detail 은 항상 0** 이다. 클릭 수는 mousedown/click 에만 실린다. EditScene 도 같은 이유로
 * 500ms 같은-타일 규칙을 따로 갖고 있다(`EVENT_LAYER_DOUBLE_CLICK_MS`) — 두 표면이 같은
 * 손놀림에 같은 답을 내려면 상수도 같아야 한다.
 */
export const LOCATION_DOUBLE_CLICK_MS = 500;

export type LocationClickTrace = { readonly mapId: string; readonly x: number; readonly y: number; readonly at: number };

/**
 * 같은 칸 연속 클릭 세기. 오버레이가 호출마다 상태를 넘겨받는다(DOM 을 모르는 순수 계산).
 * `previous` 가 없거나 다른 칸이거나 너무 오래됐으면 1 이다.
 */
export function locationClickCount(
  previous: LocationClickTrace | null,
  current: LocationClickTrace,
): number {
  if (!previous) return 1;
  const sameTile = previous.mapId === current.mapId && previous.x === current.x && previous.y === current.y;
  if (!sameTile) return 1;
  // 부호 없는 비교만 — 시계가 뒤로 가도 «더블클릭» 으로 오독하지 않는다.
  const elapsed = current.at - previous.at;
  if (elapsed < 0 || elapsed > LOCATION_DOUBLE_CLICK_MS) return 1;
  return LOCATION_OPEN_EVENT_CLICK_COUNT;
}

export function resolveLocationOverlapPointer(input: LocationOverlapInput): LocationOverlapOutcome {
  if (!input.locationLayerEnabled) return { kind: "draw" };
  if (!input.eventIdAtPoint) return { kind: "draw" };
  // Alt 는 "이벤트를 다루겠다"는 명시 선언이다. 클릭 수와 무관하게 이긴다 —
  // Alt 를 누른 채 두 번 누른 사람도 같은 뜻이기 때문이다.
  if (input.altKey) return { kind: "openEvent", eventId: input.eventIdAtPoint };
  if (input.clickCount >= LOCATION_OPEN_EVENT_CLICK_COUNT) {
    return { kind: "openEvent", eventId: input.eventIdAtPoint };
  }
  return { kind: "draw" };
}
