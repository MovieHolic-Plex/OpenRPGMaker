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
  scene.playerRoute = { moves: [...moves], index: 0, repeat };
}
