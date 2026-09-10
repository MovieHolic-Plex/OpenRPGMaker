import { describe, expect, test } from "bun:test";

// Pi 런타임 모델 폴백 회귀: 번들에 없는 저장 ID가 번들 첫 항목으로 조용히 바뀌면
// CCA에 없는 와이어 ID로 첫 호출부터 404가 난다(실측 2026-09-10:
// gemini-3.8-flash 저장 → start google-antigravity/claude-opus-4-5 → 404 즉시 실패).
// 폴백은 제공자 기본 모델이어야 한다(세션 경로 ohMyPiPiAiRuntime.resolveModel 과 동일).
import { resolvePiModel } from "../scripts/lib/piAgentRuntime.ts";

describe("piAgent resolvePiModel fallback", () => {
  test("번들에 없는 저장 모델은 제공자 기본 모델로 떨어진다 (번들 첫 항목 아님)", () => {
    expect(resolvePiModel("google-antigravity", "gemini-3.8-flash").id).toBe("gemini-3.7-flash");
  });

  test("빈 모델은 제공자 기본 모델이다", () => {
    expect(resolvePiModel("google-antigravity", undefined).id).toBe("gemini-3.7-flash");
    expect(resolvePiModel("openai-codex", undefined).id).toBe("gpt-5.6-sol");
  });

  test("번들에 있는 모델은 그대로 쓴다", () => {
    expect(resolvePiModel("google-antigravity", "gemini-3.6-flash").id).toBe("gemini-3.6-flash");
  });
});
