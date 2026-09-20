// editor/panels/eventEditor/aiDockOpenRequest.ts
//
// 맵 우클릭 「AI 로 이벤트 만들기/고치기」가 이벤트 편집기의 AI 명령 도크를 **펼친 채로**
// 열어 달라고 남기는 예약. 도크(`aiAssist.ts`)와 진입점(`eventLayerContextMenu.ts`)이
// 서로를 import 하지 않도록 사이에 두는 얇은 모듈이다(aiBootIntent.ts 와 같은 이유).
//
// 왜 DOM 을 직접 켜지 않는가 (실측):
// `openNewEventEditorModal(mapId, x, y, onOpened)` 의 `onOpened` 는 첫 렌더가 **끝난 뒤**에
// 불린다. 그 시점에 도크를 찾아 `open = true` 로 켜도, `details.open` 의 `toggle` 이벤트는
// 비동기로 큐에 걸리고, 초안 생성이 부른 store 갱신이 그보다 먼저 편집기 본문을 통째로 다시
// 그린다. 새로 그려진 도크는 `state.open`(아직 false)을 보고 태어나므로 화면에는 닫힌 칩만
// 남는다. 그래서 "열어라"는 DOM 이 아니라 **렌더 전에 읽히는 상태**로 남겨야 한다.
//
// 예약 키는 `mapId:eventId` 다. 새 이벤트도 **id 를 먼저 만든 뒤** 예약한다 — modal.ts 가
// `createEventDraft` 로 id 를 받고, `openDraftEventEditorModal` 로 그리기 **직전에** 예약한다.
// 그래서 "다음에 그려지는 아무 도크" 같은 애매한 예약이 없고, 확인 대화상자가 취소되면
// 예약 자체가 생기지 않아 나중에 손으로 연 다른 이벤트로 샐 수 없다.
//
// 예약은 도크가 태어날 때 **한 번만** 소비된다. 그래서 사용자가 접은 도크를 이후의 재렌더가
// 도로 펼치는 일이 없다.

const pending = new Set<string>();

function intentKey(mapId: string, eventId: string): string {
  return `${mapId}:${eventId}`;
}

/** 도크를 펼치라고 예약한다. 편집기가 그 이벤트를 처음 그리기 전에 불러야 한다. */
export function requestEventAiDockOpen(mapId: string, eventId: string): void {
  if (!mapId || !eventId) return;
  pending.add(intentKey(mapId, eventId));
}

/** 예약을 소비한다 — 도크가 태어날 때 한 번만 true 다. */
export function consumeEventAiDockOpen(mapId: string, eventId: string): boolean {
  return pending.delete(intentKey(mapId, eventId));
}

/** 예약을 버린다. 인자를 주지 않으면 **전부** 버린다(프로젝트 전환 등).
 *
 * 둘 중 하나만 주는 호출은 받지 않는다 — `mapId` 만 준 호출이 조용히 전부를 지우면
 * 다른 이벤트의 예약까지 사라지는 버그가 되고, 반대로 아무것도 못 지우면 폐기 의도가
 * 무시된다. 어느 쪽이든 조용한 오답이라 시그니처로 막는다. */
export function clearEventAiDockOpenRequest(mapId?: string, eventId?: string): void {
  if (mapId === undefined && eventId === undefined) {
    pending.clear();
    return;
  }
  if (mapId === undefined || eventId === undefined) {
    throw new TypeError("clearEventAiDockOpenRequest 는 mapId 와 eventId 를 함께 주거나, 둘 다 주지 마세요.");
  }
  pending.delete(intentKey(mapId, eventId));
}

/** 테스트용: 남은 예약 수. */
export function pendingEventAiDockOpenCountForTest(): number {
  return pending.size;
}
