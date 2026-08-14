// ai/messageBudget.ts
// CPEN 공급자 실측 상한: 요청 총 메시지 내용이 64,000자를 넘으면 422(validation_error)로
// 턴이 중단된다. 자율 런(48단계 예산)은 뷰포트 이미지(베이스64 수만 자)와 누적 툴 결과로
// 금방 상한을 넘는다(todo 8 실측: 88,408자 → 422). 전송 직전 오래된 메시지를 요약·이미지
// 제거로 압축해 요청을 안전 예산 안에 가둔다. 영구 대화(this.messages)는 건드리지 않고
// 요청 전용 사본을 만든다 — 감사/하네스 원본 보존.
import type { ChatMessage, ContentPart } from "./llmClient";

/** 안전 예산 — CPEN 하드 상한 64,000 대비 검수 프롬프트/도구 스키마 여유를 남긴다. */
export const REQUEST_MESSAGE_CHAR_BUDGET = 52_000;
/** 최근 메시지는 압축하지 않는다(모델이 지금 보고 있는 턴 컨텍스트). */
const KEEP_RECENT_MESSAGES = 6;

export function messageCharLength(message: ChatMessage): number {
  const content = message.content;
  if (content === null || content === undefined) return 0;
  if (typeof content === "string") return content.length;
  return content.reduce((sum, part) => sum + contentPartCharLength(part), 0);
}

function contentPartCharLength(part: ContentPart): number {
  if (part.type === "text") return part.text.length;
  return part.image_url.url.length;
}

export function totalMessagesCharLength(messages: readonly ChatMessage[]): number {
  return messages.reduce((sum, message) => sum + messageCharLength(message), 0);
}

function compactToolContent(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      ok?: unknown;
      summary?: unknown;
      issues?: unknown;
      data?: unknown;
      diff?: unknown;
    };
    if (typeof parsed !== "object" || parsed === null) return raw;
    // data/diff 는 컨텍스트 폭파 주범 — ok/summary/issues 만 남긴다.
    const compact: Record<string, unknown> = { ok: parsed.ok };
    if (typeof parsed.summary === "string") compact.summary = parsed.summary;
    if (Array.isArray(parsed.issues)) compact.issues = parsed.issues;
    return JSON.stringify(compact);
  } catch {
    return raw;
  }
}

function compactUserParts(parts: ContentPart[]): ContentPart[] {
  // 이미지(base64) 파트를 제거해 텍스트만 남긴다 — 비전 이미지는 최근 턴에만 의미가 있다.
  return parts.filter((part) => part.type !== "image_url");
}

/**
 * 전송용 사본을 만들고 총 길이가 budgetChars 를 넘으면 오래된 메시지부터 압축한다.
 * - 시스템 프롬프트는 항상 유지.
 * - 최근 KEEP_RECENT_MESSAGES 개는 무압축.
 * - 그 밖의 user/tool 메시지는 이미지 제거 / 툴 결과 요약.
 * - 그래도 초과하면 오래된 비시스템 메시지를 통째로 버린다(시스템·최근 2개는 보존).
 */
export function compactMessagesForRequest(
  messages: readonly ChatMessage[],
  budgetChars: number = REQUEST_MESSAGE_CHAR_BUDGET,
): ChatMessage[] {
  if (totalMessagesCharLength(messages) <= budgetChars) return [...messages];
  const result: ChatMessage[] = messages.map((message) => ({
    ...message,
    content: Array.isArray(message.content) ? [...message.content] : message.content,
  }));

  // 1차: 오래된 user/tool 메시지 압축 (최근 KEEP_RECENT_MESSAGES 개 제외, 시스템 제외).
  const compactBoundary = Math.max(1, result.length - KEEP_RECENT_MESSAGES);
  for (let index = 1; index < compactBoundary; index += 1) {
    const message = result[index];
    if (message.role === "tool" && typeof message.content === "string") {
      message.content = compactToolContent(message.content);
    } else if (message.role === "user" && Array.isArray(message.content)) {
      message.content = compactUserParts(message.content);
    }
    if (totalMessagesCharLength(result) <= budgetChars) return result;
  }

  // 2차: 여전히 초과면 오래된 비시스템 메시지 제거 (시스템·최근 2개 보존).
  while (totalMessagesCharLength(result) > budgetChars && result.length > 3) {
    const dropIndex = result.findIndex((_entry, index) => index > 0 && index < result.length - 2);
    if (dropIndex < 0) break;
    result.splice(dropIndex, 1);
  }
  return result;
}
