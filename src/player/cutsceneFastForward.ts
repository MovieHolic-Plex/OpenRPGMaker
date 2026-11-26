/**
 * 컷신 건너뛰기는 `cutscene_end` 라벨까지 **빨리 감는다** — 라벨로 바로 뛰면 장면이 주던 아이템·동료·스위치·
 * 레터박스 해제가 사라진다(폴른 스타 2026-11-04). 걸음마다 셋 중 하나로 처리한다.
 * - skip  : 화면 연출만 있는 걸음(대사·대기·카메라·흔들기·효과음). 실행하지 않고 넘긴다.
 * - apply : 상태를 남기는 걸음. 기다림 없이(전환 0ms) 평소 처리기를 그대로 탄다.
 * - stop  : 플레이어가 고르거나 싸우는 걸음. 빨리 감기를 멈추고 평소대로 처리한다 — 대신 고르면 분기가 바뀐다.
 * - place : 인물을 걷게 하는 걸음(한 번짜리 이동 경로·길 찾기). 걷지 않고 끝 칸에 바로 세운다(cutsceneInstantMove.ts).
 * 맵 이동은 apply 다 — 옮긴 뒤에도 빨리 감기를 이어 간다(오너 결정 2026-11-26 D1, 전에는 이동 뒤 컷신을 처음부터 다 보였다).
 */
import type { StepResult } from "@/player/interpreter";

export type FastForwardStep = Exclude<StepResult, { kind: "done" }>;
export type FastForwardAction = "skip" | "apply" | "stop" | "place";

const STOP_KINDS: ReadonlySet<string> = new Set([
  "choices", "inputNumber", "enterHeroName", "inputWait", "presentItem", "craftShop", "planSchedule", "timedChoice", "quickTimeEvent",
  "teleportMenu", "shop", "inn", "openChest", "openSaveMenu", "openLoadMenu", "openMenuScreen",
  "battleProcessing", "tacticsBattle", "sleepUntilMorning", "gameOver", "returnToTitle",
]);

const SKIP_KINDS: ReadonlySet<string> = new Set([
  "text", "wait", "cameraControl", "flashScreen", "shakeScreen", "particleEffect", "showEmote", "showAnimation",
  "playMovie", "scrollMap", "waitForAllMovement", "liftRide",
  // 테스트 플레이 「한 단계」 멈춤 — 컷신 건너뛰기는 멈춤을 풀고 지나간다.
  "debugStep",
]);

export function fastForwardAction(step: FastForwardStep): FastForwardAction {
  if (STOP_KINDS.has(step.kind)) return "stop";
  // 선택지 바로 앞 질문 대사는 선택지와 한 덩어리다 — 건너뛰면 질문 없이 「왼쪽/오른쪽」만 떴다. 여기서 멈춰 질문부터 보인다.
  if (step.kind === "text" && step.beforeChoices) return "stop";
  // 되풀이 경로(순찰)는 장면 뒤에도 남는 상태다 — 건너뛰면 순찰이 아예 시작되지 않았다. 기다림 없이 걸어 둔다.
  if (step.kind === "moveEvent" && step.repeat) return "apply";
  // 한 번짜리 이동은 끝 칸에 바로 세운다 — 건너뛰면 인물이 처음 자리에 남았다(오너 결정 2026-11-26 D2).
  if (step.kind === "moveEvent" || step.kind === "pathfindMove") return "place";
  // 주인공을 태워 층을 옮기는 승강기는 위치를 바꾼다 — 건너뛰면 주인공이 출발 층에 남았다.
  if (step.kind === "liftRide" && step.mode === "move" && step.riders !== "none") return "apply";
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
  if (step.kind === "moveEvent") return { ...step, wait: false };
  // 빨리 감는 맵 이동은 문 여는 연출·문간 걸음 없이 옮긴다.
  if (step.kind === "transfer") return { ...step, door: false };
  return step;
}
