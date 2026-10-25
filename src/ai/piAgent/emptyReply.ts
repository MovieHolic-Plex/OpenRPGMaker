// 빈 답 지키기 — 제공자가 글도 도구 호출도 없이 "stop" 으로 끝낸 답(빈 완료)을 «끝난 차례»로 보지 않는다.
//
// 2026-10-25 실측(공포 트랙): 127.0.0.1:8318 프록시의 Gemini 는 그림이 든 요청이면 무엇이든 빈 완료(completion_tokens 0, finish "stop")를 돌려줬다.
// 도구 결과 그림(게임 오버 화면 미리보기 3장) 뒤 차례가 빈 답으로 «정착»해 사용자에게는 빈 보고가 남았다.
// 그림이 든 요청 뒤 빈 답이면 이 실행의 남은 요청에서 그림을 글 한 줄로 바꿔 한 번 더 묻는다. 그래도 비면 정직하게 실패로 끝낸다.
// 순수 모듈 — 실행기(scripts/lib/piAgentRuntime.ts)가 transformContext·message_end 에 끼운다.

type Part = { readonly type?: string; readonly text?: string };
type Message = { readonly role?: string; readonly content?: unknown };

export const IMAGE_STRIPPED_NOTE = "[그림 생략 — 이 AI 연결이 그림을 받지 못해 뺐다. 그림으로 확인할 것은 글로 된 결과·검사로 판단한다]";

const partsOf = (message: Message): Part[] => (Array.isArray(message.content) ? message.content as Part[] : []);

/** 메시지들 어딘가에 그림이 있나(사용자 첨부·도구 결과 모두). */
export function messagesHaveImages(messages: readonly unknown[]): boolean {
  return messages.some((m) => partsOf(m as Message).some((p) => p?.type === "image"));
}

/** 그림 조각을 글 한 줄로 바꾼 사본. 그림이 없는 메시지는 그대로(같은 객체) 둔다. */
export function stripImages<T>(messages: readonly T[]): T[] {
  return messages.map((m) => {
    const parts = partsOf(m as Message);
    if (!parts.some((p) => p?.type === "image")) return m;
    return { ...(m as object), content: parts.map((p) => (p?.type === "image" ? { type: "text", text: IMAGE_STRIPPED_NOTE } : p)) } as T;
  });
}

/** 글도 도구 호출도 없는 조수 답(오류·중단이 아닌데). */
export function isEmptyAssistantReply(message: { readonly role?: string; readonly content?: unknown; readonly stopReason?: string; readonly errorMessage?: string }): boolean {
  if (message.role !== "assistant" || message.errorMessage || message.stopReason === "error" || message.stopReason === "aborted") return false;
  const parts = partsOf(message);
  return !parts.some((p) => (p?.type === "text" && (p.text ?? "").trim()) || p?.type === "toolCall");
}
