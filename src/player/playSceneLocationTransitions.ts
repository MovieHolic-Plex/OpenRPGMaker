// player/playSceneLocationTransitions.ts
// 「구역에 들어오면/나가면」 트리거의 **런타임 배선**. 판정은 하지 않는다 —
// 순수 모델(`project/locationTransitions.ts`)에 물어보고, 결과를 **기존 트리거 디스패치**
// (`scene.activeRuntimeEvents(kind)` → `scene.runEvent`) 로 흘린다.
//
// ## 왜 새 스케줄러를 만들지 않았나
//
// 이 트리거는 「auto」 와 같은 성질이다: 프레임 루프가 아니라 **사건 하나**가 실행을 시작한다.
// 병렬(`parallelProcesses`)은 인터프리터를 프레임마다 조금씩 굴리는 다른 기계이고,
// 여기 필요한 것은 «걸음이 끝났을 때 한 번» 이다. 그래서 호출 지점은 셋뿐이다:
//   1. 걸음 완료 — `playSceneMovement.advancePlayerStepFrame`(칸 확정 직후, 접촉 트리거 앞)
//   2. 순간이동 완료 — `playSceneMapCommands.transferTo`(착지 후, 자동 트리거 앞)
//   3. 이벤트 종료 후 재개 — `playSceneMapRuntime.refreshRuntimeSurfaces` 가 밀린 사건을 뽑아
//      돌린다. 자동 트리거(`fireAutoTriggers`)가 같은 자리에서 회복되는 것과 같은 규약이다.
//
// ## 왜 «밀린 사건» 이 필요한가 (브라우저 실측 2026-09-10)
//
// 문(playerTouch)을 밟아 장소 이동하는 저작에서 도착 구역의 enter 가 **한 번도** 돌지 않았다.
// `transferTo` 가 **문 이벤트의 인터프리터 안에서** 불리므로 그 시점 `scene.running` 이 참이고,
// `runEvent` 는 running 이면 즉시 되돌아 나온다. 즉 가장 흔한 저작(문으로 구역에 들어가기)이
// 조용히 죽는다. 그래서 실행할 수 없었던 사건은 버리지 않고 **큐에 담아** 이벤트가 끝나는
// 자리(`refreshRuntimeSurfaces`)에서 뽑는다.
//
// 큐는 무한히 자라지 않는다: `MAX_PENDING_TRANSITIONS` 로 잘라 오래된 것을 버린다.
// 전투/긴 컷신 동안 여러 구역을 가로질렀다면 그 전부를 뒤늦게 연소시키는 것이 옳지 않고
// (다섯 구역의 대사가 한꺼번에 터진다), 저작자가 기대하는 것은 «가장 최근의 드나듦» 이다.
//
// 점유 기록은 큐와 **무관하게** 즉시 갱신된다. 기록이 발밑과 어긋나면 그 다음 판정 전부가
// 틀어지므로, «실행이 밀렸다» 와 «어디 있는지» 는 분리된 두 가지 사실이다.
//
// ## 발동 규칙 (test/locationTransitionRuntime.test.ts + 브라우저 QA 가 고정한다)
//
// - **한 걸음에 여러 사건**이 날 수 있다(겹친 구역을 빠져나가며 다른 구역에 진입).
//   leave 를 먼저, enter 를 나중에 돌린다.
// - **한 사건에 여러 이벤트**가 반응할 수 있다. 저작 순서대로 순차 실행한다.
// - 점유 기록은 **실행 가능 여부와 무관하게** 즉시 갱신한다 — 기록과 발밑이 어긋나면
//   그 다음 판정이 전부 틀어진다.
// - 사건 → 반응 이벤트 해석은 **사건이 난 시점에** 한다. 밀린 것은 이벤트 id 로 담는다 —
//   나중에 해석하면 그 사이 바뀐 페이지 조건이 «그때 반응했어야 할 이벤트» 를 지운다.
// - 삭제된 구역을 가리키는 트리거는 발동하지 않는다(반응할 이벤트가 없다).
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
 * 밀린 드나듦 상한. 이 이상 쌓이면 **오래된 쪽을 버린다** — 저작자가 기대하는 것은
 * 가장 최근의 드나듦이고, 긴 전투 뒤에 지나온 구역 전부가 연소하면 게임이 멈춘 것처럼 보인다.
 */
const MAX_PENDING_TRANSITIONS = 8;

/**
 * 씬 객체를 키로 하는 대기 큐. 씬이 죽으면 같이 사라진다(zoneFeedback 의 farmMessages 와 같은 관례).
 *
 * 담는 것은 «아직 돌리지 못한 이벤트 id» 다. 사건(transition)이 아니라 이벤트 id 인 이유:
 * 한 사건이 여러 이벤트를 깨울 때 첫 이벤트가 대화를 열면 나머지가 밀리는데, 사건을 되돌려
 * 담으면 재개 시점에 **이미 돌린 첫 이벤트가 다시 뽑힌다.** 사건 → 이벤트 해석은 사건이
 * 난 시점에 한 번만 하고, 재개는 그 결과의 꼬리만 이어 간다.
 */
const pendingEventIds = new WeakMap<object, string[]>();

