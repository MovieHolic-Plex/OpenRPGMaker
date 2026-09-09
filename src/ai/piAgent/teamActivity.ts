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
