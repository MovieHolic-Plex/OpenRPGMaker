// 실행 중인 `/pi` 의 보드 상태를 패널에 흘리는 작은 버스. 명령이 갱신하고 팀 패널이 구독한다.

import type { TeamBoardState } from "./teamBoardState";

type Listener = (state: TeamBoardState | null) => void;
const listeners = new Set<Listener>();
let current: TeamBoardState | null = null;

export function publishTeamActivity(state: TeamBoardState | null): void {
  current = state;
  for (const listener of listeners) listener(state);
}

export function currentTeamActivity(): TeamBoardState | null {
  return current;
}

export function subscribeTeamActivity(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}

// 중지 슬롯 — 실행을 소유하는 조수 패널이 턴 동안 등록하고, 팀 데크의 「중지」가 불러 쓴다.
// 데크는 AbortController 를 모른다 — 알려주면 두 패널이 같은 컨트롤러를 맞붙들어 잡게 된다.
let stopHandler: (() => void) | null = null;

export function setTeamStopHandler(handler: (() => void) | null): void {
  stopHandler = handler;
}

/** 지금 도는 실행을 중지한다. 등록된 실행이 없으면 false. */
export function requestTeamStop(): boolean {
  if (!stopHandler) return false;
  stopHandler();
  return true;
}

// 검토 액션 슬롯 — 「검토 대기」에 들어간 실행이 등록하고, 작업 탭의 검토 스트립이 불러 쓴다.
// 로그 카드의 적용/버리기와 **같은 클로저**를 받는다 — 두 버튼, 한 동작.
export interface TeamReviewActions {
  readonly apply: () => void;
  readonly discard: () => void;
  /** 결과 보고서(큰 비교 뷰어)를 연다. 없으면 스트립은 버튼을 그리지 않는다. */
  readonly openReport?: () => void;
}

let reviewActions: TeamReviewActions | null = null;

export function setTeamReviewActions(actions: TeamReviewActions | null): void {
  reviewActions = actions;
}

export function currentTeamReviewActions(): TeamReviewActions | null {
  return reviewActions;
}
