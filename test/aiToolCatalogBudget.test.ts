import { describe, expect, it } from "vitest";
import { DEFAULT_COMPACTION_SETTINGS, DEFAULT_CONTEXT_WINDOW, estimateContextTokens } from "@/ai/contextCompaction";
import { allTools, toOpenAiTools } from "@/editor/tools/toolRegistry";

/**
 * 좁은 창(128,000 — gpt-5.3-codex-spark 와 알 수 없는 모델의 폴백)에서 툴 카탈로그가 써도 되는 자리의 래칫.
 * 128,000 − 예비분 16,384 − 카탈로그 ≈ 13,000 토큰이 대화와 원본 매니페스트의 전부이고, 모자라면 요청 조립이
 * `original-context-window-exceeded` 로 턴 자체를 죽인다. 이 수치를 올리는 변경은 그 경로를 어떻게 할지
 * (툴 스코핑·매니페스트 축약) 함께 결정해야 한다 — 조용한 상향 금지.
 */
const CATALOG_TOKEN_CEILING = 99_000;
const OPENING_FAMILY_TOKEN_CEILING = 1_300;

describe("AI 툴 카탈로그 예산", () => {
  it("좁은 창에서 대화가 쓸 자리를 남긴다", () => {
    const tools = toOpenAiTools(allTools());
    const toolsTokens = estimateContextTokens([{ role: "system", content: JSON.stringify(tools) }]);
    expect(tools.length).toBeGreaterThanOrEqual(200);
    expect(toolsTokens).toBeLessThanOrEqual(CATALOG_TOKEN_CEILING);
    expect(toolsTokens + DEFAULT_COMPACTION_SETTINGS.reserveTokens).toBeLessThan(DEFAULT_CONTEXT_WINDOW);
  });

  it("오프닝 저작 툴 묶음의 몫을 기록한다", () => {
    const opening = toOpenAiTools(allTools()).filter(entry => entry.function.name.includes("opening"));
    expect(opening.map(entry => entry.function.name).sort()).toEqual([
      "edit_opening", "generate_opening_image", "get_opening", "list_opening_media", "remove_opening", "set_opening",
    ]);
    const openingTokens = estimateContextTokens([{ role: "system", content: JSON.stringify(opening) }]);
    expect(openingTokens).toBeLessThanOrEqual(OPENING_FAMILY_TOKEN_CEILING);
  });
});
