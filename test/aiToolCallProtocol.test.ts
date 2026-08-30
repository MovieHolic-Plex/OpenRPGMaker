// test/aiToolCallProtocol.test.ts
// 툴콜 프로토콜 계약 — 공급자 응답이 지저분해도(index 누락 / id 누락·중복 / 잘린 인자 JSON)
// 대화는 항상 "assistant tool_calls 하나당 role:tool 응답 하나, id 는 유일" 상태를 지킨다.
//
// 이 파일이 고정하는 실측 결함(2026-08-30):
//  1. 스트리밍 delta 에 `index` 가 없으면 병렬 툴콜 2건이 한 슬롯에 합쳐져 이름·인자가 이어붙었다
//     (`fill_region`+`place_npc` → `fill_regionplace_npc`, `'{"a":1}{"b":2}'`) — 두 호출이 사라졌다.
//  2. 스트리밍에서 id 가 없으면 `call_${name}` 으로 채워 같은 툴 병렬 호출이 **같은 id** 를 가졌다.
//  3. 비스트리밍에서 id 가 없으면 **빈 문자열** id 가 됐다.
//  4. 인자 JSON 파싱 실패를 조용히 삼켜 모델에게 `필수 인자 누락: mapId, x, y…` 라고 알렸다 —
//     원인(대개 출력 상한으로 잘린 JSON)을 숨기니 모델이 같은 페이로드를 재전송했다.
//  5. 툴 실행 중 예외가 나면 짝 없는 assistant tool_calls 가 영구 대화에 남아 **그 뒤 모든 턴**이
//     공급자 400 으로 죽었다(세션 오염).
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/ai/llmClient";
import { compactMessagesForRequest, repairToolCallProtocol } from "@/ai/messageBudget";

const CONFIG = {
  authMode: "apiKey" as const,
  baseUrl: "https://example.invalid/v1",
  model: "minimax/minimax-m3",
  liteModel: "minimax/minimax-m3",
  apiKey: "sk-test",
  maxToolCalls: 6,
  maxTokens: 4096,
  agentMode: "chat" as const,
};

function streamFromChunks(chunks: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(encoder.encode(chunks[index]));
        index += 1;
      } else controller.close();
    },
  });
}

