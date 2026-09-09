/**
 * 주인공 이동 경로 상태만 담은 잎 모듈.
 *
 * `playSceneMovement` 안에 있으면 이걸 쓰려는 쪽이 이동·전투·농사·조우까지 전부 끌어온다.
 * QA 디버그 훅(`playSceneTestHooks`)이 그렇게 가져왔더니 훅만 임포트하는 가벼운 테스트의
 * 모듈 수집이 90초까지 늘어 타임아웃이 났다(실측 2026-08-29). 상태 세팅은 잎으로 뺀다.
 */

import type { MoveCommand } from "@/project/types";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export function startPlayerRoute(
  scene: Pick<PlaySceneContext, "playerRoute">,
  moves: readonly MoveCommand[],
  repeat: boolean
): void {
  if (moves.length === 0) {
    scene.playerRoute = null;
    return;
  }
  // 새 객체다 — 통과(through) 를 물려받지 않는다. 아래 수명 계약의 「교체」 항목이 이 한 줄에 있다.
  scene.playerRoute = { moves: [...moves], index: 0, repeat };
}

/**
 * 주인공 통과 상태의 **수명 계약**(OPRN-OUT-016).
 *
 * NPC 는 통과를 `mover.through` 에 담고, 커맨드 이동 경로의 무버는 경로가 끝나면 지워진다 —
 * 즉 NPC 통과도 그 경로와 함께 죽는다. 주인공도 같은 폭으로 맞춘다: 상태는 `PlayerRouteState`
 * 안에만 살고 루트가 사라지면 통과도 사라진다.
 *
 *  - 완료 / 취소(stopAllMovement·경로 중단) → `playerRoute` 가 null 이 되므로 통과도 사라진다.
 *  - 경로 교체 → `startPlayerRoute` 가 **새 객체**를 만들므로 꺼진 채로 출발한다.
 *  - 반복(repeat) → 같은 루트 객체가 index 만 0 으로 되감긴다 → 유지한다(NPC repeat 와 같다).
 *  - 장소 이동 → 루트는 살아남지만 통과는 끈다(이 함수). A 맵 기준으로 켠 통과가 착지 맵의
 *    벽까지 뚫는 것이 이 결함의 가장 넓은 누출이다.
 *  - 일반 조작 복귀 → 자유 이동(`tryStartMove`)은 이 값을 **읽지 않는다**. 읽는 곳이
 *    `startPlayerRouteStep` 한 군데뿐이라 누출이 구조적으로 불가능하다.
 *
 * 세션(영구) 쪽으로 올리지 않은 이유: 그렇게 해야 할 호환 근거가 없고, 켠 채 루트가 끊기면
 * 주인공이 영구히 벽을 뚫는다 — 근거가 불분명할 때는 누출을 막는 쪽이 기본이다.
 */
export function clearPlayerRouteThrough(scene: Pick<PlaySceneContext, "playerRoute">): void {
  if (scene.playerRoute) scene.playerRoute.through = false;
}
