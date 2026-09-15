// 레인 세션의 소유자. 스튜디오 셸은 열리고 닫히지만 레인은 그보다 오래 산다.
//
//  셸 에 두는가(2026-09-16 실측): 장면을 추가하면 에디터가 채팅 패널을 다시 그리고, 그때마다
// 스튜디오 셸이 **새로 만들어진다**. 셸이 자기 매니저를 만들면 돌던 레인·검토 대기 결과가 그 순간
// 사라진다 — 실표면 QA 에서「전체 2」가 한 번의 재렌더 뒤「전체 1」로 줄어 그 원인을 찾았다.
// 레인은 «작업»이지 «화면»이 아니므로 화면보다 오래 살아야 한다.

import { createLaneManager, type LaneManager } from "./aiLaneManager";

let current: LaneManager | null = null;

/** 이 브라우저 세션의 레인 매니저. 처음 부를 때 만든다. */
export function laneSession(): LaneManager {
  current ??= createLaneManager();
  return current;
}

/** 테스트 전용 — 모듈 상태를 비운다. */
export function resetLaneSessionForTest(): void {
  current?.dispose();
  current = null;
}