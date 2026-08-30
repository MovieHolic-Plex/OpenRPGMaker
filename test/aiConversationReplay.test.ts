// test/aiConversationReplay.test.ts
// "이전 대화 이어가기" 가 모델 쪽에서도 참이 되게 하는 직렬화의 계약.
//
// 잠그는 것 셋:
//  1. status 항목은 버린다(턴 수명주기 진단은 다음 턴 모델에게 소음이다).
//  2. 상한을 넘으면 **꼬리**를 남긴다 — 앞을 남기면 "방금 무엇을 하던 중" 이 사라진다.
//  3. 주입 메시지는 role "user" + 마커로 시작한다(압축 요약과 같은 안전 지대. tool_calls 짝을
//     재구성하면 Gemini/Cloud Code Assist 에서 400 이다).

import { describe, expect, it } from "vitest";
import type { AuditEntry } from "@/ai/assistantSession";
import {
  RESTORED_TRANSCRIPT_MARKER,
  isRestoredTranscriptMessage,
  restoredTranscriptMessage,
  serializeAuditTranscript,
} from "@/ai/conversationReplay";

const ENTRIES: readonly AuditEntry[] = [
  { kind: "user", text: "마을 입구에 우물을 놔줘" },
  { kind: "status", text: "tools:exposed=40" },
  { kind: "tool", name: "place_structure", args: { id: "well" }, ok: true, summary: "우물 1개 배치" },
  { kind: "assistant", text: "우물을 놨습니다." },
  { kind: "tool", name: "edit_tile", args: {}, ok: false, summary: "범위를 벗어났습니다" },
];

describe("serializeAuditTranscript", () => {
  it("Given 사용자·조수·툴·상태가 섞인 기록 When 직렬화 Then 상태만 빠지고 나머지는 순서대로 남는다", () => {
    const lines = serializeAuditTranscript(ENTRIES).split("\n");

    expect(lines).toEqual([
      "[사용자] 마을 입구에 우물을 놔줘",
      "[툴 성공] place_structure: 우물 1개 배치",
      "[조수] 우물을 놨습니다.",
      "[툴 실패] edit_tile: 범위를 벗어났습니다",
    ]);
    expect(serializeAuditTranscript(ENTRIES)).not.toContain("tools:exposed");
  });

  it("Given 빈 기록 When 직렬화 Then 빈 문자열이다(주입할 것이 없다는 신호)", () => {
    expect(serializeAuditTranscript([])).toBe("");
    expect(serializeAuditTranscript([{ kind: "status", text: "x" }])).toBe("");
  });

  it("Given 공백만 있는 발화 When 직렬화 Then 줄을 만들지 않는다", () => {
    expect(serializeAuditTranscript([{ kind: "user", text: "   " }, { kind: "assistant", text: "\n" }])).toBe("");
  });

  it("Given 상한을 넘는 기록 When 직렬화 Then 최근 줄이 남고 생략 머리글이 붙는다", () => {
    const many: AuditEntry[] = Array.from({ length: 40 }, (_unused, index) => ({
      kind: "user" as const,
      text: `${index}번째 지시 ${"가".repeat(20)}`,
    }));

    const output = serializeAuditTranscript(many, 300);

    expect(output.startsWith("[앞부분 ")).toBe(true);
    expect(output).toContain("39번째 지시");
    expect(output).not.toContain("0번째 지시");
    expect(output.length).toBeLessThanOrEqual(300 + "[앞부분 00줄 생략 — 오래된 기록]\n".length);
  });

  it("Given 아주 긴 툴 요약 When 직렬화 Then 요약 1건이 200자에서 잘린다", () => {
    const output = serializeAuditTranscript([
      { kind: "tool", name: "t", args: {}, ok: true, summary: "가".repeat(500) },
    ]);

    expect(output).toContain("…");
    expect(output.length).toBeLessThan(300);
  });
});

describe("restoredTranscriptMessage", () => {
  it("Given 직렬화된 기록 When 메시지 생성 Then user 역할 + 마커 + 재실행 금지 문구를 담는다", () => {
    const message = restoredTranscriptMessage("[사용자] 우물");

    expect(message.role).toBe("user");
    expect(String(message.content).startsWith(RESTORED_TRANSCRIPT_MARKER)).toBe(true);
    expect(String(message.content)).toContain("다시 실행하지 마라");
    expect(String(message.content)).toContain("[사용자] 우물");
    expect(isRestoredTranscriptMessage(message)).toBe(true);
  });

  it("Given 평범한 사용자 메시지 When 판정 Then 복원 메시지가 아니다", () => {
    expect(isRestoredTranscriptMessage({ role: "user", content: "우물 놔줘" })).toBe(false);
    expect(isRestoredTranscriptMessage({ role: "system", content: RESTORED_TRANSCRIPT_MARKER })).toBe(false);
  });
});
