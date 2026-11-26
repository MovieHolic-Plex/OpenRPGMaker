// Pi 실행이 도중에 끊긴(앱 강제 종료·충돌) 대화를 알아본다(#5188-4).
// 실행을 시작할 때 대화 기록 끝에 «실행 중» 표지를 남기고, 실행이 끝나면 표지 없는 기록으로 덮는다.
// 다시 켰을 때 기록 끝에 표지가 남아 있으면 그 실행은 끝나지 못했다.
import type { AuditEntry } from "@/ai/session/types";

export const PI_RUN_IN_FLIGHT = "agent_run:in-flight";

/** 끝나지 못한 실행의 요청 글. 기록 끝이 «실행 중» 표지가 아니면 null. */
export function interruptedPiRequest(entries: readonly AuditEntry[]): string | null {
  const last = entries[entries.length - 1];
  if (last?.kind !== "status" || last.text !== PI_RUN_IN_FLIGHT) return null;
  for (let index = entries.length - 2; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.kind === "user") return entry.text;
  }
  return null;
}
