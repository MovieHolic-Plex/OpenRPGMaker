// player/dialogueTextRenderer.ts
// 대화 본문을 DOM 으로 옮긴다. 두 가지 방식을 준다.
//
//  - `renderDialogueSegments` — 일괄 렌더. 선택지 버튼·질문 프롬프트처럼 타이핑이 없는 자리.
//  - `mountDialoguePage` — 증분 렌더. 타이핑되는 본문 전용.
//
// ── 증분 렌더가 필요한 이유 ──────────────────────────────────────────────────
// 예전 본문 경로는 글자가 하나 늘 때마다 `clearChildren` + 전량 재생성이었다. 그러면
// **이미 떠 있던 글자의 노드까지 매 틱 교체**되므로 글자별 CSS 애니메이션이 프레임마다
// 처음으로 되감긴다 — 즉 글자 등장 연출을 CSS 로 붙일 수단이 아예 없었다.
// 여기서는 이미 붙인 노드를 절대 건드리지 않고 **뒤에만 덧붙인다.** 그래서 각 글자
// span 은 삽입될 때 딱 한 번 재생되고, 앞 글자들은 자기 재생 위치를 그대로 유지한다.
// (`test/dialogueTextRenderer.test.ts` 가 노드 동일성을 단정한다.)
//
// ── 왜 페이지 전체를 미리 깔고 opacity 로 숨기지 않는가 ──────────────────────
// 그 방식이면 `.body.textContent` 가 항상 페이지 전문이 된다. 본문의 진실은
// textContent 로 읽히고 있다(타이핑 타이밍 회귀 `test/dialogue.test.ts`, 그리고 스크린
// 리더). 미리 깔면 보조기술이 페이지를 통째로 먼저 읽어 버린다. 덧붙이기 방식은
// 애니메이션 되감김 문제만 정확히 없애고 그 계약은 건드리지 않는다.
// 리플로 걱정도 없다 — 줄바꿈은 페이지네이터가 명시 "\n" 으로 확정했고(`dialoguePagination.ts`)
// 글자는 줄 오른쪽으로만 늘어나므로 이미 놓인 글자가 밀리지 않는다.
//
// ── 글자 연출은 opacity 만 쓴다 ──────────────────────────────────────────────
// span 은 인라인 박스이고 **인라인 박스는 transform 을 무시한다.** transform 을 쓰려면
// inline-block 이어야 하는데, 그러면 픽셀 폰트의 베이스라인·줄높이 정합과 줄바꿈 단위가
// 흔들린다. 그래서 CSS 쪽 `dialogue-char-enter` 는 페이드만 한다.

import type { DialogueTextSegment } from "@/player/dialoguePagination";
import { clearChildren, el } from "@/util/dom";

/** 글자 한 칸. 색은 세그먼트에서 물려받는다. */
type FlatChar = {
  readonly text: string;
  readonly colorIndex: number;
};

export type DialoguePageRenderer = {
  /** 이 페이지의 글자 수. `dialoguePlaybackTokens` 의 char 토큰 수와 같다. */
  readonly length: number;
  /** 앞에서 `count` 글자까지 보이게 한다. 이미 보이는 글자의 노드는 재생성하지 않는다. */
  reveal(count: number): void;
  /** 남은 글자를 한꺼번에 붙인다. 이때 붙는 글자는 연출 없이 즉시 보인다. */
  revealAll(): void;
};

function colorClass(colorIndex: number): string {
  return `dialogue-char dialogue-color dialogue-color-${colorIndex}`;
}

function flattenSegments(segments: readonly DialogueTextSegment[]): FlatChar[] {
  const chars: FlatChar[] = [];
  for (const segment of segments) {
    for (const text of Array.from(segment.text)) chars.push({ text, colorIndex: segment.colorIndex });
  }
  return chars;
}

/**
 * 일괄 렌더. 색이 같은 글자를 한 노드로 묶어 노드 수를 줄인다 — 타이핑이 없는 자리에는
 * 글자별 노드가 필요 없다.
 */
export function renderDialogueSegments(
  target: HTMLElement,
  segments: readonly DialogueTextSegment[],
  visibleChars = Infinity
): void {
  clearChildren(target);
  let remaining = visibleChars;
  for (const segment of segments) {
    if (remaining <= 0) break;
    const chars = Array.from(segment.text);
    const text = chars.slice(0, remaining).join("");
    remaining -= chars.length;
    if (!text) continue;
    if (segment.colorIndex === 0) {
      target.append(document.createTextNode(text));
      continue;
    }
    target.append(el("span", { class: `dialogue-color dialogue-color-${segment.colorIndex}`, text }));
  }
}

/**
 * 증분 렌더러를 붙인다. 대상은 비워지고, 이후 `reveal`/`revealAll` 로만 채워진다.
 * 페이지가 바뀔 때마다 새로 마운트한다 — 렌더러는 한 페이지의 글자 목록을 고정으로 갖는다.
 */
export function mountDialoguePage(
  target: HTMLElement,
  segments: readonly DialogueTextSegment[]
): DialoguePageRenderer {
  clearChildren(target);
  const chars = flattenSegments(segments);
  const nodes: HTMLElement[] = [];

  const append = (char: FlatChar, instant: boolean): void => {
    // 색 0 도 span 으로 감싼다. 글자별 연출을 걸 수 있는 노드가 있어야 하고,
    // 인라인 span 은 줄바꿈·공백 처리(white-space: pre-wrap)에 영향을 주지 않는다.
    const node = el("span", {
      class: char.colorIndex === 0 ? "dialogue-char" : colorClass(char.colorIndex),
      text: char.text,
    });
    // 건너뛰기로 한꺼번에 붙는 글자까지 페이드시키면 수십 자가 동시에 밝아져 어수선하다.
    if (instant) node.classList.add("dialogue-char-instant");
    nodes.push(node);
    target.append(node);
  };

  const grow = (next: number, instant: boolean): void => {
    for (let index = nodes.length; index < next; index += 1) append(chars[index]!, instant);
  };

  const shrink = (next: number): void => {
    // 실제 재생 경로는 뒤로 가지 않는다(페이지가 바뀌면 새로 마운트한다). 그래도
    // 앞 글자의 노드는 살려 둔다 — 재생성하면 되감김 문제가 되돌아온다.
    while (nodes.length > next) nodes.pop()?.remove();
  };

  const reveal = (count: number): void => {
    const next = Math.max(0, Math.min(chars.length, Math.trunc(Number.isFinite(count) ? count : chars.length)));
    if (next < nodes.length) shrink(next);
    else grow(next, false);
  };

  return {
    length: chars.length,
    reveal,
    revealAll: () => grow(chars.length, true),
  };
}
