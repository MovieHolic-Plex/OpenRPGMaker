// Pi 실행이 도중에 끊긴(앱 강제 종료·충돌) 대화를 알아본다(#5188-4, 이어 하기 #5239).
// 실행을 시작할 때 대화 기록 끝에 «실행 중» 표지를 남기고, 실행이 끝나면 표지 없는 기록으로 덮는다.
// 다시 켰을 때 기록 끝에 표지가 남아 있으면 그 실행은 끝나지 못했다. 표지에 붙은 기록(runResume.ts)이 있으면 이어 할 수 있다.
import type { AuditEntry } from "@/ai/session/types";
import { parseInFlightMarker, PI_RUN_IN_FLIGHT, type PiRunJournal } from "@/ai/piAgent/runResume";

export { PI_RUN_IN_FLIGHT };

/** 끝나지 못한 실행. journal 이 null 이면 옛 표지(이어 하기 기록 없음) — 다시 보내기만 된다. */
export interface InterruptedPiRun {
  readonly request: string;
  readonly journal: PiRunJournal | null;
}

export function interruptedPiRun(entries: readonly AuditEntry[]): InterruptedPiRun | null {
  const last = entries[entries.length - 1];
  if (last?.kind !== "status") return null;
  const journal = parseInFlightMarker(last.text);
  if (journal === undefined) return null;
  for (let index = entries.length - 2; index >= 0; index -= 1) {
    const entry = entries[index]!;
    if (entry.kind === "user") return { request: entry.text, journal };
  }
  return null;
}

/** 끝나지 못한 실행의 요청 글. 기록 끝이 «실행 중» 표지가 아니면 null. */
export function interruptedPiRequest(entries: readonly AuditEntry[]): string | null {
  return interruptedPiRun(entries)?.request ?? null;
}
