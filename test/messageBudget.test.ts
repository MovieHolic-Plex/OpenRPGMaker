// test/messageBudget.test.ts
// CPEN 64k 메시지 내용 상한 대응 — 전송 사본 압축(자율 런 todo 8 실측 422 재현 방지).

import { describe, expect, it } from "vitest";
import {
  REQUEST_MESSAGE_CHAR_BUDGET,
  compactMessagesForRequest,
  messageCharLength,
  totalMessagesCharLength,
} from "@/ai/messageBudget";
import type { ChatMessage } from "@/ai/llmClient";

function toolMessage(content: string, id = "c1"): ChatMessage {
  return { role: "tool", content, tool_call_id: id };
}

function userWithImage(text: string, imageLen: number): ChatMessage {
  return {
    role: "user",
    content: [
      { type: "text", text },
      { type: "image_url", image_url: { url: `data:image/png;base64,${"A".repeat(imageLen)}`, detail: "low" } },
    ],
  };
}

function recentTail(): ChatMessage[] {
  return [
    { role: "assistant", content: "최근 1" },
    userWithImage("최근 2", 100),
    { role: "assistant", content: "최근 3" },
    { role: "assistant", content: "최근 4" },
    { role: "assistant", content: "최근 5" },
    { role: "assistant", content: "최근 6" },
  ];
}

describe("messageCharLength / totalMessagesCharLength", () => {
  it("문자열/파트/이미지 URL 길이를 합산한다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "abc" },
      userWithImage("text", 100),
      toolMessage('{"ok":true,"summary":"s"}'),
    ];
    expect(messageCharLength(messages[0])).toBe(3);
    // text(4) + "data:image/png;base64,"(22) + 100
    expect(messageCharLength(messages[1])).toBe(4 + 22 + 100);
    // tool: {"ok":true,"summary":"s"} = 25자
    expect(totalMessagesCharLength(messages)).toBe(3 + (4 + 22 + 100) + 25);
  });
});

