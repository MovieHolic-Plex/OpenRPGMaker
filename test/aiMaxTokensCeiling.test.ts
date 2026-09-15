// 공급자 max_tokens 상한 계약 — 실측 근거로 고정한다.
//
// 왜(2026-09-16 실측): 기본 설정의 maxTokens(200000)가 그대로 나가면 Cloud Code Assist 가
// `400 INVALID_ARGUMENT — Request contains an invalid argument.` 로 거부해 DB AI 턴이
// 레코드 준비 단계에서 매번 죽었다("프로젝트 기록 준비 실패: 요청 실패(400)").
// 같은 요청에서 max_tokens 만 바꾼 실측: 65536 → 200, 100000 → 400.
// 요청 덤프: /home/main/.omp/logs/http-400-requests/*.json 의 generationConfig.maxOutputTokens.
import { describe, expect, it } from "vitest";
import {
  clampMaxTokens,
  defaultAiConfig,
  DEFAULT_MAX_TOKENS,
  GEMINI_MAX_OUTPUT_TOKENS,
  providerCapability,
} from "@/ai/llmClient";
import { ANTIGRAVITY_PROVIDER_ID, CODEX_PROVIDER_ID } from "@/ai/oauth/credentials";

function capabilityFor(providerId: string) {
  return providerCapability({ ...defaultAiConfig(), providerId });
}

describe("공급자 max_tokens 상한", () => {
  it("Antigravity 경로는 실측 상한을 선언한다", () => {
    expect(capabilityFor(ANTIGRAVITY_PROVIDER_ID).maxTokensCeiling).toBe(GEMINI_MAX_OUTPUT_TOKENS);
    // 상한을 손으로 낮추거나 올리면 이 실측값과 어긋난다 — 그때는 다시 재고 근거를 남겨라.
    expect(GEMINI_MAX_OUTPUT_TOKENS).toBe(65_536);
  });

  it("기본 예산(200000)이 그대로 나가지 않는다 — 400 의 직접 원인이었다", () => {
    expect(DEFAULT_MAX_TOKENS).toBeGreaterThan(GEMINI_MAX_OUTPUT_TOKENS);
    expect(clampMaxTokens(capabilityFor(ANTIGRAVITY_PROVIDER_ID), DEFAULT_MAX_TOKENS)).toBe(
      GEMINI_MAX_OUTPUT_TOKENS,
    );
  });

  it("상한 이하는 건드리지 않는다(경계 포함)", () => {
    const capability = capabilityFor(ANTIGRAVITY_PROVIDER_ID);
    expect(clampMaxTokens(capability, GEMINI_MAX_OUTPUT_TOKENS)).toBe(GEMINI_MAX_OUTPUT_TOKENS);
    expect(clampMaxTokens(capability, 8192)).toBe(8192);
  });

  it("상한이 선언되지 않은 공급자는 조용히 좁히지 않는다", () => {
    const capability = capabilityFor(CODEX_PROVIDER_ID);
    expect(capability.maxTokensCeiling).toBeUndefined();
    expect(clampMaxTokens(capability, DEFAULT_MAX_TOKENS)).toBe(DEFAULT_MAX_TOKENS);
  });
});
