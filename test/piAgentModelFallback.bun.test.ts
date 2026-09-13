import { describe, expect, test } from "bun:test";

// Exact selection: local catalog extension is allowed, silent substitution is not.
import { resolvePiModel } from "../scripts/lib/piAgentRuntime.ts";

describe("piAgent resolvePiModel fallback", () => {
  test("Gemini 3.8 uses the verified local catalog extension", () => {
    const model = resolvePiModel("google-antigravity", "gemini-3.8-flash");
    expect(model.id).toBe("gemini-3.8-flash");
    expect(model.thinking?.effortRouting?.high).toBe("gemini-3.8-flash-high");
    expect(() => resolvePiModel("google-antigravity", "unknown-model")).toThrow("대체하지 않았습니다");
  });

  test("빈 모델은 제공자 기본 모델이다", () => {
    expect(resolvePiModel("google-antigravity", undefined).id).toBe("gemini-3.7-flash");
    expect(resolvePiModel("openai-codex", undefined).id).toBe("gpt-5.6-sol");
  });

  test("번들에 있는 모델은 그대로 쓴다", () => {
    expect(resolvePiModel("google-antigravity", "gemini-3.6-flash").id).toBe("gemini-3.6-flash");
  });
});
