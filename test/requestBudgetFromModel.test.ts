// test/requestBudgetFromModel.test.ts
// 요청 문자 예산·작업 창을 **모델에서** 끌어내는 계약(2026-08-30 조사).
//
// 잠그는 것은 두 가지다.
//  1. 사라진 공급자(CPEN)의 검증 상한 52,000자가 창 1M 토큰짜리 모델의 기억까지 자르지 않는다.
//  2. 압축(요약)과 문자 클램프의 **순서**가 제자리에 있다 — 압축이 남기기로 한 분량이 클램프에
//     잘리면 똑똑한 계층은 돌 자리가 없다. 이것이 옛 상태였다(keepRecent 80,000자 > 클램프 52,000자).

import { describe, expect, it } from "vitest";
import {
  AUTO_COMPACTION_TRIGGER_TOKENS,
  DEFAULT_COMPACTION_SETTINGS,
  resolveContextWindow,
  shouldCompact,
} from "@/ai/contextCompaction";
import {
  REQUEST_MESSAGE_CHAR_BUDGET,
  WORKING_CONTEXT_TOKEN_CAP,
  resolveRequestCharBudget,
  resolveWorkingContextTokens,
} from "@/ai/messageBudget";
import { DEFAULT_CHARS_PER_TOKEN } from "@/ai/tokenBudget";

const GEMINI = { model: "gemini-3.7-flash", baseUrl: "https://daily-cloudcode-pa.googleapis.com" };
const CODEX = { model: "gpt-5.6-sol", baseUrl: "https://chatgpt.com/backend-api/codex" };
const CPEN = { model: "cpen/gemini-3-flash", baseUrl: "https://cpenrouter.space/v1" };

describe("resolveRequestCharBudget", () => {
  it("기본 모델(gemini-3.7-flash)에서 옛 고정값 52,000 보다 넓다", () => {
    const budget = resolveRequestCharBudget(GEMINI);
    expect(budget).toBeGreaterThan(REQUEST_MESSAGE_CHAR_BUDGET);
  });

  it("CPEN 경로는 그 공급자 하드 상한을 그대로 지킨다", () => {
    // 접두사(cpen/)로도, baseUrl(/api/cpen)로도 판정된다 — llmClient 와 같은 규칙.
    expect(resolveRequestCharBudget(CPEN)).toBe(REQUEST_MESSAGE_CHAR_BUDGET);
    expect(resolveRequestCharBudget({ model: "gemini-3.7-flash", baseUrl: "https://x.test/api/cpen" }))
      .toBe(REQUEST_MESSAGE_CHAR_BUDGET);
  });

  it("어떤 모델에서도 옛 고정값보다 좁아지지 않는다", () => {
    for (const config of [GEMINI, CODEX, CPEN, { model: "알 수 없는 모델", baseUrl: "https://x.test/v1" }]) {
      expect(resolveRequestCharBudget(config), config.model).toBeGreaterThanOrEqual(REQUEST_MESSAGE_CHAR_BUDGET);
    }
  });

  it("모델 창을 넘지 않는다", () => {
    for (const config of [GEMINI, CODEX]) {
      const windowChars = resolveContextWindow(config.model) * DEFAULT_CHARS_PER_TOKEN;
      expect(resolveRequestCharBudget(config), config.model).toBeLessThanOrEqual(windowChars);
    }
  });

  it("작업 창 상한을 넘지 않는다 — 창이 남아도 다 쓰지 않는다", () => {
    // gemini 는 창이 1,048,576 토큰이지만 요청당 입력을 1M 토큰까지 키울 이유가 없다.
    const capChars = WORKING_CONTEXT_TOKEN_CAP * DEFAULT_CHARS_PER_TOKEN;
    expect(resolveRequestCharBudget(GEMINI)).toBeLessThanOrEqual(capChars);
    expect(resolveWorkingContextTokens(GEMINI)).toBe(WORKING_CONTEXT_TOKEN_CAP);
  });

  it("압축 문턱은 명시한 지점(20만 토큰)이다", () => {
    // 원래 이 항목은 "문턱은 안 움직인다(111,616)" 를 잠갔다. 문자 클램프만 고치는 변경이었으니
    // 그때는 맞았다. 지금은 지점 자체가 제품 선택이다(감독 지시 2026-08-30: "20만 토큰 넘으면
    // compaction"). 창 128,000 에서 파생된 111,616 은 더 이상 기준이 아니다.
    const threshold = resolveWorkingContextTokens(GEMINI) - DEFAULT_COMPACTION_SETTINGS.reserveTokens;
    expect(threshold).toBe(AUTO_COMPACTION_TRIGGER_TOKENS);
  });

  /**
   * 핵심 회귀. 압축은 최근 keepRecentTokens 를 원문으로 남기고 앞부분만 요약으로 갈아치운다.
   * 그 잔존분이 문자 클램프보다 크면, 압축이 성공한 직후에 클램프가 그 결과를 다시 잘라낸다.
   * 옛 상태: keepRecent 20,000토큰 ≈ 80,000자 > 클램프 52,000자.
   */
  it("압축이 남기기로 한 분량이 클램프에 잘리지 않는다", () => {
    const keptChars = DEFAULT_COMPACTION_SETTINGS.keepRecentTokens * DEFAULT_CHARS_PER_TOKEN;
    expect(keptChars).toBeGreaterThan(REQUEST_MESSAGE_CHAR_BUDGET); // 옛 상태가 실제로 어긋나 있었다
    expect(resolveRequestCharBudget(GEMINI)).toBeGreaterThan(keptChars);
  });
});

