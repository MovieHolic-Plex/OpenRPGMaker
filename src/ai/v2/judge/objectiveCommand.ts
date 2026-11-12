// 「현재 목표」 줄의 명령 모양 — 목표를 거는 UI 명령(objectiveChip)을 만들고 알아본다.
import { type RawCommand } from "@/qa/gameCheck/walk";

const OBJECTIVE_COMMAND_ID = "m2-214-ui-command";

export const OBJECTIVE_SURFACE = "objectiveChip";

/** 목표가 가리키는 이벤트 — 이 단계를 넘기는 이벤트(이름이 같은 다른 이벤트가 아니라). 런타임 표시가 글의 이름 찾기보다 먼저 쓴다. */
export interface ObjectiveTarget { readonly mapId: string; readonly eventId: string }

/**
 * 「현재 목표」 줄을 바꾸는 명령 — 실행되면 화면 오른쪽 위 목표 줄이 이 글로 바뀐다(playSceneZoneFeedback).
 * target 을 주면 fields.targetMapId · targetEventId 로 싣는다(명령 fields 는 문자열·숫자·불리언만 — 객체를 실으면 프로젝트가 안 읽힌다).
 */
export function objectiveCommand(message: string, target?: ObjectiveTarget): RawCommand {
  return { kind: "m2Command", commandId: OBJECTIVE_COMMAND_ID, fields: { surface: OBJECTIVE_SURFACE, message, durationMs: 0, ...(target ? { targetMapId: target.mapId, targetEventId: target.eventId } : {}) } };
}

/** 목표 명령이 들고 있는 대상(없으면 undefined). */
export function objectiveTargetOf(command: RawCommand): ObjectiveTarget | undefined {
  const fields = command.fields as Record<string, unknown> | undefined;
  const mapId = fields?.targetMapId, eventId = fields?.targetEventId;
  return typeof mapId === "string" && mapId && typeof eventId === "string" && eventId ? { mapId, eventId } : undefined;
}

/** 목표 명령의 대상을 바꾼다(없애려면 undefined) — 바뀌었으면 true. */
export function setObjectiveTarget(command: RawCommand, target: ObjectiveTarget | undefined): boolean {
  const fields = command.fields as Record<string, unknown>;
  const now = objectiveTargetOf(command);
  if (now?.mapId === target?.mapId && now?.eventId === target?.eventId) return false;
  if (target) { fields.targetMapId = target.mapId; fields.targetEventId = target.eventId; }
  else { delete fields.targetMapId; delete fields.targetEventId; }
  return true;
}

export function isObjectiveCommand(command: RawCommand): boolean {
  if (command.kind !== "m2Command" || command.commandId !== OBJECTIVE_COMMAND_ID) return false;
  const fields = command.fields as Record<string, unknown> | undefined;
  return fields?.surface === OBJECTIVE_SURFACE && typeof fields.message === "string" && fields.message.trim().length > 0;
}
