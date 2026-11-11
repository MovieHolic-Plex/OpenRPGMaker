// 「현재 목표」 줄의 명령 모양 — 목표를 거는 UI 명령(objectiveChip)을 만들고 알아본다.
import { type RawCommand } from "@/qa/gameCheck/walk";

const OBJECTIVE_COMMAND_ID = "m2-214-ui-command";

export const OBJECTIVE_SURFACE = "objectiveChip";

/** 「현재 목표」 줄을 바꾸는 명령 — 실행되면 화면 오른쪽 위 목표 줄이 이 글로 바뀐다(playSceneZoneFeedback). */
export function objectiveCommand(message: string): RawCommand {
  return { kind: "m2Command", commandId: OBJECTIVE_COMMAND_ID, fields: { surface: OBJECTIVE_SURFACE, message, durationMs: 0 } };
}

export function isObjectiveCommand(command: RawCommand): boolean {
  if (command.kind !== "m2Command" || command.commandId !== OBJECTIVE_COMMAND_ID) return false;
  const fields = command.fields as Record<string, unknown> | undefined;
  return fields?.surface === OBJECTIVE_SURFACE && typeof fields.message === "string" && fields.message.trim().length > 0;
}