describe("resolveWorkingContextTokens", () => {
  it("요약이 문자 클램프보다 먼저 돈다", () => {
    // 작업 창 - reserve 지점에서 요약이 켜지고, 그 지점은 클램프 예산 안쪽이어야 한다.
    // 그렇지 않으면 클램프가 먼저 걸려 요약이 영영 돌지 않는다(옛 상태: gemini 문턱 1,032,192토큰).
    const working = resolveWorkingContextTokens(GEMINI);
    const budgetTokens = Math.floor(resolveRequestCharBudget(GEMINI) / DEFAULT_CHARS_PER_TOKEN);
    expect(working).toBeLessThanOrEqual(budgetTokens);

    const threshold = working - DEFAULT_COMPACTION_SETTINGS.reserveTokens;
    expect(threshold).toBeGreaterThan(0);
    expect(shouldCompact(threshold + 1, working, DEFAULT_COMPACTION_SETTINGS)).toBe(true);
    // 요약이 남기는 분량(문턱에서 잘라 keepRecent 를 남긴 것)이 클램프 안에 들어간다.
    expect(DEFAULT_COMPACTION_SETTINGS.keepRecentTokens).toBeLessThan(budgetTokens);
  });

  /**
   * 회귀 가드. 작업 창을 클램프에 무조건 맞추면 좁은 경로(CPEN 52,000자 = 13,000토큰)에서
   * 문턱이 `13,000 - 16,384 = -3,384` 가 되어 **매 턴 요약 LLM 이 돈다**(실측으로 잡은 자체 결함).
   */
  it("요약 문턱이 어떤 경로에서도 음수가 되지 않는다", () => {
    for (const config of [GEMINI, CODEX, CPEN, { model: "알 수 없는 모델", baseUrl: "https://x.test/v1" }]) {
      const threshold = resolveWorkingContextTokens(config) - DEFAULT_COMPACTION_SETTINGS.reserveTokens;
      expect(threshold, config.model).toBeGreaterThan(0);
      // 빈 대화에서 요약이 켜지지 않는다.
      expect(shouldCompact(0, resolveWorkingContextTokens(config), DEFAULT_COMPACTION_SETTINGS), config.model).toBe(false);
    }
  });

  it("클램프가 압축 계약을 못 담는 경로는 옛 동작(모델 창)을 유지한다", () => {
    // CPEN 은 하드 상한 52,000자라 요약 결과(잔존 80,000자)가 애초에 들어가지 않는다.
    expect(resolveWorkingContextTokens(CPEN)).toBe(resolveContextWindow(CPEN.model));
  });

  it("모델 창보다 커지지 않는다", () => {
    for (const config of [GEMINI, CODEX, CPEN]) {
      expect(resolveWorkingContextTokens(config), config.model)
        .toBeLessThanOrEqual(resolveContextWindow(config.model));
    }
  });

  it("옛 구현(모델 창 그대로)에서는 요약이 클램프보다 79배 늦게 켜졌다", () => {
    // 회귀의 근거를 수치로 남긴다 — 이 단언이 깨지면 창/클램프 관계가 다시 뒤집힌 것이다.
    const oldThreshold = resolveContextWindow("gemini-3.7-flash") - DEFAULT_COMPACTION_SETTINGS.reserveTokens;
    const oldClampTokens = REQUEST_MESSAGE_CHAR_BUDGET / DEFAULT_CHARS_PER_TOKEN;
    expect(oldThreshold).toBeGreaterThan(oldClampTokens * 50);
    // 새 구현은 그 역전을 없앤다 — 클램프가 문턱 + 잔존분을 담는다.
    const working = resolveWorkingContextTokens(GEMINI);
    const clampTokens = Math.floor(resolveRequestCharBudget(GEMINI) / DEFAULT_CHARS_PER_TOKEN);
    expect(clampTokens).toBeGreaterThanOrEqual(working);
  });
});

describe("자동 압축 지점(20만 토큰)", () => {
  // 감독 지시(2026-08-30): "20만 토큰 넘으면 compaction 하게 하고".
  // 예전에는 작업 창 상한이 128,000 이라 문턱이 111,616 이었다 — 창 1M 짜리 기본 모델이
  // 창의 11% 에서 앞부분 기억을 요약으로 바꿔 버렸다.
  it("창이 넉넉한 모델은 정확히 20만 토큰에서 압축한다", () => {
    for (const config of [GEMINI, CODEX]) {
      const threshold = resolveWorkingContextTokens(config) - DEFAULT_COMPACTION_SETTINGS.reserveTokens;
      expect(threshold, config.model).toBe(AUTO_COMPACTION_TRIGGER_TOKENS);
      expect(shouldCompact(AUTO_COMPACTION_TRIGGER_TOKENS, resolveWorkingContextTokens(config), DEFAULT_COMPACTION_SETTINGS), config.model).toBe(false);
      expect(shouldCompact(AUTO_COMPACTION_TRIGGER_TOKENS + 1, resolveWorkingContextTokens(config), DEFAULT_COMPACTION_SETTINGS), config.model).toBe(true);
    }
  });

  it("창이 20만보다 좁은 모델은 자기 창이 먼저 걸린다", () => {
    const claude = { model: "claude-opus-4-8", baseUrl: "https://api.anthropic.test/v1" };
    expect(resolveWorkingContextTokens(claude)).toBe(resolveContextWindow(claude.model));
    const threshold = resolveWorkingContextTokens(claude) - DEFAULT_COMPACTION_SETTINGS.reserveTokens;
    expect(threshold).toBeLessThan(AUTO_COMPACTION_TRIGGER_TOKENS);
  });
});