describe("compactMessagesForRequest", () => {
  it("예산 이하는 그대로 사본을 돌려준다", () => {
    const messages: ChatMessage[] = [{ role: "system", content: "s" }, { role: "user", content: "hi" }];
    const out = compactMessagesForRequest(messages, 10_000);
    expect(out).toEqual(messages);
    expect(out).not.toBe(messages); // 사본
  });

  it("오래된 툴 결과를 ok/summary/issues 만 남기고 data/diff 를 제거한다", () => {
    // 툴 응답은 자신을 부른 assistant tool_calls 와 짝이 맞아야 한다 — 전송 사본은
    // repairToolCallProtocol 을 거치며 짝 없는 function response 를 버린다(공급자 400 방지).
    const messages: ChatMessage[] = [
      { role: "system", content: "s" },
      {
        role: "assistant",
        content: null,
        tool_calls: ["t0", "t1", "t2"].map((id) => ({ id, type: "function" as const, function: { name: "get_map_region", arguments: "{}" } })),
      },
      toolMessage(JSON.stringify({ ok: true, summary: "오래된 0", data: "x".repeat(2000), diff: { tilesChanged: 5 } }), "t0"),
      toolMessage(JSON.stringify({ ok: true, summary: "오래된 1", data: "x".repeat(2000) }), "t1"),
      toolMessage(JSON.stringify({ ok: true, summary: "오래된 2", data: "x".repeat(2000) }), "t2"),
      ...recentTail(),
    ];
    // 최근 6개 ≈ 200자 + 시스템 1자 + 툴 3개(6000자) — 예산 2000이면 오래된 툴만 압축.
    const out = compactMessagesForRequest(messages, 2000);
    expect(totalMessagesCharLength(out)).toBeLessThanOrEqual(2000);
    const compacted = out[2].content as string;
    expect(compacted).toContain('"ok":true');
    expect(compacted).toContain('"summary":"오래된 0"');
    expect(compacted).not.toContain("xxxx");
    expect(compacted).not.toContain("tilesChanged");
  });

  it("오래된 user 메시지의 이미지(base64) 파트를 제거한다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "s" },
      userWithImage("오래된 이미지 메시지", 5000),
      ...recentTail(),
    ];
    const out = compactMessagesForRequest(messages, 1500);
    const content = out[1].content;
    expect(Array.isArray(content)).toBe(true);
    const parts = content as Array<{ type: string }>;
    expect(parts.some((p) => p.type === "image_url")).toBe(false);
    expect(parts.some((p) => p.type === "text")).toBe(true);
  });

  it("최근 KEEP_RECENT 메시지는 압축하지 않는다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "s" },
      toolMessage(JSON.stringify({ ok: true, summary: "오래된 0", data: "x".repeat(2000) })),
      ...recentTail(),
    ];
    const out = compactMessagesForRequest(messages, 2000);
    // 오래된 툴 1개는 압축되어 잘린다. 최근 6개는 무압축 유지.
    const recentUser = out.find((m) => Array.isArray(m.content)) as ChatMessage;
    const parts = recentUser.content as Array<{ type: string }>;
    expect(parts.some((p) => p.type === "image_url")).toBe(true);
    expect(out[out.length - 1].content).toBe("최근 6");
  });

  it("예산을 초과하면 시스템·최근 2개를 남기고 오래된 메시지를 제거한다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "s" },
      ...Array.from({ length: 20 }, (_, i) =>
        toolMessage(JSON.stringify({ ok: true, summary: `오래된 ${i}`, data: "x".repeat(2000) })),
      ),
      ...recentTail(),
    ];
    const out = compactMessagesForRequest(messages, 200);
    expect(out.length).toBeGreaterThanOrEqual(3);
    expect(out[0].content).toBe("s");
    expect(out[out.length - 1].content).toBe("최근 6");
    expect(totalMessagesCharLength(out)).toBeLessThanOrEqual(200);
  });

  it("기본 예산(52k)과 CPEN 하드 상한(64k) 사이에 여유가 있다", () => {
    expect(REQUEST_MESSAGE_CHAR_BUDGET).toBeLessThan(64_000);
    // 대표 부하: 시스템 12k + 뷰포트 이미지 33k + 툴 결과 여러 개 — 52k 예산으로 압축된다.
    const messages: ChatMessage[] = [
      { role: "system", content: "s".repeat(12_000) },
      userWithImage("목표", 33_000),
      toolMessage(JSON.stringify({ ok: true, summary: "s", data: "x".repeat(10_000) })),
      { role: "assistant", content: "a".repeat(5_000) },
    ];
    const out = compactMessagesForRequest(messages);
    expect(totalMessagesCharLength(out)).toBeLessThanOrEqual(REQUEST_MESSAGE_CHAR_BUDGET);
  });

  // 실측 회귀(2026-08-26): 짧은 대화에서 예산을 넘기면 예전 구현이 사용자 지시를 제일 먼저
  // 삭제했고, system → assistant(tool_calls) 순서가 되어 Cloud Code Assist 가 400
  // `function call turn comes immediately after a user turn` 으로 턴을 죽였다.
  it("예산을 넘겨도 사용자 지시를 버리지 않고 이미지를 먼저 버린다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "s".repeat(12_000) },
      userWithImage("빈 풀밭에 3x3 꽃밭을 깔아줘", 60_000),
      { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "get_map_region", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: JSON.stringify({ ok: true, summary: "영역" }) },
    ];

    const out = compactMessagesForRequest(messages);

    expect(totalMessagesCharLength(out)).toBeLessThanOrEqual(REQUEST_MESSAGE_CHAR_BUDGET);
    // 지시 문장은 살아 있다.
    const userTurn = out.find((message) => message.role === "user");
    expect(userTurn, "user 턴이 삭제되면 안 된다").toBeDefined();
    expect(JSON.stringify(userTurn?.content)).toContain("3x3 꽃밭");
    // 이미지는 버려졌다.
    expect(JSON.stringify(userTurn?.content)).not.toContain("data:image");
    // 시스템 다음 턴은 user 여야 한다 — Gemini 의 요구사항이다.
    expect(out[1]?.role).toBe("user");
  });

  it("assistant 를 버릴 때 짝 없는 tool 응답을 남기지 않는다", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "s".repeat(30_000) },
      { role: "user", content: "지시" },
      { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "a", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c1", content: "x".repeat(20_000) },
      { role: "assistant", content: null, tool_calls: [{ id: "c2", type: "function", function: { name: "b", arguments: "{}" } }] },
      { role: "tool", tool_call_id: "c2", content: "y".repeat(20_000) },
      { role: "user", content: "다음 지시" },
    ];

    const out = compactMessagesForRequest(messages, 40_000);

    const callIds = new Set(out.flatMap((message) => (message.tool_calls ?? []).map((call) => call.id)));
    for (const message of out) {
      if (message.role !== "tool") continue;
      expect(callIds.has(message.tool_call_id ?? ""), `짝 없는 tool 응답: ${message.tool_call_id}`).toBe(true);
    }
    expect(out.filter((message) => message.role === "user")).toHaveLength(2);
  });
});

describe("current image under schema budget pressure", () => {
  it("keeps the latest capture by dropping older assistant history without mutating the transcript", () => {
    const messages: ChatMessage[] = [
      { role: "system", content: "system" },
      { role: "user", content: "Inspect the new revision" },
      { role: "assistant", content: "old response ".repeat(100) },
      { role: "assistant", content: "Capture complete" },
      userWithImage("Current map", 100),
    ];
    const before = JSON.stringify(messages);
    const out = compactMessagesForRequest(messages, 250);
    expect(totalMessagesCharLength(out)).toBeLessThanOrEqual(250);
    expect(out.some(m => Array.isArray(m.content) && m.content.some(p => p.type === "image_url"))).toBe(true);
    expect(out.some(m => m.content === "Inspect the new revision")).toBe(true);
    expect(JSON.stringify(messages)).toBe(before);
    const tiny = compactMessagesForRequest(messages, 80);
    expect(totalMessagesCharLength(tiny)).toBeLessThanOrEqual(80);
    expect(tiny.some(m => Array.isArray(m.content) && m.content.some(p => p.type === "image_url"))).toBe(false);
  });
});
