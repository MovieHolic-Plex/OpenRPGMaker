import { describe, expect, it } from "vitest";
import { compactMessagesForRequest } from "@/ai/messageBudget";
import type { ChatMessage } from "@/ai/llmClient";

function captureMessage(): ChatMessage {
  return {
    role: "user",
    content: [
      { type: "text", text: "방금 조회한 화면입니다." },
      { type: "image_url", image_url: { url: `data:image/png;base64,${"A".repeat(200)}` } },
    ],
  };
}

function hugeToolResult(): ChatMessage {
  return { role: "tool", content: JSON.stringify({ ok: true, summary: "맵 격자", data: { grid: "B".repeat(3_000) } }), tool_call_id: "c1" };
}

describe("최신 캡처 보호", () => {
  it("최근 창 밖으로 밀려난 최신 캡처 이미지가 1차 압축에서 지워지지 않는다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "system" },
      captureMessage(),
      hugeToolResult(),
      ...[1, 2, 3, 4, 5, 6].map((index) => ({ role: "assistant", content: `${index}번째 최근 메시지` }) as ChatMessage),
    ];

    const out = compactMessagesForRequest(messages, 1_200);

    const capture = out.find((message) => Array.isArray(message.content) && message.content.some((part) => part.type === "image_url"));
    expect(capture, "최신 캡처가 압축에서 사라졌다").toBeDefined();
  });

  it("예산 안에 들어가면 오래된 이미지는 그대로 압축된다", () => {
    const older: ChatMessage = {
      role: "user",
      content: [
        { type: "text", text: "예전 캡처" },
        { type: "image_url", image_url: { url: `data:image/png;base64,${"C".repeat(200)}` } },
      ],
    };
    const messages: ChatMessage[] = [
      { role: "system", content: "system" },
      older,
      captureMessage(),
      hugeToolResult(),
      ...[1, 2, 3, 4, 5, 6].map((index) => ({ role: "assistant", content: `${index}번째 최근 메시지` }) as ChatMessage),
    ];

    const out = compactMessagesForRequest(messages, 1_200);

    const images = out.flatMap((message) => (Array.isArray(message.content) ? message.content.filter((part) => part.type === "image_url") : []));
    expect(images).toHaveLength(1);
  });
});
