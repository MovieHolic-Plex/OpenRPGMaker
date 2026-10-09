// test/aiSessionUsage.test.ts
// 사용량 집계 — 호출 지점에서 세는 것의 계약. 여기서 잠그는 것은 "무엇을 세고 무엇을
// 모른다고 말하는가" 다: usage 를 안 준 호출도 호출 수에는 들어가고, 그 사실이 따로 남는다.
// (구 구현은 감사 로그 문자열 정규식이라 요약·플래너 콜을 통째로 놓쳤다.)

import { describe, expect, it } from "vitest";
import {
  EMPTY_SESSION_USAGE,
  addSessionUsage,
  formatSessionUsage,
  formatTokenCount,
} from "@/ai/sessionUsage";

describe("addSessionUsage", () => {
  it("Given 같은 모델 두 호출 When 집계 Then 합계와 모델별이 모두 누적된다", () => {
    let totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 100, completion_tokens: 20 });
    totals = addSessionUsage(totals, "gpt-x", { prompt_tokens: 300, completion_tokens: 5 });

    expect(totals.calls).toBe(2);
    expect(totals.promptTokens).toBe(400);
    expect(totals.completionTokens).toBe(25);
    expect(totals.byModel).toHaveLength(1);
    expect(totals.byModel[0]).toMatchObject({ model: "gpt-x", calls: 2, promptTokens: 400, completionTokens: 25 });
  });

  it("Given 서로 다른 모델 When 집계 Then 첫 등장 순서로 분해된다", () => {
    let totals = addSessionUsage(EMPTY_SESSION_USAGE, "big", { prompt_tokens: 10, completion_tokens: 1 });
    totals = addSessionUsage(totals, "lite", { prompt_tokens: 4, completion_tokens: 2 });
    totals = addSessionUsage(totals, "big", { prompt_tokens: 6, completion_tokens: 3 });

    expect(totals.byModel.map((entry) => entry.model)).toEqual(["big", "lite"]);
    expect(totals.byModel[0]!.calls).toBe(2);
    expect(totals.byModel[1]!.calls).toBe(1);
  });

  it("Given usage 없는 호출 When 집계 Then 호출 수는 세고 계량 미보고로 표시한다", () => {
    const totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", undefined);

    expect(totals.calls).toBe(1);
    expect(totals.promptTokens).toBe(0);
    expect(totals.callsWithoutUsage).toBe(1);
    expect(formatSessionUsage(totals)).toContain("계량 미보고 1회");
  });

  it("Given 음수·NaN usage When 집계 Then 0 으로 취급한다(합계가 뒤로 가지 않는다)", () => {
    const totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", {
      prompt_tokens: -50,
      completion_tokens: Number.NaN,
    });

    expect(totals.promptTokens).toBe(0);
    expect(totals.completionTokens).toBe(0);
    expect(totals.callsWithoutUsage).toBe(1);
  });

  it("Given 빈 모델 이름 When 집계 Then 자리표시 라벨로 묶인다(집계가 사라지지 않는다)", () => {
    const totals = addSessionUsage(EMPTY_SESSION_USAGE, "   ", { prompt_tokens: 7 });

    expect(totals.byModel[0]!.model).toBe("(모델 미지정)");
  });

  it("Given 입력 집계 When 다시 집계 Then 원본은 불변이다", () => {
    const first = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 100 });
    addSessionUsage(first, "gpt-x", { prompt_tokens: 100 });

    expect(first.calls).toBe(1);
    expect(EMPTY_SESSION_USAGE.calls).toBe(0);
  });
});

describe("formatTokenCount / formatSessionUsage", () => {
  it("Given 네 자리 이상 When 포맷 Then 천 단위 구분을 로케일 없이 넣는다", () => {
    expect(formatTokenCount(0)).toBe("0");
    expect(formatTokenCount(999)).toBe("999");
    expect(formatTokenCount(1000)).toBe("1,000");
    expect(formatTokenCount(84_120)).toBe("84,120");
    expect(formatTokenCount(-5)).toBe("0");
  });

  it("Given 호출 0건 When 요약 Then 숫자 0 대신 상태 문장을 준다", () => {
    expect(formatSessionUsage(EMPTY_SESSION_USAGE)).toBe("아직 요청 없음");
  });

  it("Given 정상 집계 When 요약 Then 호출·입력·출력 세 항목만 남는다", () => {
    const totals = addSessionUsage(EMPTY_SESSION_USAGE, "gpt-x", { prompt_tokens: 84_120, completion_tokens: 6_410 });

    expect(formatSessionUsage(totals)).toBe("호출 1회 · 입력 84,120 · 출력 6,410");
  });
});
