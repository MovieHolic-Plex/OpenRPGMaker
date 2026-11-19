import { AUTORUN_REPEAT_LIMIT, SAFETY_STOP_HISTORY_LIMIT, createSafetyStop, type RuntimeSafetyStop } from "@/player/runtimeSafetyStop";
import type { PlaySceneContext } from "@/player/playSceneTypes";

type SafetyStopScene = Pick<PlaySceneContext, "safetyStops" | "autorunRepeats" | "session" | "getMapId" | "runtimeDom" | "showRuntimeOverlay">;

export const SAFETY_STOP_OVERLAY_ID = "runtime-safety-stop";

export function recordSceneSafetyStop(scene: SafetyStopScene, stop: RuntimeSafetyStop): void {
  const withMap: RuntimeSafetyStop = stop.mapId ? stop : { ...stop, mapId: scene.getMapId() };
  console.warn(`[safety-stop] ${withMap.kind} ${withMap.message}`);
  const stops = scene.safetyStops ??= [];
  const duplicate = stops.some((entry) => entry.kind === withMap.kind && entry.eventId === withMap.eventId
    && entry.commonEventId === withMap.commonEventId && entry.mapId === withMap.mapId);
  if (duplicate) return;
  stops.push(withMap);
  if (stops.length > SAFETY_STOP_HISTORY_LIMIT) stops.shift();
  // 출하 게임의 플레이어에게는 저작 진단을 띄우지 않는다. 편집기 테스트 플레이·QA 부팅만 화면에 이유를 보인다.
  if (scene.runtimeDom?.instrumented) scene.showRuntimeOverlay(SAFETY_STOP_OVERLAY_ID, `테스트 안전 정지\n${withMap.message}`);
}

/**
 * 자동 실행 한 번을 시작해도 되는가. 같은 자동 실행이 플레이어 걸음 없이 상한을 넘겨 다시 시작되면 false 를 돌려주고
 * 기록을 남긴다. 「자동 실행 → 같은 맵으로 이동」은 맵을 다시 읽을 때마다 시작 기록이 지워져 영원히 다시 돌았다.
 */
export function admitAutorunStart(
  scene: SafetyStopScene,
  key: string,
  owner: { readonly eventId?: string; readonly commonEventId?: string },
): boolean {
  const step = scene.session.stepCount ?? 0;
  const repeats = scene.autorunRepeats ??= new Map();
  const previous = repeats.get(key);
  const count = previous && previous.step === step ? previous.count + 1 : 1;
  repeats.set(key, { step, count });
  if (count <= AUTORUN_REPEAT_LIMIT) return true;
  recordSceneSafetyStop(scene, createSafetyStop({ kind: "autorun-repeat", limit: AUTORUN_REPEAT_LIMIT, ...owner }));
  return false;
}
