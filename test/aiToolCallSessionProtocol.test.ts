// test/aiToolCallSessionProtocol.test.ts
// 세션 툴 루프의 프로토콜 계약(2026-08-30 실측 결함):
//  - 인자 JSON 이 깨지면 툴을 돌리지 않고 **깨졌다는 사실**을 모델에게 되돌린다. 예전엔 빈 인자로
//    툴을 돌려 `필수 인자 누락: mapId, x, y…` 라는 거짓 원인을 보냈고, 모델은 같은(잘린) 페이로드를
//    재전송했다.
//  - 툴 실행 중 예외가 나도 그 호출의 role:"tool" 응답은 남는다. 남지 않으면 짝 없는 tool_calls 가
//    영구 대화에 박혀 그 세션의 **모든 다음 턴**이 공급자 400 으로 죽는다.
import { describe, expect, it } from "vitest";
// 정적 import 다 — 동적 import 를 테스트 본문에서 하면 레지스트리(188툴) 로딩 시간이 그 테스트의
// 15초 예산에 들어가 부하가 걸린 병렬 스위트에서 타임아웃으로 깜박인다(실측: 단독 8초 / 스위트 15초+).
import { AssistantSession } from "@/ai/assistantSession";
import type { ChatMessage, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";

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

const finalAnswer = (): ChatResult => ({ message: { role: "assistant", content: "끝" }, finishReason: "stop" }) as ChatResult;

function toolCallRound(id: string, name: string, rawArguments: string): ChatResult {
  return {
    message: { role: "assistant", content: null, tool_calls: [{ id, type: "function", function: { name, arguments: rawArguments } }] },
    finishReason: "tool_calls",
  } as ChatResult;
}

/** 짝 없는 tool_calls id 목록 — 비어 있어야 한다. */
function orphanCallIds(messages: readonly ChatMessage[]): string[] {
  const answered = new Set(messages.filter((message) => message.role === "tool").map((message) => message.tool_call_id));
  return messages.flatMap((message) => (message.tool_calls ?? []).map((call) => call.id)).filter((id) => !answered.has(id));
}

describe("툴 인자 JSON 파싱 실패", () => {
  it("잘린 JSON 은 잘렸다고 알린다 — 인자 누락으로 위장하지 않는다", async () => {
    const sent: ChatMessage[][] = [];
    let round = 0;
    const chat = async (_config: unknown, request: { messages: ChatMessage[] }): Promise<ChatResult> => {
      sent.push([...request.messages]);
      round += 1;
      // 출력 상한으로 인자가 중간에 잘린 실측 형태.
      return round === 1 ? toolCallRound("c1", "place_npc", '{"mapId":"map_1","x":3,') : finalAnswer();
    };

    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat as never });
    await session.sendUserMessage("NPC 하나 놓아줘", () => {});

    const toolMessage = sent.at(-1)?.find((message) => message.role === "tool");
    const content = String(toolMessage?.content ?? "");
    expect(content).toContain("invalid-json-args");
    expect(content).toContain("JSON");
    // 거짓 원인(인자 누락)으로 안내하지 않는다.
    expect(content).not.toContain("필수 인자 누락");
    expect(orphanCallIds(session.getMessages())).toEqual([]);
  });
});

describe("툴 루프 예외", () => {
  it("예외가 나도 그 호출의 tool 응답이 남아 세션이 오염되지 않는다", async () => {
    let round = 0;
    const chat = async (): Promise<ChatResult> => {
      round += 1;
      return round === 1 ? toolCallRound("c1", "set_title_screen", JSON.stringify({ title: "t" })) : finalAnswer();
    };
    const session = new AssistantSession(createBlankProject(), { config: CONFIG, chat: chat as never });
    // 툴 실행 성공 직후(=tool 응답을 붙이기 전) 단계에서 던지게 만든다. 실제로는 마일스톤 자동
    // 적용·검증 스윕처럼 await 가 걸린 후처리가 이 자리에서 던질 수 있다.
    const internals = session as unknown as { recordSuccessfulTool: (name: string) => void };
    internals.recordSuccessfulTool = (): never => {
      throw new Error("후처리 폭발");
    };

    await expect(session.sendUserMessage("타이틀 바꿔줘", () => {})).rejects.toThrow("후처리 폭발");

    const messages = session.getMessages();
    expect(orphanCallIds(messages)).toEqual([]);
    const toolMessage = messages.find((message) => message.role === "tool");
    expect(String(toolMessage?.content)).toContain("후처리 폭발");
  });
});
