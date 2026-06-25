// 게임 API 호출 헬퍼 — Edge Function 래퍼.

import { invokeFunction } from "@/api/client";
import type {
  ActionKind,
  ActionSubmissionResult,
  EnterResult,
  ShortData,
} from "@/types";

/** 닉네임으로 입장 → user_id + subject 반환. */
export function enter(nickname: string, faction = "chosun"): Promise<EnterResult> {
  return invokeFunction<EnterResult>("enter", { nickname, faction });
}

/** 내 숏 1개 페치 (pending 우선, 없으면 새로 생성). */
export function fetchShort(subjectId: string): Promise<{ short: ShortData | null }> {
  return invokeFunction<{ short: ShortData | null }>("fetch-shorts", {
    subject_id: subjectId,
  });
}

/** 숏에 대한 행동 제출 → 결과 (행동 효과 + 왕 판결). */
export function submitAction(
  shortId: string,
  action: ActionKind
): Promise<ActionSubmissionResult> {
  return invokeFunction<ActionSubmissionResult>("submit-action", {
    short_id: shortId,
    action,
  });
}

/** 세계 틱 수동 호출 (디버그/가속용). pg_cron과 동일. */
export function tickWorld(): Promise<unknown> {
  return invokeFunction("bot-step", { source: "manual" });
}
