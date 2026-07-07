import { renderMarkdown } from "@/util/markdown";
import { el } from "@/util/dom";

export type AiBubbleRole = "user" | "assistant" | "tool" | "system";

export function markPriorTurns(log: HTMLElement): void {
  for (const child of Array.from(log.childNodes)) {
    (child as HTMLElement).classList?.add?.("is-prior-turn");
  }
}

export function appendConversationBubble(options: {
  readonly log: HTMLElement;
  readonly role: AiBubbleRole;
  readonly text: string;
  readonly revealVolatileZone: () => void;
  readonly removeStartScreen: () => void;
}): HTMLElement {
  options.revealVolatileZone();
  options.removeStartScreen();
  if (options.role === "user") markPriorTurns(options.log);
  const bubble = el("div", {
    class: `ai-chat-bubble ai-chat-${options.role}`,
    dataset: { testid: `ai-bubble-${options.role}` },
  });
  // 어시스턴트/시스템 말풍선은 마크다운을 렌더한다(굵게/목록/코드/링크 — 안전한 DOM 생성).
  // 사용자·툴 버블은 원문 그대로. 빈 텍스트(스트리밍 자리표시자)는 그대로 두고 완료 시 렌더한다.
  if (options.text && (options.role === "assistant" || options.role === "system")) bubble.replaceChildren(renderMarkdown(options.text));
  else if (options.text) bubble.textContent = options.text;
  options.log.append(bubble);
  options.log.scrollTop = options.log.scrollHeight;
  return bubble;
}

export function renderStreamedMarkdown(bubble: HTMLElement | null): void {
  const raw = bubble?.textContent ?? "";
  if (bubble && raw.trim()) bubble.replaceChildren(renderMarkdown(raw));
}
