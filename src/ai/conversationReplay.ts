// ai/conversationReplay.ts
// 저장된 감사 기록(AuditEntry[]) → 새 세션에 주입할 "이전 대화" 한 덩어리. 순수 함수만 담는다.
//
// 왜 필요한가 (실측): 대화 복원(restoreConversationRecord)은 **화면 로그만** 되살린다.
// 복원 경로는 dropSession 을 지나므로 다음 턴의 세션은 새로 만들어지고, 그 messages 는
// 시스템 프롬프트 하나뿐이다 — 사용자에게는 대화가 이어진 것처럼 보이지만 모델은 직전 턴에
// 무엇을 했는지 전혀 모른다. "이전 대화 이어가기" 가 이름값을 하려면 모델도 이어야 한다.
//
// tool_calls 짝을 그대로 재구성하지 않는 이유: 짝(assistant.tool_calls)을 잃은 function
// response 는 Gemini/Cloud Code Assist 경로에서 400 이다(contextCompaction.repairRetainedTail
// 과 messageBudget.ts 의 같은 실패 모드). 그래서 압축 요약과 **같은 모양** — 시스템 프롬프트
// 바로 뒤의 role "user" 텍스트 한 덩어리 — 로만 주입한다. 이 자리는 이미 검증된 안전 지대다
// (요약을 user 로 두는 이유와 동일: 첫 턴이 user 여야 하는 공급자 제약도 함께 만족한다).

import type { AuditEntry } from "./session/types";
import type { ChatMessage } from "./llmClient";

/** 주입된 기록을 다시 알아보기 위한 구조 토큰(사람이 읽는 문구가 아니라 식별자). */
export const RESTORED_TRANSCRIPT_MARKER = "[restored-conversation]";

/** 주입 기본 상한. 압축 임계(모델 창)와 무관하게, 복원 하나가 창을 다 먹지 않게 잡는 값. */
export const RESTORED_TRANSCRIPT_MAX_CHARS = 12_000;

/** 툴 결과 요약 1건의 상한 — 복원 기록은 "무엇을 했는지"면 되고 원문 전체는 필요 없다. */
const TOOL_SUMMARY_MAX_CHARS = 200;

function truncate(text: string, maxChars: number): string {
  const trimmed = text.trim();
  return trimmed.length <= maxChars ? trimmed : `${trimmed.slice(0, maxChars)}…`;
}

/**
 * 감사 항목을 사람이 읽는 대화 기록으로 직렬화한다.
 *
 * status 항목은 버린다 — 턴 수명주기(tools:exposed·토큰 보정 등)는 진단용이고, 다음 턴의
 * 모델에게는 소음이다. 남는 것은 사용자 발화·조수 답변·툴 성공/실패 뿐이다.
 *
 * 상한을 넘으면 **꼬리(최근)를 남긴다.** 앞을 남기면 "방금 무엇을 하던 중이었나" 가 사라진다.
 */
export function serializeAuditTranscript(
  entries: readonly AuditEntry[],
  maxChars: number = RESTORED_TRANSCRIPT_MAX_CHARS,
): string {
  const lines: string[] = [];
  for (const entry of entries) {
    switch (entry.kind) {
      case "user":
        if (entry.text.trim()) lines.push(`[사용자] ${entry.text.trim()}`);
        break;
      case "assistant":
        if (entry.text.trim()) lines.push(`[조수] ${entry.text.trim()}`);
        break;
      case "tool":
        lines.push(`[툴 ${entry.ok ? "성공" : "실패"}] ${entry.name}: ${truncate(entry.summary, TOOL_SUMMARY_MAX_CHARS)}`);
        break;
      case "status":
        break;
    }
  }
  const joined = lines.join("\n");
  if (joined.length <= maxChars) return joined;
  const kept: string[] = [];
  let used = 0;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (used + line.length + 1 > maxChars) break;
    used += line.length + 1;
    kept.unshift(line);
  }
  const dropped = lines.length - kept.length;
  return [`[앞부분 ${dropped}줄 생략 — 오래된 기록]`, ...kept].join("\n");
}

/**
 * 새 세션에 꽂을 메시지. 이 기록은 "이미 지나간 일" 이고 다시 실행할 지시가 아님을 명시한다 —
 * 명시하지 않으면 모델이 복원된 마지막 사용자 발화를 새 지시로 읽고 같은 작업을 또 한다.
 */
export function restoredTranscriptMessage(transcript: string): ChatMessage {
  return {
    role: "user",
    content: [
      RESTORED_TRANSCRIPT_MARKER,
      "아래는 사용자가 방금 이어서 열은 **이전 대화의 기록**이다. 이미 지나간 일이므로 다시 실행하지 마라.",
      "여기 적힌 결정·제약·진행 상황을 그대로 이어받고, 다음 사용자 메시지를 기다려라.",
      "",
      transcript,
    ].join("\n"),
  };
}

export function isRestoredTranscriptMessage(message: ChatMessage): boolean {
  return (
    message.role === "user"
    && typeof message.content === "string"
    && message.content.startsWith(RESTORED_TRANSCRIPT_MARKER)
  );
}