function sseChunks(deltas: readonly unknown[]): string[] {
  return [
    ...deltas.map((delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}\n\n`),
    `data: ${JSON.stringify({ choices: [{ finish_reason: "tool_calls", delta: {} }] })}\n\n`,
    "data: [DONE]\n\n",
  ];
}

function stubStream(deltas: readonly unknown[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(streamFromChunks(sseChunks(deltas)), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })),
  );
}

describe("스트리밍 tool_calls 조립", () => {
  it("index 없는 병렬 툴콜은 배치 위치로 갈라진다", async () => {
    const { chatCompletion } = await import("@/ai/llmClient");
    stubStream([
      {
        tool_calls: [
          { function: { name: "fill_region", arguments: '{"a":1}' } },
          { function: { name: "place_npc", arguments: '{"b":2}' } },
        ],
      },
    ]);

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "두 개 해줘" }], stream: true });

    const calls = result.message.tool_calls ?? [];
    expect(calls.map((call) => call.function.name)).toEqual(["fill_region", "place_npc"]);
    expect(calls.map((call) => call.function.arguments)).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("index 없는 여러 청크는 같은 호출로 이어붙는다 — 이름을 다시 선언하지 않기 때문", async () => {
    const { chatCompletion } = await import("@/ai/llmClient");
    stubStream([
      { tool_calls: [{ function: { name: "fill_region", arguments: '{"map' } }] },
      { tool_calls: [{ function: { arguments: 'Id":"m1"}' } }] },
    ]);

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "하나만" }], stream: true });

    expect(result.message.tool_calls).toEqual([
      { id: "call_0_fill_region", type: "function", function: { name: "fill_region", arguments: '{"mapId":"m1"}' } },
    ]);
  });

  it("공급자가 준 index 는 그대로 존중한다", async () => {
    const { chatCompletion } = await import("@/ai/llmClient");
    stubStream([
      { tool_calls: [{ index: 1, id: "b", function: { name: "place_npc", arguments: "{}" } }] },
      { tool_calls: [{ index: 0, id: "a", function: { name: "fill_region", arguments: "{}" } }] },
    ]);

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "두 개" }], stream: true });

    expect((result.message.tool_calls ?? []).map((call) => call.id)).toEqual(["a", "b"]);
  });

  it("index 를 준 delta 와 안 준 delta 가 섞여도 호출이 합쳐지지 않는다", async () => {
    const { chatCompletion } = await import("@/ai/llmClient");
    stubStream([
      { tool_calls: [{ index: 0, id: "a", function: { name: "fill_region", arguments: "{}" } }] },
      { tool_calls: [{ function: { name: "place_npc", arguments: "{}" } }] },
    ]);

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "섞어서" }], stream: true });

    const calls = result.message.tool_calls ?? [];
    expect(calls.map((call) => call.function.name)).toEqual(["fill_region", "place_npc"]);
    expect(new Set(calls.map((call) => call.id)).size).toBe(2);
  });

  it("id 가 없거나 겹쳐도 호출마다 유일한 tool_call_id 가 된다", async () => {
    const { chatCompletion } = await import("@/ai/llmClient");
    stubStream([
      {
        tool_calls: [
          { index: 0, function: { name: "place_npc", arguments: '{"a":1}' } },
          { index: 1, function: { name: "place_npc", arguments: '{"b":2}' } },
          { index: 2, id: "dup", function: { name: "place_npc", arguments: '{"c":3}' } },
          { index: 3, id: "dup", function: { name: "place_npc", arguments: '{"d":4}' } },
        ],
      },
    ]);

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "네 개" }], stream: true });

    const ids = (result.message.tool_calls ?? []).map((call) => call.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((id) => id.length > 0)).toBe(true);
  });
});

describe("비스트리밍 tool_calls 파싱", () => {
  it("id 없는 병렬 호출도 빈 id 없이 유일해진다", async () => {
    const { chatCompletion } = await import("@/ai/llmClient");
    const body = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              { function: { name: "place_npc", arguments: "{}" } },
              { function: { name: "place_npc", arguments: '{"x":1}' } },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "두 명" }], stream: false });

    const ids = (result.message.tool_calls ?? []).map((call) => call.id);
    expect(ids).toEqual(["call_0_place_npc", "call_1_place_npc"]);
  });
});

describe("비스트리밍 숫자 id", () => {
  it("숫자 id 를 주는 게이트웨이의 값은 버리지 않고 문자열로 정규화한다", async () => {
    const { chatCompletion } = await import("@/ai/llmClient");
    const body = {
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [{ id: 7, function: { name: "place_npc", arguments: "{}" } }],
          },
          finish_reason: "tool_calls",
        },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await chatCompletion(CONFIG, { messages: [{ role: "user", content: "한 명" }], stream: false });

    expect((result.message.tool_calls ?? [])[0]?.id).toBe("7");
  });
});

describe("전송 사본의 툴 짝 불변식", () => {
  const call = (id: string, name = "place_npc"): ChatMessage => ({
    role: "assistant",
    content: null,
    tool_calls: [{ id, type: "function", function: { name, arguments: "{}" } }],
  });

  it("짝 없는 assistant tool_calls 에는 유실 응답을 붙인다", () => {
    const repaired = repairToolCallProtocol([
      { role: "system", content: "sys" },
      { role: "user", content: "지시" },
      call("c1"),
    ]);

    expect(repaired.map((message) => message.role)).toEqual(["system", "user", "assistant", "tool"]);
    expect(repaired[3]?.tool_call_id).toBe("c1");
    expect(String(repaired[3]?.content)).toContain("유실");
  });

  it("짝 없는 tool 응답과 중복 응답은 버린다", () => {
    const repaired = repairToolCallProtocol([
      { role: "system", content: "sys" },
      { role: "tool", content: "{}", tool_call_id: "ghost", name: "place_npc" },
      { role: "user", content: "지시" },
      call("c1"),
      { role: "tool", content: '{"ok":true}', tool_call_id: "c1", name: "place_npc" },
      { role: "tool", content: '{"ok":true}', tool_call_id: "c1", name: "place_npc" },
    ]);

    expect(repaired.filter((message) => message.role === "tool")).toHaveLength(1);
    expect(repaired.map((message) => message.role)).toEqual(["system", "user", "assistant", "tool"]);
  });

  it("문자 클램프가 툴 응답을 버려도 요청 사본은 짝이 맞는다", () => {
    const big = "x".repeat(4000);
    const messages: ChatMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "지시" },
      call("c1"),
      { role: "tool", content: big, tool_call_id: "c1", name: "place_npc" },
      call("c2"),
      { role: "tool", content: big, tool_call_id: "c2", name: "place_npc" },
      { role: "user", content: "다음 지시" },
      call("c3"),
      { role: "tool", content: big, tool_call_id: "c3", name: "place_npc" },
      { role: "assistant", content: "끝" },
    ];

    const out = compactMessagesForRequest(messages, 1200);

    const answered = new Set(out.filter((message) => message.role === "tool").map((message) => message.tool_call_id));
    const called = out.flatMap((message) => (message.tool_calls ?? []).map((entry) => entry.id));
    expect(called.filter((id) => !answered.has(id))).toEqual([]);
    expect(out.filter((message) => message.role === "tool" && !called.includes(message.tool_call_id ?? ""))).toEqual([]);
  });
});
