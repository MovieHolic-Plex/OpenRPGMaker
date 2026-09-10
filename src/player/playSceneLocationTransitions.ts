// player/playSceneLocationTransitions.ts
// 「구역에 들어오면/나가면」 트리거의 **런타임 배선**. 판정은 하지 않는다 —
// 순수 모델(`project/locationTransitions.ts`)에 물어보고, 결과를 **기존 트리거 디스패치**
// (`scene.activeRuntimeEvents(kind)` → `scene.runEvent`) 로 흘린다.
//
// ## 왜 새 스케줄러를 만들지 않았나
//
// 이 트리거는 「auto」 와 같은 성질이다: 프레임 루프가 아니라 **사건 하나**가 실행을 시작한다.
// 병렬(`parallelProcesses`)은 인터프리터를 프레임마다 조금씩 굴리는 다른 기계이고,
// 여기 필요한 것은 «걸음이 끝났을 때 한 번» 이다. 그래서 걸음 완료 지점
// (`playSceneMovement.advancePlayerStepFrame` — `fireTouchTriggers` 바로 옆)과
// 순간이동 완료 지점(`playSceneMapCommands.transferTo`)에서 이 함수를 부른다.
//
// ## 발동 규칙 (전부 test/locationTransitionRuntime.test.ts 가 고정한다)
//
// - **한 걸음에 여러 사건**이 날 수 있다(겹친 구역을 빠져나가며 다른 구역에 진입).
//   leave 를 먼저, enter 를 나중에 돌린다.
// - **한 사건에 여러 이벤트**가 반응할 수 있다. 저작 순서대로 순차 실행한다.
// - `scene.running` 이면(대화·전투 중) **점유 기록만 갱신하고 실행하지 않는다** —
//   auto 트리거와 같은 규약이고, 안 그러면 전투 오버레이 뒤에서 대화가 터진다.
//   기록은 갱신해야 한다: 안 하면 대화가 끝난 뒤 «그 사이 지나온 구역» 이 한꺼번에 터진다.
// - 삭제된 구역을 가리키는 트리거는 발동하지 않는다(그 ID 의 사건이 아예 나지 않는다).
//   그 상태는 projectLint 의 `map-location-missing-ref` 가 눈에 보이게 올린다.

import {
  seedLocationOccupancy,
  transferLocationOccupancy,
  triggerMatchesTransition,
  updateLocationOccupancy,
  type LocationTransition,
} from "@/project/locationTransitions";
import type { PlaySceneContext } from "@/player/playSceneTypes";

type LocationTransitionScene = Pick<
  PlaySceneContext,
  "map" | "session" | "tileX" | "tileY" | "running" | "activeRuntimeEvents" | "runEvent"
>;

/**
 * 현재 위치로 점유를 갱신하고 드나듦 트리거를 돌린다. 한 걸음 완료마다 한 번 부른다.
 * 같은 칸에 다시 서면 점유 집합이 같아 아무 사건도 나지 않는다(재진입 중복 발동 방지).
 */
export function fireLocationTransitionTriggers(scene: LocationTransitionScene): void {
  const update = updateLocationOccupancy(scene.session, scene.map, { x: scene.tileX, y: scene.tileY });
  if (update.transitions.length === 0) return;
  void runLocationTransitions(scene, update.transitions);
}

/**
 * 순간이동(장소 이동) 뒤에 부른다. 중간 걸음이 없으므로 출발 맵의 점유는 통째로 leave 이고
 * 도착 지점의 점유는 enter 다 — **문으로 나간 것도 나간 것이다.**
 *
 * 맵이 같은 순간이동(같은 맵 안 워프)도 같은 함수로 처리된다: 출발 맵 점유를 비운 뒤
 * 도착 좌표로 다시 계산하므로, 같은 구역 안에서 순간이동하면 leave + enter 가 **둘 다** 난다.
 * 그것이 옳다 — 구역을 벗어났다 돌아온 것이고, 재진입 연출(안내판·BGM)이 다시 돌아야 한다.
 */
export function fireLocationTransitionTriggersAfterTransfer(
  scene: LocationTransitionScene,
  fromMapId: string,
): void {
  const transitions = transferLocationOccupancy(
    scene.session,
    fromMapId,
    scene.map,
    { x: scene.tileX, y: scene.tileY },
  );
  if (transitions.length === 0) return;
  // 출발 맵의 leave 는 **출발 맵의 이벤트**가 받아야 한다. 도착 맵이 다르면 그 이벤트들은
  // 이미 사라졌으므로 돌릴 대상이 없다 — 맵을 넘는 leave 이벤트는 실행되지 않는다는
  // 계약이고, 이는 「이벤트는 자기 맵 안에서만 산다」 는 엔진 규칙의 따름정리다.
  void runLocationTransitions(scene, transitions);
}

/** 새 게임·세이브 복원 직후의 기준선 심기. 여기서는 **절대** 트리거가 돌지 않는다. */
export function seedLocationOccupancyForScene(scene: Pick<LocationTransitionScene, "map" | "session" | "tileX" | "tileY">): void {
  seedLocationOccupancy(scene.session, scene.map, { x: scene.tileX, y: scene.tileY });
}


async function runLocationTransitions(
  scene: LocationTransitionScene,
  transitions: readonly LocationTransition[],
): Promise<void> {
  // 진행 중이면(대화·전하·상점) 실행하지 않는다. 이미 점유 기록은 갱신된 상태이므로
  // 이 사건은 «지나간 것» 이 된다 — auto 트리거가 running 에서 생략되는 것과 같은 계약이고,
  // 밀린 사건을 나중에 토하는 큐를 만들면 전통 직후에 다섯 구역의 대화가 연소해버린다.
  if (scene.running) return;
  // 실행 전 스냅샷을 만든다: runEvent 가 페이지 조건·스위치를 바꿔 목록이 흔들릴 수 있고,
  // 그 흔들림이 **같은 사건의** 나머지 이벤트를 삼키면 저작 순서 계약이 깨진다.
  const pending: string[] = [];
  for (const transition of transitions) {
    for (const view of scene.activeRuntimeEvents("locationTransition")) {
      if (!triggerMatchesTransition(view.trigger, transition)) continue;
      pending.push(view.event.id);
    }
  }
  for (const eventId of pending) {
    await scene.runEvent(eventId);
  }
}
