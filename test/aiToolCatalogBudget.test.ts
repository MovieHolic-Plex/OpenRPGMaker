import { describe, expect, it } from "vitest";
import { DEFAULT_COMPACTION_SETTINGS, DEFAULT_CONTEXT_WINDOW, estimateContextTokens, resolveContextWindow } from "@/ai/contextCompaction";
import { buildSessionRegistryTools, fullCatalogFitsWindow } from "@/ai/sessionToolExposure";
import { allTools, toOpenAiTools } from "@/editor/tools/toolRegistry";

/**
 * 좁은 창(128,000 — 알 수 없는 모델의 폴백)에서 **실제로 보내는** 툴 목록이 써도 되는 자리의 래칫.
 * 128,000 − 예비분 16,384 − 툴 ≈ 13,000 토큰이 대화와 원본 매니페스트의 전부이고, 모자라면 요청 조립이
 * `original-context-window-exceeded` 로 턴 자체를 죽인다. 이 수치를 올리는 변경은 그 경로를 어떻게 할지
 * (툴 스코핑·매니페스트 축약) 함께 결정해야 한다 — 조용한 상향 금지.
 *
 * 2026-10-02: 전체 카탈로그가 약 189,000 토큰으로 커져 이 래칫을 넘었다. 그 상태로는 폴백 턴이 claude·glm(200,000)
 * 창에서도 죽는다. 그래서 폴백은 창에 들어갈 때만 전체를 보내고, 아니면 코어+발견 도구로 좁힌다
 * (`buildSessionRegistryTools({ contextWindow })`). 래칫은 이제 「좁은 창의 폴백 실제 목록」에 건다.
 */
const CATALOG_TOKEN_CEILING = 99_000;
const OPENING_FAMILY_TOKEN_CEILING = 1_300;

const tokensOf = (tools: readonly unknown[]): number => estimateContextTokens([{ role: "system", content: JSON.stringify(tools) }]);

describe("AI 툴 카탈로그 예산", () => {
  it("좁은 창에서 대화가 쓸 자리를 남긴다", () => {
    expect(toOpenAiTools(allTools()).length).toBeGreaterThanOrEqual(200);
    for (const window of [DEFAULT_CONTEXT_WINDOW, 200_000]) {
      // 의도 선언이 없거나 폴백인 턴 — 예전에는 무조건 전체 카탈로그였다.
      const sent = buildSessionRegistryTools({ requestText: "", intent: null, fullCatalogFallback: true, contextWindow: window });
      const sentTokens = tokensOf(sent);
      expect(sentTokens, `창 ${window}`).toBeLessThanOrEqual(CATALOG_TOKEN_CEILING);
      expect(sentTokens + DEFAULT_COMPACTION_SETTINGS.reserveTokens, `창 ${window}`).toBeLessThan(window);
      // 좁혀도 나머지를 찾는 길은 남아야 한다.
      expect(sent.map((tool) => tool.function.name)).toContain("find_tools");
    }
  });

  it("넓은 창(gemini·gpt-5)의 폴백은 여전히 전체 카탈로그를 보낸다", () => {
    const full = toOpenAiTools(allTools());
    const sent = buildSessionRegistryTools({ requestText: "", intent: null, fullCatalogFallback: true, contextWindow: resolveContextWindow("gpt-5.4") });
    expect(sent.length).toBe(full.length);
    expect(fullCatalogFitsWindow(full, resolveContextWindow("gemini-3.8-flash"))).toBe(true);
  });

  it("오프닝 저작 툴 묶음의 몫을 기록한다", () => {
    const opening = toOpenAiTools(allTools()).filter(entry => entry.function.name.includes("opening"));
    expect(opening.map(entry => entry.function.name).sort()).toEqual([
      "edit_opening", "generate_opening_image", "get_opening", "list_opening_media", "plan_opening", "remove_opening", "review_opening", "set_opening", "show_opening_image",
    ]);
    const openingTokens = estimateContextTokens([{ role: "system", content: JSON.stringify(opening) }]);
    expect(openingTokens).toBeLessThanOrEqual(OPENING_FAMILY_TOKEN_CEILING);
  });
});
