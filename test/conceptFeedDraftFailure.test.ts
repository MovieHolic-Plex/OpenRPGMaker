import { describe, expect, it } from "vitest";
import { draftFailureReason } from "@/start/conceptFeed/conceptFeed";

describe("draftFailureReason", () => {
  it("한도 초과는 원시 JSON 없이 기다리거나 다른 계정을 고르라고 말한다", () => {
    const reason = draftFailureReason(new Error('요청 한도 초과(429): 잠시 후 다시 시도하세요. — {"error":"You have hit your ChatGPT usage limit"}'));
    expect(reason).toContain("한도");
    expect(reason).not.toContain("{");
  });

  it("연결 실패는 AI 설정에서 연결을 확인하라고 말한다", () => {
    expect(draftFailureReason(new TypeError("Failed to fetch"))).toContain("AI 설정");
  });

  it("그 밖의 문구는 뒤에 붙은 원시 응답만 떼고 그대로 보인다", () => {
    expect(draftFailureReason(new Error("컨셉을 만들지 못했습니다. — {\"x\":1}"))).toBe("컨셉을 만들지 못했습니다.");
  });
});
