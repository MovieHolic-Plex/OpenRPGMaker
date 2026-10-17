import { describe, expect, it } from "vitest";
import { paginateDialogueSegments } from "@/player/dialoguePagination";

// jrpg-real-1 J07: 상수로 계산한 본문 폭(282)이 실제 안쪽 폭(280)보다 넓어, 280px 에서 40자 줄이 DOM 에서 한 번 더 접혔다.
// 해법은 dialogue.ts 가 실제 폭(좁은 쪽)으로 다시 나누는 것이다 — 여기서는 폭이 줄면 줄 수가 늘어 페이지가 갈라지는 계약만 고정한다.
describe("dialogue pagination width contract (J07)", () => {
  const line = "왕 에드가르. 제국의 마도 병기에 맞설 신형 오토클레이브 기갑검의 시험을 겸해 동행하겠소.";
  const measure = (text: string): number => Array.from(text).reduce((sum, char) => sum + (char === " " ? 3 : 7), 0);

  it("a narrower body width never yields more lines per page than maxLines", () => {
    for (const maxWidth of [282, 280, 276, 272]) {
      const pages = paginateDialogueSegments([{ text: line, colorIndex: 0 }], { maxWidth, measure, maxLines: 3 });
      for (const page of pages) expect(page.lines.length).toBeLessThanOrEqual(3);
    }
  });

  it("narrowing the width can only add lines", () => {
    const count = (maxWidth: number): number => paginateDialogueSegments([{ text: line, colorIndex: 0 }], { maxWidth, measure, maxLines: 3 }).reduce((n, page) => n + page.lines.length, 0);
    expect(count(240)).toBeGreaterThanOrEqual(count(282));
  });
});