/**
 * 현재 위치로 점유를 갱신하고 드나듦 트리거를 돌린다. 한 걸음 완료마다 한 번 부른다.
 * 같은 칸에 다시 서면 점유 집합이 같아 아무 사건도 나지 않는다(재진입 중복 발동 방지).
 */
export function fireLocationTransitionTriggers(scene: LocationTransitionScene): void {
  const update = updateLocationOccupancy(scene.session, scene.map, { x: scene.tileX, y: scene.tileY });
  dispatchLocationTransitions(scene, update.transitions);
}

/**
 * 순간이동(장소 이동) 뒤에 부른다. 중간 걸음이 없으므로 출발 맵의 점유는 통째로 leave 이고
 * 도착 지점의 점유는 enter 다 — **문으로 나간 것도 나간 것이다.**
 *
 * 같은 맵 안 워프도 같은 함수를 지난다: 구역을 벗어났다 돌아온 것이므로 leave + enter 가
 * 둘 다 난다. 재진입 연출(안내판·BGM)이 다시 돌아야 맞다.
 *
 * 맵을 넘는 leave 의 대상 이벤트는 이미 화면에서 사라졌다 — 「이벤트는 자기 맵 안에서만
 * 산다」 는 엔진 규칙의 따름정리이고, 큐에 담겨도 도착 맵에서는 반응할 이벤트가 없다.
 */
export function fireLocationTransitionTriggersAfterTransfer(
  scene: LocationTransitionScene,
  fromMapId: string,
): void {
  dispatchLocationTransitions(
    scene,
    transferLocationOccupancy(scene.session, fromMapId, scene.map, { x: scene.tileX, y: scene.tileY }),
  );
}

/** 새 게임·세이브 복원 직후의 기준선 심기. 여기서는 **절대** 트리거가 돌지 않는다. */
export function seedLocationOccupancyForScene(
  scene: Pick<LocationTransitionScene, "map" | "session" | "tileX" | "tileY">,
): void {
  seedLocationOccupancy(scene.session, scene.map, { x: scene.tileX, y: scene.tileY });
  // 세이브 복원은 이전 세션의 밀린 사건을 물려받지 않는다.
  pendingEventIds.delete(scene as object);
}

/**
 * 이벤트가 끝난 자리에서 밀린 드나듦을 돌린다. `refreshRuntimeSurfaces` 가
 * `fireAutoTriggers` 와 함께 부르므로 회복 지점이 둘로 갈리지 않는다.
 */
export function drainPendingLocationTransitions(scene: LocationTransitionScene): void {
  const queued = pendingEventIds.get(scene as object);
  if (!queued || queued.length === 0) return;
  if (scene.running) return;
  pendingEventIds.delete(scene as object);
  void runQueuedEvents(scene, queued);
}

function dispatchLocationTransitions(
  scene: LocationTransitionScene,
  transitions: readonly LocationTransition[],
): void {
  if (transitions.length === 0) return;
  // 사건 → 이벤트 해석은 **사건이 난 시점에** 한다. 나중으로 미루면 그 사이 페이지 조건이
  // 바뀌어 «그때 반응했어야 할 이벤트» 를 놓친다.
  const eventIds = resolveTransitionEvents(scene, transitions);
  if (eventIds.length === 0) return;
  if (scene.running) {
    queueEvents(scene, eventIds);
    return;
  }
  void runQueuedEvents(scene, eventIds);
}

function queueEvents(scene: LocationTransitionScene, eventIds: readonly string[]): void {
  const queued = [...(pendingEventIds.get(scene as object) ?? []), ...eventIds];
  pendingEventIds.set(
    scene as object,
    queued.length > MAX_PENDING_TRANSITIONS ? queued.slice(-MAX_PENDING_TRANSITIONS) : queued,
  );
}

/**
 * 이 사건들에 반응하는 이벤트 id 를 저작 순서대로 모은다.
 * 실행 전 스냅샷을 만드는 이유: `runEvent` 가 페이지 조건·스위치를 바꿔 목록이 흔들릴 수 있고,
 * 그 흔들림이 **같은 사건의** 나머지 이벤트를 삼키면 저작 순서 계약이 깨진다.
 */
function resolveTransitionEvents(
  scene: LocationTransitionScene,
  transitions: readonly LocationTransition[],
): string[] {
  const eventIds: string[] = [];
  for (const transition of transitions) {
    for (const view of scene.activeRuntimeEvents("locationTransition")) {
      if (!triggerMatchesTransition(view.trigger, transition)) continue;
      eventIds.push(view.event.id);
    }
  }
  return eventIds;
}

async function runQueuedEvents(scene: LocationTransitionScene, eventIds: readonly string[]): Promise<void> {
  for (const [index, eventId] of eventIds.entries()) {
    // 첫 이벤트가 대화를 열면 running 이 서므로 나머지는 그 이벤트가 끝난 뒤에 돌아야 한다.
    // 아직 돌리지 않은 꼬리만 되돌려 담는다 — 이미 돌린 것을 다시 담으면 한 걸음의 사건이
    // 두 번 연소한다.
    if (index > 0 && scene.running) {
      queueEvents(scene, eventIds.slice(index));
      return;
    }
    await scene.runEvent(eventId);
  }
}
