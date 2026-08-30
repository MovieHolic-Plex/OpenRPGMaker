// editor/panels/aiBubbleDecorations.ts
// 어시스턴트 말풍선 **사후 장식** — 마크다운을 다시 그린 다음에 붙이는 것들만 둔다.
// aiChatPanel(3,422줄)에서 분리했다. 순수 DOM 함수라 패널 클로저가 필요 없다.
import { el } from "@/util/dom";
import type { Project } from "@/project/types";
import { findEntityMentions, renderEntityMentionStrip } from "./aiEntityMentions";

/**
 * 긴 검사/린트 출력(`pre`)을 접이식 `details` 로 갈아 넣는다 — 대화가 로그 덤프로 덮이지 않게.
 * 이미 `details` 안에 있는 `pre` 는 건드리지 않는다(두 번 접히면 열 수 없다).
 */
export function foldWorkLogs(bubble: HTMLElement | null): void {
  if (!bubble) return;
  const preElements = Array.from(bubble.querySelectorAll("pre"));
  for (const pre of preElements) {
    if (pre.parentElement?.tagName === "DETAILS") continue;
    const text = pre.textContent ?? "";
    const isWorkLog = /lint|warning|error|품질|검사|오류|경고|출입구\s*쌍|id\s+map_|✓/i.test(text);
    if (!isWorkLog) continue;
    const errMatch = text.match(/(?:error|오류)\s*[:=]?\s*(\d+)/i);
    const warnMatch = text.match(/(?:warning|경고)\s*[:=]?\s*(\d+)/i);
    const infoMatch = text.match(/(?:info|정보)\s*[:=]?\s*(\d+)/i);
    const parts: string[] = ["작업 기록"];
    if (errMatch) parts.push(`오류 ${errMatch[1]}`);
    if (warnMatch) parts.push(`경고 ${warnMatch[1]}`);
    else if (infoMatch) parts.push(`안내 ${infoMatch[1]}`);
    const summaryText = parts.join(" · ");

    const details = el("details", {
      class: "work ai-work-log",
      dataset: { testid: "ai-work-log" },
      children: [el("summary", { text: summaryText })],
    });
    pre.replaceWith(details);
    details.append(pre);
  }
}

/**
 * 이미지 리치 장식 — 어시스턴트 문장이 언급한 통산 자료(몬스터·아이템·등장인물)의
 * 썸네일을 그 문장 밑에 붙인다. 이름만 나오는 답변은 "어느 슬라임?" 을 다시 물게 하고,
 * 에디터는 이미 그 그림을 지고 있다(databaseRecordThumbnails.recordListThumbnail).
 *
 * 마크다운을 다시 그리는 renderStreamedMarkdown 뒤에 부를것을 전제한다 — 그 전에 붙이면
 * 본문이 다시 쓰이면서 스트립이 터진다. 같은 버블을 다시 장식해도 덧붙이지 않는다.
 */
export function decorateAssistantMentions(
  bubble: HTMLElement | null,
  assistantText: string,
  project: Project,
): void {
  if (!bubble) return;
  foldWorkLogs(bubble);
  const previous = bubble.querySelector?.("[data-testid=ai-mention-strip]");
  previous?.remove();
  if (!assistantText.trim()) return;
  const strip = renderEntityMentionStrip(findEntityMentions(assistantText, project), project);
  if (strip) bubble.append(strip);
}
