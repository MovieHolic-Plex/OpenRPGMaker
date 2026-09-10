// player/movementResult.ts — 좌표 이동 명령의 **명령별** 결과 기록.
//
// 왜 세션 플래그 하나로는 안 되는가 (OPRN-OUT-013): `session.flags.pathfindSucceeded` 는
// 세션 전역 한 칸이라 「가장 최근 경로 명령」의 결과만 남는다. 병렬 이벤트 둘이 각자
// 이동 명령을 내면 나중 것이 앞 것의 결과를 덮으므로, 저작자가 그 플래그를 보고 분기하면
// 자기 것이 아닌 결과로 분기한다. 명령이 직접 지정한 변수/스위치에 쓰면 그 경쟁이 없다.
//
// 기존 플래그는 **없애지 않는다** — 이미 저작된 프로젝트와 회귀 테스트가 읽는다.
import {
  isMovementFailure,
  movementResultCode,
  MOVEMENT_RESULT_LABELS,
  type MovementResult,
} from "@/project/eventCommands/coordinateDestination";
import { setSwitch, setVariable } from "@/project/session";
import type { PlaySessionLike } from "@/project/sessionRuntimeTypes";

export type MovementResultSink = {
  readonly resultVariableId?: string;
  readonly resultSwitchId?: string;
};

/**
 * 결과를 기록한다. 지정된 변수에는 결과 코드(정수)를, 스위치에는 「도착했는가」를 쓴다.
 * 스위치가 참/거짓 둘뿐이므로 실패 종류는 변수만 구분한다 — 그래서 폼이 둘 다 제공한다.
 */
export function recordMovementResult(
  session: PlaySessionLike,
  sink: MovementResultSink,
  result: MovementResult
): void {
  const variableId = sink.resultVariableId?.trim();
  if (variableId) setVariable(session, variableId, "=", movementResultCode(result));
  const switchId = sink.resultSwitchId?.trim();
  if (switchId) setSwitch(session, switchId, !isMovementFailure(result));
}

/** 로그 한 줄. 저작자가 콘솔에서 실패 종류를 바로 읽을 수 있어야 한다. */
export function movementResultLogText(result: MovementResult, detail?: string): string {
  const label = `${MOVEMENT_RESULT_LABELS[result]}(${movementResultCode(result)})`;
  return detail ? `${label} — ${detail}` : label;
}
