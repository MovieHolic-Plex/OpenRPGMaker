import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AI_AUTHORING_EXAMPLES, buildSuggestionRows, rankAuthoringExamples } from "@/editor/panels/aiStartScreenCards";
import { FakeElement, installFakeDom } from "./fakeDom";

describe("추천 행 — 맵 진단 순서의 실행 문장 (데크 D5)", () => {
  let restoreDom: (() => void) | null = null;
  beforeEach(() => {
    restoreDom = installFakeDom();
  });
  afterEach(() => {
    restoreDom?.();
    restoreDom = null;
  });

  it("길이 없으면 길이 첫 행, 사람이 없으면 NPC·상점이 그 다음", () => {
    // Break: 순서가 고정이라 빈 맵에서도 「보물상자」 가 먼저 온다.
    const ranked = rankAuthoringExamples({ hasPath: false, eventCount: 0 });
    expect(ranked.slice(0, 3).map((example) => example.kind)).toEqual(["road", "npc", "shop"]);
    const populated = rankAuthoringExamples({ hasPath: true, eventCount: 5 });
    expect(populated.map((example) => example.kind)).toEqual(AI_AUTHORING_EXAMPLES.map((example) => example.kind));
  });

  it("행은 문장 + 종류이고 누르면 지시 전문을 넘긴다 — 상한 3", () => {
    // Break: 행이 라벨 한 단어만 보이거나, 6개가 다 나와 컴포저 위를 채운다.
    const picked: string[] = [];
    const rows = buildSuggestionRows({ examples: AI_AUTHORING_EXAMPLES, onPick: (instruction) => picked.push(instruction) });
    const buttons = rows.querySelectorAll(".ai-suggest-row");
    expect(buttons.length).toBe(3);
    expect(buttons[0]?.querySelector(".ai-suggest-row-text")?.textContent).toBe(AI_AUTHORING_EXAMPLES[0]?.title);
    expect(buttons[0]?.querySelector(".ai-suggest-row-why")?.textContent).toBe(AI_AUTHORING_EXAMPLES[0]?.label);
    (buttons[0] as unknown as FakeElement).click();
    expect(picked).toEqual([AI_AUTHORING_EXAMPLES[0]?.instruction]);
  });
});
