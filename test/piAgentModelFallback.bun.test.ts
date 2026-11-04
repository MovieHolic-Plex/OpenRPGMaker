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
    expect(resolvePiModel("google-antigravity", undefined).id).toBe("gemini-3.8-flash");
    expect(resolvePiModel("openai-codex", undefined).id).toBe("gpt-5.6-sol");
  });

  test("번들에 있는 모델은 그대로 쓴다", () => {
    expect(resolvePiModel("google-antigravity", "gemini-3.6-flash").id).toBe("gemini-3.6-flash");
  });

  test("GPT-6 계열은 로컬 확장으로 풀리고 Codex 전송을 그대로 쓴다", () => {
    for (const id of ["gpt-6-astra", "gpt-6-sol", "gpt-6-luna"]) {
      const model = resolvePiModel("openai-codex", id);
      expect(model.id).toBe(id);
      expect(model.api).toBe("openai-codex-responses");
      expect(model.contextWindow).toBe(272000);
    }
    expect(() => resolvePiModel("openai-codex", "gpt-6-unknown")).toThrow("대체하지 않았습니다");
    // 6.1 둘은 500k(~/.codex/models_cache.json 2026-11-04). 6.1-sol 은 번들(18.13.2)에도 같은 값으로 있다.
    expect(resolvePiModel("openai-codex", "gpt-6.1-sol").contextWindow).toBe(500000);
    expect(resolvePiModel("openai-codex", "gpt-6.1-terra").contextWindow).toBe(272000);
  });
});
