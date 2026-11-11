/**
 * 컷신 건너뛰기는 `cutscene_end` 라벨까지 **빨리 감는다** — 라벨로 바로 뛰면 장면이 주던 아이템·동료·스위치·
 * 레터박스 해제가 사라진다(폴른 스타 2026-11-04). 걸음마다 셋 중 하나로 처리한다.
 * - skip  : 화면 연출만 있는 걸음(대사·대기·카메라·흔들기·효과음). 실행하지 않고 넘긴다.
 * - apply : 상태를 남기는 걸음. 기다림 없이(전환 0ms) 평소 처리기를 그대로 탄다.
 * - stop  : 플레이어가 고르거나 싸우거나 맵을 바꾸는 걸음. 빨리 감기를 멈추고 평소대로 처리한다 — 대신 고르면 분기가 바뀐다.
 */
import type { StepResult } from "@/player/interpreter";

export type FastForwardStep = Exclude<StepResult, { kind: "done" }>;
export type FastForwardAction = "skip" | "apply" | "stop";

const STOP_KINDS: ReadonlySet<string> = new Set([
  "choices", "inputNumber", "enterHeroName", "inputWait", "presentItem", "craftShop", "planSchedule", "timedChoice", "quickTimeEvent",
  "teleportMenu", "shop", "inn", "openChest", "openSaveMenu", "openLoadMenu", "openMenuScreen",
  "battleProcessing", "tacticsBattle", "transfer", "sleepUntilMorning", "gameOver", "returnToTitle",
]);

const SKIP_KINDS: ReadonlySet<string> = new Set([
  "text", "wait", "cameraControl", "flashScreen", "shakeScreen", "particleEffect", "showEmote", "showAnimation",
  "playMovie", "scrollMap", "pathfindMove", "moveEvent", "waitForAllMovement", "liftRide",
  // 테스트 플레이 「한 단계」 멈춤 — 컷신 건너뛰기는 멈춤을 풀고 지나간다.
  "debugStep",
]);

export function fastForwardAction(step: FastForwardStep): FastForwardAction {
  if (STOP_KINDS.has(step.kind)) return "stop";
  if (SKIP_KINDS.has(step.kind)) return "skip";
  // 한 번 울리는 효과음은 건너뛴다. 배경음·환경음은 장면 뒤에도 흐를 소리라 상태로 남긴다.
  if (step.kind === "playAudio" && !step.loop) return "skip";
  return "apply";
}

/** apply 걸음을 기다림 없는 모양으로 바꾼다(조명 전환·그림 대기). 나머지는 그대로. */
export function withoutWait(step: FastForwardStep): FastForwardStep {
  if (step.kind === "setLighting") return { ...step, transitionMs: 0 };
  if (step.kind === "setWeather") return { ...step, transitionMs: 0 };
  if (step.kind === "showPicture") return { ...step, waitForPicture: false };
  return step;
}
