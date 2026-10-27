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
/**
 * 2026-10-15 실측: 변경 전 28도구 5,401토큰, 프리미티브 여섯을 더한 뒤 34도구 6,568토큰.
 * 종전 1,300은 이미 그 5,401보다 작아 무효인 래칫이었다. 지금 값으로 다시 전설한다 —
 * 계열 전체 계약은 get_animatic_capabilities 하나로 모으고, 여기서는 그 계열의 노출 몫만 기록한다.
 * (전체 카탈로그 상한 CATALOG_TOKEN_CEILING 은 올리지 않는다.)
 *
 * 2026-10-16 결정: 7,000 → 7,400. place_opening_charset_actor(번들 24×32 칩 배우 + 보폭 걷기)를
 * 계열에 더해 36도구 7,151토큰이 됐다. 이 한 도구가 계열 예산을 190토큰 먹었고, 다른 저작 도구의
 * 스키마·설명을 깎아 메우면 실제 능력(빛줄기 먼지·말풍선 상자·자막 큐 등)이 사라진다 — 그래서
 * 이 계열만 올리고 좁은 창 상한과 전체 카탈로그 상한은 그대로 둔다. 이 도구가 막대인간 배우를
 * 없애고 배경과 같은 도트 크기를 강제하므로, 늘어난 151토큰은 의도한 값이다.
 *
 * 2026-10-27: set_opening_sprite_states 가 목록에 빠진 채 38도구 7,774토큰으로 넘었다. 상한은 그대로 두고
 * edit_opening.scene 이 set_opening 의 큰 장면 스키마를 두 번째로 싣던 것을 짧은 객체 설명으로 바꿨다
 * (검사는 run 의 normalizeScene 이 같다). 실측은 PR 본문.
 */
const OPENING_FAMILY_TOKEN_CEILING = 7_400;

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
      "animate_opening_camera", "animate_opening_layer", "apply_opening_motion", "apply_opening_walk", "configure_opening_entry", "configure_opening_portrait_motion",
      "create_opening_animatic_shot", "edit_opening", "generate_opening_image", "generate_opening_layer", "get_opening", "get_opening_direction",
      "get_opening_references", "inspect_opening_timeline", "list_opening_media", "make_opening_storybook", "plan_opening", "preview_opening_animatic",
      "preview_opening_reference", "remove_opening", "remove_opening_audio_cue", "remove_opening_layer", "retime_opening_shot", "review_opening",
      "set_opening", "set_opening_caption", "set_opening_pixel_grid", "set_opening_region_loop", "set_opening_sprite_states", "set_opening_transition", "show_opening_image",
      "place_opening_background",
      "place_opening_charset_actor",
      "show_title_opening", "upsert_opening_audio_cue", "upsert_opening_emote", "upsert_opening_layer", "upsert_opening_light_fx",
    ].sort());
    const openingTokens = estimateContextTokens([{ role: "system", content: JSON.stringify(opening) }]);
    expect(openingTokens).toBeLessThanOrEqual(OPENING_FAMILY_TOKEN_CEILING);
  });
});
